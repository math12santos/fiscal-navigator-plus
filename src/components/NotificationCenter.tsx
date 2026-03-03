import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, type Notification } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const priorityColors: Record<string, string> = {
  urgente: "border-l-destructive",
  alta: "border-l-destructive",
  media: "border-l-warning",
  baixa: "border-l-muted-foreground",
};

export function NotificationCenter() {
  const { data: notifications = [], unreadCount } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead.mutate(n.id);
    if (n.reference_type === "request") {
      navigate("/tarefas");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Notificações</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllAsRead.mutate()}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors border-l-2",
                  priorityColors[n.priority] ?? "border-l-transparent",
                  !n.read && "bg-primary/5"
                )}
                onClick={() => handleClick(n)}
              >
                <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
