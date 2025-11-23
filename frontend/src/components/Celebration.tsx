import { useEffect } from "react";
import Confetti from "react-confetti";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, DollarSign } from "lucide-react";

export function Celebration() {
  const { showCelebration, celebrationMessage, hideCelebration } = useAppStore();

  useEffect(() => {
    if (showCelebration) {
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        hideCelebration();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showCelebration, hideCelebration]);

  if (!showCelebration) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Confetti */}
      <Confetti
        width={window.innerWidth}
        height={window.innerHeight}
        recycle={false}
        numberOfPieces={500}
        gravity={0.2}
      />

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={hideCelebration}
      />

      {/* Content */}
      <div className="relative bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-4 right-4"
          onClick={hideCelebration}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>

          <h2 className="text-2xl font-bold mb-2">Success!</h2>
          <p className="text-lg text-gray-600 mb-6">{celebrationMessage}</p>

          {/* ROI highlight */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-green-700 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="font-semibold">Estimated Savings</span>
            </div>
            <div className="text-3xl font-bold text-green-600">$150+</div>
            <p className="text-sm text-green-600/75">
              Average cost of a missed appointment prevented
            </p>
          </div>

          <div className="text-sm text-gray-500 mb-4">
            Uber Health provides an 18:1 ROI on transportation assistance
          </div>

          <Button onClick={hideCelebration} className="w-full">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
