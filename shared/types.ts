// Shared TypeScript types for RideKeeper

// Enums
export enum HousingStatus {
  HOMELESS = 'HOMELESS',
  UNSTABLY_HOUSED = 'UNSTABLY_HOUSED',
  HOUSED = 'HOUSED'
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  CANCELLED = 'CANCELLED'
}

export enum RideStatus {
  SCHEDULED = 'SCHEDULED',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum SMSDirection {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND'
}

export enum SMSStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RECEIVED = 'RECEIVED'
}

export enum RiskCategory {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum PatientIntent {
  CONFIRM_RIDE = 'CONFIRM_RIDE',
  DECLINE_RIDE = 'DECLINE_RIDE',
  RESCHEDULE = 'RESCHEDULE',
  QUESTION = 'QUESTION',
  UNKNOWN = 'UNKNOWN'
}

// Base interfaces
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  email: string | null;
  housingStatus: HousingStatus;
  address: string | null;
  distanceFromClinic: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  patientId: string;
  clinicId: string;
  appointmentDate: Date;
  appointmentType: string;
  status: AppointmentStatus;
  riskScore: number | null;
  needsRide: boolean;
  createdAt: Date;
  updatedAt: Date;
  patient?: Patient;
  clinic?: Clinic;
  ride?: Ride;
  smsMessages?: SMSMessage[];
}

export interface Ride {
  id: string;
  appointmentId: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: Date;
  status: RideStatus;
  uberRideId: string | null;
  estimatedCost: number | null;
  driverName: string | null;
  vehicleInfo: string | null;
  driverLatitude: number | null;
  driverLongitude: number | null;
  createdAt: Date;
  updatedAt: Date;
  appointment?: Appointment;
}

export interface SMSMessage {
  id: string;
  appointmentId: string;
  phoneNumber: string;
  message: string;
  direction: SMSDirection;
  status: SMSStatus;
  twilioSid: string | null;
  createdAt: Date;
  appointment?: Appointment;
}

export interface CaseWorker {
  id: string;
  name: string;
  phoneNumber: string;
  organization: string;
  createdAt: Date;
  updatedAt: Date;
  patients?: Patient[];
}

// Risk Score types
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

// Claude parsing types
export interface ParsedPatientResponse {
  intent: PatientIntent;
  confidence: number;
  alternativePickupLocation?: string;
  preferredTime?: string;
  rawMessage: string;
}

// API Response types
export interface DashboardStats {
  upcomingAppointments: number;
  highRiskPatients: number;
  ridesScheduledToday: number;
  noShowRate: number;
  noShowTrend: number; // positive = increasing, negative = decreasing
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
  action?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Uber Health mock types
export interface UberRideRequest {
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoffLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  pickupTime: Date;
  patientName: string;
  patientPhone: string;
}

export interface UberRideResponse {
  ride_id: string;
  status: string;
  pickup_time: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  driver: {
    name: string;
    vehicle: string;
    license: string;
  } | null;
  estimated_cost: number;
}

// WebSocket event types
export interface WSEvent {
  type: 'SMS_RECEIVED' | 'RIDE_STATUS_UPDATE' | 'APPOINTMENT_UPDATE' | 'RISK_SCORE_CALCULATED';
  payload: unknown;
  timestamp: Date;
}
