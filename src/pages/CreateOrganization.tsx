import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2 } from "lucide-react";

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  if (rest !== parseInt(digits[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  return rest === parseInt(digits[13]);
}

export default function CreateOrganization() {
  const { user } = useAuth();
  const { refetch } = useOrganization();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<"CPF" | "CNPJ">("CNPJ");
  const [docNumber, setDocNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const rawDoc = docNumber.replace(/\D/g, "");
  const isValidDoc = docType === "CPF" ? validateCPF(rawDoc) : validateCNPJ(rawDoc);
  const canSubmit = name.trim().length >= 2 && isValidDoc;

  const handleDocChange = (value: string) => {
    setDocNumber(docType === "CPF" ? formatCPF(value) : formatCNPJ(value));
  };

  const handleDocTypeChange = (value: string) => {
    setDocType(value as "CPF" | "CNPJ");
    setDocNumber("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmit) return;

    setLoading(true);
    try {
      // Create organization
      const { data: org, error: orgErr } = await supabase
        .from("organizations" as any)
        .insert({
          name: name.trim(),
          document_type: docType,
          document_number: rawDoc,
          created_by: user.id,
        })
        .select()
        .single();

      if (orgErr) {
        if (orgErr.message.includes("duplicate") || orgErr.message.includes("unique")) {
          toast({ title: "Documento já cadastrado", description: "Já existe uma empresa com este CPF/CNPJ.", variant: "destructive" });
          return;
        }
        throw orgErr;
      }

      const orgData = org as any;

      // Add user as owner
      const { error: memErr } = await supabase
        .from("organization_members" as any)
        .insert({
          organization_id: orgData.id,
          user_id: user.id,
          role: "owner",
        });

      if (memErr) throw memErr;

      toast({ title: "Empresa criada com sucesso!" });
      await refetch();
    } catch (err: any) {
      toast({ title: "Erro ao criar empresa", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Cadastrar Empresa</h1>
          <p className="text-sm text-muted-foreground">
            Crie uma empresa para começar a usar o FinCore
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Nome da Empresa *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Razão Social ou Nome Fantasia"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-3">
            <Label>Tipo de Documento *</Label>
            <RadioGroup value={docType} onValueChange={handleDocTypeChange} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CNPJ" id="cnpj" />
                <Label htmlFor="cnpj" className="cursor-pointer font-normal">CNPJ</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CPF" id="cpf" />
                <Label htmlFor="cpf" className="cursor-pointer font-normal">CPF</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>{docType} *</Label>
            <Input
              value={docNumber}
              onChange={(e) => handleDocChange(e.target.value)}
              placeholder={docType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
              required
            />
            {docNumber && !isValidDoc && (
              <p className="text-xs text-destructive">{docType} inválido</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar Empresa"}
          </Button>
        </form>
      </div>
    </div>
  );
}
