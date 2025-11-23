import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import { MessageSquare, Check, CheckCheck, AlertCircle, Loader2 } from "lucide-react";

interface SMSMessage {
  id: string;
  message: string;
  direction: "OUTBOUND" | "INBOUND";
  status: "SENT" | "DELIVERED" | "FAILED" | "RECEIVED" | "READ";
  createdAt: string;
  twilioSid?: string;
}

interface SMSTimelineProps {
  messages: SMSMessage[];
  patientName?: string;
  showTypingIndicator?: boolean;
}

export function SMSTimeline({
  messages,
  patientName = "Patient",
  showTypingIndicator = false
}: SMSTimelineProps) {
  const [typing, setTyping] = useState(showTypingIndicator);

  // Auto-hide typing indicator after 30 seconds
  useEffect(() => {
    if (showTypingIndicator) {
      setTyping(true);
      const timer = setTimeout(() => setTyping(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [showTypingIndicator]);

  // Show typing indicator when last message is outbound
  const lastMessage = messages[0];
  const shouldShowTyping = typing || (
    lastMessage?.direction === "OUTBOUND" &&
    lastMessage?.status === "DELIVERED" &&
    // Only show for recent messages (within last 5 minutes)
    new Date().getTime() - new Date(lastMessage.createdAt).getTime() < 300000
  );

  if (!messages || messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No messages yet</p>
        <p className="text-xs mt-1">Send a ride offer to start the conversation</p>
      </div>
    );
  }

  // Reverse messages for chronological display (oldest first at top)
  const sortedMessages = [...messages].reverse();

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
      {sortedMessages.map((msg, index) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          patientName={patientName}
          isLatest={index === sortedMessages.length - 1}
        />
      ))}

      {/* Typing indicator */}
      {shouldShowTyping && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-2">{patientName} is typing</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  patientName,
  isLatest
}: {
  message: SMSMessage;
  patientName: string;
  isLatest: boolean;
}) {
  const isOutbound = message.direction === "OUTBOUND";

  return (
    <div
      className={cn(
        "flex",
        isOutbound ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-300",
          isOutbound
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-gray-100 text-gray-900 rounded-bl-md",
          isLatest && "ring-2 ring-blue-200 ring-opacity-50"
        )}
      >
        {/* Header with sender and time */}
        <div className={cn(
          "flex items-center gap-2 mb-1",
          isOutbound ? "text-blue-100" : "text-gray-500"
        )}>
          <span className="text-xs font-medium">
            {isOutbound ? "RideKeeper" : patientName}
          </span>
          <span className="text-xs opacity-75">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.message}</p>

        {/* Delivery status for outbound messages */}
        {isOutbound && (
          <div className="flex justify-end items-center gap-1 mt-1.5">
            <DeliveryStatus status={message.status} />
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryStatus({ status }: { status: SMSMessage["status"] }) {
  switch (status) {
    case "READ":
      return (
        <span className="flex items-center gap-1 text-xs text-blue-200">
          <CheckCheck className="h-3.5 w-3.5" />
          <span>Read</span>
        </span>
      );
    case "DELIVERED":
      return (
        <span className="flex items-center gap-1 text-xs text-blue-200">
          <CheckCheck className="h-3.5 w-3.5" />
          <span>Delivered</span>
        </span>
      );
    case "SENT":
      return (
        <span className="flex items-center gap-1 text-xs text-blue-200 opacity-75">
          <Check className="h-3.5 w-3.5" />
          <span>Sent</span>
        </span>
      );
    case "FAILED":
      return (
        <span className="flex items-center gap-1 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Failed</span>
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-blue-200 opacity-50">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Sending...</span>
        </span>
      );
  }
}

// Compact version for dashboard
export function SMSTimelineCompact({ messages }: { messages: SMSMessage[] }) {
  const lastMessages = messages.slice(0, 3);

  return (
    <div className="space-y-2">
      {lastMessages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "text-xs p-2 rounded-lg",
            msg.direction === "OUTBOUND"
              ? "bg-blue-50 border-l-2 border-blue-500"
              : "bg-gray-50 border-l-2 border-gray-400"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">
              {msg.direction === "OUTBOUND" ? "Sent" : "Received"}
            </span>
            <span className="text-gray-500">{formatTime(msg.createdAt)}</span>
          </div>
          <p className="text-gray-600 truncate">{msg.message}</p>
        </div>
      ))}
      {messages.length > 3 && (
        <p className="text-xs text-center text-gray-500">
          +{messages.length - 3} more messages
        </p>
      )}
    </div>
  );
}
