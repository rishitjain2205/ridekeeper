import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/RiskBadge";
import { RideStatusIndicator, RideStatusProgress } from "@/components/RideStatusIndicator";
import { SMSTimeline } from "@/components/SMSTimeline";
import { AIRiskAssessment } from "@/components/AIRiskAssessment";
import { RouteMap } from "@/components/RouteMap";
import { RideDetailsCard } from "@/components/RideDetailsCard";
import { useAppStore } from "@/stores/appStore";
import { appointmentsApi, ridesApi, smsApi, dashboardApi } from "@/lib/api";
import { socketService } from "@/lib/socket";
import { formatDateTime, formatTime, formatCurrency, formatPhoneNumber } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Car,
  CheckCircle,
  Clock,
  Home,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  User,
  XCircle,
  FastForward,
  AlertTriangle,
  ChevronRight,
  Check,
} from "lucide-react";

export function AppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { demoMode, addToast, triggerCelebration } = useAppStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rideOfferSent, setRideOfferSent] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);

  // Fetch appointment details
  const { data: appointment, isLoading, refetch } = useQuery({
    queryKey: ["appointment", id],
    queryFn: async () => {
      const result = await appointmentsApi.getById(id!, true); // Include AI data
      return result.data as any;
    },
    enabled: !!id,
  });

  // Track ride offer sent state from appointment data
  useEffect(() => {
    if (appointment?.rideOfferSent) {
      setRideOfferSent(true);
    }
  }, [appointment?.rideOfferSent]);

  // Subscribe to WebSocket events for this appointment
  useEffect(() => {
    if (!id) return;

    socketService.connect();
    socketService.joinAppointment(id);

    const unsubSMS = socketService.subscribe("SMS_RECEIVED", (data: any) => {
      if (data.appointmentId === id) {
        setShowTypingIndicator(false);
        refetch();
        addToast({
          title: "New Message",
          description: data.body?.substring(0, 50) || "Patient replied",
          type: "default",
        });
      }
    });

    const unsubRide = socketService.subscribe("RIDE_STATUS_UPDATE", (data: any) => {
      if (data.appointmentId === id) {
        refetch();
      }
    });

    const unsubRideBooked = socketService.subscribe("RIDE_BOOKED", (data: any) => {
      if (data.appointmentId === id) {
        setShowTypingIndicator(false);
        refetch();
        addToast({
          title: "Ride Booked!",
          description: "Uber ride has been scheduled",
          type: "success",
        });
      }
    });

    const unsubRideOffer = socketService.subscribe("RIDE_OFFER_SENT", (data: any) => {
      if (data.appointmentId === id) {
        setShowTypingIndicator(true);
        refetch();
      }
    });

    const unsubCompleted = socketService.subscribe("APPOINTMENT_COMPLETED", (data: any) => {
      if (data.appointmentId === id) {
        const patientName = appointment?.patient
          ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
          : "Patient";
        triggerCelebration(`${patientName} attended their appointment!`);
        refetch();
      }
    });

    return () => {
      socketService.leaveAppointment(id);
      unsubSMS();
      unsubRide();
      unsubRideBooked();
      unsubRideOffer();
      unsubCompleted();
    };
  }, [id, refetch, addToast, triggerCelebration, appointment?.patient]);

  const handleSendOffer = async () => {
    setActionLoading("offer");
    try {
      const result = await appointmentsApi.offerRide(id!);
      if (result.success) {
        setRideOfferSent(true);
        setShowTypingIndicator(true);

        const patientName = appointment?.patient
          ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
          : "Patient";

        addToast({
          title: "Ride offer sent",
          description: `SMS sent to ${patientName}`,
          type: "success",
        });
        refetch();
      } else {
        addToast({
          title: "Failed",
          description: result.error?.message,
          type: "error",
        });
      }
    } catch {
      addToast({ title: "Error", description: "Failed to send offer", type: "error" });
    }
    setActionLoading(null);
  };

  const handleBookRide = async () => {
    if (!appointment) return;
    setActionLoading("book");
    try {
      const pickupTime = new Date(appointment.appointmentDate);
      pickupTime.setMinutes(pickupTime.getMinutes() - 45);

      const result = await ridesApi.book({
        appointmentId: id!,
        pickupLocation: appointment.patient.address || "Main entrance",
        pickupTime: pickupTime.toISOString(),
      });

      if (result.success) {
        addToast({
          title: "Ride booked!",
          description: "Uber Health ride scheduled successfully",
          type: "success",
        });
        refetch();
      }
    } catch {
      addToast({ title: "Error", description: "Failed to book ride", type: "error" });
    }
    setActionLoading(null);
  };

  const handleSimulateReply = async (message: string = "YES") => {
    setActionLoading("simulate");
    setShowTypingIndicator(false);
    try {
      await smsApi.simulateReply(id!, message);
      addToast({
        title: "Reply simulated",
        description: `Patient replied: ${message}`,
        type: "success",
      });
      refetch();
    } catch {
      addToast({ title: "Error", description: "Failed to simulate", type: "error" });
    }
    setActionLoading(null);
  };

  const handleFastForward = async (targetState: string) => {
    setActionLoading(`ff-${targetState}`);
    try {
      await dashboardApi.fastForward(id!, targetState);
      refetch();

      if (targetState === "completed") {
        const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
        triggerCelebration(`${patientName} attended their appointment!`);
      }
    } catch {
      addToast({ title: "Error", description: "Failed to fast forward", type: "error" });
    }
    setActionLoading(null);
  };

  const handleMarkCompleted = async () => {
    setActionLoading("complete");
    try {
      await appointmentsApi.markCompleted(id!);
      const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
      triggerCelebration(`${patientName} attended their appointment!`);
      refetch();
    } catch {
      addToast({ title: "Error", description: "Failed to complete", type: "error" });
    }
    setActionLoading(null);
  };

  const handleMarkNoShow = async () => {
    setActionLoading("noshow");
    try {
      await appointmentsApi.markNoShow(id!);
      addToast({
        title: "Marked as No-Show",
        description: "Appointment status updated",
        type: "warning",
      });
      refetch();
    } catch {
      addToast({ title: "Error", description: "Failed to update", type: "error" });
    }
    setActionLoading(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Appointment not found</p>
        <Button onClick={() => navigate("/")} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const { patient, clinic, ride, smsMessages, riskBreakdown } = appointment;
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const hasPatientConfirmed = smsMessages?.some(
    (msg: any) => msg.direction === "INBOUND" && msg.message.toLowerCase().includes("yes")
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-primary transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{patientName}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {patientName}
          </h1>
          <p className="text-gray-500">{appointment.appointmentType}</p>
        </div>
        <Badge
          variant={
            appointment.status === "COMPLETED"
              ? "success"
              : appointment.status === "NO_SHOW"
              ? "destructive"
              : "default"
          }
          className="text-sm"
        >
          {appointment.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Housing Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Home className="h-4 w-4 text-gray-400" />
                    <span className="capitalize">
                      {patient.housingStatus.toLowerCase().replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>
                      {patient.phoneNumber
                        ? formatPhoneNumber(patient.phoneNumber)
                        : "No phone - uses caseworker"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Distance from Clinic</p>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>
                      {patient.distanceFromClinic
                        ? `${patient.distanceFromClinic.toFixed(1)} miles`
                        : "Unknown"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="mt-1 text-sm">{patient.address || "Not provided"}</p>
                </div>
              </div>

              {patient.caseWorkers?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">Caseworker</p>
                  {patient.caseWorkers.map((cw: any) => (
                    <div key={cw.id} className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>
                        {cw.name} ({cw.organization}) -{" "}
                        {formatPhoneNumber(cw.phoneNumber)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointment Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Appointment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium mt-1">
                    {formatDateTime(appointment.appointmentDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Clinic</p>
                  <p className="font-medium mt-1">{clinic.name}</p>
                  <p className="text-sm text-gray-500">{clinic.address}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="mt-1">{appointment.appointmentType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Risk Score</p>
                  <div className="mt-1">
                    <RiskBadge score={appointment.riskScore} size="lg" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ride Details Card - Shows after ride is booked */}
          {ride && (
            <RideDetailsCard
              ride={ride}
              clinicName={clinic.name}
              clinicAddress={clinic.address}
            />
          )}

          {/* Risk Breakdown Card */}
          {riskBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Score Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskBreakdown.factors.map((factor: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{factor.factor}</p>
                        <p className="text-sm text-gray-500">{factor.reason}</p>
                      </div>
                      <Badge variant="outline">+{factor.points}</Badge>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 border-t font-medium">
                    <span>Total Score</span>
                    <RiskBadge score={riskBreakdown.score} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Route Map Card */}
          <RouteMap
            patientAddress={patient.address || ""}
            patientName={patient.firstName}
            clinicAddress={clinic.address}
            clinicName={clinic.name}
            distance={patient.distanceFromClinic}
          />

          {/* AI Risk Assessment Card */}
          <AIRiskAssessment
            appointmentId={id!}
            baseScore={appointment.riskScore}
            aiScore={appointment.aiRiskScore}
            aiConfidence={appointment.aiConfidence}
            aiReasoning={appointment.aiReasoning}
            aiRecommendations={appointment.aiRecommendations}
            onUpdate={refetch}
          />

          {/* Legacy Ride Info Card - Only show for additional controls */}
          {ride && demoMode && ride.status !== "COMPLETED" && ride.status !== "CANCELLED" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Ride Controls (Demo)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <RideStatusProgress status={ride.status} />

                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500 mb-2">Demo Controls</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFastForward("pickup")}
                        disabled={actionLoading?.startsWith("ff")}
                      >
                        <FastForward className="h-4 w-4 mr-1" />
                        Driver Arriving
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFastForward("in_progress")}
                        disabled={actionLoading?.startsWith("ff")}
                      >
                        <Car className="h-4 w-4 mr-1" />
                        Start Ride
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleFastForward("completed")}
                        disabled={actionLoading?.startsWith("ff")}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Send Ride Offer Button */}
              {!rideOfferSent && !appointment.rideOfferSent && appointment.status === "SCHEDULED" && (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleSendOffer}
                  disabled={actionLoading === "offer"}
                >
                  {actionLoading === "offer" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Ride Offer
                    </>
                  )}
                </Button>
              )}

              {/* Offer Sent - Disabled State */}
              {(rideOfferSent || appointment.rideOfferSent) && !ride && !hasPatientConfirmed && (
                <Button
                  className="w-full bg-gray-400 cursor-not-allowed"
                  disabled
                >
                  <Check className="h-4 w-4 mr-2" />
                  Offer Sent
                </Button>
              )}

              {/* Book Ride Button - Shows after patient confirms */}
              {(hasPatientConfirmed || appointment.status === "CONFIRMED") && !ride && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleBookRide}
                  disabled={actionLoading === "book"}
                >
                  {actionLoading === "book" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <Car className="h-4 w-4 mr-2" />
                      Book Ride Now
                    </>
                  )}
                </Button>
              )}

              {/* Ride Booked - Disabled State */}
              {ride && (
                <Button
                  className="w-full bg-green-500 cursor-not-allowed"
                  disabled
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Ride Booked
                </Button>
              )}

              {(appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") && (
                <>
                  <Button
                    className="w-full"
                    variant="success"
                    onClick={handleMarkCompleted}
                    disabled={actionLoading === "complete"}
                  >
                    {actionLoading === "complete" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Mark as Completed
                  </Button>

                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={handleMarkNoShow}
                    disabled={actionLoading === "noshow"}
                  >
                    {actionLoading === "noshow" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Mark as No-Show
                  </Button>
                </>
              )}

              {demoMode && (rideOfferSent || appointment.rideOfferSent) && !ride && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-500 mb-2">Demo: Simulate Reply</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSimulateReply("YES")}
                      disabled={actionLoading === "simulate"}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      YES
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSimulateReply("No thanks")}
                      disabled={actionLoading === "simulate"}
                    >
                      NO
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communication Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Communication
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SMSTimeline
                messages={smsMessages || []}
                patientName={patientName}
                showTypingIndicator={showTypingIndicator}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
