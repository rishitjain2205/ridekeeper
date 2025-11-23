import { PrismaClient } from '@prisma/client';

const HousingStatus = {
  HOMELESS: 'HOMELESS',
  UNSTABLY_HOUSED: 'UNSTABLY_HOUSED',
  HOUSED: 'HOUSED'
} as const;

const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED'
} as const;

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

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // Check if database already has data
  const existingClinics = await prisma.clinic.count();
  if (existingClinics > 0) {
    console.log('Database already has data, skipping seed');
    return;
  }

  console.log('🌱 Seeding database...');

  // Create clinic
  const clinic = await prisma.clinic.create({
    data: {
      name: 'Mission Health Clinic',
      address: '1234 Mission St, San Francisco, CA 94103',
      latitude: 37.7749,
      longitude: -122.4194
    }
  });
  console.log('✅ Created clinic:', clinic.name);

  // Create caseworker
  const caseworker = await prisma.caseWorker.create({
    data: {
      name: 'Sarah Johnson',
      phoneNumber: '+15559990000',
      organization: 'Downtown Shelter'
    }
  });
  console.log('✅ Created caseworker:', caseworker.name);

  // Create patients
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  dayAfterTomorrow.setHours(9, 0, 0, 0);

  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  threeDaysFromNow.setHours(11, 0, 0, 0);

  const fourDaysFromNow = new Date();
  fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
  fourDaysFromNow.setHours(15, 0, 0, 0);

  // Patient 1: Maria Rodriguez - High risk, has phone, appointment tomorrow
  const maria = await prisma.patient.create({
    data: {
      firstName: 'Maria',
      lastName: 'Rodriguez',
      phoneNumber: '+13108678464',
      email: 'maria.r@email.com',
      housingStatus: HousingStatus.HOMELESS,
      address: 'Downtown Shelter, 100 Main St, San Francisco, CA',
      distanceFromClinic: 4.2
    }
  });

  // Patient 2: James Wilson - High risk, NO phone
  const tomorrowAfternoon = new Date();
  tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
  tomorrowAfternoon.setHours(14, 0, 0, 0);

  const james = await prisma.patient.create({
    data: {
      firstName: 'James',
      lastName: 'Wilson',
      phoneNumber: null,
      email: null,
      housingStatus: HousingStatus.HOMELESS,
      address: 'Civic Center Encampment',
      distanceFromClinic: 150.0,
      caseWorkers: {
        connect: { id: caseworker.id }
      }
    }
  });

  // Patient 3: Carlos Martinez - Medium risk
  const carlos = await prisma.patient.create({
    data: {
      firstName: 'Carlos',
      lastName: 'Martinez',
      phoneNumber: '+15552345678',
      email: 'carlos.m@email.com',
      housingStatus: HousingStatus.UNSTABLY_HOUSED,
      address: '456 Oak St, San Francisco, CA',
      distanceFromClinic: 1.5
    }
  });

  // Patient 4: Lisa Chen - High risk
  const lisa = await prisma.patient.create({
    data: {
      firstName: 'Lisa',
      lastName: 'Chen',
      phoneNumber: '+15553456789',
      email: 'lisa.c@email.com',
      housingStatus: HousingStatus.HOMELESS,
      address: 'Women\'s Shelter, 200 Pine St',
      distanceFromClinic: 5.5,
      caseWorkers: {
        connect: { id: caseworker.id }
      }
    }
  });

  // Patient 5: David Kim - Low risk
  const david = await prisma.patient.create({
    data: {
      firstName: 'David',
      lastName: 'Kim',
      phoneNumber: '+15554567890',
      email: 'david.k@email.com',
      housingStatus: HousingStatus.HOUSED,
      address: '789 Market St, Apt 5B, San Francisco, CA',
      distanceFromClinic: 0.8
    }
  });

  console.log('✅ Created 5 patients');

  // Create appointments
  const mariaAppointment = await prisma.appointment.create({
    data: {
      patientId: maria.id,
      clinicId: clinic.id,
      appointmentDate: tomorrow,
      appointmentType: 'Primary Care Follow-up',
      status: AppointmentStatus.SCHEDULED,
      riskScore: 85,
      needsRide: true,
      rideOfferSent: false
    }
  });

  const jamesAppointment = await prisma.appointment.create({
    data: {
      patientId: james.id,
      clinicId: clinic.id,
      appointmentDate: tomorrowAfternoon,
      appointmentType: 'Mental Health Evaluation',
      status: AppointmentStatus.SCHEDULED,
      riskScore: 95,
      needsRide: true,
      rideOfferSent: false
    }
  });

  const carlosAppointment = await prisma.appointment.create({
    data: {
      patientId: carlos.id,
      clinicId: clinic.id,
      appointmentDate: dayAfterTomorrow,
      appointmentType: 'Diabetes Management',
      status: AppointmentStatus.SCHEDULED,
      riskScore: 50,
      needsRide: false,
      rideOfferSent: false
    }
  });

  const lisaAppointment = await prisma.appointment.create({
    data: {
      patientId: lisa.id,
      clinicId: clinic.id,
      appointmentDate: threeDaysFromNow,
      appointmentType: 'Prenatal Checkup',
      status: AppointmentStatus.SCHEDULED,
      riskScore: 100,
      needsRide: true,
      rideOfferSent: false
    }
  });

  await prisma.appointment.create({
    data: {
      patientId: david.id,
      clinicId: clinic.id,
      appointmentDate: fourDaysFromNow,
      appointmentType: 'Annual Physical',
      status: AppointmentStatus.SCHEDULED,
      riskScore: 10,
      needsRide: false,
      rideOfferSent: false
    }
  });

  console.log('✅ Created 5 appointments');

  // Create no-show history
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  await prisma.noShowHistory.createMany({
    data: [
      { patientId: maria.id, appointmentId: mariaAppointment.id, occurredAt: threeMonthsAgo },
      { patientId: maria.id, appointmentId: mariaAppointment.id, occurredAt: oneMonthAgo }
    ]
  });

  await prisma.noShowHistory.create({
    data: {
      patientId: carlos.id,
      appointmentId: carlosAppointment.id,
      occurredAt: twoMonthsAgo
    }
  });

  await prisma.noShowHistory.createMany({
    data: [
      { patientId: lisa.id, appointmentId: lisaAppointment.id, occurredAt: threeMonthsAgo },
      { patientId: lisa.id, appointmentId: lisaAppointment.id, occurredAt: twoMonthsAgo },
      { patientId: lisa.id, appointmentId: lisaAppointment.id, occurredAt: oneMonthAgo }
    ]
  });

  console.log('✅ Created no-show history');

  // Create sample SMS conversations
  const yesterdayMorning = new Date();
  yesterdayMorning.setDate(yesterdayMorning.getDate() - 1);
  yesterdayMorning.setHours(8, 0, 0, 0);

  await prisma.sMSMessage.createMany({
    data: [
      {
        appointmentId: mariaAppointment.id,
        phoneNumber: '+15551234567',
        message: 'Hi Maria! You have an appointment on ' + tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' at 10:00 AM at Mission Health Clinic. Need a free ride? Reply YES.',
        direction: SMSDirection.OUTBOUND,
        status: SMSStatus.DELIVERED,
        twilioSid: 'SM_SEED_001',
        createdAt: yesterdayMorning
      }
    ]
  });

  await prisma.sMSMessage.createMany({
    data: [
      {
        appointmentId: carlosAppointment.id,
        phoneNumber: '+15552345678',
        message: 'Hi Carlos! You have an appointment soon. Need a free ride? Reply YES.',
        direction: SMSDirection.OUTBOUND,
        status: SMSStatus.DELIVERED,
        twilioSid: 'SM_SEED_002',
        createdAt: new Date(Date.now() - 86400000)
      },
      {
        appointmentId: carlosAppointment.id,
        phoneNumber: '+15552345678',
        message: 'No thanks, my friend is taking me',
        direction: SMSDirection.INBOUND,
        status: SMSStatus.RECEIVED,
        twilioSid: 'SM_SEED_003',
        createdAt: new Date(Date.now() - 86300000)
      },
      {
        appointmentId: carlosAppointment.id,
        phoneNumber: '+15552345678',
        message: 'No problem! See you at your appointment!',
        direction: SMSDirection.OUTBOUND,
        status: SMSStatus.DELIVERED,
        twilioSid: 'SM_SEED_004',
        createdAt: new Date(Date.now() - 86200000)
      }
    ]
  });

  await prisma.appointment.update({
    where: { id: carlosAppointment.id },
    data: { needsRide: false, rideOfferSent: true }
  });

  console.log('✅ Created sample SMS conversations');
  console.log('🎉 Database seeding complete!');
}
