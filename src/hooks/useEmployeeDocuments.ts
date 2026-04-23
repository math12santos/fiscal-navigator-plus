import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export const DOC_TYPES = [
  { value: "contrato", label: "Contrato de Trabalho" },
  { value: "rg", label: "RG" },
  { value: "cpf", label: "CPF" },
  { value: "ctps", label: "CTPS" },
  { value: "exame_admissional", label: "Exame Admissional" },
  { value: "exame_periodico", label: "Exame Periódico" },
  { value: "aso", label: "ASO" },
  { value: "comprovante_endereco", label: "Comprovante de Endereço" },
  { value: "outros", label: "Outros" },
] as const;

export type DocType = (typeof DOC_TYPES)[number]["value"];

export interface EmployeeDocument {
  id: string;
  organization_id: string;
  employee_id: string;
  user_id: string;
  doc_type: DocType;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

export function useEmployeeDocuments(employeeId?: string) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["employee_documents", currentOrg?.id, employeeId],
    queryFn: async () => {
      let q = (supabase.from as any)("employee_documents")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EmployeeDocument[];
    },
    enabled: !!currentOrg?.id,
  });
}

/** Lista documentos com vencimento próximo (em N dias) — usado nos alertas. */
export function useExpiringDocuments(days = 60) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["employee_documents_expiring", currentOrg?.id, days],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const { data, error } = await (supabase.from as any)("employee_documents")
        .select("*, employees!inner(name)")
        .eq("organization_id", currentOrg!.id)
        .not("expires_at", "is", null)
        .lte("expires_at", limit)
        .gte("expires_at", "1900-01-01")
        .order("expires_at");
      if (error) throw error;
      return (data ?? []).filter((d: any) => d.expires_at && d.expires_at >= "1900-01-01");
    },
    enabled: !!currentOrg?.id,
  });
}

export function useUploadEmployeeDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  return useMutation({
    mutationFn: async (params: {
      employeeId: string;
      file: File;
      docType: DocType;
      expiresAt?: string | null;
      notes?: string | null;
    }) => {
      const orgId = currentOrg!.id;
      const cleanName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/${params.employeeId}/${Date.now()}_${cleanName}`;

      const { error: upErr } = await supabase.storage
        .from("employee-documents")
        .upload(path, params.file, { upsert: false, contentType: params.file.type });
      if (upErr) throw upErr;

      const { error: insErr } = await (supabase.from as any)("employee_documents").insert({
        organization_id: orgId,
        employee_id: params.employeeId,
        user_id: user!.id,
        doc_type: params.docType,
        file_name: params.file.name,
        file_path: path,
        file_size: params.file.size,
        mime_type: params.file.type || null,
        expires_at: params.expiresAt || null,
        notes: params.notes || null,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee_documents"] });
      qc.invalidateQueries({ queryKey: ["employee_documents_expiring"] });
    },
  });
}

export function useDeleteEmployeeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      await supabase.storage.from("employee-documents").remove([doc.file_path]);
      const { error } = await (supabase.from as any)("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee_documents"] });
      qc.invalidateQueries({ queryKey: ["employee_documents_expiring"] });
    },
  });
}

/** Gera URL assinada (60s) para download privado. */
export async function getSignedDocumentUrl(filePath: string, expiresInSec = 60) {
  const { data, error } = await supabase.storage
    .from("employee-documents")
    .createSignedUrl(filePath, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
