import { Heart } from "lucide-react";
import { healthTone } from "@/hooks/useHealthScore";

interface Props {
  score: number | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function HealthScoreBadge({ score, size = "sm", showLabel = true }: Props) {
  const tone = healthTone(score ?? null);
  const dim = size === "md" ? "text-sm px-2.5 py-1" : "text-xs px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${tone.bg} ${tone.cls} font-medium ${dim}`}
      title={`Health score: ${score ?? "—"}/100`}
    >
      <Heart size={size === "md" ? 12 : 10} />
      <span className="tabular-nums">{score ?? "—"}</span>
      {showLabel && size === "md" && <span className="hidden sm:inline">{tone.label}</span>}
    </span>
  );
}
