import { cn } from "@/lib/utils";
import { Car, CheckCircle, Clock, MapPin, XCircle, User } from "lucide-react";

type RideStatus = "SCHEDULED" | "DRIVER_ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface RideStatusIndicatorProps {
  status: RideStatus;
  driverName?: string | null;
  vehicleInfo?: string | null;
  showDetails?: boolean;
}

const statusConfig: Record<
  RideStatus,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  SCHEDULED: {
    label: "Scheduled",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    icon: Clock,
  },
  DRIVER_ASSIGNED: {
    label: "Driver Assigned",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    icon: User,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    icon: Car,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-50",
    icon: CheckCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    icon: XCircle,
  },
};

export function RideStatusIndicator({
  status,
  driverName,
  vehicleInfo,
  showDetails = false,
}: RideStatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
          config.bgColor
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className={cn("text-sm font-medium", config.color)}>
          {config.label}
        </span>
        {status === "IN_PROGRESS" && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
          </span>
        )}
      </div>

      {showDetails && (status === "DRIVER_ASSIGNED" || status === "IN_PROGRESS") && (
        <div className="flex flex-col gap-1 text-sm text-gray-600 pl-1">
          {driverName && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{driverName}</span>
            </div>
          )}
          {vehicleInfo && (
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <span>{vehicleInfo}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Progress indicator showing ride status timeline
export function RideStatusProgress({ status }: { status: RideStatus }) {
  const steps = ["SCHEDULED", "DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED"];
  const currentIndex = steps.indexOf(status);

  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <XCircle className="h-4 w-4" />
        <span className="text-sm">Ride was cancelled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                isActive ? "bg-primary" : "bg-gray-200",
                isCurrent && "ring-2 ring-primary ring-offset-2"
              )}
            />
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8",
                  index < currentIndex ? "bg-primary" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
