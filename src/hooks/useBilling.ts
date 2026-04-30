import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ===== Types =====
export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  trial_days: number;
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
  limits: Record<string, any>;
  modules: string[];
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "paused";
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  paused_at: string | null;
  seats: number;
  custom_price: number | null;
  discount_pct: number;
  payment_method: "manual" | "pix" | "boleto" | "card" | "stripe" | "paddle";
  external_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  number: string;
  period_start: string;
  period_end: string;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  amount: number;
  status: "draft" | "open" | "paid" | "overdue" | "void";
  pdf_url: string | null;
  payment_link: string | null;
  notes: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  kind: "subscription" | "addon" | "credit" | "discount" | "adjustment" | "overage";
  quantity: number;
  unit_price: number;
  amount: number;
}

// ===== Plans =====
export function useBillingPlans() {
  return useQuery({
    queryKey: ["billing_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_plans" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BillingPlan[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<BillingPlan> & { id?: string }) => {
      if (plan.id) {
        const { id, created_at, updated_at, ...patch } = plan as any;
        const { error } = await supabase.from("billing_plans" as any).update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("billing_plans" as any).insert(plan as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing_plans"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("billing_plans" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing_plans"] }),
  });
}

// ===== Subscriptions =====
export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Subscription[];
    },
  });
}

export function useSaveSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sub: Partial<Subscription> & { id?: string }) => {
      if (sub.id) {
        const { id, created_at, updated_at, ...patch } = sub as any;
        const { error } = await supabase.from("subscriptions" as any).update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscriptions" as any).insert(sub as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["saas_kpis"] });
    },
  });
}

// ===== Invoices =====
export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices" as any)
        .select("*")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Invoice[];
    },
  });
}

export function useInvoiceItems(invoiceId: string | null) {
  return useQuery({
    queryKey: ["invoice_items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items" as any)
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceItem[];
    },
  });
}

export function useSaveInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      invoice: Partial<Invoice> & { id?: string };
      items?: Array<Partial<InvoiceItem>>;
    }) => {
      const { invoice, items } = payload;
      let invoiceId = invoice.id;
      if (invoiceId) {
        const { id, ...patch } = invoice as any;
        const { error } = await supabase.from("invoices" as any).update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("invoices" as any)
          .insert(invoice as any)
          .select("id")
          .single();
        if (error) throw error;
        invoiceId = (data as any).id;
      }
      if (items && invoiceId) {
        await supabase.from("invoice_items" as any).delete().eq("invoice_id", invoiceId);
        if (items.length > 0) {
          const rows = items.map((it) => ({ ...it, invoice_id: invoiceId }));
          const { error } = await supabase.from("invoice_items" as any).insert(rows as any);
          if (error) throw error;
        }
      }
      return invoiceId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice_items"] });
      qc.invalidateQueries({ queryKey: ["saas_kpis"] });
    },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices" as any)
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["saas_kpis"] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

// ===== Helpers =====
export function computeMRR(subs: Subscription[], plans: BillingPlan[]): number {
  const planMap = new Map(plans.map((p) => [p.id, p]));
  let mrr = 0;
  for (const s of subs) {
    if (s.status !== "active" && s.status !== "trialing") continue;
    const p = planMap.get(s.plan_id);
    if (!p) continue;
    const base = s.custom_price ?? (s.billing_cycle === "yearly" ? p.price_yearly / 12 : p.price_monthly);
    mrr += base * (1 - (s.discount_pct ?? 0) / 100);
  }
  return mrr;
}

export function generateInvoiceNumber(): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `INV-${ym}-${rnd}`;
}
