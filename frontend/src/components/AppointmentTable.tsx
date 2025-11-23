import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/RiskBadge";
import { RideStatusIndicator } from "@/components/RideStatusIndicator";
import { formatDate, formatTime, formatRelativeTime } from "@/lib/utils";
import { appointmentsApi, smsApi } from "@/lib/api";
import { useAppStore } from "@/stores/appStore";
import {
  Calendar,
  Car,
  CheckCircle,
  ChevronRight,
  MessageSquare,
  Phone,
  Send,
  User,
  Home,
  Loader2,
} from "lucide-react";

interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentType: string;
  status: string;
  riskScore: number | null;
  needsRide: boolean;
  rideOfferSent: boolean;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    housingStatus: string;
    distanceFromClinic: number | null;
    caseWorkers?: { name: string; phoneNumber: string }[];
  };
  clinic: {
    name: string;
  };
  ride?: {
    id: string;
    status: string;
    pickupTime: string;
    driverName: string | null;
    vehicleInfo: string | null;
  };
  smsMessages?: {
    id: string;
    message: string;
    direction: string;
    createdAt: string;
  }[];
}

interface AppointmentTableProps {
  appointments: Appointment[];
  onRefresh: () => void;
  loading?: boolean;
}

export function AppointmentTable({
  appointments,
  onRefresh,
  loading = false,
}: AppointmentTableProps) {
  const navigate = useNavigate();
  const { demoMode, addToast } = useAppStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleSendOffer = async (appointmentId: string, patientName: string) => {
    setActionLoading(appointmentId);
    try {
      const result = await appointmentsApi.offerRide(appointmentId);
      if (result.success) {
        addToast({
          title: "Ride offer sent",
          description: `SMS sent to ${patientName}`,
          type: "success",
        });
        onRefresh();
      } else {
        addToast({
          title: "Failed to send",
          description: result.error?.message || "Unknown error",
          type: "error",
        });
      }
    } catch {
      addToast({
        title: "Error",
        description: "Failed to send ride offer",
        type: "error",
      });
    }
    setActionLoading(null);
  };

  const handleSimulateReply = async (appointmentId: string, patientName: string) => {
    setActionLoading(`sim-${appointmentId}`);
    try {
      const result = await smsApi.simulateReply(appointmentId, "YES");
      if (result.success) {
        addToast({
          title: "Reply simulated",
          description: `${patientName} replied YES`,
          type: "success",
        });
        onRefresh();
      }
    } catch {
      addToast({
        title: "Error",
        description: "Failed to simulate reply",
        type: "error",
      });
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No appointments found</p>
        <p className="text-sm">Check back later or adjust your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50/50">
            <th className="text-left py-3 px-4 font-medium text-gray-600">
              Patient
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">
              Date & Time
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">
              Risk Score
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">
              Status
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">
              Ride
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-600">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((apt) => (
            <tr
              key={apt.id}
              className="border-b hover:bg-gray-50/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/appointments/${apt.id}`)}
            >
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {apt.patient.firstName} {apt.patient.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Home className="h-3 w-3" />
                      <span className="capitalize">
                        {apt.patient.housingStatus.toLowerCase().replace("_", " ")}
                      </span>
                      {!apt.patient.phoneNumber && (
                        <Badge variant="outline\" className="text-xs">
                          No Phone
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-col">
                  <span className="font-medium">
                    {formatDate(apt.appointmentDate)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatTime(apt.appointmentDate)}
                  </span>
                  <span className="text-xs text-primary">
                    {formatRelativeTime(apt.appointmentDate)}
                  </span>
                </div>
              </td>
              <td className="py-4 px-4">
                <RiskBadge score={apt.riskScore} />
              </td>
              <td className="py-4 px-4">
                <StatusBadge status={apt.status} />
              </td>
              <td className="py-4 px-4">
                {apt.ride ? (
                  <RideStatusIndicator
                    status={apt.ride.status as any}
                    driverName={apt.ride.driverName}
                    vehicleInfo={apt.ride.vehicleInfo}
                  />
                ) : apt.needsRide ? (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Needs Ride
                  </Badge>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>
              <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  {!apt.rideOfferSent && apt.riskScore && apt.riskScore >= 31 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleSendOffer(
                          apt.id,
                          `${apt.patient.firstName} ${apt.patient.lastName}`
                        )
                      }
                      disabled={actionLoading === apt.id}
                    >
                      {actionLoading === apt.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Offer Ride
                        </>
                      )}
                    </Button>
                  )}
                  {demoMode && apt.rideOfferSent && !apt.ride && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleSimulateReply(
                          apt.id,
                          apt.patient.firstName
                        )
                      }
                      disabled={actionLoading === `sim-${apt.id}`}
                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    >
                      {actionLoading === `sim-${apt.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4" />
                          Simulate YES
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/appointments/${apt.id}`)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
  > = {
    SCHEDULED: { label: "Scheduled", variant: "secondary" },
    CONFIRMED: { label: "Confirmed", variant: "default" },
    COMPLETED: { label: "Completed", variant: "success" },
    NO_SHOW: { label: "No Show", variant: "destructive" },
    CANCELLED: { label: "Cancelled", variant: "secondary" },
  };

  const cfg = config[status] || { label: status, variant: "secondary" as const };

  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
