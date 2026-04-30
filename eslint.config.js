import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // ────────────────────────────────────────────────────────────────────────
  // Arquitetura modular — Fase 1 (warnings; promover a "error" na Fase 5).
  // Ver docs/architecture.md.
  // ────────────────────────────────────────────────────────────────────────
  {
    files: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message:
                "UI não deve falar com o Supabase diretamente. Use um hook de @/modules/<modulo> ou crie um service. Ver docs/architecture.md.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/integrations/supabase/*", "react", "@tanstack/react-query", "sonner"],
              message:
                "domain/ deve ser puro: sem Supabase, sem React, sem React Query, sem toast.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["react", "@tanstack/react-query", "sonner"],
              message: "services/ devem ser puros: sem React, sem React Query, sem toast.",
            },
          ],
        },
      ],
    },
  },
);
