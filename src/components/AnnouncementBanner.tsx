import { Info, AlertTriangle, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useActiveAnnouncements, dismissAnnouncement } from "@/hooks/useAnnouncements";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const SEVERITY: Record<string, { icon: any; bg: string; border: string; text: string }> = {
  info: { icon: Info, bg: "bg-primary/10", border: "border-primary/30", text: "text-primary" },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-500",
  },
  warning: { icon: AlertTriangle, bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500" },
  critical: {
    icon: AlertCircle,
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    text: "text-destructive",
  },
};

/**
 * Banner exibido no topo do app principal mostrando anúncios ativos
 * direcionados ao cliente atual. Persiste a dispensa em localStorage.
 */
export function AnnouncementBanner() {
  const { data: list = [] } = useActiveAnnouncements();
  const qc = useQueryClient();

  if (list.length === 0) return null;

  return (
    <div className="space-y-2 px-4 lg:px-6 pt-3">
      {list.map((a) => {
        const meta = SEVERITY[a.severity] ?? SEVERITY.info;
        const Icon = meta.icon;
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded-lg border ${meta.border} ${meta.bg} p-3`}
            role="status"
          >
            <Icon size={18} className={`${meta.text} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground">{a.title}</p>
              {a.body && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{a.body}</p>}
              {a.cta_label && a.cta_url && (
                <a
                  href={a.cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-block mt-2 text-xs font-medium ${meta.text} hover:underline`}
                >
                  {a.cta_label} →
                </a>
              )}
            </div>
            {a.dismissible && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => {
                  dismissAnnouncement(a.id);
                  qc.invalidateQueries({ queryKey: ["platform_announcements", "active"] });
                }}
                title="Dispensar"
              >
                <X size={14} />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
