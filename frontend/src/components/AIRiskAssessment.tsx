import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appointmentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Brain,
  Loader2,
  RefreshCw,
  Lightbulb,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Target,
  BarChart3,
  Zap,
} from "lucide-react";

interface AIRiskAssessmentProps {
  appointmentId: string;
  baseScore: number | null;
  aiScore?: number | null;
  aiConfidence?: number | null;
  aiReasoning?: string | null;
  aiRecommendations?: string | null;
  onUpdate?: () => void;
}

export function AIRiskAssessment({
  appointmentId,
  baseScore,
  aiScore: initialAIScore,
  aiConfidence: initialConfidence,
  aiReasoning: initialReasoning,
  aiRecommendations: initialRecommendations,
  onUpdate,
}: AIRiskAssessmentProps) {
  const [loading, setLoading] = useState(false);
  const [aiScore, setAIScore] = useState<number | null>(initialAIScore ?? null);
  const [confidence, setConfidence] = useState<number | null>(initialConfidence ?? null);
  const [reasoning, setReasoning] = useState<string | null>(initialReasoning ?? null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [optimalContactTime, setOptimalContactTime] = useState<string | null>(null);
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [aiAvailable, setAIAvailable] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Parse initial recommendations if they're a JSON string
    if (initialRecommendations) {
      try {
        const parsed = typeof initialRecommendations === 'string'
          ? JSON.parse(initialRecommendations)
          : initialRecommendations;
        setRecommendations(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRecommendations([]);
      }
    }
    // Auto-expand if we have AI data
    if (initialAIScore !== null && initialAIScore !== undefined) {
      setIsExpanded(true);
    }
  }, [initialRecommendations, initialAIScore]);

  const calculateAIRisk = async () => {
    setLoading(true);
    try {
      const result = await appointmentsApi.calculateAIRisk(appointmentId);
      if (result.success && result.data) {
        const data = result.data as any;
        setAIScore(data.finalScore ?? data.aiAssessment?.adjustedScore);
        setConfidence(data.aiAssessment?.confidence ?? null);
        setReasoning(data.aiAssessment?.reasoning ?? null);
        setRecommendations(data.aiAssessment?.recommendations ?? []);
        setOptimalContactTime(data.aiAssessment?.optimalContactTime ?? null);
        setRiskFactors(data.aiAssessment?.riskFactors ?? []);
        setIsExpanded(true);
        onUpdate?.();
      }
    } catch (error) {
      console.error("Failed to calculate AI risk:", error);
      setAIAvailable(false);
    }
    setLoading(false);
  };

  const hasAIData = aiScore !== null;
  const scoreDiff = hasAIData && baseScore !== null ? aiScore - baseScore : 0;

  // Determine risk category
  const getRiskCategory = (score: number) => {
    if (score >= 61) return { label: "High", color: "text-red-600", bgColor: "bg-red-100" };
    if (score >= 31) return { label: "Medium", color: "text-yellow-600", bgColor: "bg-yellow-100" };
    return { label: "Low", color: "text-green-600", bgColor: "bg-green-100" };
  };

  const riskCategory = aiScore ? getRiskCategory(aiScore) : null;

  return (
    <Card className={cn(
      "border-purple-200 bg-gradient-to-br from-purple-50/50 to-white overflow-hidden transition-all duration-500",
      isExpanded && "shadow-lg shadow-purple-100"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <span>AI Risk Assessment</span>
            {hasAIData && (
              <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
            )}
          </span>
          {hasAIData && confidence !== null && (
            <ConfidenceBadge confidence={confidence} />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAIData ? (
          // No AI data yet - show calculate button
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-gray-600 mb-2 font-medium">
              {aiAvailable
                ? "Unlock AI-Powered Insights"
                : "AI scoring is currently unavailable"}
            </p>
            <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto">
              Get intelligent risk analysis based on patient history, communication patterns, and behavioral signals
            </p>
            <Button
              onClick={calculateAIRisk}
              disabled={loading || !aiAvailable}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Calculate AI Risk Score
                </>
              )}
            </Button>
          </div>
        ) : (
          // Show AI results
          <>
            {/* Score Comparison - Prominent Display */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-purple-100 shadow-sm">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rules-Based</p>
                <p className="text-3xl font-bold text-gray-600">{baseScore ?? "-"}</p>
                <p className="text-xs text-gray-400">base score</p>
              </div>
              <div className="text-center border-x border-purple-100">
                <p className="text-xs text-purple-600 uppercase tracking-wide mb-1 font-semibold">AI Adjusted</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-3xl font-bold text-purple-600">{aiScore}</p>
                  {riskCategory && (
                    <Badge className={cn(riskCategory.bgColor, riskCategory.color, "border-0 text-xs")}>
                      {riskCategory.label}
                    </Badge>
                  )}
                </div>
                {scoreDiff !== 0 && (
                  <span
                    className={cn(
                      "text-sm font-medium flex items-center justify-center gap-1 mt-1",
                      scoreDiff > 0 ? "text-red-500" : "text-green-500"
                    )}
                  >
                    {scoreDiff > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {scoreDiff > 0 ? "+" : ""}{scoreDiff} from base
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Confidence</p>
                <p className="text-3xl font-bold text-gray-700">{confidence}%</p>
                <p className="text-xs text-gray-400">AI certainty</p>
              </div>
            </div>

            {/* Confidence Progress Bar */}
            {confidence !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    AI Confidence Level
                  </span>
                  <span className={cn(
                    "font-semibold",
                    confidence >= 80 ? "text-green-600" :
                    confidence >= 50 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {confidence >= 80 ? "High" : confidence >= 50 ? "Medium" : "Low"} Confidence
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-1000 ease-out rounded-full",
                      confidence >= 80
                        ? "bg-gradient-to-r from-green-400 to-green-500"
                        : confidence >= 50
                        ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                        : "bg-gradient-to-r from-red-400 to-red-500"
                    )}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            )}

            {/* AI Reasoning - Highlighted Section */}
            {reasoning && (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                <p className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Analysis
                </p>
                <p className="text-sm text-purple-700 leading-relaxed">{reasoning}</p>
              </div>
            )}

            {/* Risk Factors - Visual Tags */}
            {riskFactors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Key Risk Factors
                </p>
                <div className="flex flex-wrap gap-2">
                  {riskFactors.map((factor, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-200 px-3 py-1"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {factor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendations - Action Items */}
            {recommendations.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  AI Recommendations
                </p>
                <ul className="space-y-2">
                  {recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-100"
                    >
                      <div className="p-1 bg-yellow-200 rounded-full mt-0.5">
                        <Zap className="h-3 w-3 text-yellow-700" />
                      </div>
                      <span className="text-sm text-yellow-800 flex-1">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Optimal Contact Time */}
            {optimalContactTime && (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">
                    Optimal Contact Time
                  </p>
                  <p className="text-sm text-blue-800 font-medium">{optimalContactTime}</p>
                </div>
              </div>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={calculateAIRisk}
              disabled={loading}
              className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recalculate AI Assessment
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  let variant: "default" | "success" | "warning" | "destructive" = "default";
  let label = "Low";
  let icon = null;

  if (confidence >= 80) {
    variant = "success";
    label = "High";
    icon = <Target className="h-3 w-3 mr-1" />;
  } else if (confidence >= 50) {
    variant = "warning";
    label = "Medium";
  } else {
    variant = "destructive";
    label = "Low";
  }

  return (
    <Badge variant={variant} className="text-xs flex items-center">
      {icon}
      {label} Confidence
    </Badge>
  );
}
