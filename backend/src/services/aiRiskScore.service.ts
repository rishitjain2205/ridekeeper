import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient, Patient, Appointment, SMSMessage } from '@prisma/client';
import { RiskScoreService, RiskScoreResult, RiskCategory } from './riskScore.service.js';

export interface AIRiskAssessment {
  adjustedScore: number;
  adjustment: number;
  confidence: number;
  reasoning: string;
  recommendations: string[];
  optimalContactTime: string;
  riskFactors: string[];
}

export interface EnhancedRiskScoreResult extends RiskScoreResult {
  aiAssessment?: AIRiskAssessment;
  finalScore: number;
  isAIEnhanced: boolean;
  aiAvailable: boolean;
}

export class AIRiskScoreService {
  private prisma: PrismaClient;
  private client: Anthropic | null = null;
  private riskScoreService: RiskScoreService;
  private isEnabled: boolean;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.riskScoreService = new RiskScoreService(prisma);
    this.isEnabled = process.env.AI_RISK_SCORING_ENABLED === 'true';
    this.initClient();
  }

  private initClient() {
    // Lazy init - check env vars each time in case they were set after startup
    if (!this.client && process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_TEST_MODE !== 'true') {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      console.log('[AI Risk] Anthropic client initialized');
    }
  }

  private getClient(): Anthropic | null {
    this.initClient();
    return this.client;
  }

  /**
   * Calculate AI-enhanced risk score
   * Falls back to rule-based scoring if AI unavailable
   */
  async calculateAIEnhancedRiskScore(
    patient: Patient,
    appointment: Appointment & { smsMessages?: SMSMessage[] }
  ): Promise<EnhancedRiskScoreResult> {
    // First, calculate the base rule-based score
    const baseResult = await this.riskScoreService.calculateRiskScore(patient, appointment);

    // Check if AI is enabled and available
    const client = this.getClient();
    if (!this.isEnabled || !client) {
      return {
        ...baseResult,
        finalScore: baseResult.score,
        isAIEnhanced: false,
        aiAvailable: false
      };
    }

    // Check cache first
    const cached = await this.getCachedAssessment(appointment.id);
    if (cached) {
      return this.combineScores(baseResult, cached);
    }

    // Get patient history for AI analysis
    const patientHistory = await this.getPatientHistory(patient.id);
    const smsHistory = appointment.smsMessages || await this.getSMSHistory(patient.id);

    try {
      // Call Claude for AI assessment
      const aiAssessment = await this.getAIAssessment(
        patient,
        appointment,
        baseResult,
        patientHistory,
        smsHistory
      );

      // Cache the result
      await this.cacheAssessment(appointment.id, aiAssessment);

      // Update appointment with AI data
      await this.updateAppointmentWithAI(appointment.id, aiAssessment);

      return this.combineScores(baseResult, aiAssessment);
    } catch (error) {
      console.error('[AI Risk] Error getting AI assessment:', error);

      // Fallback to rule-based scoring
      return {
        ...baseResult,
        finalScore: baseResult.score,
        isAIEnhanced: false,
        aiAvailable: false
      };
    }
  }

  /**
   * Get AI assessment from Claude
   */
  private async getAIAssessment(
    patient: Patient,
    appointment: Appointment,
    baseResult: RiskScoreResult,
    patientHistory: any,
    smsHistory: SMSMessage[]
  ): Promise<AIRiskAssessment> {
    const smsContext = smsHistory.slice(0, 10).map(msg => ({
      direction: msg.direction,
      message: msg.message.substring(0, 200),
      timestamp: msg.createdAt,
      dayOfWeek: new Date(msg.createdAt).toLocaleDateString('en-US', { weekday: 'long' }),
      timeOfDay: new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    }));

    const prompt = `You are a healthcare coordination AI analyzing patient appointment attendance risk.

Patient Profile:
- Name: ${patient.firstName} ${patient.lastName}
- Housing Status: ${patient.housingStatus}
- Distance from clinic: ${patient.distanceFromClinic || 'Unknown'} miles
- Phone on file: ${patient.phoneNumber ? 'Yes' : 'No (uses caseworker)'}

Appointment History:
- Total past appointments: ${patientHistory.totalAppointments}
- Completed appointments: ${patientHistory.completed}
- No-shows: ${patientHistory.noShows}
- Cancellations: ${patientHistory.cancelled}
- Last successful appointment: ${patientHistory.lastSuccessful || 'Never'}
- Days since last appointment: ${patientHistory.daysSinceLast || 'N/A'}

Recent Communication History (last ${smsContext.length} messages):
${smsContext.map(msg => `[${msg.dayOfWeek} ${msg.timeOfDay}] ${msg.direction}: "${msg.message}"`).join('\n') || 'No messages yet'}

Current Appointment:
- Date: ${new Date(appointment.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
- Time: ${new Date(appointment.appointmentDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
- Type: ${appointment.appointmentType}
- Day of week: ${new Date(appointment.appointmentDate).toLocaleDateString('en-US', { weekday: 'long' })}

Base Risk Score (rules-based): ${baseResult.score}/100 (${baseResult.category})
Rule-based factors:
${baseResult.factors.map(f => `- ${f.factor}: +${f.points} points (${f.reason})`).join('\n')}

Analyze this patient's risk of missing their upcoming appointment.

Consider:
1. Communication responsiveness patterns - Do they respond quickly? At what times?
2. Stated barriers in past messages - Any transportation issues mentioned?
3. Timing patterns - Are no-shows more common on certain days/times?
4. Engagement level - How engaged are they in confirmations?
5. Housing instability impact - How does their situation affect reliability?

Return ONLY a JSON response (no markdown, no explanation outside JSON):
{
  "adjustedScore": <number 0-100>,
  "adjustment": <number -20 to +20 from base score>,
  "confidence": <number 0-100>,
  "reasoning": "<2-3 sentence explanation of your assessment>",
  "recommendations": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>"],
  "optimalContactTime": "<best time to contact, e.g. '7 PM evening' or 'Morning before 10 AM'>",
  "riskFactors": ["<key risk factor 1>", "<key risk factor 2>"]
}`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the JSON response
    try {
      // Clean the response - remove any markdown code blocks if present
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const aiResult = JSON.parse(jsonText);

      // Validate and sanitize the response
      return {
        adjustedScore: Math.max(0, Math.min(100, aiResult.adjustedScore || baseResult.score)),
        adjustment: Math.max(-20, Math.min(20, aiResult.adjustment || 0)),
        confidence: Math.max(0, Math.min(100, aiResult.confidence || 50)),
        reasoning: aiResult.reasoning || 'AI assessment completed',
        recommendations: Array.isArray(aiResult.recommendations) ? aiResult.recommendations.slice(0, 5) : [],
        optimalContactTime: aiResult.optimalContactTime || 'Morning',
        riskFactors: Array.isArray(aiResult.riskFactors) ? aiResult.riskFactors.slice(0, 5) : []
      };
    } catch (parseError) {
      console.error('[AI Risk] Failed to parse Claude response:', content.text);
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Combine base score with AI assessment based on confidence
   */
  private combineScores(
    baseResult: RiskScoreResult,
    aiAssessment: AIRiskAssessment
  ): EnhancedRiskScoreResult {
    let finalScore: number;

    if (aiAssessment.confidence >= 80) {
      // High confidence: Use AI score directly
      finalScore = aiAssessment.adjustedScore;
    } else if (aiAssessment.confidence >= 50) {
      // Medium confidence: Average of base and AI
      finalScore = Math.round((baseResult.score + aiAssessment.adjustedScore) / 2);
    } else {
      // Low confidence: Use base score
      finalScore = baseResult.score;
    }

    // Update category based on final score
    let category: RiskCategory;
    if (finalScore <= 30) {
      category = RiskCategory.LOW;
    } else if (finalScore <= 60) {
      category = RiskCategory.MEDIUM;
    } else {
      category = RiskCategory.HIGH;
    }

    return {
      ...baseResult,
      score: baseResult.score, // Keep original rule-based score
      category,
      finalScore,
      aiAssessment,
      isAIEnhanced: true,
      aiAvailable: true
    };
  }

  /**
   * Get patient appointment history
   */
  private async getPatientHistory(patientId: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { appointmentDate: 'desc' },
      take: 20
    });

    const completed = appointments.filter(a => a.status === 'COMPLETED').length;
    const noShows = appointments.filter(a => a.status === 'NO_SHOW').length;
    const cancelled = appointments.filter(a => a.status === 'CANCELLED').length;

    const lastSuccessful = appointments.find(a => a.status === 'COMPLETED');
    const daysSinceLast = lastSuccessful
      ? Math.floor((Date.now() - new Date(lastSuccessful.appointmentDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      totalAppointments: appointments.length,
      completed,
      noShows,
      cancelled,
      lastSuccessful: lastSuccessful?.appointmentDate.toISOString().split('T')[0],
      daysSinceLast
    };
  }

  /**
   * Get SMS history for patient
   */
  private async getSMSHistory(patientId: string): Promise<SMSMessage[]> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { phoneNumber: true }
    });

    if (!patient?.phoneNumber) return [];

    return this.prisma.sMSMessage.findMany({
      where: { phoneNumber: patient.phoneNumber },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  /**
   * Get cached AI assessment if valid
   */
  private async getCachedAssessment(appointmentId: string): Promise<AIRiskAssessment | null> {
    try {
      const cached = await this.prisma.aIRiskCache.findUnique({
        where: { appointmentId }
      });

      if (!cached || new Date() > cached.expiresAt) {
        return null;
      }

      return {
        adjustedScore: cached.aiScore,
        adjustment: 0, // Not stored in cache
        confidence: cached.confidence,
        reasoning: cached.reasoning,
        recommendations: JSON.parse(cached.recommendations),
        optimalContactTime: cached.optimalContactTime || 'Morning',
        riskFactors: JSON.parse(cached.riskFactors)
      };
    } catch {
      return null;
    }
  }

  /**
   * Cache AI assessment for 24 hours
   */
  private async cacheAssessment(appointmentId: string, assessment: AIRiskAssessment) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    try {
      await this.prisma.aIRiskCache.upsert({
        where: { appointmentId },
        update: {
          aiScore: assessment.adjustedScore,
          confidence: assessment.confidence,
          reasoning: assessment.reasoning,
          recommendations: JSON.stringify(assessment.recommendations),
          riskFactors: JSON.stringify(assessment.riskFactors),
          optimalContactTime: assessment.optimalContactTime,
          calculatedAt: new Date(),
          expiresAt
        },
        create: {
          appointmentId,
          aiScore: assessment.adjustedScore,
          confidence: assessment.confidence,
          reasoning: assessment.reasoning,
          recommendations: JSON.stringify(assessment.recommendations),
          riskFactors: JSON.stringify(assessment.riskFactors),
          optimalContactTime: assessment.optimalContactTime,
          expiresAt
        }
      });
    } catch (error) {
      console.error('[AI Risk] Failed to cache assessment:', error);
    }
  }

  /**
   * Update appointment with AI assessment data
   */
  private async updateAppointmentWithAI(appointmentId: string, assessment: AIRiskAssessment) {
    try {
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          aiRiskScore: assessment.adjustedScore,
          aiConfidence: assessment.confidence,
          aiReasoning: assessment.reasoning,
          aiRecommendations: JSON.stringify(assessment.recommendations)
        }
      });
    } catch (error) {
      console.error('[AI Risk] Failed to update appointment:', error);
    }
  }

  /**
   * Invalidate cache when new SMS received
   */
  async invalidateCache(appointmentId: string) {
    try {
      await this.prisma.aIRiskCache.delete({
        where: { appointmentId }
      });
    } catch {
      // Ignore if not exists
    }
  }

  /**
   * Check if AI scoring is available
   */
  isAIAvailable(): boolean {
    // Re-check isEnabled from env in case it changed
    this.isEnabled = process.env.AI_RISK_SCORING_ENABLED === 'true';
    return this.isEnabled && this.getClient() !== null;
  }
}

// Singleton instance
let aiRiskScoreService: AIRiskScoreService | null = null;

export function getAIRiskScoreService(prisma: PrismaClient): AIRiskScoreService {
  if (!aiRiskScoreService) {
    aiRiskScoreService = new AIRiskScoreService(prisma);
  }
  return aiRiskScoreService;
}
