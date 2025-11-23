import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-3 p-4 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300",
            toast.type === "success" &&
              "bg-green-50 border-green-200 text-green-800",
            toast.type === "error" &&
              "bg-red-50 border-red-200 text-red-800",
            toast.type === "warning" &&
              "bg-yellow-50 border-yellow-200 text-yellow-800",
            toast.type === "default" && "bg-white border-gray-200 text-gray-800"
          )}
        >
          <ToastIcon type={toast.type} />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{toast.title}</p>
            {toast.description && (
              <p className="text-sm opacity-75 mt-0.5">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ToastIcon({ type }: { type: string }) {
  const iconClass = "h-5 w-5 flex-shrink-0";

  switch (type) {
    case "success":
      return <CheckCircle className={cn(iconClass, "text-green-600")} />;
    case "error":
      return <AlertCircle className={cn(iconClass, "text-red-600")} />;
    case "warning":
      return <AlertTriangle className={cn(iconClass, "text-yellow-600")} />;
    default:
      return <Info className={cn(iconClass, "text-blue-600")} />;
  }
}
