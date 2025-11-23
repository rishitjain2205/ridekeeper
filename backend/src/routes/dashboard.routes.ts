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
import { Server as SocketIOServer } from 'socket.io';

export function createDashboardRoutes(prisma: PrismaClient, io: SocketIOServer): Router {
  const router = Router();

  // GET /api/dashboard/stats - Summary stats for dashboard
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      // Count upcoming appointments (next 7 days)
      const upcomingAppointments = await prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: now,
            lte: sevenDaysFromNow
          },
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]
          }
        }
      });

      // Count high-risk patients (score >= 61)
      const highRiskPatients = await prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: now,
            lte: sevenDaysFromNow
          },
          riskScore: { gte: 61 },
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]
          }
        }
      });

      // Count rides scheduled for today
      const ridesScheduledToday = await prisma.ride.count({
        where: {
          pickupTime: {
            gte: today,
            lte: endOfToday
          },
          status: {
            not: RideStatus.CANCELLED
          }
        }
      });

      // Calculate no-show rate (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const totalPastAppointments = await prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: thirtyDaysAgo,
            lt: today
          },
          status: {
            in: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW]
          }
        }
      });

      const noShowCount = await prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: thirtyDaysAgo,
            lt: today
          },
          status: AppointmentStatus.NO_SHOW
        }
      });

      const noShowRate = totalPastAppointments > 0
        ? Math.round((noShowCount / totalPastAppointments) * 100)
        : 0;

      // Calculate no-show trend (compare last 30 days vs previous 30 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const previousPeriodNoShows = await prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          },
          status: AppointmentStatus.NO_SHOW
        }
      });

      const previousPeriodTotal = await prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          },
          status: {
            in: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW]
          }
        }
      });

      const previousNoShowRate = previousPeriodTotal > 0
        ? (previousPeriodNoShows / previousPeriodTotal) * 100
        : 0;

      const noShowTrend = noShowRate - previousNoShowRate;

      res.json({
        success: true,
        data: {
          upcomingAppointments,
          highRiskPatients,
          ridesScheduledToday,
          noShowRate,
          noShowTrend: Math.round(noShowTrend * 10) / 10
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch dashboard stats'
        }
      });
    }
  });

  // GET /api/dashboard/rides-summary - Rides summary by status
  router.get('/rides-summary', async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const ridesByStatus = await prisma.ride.groupBy({
        by: ['status'],
        where: {
          pickupTime: {
            gte: today,
            lte: endOfToday
          }
        },
        _count: { id: true }
      });

      const summary = {
        scheduled: 0,
        driverAssigned: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0
      };

      ridesByStatus.forEach(({ status, _count }) => {
        switch (status) {
          case RideStatus.SCHEDULED:
            summary.scheduled = _count.id;
            break;
          case RideStatus.DRIVER_ASSIGNED:
            summary.driverAssigned = _count.id;
            break;
          case RideStatus.IN_PROGRESS:
            summary.inProgress = _count.id;
            break;
          case RideStatus.COMPLETED:
            summary.completed = _count.id;
            break;
          case RideStatus.CANCELLED:
            summary.cancelled = _count.id;
            break;
        }
      });

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error fetching rides summary:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch rides summary'
        }
      });
    }
  });

  // GET /api/dashboard/roi - ROI calculation
  router.get('/roi', async (_req: Request, res: Response) => {
    try {
      // Get completed rides with Uber Health
      const completedRides = await prisma.ride.count({
        where: {
          status: RideStatus.COMPLETED
        }
      });

      // Get appointments that were completed after using ride service
      const appointmentsWithRides = await prisma.appointment.count({
        where: {
          status: AppointmentStatus.COMPLETED,
          ride: {
            status: RideStatus.COMPLETED
          }
        }
      });

      // Average cost per ride (from our data)
      const ridesWithCost = await prisma.ride.findMany({
        where: {
          status: RideStatus.COMPLETED,
          estimatedCost: { not: null }
        },
        select: { estimatedCost: true }
      });

      const totalRideCost = ridesWithCost.reduce((sum, ride) => sum + (ride.estimatedCost || 0), 0);
      const avgRideCost = ridesWithCost.length > 0 ? totalRideCost / ridesWithCost.length : 18;

      // Estimated savings per attended appointment
      // Industry data: missed appointments cost $150+ each
      const costPerMissedAppointment = 150;

      // Calculate ROI
      const transportationCost = totalRideCost;
      const preventedNoShowValue = appointmentsWithRides * costPerMissedAppointment;
      const netSavings = preventedNoShowValue - transportationCost;
      const roi = transportationCost > 0 ? (preventedNoShowValue / transportationCost) : 0;

      res.json({
        success: true,
        data: {
          completedRides,
          appointmentsAttended: appointmentsWithRides,
          totalRideCost: Math.round(totalRideCost),
          avgRideCost: Math.round(avgRideCost),
          preventedNoShowValue: Math.round(preventedNoShowValue),
          netSavings: Math.round(netSavings),
          roi: Math.round(roi * 10) / 10 // e.g., 8.3 means $8.30 saved per $1 spent
        }
      });
    } catch (error) {
      console.error('Error calculating ROI:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: 'Failed to calculate ROI'
        }
      });
    }
  });

  // POST /api/dashboard/demo/reset - Reset demo data
  router.post('/demo/reset', async (_req: Request, res: Response) => {
    try {
      // Clear all mock Uber rides
      uberHealthService.clearAllRides();

      // Reset appointment statuses
      await prisma.appointment.updateMany({
        data: {
          status: AppointmentStatus.SCHEDULED,
          rideOfferSent: false
        }
      });

      // Delete all rides
      await prisma.ride.deleteMany({});

      // Delete all SMS messages
      await prisma.sMSMessage.deleteMany({});

      io.emit('DEMO_RESET', { timestamp: new Date() });

      res.json({
        success: true,
        data: { message: 'Demo reset complete' }
      });
    } catch (error) {
      console.error('Error resetting demo:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RESET_ERROR',
          message: 'Failed to reset demo'
        }
      });
    }
  });

  // POST /api/dashboard/demo/fast-forward - Fast forward to specific state
  router.post('/demo/fast-forward', async (req: Request, res: Response) => {
    try {
      const { appointmentId, targetState } = req.body;

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
        include: { ride: true }
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

      let result: Record<string, unknown> = {};

      switch (targetState) {
        case 'pickup':
          // Fast forward to driver arriving
          if (appointment.ride?.uberRideId) {
            await uberHealthService.forceStatusUpdate(appointment.ride.uberRideId, 'arrived');
            await prisma.ride.update({
              where: { id: appointment.ride.id },
              data: { status: RideStatus.DRIVER_ASSIGNED }
            });
            result = { rideStatus: 'arrived' };
          }
          break;

        case 'in_progress':
          // Fast forward to ride in progress
          if (appointment.ride?.uberRideId) {
            await uberHealthService.forceStatusUpdate(appointment.ride.uberRideId, 'in_progress');
            await prisma.ride.update({
              where: { id: appointment.ride.id },
              data: { status: RideStatus.IN_PROGRESS }
            });
            result = { rideStatus: 'in_progress' };
          }
          break;

        case 'completed':
          // Fast forward to appointment completed
          if (appointment.ride) {
            await uberHealthService.forceStatusUpdate(appointment.ride.uberRideId!, 'completed');
            await prisma.ride.update({
              where: { id: appointment.ride.id },
              data: { status: RideStatus.COMPLETED }
            });
          }
          await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: AppointmentStatus.COMPLETED }
          });
          result = { appointmentStatus: 'completed', rideStatus: 'completed' };

          io.emit('APPOINTMENT_COMPLETED', {
            appointmentId,
            patientName: `Patient ${appointmentId}`
          });
          break;
      }

      io.emit('DEMO_FAST_FORWARD', {
        appointmentId,
        targetState,
        result
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fast forwarding:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FAST_FORWARD_ERROR',
          message: 'Failed to fast forward demo'
        }
      });
    }
  });

  return router;
}
