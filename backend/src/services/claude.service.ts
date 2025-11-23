import Anthropic from '@anthropic-ai/sdk';

export enum PatientIntent {
  CONFIRM_RIDE = 'CONFIRM_RIDE',
  DECLINE_RIDE = 'DECLINE_RIDE',
  RESCHEDULE = 'RESCHEDULE',
  QUESTION = 'QUESTION',
  UNKNOWN = 'UNKNOWN'
}

export interface ParsedPatientResponse {
  intent: PatientIntent;
  confidence: number;
  alternativePickupLocation?: string;
  preferredTime?: string;
  rawMessage: string;
  reasoning?: string;
}

export class ClaudeService {
  private client: Anthropic | null = null;
  private isTestMode: boolean;

  constructor() {
    this.isTestMode = !process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_TEST_MODE === 'true';

    if (!this.isTestMode) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
  }

  /**
   * Parse patient SMS response using Claude AI
   * Falls back to rule-based parsing if API unavailable
   */
  async parsePatientResponse(
    message: string,
    context?: { patientName?: string; appointmentDate?: string; clinicName?: string }
  ): Promise<ParsedPatientResponse> {
    // First try rule-based parsing for obvious cases
    const ruleBasedResult = this.ruleBasedParsing(message);
    if (ruleBasedResult.confidence >= 0.9) {
      return ruleBasedResult;
    }

    // If API is available, use Claude for ambiguous cases
    if (!this.isTestMode && this.client) {
      try {
        return await this.parseWithClaude(message, context);
      } catch (error) {
        console.error('Claude API error, falling back to rule-based:', error);
        return ruleBasedResult;
      }
    }

    return ruleBasedResult;
  }

  private async parseWithClaude(
    message: string,
    context?: { patientName?: string; appointmentDate?: string; clinicName?: string }
  ): Promise<ParsedPatientResponse> {
    const systemPrompt = `You are an AI assistant helping parse SMS responses from patients about ride offers for medical appointments.
Your job is to determine the patient's intent from their message.

Possible intents:
- CONFIRM_RIDE: Patient wants the ride (yes, ok, sure, sounds good, etc.)
- DECLINE_RIDE: Patient doesn't want/need the ride (no, I have a ride, my friend is taking me, etc.)
- RESCHEDULE: Patient wants to change the appointment or pickup time
- QUESTION: Patient is asking a question about the ride or appointment
- UNKNOWN: Cannot determine intent

Also extract:
- alternativePickupLocation: If they mention picking up somewhere different
- preferredTime: If they mention a specific preferred pickup time

Respond in JSON format only:
{
  "intent": "CONFIRM_RIDE|DECLINE_RIDE|RESCHEDULE|QUESTION|UNKNOWN",
  "confidence": 0.0-1.0,
  "alternativePickupLocation": "string or null",
  "preferredTime": "string or null",
  "reasoning": "brief explanation"
}`;

    const userMessage = context
      ? `Context: Patient ${context.patientName} has appointment at ${context.clinicName} on ${context.appointmentDate}.

Patient's SMS response: "${message}"

Parse this response:`
      : `Patient's SMS response: "${message}"

Parse this response:`;

    const response = await this.client!.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return this.ruleBasedParsing(message);
    }

