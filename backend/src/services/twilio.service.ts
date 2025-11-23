import twilio from 'twilio';
import { PrismaClient, Appointment, Patient, Ride } from '@prisma/client';

const SMSDirection = {
  OUTBOUND: 'OUTBOUND',
  INBOUND: 'INBOUND'
} as const;

const SMSStatus = {
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RECEIVED: 'RECEIVED'
} as const;

export interface SMSSendResult {
  success: boolean;
  twilioSid?: string;
  error?: string;
}

export class TwilioService {
  private client: twilio.Twilio | null = null;
  private prisma: PrismaClient;
  private fromNumber: string;
  private isTestMode: boolean;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.isTestMode = process.env.TWILIO_TEST_MODE === 'true' || !process.env.TWILIO_ACCOUNT_SID;

    if (!this.isTestMode) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  async sendSMS(to: string, message: string, appointmentId?: string): Promise<SMSSendResult> {
    // Store outbound message in database
    const smsRecord = await this.prisma.sMSMessage.create({
      data: {
        appointmentId: appointmentId || '',
        phoneNumber: to,
        message,
        direction: SMSDirection.OUTBOUND,
        status: SMSStatus.SENT,
        twilioSid: null
      }
    });

    if (this.isTestMode) {
      console.log(`[TEST MODE] SMS to ${to}: ${message}`);
      // Update with fake SID
      await this.prisma.sMSMessage.update({
        where: { id: smsRecord.id },
        data: {
          twilioSid: `TEST_${Date.now()}`,
          status: SMSStatus.DELIVERED
        }
      });
      return { success: true, twilioSid: `TEST_${Date.now()}` };
    }

    try {
      // Build status callback URL (you'd need to expose this via ngrok or similar for local dev)
      const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL || undefined;

      const twilioMessage = await this.client!.messages.create({
        body: message,
        from: this.fromNumber,
        to,
        statusCallback
      });

      // Update message with Twilio SID
      await this.prisma.sMSMessage.update({
        where: { id: smsRecord.id },
        data: {
          twilioSid: twilioMessage.sid,
          status: SMSStatus.DELIVERED
        }
      });

      return { success: true, twilioSid: twilioMessage.sid };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Twilio SMS error:', errorMessage);

      // Update message status to failed
      await this.prisma.sMSMessage.update({
        where: { id: smsRecord.id },
        data: { status: SMSStatus.FAILED }
      });

      return { success: false, error: errorMessage };
    }
  }

  async sendRideOffer(
    appointment: Appointment & { patient: Patient; clinic: { name: string; address: string } },
    caseworkerPhone?: string
  ): Promise<SMSSendResult> {
    const patient = appointment.patient;
    const targetPhone = caseworkerPhone || patient.phoneNumber;

    if (!targetPhone) {
      return { success: false, error: 'No phone number available for patient or caseworker' };
    }

    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let message: string;
    if (caseworkerPhone) {
      // Message to caseworker
      message = `Hi! This is RideKeeper. Your client ${patient.firstName} ${patient.lastName} has an appointment on ${formattedDate} at ${formattedTime} at ${appointment.clinic.name}. They may need a free ride. Can you confirm they'll be ready for pickup? Reply YES to book the ride.`;
    } else {
      // Message to patient
      message = `Hi ${patient.firstName}! You have an appointment on ${formattedDate} at ${formattedTime} at ${appointment.clinic.name}. Need a free ride? Reply YES and we'll send an Uber to pick you up.`;
    }

    return this.sendSMS(targetPhone, message, appointment.id);
  }

  async sendRideConfirmation(
    ride: Ride & { appointment: Appointment & { patient: Patient } },
    targetPhone: string
  ): Promise<SMSSendResult> {
    const pickupTime = new Date(ride.pickupTime);
    const formattedTime = pickupTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const message = `Great! Your ride is confirmed for ${formattedTime}. Pickup: ${ride.pickupLocation}. We'll text you when your driver is nearby. See you tomorrow!`;

    return this.sendSMS(targetPhone, message, ride.appointmentId);
  }

  async sendRideReminder(
    ride: Ride & { appointment: Appointment & { patient: Patient } },
    targetPhone: string,
    hoursBeforePickup: number
  ): Promise<SMSSendResult> {
    const pickupTime = new Date(ride.pickupTime);
    const formattedTime = pickupTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let timeText: string;
    if (hoursBeforePickup < 1) {
      const minutes = Math.round(hoursBeforePickup * 60);
      timeText = `${minutes} minutes`;
    } else {
      timeText = `${hoursBeforePickup} hour${hoursBeforePickup > 1 ? 's' : ''}`;
    }

    let message: string;
    if (ride.driverName && ride.vehicleInfo) {
      message = `Hi ${ride.appointment.patient.firstName}! Your Uber arrives in ${timeText} (${formattedTime}). Driver: ${ride.driverName}, ${ride.vehicleInfo}. Head to ${ride.pickupLocation}. See you soon!`;
    } else {
      message = `Hi ${ride.appointment.patient.firstName}! Your ride is scheduled to arrive in ${timeText} at ${formattedTime}. Be ready at ${ride.pickupLocation}!`;
    }

    return this.sendSMS(targetPhone, message, ride.appointmentId);
  }

  async sendDriverArriving(
    ride: Ride & { appointment: Appointment & { patient: Patient } },
    targetPhone: string
  ): Promise<SMSSendResult> {
    const message = `Your driver ${ride.driverName || ''} is arriving now in a ${ride.vehicleInfo || 'vehicle'}. Head to ${ride.pickupLocation}!`;

    return this.sendSMS(targetPhone, message, ride.appointmentId);
  }

  async handleIncomingSMS(
    from: string,
    body: string,
    twilioSid: string
  ): Promise<{ appointmentId: string | null; recorded: boolean }> {
    // Find the most recent outbound message to this phone number
    const recentOutbound = await this.prisma.sMSMessage.findFirst({
      where: {
        phoneNumber: from,
        direction: SMSDirection.OUTBOUND
      },
      orderBy: { createdAt: 'desc' },
      include: { appointment: true }
    });

    const appointmentId = recentOutbound?.appointmentId || null;

    // Store the incoming message
    await this.prisma.sMSMessage.create({
      data: {
        appointmentId: appointmentId || '',
        phoneNumber: from,
        message: body,
        direction: SMSDirection.INBOUND,
        status: SMSStatus.RECEIVED,
        twilioSid
      }
    });

    return { appointmentId, recorded: true };
  }

  // Get message templates for display
  static getMessageTemplates() {
    return {
      rideOffer: 'Hi {firstName}! You have an appointment on {date} at {time} at {clinicName}. Need a free ride? Reply YES and we\'ll send an Uber to pick you up.',
      rideOfferCaseworker: 'Hi! This is RideKeeper. Your client {firstName} {lastName} has an appointment on {date} at {time} at {clinicName}. They may need a free ride. Can you confirm they\'ll be ready for pickup? Reply YES to book the ride.',
      confirmation: 'Great! Your ride is confirmed for {time}. Pickup: {pickupLocation}. We\'ll text you when your driver is nearby. See you tomorrow!',
      reminder: 'Hi {firstName}! Your Uber arrives in {timeUntil} ({time}). Driver: {driverName}, {vehicleInfo}. Head to {pickupLocation}. See you soon!',
      driverArriving: 'Your driver {driverName} is arriving now in a {vehicleInfo}. Head to {pickupLocation}!'
    };
  }
}
