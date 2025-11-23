import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dashboard } from "./pages/Dashboard";
import { AppointmentDetail } from "./pages/AppointmentDetail";
import { Messages } from "./pages/Messages";
import { DemoBanner } from "./components/DemoBanner";
import { Celebration } from "./components/Celebration";
import { ToastContainer } from "./components/ToastContainer";
import { useAppStore } from "./stores/appStore";
import { cn } from "./lib/utils";
import {
  Car,
  Calendar,
  MessageSquare,
  LayoutDashboard,
  Settings,
} from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
    },
  },
});

function Navigation() {
  const location = useLocation();
  const { presentationMode } = useAppStore();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/messages", icon: MessageSquare, label: "Messages" },
  ];

  return (
    <nav
      className={cn(
        "fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col z-40",
        presentationMode && "hidden"
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center">
            <Car className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900">RideKeeper</h1>
            <p className="text-xs text-gray-500">Claude Hackathon 2025</p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="text-xs text-gray-400 text-center">
          <p>RideKeeper v1.0</p>
          <p>Claude Hackathon 2025</p>
        </div>
      </div>
    </nav>
  );
}

function AppLayout() {
  const { presentationMode } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <DemoBanner />
      <Navigation />
      <main
        className={cn(
          "transition-all",
          presentationMode ? "ml-0" : "ml-64"
        )}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/appointments/:id" element={<AppointmentDetail />} />
          <Route path="/messages" element={<Messages />} />
        </Routes>
      </main>
      <Celebration />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
