import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { AppointmentTable } from "@/components/AppointmentTable";
import { useAppStore } from "@/stores/appStore";
import { dashboardApi, appointmentsApi } from "@/lib/api";
import { socketService } from "@/lib/socket";
import {
  Calendar,
  Car,
  AlertTriangle,
  TrendingDown,
  Send,
  Filter,
  RefreshCw,
} from "lucide-react";

export function Dashboard() {
  const { riskFilter, setRiskFilter, addToast, demoMode } = useAppStore();
  const [bulkLoading, setBulkLoading] = useState(false);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const result = await dashboardApi.getStats();
      return result.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch appointments
  const {
    data: appointments,
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useQuery({
    queryKey: ["appointments", riskFilter],
    queryFn: async () => {
      const filters = riskFilter !== "all" ? { riskFilter } : {};
      const result = await appointmentsApi.getUpcoming(filters);
      return result.data as any[];
    },
    refetchInterval: 30000,
  });

  // Subscribe to WebSocket events
  useEffect(() => {
    socketService.connect();

    const unsubSMS = socketService.subscribe("SMS_RECEIVED", (data: any) => {
      addToast({
        title: "New Message",
        description: `${data.patientName}: "${data.body.substring(0, 50)}..."`,
        type: "default",
      });
      refetchAppointments();
    });

    const unsubRide = socketService.subscribe("RIDE_BOOKED", (data: any) => {
      addToast({
        title: "Ride Booked",
        description: `Ride confirmed for ${data.patientName}`,
        type: "success",
      });
      refetchAppointments();
      refetchStats();
    });

    const unsubOffer = socketService.subscribe("RIDE_OFFER_SENT", (data: any) => {
      addToast({
        title: "Ride Offer Sent",
        description: `SMS sent to ${data.patientName}`,
        type: "success",
      });
    });

    return () => {
      unsubSMS();
      unsubRide();
      unsubOffer();
    };
  }, [addToast, refetchAppointments, refetchStats]);

  const handleBulkSendOffers = async () => {
    if (!appointments) return;

    setBulkLoading(true);
    const highRisk = appointments.filter(
      (apt: any) => apt.riskScore >= 61 && !apt.rideOfferSent
    );

    let sent = 0;
    for (const apt of highRisk) {
      try {
        await appointmentsApi.offerRide(apt.id);
        sent++;
      } catch (e) {
        console.error("Failed to send offer:", e);
      }
    }

    addToast({
      title: "Bulk Send Complete",
      description: `Sent ${sent} ride offers to high-risk patients`,
      type: "success",
    });

    setBulkLoading(false);
    refetchAppointments();
  };

  const highRiskCount = appointments?.filter(
    (apt: any) => apt.riskScore >= 61 && !apt.rideOfferSent
  ).length || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            Manage patient transportation and reduce no-shows
          </p>
        </div>
        <div className="flex items-center gap-3">
          {demoMode && highRiskCount > 0 && (
            <Button
              onClick={handleBulkSendOffers}
              disabled={bulkLoading}
              className="bg-gradient-to-r from-primary to-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {bulkLoading
                ? "Sending..."
                : `Send All Offers (${highRiskCount})`}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              refetchStats();
              refetchAppointments();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Upcoming Appointments"
          value={stats?.upcomingAppointments ?? "-"}
          icon={Calendar}
          loading={statsLoading}
        />
        <StatCard
          title="High-Risk Patients"
          value={stats?.highRiskPatients ?? "-"}
          icon={AlertTriangle}
          iconColor="text-red-500"
          loading={statsLoading}
        />
        <StatCard
          title="Rides Scheduled Today"
          value={stats?.ridesScheduledToday ?? "-"}
          icon={Car}
          iconColor="text-green-500"
          loading={statsLoading}
        />
        <StatCard
          title="No-Show Rate"
          value={stats ? `${stats.noShowRate}%` : "-"}
          icon={TrendingDown}
          trend={stats?.noShowTrend}
          trendLabel="vs last month"
          loading={statsLoading}
        />
      </div>

      {/* Appointments Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            Upcoming Appointments
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              className="text-sm border rounded-md px-2 py-1 bg-white"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk Only</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <AppointmentTable
            appointments={appointments || []}
            onRefresh={refetchAppointments}
            loading={appointmentsLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
