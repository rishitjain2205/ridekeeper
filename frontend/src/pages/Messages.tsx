import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { smsApi } from "@/lib/api";
import { formatDateTime, formatPhoneNumber } from "@/lib/utils";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Inbox,
  Search,
  Loader2,
  ChevronRight,
} from "lucide-react";

interface SMSMessage {
  id: string;
  appointmentId: string;
  phoneNumber: string;
  message: string;
  direction: "OUTBOUND" | "INBOUND";
  status: "SENT" | "DELIVERED" | "FAILED" | "RECEIVED";
  createdAt: string;
  appointment?: {
    patient: {
      firstName: string;
      lastName: string;
    };
  };
}

export function Messages() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "INBOUND" | "OUTBOUND">("all");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const result = await smsApi.getMessages({ limit: 100 });
      return result.data as SMSMessage[];
    },
  });

  const filteredMessages = messages?.filter((msg) => {
    const matchesSearch =
      searchQuery === "" ||
      msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.phoneNumber.includes(searchQuery) ||
      msg.appointment?.patient?.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.appointment?.patient?.lastName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDirection =
      directionFilter === "all" || msg.direction === directionFilter;

    return matchesSearch && matchesDirection;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Communication Log</h1>
          <p className="text-gray-500">All SMS messages with patients</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages, patients, or phone numbers..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={directionFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirectionFilter("all")}
              >
                All
              </Button>
              <Button
                variant={directionFilter === "INBOUND" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirectionFilter("INBOUND")}
              >
                <Inbox className="h-4 w-4 mr-1" />
                Received
              </Button>
              <Button
                variant={directionFilter === "OUTBOUND" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirectionFilter("OUTBOUND")}
              >
                <Send className="h-4 w-4 mr-1" />
                Sent
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages ({filteredMessages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredMessages && filteredMessages.length > 0 ? (
            <div className="space-y-3">
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/appointments/${msg.appointmentId}`)}
                >
                  <div
                    className={`p-2 rounded-full ${
                      msg.direction === "INBOUND"
                        ? "bg-green-100 text-green-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {msg.direction === "INBOUND" ? (
                      <Inbox className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {msg.appointment?.patient
                          ? `${msg.appointment.patient.firstName} ${msg.appointment.patient.lastName}`
                          : "Unknown Patient"}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatPhoneNumber(msg.phoneNumber)}
                      </span>
                      <StatusBadge status={msg.status} />
                    </div>
                    <p className="text-gray-600 truncate">{msg.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateTime(msg.createdAt)}
                    </p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No messages found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: SMSMessage["status"] }) {
  const config: Record<typeof status, { label: string; variant: "default" | "success" | "destructive" | "secondary" }> = {
    SENT: { label: "Sent", variant: "secondary" },
    DELIVERED: { label: "Delivered", variant: "success" },
    FAILED: { label: "Failed", variant: "destructive" },
    RECEIVED: { label: "Received", variant: "default" },
  };

  const cfg = config[status];
  return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
}
