import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import OnboardingPassword from "@/pages/OnboardingPassword";
import CreateOrganization from "@/pages/CreateOrganization";
import OnboardingModules from "@/pages/OnboardingModules";
import { Loader2 } from "lucide-react";

type Step = "loading" | "password" | "company" | "modules" | "done";

export default function Onboarding() {
  const { user } = useAuth();
  const { organizations, currentOrg, loading: orgLoading, refetch } = useOrganization();
  const [step, setStep] = useState<Step>("loading");
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);

  // Check if user must change password
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMustChangePassword((data as any)?.must_change_password ?? false);
      });
  }, [user]);

  // Determine current step
  useEffect(() => {
    if (mustChangePassword === null || orgLoading) {
      setStep("loading");
      return;
    }

    if (mustChangePassword) {
      setStep("password");
      return;
    }

    if (organizations.length === 0) {
      setStep("company");
      return;
    }

    // Check if current org has completed onboarding
    const org = currentOrg || organizations[0];
    if (org && !(org as any).onboarding_completed) {
      setStep("modules");
      return;
    }

    setStep("done");
  }, [mustChangePassword, organizations, currentOrg, orgLoading]);

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === "password") {
    return (
      <OnboardingPassword
        onComplete={() => setMustChangePassword(false)}
      />
    );
  }

  if (step === "company") {
    return <CreateOrganization />;
  }

  if (step === "modules") {
    const org = currentOrg || organizations[0];
    return (
      <OnboardingModules
        organizationId={org.id}
        onComplete={async () => {
          await refetch();
          setStep("done");
        }}
      />
    );
  }

  // step === "done" — this should not render, parent route handles redirect
  return null;
}
