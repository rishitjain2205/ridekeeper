import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime, formatCurrency, cn } from "@/lib/utils";
import {
  Car,
  Clock,
  MapPin,
  Building2,
  User,
  DollarSign,
  Activity,
} from "lucide-react";

interface RideDetailsCardProps {
  ride: {
    id: string;
    status: string;
    pickupTime: string;
    pickupLocation: string;
    dropoffLocation?: string;
    driverName?: string | null;
    vehicleInfo?: string | null;
    estimatedCost?: number | null;
  };
  clinicName?: string;
  clinicAddress?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  SCHEDULED: { label: "Scheduled", color: "text-blue-700", bgColor: "bg-blue-100" },
  DRIVER_ASSIGNED: { label: "Driver Assigned", color: "text-purple-700", bgColor: "bg-purple-100" },
  EN_ROUTE_PICKUP: { label: "Driver En Route", color: "text-orange-700", bgColor: "bg-orange-100" },
  ARRIVED_PICKUP: { label: "Driver Arrived", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  IN_PROGRESS: { label: "In Progress", color: "text-green-700", bgColor: "bg-green-100" },
  COMPLETED: { label: "Completed", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  CANCELLED: { label: "Cancelled", color: "text-red-700", bgColor: "bg-red-100" },
};

export function RideDetailsCard({ ride, clinicName, clinicAddress }: RideDetailsCardProps) {
  const status = statusConfig[ride.status] || statusConfig.SCHEDULED;

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Car className="h-5 w-5 text-blue-600" />
            Ride Details
          </span>
          <Badge className={cn(status.bgColor, status.color, "border-0")}>
            {status.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main ride info grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Pickup Time */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pickup Time</p>
              <p className="font-semibold text-gray-900">{formatTime(ride.pickupTime)}</p>
            </div>
          </div>

          {/* Estimated Cost */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Estimated Cost</p>
              <p className="font-semibold text-gray-900">
                {ride.estimatedCost ? formatCurrency(ride.estimatedCost) : "Calculating..."}
              </p>
            </div>
          </div>

          {/* Pickup Location */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <MapPin className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pickup Location</p>
              <p className="font-medium text-gray-900 text-sm">{ride.pickupLocation}</p>
            </div>
          </div>

          {/* Dropoff Location */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Building2 className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Dropoff Location</p>
              <p className="font-medium text-gray-900 text-sm">
                {ride.dropoffLocation || clinicName || "Clinic"}
              </p>
              {clinicAddress && (
                <p className="text-xs text-gray-500">{clinicAddress}</p>
              )}
            </div>
          </div>
        </div>

        {/* Driver info section */}
        <div className="pt-4 border-t border-blue-100">
          <div className="grid grid-cols-2 gap-4">
            {/* Driver */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Driver</p>
                <p className={cn(
                  "font-medium",
                  ride.driverName ? "text-gray-900" : "text-gray-400 italic"
                )}>
                  {ride.driverName || "TBD (will update when assigned)"}
                </p>
              </div>
            </div>

            {/* Vehicle */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Car className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Vehicle</p>
                <p className={cn(
                  "font-medium",
                  ride.vehicleInfo ? "text-gray-900" : "text-gray-400 italic"
                )}>
                  {ride.vehicleInfo || "TBD"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="pt-4 border-t border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Activity className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  ride.status === "COMPLETED" ? "bg-emerald-500" :
                  ride.status === "CANCELLED" ? "bg-red-500" :
                  ride.status === "IN_PROGRESS" ? "bg-green-500" :
                  "bg-blue-500"
                )} />
                <span className="font-medium text-gray-900">{status.label}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
