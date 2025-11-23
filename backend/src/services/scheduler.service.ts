import cron from 'node-cron';
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
import { RiskScoreService } from './riskScore.service.js';
import { TwilioService } from './twilio.service.js';
import { uberHealthService } from './uberHealth.service.js';
import { Server as SocketIOServer } from 'socket.io';

export class SchedulerService {
  private prisma: PrismaClient;
  private riskScoreService: RiskScoreService;
  private twilioService: TwilioService;
  private io: SocketIOServer | null = null;
  private jobs: cron.ScheduledTask[] = [];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.riskScoreService = new RiskScoreService(prisma);
    this.twilioService = new TwilioService(prisma);
  }

  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  private emit(event: string, data: unknown) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  /**
   * Start all scheduled jobs
   */
  startAllJobs() {
    console.log('Starting scheduler jobs...');

    // Daily at 6 AM: Calculate risk scores for appointments in next 7 days
    const riskScoreJob = cron.schedule('0 6 * * *', async () => {
      console.log('[Scheduler] Running daily risk score calculation...');
      await this.calculateAllRiskScores();
    });
    this.jobs.push(riskScoreJob);

    // Hourly 8 AM-8 PM: Send ride offers to high-risk appointments 24 hours out
    const rideOfferJob = cron.schedule('0 8-20 * * *', async () => {
      console.log('[Scheduler] Checking for ride offers to send...');
      await this.sendRideOffers();
    });
    this.jobs.push(rideOfferJob);

    // Every 30 mins: Send reminders for rides starting in 2 hours
    const reminderJob = cron.schedule('*/30 * * * *', async () => {
      console.log('[Scheduler] Checking for ride reminders to send...');
      await this.sendRideReminders();
    });
    this.jobs.push(reminderJob);

    // Every 5 mins: Update ride statuses from mock Uber API
    const statusUpdateJob = cron.schedule('*/5 * * * *', async () => {
      await this.updateRideStatuses();
    });
    this.jobs.push(statusUpdateJob);

    // End of day (8 PM): Mark unattended appointments as NO_SHOW
    const noShowJob = cron.schedule('0 20 * * *', async () => {
      console.log('[Scheduler] Marking no-shows...');
      await this.markNoShows();
    });
    this.jobs.push(noShowJob);

    console.log('All scheduler jobs started');
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('All scheduler jobs stopped');
  }

  /**
   * Calculate risk scores for all appointments in the next 7 days
   */
  async calculateAllRiskScores() {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: new Date(),
          lte: sevenDaysFromNow
        },
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]
        }
      },
      include: {
        patient: true,
        clinic: true
      }
    });

    console.log(`[Scheduler] Calculating risk scores for ${appointments.length} appointments`);

    for (const appointment of appointments) {
      try {
        const riskResult = await this.riskScoreService.calculateRiskScore(
          appointment.patient,
          appointment
        );

        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            riskScore: riskResult.score,
            needsRide: riskResult.category === 'HIGH'
          }
        });

        this.emit('RISK_SCORE_CALCULATED', {
          appointmentId: appointment.id,
          riskScore: riskResult.score,
          category: riskResult.category,
          factors: riskResult.factors
        });
      } catch (error) {
        console.error(`[Scheduler] Error calculating risk for appointment ${appointment.id}:`, error);
      }
    }

    console.log('[Scheduler] Risk score calculation complete');
  }

  /**
   * Send ride offers to high-risk patients 24 hours before appointment
   */
  async sendRideOffers() {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Find high-risk appointments about 24 hours out that haven't received offers
    const appointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: twentyFourHoursFromNow,
          lte: twentyFiveHoursFromNow
        },
        status: AppointmentStatus.SCHEDULED,
        riskScore: { gte: 61 }, // High risk
        rideOfferSent: false
      },
      include: {
        patient: {
          include: {
            caseWorkers: true
          }
        },
        clinic: true
      }
    });

    console.log(`[Scheduler] Sending ride offers to ${appointments.length} high-risk patients`);

    for (const appointment of appointments) {
      try {
        const patient = appointment.patient;
        let targetPhone = patient.phoneNumber;

        // If patient has no phone, use caseworker's phone
        if (!targetPhone && patient.caseWorkers.length > 0) {
          targetPhone = patient.caseWorkers[0].phoneNumber;
          console.log(`[Scheduler] Patient ${patient.firstName} has no phone, using caseworker`);
        }

        if (!targetPhone) {
          console.log(`[Scheduler] No phone available for patient ${patient.firstName}`);
          continue;
        }

        const result = await this.twilioService.sendRideOffer(
          { ...appointment, clinic: { name: appointment.clinic.name, address: appointment.clinic.address } },
          !patient.phoneNumber ? targetPhone : undefined
        );

        if (result.success) {
          await this.prisma.appointment.update({
            where: { id: appointment.id },
            data: { rideOfferSent: true }
          });

          this.emit('RIDE_OFFER_SENT', {
            appointmentId: appointment.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            phoneNumber: targetPhone
          });
        }
      } catch (error) {
        console.error(`[Scheduler] Error sending ride offer for appointment ${appointment.id}:`, error);
      }
    }
  }

  /**
   * Send reminders for rides starting in approximately 2 hours
   */
  async sendRideReminders() {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoAndHalfHoursFromNow = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    const rides = await this.prisma.ride.findMany({
      where: {
        pickupTime: {
          gte: twoHoursFromNow,
          lte: twoAndHalfHoursFromNow
        },
        status: {
          in: [RideStatus.SCHEDULED, RideStatus.DRIVER_ASSIGNED]
        }
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

    console.log(`[Scheduler] Sending reminders for ${rides.length} upcoming rides`);

    for (const ride of rides) {
      try {
        const patient = ride.appointment.patient;
        const targetPhone = patient.phoneNumber || patient.caseWorkers[0]?.phoneNumber;

        if (!targetPhone) continue;

        await this.twilioService.sendRideReminder(ride, targetPhone, 2);

        this.emit('RIDE_REMINDER_SENT', {
          rideId: ride.id,
          appointmentId: ride.appointmentId,
          patientName: `${patient.firstName} ${patient.lastName}`
        });
      } catch (error) {
        console.error(`[Scheduler] Error sending reminder for ride ${ride.id}:`, error);
      }
    }
  }

  /**
   * Update ride statuses from Uber Health API
   */
  async updateRideStatuses() {
    const activeRides = await this.prisma.ride.findMany({
      where: {
        status: {
          in: [RideStatus.SCHEDULED, RideStatus.DRIVER_ASSIGNED, RideStatus.IN_PROGRESS]
        }
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

    for (const ride of activeRides) {
      if (!ride.uberRideId) continue;

      try {
        const uberStatus = await uberHealthService.getRideStatus(ride.uberRideId);
        if (!uberStatus) continue;

        const statusMap: Record<string, string> = {
          'scheduled': RideStatus.SCHEDULED,
          'driver_assigned': RideStatus.DRIVER_ASSIGNED,
          'en_route': RideStatus.DRIVER_ASSIGNED,
          'arrived': RideStatus.DRIVER_ASSIGNED,
          'in_progress': RideStatus.IN_PROGRESS,
          'completed': RideStatus.COMPLETED,
          'cancelled': RideStatus.CANCELLED
        };

        const newStatus = statusMap[uberStatus.status] || ride.status;
        const statusChanged = newStatus !== ride.status;

        await this.prisma.ride.update({
          where: { id: ride.id },
          data: {
            status: newStatus,
            driverName: uberStatus.driver?.name || ride.driverName,
            vehicleInfo: uberStatus.driver ? `${uberStatus.driver.vehicle} (${uberStatus.driver.license})` : ride.vehicleInfo,
            driverLatitude: uberStatus.current_location?.lat,
            driverLongitude: uberStatus.current_location?.lng
          }
        });

        if (statusChanged) {
          this.emit('RIDE_STATUS_UPDATE', {
            rideId: ride.id,
            appointmentId: ride.appointmentId,
            oldStatus: ride.status,
            newStatus,
            driver: uberStatus.driver,
            currentLocation: uberStatus.current_location
          });

          // Send driver arriving notification
          if (uberStatus.status === 'arrived') {
            const patient = ride.appointment.patient;
            const targetPhone = patient.phoneNumber || patient.caseWorkers[0]?.phoneNumber;
            if (targetPhone) {
              await this.twilioService.sendDriverArriving(ride, targetPhone);
            }
          }
        }
      } catch (error) {
        console.error(`[Scheduler] Error updating ride ${ride.id}:`, error);
      }
    }
  }

  /**
   * Mark appointments as NO_SHOW if not completed by end of day
   */
  async markNoShows() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const uncompletedAppointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: today,
          lte: endOfToday
        },
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]
        }
      }
    });

    console.log(`[Scheduler] Marking ${uncompletedAppointments.length} appointments as NO_SHOW`);

    for (const appointment of uncompletedAppointments) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.NO_SHOW }
      });

      // Record in no-show history
      await this.prisma.noShowHistory.create({
        data: {
          patientId: appointment.patientId,
          appointmentId: appointment.id
        }
      });

      this.emit('APPOINTMENT_UPDATE', {
        appointmentId: appointment.id,
        status: AppointmentStatus.NO_SHOW
      });
    }
  }

  // Manual trigger methods for testing/demo

  async triggerRiskCalculation() {
    await this.calculateAllRiskScores();
  }

  async triggerRideOffers() {
    await this.sendRideOffers();
  }

  async triggerReminders() {
    await this.sendRideReminders();
  }

  async triggerStatusUpdates() {
    await this.updateRideStatuses();
  }
}
