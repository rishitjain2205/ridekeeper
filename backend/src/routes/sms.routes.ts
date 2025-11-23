import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED'
} as const;
import { TwilioService } from '../services/twilio.service.js';
import { claudeService, PatientIntent } from '../services/claude.service.js';
import { uberHealthService } from '../services/uberHealth.service.js';
import { Server as SocketIOServer } from 'socket.io';

export function createSMSRoutes(prisma: PrismaClient, io: SocketIOServer): Router {
  const router = Router();
  const twilioService = new TwilioService(prisma);

  // POST /api/sms/webhook - Twilio webhook for incoming SMS
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const { From, Body, MessageSid } = req.body;

      console.log(`[SMS Webhook] Received from ${From}: ${Body}`);

      // Record the incoming message
      const { appointmentId } = await twilioService.handleIncomingSMS(From, Body, MessageSid);

      if (!appointmentId) {
        console.log('[SMS Webhook] No appointment found for this phone number');
        // Send Twilio TwiML response
        res.type('text/xml');
        return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // Get appointment details for context
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: {
            include: {
              caseWorkers: true
            }
          },
          clinic: true,
          ride: true
        }
      });

      if (!appointment) {
        res.type('text/xml');
        return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // Parse the patient's response using Claude
      const parsedResponse = await claudeService.parsePatientResponse(Body, {
        patientName: appointment.patient.firstName,
        appointmentDate: appointment.appointmentDate.toISOString(),
        clinicName: appointment.clinic.name
      });

      io.emit('SMS_RECEIVED', {
        appointmentId,
        from: From,
        body: Body,
        parsedIntent: parsedResponse.intent,
        confidence: parsedResponse.confidence,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`
      });

      // Handle based on intent
      let responseMessage = '';

      switch (parsedResponse.intent) {
        case PatientIntent.CONFIRM_RIDE:
          // Auto-book the ride
          if (!appointment.ride) {
            const pickupTime = new Date(appointment.appointmentDate);
            pickupTime.setMinutes(pickupTime.getMinutes() - 45); // 45 mins before appointment

            const pickupLocation = parsedResponse.alternativePickupLocation ||
              appointment.patient.address ||
              'Main entrance of your current location';

            const uberResponse = await uberHealthService.bookRide({
              pickupLocation: {
                address: pickupLocation,
                lat: 37.7749,
                lng: -122.4194
              },
              dropoffLocation: {
                address: appointment.clinic.address,
                lat: appointment.clinic.latitude,
                lng: appointment.clinic.longitude
              },
              pickupTime,
              patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
              patientPhone: appointment.patient.phoneNumber || ''
            });

            const ride = await prisma.ride.create({
              data: {
                appointmentId,
                pickupLocation,
                dropoffLocation: appointment.clinic.address,
                pickupTime,
                status: 'SCHEDULED',
                uberRideId: uberResponse.ride_id,
                estimatedCost: uberResponse.estimated_cost
              }
            });

            await prisma.appointment.update({
              where: { id: appointmentId },
              data: { status: AppointmentStatus.CONFIRMED }
            });

            const formattedTime = pickupTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });

            responseMessage = `Great! Your ride is confirmed for ${formattedTime}. Pickup: ${pickupLocation}. We'll text you when your driver is nearby. See you tomorrow!`;

            io.emit('RIDE_BOOKED', {
              rideId: ride.id,
              appointmentId,
              patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
              pickupTime: pickupTime.toISOString(),
              estimatedCost: uberResponse.estimated_cost
            });
          } else {
            responseMessage = 'You already have a ride booked! We\'ll text you when your driver is nearby.';
          }
          break;

        case PatientIntent.DECLINE_RIDE:
          responseMessage = 'No problem! Let us know if you need anything else. See you at your appointment!';
          await prisma.appointment.update({
            where: { id: appointmentId },
            data: { needsRide: false }
          });
          break;

        case PatientIntent.RESCHEDULE:
          responseMessage = 'To reschedule your appointment, please call the clinic directly. Would you still like a ride to your current appointment? Reply YES or NO.';
          break;

        case PatientIntent.QUESTION:
          // Use Claude to generate a contextual response
          responseMessage = await claudeService.generateResponse(Body, {
            appointmentDate: appointment.appointmentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            }) + ' at ' + appointment.appointmentDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }),
            clinicName: appointment.clinic.name,
            pickupLocation: appointment.ride?.pickupLocation,
            pickupTime: appointment.ride?.pickupTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })
          });
          break;

        case PatientIntent.UNKNOWN:
        default:
          responseMessage = 'Sorry, I didn\'t understand that. Reply YES if you need a free ride to your appointment, or NO if you have transportation. Questions? A coordinator will reach out shortly.';
          break;
      }

      // Send response SMS
      if (responseMessage) {
        await twilioService.sendSMS(From, responseMessage, appointmentId);
      }

      // Send Twilio TwiML response (empty - we're sending via API)
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('SMS webhook error:', error);
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  });

  // POST /api/sms/status-webhook - Twilio webhook for message status updates
  router.post('/status-webhook', async (req: Request, res: Response) => {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

      console.log(`[SMS Status Webhook] SID: ${MessageSid}, Status: ${MessageStatus}`);

      // Map Twilio status to our status
      let dbStatus: string;
      switch (MessageStatus) {
        case 'delivered':
          dbStatus = 'DELIVERED';
          break;
        case 'read':
          dbStatus = 'READ';
          break;
        case 'sent':
        case 'queued':
          dbStatus = 'SENT';
          break;
        case 'failed':
        case 'undelivered':
          dbStatus = 'FAILED';
          break;
        default:
          dbStatus = 'SENT';
      }

      // Update the message status in database
      const updatedMessage = await prisma.sMSMessage.updateMany({
        where: { twilioSid: MessageSid },
        data: { status: dbStatus }
      });

      if (updatedMessage.count > 0) {
        // Find the message to get appointmentId for real-time update
        const message = await prisma.sMSMessage.findFirst({
          where: { twilioSid: MessageSid }
        });

        if (message) {
          io.emit('SMS_STATUS_UPDATE', {
            messageId: message.id,
            appointmentId: message.appointmentId,
            twilioSid: MessageSid,
            status: dbStatus
          });
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('SMS status webhook error:', error);
      res.sendStatus(500);
    }
  });

  // GET /api/sms/messages - Get all messages with filters
  router.get('/messages', async (req: Request, res: Response) => {
    try {
      const { appointmentId, phoneNumber, limit = '50' } = req.query;

      const whereClause: Record<string, unknown> = {};
      if (appointmentId) whereClause.appointmentId = appointmentId;
      if (phoneNumber) whereClause.phoneNumber = phoneNumber;

      const messages = await prisma.sMSMessage.findMany({
        where: whereClause,
        include: {
          appointment: {
            include: {
              patient: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch messages'
        }
      });
    }
  });

  // POST /api/sms/send - Send manual SMS (for coordinator use)
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { phoneNumber, message, appointmentId } = req.body;

      if (!phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'phoneNumber and message are required'
          }
        });
      }

      const result = await twilioService.sendSMS(phoneNumber, message, appointmentId);

      res.json({
        success: result.success,
        data: {
          twilioSid: result.twilioSid
        },
        error: result.error ? {
          code: 'SMS_FAILED',
          message: result.error
        } : undefined
      });
    } catch (error) {
      console.error('Error sending SMS:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: 'Failed to send SMS'
        }
      });
    }
  });

  // POST /api/sms/simulate-reply - Simulate patient reply (for demo)
  router.post('/simulate-reply', async (req: Request, res: Response) => {
    try {
      const { appointmentId, message = 'YES' } = req.body;

      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'appointmentId is required'
          }
        });
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: {
            include: {
              caseWorkers: true
            }
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

      const phoneNumber = appointment.patient.phoneNumber || appointment.patient.caseWorkers[0]?.phoneNumber;
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_PHONE',
            message: 'No phone number to simulate from'
          }
        });
      }

      // Simulate the incoming message by calling our own webhook handler
      const webhookReq = {
        body: {
          From: phoneNumber,
          Body: message,
          MessageSid: `SIMULATED_${Date.now()}`
        }
      };

      // Process the simulated message
      await twilioService.handleIncomingSMS(phoneNumber, message, `SIMULATED_${Date.now()}`);

      // Parse and respond
      const parsedResponse = await claudeService.parsePatientResponse(message);

      io.emit('SMS_RECEIVED', {
        appointmentId,
        from: phoneNumber,
        body: message,
        parsedIntent: parsedResponse.intent,
        confidence: parsedResponse.confidence,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        simulated: true
      });

      res.json({
        success: true,
        data: {
          simulatedFrom: phoneNumber,
          message,
          parsedIntent: parsedResponse.intent
        }
      });
    } catch (error) {
      console.error('Error simulating reply:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SIMULATION_ERROR',
          message: 'Failed to simulate reply'
        }
      });
    }
  });

  return router;
}
