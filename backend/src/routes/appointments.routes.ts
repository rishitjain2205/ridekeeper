import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED'
} as const;

import { RiskScoreService } from '../services/riskScore.service.js';
import { getAIRiskScoreService } from '../services/aiRiskScore.service.js';
import { TwilioService } from '../services/twilio.service.js';
import { Server as SocketIOServer } from 'socket.io';

export function createAppointmentRoutes(prisma: PrismaClient, io: SocketIOServer): Router {
  const router = Router();
  const riskScoreService = new RiskScoreService(prisma);
  const aiRiskScoreService = getAIRiskScoreService(prisma);
  const twilioService = new TwilioService(prisma);

  // GET /api/appointments/upcoming - Next 7 days with patient/clinic info
  router.get('/upcoming', async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { riskFilter, status } = req.query;

      const whereClause: Record<string, unknown> = {
        appointmentDate: {
          gte: now,
          lte: sevenDaysFromNow
        }
      };

      if (riskFilter === 'high') {
        whereClause.riskScore = { gte: 61 };
      } else if (riskFilter === 'medium') {
        whereClause.riskScore = { gte: 31, lte: 60 };
      } else if (riskFilter === 'low') {
        whereClause.riskScore = { lte: 30 };
      }

      if (status) {
        whereClause.status = status as string;
      }

      const appointments = await prisma.appointment.findMany({
        where: whereClause,
        include: {
          patient: {
            include: {
              caseWorkers: true
            }
          },
          clinic: true,
          ride: true,
          smsMessages: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        },
        orderBy: { appointmentDate: 'asc' }
      });

      res.json({
        success: true,
        data: appointments,
        meta: {
          aiScoringAvailable: aiRiskScoreService.isAIAvailable()
        }
      });
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch appointments'
        }
      });
    }
  });

  // GET /api/appointments/today - Today's appointments
  router.get('/today', async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const appointments = await prisma.appointment.findMany({
        where: {
          appointmentDate: {
            gte: today,
            lte: endOfToday
          }
        },
        include: {
          patient: true,
          clinic: true,
          ride: true
        },
        orderBy: { appointmentDate: 'asc' }
      });

      res.json({
        success: true,
        data: appointments
      });
    } catch (error) {
      console.error('Error fetching today\'s appointments:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch today\'s appointments'
        }
      });
    }
  });

  // GET /api/appointments/:id - Single appointment full details
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { includeAI } = req.query;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          patient: {
            include: {
              caseWorkers: true
            }
          },
          clinic: true,
          ride: true,
          smsMessages: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Appointment not found'
          }
        });
      }

      // Get risk score breakdown - use AI if requested
      let riskResult;
      if (includeAI === 'true' && aiRiskScoreService.isAIAvailable()) {
        riskResult = await aiRiskScoreService.calculateAIEnhancedRiskScore(
          appointment.patient,
          appointment
        );
      } else {
        const baseResult = await riskScoreService.calculateRiskScore(
          appointment.patient,
          appointment
        );
        riskResult = {
          ...baseResult,
          finalScore: baseResult.score,
          isAIEnhanced: false,
          aiAvailable: aiRiskScoreService.isAIAvailable()
        };
      }

      res.json({
        success: true,
        data: {
          ...appointment,
          riskBreakdown: riskResult
        }
      });
    } catch (error) {
      console.error('Error fetching appointment:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch appointment'
        }
      });
    }
  });

  // POST /api/appointments/:id/calculate-risk - Calculate and return risk score
  router.post('/:id/calculate-risk', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { useAI } = req.body;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          patient: true,
          smsMessages: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Appointment not found'
          }
        });
      }

      let riskResult;
      if (useAI !== false && aiRiskScoreService.isAIAvailable()) {
        // Use AI-enhanced scoring
        riskResult = await aiRiskScoreService.calculateAIEnhancedRiskScore(
          appointment.patient,
          appointment
        );

        // Update appointment with both scores
        await prisma.appointment.update({
          where: { id },
          data: {
            riskScore: riskResult.score, // Base rule score
            aiRiskScore: riskResult.finalScore,
            aiConfidence: riskResult.aiAssessment?.confidence,
            aiReasoning: riskResult.aiAssessment?.reasoning,
            aiRecommendations: riskResult.aiAssessment?.recommendations
              ? JSON.stringify(riskResult.aiAssessment.recommendations)
              : null,
            needsRide: riskResult.finalScore >= 61
          }
        });
      } else {
        // Use rule-based scoring only
        const baseResult = await riskScoreService.calculateRiskScore(
          appointment.patient,
          appointment
        );
        riskResult = {
          ...baseResult,
          finalScore: baseResult.score,
          isAIEnhanced: false,
          aiAvailable: aiRiskScoreService.isAIAvailable()
        };

        await prisma.appointment.update({
          where: { id },
          data: {
            riskScore: riskResult.score,
            needsRide: riskResult.category === 'HIGH'
          }
        });
      }

      io.emit('RISK_SCORE_CALCULATED', {
        appointmentId: id,
        ...riskResult
      });

      res.json({
        success: true,
        data: riskResult
      });
    } catch (error) {
      console.error('Error calculating risk score:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: 'Failed to calculate risk score'
        }
      });
    }
  });

  // POST /api/appointments/:id/calculate-ai-risk - Calculate AI-enhanced risk (async)
  router.post('/:id/calculate-ai-risk', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!aiRiskScoreService.isAIAvailable()) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'AI_UNAVAILABLE',
            message: 'AI risk scoring is not available'
          }
        });
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          patient: true,
          smsMessages: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Appointment not found'
          }
        });
      }

      // Calculate AI-enhanced risk
      const riskResult = await aiRiskScoreService.calculateAIEnhancedRiskScore(
        appointment.patient,
        appointment
      );

      // Update appointment
      await prisma.appointment.update({
        where: { id },
        data: {
          riskScore: riskResult.score,
          aiRiskScore: riskResult.finalScore,
          aiConfidence: riskResult.aiAssessment?.confidence,
          aiReasoning: riskResult.aiAssessment?.reasoning,
          aiRecommendations: riskResult.aiAssessment?.recommendations
            ? JSON.stringify(riskResult.aiAssessment.recommendations)
            : null,
          needsRide: riskResult.finalScore >= 61
        }
      });

      io.emit('AI_RISK_CALCULATED', {
        appointmentId: id,
        ...riskResult
      });

      res.json({
        success: true,
        data: riskResult
      });
    } catch (error) {
      console.error('Error calculating AI risk score:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AI_CALCULATION_ERROR',
          message: 'Failed to calculate AI risk score'
        }
      });
    }
  });

  // POST /api/appointments/:id/offer-ride - Send SMS to patient or caseworker
  router.post('/:id/offer-ride', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          patient: {
            include: {
              caseWorkers: true
            }
          },
          clinic: true
        }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Appointment not found'
          }
        });
      }

      const patient = appointment.patient;
      let targetPhone = patient.phoneNumber;
      let viaCaseworker = false;

      // If patient has no phone, use caseworker
      if (!targetPhone && patient.caseWorkers.length > 0) {
        targetPhone = patient.caseWorkers[0].phoneNumber;
        viaCaseworker = true;
      }

      if (!targetPhone) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_PHONE',
            message: 'No phone number available for patient or caseworker',
            action: 'add_contact'
          }
        });
      }

      const result = await twilioService.sendRideOffer(
        { ...appointment, clinic: { name: appointment.clinic.name, address: appointment.clinic.address } },
        viaCaseworker ? targetPhone : undefined
      );

      if (result.success) {
        await prisma.appointment.update({
          where: { id },
          data: { rideOfferSent: true }
        });

        // Invalidate AI cache since new communication happened
        await aiRiskScoreService.invalidateCache(id);

        io.emit('RIDE_OFFER_SENT', {
          appointmentId: id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          phoneNumber: targetPhone,
          viaCaseworker
        });

        // In test/demo mode, auto-simulate patient reply "YES" after 3 seconds
        const isTestMode = process.env.TWILIO_TEST_MODE === 'true';
        if (isTestMode) {
          setTimeout(async () => {
            try {
              // Record incoming "YES" message
              await prisma.sMSMessage.create({
                data: {
                  appointmentId: id,
                  phoneNumber: targetPhone || '',
                  message: 'YES',
                  direction: 'INBOUND',
                  status: 'RECEIVED',
                  twilioSid: `DEMO_${Date.now()}`
                }
              });

              // Emit SMS received event
              io.emit('SMS_RECEIVED', {
                appointmentId: id,
                from: targetPhone,
                body: 'YES',
                parsedIntent: 'CONFIRM_RIDE',
                confidence: 0.99,
                patientName: `${patient.firstName} ${patient.lastName}`,
                simulated: true
              });

              // Auto-book the ride after another 2 seconds
              setTimeout(async () => {
                try {
                  const pickupTime = new Date(appointment.appointmentDate);
                  pickupTime.setMinutes(pickupTime.getMinutes() - 45);

                  const pickupLocation = patient.address || 'Patient location';

                  const ride = await prisma.ride.create({
                    data: {
                      appointmentId: id,
                      pickupLocation,
                      dropoffLocation: appointment.clinic.address,
                      pickupTime,
                      status: 'SCHEDULED',
                      uberRideId: `DEMO_UBER_${Date.now()}`,
                      estimatedCost: 12.50 + Math.random() * 10,
                      driverName: 'Demo Driver',
                      vehicleInfo: 'White Toyota Camry'
                    }
                  });

                  await prisma.appointment.update({
                    where: { id },
                    data: { status: 'CONFIRMED' }
                  });

                  // Send confirmation message
                  const formattedTime = pickupTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });

                  await prisma.sMSMessage.create({
                    data: {
                      appointmentId: id,
                      phoneNumber: targetPhone || '',
                      message: `Great! Your ride is confirmed for ${formattedTime}. Pickup: ${pickupLocation}. We'll text you when your driver is nearby. See you tomorrow!`,
                      direction: 'OUTBOUND',
                      status: 'DELIVERED',
                      twilioSid: `DEMO_${Date.now()}`
                    }
                  });

                  io.emit('RIDE_BOOKED', {
                    rideId: ride.id,
                    appointmentId: id,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    pickupTime: pickupTime.toISOString(),
                    estimatedCost: ride.estimatedCost
                  });

                  io.emit('APPOINTMENT_UPDATE', {
                    appointmentId: id,
                    status: 'CONFIRMED'
                  });

                  console.log(`[DEMO] Auto-booked ride for ${patient.firstName} ${patient.lastName}`);
                } catch (err) {
                  console.error('[DEMO] Error auto-booking ride:', err);
                }
              }, 2000);
            } catch (err) {
              console.error('[DEMO] Error simulating reply:', err);
            }
          }, 3000);
        }
      }

      res.json({
        success: result.success,
        data: {
          twilioSid: result.twilioSid,
          sentTo: targetPhone,
          viaCaseworker
        },
        error: result.error ? {
          code: 'SMS_FAILED',
          message: result.error
        } : undefined
      });
    } catch (error) {
      console.error('Error sending ride offer:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: 'Failed to send ride offer'
        }
      });
    }
  });

  // POST /api/appointments/:id/manual-confirm - Coordinator override to confirm
  router.post('/:id/manual-confirm', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.CONFIRMED,
          needsRide: true
        },
        include: {
          patient: true,
          clinic: true
        }
      });

      io.emit('APPOINTMENT_UPDATE', {
        appointmentId: id,
        status: AppointmentStatus.CONFIRMED
      });

      res.json({
        success: true,
        data: appointment
      });
    } catch (error) {
      console.error('Error confirming appointment:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to confirm appointment'
        }
      });
    }
  });

  // POST /api/appointments/:id/mark-completed - Mark appointment as completed
  router.post('/:id/mark-completed', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.COMPLETED },
        include: { patient: true, ride: true }
      });

      io.emit('APPOINTMENT_UPDATE', {
        appointmentId: id,
        status: AppointmentStatus.COMPLETED
      });

      res.json({
        success: true,
        data: appointment
      });
    } catch (error) {
      console.error('Error completing appointment:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to complete appointment'
        }
      });
    }
  });

  // POST /api/appointments/:id/mark-noshow - Mark appointment as no-show
  router.post('/:id/mark-noshow', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.NO_SHOW },
        include: { patient: true }
      });

      // Record in no-show history
      await prisma.noShowHistory.create({
        data: {
          patientId: appointment.patientId,
          appointmentId: id
        }
      });

      io.emit('APPOINTMENT_UPDATE', {
        appointmentId: id,
        status: AppointmentStatus.NO_SHOW
      });

      res.json({
        success: true,
        data: appointment
      });
    } catch (error) {
      console.error('Error marking no-show:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to mark as no-show'
        }
      });
    }
  });

  // GET /api/appointments/:id/ai-status - Check AI scoring status
  router.get('/:id/ai-status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        select: {
          aiRiskScore: true,
          aiConfidence: true,
          aiReasoning: true,
          aiRecommendations: true,
          riskScore: true
        }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Appointment not found' }
        });
      }

      res.json({
        success: true,
        data: {
          hasAIScore: appointment.aiRiskScore !== null,
          aiScore: appointment.aiRiskScore,
          baseScore: appointment.riskScore,
          confidence: appointment.aiConfidence,
          reasoning: appointment.aiReasoning,
          recommendations: appointment.aiRecommendations
            ? JSON.parse(appointment.aiRecommendations)
            : [],
          aiAvailable: aiRiskScoreService.isAIAvailable()
        }
      });
    } catch (error) {
      console.error('Error getting AI status:', error);
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: 'Failed to get AI status' }
      });
    }
  });

  return router;
}
