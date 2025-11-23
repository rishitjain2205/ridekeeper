import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { dashboardApi, schedulerApi } from "@/lib/api";
import {
  Beaker,
  FastForward,
  RefreshCw,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";

export function DemoBanner() {
  const { demoMode, presentationMode, toggleDemoMode, togglePresentationMode, addToast } =
    useAppStore();

  const handleReset = async () => {
    try {
      await dashboardApi.resetDemo();
      addToast({
        title: "Demo Reset",
        description: "All data has been reset to initial state",
        type: "success",
      });
      window.location.reload();
    } catch {
      addToast({
        title: "Reset Failed",
        description: "Could not reset demo data",
        type: "error",
      });
    }
  };

  const handleTriggerRiskScores = async () => {
    try {
      await schedulerApi.triggerRiskScores();
      addToast({
        title: "Risk Scores Updated",
        description: "All appointment risk scores recalculated",
        type: "success",
      });
    } catch {
      addToast({
        title: "Failed",
        description: "Could not update risk scores",
        type: "error",
      });
    }
  };

  if (!demoMode) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 px-4 demo-pulse">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beaker className="h-4 w-4" />
          <span className="font-medium">DEMO MODE</span>
          <span className="text-white/75 text-sm">
            - Press D to toggle, P for presentation mode
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={handleTriggerRiskScores}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Calculate Risks
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={handleReset}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reset Demo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={togglePresentationMode}
          >
            {presentationMode ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={toggleDemoMode}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
