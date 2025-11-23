import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  iconColor?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  iconColor = "text-primary",
  loading = false,
}: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            ) : (
              <p className="text-3xl font-bold">{value}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                {trend > 0 ? (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                ) : trend < 0 ? (
                  <TrendingDown className="h-3 w-3 text-green-500" />
                ) : null}
                <span
                  className={cn(
                    trend > 0
                      ? "text-red-500"
                      : trend < 0
                      ? "text-green-500"
                      : "text-gray-500"
                  )}
                >
                  {trend > 0 ? "+" : ""}
                  {trend}% {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "p-3 rounded-full bg-primary/10",
              iconColor === "text-red-500" && "bg-red-50",
              iconColor === "text-green-500" && "bg-green-50",
              iconColor === "text-yellow-500" && "bg-yellow-50"
            )}
          >
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
