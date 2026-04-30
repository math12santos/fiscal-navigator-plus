import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { getConfig, upsertConfig } from "../services/configService";

export function useJuridicoConfig() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const get = useQuery({
    queryKey: ["juridico_config", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: () => getConfig(currentOrg!.id),
  });

  const upsert = useMutation({
    mutationFn: (input: any) => upsertConfig(currentOrg!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico_config"] });
      toast.success("Configuração salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return { get, upsert };
}
