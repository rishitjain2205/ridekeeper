import { PrismaClient, Patient, Appointment } from '@prisma/client';

// Housing status constants
const HousingStatus = {
  HOMELESS: 'HOMELESS',
  UNSTABLY_HOUSED: 'UNSTABLY_HOUSED',
  HOUSED: 'HOUSED'
} as const;

export enum RiskCategory {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface RiskFactor {
  factor: string;
  points: number;
  reason: string;
}

export interface RiskScoreResult {
  score: number;
  category: RiskCategory;
  factors: RiskFactor[];
}

export class RiskScoreService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculateRiskScore(
    patient: Patient,
    appointment: Appointment
  ): Promise<RiskScoreResult> {
    const factors: RiskFactor[] = [];
    let totalScore = 0;

    // Housing Status scoring
    const housingPoints = this.getHousingPoints(patient.housingStatus);
    if (housingPoints > 0) {
      factors.push({
        factor: 'Housing Status',
        points: housingPoints,
        reason: this.getHousingReason(patient.housingStatus)
      });
      totalScore += housingPoints;
    }

    // Distance from clinic scoring
    const distancePoints = this.getDistancePoints(patient.distanceFromClinic);
    if (distancePoints > 0) {
      factors.push({
        factor: 'Distance from Clinic',
        points: distancePoints,
        reason: `Patient is ${patient.distanceFromClinic?.toFixed(1) || 'unknown'} miles from clinic`
      });
      totalScore += distancePoints;
    }

    // Phone access scoring
    const phonePoints = this.getPhonePoints(patient.phoneNumber);
    if (phonePoints > 0) {
      factors.push({
        factor: 'Phone Access',
        points: phonePoints,
        reason: 'No phone number on file - coordination through caseworker required'
      });
      totalScore += phonePoints;
    }

    // Previous no-shows scoring (last 6 months)
    const noShowCount = await this.getNoShowCount(patient.id);
    const noShowPoints = this.getNoShowPoints(noShowCount);
    if (noShowPoints > 0) {
      factors.push({
        factor: 'Previous No-Shows',
        points: noShowPoints,
        reason: `${noShowCount} no-show(s) in the last 6 months`
      });
      totalScore += noShowPoints;
    }

    // Cap total score at 100
    totalScore = Math.min(totalScore, 100);

    // Determine risk category
    const category = this.getRiskCategory(totalScore);

    return {
      score: totalScore,
      category,
      factors
    };
  }

  private getHousingPoints(housingStatus: string): number {
    switch (housingStatus) {
      case HousingStatus.HOMELESS:
        return 40;
      case HousingStatus.UNSTABLY_HOUSED:
        return 25;
      case HousingStatus.HOUSED:
        return 0;
      default:
        return 0;
    }
  }

  private getHousingReason(housingStatus: string): string {
    switch (housingStatus) {
      case HousingStatus.HOMELESS:
        return 'Patient is currently homeless - high transportation barrier';
      case HousingStatus.UNSTABLY_HOUSED:
        return 'Patient has unstable housing - moderate transportation barrier';
      case HousingStatus.HOUSED:
        return 'Patient has stable housing';
      default:
        return 'Unknown housing status';
    }
  }

  private getDistancePoints(distanceFromClinic: number | null): number {
    if (distanceFromClinic === null) {
      return 20; // Assume medium risk if distance unknown
    }
    if (distanceFromClinic > 5) {
      return 30;
    }
    if (distanceFromClinic >= 2) {
      return 20;
    }
    return 10;
  }

  private getPhonePoints(phoneNumber: string | null): number {
    return phoneNumber ? 0 : 25;
  }

  private async getNoShowCount(patientId: string): Promise<number> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const count = await this.prisma.noShowHistory.count({
      where: {
        patientId,
        occurredAt: {
          gte: sixMonthsAgo
        }
      }
    });

    return count;
  }

  private getNoShowPoints(noShowCount: number): number {
    // 15 points per no-show, capped at 60
    return Math.min(noShowCount * 15, 60);
  }

  private getRiskCategory(score: number): RiskCategory {
    if (score <= 30) {
      return RiskCategory.LOW;
    }
    if (score <= 60) {
      return RiskCategory.MEDIUM;
    }
    return RiskCategory.HIGH;
  }

  // Batch calculate risk scores for multiple appointments
  async calculateBatchRiskScores(
    appointments: (Appointment & { patient: Patient })[]
  ): Promise<Map<string, RiskScoreResult>> {
    const results = new Map<string, RiskScoreResult>();

    for (const appointment of appointments) {
      const result = await this.calculateRiskScore(appointment.patient, appointment);
      results.set(appointment.id, result);
    }

    return results;
  }
}