    try {
      const parsed = JSON.parse(content.text);
      return {
        intent: parsed.intent as PatientIntent,
        confidence: parsed.confidence,
        alternativePickupLocation: parsed.alternativePickupLocation || undefined,
        preferredTime: parsed.preferredTime || undefined,
        rawMessage: message,
        reasoning: parsed.reasoning
      };
    } catch {
      return this.ruleBasedParsing(message);
    }
  }

  /**
   * Rule-based parsing for common responses
   * Used as fallback and for high-confidence obvious cases
   */
  private ruleBasedParsing(message: string): ParsedPatientResponse {
    const normalized = message.toLowerCase().trim();

    // Remove punctuation and extra spaces
    const cleaned = normalized.replace(/[!?.]+/g, '').replace(/\s+/g, ' ');

    // Check for confirmation patterns
    const confirmPatterns = [
      /^yes$/,
      /^yeah$/,
      /^yep$/,
      /^yup$/,
      /^ok$/,
      /^okay$/,
      /^sure$/,
      /^sounds good$/,
      /^please$/,
      /^yes please$/,
      /^y$/,
      /^👍$/,
      /^i need a ride$/,
      /^i want a ride$/,
      /^book it$/,
      /^lets do it$/,
      /^definitely$/,
      /^absolutely$/
    ];

    for (const pattern of confirmPatterns) {
      if (pattern.test(cleaned)) {
        return {
          intent: PatientIntent.CONFIRM_RIDE,
          confidence: 0.95,
          rawMessage: message
        };
      }
    }

    // Check for decline patterns
    const declinePatterns = [
      /^no$/,
      /^nope$/,
      /^nah$/,
      /^n$/,
      /^no thanks$/,
      /^no thank you$/,
      /^i have a ride$/,
      /^got a ride$/,
      /^don'?t need/,
      /^i'?m good$/,
      /^i'?m ok$/,
      /^my (friend|family|wife|husband|son|daughter|mom|dad|brother|sister) (is|will) (take|taking|drive|driving|pick)/,
      /^someone (is|will) (take|taking|drive|driving|pick)/,
      /^i (can|will) (get|take|drive) (there|myself)$/,
      /^cancel$/,
      /^👎$/
    ];

    for (const pattern of declinePatterns) {
      if (pattern.test(cleaned)) {
        return {
          intent: PatientIntent.DECLINE_RIDE,
          confidence: 0.95,
          rawMessage: message
        };
      }
    }

    // Check for reschedule patterns
    const reschedulePatterns = [
      /reschedule/,
      /change (the )?(time|date|appointment)/,
      /different (time|day|date)/,
      /can'?t make it/,
      /move (the )?(appointment|time)/,
      /not (that|this) (time|day|date)/
    ];

    for (const pattern of reschedulePatterns) {
      if (pattern.test(cleaned)) {
        return {
          intent: PatientIntent.RESCHEDULE,
          confidence: 0.8,
          rawMessage: message
        };
      }
    }

    // Check for question patterns
    const questionPatterns = [
      /\?$/,
      /^(what|when|where|who|how|why|which|is|are|can|will|do|does)/,
      /^(tell me|let me know)/
    ];

    for (const pattern of questionPatterns) {
      if (pattern.test(normalized)) {
        return {
          intent: PatientIntent.QUESTION,
          confidence: 0.7,
          rawMessage: message
        };
      }
    }

    // Check for alternative pickup location
    const locationMatch = message.match(/pick(?: me)? up (?:at|from) (.+)/i);
    if (locationMatch) {
      // They're providing an alternative location, which implies confirmation
      return {
        intent: PatientIntent.CONFIRM_RIDE,
        confidence: 0.85,
        alternativePickupLocation: locationMatch[1].trim(),
        rawMessage: message
      };
    }

    // Check for preferred time
    const timeMatch = message.match(/(?:at|around|by) (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      return {
        intent: PatientIntent.CONFIRM_RIDE,
        confidence: 0.7,
        preferredTime: timeMatch[1].trim(),
        rawMessage: message
      };
    }

    // Default to unknown
    return {
      intent: PatientIntent.UNKNOWN,
      confidence: 0.3,
      rawMessage: message
    };
  }

  /**
   * Generate a contextual response to patient questions
   */
  async generateResponse(
    patientMessage: string,
    context: {
      appointmentDate: string;
      clinicName: string;
      pickupLocation?: string;
      pickupTime?: string;
    }
  ): Promise<string> {
    if (this.isTestMode || !this.client) {
      // Fallback responses for common questions
      const normalized = patientMessage.toLowerCase();

      if (normalized.includes('time') || normalized.includes('when')) {
        return context.pickupTime
          ? `Your ride is scheduled for pickup at ${context.pickupTime}.`
          : `We'll pick you up in time for your appointment at ${context.appointmentDate}.`;
      }

      if (normalized.includes('where') || normalized.includes('location') || normalized.includes('address')) {
        return context.pickupLocation
          ? `Your pickup location is ${context.pickupLocation}.`
          : 'Please let us know your preferred pickup location.';
      }

      if (normalized.includes('cost') || normalized.includes('pay') || normalized.includes('free')) {
        return 'The ride is completely free - no cost to you!';
      }

      return 'I\'ll have a coordinator reach out to help you. Reply YES if you still need a ride.';
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        system: `You are a helpful healthcare transportation coordinator. Keep responses brief, warm, and SMS-friendly (under 160 characters if possible).
Context: Patient has an appointment at ${context.clinicName} on ${context.appointmentDate}.
${context.pickupLocation ? `Pickup location: ${context.pickupLocation}` : ''}
${context.pickupTime ? `Pickup time: ${context.pickupTime}` : ''}`,
        messages: [{ role: 'user', content: patientMessage }]
      });

      const content = response.content[0];
      return content.type === 'text' ? content.text : 'I\'ll have a coordinator reach out to help you.';
    } catch (error) {
      console.error('Claude response generation error:', error);
      return 'I\'ll have a coordinator reach out to help you. Reply YES if you still need a ride.';
    }
  }
}

// Singleton instance
export const claudeService = new ClaudeService();
