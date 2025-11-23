import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { getRiskCategory } from "@/lib/utils";

interface RiskBadgeProps {
  score: number | null;
  showScore?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ score, showScore = true, size = "md" }: RiskBadgeProps) {
  const category = getRiskCategory(score);

  const getVariant = () => {
    if (score === null) return "secondary";
    if (score >= 61) return "risk-high" as const;
    if (score >= 31) return "risk-medium" as const;
    return "risk-low" as const;
  };

  const getIcon = () => {
    if (score === null) return null;
    const iconClass = size === "sm" ? "h-3 w-3" : "h-4 w-4";
    if (score >= 61) return <AlertTriangle className={iconClass} />;
    if (score >= 31) return <AlertCircle className={iconClass} />;
    return <CheckCircle className={iconClass} />;
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <Badge variant={getVariant()} className={sizeClasses[size]}>
      <span className="flex items-center gap-1">
        {getIcon()}
        {category}
        {showScore && score !== null && (
          <span className="opacity-75">({score})</span>
        )}
      </span>
    </Badge>
  );
}
