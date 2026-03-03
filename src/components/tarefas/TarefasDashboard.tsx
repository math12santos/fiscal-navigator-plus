import { useMemo } from "react";
import { KPICard } from "@/components/KPICard";
import { useRequests } from "@/hooks/useRequests";
import { AlertCircle, Clock, CheckCircle, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent))",
];

export function TarefasDashboard() {
  const { data: requests = [] } = useRequests();

  const stats = useMemo(() => {
    const now = new Date();
    const open = requests.filter((r) => !["concluida", "rejeitada"].includes(r.status)).length;
    const overdue = requests.filter(
      (r) => r.due_date && new Date(r.due_date) < now && !["concluida", "rejeitada"].includes(r.status)
    ).length;
    const completed = requests.filter((r) => r.status === "concluida").length;
    const total = requests.length;

    // By type
    const byType: Record<string, number> = {};
    requests.forEach((r) => {
      byType[r.type] = (byType[r.type] || 0) + 1;
    });
    const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));

    // By status
    const byStatus: Record<string, number> = {};
    requests.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });
    const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

    return { open, overdue, completed, total, typeData, statusData };
  }, [requests]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Abertas" value={String(stats.open)} icon={<Clock size={18} />} />
        <KPICard title="Atrasadas" value={String(stats.overdue)} icon={<AlertCircle size={18} />} />
        <KPICard title="Concluídas" value={String(stats.completed)} icon={<CheckCircle size={18} />} />
        <KPICard title="Total" value={String(stats.total)} icon={<BarChart3 size={18} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Por Tipo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.typeData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Status */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Por Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {stats.statusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
