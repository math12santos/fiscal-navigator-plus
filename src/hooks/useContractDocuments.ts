import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

export interface ContractDocument {
  id: string;
  contract_id: string;
  file_name: string;
  file_url: string;
  file_path?: string;
  file_type: string;
  version: number;
  observacao: string | null;
  created_at: string;
}

export function useContractDocuments(contractId?: string) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const query = useQuery({
    queryKey: ["contract_documents", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_documents" as any)
        .select("*")
        .eq("contract_id", contractId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const docs = data as unknown as ContractDocument[];
      // Generate signed URLs for each document
      const docsWithSignedUrls = await Promise.all(
        docs.map(async (doc) => {
          const filePath = doc.file_path || doc.file_url;
          // Extract storage path from full URL if needed
          const storagePath = filePath.includes("/storage/v1/object/public/contract-documents/")
            ? filePath.split("/storage/v1/object/public/contract-documents/")[1]
            : filePath.includes("/storage/v1/object/sign/contract-documents/")
            ? filePath.split("/storage/v1/object/sign/contract-documents/")[1]?.split("?")[0]
            : filePath;
          const { data: signedData } = await supabase.storage
            .from("contract-documents")
            .createSignedUrl(storagePath, 3600); // 1 hour expiry
          return {
            ...doc,
            file_url: signedData?.signedUrl || doc.file_url,
          };
        })
      );
      return docsWithSignedUrls;
    },
    enabled: !!user && !!contractId,
  });

  const upload = useMutation({
    mutationFn: async ({ file, fileType, observacao }: { file: File; fileType: string; observacao?: string }) => {
      if (!contractId || !orgId) throw new Error("Contrato ou organização não selecionada");
      const path = `${orgId}/${contractId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("contract-documents").upload(path, file);
      if (uploadErr) throw uploadErr;
      const currentDocs = query.data ?? [];
      const version = currentDocs.filter((d) => d.file_type === fileType).length + 1;
      const { error } = await supabase.from("contract_documents" as any).insert({
        contract_id: contractId,
        organization_id: orgId,
        user_id: user!.id,
        file_name: file.name,
        file_url: path, // Store the storage path, not a public URL
        file_type: fileType,
        version,
        observacao: observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_documents", contractId] });
      toast({ title: "Documento enviado" });
    },
    onError: (e: any) => toast({ title: "Erro no upload", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_documents" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_documents", contractId] });
      toast({ title: "Documento removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { documents: query.data ?? [], isLoading: query.isLoading, upload, remove };
}
