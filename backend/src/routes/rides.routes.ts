import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED'
} as const;

const RideStatus = {
  SCHEDULED: 'SCHEDULED',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;
import { uberHealthService } from '../services/uberHealth.service.js';
import { TwilioService } from '../services/twilio.service.js';
import { Server as SocketIOServer } from 'socket.io';

export function createRideRoutes(prisma: PrismaClient, io: SocketIOServer): Router {
  const router = Router();
  const twilioService = new TwilioService(prisma);

  // POST /api/rides/book - Book Uber Health ride (mocked)
  router.post('/book', async (req: Request, res: Response) => {
    try {
      const { appointmentId, pickupLocation, pickupTime } = req.body;

      if (!appointmentId || !pickupLocation || !pickupTime) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'appointmentId, pickupLocation, and pickupTime are required'
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
          },
          clinic: true,
          ride: true
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

      if (appointment.ride) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RIDE_EXISTS',
            message: 'A ride is already booked for this appointment'
          }
        });
      }

      // Book ride through mock Uber Health API
      const uberResponse = await uberHealthService.bookRide({
        pickupLocation: {
          address: pickupLocation,
          lat: 37.7749, // Default SF coordinates for demo
          lng: -122.4194
        },
        dropoffLocation: {
          address: appointment.clinic.address,
          lat: appointment.clinic.latitude,
          lng: appointment.clinic.longitude
        },
        pickupTime: new Date(pickupTime),
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        patientPhone: appointment.patient.phoneNumber || ''
      });

      // Create ride in database
      const ride = await prisma.ride.create({
        data: {
          appointmentId,
          pickupLocation,
          dropoffLocation: appointment.clinic.address,
          pickupTime: new Date(pickupTime),
          status: RideStatus.SCHEDULED,
          uberRideId: uberResponse.ride_id,
          estimatedCost: uberResponse.estimated_cost
        },
        include: {
          appointment: {
            include: {
              patient: {
                include: {
                  caseWorkers: true
                }
              }
            }
          }
        }
      });

      // Update appointment status
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CONFIRMED }
      });

      // Send confirmation SMS
      const patient = appointment.patient;
      const targetPhone = patient.phoneNumber || patient.caseWorkers[0]?.phoneNumber;
      if (targetPhone) {
        await twilioService.sendRideConfirmation(ride, targetPhone);
      }

      io.emit('RIDE_BOOKED', {
        rideId: ride.id,
        appointmentId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        pickupTime,
        estimatedCost: uberResponse.estimated_cost
      });

      res.json({
        success: true,
        data: {
          ride,
          uberResponse
        }
      });
    } catch (error) {
      console.error('Error booking ride:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BOOKING_ERROR',
          message: 'Failed to book ride'
        }
      });
    }
  });

  // GET /api/rides/:id - Get ride details
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const ride = await prisma.ride.findUnique({
        where: { id },
        include: {
          appointment: {
            include: {
              patient: true,
              clinic: true
            }
          }
        }
      });

      if (!ride) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ride not found'
          }
        });
      }

      // Get latest status from Uber
      let uberStatus = null;
      if (ride.uberRideId) {
        uberStatus = await uberHealthService.getRideStatus(ride.uberRideId);
      }

      res.json({
        success: true,
        data: {
          ride,
          uberStatus
        }
      });
    } catch (error) {
      console.error('Error fetching ride:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch ride'
        }
      });
    }
  });

  // POST /api/rides/:id/cancel - Cancel ride
  router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const ride = await prisma.ride.findUnique({
        where: { id }
      });

      if (!ride) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ride not found'
          }
        });
      }

      // Cancel with Uber
      if (ride.uberRideId) {
        const cancelResult = await uberHealthService.cancelRide(ride.uberRideId);
        if (!cancelResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'CANCEL_FAILED',
              message: cancelResult.message
            }
          });
        }
      }

      // Update ride status
      const updatedRide = await prisma.ride.update({
        where: { id },
        data: { status: RideStatus.CANCELLED },
        include: {
          appointment: {
            include: {
              patient: true
            }
          }
        }
      });

      io.emit('RIDE_STATUS_UPDATE', {
        rideId: id,
        oldStatus: ride.status,
        newStatus: RideStatus.CANCELLED
      });

      res.json({
        success: true,
        data: updatedRide
      });
    } catch (error) {
      console.error('Error cancelling ride:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: 'Failed to cancel ride'
        }
      });
    }
  });

  // POST /api/rides/:id/update-status - Force update ride status (for demo)
  router.post('/:id/update-status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const ride = await prisma.ride.findUnique({
        where: { id }
      });

      if (!ride) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ride not found'
          }
        });
      }

      // Force status update in mock Uber API
      let uberStatus = null;
      if (ride.uberRideId) {
        uberStatus = await uberHealthService.forceStatusUpdate(ride.uberRideId, status);
      }

      const updatedRide = await prisma.ride.update({
        where: { id },
        data: {
          status: status as RideStatus,
          driverName: uberStatus?.driver?.name,
          vehicleInfo: uberStatus?.driver ? `${uberStatus.driver.vehicle} (${uberStatus.driver.license})` : null,
          driverLatitude: uberStatus?.current_location?.lat,
          driverLongitude: uberStatus?.current_location?.lng
        }
      });

      io.emit('RIDE_STATUS_UPDATE', {
        rideId: id,
        oldStatus: ride.status,
        newStatus: status,
        driver: uberStatus?.driver,
        currentLocation: uberStatus?.current_location
      });

      res.json({
        success: true,
        data: updatedRide
      });
    } catch (error) {
      console.error('Error updating ride status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update ride status'
        }
      });
    }
  });

  // GET /api/rides/today - Get all rides for today
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const rides = await prisma.ride.findMany({
        where: {
          pickupTime: {
            gte: today,
            lte: endOfToday
          }
        },
        include: {
          appointment: {
            include: {
              patient: true,
              clinic: true
            }
          }
        },
        orderBy: { pickupTime: 'asc' }
      });

      res.json({
        success: true,
        data: rides
      });
    } catch (error) {
      console.error('Error fetching rides:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch rides'
        }
      });
    }
  });

  return router;
}
