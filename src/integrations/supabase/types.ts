export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_type?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backoffice_organization_access: {
        Row: {
          created_at: string
          organization_id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backoffice_organization_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backoffice_organization_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "backoffice_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      backoffice_users: {
        Row: {
          created_at: string
          is_active: boolean
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          active: boolean | null
          agencia: string | null
          banco: string | null
          conta: string | null
          created_at: string | null
          id: string
          limite_atualizado_em: string | null
          limite_atualizado_por: string | null
          limite_credito: number | null
          limite_taxa_juros_mensal: number | null
          limite_tipo: string | null
          limite_utilizado: number | null
          limite_vencimento: string | null
          nome: string
          organization_id: string | null
          pix_key: string | null
          saldo_atual: number | null
          saldo_atualizado_em: string | null
          saldo_atualizado_por: string | null
          tipo_conta: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          created_at?: string | null
          id?: string
          limite_atualizado_em?: string | null
          limite_atualizado_por?: string | null
          limite_credito?: number | null
          limite_taxa_juros_mensal?: number | null
          limite_tipo?: string | null
          limite_utilizado?: number | null
          limite_vencimento?: string | null
          nome: string
          organization_id?: string | null
          pix_key?: string | null
          saldo_atual?: number | null
          saldo_atualizado_em?: string | null
          saldo_atualizado_por?: string | null
          tipo_conta?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          created_at?: string | null
          id?: string
          limite_atualizado_em?: string | null
          limite_atualizado_por?: string | null
          limite_credito?: number | null
          limite_taxa_juros_mensal?: number | null
          limite_tipo?: string | null
          limite_utilizado?: number | null
          limite_vencimento?: string | null
          nome?: string
          organization_id?: string | null
          pix_key?: string | null
          saldo_atual?: number | null
          saldo_atualizado_em?: string | null
          saldo_atualizado_por?: string | null
          tipo_conta?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_balance_snapshots: {
        Row: {
          bank_account_id: string
          created_at: string
          id: string
          organization_id: string
          saldo: number
          saldo_conciliado: number | null
          saldo_previsto: number | null
          snapshot_date: string
          source: string
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          id?: string
          organization_id: string
          saldo: number
          saldo_conciliado?: number | null
          saldo_previsto?: number | null
          snapshot_date: string
          source?: string
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          saldo?: number
          saldo_conciliado?: number | null
          saldo_previsto?: number | null
          snapshot_date?: string
          source?: string
        }
        Relationships: []
      }
      bank_statement_entries: {
        Row: {
          bank_account_id: string
          cashflow_entry_id: string | null
          created_at: string
          data: string
          descricao: string
          documento: string | null
          id: string
          import_id: string | null
          notes: string | null
          organization_id: string
          reconciled_at: string | null
          reconciled_by: string | null
          source_ref: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          bank_account_id: string
          cashflow_entry_id?: string | null
          created_at?: string
          data: string
          descricao: string
          documento?: string | null
          id?: string
          import_id?: string | null
          notes?: string | null
          organization_id: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          source_ref?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          bank_account_id?: string
          cashflow_entry_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          documento?: string | null
          id?: string
          import_id?: string | null
          notes?: string | null
          organization_id?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          source_ref?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_entries_cashflow_entry_id_fkey"
            columns: ["cashflow_entry_id"]
            isOneToOne: false
            referencedRelation: "cashflow_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_entries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          account_id: string | null
          budget_version_id: string
          cost_center_id: string | null
          created_at: string
          id: string
          month: string
          natureza: string
          notes: string | null
          organization_id: string | null
          tipo: string
          updated_at: string
          user_id: string
          valor_orcado: number
        }
        Insert: {
          account_id?: string | null
          budget_version_id: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          month: string
          natureza?: string
          notes?: string | null
          organization_id?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
          valor_orcado?: number
        }
        Update: {
          account_id?: string | null
          budget_version_id?: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          month?: string
          natureza?: string
          notes?: string | null
          organization_id?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_versions: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          name: string
          organization_id: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          organization_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          organization_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          cashflow_entry_id: string | null
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          cashflow_entry_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          cashflow_entry_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      cashflow_entries: {
        Row: {
          account_id: string | null
          acordo_id: string | null
          afeta_caixa_no_vencimento: boolean | null
          categoria: string | null
          competencia: string | null
          conciliacao_id: string | null
          conta_bancaria_id: string | null
          conta_contabil_ref: string | null
          contract_id: string | null
          contract_installment_id: string | null
          cost_center_id: string | null
          created_at: string
          data_prevista: string
          data_prevista_pagamento: string | null
          data_realizada: string | null
          data_vencimento: string | null
          dedup_hash: string | null
          descricao: string
          documento: string | null
          entity_id: string | null
          expense_request_id: string | null
          forma_pagamento: string | null
          id: string
          impacto_fluxo_caixa: boolean | null
          impacto_orcamento: boolean | null
          import_id: string | null
          natureza_contabil: string | null
          notes: string | null
          num_parcelas: number | null
          organization_id: string | null
          recorrencia: string | null
          source: string
          source_ref: string | null
          status: string
          subcategoria_id: string | null
          tipo: string
          tipo_despesa: string | null
          tipo_documento: string | null
          updated_at: string
          user_id: string
          valor_bruto: number | null
          valor_desconto: number | null
          valor_juros_multa: number | null
          valor_previsto: number
          valor_realizado: number | null
        }
        Insert: {
          account_id?: string | null
          acordo_id?: string | null
          afeta_caixa_no_vencimento?: boolean | null
          categoria?: string | null
          competencia?: string | null
          conciliacao_id?: string | null
          conta_bancaria_id?: string | null
          conta_contabil_ref?: string | null
          contract_id?: string | null
          contract_installment_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_prevista: string
          data_prevista_pagamento?: string | null
          data_realizada?: string | null
          data_vencimento?: string | null
          dedup_hash?: string | null
          descricao: string
          documento?: string | null
          entity_id?: string | null
          expense_request_id?: string | null
          forma_pagamento?: string | null
          id?: string
          impacto_fluxo_caixa?: boolean | null
          impacto_orcamento?: boolean | null
          import_id?: string | null
          natureza_contabil?: string | null
          notes?: string | null
          num_parcelas?: number | null
          organization_id?: string | null
          recorrencia?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          subcategoria_id?: string | null
          tipo?: string
          tipo_despesa?: string | null
          tipo_documento?: string | null
          updated_at?: string
          user_id: string
          valor_bruto?: number | null
          valor_desconto?: number | null
          valor_juros_multa?: number | null
          valor_previsto?: number
          valor_realizado?: number | null
        }
        Update: {
          account_id?: string | null
          acordo_id?: string | null
          afeta_caixa_no_vencimento?: boolean | null
          categoria?: string | null
          competencia?: string | null
          conciliacao_id?: string | null
          conta_bancaria_id?: string | null
          conta_contabil_ref?: string | null
          contract_id?: string | null
          contract_installment_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_prevista?: string
          data_prevista_pagamento?: string | null
          data_realizada?: string | null
          data_vencimento?: string | null
          dedup_hash?: string | null
          descricao?: string
          documento?: string | null
          entity_id?: string | null
          expense_request_id?: string | null
          forma_pagamento?: string | null
          id?: string
          impacto_fluxo_caixa?: boolean | null
          impacto_orcamento?: boolean | null
          import_id?: string | null
          natureza_contabil?: string | null
          notes?: string | null
          num_parcelas?: number | null
          organization_id?: string | null
          recorrencia?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          subcategoria_id?: string | null
          tipo?: string
          tipo_despesa?: string | null
          tipo_documento?: string | null
          updated_at?: string
          user_id?: string
          valor_bruto?: number | null
          valor_desconto?: number | null
          valor_juros_multa?: number | null
          valor_previsto?: number
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "supplier_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_contract_installment_id_fkey"
            columns: ["contract_installment_id"]
            isOneToOne: false
            referencedRelation: "contract_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_expense_request_id_fkey"
            columns: ["expense_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          accounting_class: string
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          is_synthetic: boolean
          is_system_default: boolean
          level: number
          name: string
          nature: string
          organization_id: string | null
          parent_id: string | null
          tags: string[] | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accounting_class?: string
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_synthetic?: boolean
          is_system_default?: boolean
          level?: number
          name: string
          nature?: string
          organization_id?: string | null
          parent_id?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accounting_class?: string
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_synthetic?: boolean
          is_system_default?: boolean
          level?: number
          name?: string
          nature?: string
          organization_id?: string | null
          parent_id?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_budget_lines: {
        Row: {
          beneficios: number | null
          category: string
          created_at: string
          description: string
          encargos_pct: number | null
          id: string
          notes: string | null
          organization_id: string | null
          plan_id: string
          quantidade: number | null
          subcategory: string | null
          updated_at: string
          user_id: string
          valor_mensal: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          beneficios?: number | null
          category?: string
          created_at?: string
          description: string
          encargos_pct?: number | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          plan_id: string
          quantidade?: number | null
          subcategory?: string | null
          updated_at?: string
          user_id: string
          valor_mensal?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          beneficios?: number | null
          category?: string
          created_at?: string
          description?: string
          encargos_pct?: number | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          plan_id?: string
          quantidade?: number | null
          subcategory?: string | null
          updated_at?: string
          user_id?: string
          valor_mensal?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_budget_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_budget_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_channels: {
        Row: {
          channel_type: string
          ciclo_medio_dias: number | null
          comissao_pct: number | null
          comissao_tipo: string
          comissao_valor_fixo: number | null
          conv_lead_oportunidade: number | null
          conv_oportunidade_proposta: number | null
          conv_proposta_fechamento: number | null
          cpa_estimado: number | null
          cpl_estimado: number | null
          created_at: string
          duracao_media_meses: number | null
          id: string
          is_custom: boolean
          leads_projetados: number | null
          mrr: number | null
          name: string
          orcamento_alocado: number
          organization_id: string | null
          plan_id: string
          ticket_medio: number | null
          tipo_contrato: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_type?: string
          ciclo_medio_dias?: number | null
          comissao_pct?: number | null
          comissao_tipo?: string
          comissao_valor_fixo?: number | null
          conv_lead_oportunidade?: number | null
          conv_oportunidade_proposta?: number | null
          conv_proposta_fechamento?: number | null
          cpa_estimado?: number | null
          cpl_estimado?: number | null
          created_at?: string
          duracao_media_meses?: number | null
          id?: string
          is_custom?: boolean
          leads_projetados?: number | null
          mrr?: number | null
          name: string
          orcamento_alocado?: number
          organization_id?: string | null
          plan_id: string
          ticket_medio?: number | null
          tipo_contrato?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_type?: string
          ciclo_medio_dias?: number | null
          comissao_pct?: number | null
          comissao_tipo?: string
          comissao_valor_fixo?: number | null
          conv_lead_oportunidade?: number | null
          conv_oportunidade_proposta?: number | null
          conv_proposta_fechamento?: number | null
          cpa_estimado?: number | null
          cpl_estimado?: number | null
          created_at?: string
          duracao_media_meses?: number | null
          id?: string
          is_custom?: boolean
          leads_projetados?: number | null
          mrr?: number | null
          name?: string
          orcamento_alocado?: number
          organization_id?: string | null
          plan_id?: string
          ticket_medio?: number | null
          tipo_contrato?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_channels_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_plans: {
        Row: {
          budget_approved: number
          budget_requested: number | null
          created_at: string
          id: string
          mode: string
          name: string
          notes: string | null
          organization_id: string | null
          period_months: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_approved?: number
          budget_requested?: number | null
          created_at?: string
          id?: string
          mode?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          period_months?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_approved?: number
          budget_requested?: number | null
          created_at?: string
          id?: string
          mode?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          period_months?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_scenarios: {
        Row: {
          ajuste_ciclo: number | null
          ajuste_conversao: number | null
          ajuste_cpl: number | null
          ajuste_ticket: number | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          plan_id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ajuste_ciclo?: number | null
          ajuste_conversao?: number | null
          ajuste_cpl?: number | null
          ajuste_ticket?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          plan_id: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ajuste_ciclo?: number | null
          ajuste_conversao?: number | null
          ajuste_cpl?: number | null
          ajuste_ticket?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          plan_id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_scenarios_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commercial_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_adjustments: {
        Row: {
          contract_id: string
          created_at: string
          data_reajuste: string
          id: string
          indice_aplicado: string | null
          observacao: string | null
          organization_id: string | null
          percentual: number
          tipo: string
          user_id: string
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          data_reajuste: string
          id?: string
          indice_aplicado?: string | null
          observacao?: string | null
          organization_id?: string | null
          percentual: number
          tipo: string
          user_id: string
          valor_anterior: number
          valor_novo: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          data_reajuste?: string
          id?: string
          indice_aplicado?: string | null
          observacao?: string | null
          organization_id?: string | null
          percentual?: number
          tipo?: string
          user_id?: string
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_adjustments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          observacao: string | null
          organization_id: string | null
          user_id: string
          version: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          observacao?: string | null
          organization_id?: string | null
          user_id: string
          version?: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          observacao?: string | null
          organization_id?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_installments: {
        Row: {
          contract_id: string
          created_at: string
          data_vencimento: string
          descricao: string
          id: string
          numero: number
          organization_id: string | null
          status: string
          user_id: string
          valor: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          data_vencimento: string
          descricao?: string
          id?: string
          numero?: number
          organization_id?: string | null
          status?: string
          user_id: string
          valor?: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          data_vencimento?: string
          descricao?: string
          id?: string
          numero?: number
          organization_id?: string | null
          status?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_installments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          area_responsavel: string | null
          cost_center_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          dia_vencimento: number | null
          entity_id: string | null
          external_ref: string | null
          finalidade: string | null
          id: string
          impacto_resultado: string | null
          indice_reajuste: string | null
          intervalo_personalizado: number | null
          natureza_financeira: string | null
          nome: string
          notes: string | null
          operacao: string | null
          organization_id: string | null
          percentual_reajuste: number | null
          periodicidade_reajuste: string | null
          prazo_indeterminado: boolean
          product_id: string | null
          proximo_reajuste: string | null
          rendimento_mensal_esperado: number | null
          responsavel_interno: string | null
          sla_revisao_dias: number | null
          source: string
          status: string
          subtipo_operacao: string | null
          tipo: string
          tipo_reajuste: string | null
          tipo_recorrencia: string
          updated_at: string
          user_id: string
          valor: number
          valor_base: number
          vencimento: string | null
        }
        Insert: {
          area_responsavel?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          entity_id?: string | null
          external_ref?: string | null
          finalidade?: string | null
          id?: string
          impacto_resultado?: string | null
          indice_reajuste?: string | null
          intervalo_personalizado?: number | null
          natureza_financeira?: string | null
          nome: string
          notes?: string | null
          operacao?: string | null
          organization_id?: string | null
          percentual_reajuste?: number | null
          periodicidade_reajuste?: string | null
          prazo_indeterminado?: boolean
          product_id?: string | null
          proximo_reajuste?: string | null
          rendimento_mensal_esperado?: number | null
          responsavel_interno?: string | null
          sla_revisao_dias?: number | null
          source?: string
          status?: string
          subtipo_operacao?: string | null
          tipo: string
          tipo_reajuste?: string | null
          tipo_recorrencia?: string
          updated_at?: string
          user_id: string
          valor?: number
          valor_base?: number
          vencimento?: string | null
        }
        Update: {
          area_responsavel?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          entity_id?: string | null
          external_ref?: string | null
          finalidade?: string | null
          id?: string
          impacto_resultado?: string | null
          indice_reajuste?: string | null
          intervalo_personalizado?: number | null
          natureza_financeira?: string | null
          nome?: string
          notes?: string | null
          operacao?: string | null
          organization_id?: string | null
          percentual_reajuste?: number | null
          periodicidade_reajuste?: string | null
          prazo_indeterminado?: boolean
          product_id?: string | null
          proximo_reajuste?: string | null
          rendimento_mensal_esperado?: number | null
          responsavel_interno?: string | null
          sla_revisao_dias?: number | null
          source?: string
          status?: string
          subtipo_operacao?: string | null
          tipo?: string
          tipo_reajuste?: string | null
          tipo_recorrencia?: string
          updated_at?: string
          user_id?: string
          valor?: number
          valor_base?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_center_permissions: {
        Row: {
          allowed: boolean
          cost_center_id: string
          created_at: string | null
          id: string
          module_key: string
          organization_id: string
          role: string
          tab_key: string | null
        }
        Insert: {
          allowed?: boolean
          cost_center_id: string
          created_at?: string | null
          id?: string
          module_key: string
          organization_id: string
          role: string
          tab_key?: string | null
        }
        Update: {
          allowed?: boolean
          cost_center_id?: string
          created_at?: string | null
          id?: string
          module_key?: string
          organization_id?: string
          role?: string
          tab_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_center_permissions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_center_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean
          business_unit: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
          responsible: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          business_unit?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
          responsible?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          business_unit?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          responsible?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          description: string
          id: string
          organization_id: string
          scheduled_at: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          organization_id: string
          scheduled_at?: string | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          scheduled_at?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          active: boolean
          churn_risk: string
          contract_renewal_date: string | null
          contract_start_date: string | null
          created_at: string
          document_number: string | null
          engagement: string
          entity_id: string | null
          estimated_margin: number
          health_score: number
          id: string
          last_contact_at: string | null
          mrr: number
          name: string
          next_action_at: string | null
          next_action_description: string | null
          next_action_type: string | null
          notes: string | null
          organization_id: string
          origin: string | null
          responsible: string | null
          score: number
          segment: string | null
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          churn_risk?: string
          contract_renewal_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          document_number?: string | null
          engagement?: string
          entity_id?: string | null
          estimated_margin?: number
          health_score?: number
          id?: string
          last_contact_at?: string | null
          mrr?: number
          name: string
          next_action_at?: string | null
          next_action_description?: string | null
          next_action_type?: string | null
          notes?: string | null
          organization_id: string
          origin?: string | null
          responsible?: string | null
          score?: number
          segment?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          churn_risk?: string
          contract_renewal_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          document_number?: string | null
          engagement?: string
          entity_id?: string | null
          estimated_margin?: number
          health_score?: number
          id?: string
          last_contact_at?: string | null
          mrr?: number
          name?: string
          next_action_at?: string | null
          next_action_description?: string | null
          next_action_type?: string | null
          notes?: string | null
          organization_id?: string
          origin?: string | null
          responsible?: string | null
          score?: number
          segment?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          client_id: string
          contract_id: string | null
          contract_type: string | null
          created_at: string
          estimated_close_date: string | null
          estimated_value: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          organization_id: string
          recurrence: string
          responsible: string | null
          stage_id: string
          title: string
          updated_at: string
          user_id: string
          won_at: string | null
        }
        Insert: {
          client_id: string
          contract_id?: string | null
          contract_type?: string | null
          created_at?: string
          estimated_close_date?: string | null
          estimated_value?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          organization_id: string
          recurrence?: string
          responsible?: string | null
          stage_id: string
          title: string
          updated_at?: string
          user_id: string
          won_at?: string | null
        }
        Update: {
          client_id?: string
          contract_id?: string | null
          contract_type?: string | null
          created_at?: string
          estimated_close_date?: string | null
          estimated_value?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          organization_id?: string
          recurrence?: string
          responsible?: string | null
          stage_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          avg_days: number
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          order_index: number
          organization_id: string
          probability: number
          user_id: string
        }
        Insert: {
          avg_days?: number
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          order_index?: number
          organization_id: string
          probability?: number
          user_id: string
        }
        Update: {
          avg_days?: number
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          order_index?: number
          organization_id?: string
          probability?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_kpi_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kpi_id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kpi_id: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kpi_id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_import_rows: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          import_id: string
          mapped_data: Json | null
          raw_data: Json
          row_index: number
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_id: string
          mapped_data?: Json | null
          raw_data?: Json
          row_index: number
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_id?: string
          mapped_data?: Json | null
          raw_data?: Json
          row_index?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "data_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      data_imports: {
        Row: {
          column_mapping: Json
          created_at: string | null
          file_name: string
          id: string
          imported_at: string | null
          organization_id: string
          row_count: number | null
          source_type: string
          status: string
          user_id: string
        }
        Insert: {
          column_mapping?: Json
          created_at?: string | null
          file_name: string
          id?: string
          imported_at?: string | null
          organization_id: string
          row_count?: number | null
          source_type?: string
          status?: string
          user_id: string
        }
        Update: {
          column_mapping?: Json
          created_at?: string | null
          file_name?: string
          id?: string
          imported_at?: string | null
          organization_id?: string
          row_count?: number | null
          source_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_benefits: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_value: number
          description: string | null
          id: string
          name: string
          organization_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dp_benefits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_business_days: {
        Row: {
          business_days: number
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          reference_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_days: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          reference_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_days?: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          reference_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dp_business_days_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_config: {
        Row: {
          advance_enabled: boolean
          advance_payment_day: number
          advance_pct: number
          benefits_payment_day: number
          created_at: string
          custom_items: Json
          default_account_beneficios: string | null
          default_account_encargos: string | null
          default_account_rescisao: string | null
          default_account_salario: string | null
          fgts_due_day: number
          fgts_pct: number | null
          health_payment_day: number
          id: string
          inss_due_day: number
          inss_patronal_pct: number | null
          irrf_due_day: number
          meta_rotinas_pct: number
          organization_id: string | null
          pending_holding_suggestion: Json | null
          provisao_13_pct: number | null
          provisao_ferias_pct: number | null
          rat_pct: number | null
          salary_payment_basis: string
          salary_payment_day: number
          terceiros_pct: number | null
          updated_at: string
          user_id: string
          vt_desconto_pct: number | null
        }
        Insert: {
          advance_enabled?: boolean
          advance_payment_day?: number
          advance_pct?: number
          benefits_payment_day?: number
          created_at?: string
          custom_items?: Json
          default_account_beneficios?: string | null
          default_account_encargos?: string | null
          default_account_rescisao?: string | null
          default_account_salario?: string | null
          fgts_due_day?: number
          fgts_pct?: number | null
          health_payment_day?: number
          id?: string
          inss_due_day?: number
          inss_patronal_pct?: number | null
          irrf_due_day?: number
          meta_rotinas_pct?: number
          organization_id?: string | null
          pending_holding_suggestion?: Json | null
          provisao_13_pct?: number | null
          provisao_ferias_pct?: number | null
          rat_pct?: number | null
          salary_payment_basis?: string
          salary_payment_day?: number
          terceiros_pct?: number | null
          updated_at?: string
          user_id: string
          vt_desconto_pct?: number | null
        }
        Update: {
          advance_enabled?: boolean
          advance_payment_day?: number
          advance_pct?: number
          benefits_payment_day?: number
          created_at?: string
          custom_items?: Json
          default_account_beneficios?: string | null
          default_account_encargos?: string | null
          default_account_rescisao?: string | null
          default_account_salario?: string | null
          fgts_due_day?: number
          fgts_pct?: number | null
          health_payment_day?: number
          id?: string
          inss_due_day?: number
          inss_patronal_pct?: number | null
          irrf_due_day?: number
          meta_rotinas_pct?: number
          organization_id?: string | null
          pending_holding_suggestion?: Json | null
          provisao_13_pct?: number | null
          provisao_ferias_pct?: number | null
          rat_pct?: number | null
          salary_payment_basis?: string
          salary_payment_day?: number
          terceiros_pct?: number | null
          updated_at?: string
          user_id?: string
          vt_desconto_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dp_config_default_account_beneficios_fkey"
            columns: ["default_account_beneficios"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dp_config_default_account_encargos_fkey"
            columns: ["default_account_encargos"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dp_config_default_account_rescisao_fkey"
            columns: ["default_account_rescisao"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dp_config_default_account_salario_fkey"
            columns: ["default_account_salario"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dp_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_benefits: {
        Row: {
          active: boolean
          benefit_id: string
          created_at: string
          custom_value: number | null
          employee_id: string
          id: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          benefit_id: string
          created_at?: string
          custom_value?: number | null
          employee_id: string
          id?: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          benefit_id?: string
          created_at?: string
          custom_value?: number | null
          employee_id?: string
          id?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_benefits_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "dp_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensations: {
        Row: {
          active: boolean
          created_at: string
          description: string
          employee_id: string
          id: string
          organization_id: string | null
          recurrence: string | null
          type: string
          user_id: string
          value: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          employee_id: string
          id?: string
          organization_id?: string | null
          recurrence?: string | null
          type?: string
          user_id: string
          value?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          organization_id?: string | null
          recurrence?: string | null
          type?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          doc_type: string
          employee_id: string
          expires_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          employee_id: string
          expires_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          employee_id?: string
          expires_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_terminations: {
        Row: {
          aviso_previo: number | null
          contract_type: string | null
          created_at: string
          decimo_terceiro_proporcional: number | null
          employee_id: string
          ferias_proporcionais: number | null
          hr_planning_item_id: string | null
          id: string
          multa_fgts: number | null
          notes: string | null
          organization_id: string | null
          saldo_salario: number | null
          status: string
          terco_ferias: number | null
          termination_date: string
          total_rescisao: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aviso_previo?: number | null
          contract_type?: string | null
          created_at?: string
          decimo_terceiro_proporcional?: number | null
          employee_id: string
          ferias_proporcionais?: number | null
          hr_planning_item_id?: string | null
          id?: string
          multa_fgts?: number | null
          notes?: string | null
          organization_id?: string | null
          saldo_salario?: number | null
          status?: string
          terco_ferias?: number | null
          termination_date: string
          total_rescisao?: number | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aviso_previo?: number | null
          contract_type?: string | null
          created_at?: string
          decimo_terceiro_proporcional?: number | null
          employee_id?: string
          ferias_proporcionais?: number | null
          hr_planning_item_id?: string | null
          id?: string
          multa_fgts?: number | null
          notes?: string | null
          organization_id?: string | null
          saldo_salario?: number | null
          status?: string
          terco_ferias?: number | null
          termination_date?: string
          total_rescisao?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_terminations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_terminations_hr_planning_item_id_fkey"
            columns: ["hr_planning_item_id"]
            isOneToOne: false
            referencedRelation: "hr_planning_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_terminations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacations: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          dias_gozados: number | null
          dias_vendidos: number | null
          employee_id: string
          id: string
          observacoes: string | null
          organization_id: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          provisao_mensal: number | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
          valor_ferias: number | null
          valor_terco: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_gozados?: number | null
          dias_vendidos?: number | null
          employee_id: string
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          provisao_mensal?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id: string
          valor_ferias?: number | null
          valor_terco?: number | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_gozados?: number | null
          dias_vendidos?: number | null
          employee_id?: string
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          provisao_mensal?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_ferias?: number | null
          valor_terco?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vacations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string
          comissao_tipo: string | null
          comissao_valor: number | null
          contract_id: string | null
          contract_type: string
          cost_center_id: string | null
          cpf: string | null
          created_at: string
          department_id: string | null
          dismissal_date: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          position_id: string | null
          salary_base: number
          status: string
          updated_at: string
          user_id: string
          vt_ativo: boolean
          vt_diario: number
          workload_hours: number | null
        }
        Insert: {
          admission_date: string
          comissao_tipo?: string | null
          comissao_valor?: number | null
          contract_id?: string | null
          contract_type?: string
          cost_center_id?: string | null
          cpf?: string | null
          created_at?: string
          department_id?: string | null
          dismissal_date?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          position_id?: string | null
          salary_base?: number
          status?: string
          updated_at?: string
          user_id: string
          vt_ativo?: boolean
          vt_diario?: number
          workload_hours?: number | null
        }
        Update: {
          admission_date?: string
          comissao_tipo?: string | null
          comissao_valor?: number | null
          contract_id?: string | null
          contract_type?: string
          cost_center_id?: string | null
          cpf?: string | null
          created_at?: string
          department_id?: string | null
          dismissal_date?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          position_id?: string | null
          salary_base?: number
          status?: string
          updated_at?: string
          user_id?: string
          vt_ativo?: boolean
          vt_diario?: number
          workload_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          active: boolean
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          bank_pix: string | null
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          document_number: string | null
          document_type: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          payment_condition: string | null
          phone: string | null
          tags: string[] | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          payment_condition?: string | null
          phone?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          payment_condition?: string | null
          phone?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_policies: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          levels: Json
          organization_id: string
          template_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          levels?: Json
          organization_id: string
          template_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          levels?: Json
          organization_id?: string
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_policies_template_code_fkey"
            columns: ["template_code"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["code"]
          },
        ]
      }
      etl_job_items: {
        Row: {
          attempts: number
          created_at: string
          external_ref: string | null
          id: string
          idempotency_key: string
          job_id: string
          last_error: string | null
          mapped: Json | null
          max_attempts: number
          next_attempt_at: string
          organization_id: string
          processed_at: string | null
          raw: Json
          seq: number
          status: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          idempotency_key: string
          job_id: string
          last_error?: string | null
          mapped?: Json | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id: string
          processed_at?: string | null
          raw?: Json
          seq: number
          status?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          idempotency_key?: string
          job_id?: string
          last_error?: string | null
          mapped?: Json | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id?: string
          processed_at?: string | null
          raw?: Json
          seq?: number
          status?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etl_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "etl_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etl_job_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      etl_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          failed_count: number
          finished_at: string | null
          id: string
          idempotency_key: string
          module: string
          ok_count: number
          organization_id: string
          params: Json
          pipeline_key: string
          skipped_count: number
          source: string
          started_at: string | null
          status: string
          total_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          idempotency_key: string
          module: string
          ok_count?: number
          organization_id: string
          params?: Json
          pipeline_key: string
          skipped_count?: number
          source: string
          started_at?: string | null
          status?: string
          total_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          module?: string
          ok_count?: number
          organization_id?: string
          params?: Json
          pipeline_key?: string
          skipped_count?: number
          source?: string
          started_at?: string | null
          status?: string
          total_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etl_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etl_jobs_pipeline_key_fkey"
            columns: ["pipeline_key"]
            isOneToOne: false
            referencedRelation: "etl_pipelines"
            referencedColumns: ["key"]
          },
        ]
      }
      etl_pipelines: {
        Row: {
          active: boolean
          batch_size: number
          created_at: string
          cron_expr: string | null
          description: string | null
          key: string
          label: string
          max_attempts: number
          module: string
          target_handler: string | null
          updated_at: string
          worker: string
        }
        Insert: {
          active?: boolean
          batch_size?: number
          created_at?: string
          cron_expr?: string | null
          description?: string | null
          key: string
          label: string
          max_attempts?: number
          module: string
          target_handler?: string | null
          updated_at?: string
          worker?: string
        }
        Update: {
          active?: boolean
          batch_size?: number
          created_at?: string
          cron_expr?: string | null
          description?: string | null
          key?: string
          label?: string
          max_attempts?: number
          module?: string
          target_handler?: string | null
          updated_at?: string
          worker?: string
        }
        Relationships: []
      }
      expense_cost_center_splits: {
        Row: {
          cashflow_entry_id: string
          cost_center_id: string
          created_at: string | null
          id: string
          percentual: number | null
          valor: number | null
        }
        Insert: {
          cashflow_entry_id: string
          cost_center_id: string
          created_at?: string | null
          id?: string
          percentual?: number | null
          valor?: number | null
        }
        Update: {
          cashflow_entry_id?: string
          cost_center_id?: string
          created_at?: string | null
          id?: string
          percentual?: number | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_cost_center_splits_cashflow_entry_id_fkey"
            columns: ["cashflow_entry_id"]
            isOneToOne: false
            referencedRelation: "cashflow_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_cost_center_splits_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_groups: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          organization_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          organization_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          id: string
          organization_id: string
          reopened_at: string | null
          reopened_by: string | null
          status: string
          year_month: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          year_month: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grouping_groups: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          macrogroup_id: string
          name: string
          order_index: number
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          macrogroup_id: string
          name: string
          order_index?: number
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          macrogroup_id?: string
          name?: string
          order_index?: number
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouping_groups_macrogroup_id_fkey"
            columns: ["macrogroup_id"]
            isOneToOne: false
            referencedRelation: "grouping_macrogroups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grouping_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grouping_macrogroups: {
        Row: {
          color: string | null
          created_at: string
          enabled: boolean
          icon: string | null
          id: string
          name: string
          order_index: number
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          enabled?: boolean
          icon?: string | null
          id?: string
          name: string
          order_index?: number
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          enabled?: boolean
          icon?: string | null
          id?: string
          name?: string
          order_index?: number
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouping_macrogroups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grouping_rules: {
        Row: {
          created_at: string
          enabled: boolean
          group_id: string | null
          id: string
          match_field: string
          match_keyword: string | null
          match_value: string
          min_items: number
          name: string
          operator: string
          organization_id: string
          priority: number
          sub_group_field: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          group_id?: string | null
          id?: string
          match_field?: string
          match_keyword?: string | null
          match_value: string
          min_items?: number
          name: string
          operator?: string
          organization_id: string
          priority?: number
          sub_group_field?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          group_id?: string | null
          id?: string
          match_field?: string
          match_keyword?: string | null
          match_value?: string
          min_items?: number
          name?: string
          operator?: string
          organization_id?: string
          priority?: number
          sub_group_field?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouping_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "grouping_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grouping_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_9box_calibration_log: {
        Row: {
          action: string
          calibrator_user_id: string
          changes: Json | null
          created_at: string
          evaluation_id: string
          id: string
          notes: string | null
          organization_id: string
        }
        Insert: {
          action: string
          calibrator_user_id: string
          changes?: Json | null
          created_at?: string
          evaluation_id: string
          id?: string
          notes?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          calibrator_user_id?: string
          changes?: Json | null
          created_at?: string
          evaluation_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_9box_calibration_log_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "hr_9box_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_9box_calibration_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_9box_criteria: {
        Row: {
          active: boolean
          anchor_1: string | null
          anchor_2: string | null
          anchor_3: string | null
          anchor_4: string | null
          anchor_5: string | null
          created_at: string
          description: string | null
          dimension: Database["public"]["Enums"]["nine_box_dimension"]
          id: string
          is_system_template: boolean
          name: string
          order_index: number
          organization_id: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          anchor_1?: string | null
          anchor_2?: string | null
          anchor_3?: string | null
          anchor_4?: string | null
          anchor_5?: string | null
          created_at?: string
          description?: string | null
          dimension: Database["public"]["Enums"]["nine_box_dimension"]
          id?: string
          is_system_template?: boolean
          name: string
          order_index?: number
          organization_id?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          anchor_1?: string | null
          anchor_2?: string | null
          anchor_3?: string | null
          anchor_4?: string | null
          anchor_5?: string | null
          created_at?: string
          description?: string | null
          dimension?: Database["public"]["Enums"]["nine_box_dimension"]
          id?: string
          is_system_template?: boolean
          name?: string
          order_index?: number
          organization_id?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_9box_criteria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_9box_evaluations: {
        Row: {
          bsc_score_snapshot: number | null
          confiabilidade: number
          created_at: string
          data_avaliacao: string
          employee_id: string
          evaluation_pai_id: string | null
          evaluator_user_id: string
          id: string
          indicacao_sucessao: boolean
          justificativa: string | null
          liberado_para_colaborador: boolean
          nivel_desempenho: string | null
          nivel_potencial: string | null
          nota_desempenho: number
          nota_potencial: number
          organization_id: string
          pontos_atencao: string | null
          pontos_fortes: string | null
          quadrante: number | null
          recomendacao: Database["public"]["Enums"]["nine_box_recomendacao"]
          risco_perda: string | null
          status: Database["public"]["Enums"]["nine_box_status"]
          updated_at: string
          user_id: string
          versao: number
          vies_detectado: Json | null
        }
        Insert: {
          bsc_score_snapshot?: number | null
          confiabilidade?: number
          created_at?: string
          data_avaliacao?: string
          employee_id: string
          evaluation_pai_id?: string | null
          evaluator_user_id: string
          id?: string
          indicacao_sucessao?: boolean
          justificativa?: string | null
          liberado_para_colaborador?: boolean
          nivel_desempenho?: string | null
          nivel_potencial?: string | null
          nota_desempenho: number
          nota_potencial: number
          organization_id: string
          pontos_atencao?: string | null
          pontos_fortes?: string | null
          quadrante?: number | null
          recomendacao?: Database["public"]["Enums"]["nine_box_recomendacao"]
          risco_perda?: string | null
          status?: Database["public"]["Enums"]["nine_box_status"]
          updated_at?: string
          user_id: string
          versao?: number
          vies_detectado?: Json | null
        }
        Update: {
          bsc_score_snapshot?: number | null
          confiabilidade?: number
          created_at?: string
          data_avaliacao?: string
          employee_id?: string
          evaluation_pai_id?: string | null
          evaluator_user_id?: string
          id?: string
          indicacao_sucessao?: boolean
          justificativa?: string | null
          liberado_para_colaborador?: boolean
          nivel_desempenho?: string | null
          nivel_potencial?: string | null
          nota_desempenho?: number
          nota_potencial?: number
          organization_id?: string
          pontos_atencao?: string | null
          pontos_fortes?: string | null
          quadrante?: number | null
          recomendacao?: Database["public"]["Enums"]["nine_box_recomendacao"]
          risco_perda?: string | null
          status?: Database["public"]["Enums"]["nine_box_status"]
          updated_at?: string
          user_id?: string
          versao?: number
          vies_detectado?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_9box_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_9box_evaluations_evaluation_pai_id_fkey"
            columns: ["evaluation_pai_id"]
            isOneToOne: false
            referencedRelation: "hr_9box_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_9box_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_9box_scores: {
        Row: {
          created_at: string
          criterion_id: string
          evaluation_id: string
          evidence_text: string | null
          evidence_url: string | null
          id: string
          organization_id: string
          score: number
          source: Database["public"]["Enums"]["nine_box_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterion_id: string
          evaluation_id: string
          evidence_text?: string | null
          evidence_url?: string | null
          id?: string
          organization_id: string
          score: number
          source: Database["public"]["Enums"]["nine_box_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterion_id?: string
          evaluation_id?: string
          evidence_text?: string | null
          evidence_url?: string | null
          id?: string
          organization_id?: string
          score?: number
          source?: Database["public"]["Enums"]["nine_box_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_9box_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "hr_9box_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_9box_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "hr_9box_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_9box_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_9box_sources: {
        Row: {
          created_at: string
          evaluation_id: string
          evaluator_user_id: string | null
          id: string
          notes: string | null
          organization_id: string
          source: Database["public"]["Enums"]["nine_box_source"]
          submitted: boolean
          submitted_at: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          evaluator_user_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          source: Database["public"]["Enums"]["nine_box_source"]
          submitted?: boolean
          submitted_at?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          evaluator_user_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          source?: Database["public"]["Enums"]["nine_box_source"]
          submitted?: boolean
          submitted_at?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_9box_sources_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "hr_9box_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_9box_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_bsc_history: {
        Row: {
          bsc_id: string
          id: string
          indicator_id: string
          organization_id: string
          percentual: number
          periodo_mes: string
          realizado: number
          snapshot_at: string
        }
        Insert: {
          bsc_id: string
          id?: string
          indicator_id: string
          organization_id: string
          percentual?: number
          periodo_mes: string
          realizado?: number
          snapshot_at?: string
        }
        Update: {
          bsc_id?: string
          id?: string
          indicator_id?: string
          organization_id?: string
          percentual?: number
          periodo_mes?: string
          realizado?: number
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_bsc_history_bsc_id_fkey"
            columns: ["bsc_id"]
            isOneToOne: false
            referencedRelation: "hr_bsc_scorecards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_bsc_history_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "hr_bsc_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_bsc_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_bsc_indicators: {
        Row: {
          bsc_id: string
          created_at: string
          descricao: string | null
          fonte_dado: string | null
          frequencia: Database["public"]["Enums"]["bsc_frequencia"]
          id: string
          meta: number
          nome: string
          nota_ponderada: number
          organization_id: string
          percentual_atingimento: number
          perspectiva: Database["public"]["Enums"]["bsc_perspectiva"]
          peso: number
          quanto_menor_melhor: boolean
          realizado: number
          responsavel_user_id: string | null
          status: Database["public"]["Enums"]["bsc_indicator_status"]
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bsc_id: string
          created_at?: string
          descricao?: string | null
          fonte_dado?: string | null
          frequencia?: Database["public"]["Enums"]["bsc_frequencia"]
          id?: string
          meta: number
          nome: string
          nota_ponderada?: number
          organization_id: string
          percentual_atingimento?: number
          perspectiva: Database["public"]["Enums"]["bsc_perspectiva"]
          peso?: number
          quanto_menor_melhor?: boolean
          realizado?: number
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["bsc_indicator_status"]
          unidade?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bsc_id?: string
          created_at?: string
          descricao?: string | null
          fonte_dado?: string | null
          frequencia?: Database["public"]["Enums"]["bsc_frequencia"]
          id?: string
          meta?: number
          nome?: string
          nota_ponderada?: number
          organization_id?: string
          percentual_atingimento?: number
          perspectiva?: Database["public"]["Enums"]["bsc_perspectiva"]
          peso?: number
          quanto_menor_melhor?: boolean
          realizado?: number
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["bsc_indicator_status"]
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_bsc_indicators_bsc_id_fkey"
            columns: ["bsc_id"]
            isOneToOne: false
            referencedRelation: "hr_bsc_scorecards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_bsc_indicators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_bsc_scorecards: {
        Row: {
          created_at: string
          department_id: string | null
          employee_id: string | null
          id: string
          liberado_para_colaborador: boolean
          manager_user_id: string | null
          nome: string
          observacoes: string | null
          organization_id: string
          periodo_fim: string
          periodo_inicio: string
          resultado_geral: number
          status: Database["public"]["Enums"]["bsc_status"]
          tipo: Database["public"]["Enums"]["bsc_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          liberado_para_colaborador?: boolean
          manager_user_id?: string | null
          nome: string
          observacoes?: string | null
          organization_id: string
          periodo_fim: string
          periodo_inicio: string
          resultado_geral?: number
          status?: Database["public"]["Enums"]["bsc_status"]
          tipo: Database["public"]["Enums"]["bsc_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          liberado_para_colaborador?: boolean
          manager_user_id?: string | null
          nome?: string
          observacoes?: string | null
          organization_id?: string
          periodo_fim?: string
          periodo_inicio?: string
          resultado_geral?: number
          status?: Database["public"]["Enums"]["bsc_status"]
          tipo?: Database["public"]["Enums"]["bsc_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_bsc_scorecards_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_bsc_scorecards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_bsc_scorecards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          active: boolean
          cost_center_id: string | null
          created_at: string
          description: string | null
          id: string
          manager_user_id: string | null
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          manager_user_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          manager_user_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_departments_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_one_on_one_actions: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          one_on_one_id: string
          organization_id: string
          prazo: string | null
          responsavel_user_id: string | null
          status: Database["public"]["Enums"]["pdi_action_status"]
          tarefa: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          one_on_one_id: string
          organization_id: string
          prazo?: string | null
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["pdi_action_status"]
          tarefa: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          one_on_one_id?: string
          organization_id?: string
          prazo?: string | null
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["pdi_action_status"]
          tarefa?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_one_on_one_actions_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "hr_one_on_ones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_one_on_one_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_one_on_ones: {
        Row: {
          created_at: string
          data_reuniao: string
          decisoes: string | null
          dificuldades: string | null
          employee_id: string
          entregas_recentes: string | null
          feedback_colaborador: string | null
          feedback_gestor: string | null
          humor: Database["public"]["Enums"]["one_on_one_humor"] | null
          id: string
          liberado_para_colaborador: boolean
          manager_user_id: string | null
          organization_id: string
          pauta: string | null
          pontos_discutidos: string | null
          previous_id: string | null
          proxima_reuniao_sugerida: string | null
          proximos_passos: string | null
          status: Database["public"]["Enums"]["one_on_one_status"]
          tipo: Database["public"]["Enums"]["one_on_one_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_reuniao: string
          decisoes?: string | null
          dificuldades?: string | null
          employee_id: string
          entregas_recentes?: string | null
          feedback_colaborador?: string | null
          feedback_gestor?: string | null
          humor?: Database["public"]["Enums"]["one_on_one_humor"] | null
          id?: string
          liberado_para_colaborador?: boolean
          manager_user_id?: string | null
          organization_id: string
          pauta?: string | null
          pontos_discutidos?: string | null
          previous_id?: string | null
          proxima_reuniao_sugerida?: string | null
          proximos_passos?: string | null
          status?: Database["public"]["Enums"]["one_on_one_status"]
          tipo?: Database["public"]["Enums"]["one_on_one_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_reuniao?: string
          decisoes?: string | null
          dificuldades?: string | null
          employee_id?: string
          entregas_recentes?: string | null
          feedback_colaborador?: string | null
          feedback_gestor?: string | null
          humor?: Database["public"]["Enums"]["one_on_one_humor"] | null
          id?: string
          liberado_para_colaborador?: boolean
          manager_user_id?: string | null
          organization_id?: string
          pauta?: string | null
          pontos_discutidos?: string | null
          previous_id?: string | null
          proxima_reuniao_sugerida?: string | null
          proximos_passos?: string | null
          status?: Database["public"]["Enums"]["one_on_one_status"]
          tipo?: Database["public"]["Enums"]["one_on_one_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_one_on_ones_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_one_on_ones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_one_on_ones_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "hr_one_on_ones"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_pdi_actions: {
        Row: {
          acao: string
          comentarios: string | null
          concluida_em: string | null
          created_at: string
          evidencia: string | null
          id: string
          organization_id: string
          pdi_id: string
          prazo: string | null
          responsavel_user_id: string | null
          status: Database["public"]["Enums"]["pdi_action_status"]
          tipo: Database["public"]["Enums"]["pdi_action_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          acao: string
          comentarios?: string | null
          concluida_em?: string | null
          created_at?: string
          evidencia?: string | null
          id?: string
          organization_id: string
          pdi_id: string
          prazo?: string | null
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["pdi_action_status"]
          tipo?: Database["public"]["Enums"]["pdi_action_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          acao?: string
          comentarios?: string | null
          concluida_em?: string | null
          created_at?: string
          evidencia?: string | null
          id?: string
          organization_id?: string
          pdi_id?: string
          prazo?: string | null
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["pdi_action_status"]
          tipo?: Database["public"]["Enums"]["pdi_action_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_pdi_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_pdi_actions_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "hr_pdis"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_pdis: {
        Row: {
          competencia: string | null
          created_at: string
          created_by: string
          data_conclusao_prevista: string | null
          data_conclusao_real: string | null
          data_inicio: string
          employee_id: string
          id: string
          justificativa: string | null
          liberado_para_colaborador: boolean
          manager_user_id: string | null
          objetivo: string
          obs_colaborador: string | null
          obs_gestor: string | null
          obs_rh: string | null
          organization_id: string
          percentual_evolucao: number
          source_9box_id: string | null
          source_one_on_one_id: string | null
          status: Database["public"]["Enums"]["pdi_status"]
          ultima_atualizacao_em: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          competencia?: string | null
          created_at?: string
          created_by: string
          data_conclusao_prevista?: string | null
          data_conclusao_real?: string | null
          data_inicio?: string
          employee_id: string
          id?: string
          justificativa?: string | null
          liberado_para_colaborador?: boolean
          manager_user_id?: string | null
          objetivo: string
          obs_colaborador?: string | null
          obs_gestor?: string | null
          obs_rh?: string | null
          organization_id: string
          percentual_evolucao?: number
          source_9box_id?: string | null
          source_one_on_one_id?: string | null
          status?: Database["public"]["Enums"]["pdi_status"]
          ultima_atualizacao_em?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          competencia?: string | null
          created_at?: string
          created_by?: string
          data_conclusao_prevista?: string | null
          data_conclusao_real?: string | null
          data_inicio?: string
          employee_id?: string
          id?: string
          justificativa?: string | null
          liberado_para_colaborador?: boolean
          manager_user_id?: string | null
          objetivo?: string
          obs_colaborador?: string | null
          obs_gestor?: string | null
          obs_rh?: string | null
          organization_id?: string
          percentual_evolucao?: number
          source_9box_id?: string | null
          source_one_on_one_id?: string | null
          status?: Database["public"]["Enums"]["pdi_status"]
          ultima_atualizacao_em?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_pdis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_pdis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_planning_items: {
        Row: {
          cost_center_id: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string | null
          planned_date: string
          position_id: string | null
          quantity: number | null
          salary_estimated: number | null
          scenario_name: string
          status: string
          total_cost_estimated: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          planned_date: string
          position_id?: string | null
          quantity?: number | null
          salary_estimated?: number | null
          scenario_name?: string
          status?: string
          total_cost_estimated?: number | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          planned_date?: string
          position_id?: string | null
          quantity?: number | null
          salary_estimated?: number | null
          scenario_name?: string
          status?: string
          total_cost_estimated?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_planning_items_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_planning_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_planning_items_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      import_templates: {
        Row: {
          active: boolean
          column_mapping: Json
          created_at: string
          date_format: string | null
          decimal_separator: string | null
          default_values: Json | null
          delimiter: string | null
          id: string
          name: string
          organization_id: string
          provider: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          column_mapping: Json
          created_at?: string
          date_format?: string | null
          decimal_separator?: string | null
          default_values?: Json | null
          delimiter?: string | null
          id?: string
          name: string
          organization_id: string
          provider?: string | null
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          column_mapping?: Json
          created_at?: string
          date_format?: string | null
          decimal_separator?: string | null
          default_values?: Json | null
          delimiter?: string | null
          id?: string
          name?: string
          organization_id?: string
          provider?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_endpoints: {
        Row: {
          active: boolean
          created_at: string
          default_account_id: string | null
          default_bank_account_id: string | null
          default_cost_center_id: string | null
          events_count: number
          id: string
          last_received_at: string | null
          mapping: Json
          name: string
          organization_id: string
          provider: string
          secret_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_account_id?: string | null
          default_bank_account_id?: string | null
          default_cost_center_id?: string | null
          events_count?: number
          id?: string
          last_received_at?: string | null
          mapping?: Json
          name: string
          organization_id: string
          provider: string
          secret_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_account_id?: string | null
          default_bank_account_id?: string | null
          default_cost_center_id?: string | null
          events_count?: number
          id?: string
          last_received_at?: string | null
          mapping?: Json
          name?: string
          organization_id?: string
          provider?: string
          secret_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          cashflow_entry_id: string | null
          endpoint_id: string
          error_message: string | null
          event_type: string | null
          external_id: string
          id: string
          organization_id: string
          processed_at: string | null
          raw_payload: Json
          received_at: string
          status: string
        }
        Insert: {
          cashflow_entry_id?: string | null
          endpoint_id: string
          error_message?: string | null
          event_type?: string | null
          external_id: string
          id?: string
          organization_id: string
          processed_at?: string | null
          raw_payload: Json
          received_at?: string
          status?: string
        }
        Update: {
          cashflow_entry_id?: string | null
          endpoint_id?: string
          error_message?: string | null
          event_type?: string | null
          external_id?: string
          id?: string
          organization_id?: string
          processed_at?: string | null
          raw_payload?: Json
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "integration_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      it_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["it_audit_action"]
          after_data: Json | null
          before_data: Json | null
          changed_by: string | null
          changed_fields: string[] | null
          created_at: string
          id: string
          organization_id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["it_audit_action"]
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          organization_id: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["it_audit_action"]
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          organization_id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      it_config: {
        Row: {
          alert_renewal_days: number[] | null
          created_at: string
          default_useful_life_celular: number | null
          default_useful_life_desktop: number | null
          default_useful_life_monitor: number | null
          default_useful_life_notebook: number | null
          default_useful_life_outro: number | null
          default_useful_life_servidor: number | null
          id: string
          notes: string | null
          organization_id: string
          sla_alta_hours: number | null
          sla_baixa_hours: number | null
          sla_critica_hours: number | null
          sla_media_hours: number | null
          technician_hourly_cost: number | null
          updated_at: string
        }
        Insert: {
          alert_renewal_days?: number[] | null
          created_at?: string
          default_useful_life_celular?: number | null
          default_useful_life_desktop?: number | null
          default_useful_life_monitor?: number | null
          default_useful_life_notebook?: number | null
          default_useful_life_outro?: number | null
          default_useful_life_servidor?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          sla_alta_hours?: number | null
          sla_baixa_hours?: number | null
          sla_critica_hours?: number | null
          sla_media_hours?: number | null
          technician_hourly_cost?: number | null
          updated_at?: string
        }
        Update: {
          alert_renewal_days?: number[] | null
          created_at?: string
          default_useful_life_celular?: number | null
          default_useful_life_desktop?: number | null
          default_useful_life_monitor?: number | null
          default_useful_life_notebook?: number | null
          default_useful_life_outro?: number | null
          default_useful_life_servidor?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          sla_alta_hours?: number | null
          sla_baixa_hours?: number | null
          sla_critica_hours?: number | null
          sla_media_hours?: number | null
          technician_hourly_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_depreciation_params: {
        Row: {
          accounting_residual_value: number | null
          accounting_useful_life_months: number | null
          accounting_value: number | null
          created_at: string
          current_economic_value: number | null
          depreciable_base: number | null
          discounts: number | null
          economic_residual_value: number | null
          economic_useful_life_months: number | null
          equipment_id: string
          finance_completed_at: string | null
          finance_completed_by: string | null
          freight_install_setup: number | null
          id: string
          invoice_gross_value: number | null
          manual_economic_status:
            | Database["public"]["Enums"]["it_economic_status"]
            | null
          manually_edited: boolean | null
          monthly_economic_depreciation: number | null
          non_recoverable_taxes: number | null
          organization_id: string
          recoverable_taxes: number | null
          requires_finance_input: boolean
          updated_at: string
        }
        Insert: {
          accounting_residual_value?: number | null
          accounting_useful_life_months?: number | null
          accounting_value?: number | null
          created_at?: string
          current_economic_value?: number | null
          depreciable_base?: number | null
          discounts?: number | null
          economic_residual_value?: number | null
          economic_useful_life_months?: number | null
          equipment_id: string
          finance_completed_at?: string | null
          finance_completed_by?: string | null
          freight_install_setup?: number | null
          id?: string
          invoice_gross_value?: number | null
          manual_economic_status?:
            | Database["public"]["Enums"]["it_economic_status"]
            | null
          manually_edited?: boolean | null
          monthly_economic_depreciation?: number | null
          non_recoverable_taxes?: number | null
          organization_id: string
          recoverable_taxes?: number | null
          requires_finance_input?: boolean
          updated_at?: string
        }
        Update: {
          accounting_residual_value?: number | null
          accounting_useful_life_months?: number | null
          accounting_value?: number | null
          created_at?: string
          current_economic_value?: number | null
          depreciable_base?: number | null
          discounts?: number | null
          economic_residual_value?: number | null
          economic_useful_life_months?: number | null
          equipment_id?: string
          finance_completed_at?: string | null
          finance_completed_by?: string | null
          freight_install_setup?: number | null
          id?: string
          invoice_gross_value?: number | null
          manual_economic_status?:
            | Database["public"]["Enums"]["it_economic_status"]
            | null
          manually_edited?: boolean | null
          monthly_economic_depreciation?: number | null
          non_recoverable_taxes?: number | null
          organization_id?: string
          recoverable_taxes?: number | null
          requires_finance_input?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_depreciation_params_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: true
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      it_depreciation_schedule: {
        Row: {
          accumulated_accounting: number
          accumulated_economic: number
          competencia: string
          equipment_id: string
          generated_at: string
          id: string
          month_index: number
          monthly_accounting: number
          monthly_economic: number
          organization_id: string
          residual_accounting: number
          residual_economic: number
        }
        Insert: {
          accumulated_accounting?: number
          accumulated_economic?: number
          competencia: string
          equipment_id: string
          generated_at?: string
          id?: string
          month_index: number
          monthly_accounting?: number
          monthly_economic?: number
          organization_id: string
          residual_accounting?: number
          residual_economic?: number
        }
        Update: {
          accumulated_accounting?: number
          accumulated_economic?: number
          competencia?: string
          equipment_id?: string
          generated_at?: string
          id?: string
          month_index?: number
          monthly_accounting?: number
          monthly_economic?: number
          organization_id?: string
          residual_accounting?: number
          residual_economic?: number
        }
        Relationships: [
          {
            foreignKeyName: "it_depreciation_schedule_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_depreciation_schedule_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_equipment: {
        Row: {
          account_id: string | null
          acquisition_date: string | null
          acquisition_form:
            | Database["public"]["Enums"]["it_acquisition_form"]
            | null
          acquisition_value: number | null
          brand: string | null
          conservation_state:
            | Database["public"]["Enums"]["it_conservation_state"]
            | null
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          department_id: string | null
          economic_status:
            | Database["public"]["Enums"]["it_economic_status"]
            | null
          enters_patrimonial_planning: boolean | null
          equipment_type: Database["public"]["Enums"]["it_equipment_type"]
          first_installment_date: string | null
          generates_future_installments: boolean | null
          generates_recurring_cost: boolean | null
          generates_replacement_forecast: boolean | null
          id: string
          installment_value: number | null
          installments_count: number | null
          invoice_number: string | null
          location: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          patrimonial_code: string
          replacement_estimated_value: number | null
          replacement_forecast_date: string | null
          replacement_justification: string | null
          replacement_priority:
            | Database["public"]["Enums"]["it_criticality"]
            | null
          residual_value: number | null
          responsible_employee_id: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["it_equipment_status"]
          supplier_entity_id: string | null
          updated_at: string
          useful_life_accounting_months: number | null
          useful_life_economic_months: number | null
        }
        Insert: {
          account_id?: string | null
          acquisition_date?: string | null
          acquisition_form?:
            | Database["public"]["Enums"]["it_acquisition_form"]
            | null
          acquisition_value?: number | null
          brand?: string | null
          conservation_state?:
            | Database["public"]["Enums"]["it_conservation_state"]
            | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          economic_status?:
            | Database["public"]["Enums"]["it_economic_status"]
            | null
          enters_patrimonial_planning?: boolean | null
          equipment_type: Database["public"]["Enums"]["it_equipment_type"]
          first_installment_date?: string | null
          generates_future_installments?: boolean | null
          generates_recurring_cost?: boolean | null
          generates_replacement_forecast?: boolean | null
          id?: string
          installment_value?: number | null
          installments_count?: number | null
          invoice_number?: string | null
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          patrimonial_code: string
          replacement_estimated_value?: number | null
          replacement_forecast_date?: string | null
          replacement_justification?: string | null
          replacement_priority?:
            | Database["public"]["Enums"]["it_criticality"]
            | null
          residual_value?: number | null
          responsible_employee_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["it_equipment_status"]
          supplier_entity_id?: string | null
          updated_at?: string
          useful_life_accounting_months?: number | null
          useful_life_economic_months?: number | null
        }
        Update: {
          account_id?: string | null
          acquisition_date?: string | null
          acquisition_form?:
            | Database["public"]["Enums"]["it_acquisition_form"]
            | null
          acquisition_value?: number | null
          brand?: string | null
          conservation_state?:
            | Database["public"]["Enums"]["it_conservation_state"]
            | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          economic_status?:
            | Database["public"]["Enums"]["it_economic_status"]
            | null
          enters_patrimonial_planning?: boolean | null
          equipment_type?: Database["public"]["Enums"]["it_equipment_type"]
          first_installment_date?: string | null
          generates_future_installments?: boolean | null
          generates_recurring_cost?: boolean | null
          generates_replacement_forecast?: boolean | null
          id?: string
          installment_value?: number | null
          installments_count?: number | null
          invoice_number?: string | null
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          patrimonial_code?: string
          replacement_estimated_value?: number | null
          replacement_forecast_date?: string | null
          replacement_justification?: string | null
          replacement_priority?:
            | Database["public"]["Enums"]["it_criticality"]
            | null
          residual_value?: number | null
          responsible_employee_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["it_equipment_status"]
          supplier_entity_id?: string | null
          updated_at?: string
          useful_life_accounting_months?: number | null
          useful_life_economic_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "it_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_equipment_attachments: {
        Row: {
          category: string
          created_at: string
          equipment_id: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          uploaded_by: string
        }
        Insert: {
          category: string
          created_at?: string
          equipment_id: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          equipment_id?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_equipment_attachments_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      it_equipment_movements: {
        Row: {
          cost: number | null
          created_at: string
          document_path: string | null
          document_signed_at: string | null
          equipment_id: string
          from_employee_id: string | null
          from_location: string | null
          from_status: Database["public"]["Enums"]["it_equipment_status"] | null
          id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["it_movement_type"]
          notes: string | null
          organization_id: string
          performed_by: string
          reason: string | null
          to_employee_id: string | null
          to_location: string | null
          to_status: Database["public"]["Enums"]["it_equipment_status"] | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          document_path?: string | null
          document_signed_at?: string | null
          equipment_id: string
          from_employee_id?: string | null
          from_location?: string | null
          from_status?:
            | Database["public"]["Enums"]["it_equipment_status"]
            | null
          id?: string
          movement_date?: string
          movement_type: Database["public"]["Enums"]["it_movement_type"]
          notes?: string | null
          organization_id: string
          performed_by: string
          reason?: string | null
          to_employee_id?: string | null
          to_location?: string | null
          to_status?: Database["public"]["Enums"]["it_equipment_status"] | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          document_path?: string | null
          document_signed_at?: string | null
          equipment_id?: string
          from_employee_id?: string | null
          from_location?: string | null
          from_status?:
            | Database["public"]["Enums"]["it_equipment_status"]
            | null
          id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["it_movement_type"]
          notes?: string | null
          organization_id?: string
          performed_by?: string
          reason?: string | null
          to_employee_id?: string | null
          to_location?: string | null
          to_status?: Database["public"]["Enums"]["it_equipment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "it_equipment_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_equipment_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_incidents: {
        Row: {
          analyst_id: string | null
          caused_outage: boolean | null
          corrective_action: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          equipment_id: string | null
          estimated_financial_impact: number | null
          estimated_loss_value: number | null
          id: string
          incident_number: string
          incident_type: Database["public"]["Enums"]["it_incident_type"]
          insurance_claim_number: string | null
          insurance_triggered: boolean | null
          occurred_at: string
          operational_impact: Database["public"]["Enums"]["it_impact_level"]
          organization_id: string
          outage_duration_minutes: number | null
          police_report_number: string | null
          preventive_action: string | null
          recovered_value: number | null
          registered_at: string
          status: Database["public"]["Enums"]["it_incident_status"]
          system_id: string | null
          telecom_link_id: string | null
          updated_at: string
        }
        Insert: {
          analyst_id?: string | null
          caused_outage?: boolean | null
          corrective_action?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          equipment_id?: string | null
          estimated_financial_impact?: number | null
          estimated_loss_value?: number | null
          id?: string
          incident_number: string
          incident_type: Database["public"]["Enums"]["it_incident_type"]
          insurance_claim_number?: string | null
          insurance_triggered?: boolean | null
          occurred_at: string
          operational_impact?: Database["public"]["Enums"]["it_impact_level"]
          organization_id: string
          outage_duration_minutes?: number | null
          police_report_number?: string | null
          preventive_action?: string | null
          recovered_value?: number | null
          registered_at?: string
          status?: Database["public"]["Enums"]["it_incident_status"]
          system_id?: string | null
          telecom_link_id?: string | null
          updated_at?: string
        }
        Update: {
          analyst_id?: string | null
          caused_outage?: boolean | null
          corrective_action?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          equipment_id?: string | null
          estimated_financial_impact?: number | null
          estimated_loss_value?: number | null
          id?: string
          incident_number?: string
          incident_type?: Database["public"]["Enums"]["it_incident_type"]
          insurance_claim_number?: string | null
          insurance_triggered?: boolean | null
          occurred_at?: string
          operational_impact?: Database["public"]["Enums"]["it_impact_level"]
          organization_id?: string
          outage_duration_minutes?: number | null
          police_report_number?: string | null
          preventive_action?: string | null
          recovered_value?: number | null
          registered_at?: string
          status?: Database["public"]["Enums"]["it_incident_status"]
          system_id?: string | null
          telecom_link_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_incidents_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_incidents_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "it_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_incidents_telecom_link_id_fkey"
            columns: ["telecom_link_id"]
            isOneToOne: false
            referencedRelation: "it_telecom_links"
            referencedColumns: ["id"]
          },
        ]
      }
      it_sla_policies: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["it_ticket_category"] | null
          created_at: string
          created_by: string
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["it_ticket_priority"]
          resolution_hours: number
          response_hours: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["it_ticket_category"] | null
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          priority: Database["public"]["Enums"]["it_ticket_priority"]
          resolution_hours?: number
          response_hours?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["it_ticket_category"] | null
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["it_ticket_priority"]
          resolution_hours?: number
          response_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_systems: {
        Row: {
          account_id: string | null
          admin_login: string | null
          annual_value: number | null
          billing_cycle: Database["public"]["Enums"]["it_billing_cycle"]
          category: Database["public"]["Enums"]["it_system_category"]
          contract_id: string | null
          contracted_at: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          criticality: Database["public"]["Enums"]["it_criticality"] | null
          data_integrated: boolean | null
          department_id: string | null
          has_redundancy: boolean | null
          id: string
          is_essential: boolean | null
          linked_to_budget: boolean | null
          monthly_value: number | null
          name: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          renewal_date: string | null
          responsible_employee_id: string | null
          status: Database["public"]["Enums"]["it_system_status"]
          supplier_entity_id: string | null
          updated_at: string
          url: string | null
          users_count: number | null
        }
        Insert: {
          account_id?: string | null
          admin_login?: string | null
          annual_value?: number | null
          billing_cycle?: Database["public"]["Enums"]["it_billing_cycle"]
          category: Database["public"]["Enums"]["it_system_category"]
          contract_id?: string | null
          contracted_at?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          criticality?: Database["public"]["Enums"]["it_criticality"] | null
          data_integrated?: boolean | null
          department_id?: string | null
          has_redundancy?: boolean | null
          id?: string
          is_essential?: boolean | null
          linked_to_budget?: boolean | null
          monthly_value?: number | null
          name: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          renewal_date?: string | null
          responsible_employee_id?: string | null
          status?: Database["public"]["Enums"]["it_system_status"]
          supplier_entity_id?: string | null
          updated_at?: string
          url?: string | null
          users_count?: number | null
        }
        Update: {
          account_id?: string | null
          admin_login?: string | null
          annual_value?: number | null
          billing_cycle?: Database["public"]["Enums"]["it_billing_cycle"]
          category?: Database["public"]["Enums"]["it_system_category"]
          contract_id?: string | null
          contracted_at?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          criticality?: Database["public"]["Enums"]["it_criticality"] | null
          data_integrated?: boolean | null
          department_id?: string | null
          has_redundancy?: boolean | null
          id?: string
          is_essential?: boolean | null
          linked_to_budget?: boolean | null
          monthly_value?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          renewal_date?: string | null
          responsible_employee_id?: string | null
          status?: Database["public"]["Enums"]["it_system_status"]
          supplier_entity_id?: string | null
          updated_at?: string
          url?: string | null
          users_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "it_systems_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_telecom_links: {
        Row: {
          account_id: string | null
          contract_id: string | null
          contracted_at: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          fixed_ip: boolean | null
          id: string
          invoice_due_day: number | null
          link_type: Database["public"]["Enums"]["it_telecom_type"]
          linked_to_budget: boolean | null
          monthly_value: number | null
          name: string
          notes: string | null
          organization_id: string
          renewal_date: string | null
          responsible_employee_id: string | null
          sla: string | null
          speed: string | null
          status: Database["public"]["Enums"]["it_telecom_status"]
          supplier_entity_id: string | null
          unit_location: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          contract_id?: string | null
          contracted_at?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          fixed_ip?: boolean | null
          id?: string
          invoice_due_day?: number | null
          link_type: Database["public"]["Enums"]["it_telecom_type"]
          linked_to_budget?: boolean | null
          monthly_value?: number | null
          name: string
          notes?: string | null
          organization_id: string
          renewal_date?: string | null
          responsible_employee_id?: string | null
          sla?: string | null
          speed?: string | null
          status?: Database["public"]["Enums"]["it_telecom_status"]
          supplier_entity_id?: string | null
          unit_location?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          contract_id?: string | null
          contracted_at?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          fixed_ip?: boolean | null
          id?: string
          invoice_due_day?: number | null
          link_type?: Database["public"]["Enums"]["it_telecom_type"]
          linked_to_budget?: boolean | null
          monthly_value?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          renewal_date?: string | null
          responsible_employee_id?: string | null
          sla?: string | null
          speed?: string | null
          status?: Database["public"]["Enums"]["it_telecom_status"]
          supplier_entity_id?: string | null
          unit_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_telecom_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      it_ticket_comments: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          ticket_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          ticket_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "it_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      it_ticket_events: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "it_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      it_tickets: {
        Row: {
          assignee_id: string | null
          category: Database["public"]["Enums"]["it_ticket_category"]
          cost_center_id: string | null
          created_at: string
          department_id: string | null
          description: string | null
          due_at: string | null
          equipment_id: string | null
          first_response_at: string | null
          hours_spent: number | null
          id: string
          mtta_minutes: number | null
          mttr_minutes: number | null
          opened_at: string
          organization_id: string
          priority: Database["public"]["Enums"]["it_ticket_priority"]
          requester_id: string
          resolved_at: string | null
          root_cause: string | null
          sla_policy_id: string | null
          sla_resolution_breach: boolean | null
          sla_resolution_due: string | null
          sla_resolution_due_at: string | null
          sla_response_breach: boolean | null
          sla_response_due: string | null
          sla_response_due_at: string | null
          solution: string | null
          status: Database["public"]["Enums"]["it_ticket_status"]
          system_id: string | null
          telecom_link_id: string | null
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: Database["public"]["Enums"]["it_ticket_category"]
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          equipment_id?: string | null
          first_response_at?: string | null
          hours_spent?: number | null
          id?: string
          mtta_minutes?: number | null
          mttr_minutes?: number | null
          opened_at?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["it_ticket_priority"]
          requester_id: string
          resolved_at?: string | null
          root_cause?: string | null
          sla_policy_id?: string | null
          sla_resolution_breach?: boolean | null
          sla_resolution_due?: string | null
          sla_resolution_due_at?: string | null
          sla_response_breach?: boolean | null
          sla_response_due?: string | null
          sla_response_due_at?: string | null
          solution?: string | null
          status?: Database["public"]["Enums"]["it_ticket_status"]
          system_id?: string | null
          telecom_link_id?: string | null
          ticket_number: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: Database["public"]["Enums"]["it_ticket_category"]
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          equipment_id?: string | null
          first_response_at?: string | null
          hours_spent?: number | null
          id?: string
          mtta_minutes?: number | null
          mttr_minutes?: number | null
          opened_at?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["it_ticket_priority"]
          requester_id?: string
          resolved_at?: string | null
          root_cause?: string | null
          sla_policy_id?: string | null
          sla_resolution_breach?: boolean | null
          sla_resolution_due?: string | null
          sla_resolution_due_at?: string | null
          sla_response_breach?: boolean | null
          sla_response_due?: string | null
          sla_response_due_at?: string | null
          solution?: string | null
          status?: Database["public"]["Enums"]["it_ticket_status"]
          system_id?: string | null
          telecom_link_id?: string | null
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_tickets_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "it_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_tickets_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "it_sla_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_tickets_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "it_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_tickets_telecom_link_id_fkey"
            columns: ["telecom_link_id"]
            isOneToOne: false
            referencedRelation: "it_telecom_links"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_by: string | null
          changed_fields: string[] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
          process_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
          process_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          process_id?: string | null
        }
        Relationships: []
      }
      juridico_config: {
        Row: {
          account_id_acordos: string | null
          account_id_custas: string | null
          account_id_honorarios: string | null
          account_id_provisao: string | null
          alert_days_before_audiencia: number | null
          alert_days_before_prazo: number | null
          cost_center_id_default: string | null
          created_at: string
          id: string
          organization_id: string
          pct_provisao_possivel: number
          pct_provisao_provavel: number
          pct_provisao_remota: number
          updated_at: string
        }
        Insert: {
          account_id_acordos?: string | null
          account_id_custas?: string | null
          account_id_honorarios?: string | null
          account_id_provisao?: string | null
          alert_days_before_audiencia?: number | null
          alert_days_before_prazo?: number | null
          cost_center_id_default?: string | null
          created_at?: string
          id?: string
          organization_id: string
          pct_provisao_possivel?: number
          pct_provisao_provavel?: number
          pct_provisao_remota?: number
          updated_at?: string
        }
        Update: {
          account_id_acordos?: string | null
          account_id_custas?: string | null
          account_id_honorarios?: string | null
          account_id_provisao?: string | null
          alert_days_before_audiencia?: number | null
          alert_days_before_prazo?: number | null
          cost_center_id_default?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          pct_provisao_possivel?: number
          pct_provisao_provavel?: number
          pct_provisao_remota?: number
          updated_at?: string
        }
        Relationships: []
      }
      juridico_documents: {
        Row: {
          created_at: string
          id: string
          nome: string
          organization_id: string
          process_id: string
          size_bytes: number | null
          storage_path: string
          tipo: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          organization_id: string
          process_id: string
          size_bytes?: number | null
          storage_path: string
          tipo?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          organization_id?: string
          process_id?: string
          size_bytes?: number | null
          storage_path?: string
          tipo?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "juridico_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "juridico_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_expenses: {
        Row: {
          cashflow_entry_id: string | null
          created_at: string
          data_despesa: string
          data_vencimento: string | null
          descricao: string | null
          fornecedor_id: string | null
          id: string
          observacoes: string | null
          organization_id: string
          posted_to_cashflow: boolean
          process_id: string
          tipo: Database["public"]["Enums"]["juridico_expense_type"]
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          cashflow_entry_id?: string | null
          created_at?: string
          data_despesa?: string
          data_vencimento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          organization_id: string
          posted_to_cashflow?: boolean
          process_id: string
          tipo: Database["public"]["Enums"]["juridico_expense_type"]
          updated_at?: string
          user_id?: string | null
          valor: number
        }
        Update: {
          cashflow_entry_id?: string | null
          created_at?: string
          data_despesa?: string
          data_vencimento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          organization_id?: string
          posted_to_cashflow?: boolean
          process_id?: string
          tipo?: Database["public"]["Enums"]["juridico_expense_type"]
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "juridico_expenses_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "juridico_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_movements: {
        Row: {
          created_at: string
          created_by: string | null
          cumprido: boolean
          data_movimento: string
          data_prazo: string | null
          descricao: string
          id: string
          organization_id: string
          prazo_dias: number | null
          process_id: string
          tipo: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cumprido?: boolean
          data_movimento?: string
          data_prazo?: string | null
          descricao: string
          id?: string
          organization_id: string
          prazo_dias?: number | null
          process_id: string
          tipo?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cumprido?: boolean
          data_movimento?: string
          data_prazo?: string | null
          descricao?: string
          id?: string
          organization_id?: string
          prazo_dias?: number | null
          process_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "juridico_movements_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "juridico_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_processes: {
        Row: {
          advogado_responsavel: string | null
          assunto: string | null
          classe: string | null
          comarca: string | null
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          data_citacao: string | null
          data_distribuicao: string | null
          data_proxima_audiencia: string | null
          data_proximo_prazo: string | null
          escritorio_externo: string | null
          fase: string | null
          id: string
          instancia: Database["public"]["Enums"]["juridico_instancia"] | null
          natureza: Database["public"]["Enums"]["juridico_natureza"]
          numero_cnj: string | null
          numero_interno: string | null
          observacoes: string | null
          organization_id: string
          parte_contraria: string | null
          parte_contraria_documento: string | null
          polo: Database["public"]["Enums"]["juridico_polo"]
          probabilidade: Database["public"]["Enums"]["juridico_probabilidade"]
          risco_observacao: string | null
          status: Database["public"]["Enums"]["juridico_status"]
          tags: string[] | null
          tribunal: string | null
          uf: string | null
          updated_at: string
          user_id: string | null
          valor_causa: number | null
          valor_depositado: number | null
          valor_estimado_perda: number | null
          valor_provisionado: number | null
          vara: string | null
        }
        Insert: {
          advogado_responsavel?: string | null
          assunto?: string | null
          classe?: string | null
          comarca?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_proxima_audiencia?: string | null
          data_proximo_prazo?: string | null
          escritorio_externo?: string | null
          fase?: string | null
          id?: string
          instancia?: Database["public"]["Enums"]["juridico_instancia"] | null
          natureza?: Database["public"]["Enums"]["juridico_natureza"]
          numero_cnj?: string | null
          numero_interno?: string | null
          observacoes?: string | null
          organization_id: string
          parte_contraria?: string | null
          parte_contraria_documento?: string | null
          polo?: Database["public"]["Enums"]["juridico_polo"]
          probabilidade?: Database["public"]["Enums"]["juridico_probabilidade"]
          risco_observacao?: string | null
          status?: Database["public"]["Enums"]["juridico_status"]
          tags?: string[] | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          valor_causa?: number | null
          valor_depositado?: number | null
          valor_estimado_perda?: number | null
          valor_provisionado?: number | null
          vara?: string | null
        }
        Update: {
          advogado_responsavel?: string | null
          assunto?: string | null
          classe?: string | null
          comarca?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_proxima_audiencia?: string | null
          data_proximo_prazo?: string | null
          escritorio_externo?: string | null
          fase?: string | null
          id?: string
          instancia?: Database["public"]["Enums"]["juridico_instancia"] | null
          natureza?: Database["public"]["Enums"]["juridico_natureza"]
          numero_cnj?: string | null
          numero_interno?: string | null
          observacoes?: string | null
          organization_id?: string
          parte_contraria?: string | null
          parte_contraria_documento?: string | null
          polo?: Database["public"]["Enums"]["juridico_polo"]
          probabilidade?: Database["public"]["Enums"]["juridico_probabilidade"]
          risco_observacao?: string | null
          status?: Database["public"]["Enums"]["juridico_status"]
          tags?: string[] | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          valor_causa?: number | null
          valor_depositado?: number | null
          valor_estimado_perda?: number | null
          valor_provisionado?: number | null
          vara?: string | null
        }
        Relationships: []
      }
      juridico_settlement_installments: {
        Row: {
          cashflow_entry_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          organization_id: string
          settlement_id: string
          status: string
          valor: number
        }
        Insert: {
          cashflow_entry_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          organization_id: string
          settlement_id: string
          status?: string
          valor: number
        }
        Update: {
          cashflow_entry_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          organization_id?: string
          settlement_id?: string
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "juridico_settlement_installments_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "juridico_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_settlements: {
        Row: {
          aprovado_por: string | null
          created_at: string
          data_aprovacao: string | null
          data_primeira_parcela: string
          id: string
          numero_acordo: string | null
          observacoes: string | null
          organization_id: string
          process_id: string
          qtd_parcelas: number
          status: Database["public"]["Enums"]["juridico_settlement_status"]
          updated_at: string
          user_id: string | null
          valor_total: number
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_primeira_parcela: string
          id?: string
          numero_acordo?: string | null
          observacoes?: string | null
          organization_id: string
          process_id: string
          qtd_parcelas?: number
          status?: Database["public"]["Enums"]["juridico_settlement_status"]
          updated_at?: string
          user_id?: string | null
          valor_total?: number
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_primeira_parcela?: string
          id?: string
          numero_acordo?: string | null
          observacoes?: string | null
          organization_id?: string
          process_id?: string
          qtd_parcelas?: number
          status?: Database["public"]["Enums"]["juridico_settlement_status"]
          updated_at?: string
          user_id?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "juridico_settlements_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "juridico_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_period_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          range_from: string
          range_to: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          range_from: string
          range_to: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          range_from?: string
          range_to?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_period_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      liabilities: {
        Row: {
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          data_inicio: string | null
          data_vencimento: string | null
          descricao: string | null
          entity_id: string | null
          id: string
          impacto_stress: number | null
          name: string
          notes: string | null
          organization_id: string | null
          probabilidade: string | null
          status: string
          taxa_juros: number | null
          tipo: string
          updated_at: string
          user_id: string
          valor_atualizado: number
          valor_original: number
        }
        Insert: {
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_inicio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entity_id?: string | null
          id?: string
          impacto_stress?: number | null
          name: string
          notes?: string | null
          organization_id?: string | null
          probabilidade?: string | null
          status?: string
          taxa_juros?: number | null
          tipo?: string
          updated_at?: string
          user_id: string
          valor_atualizado?: number
          valor_original?: number
        }
        Update: {
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_inicio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entity_id?: string | null
          id?: string
          impacto_stress?: number | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          probabilidade?: string | null
          status?: string
          taxa_juros?: number | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_atualizado?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "liabilities_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liabilities_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liabilities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liabilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          organization_id: string
          priority: string
          read: boolean
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          organization_id: string
          priority?: string
          read?: boolean
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          priority?: string
          read?: boolean
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          assisted_start_date: string | null
          cockpit_activated: boolean | null
          completed_at: string | null
          completed_steps: number[]
          contracts_data: Json | null
          current_step: number
          diagnosis_answers: Json | null
          financial_structure_data: Json | null
          id: string
          integrations_data: Json | null
          maturity_level: number | null
          maturity_score: string | null
          organization_id: string
          planning_data: Json | null
          routines_data: Json | null
          score_dimensions: Json | null
          started_at: string | null
          status: string
          structure_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assisted_start_date?: string | null
          cockpit_activated?: boolean | null
          completed_at?: string | null
          completed_steps?: number[]
          contracts_data?: Json | null
          current_step?: number
          diagnosis_answers?: Json | null
          financial_structure_data?: Json | null
          id?: string
          integrations_data?: Json | null
          maturity_level?: number | null
          maturity_score?: string | null
          organization_id: string
          planning_data?: Json | null
          routines_data?: Json | null
          score_dimensions?: Json | null
          started_at?: string | null
          status?: string
          structure_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assisted_start_date?: string | null
          cockpit_activated?: boolean | null
          completed_at?: string | null
          completed_steps?: number[]
          contracts_data?: Json | null
          current_step?: number
          diagnosis_answers?: Json | null
          financial_structure_data?: Json | null
          id?: string
          integrations_data?: Json | null
          maturity_level?: number | null
          maturity_score?: string | null
          organization_id?: string
          planning_data?: Json | null
          routines_data?: Json | null
          score_dimensions?: Json | null
          started_at?: string | null
          status?: string
          structure_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_recommendations: {
        Row: {
          category: string
          created_at: string | null
          dismissed: boolean | null
          id: string
          message: string
          organization_id: string
          priority: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          dismissed?: boolean | null
          id?: string
          message: string
          organization_id: string
          priority?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          dismissed?: boolean | null
          id?: string
          message?: string
          organization_id?: string
          priority?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_step_config: {
        Row: {
          config: Json
          id: string
          step_number: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          step_number: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          step_number?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      org_chat_bindings: {
        Row: {
          active: boolean
          channel: string
          chat_id: string
          created_at: string
          created_by: string
          id: string
          label: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel: string
          chat_id: string
          created_at?: string
          created_by: string
          id?: string
          label: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: string
          chat_id?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chat_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_holdings: {
        Row: {
          created_at: string
          created_by: string
          holding_id: string
          id: string
          subsidiary_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          holding_id: string
          id?: string
          subsidiary_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          holding_id?: string
          id?: string
          subsidiary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_holdings_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_holdings_subsidiary_id_fkey"
            columns: ["subsidiary_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          organization_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          document_number: string
          document_type: string
          id: string
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          plano: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_number: string
          document_type?: string
          id?: string
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          plano?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_number?: string
          document_type?: string
          id?: string
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          plano?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_business_days_overrides: {
        Row: {
          business_days_used: number
          created_at: string
          employee_id: string
          id: string
          organization_id: string
          payroll_run_id: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_days_used: number
          created_at?: string
          employee_id: string
          id?: string
          organization_id: string
          payroll_run_id: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_days_used?: number
          created_at?: string
          employee_id?: string
          id?: string
          organization_id?: string
          payroll_run_id?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_business_days_overrides_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_business_days_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_business_days_overrides_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_events: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          event_type: string
          id: string
          notes: string | null
          organization_id: string
          payroll_run_id: string | null
          quantity: number | null
          reference: string | null
          reference_month: string | null
          signal: string
          unit_value: number | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          description: string
          employee_id: string
          event_type: string
          id?: string
          notes?: string | null
          organization_id: string
          payroll_run_id?: string | null
          quantity?: number | null
          reference?: string | null
          reference_month?: string | null
          signal: string
          unit_value?: number | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          event_type?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payroll_run_id?: string | null
          quantity?: number | null
          reference?: string | null
          reference_month?: string | null
          signal?: string
          unit_value?: number | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          adicionais: number | null
          comissoes: number | null
          created_at: string
          dsr: number | null
          employee_id: string
          eventos_atualizado_em: string | null
          eventos_descontos: number
          eventos_proventos: number
          faltas_desconto: number | null
          fgts: number | null
          horas_extras: number | null
          id: string
          inss_empregado: number | null
          inss_patronal: number | null
          irrf: number | null
          organization_id: string | null
          outros_descontos: number | null
          payroll_run_id: string
          salario_base: number | null
          total_bruto: number | null
          total_descontos: number | null
          total_encargos: number | null
          total_liquido: number | null
          user_id: string
          vt_desconto: number | null
        }
        Insert: {
          adicionais?: number | null
          comissoes?: number | null
          created_at?: string
          dsr?: number | null
          employee_id: string
          eventos_atualizado_em?: string | null
          eventos_descontos?: number
          eventos_proventos?: number
          faltas_desconto?: number | null
          fgts?: number | null
          horas_extras?: number | null
          id?: string
          inss_empregado?: number | null
          inss_patronal?: number | null
          irrf?: number | null
          organization_id?: string | null
          outros_descontos?: number | null
          payroll_run_id: string
          salario_base?: number | null
          total_bruto?: number | null
          total_descontos?: number | null
          total_encargos?: number | null
          total_liquido?: number | null
          user_id: string
          vt_desconto?: number | null
        }
        Update: {
          adicionais?: number | null
          comissoes?: number | null
          created_at?: string
          dsr?: number | null
          employee_id?: string
          eventos_atualizado_em?: string | null
          eventos_descontos?: number
          eventos_proventos?: number
          faltas_desconto?: number | null
          fgts?: number | null
          horas_extras?: number | null
          id?: string
          inss_empregado?: number | null
          inss_patronal?: number | null
          irrf?: number | null
          organization_id?: string | null
          outros_descontos?: number | null
          payroll_run_id?: string
          salario_base?: number | null
          total_bruto?: number | null
          total_descontos?: number | null
          total_encargos?: number | null
          total_liquido?: number | null
          user_id?: string
          vt_desconto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          locked: boolean
          notes: string | null
          organization_id: string | null
          reference_month: string
          status: string
          total_bruto: number | null
          total_descontos: number | null
          total_encargos: number | null
          total_liquido: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked?: boolean
          notes?: string | null
          organization_id?: string | null
          reference_month: string
          status?: string
          total_bruto?: number | null
          total_descontos?: number | null
          total_encargos?: number | null
          total_liquido?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          locked?: boolean
          notes?: string | null
          organization_id?: string | null
          reference_month?: string
          status?: string
          total_bruto?: number | null
          total_descontos?: number | null
          total_encargos?: number | null
          total_liquido?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_migrations: {
        Row: {
          created_at: string
          id: string
          mapping_accounts: Json | null
          mapping_cost_centers: Json | null
          notes: string | null
          organization_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapping_accounts?: Json | null
          mapping_cost_centers?: Json | null
          notes?: string | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mapping_accounts?: Json | null
          mapping_cost_centers?: Json | null
          notes?: string | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_migrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_config: {
        Row: {
          colchao_liquidez: number | null
          created_at: string
          id: string
          organization_id: string | null
          runway_alerta_meses: number | null
          saldo_minimo: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          colchao_liquidez?: number | null
          created_at?: string
          id?: string
          organization_id?: string | null
          runway_alerta_meses?: number | null
          saldo_minimo?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          colchao_liquidez?: number | null
          created_at?: string
          id?: string
          organization_id?: string | null
          runway_alerta_meses?: number | null
          saldo_minimo?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_report_exports: {
        Row: {
          budget_version_id: string | null
          budget_version_name: string | null
          created_at: string
          empty_reason: string | null
          end_date: string
          filter_labels: Json
          filters: Json
          filters_summary: string | null
          had_data: boolean
          id: string
          organization_id: string
          report_type: string
          scenario_id: string | null
          scenario_name: string | null
          start_date: string
          user_id: string
        }
        Insert: {
          budget_version_id?: string | null
          budget_version_name?: string | null
          created_at?: string
          empty_reason?: string | null
          end_date: string
          filter_labels?: Json
          filters?: Json
          filters_summary?: string | null
          had_data?: boolean
          id?: string
          organization_id: string
          report_type?: string
          scenario_id?: string | null
          scenario_name?: string | null
          start_date: string
          user_id: string
        }
        Update: {
          budget_version_id?: string | null
          budget_version_name?: string | null
          created_at?: string
          empty_reason?: string | null
          end_date?: string
          filter_labels?: Json
          filters?: Json
          filters_summary?: string | null
          had_data?: boolean
          id?: string
          organization_id?: string
          report_type?: string
          scenario_id?: string | null
          scenario_name?: string | null
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_report_exports_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_report_exports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_scenarios: {
        Row: {
          atraso_recebimento_dias: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          type: string
          updated_at: string
          user_id: string
          variacao_custos: number | null
          variacao_receita: number | null
        }
        Insert: {
          atraso_recebimento_dias?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
          variacao_custos?: number | null
          variacao_receita?: number | null
        }
        Update: {
          atraso_recebimento_dias?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          variacao_custos?: number | null
          variacao_receita?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      position_routines: {
        Row: {
          active: boolean
          calendar_event_id: string | null
          checklist: string | null
          created_at: string
          dependencies: string | null
          id: string
          integration_modules: string[] | null
          name: string
          objective: string | null
          organization_id: string | null
          periodicity: string
          position_id: string
          sla_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          calendar_event_id?: string | null
          checklist?: string | null
          created_at?: string
          dependencies?: string | null
          id?: string
          integration_modules?: string[] | null
          name: string
          objective?: string | null
          organization_id?: string | null
          periodicity?: string
          position_id: string
          sla_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          calendar_event_id?: string | null
          checklist?: string | null
          created_at?: string
          dependencies?: string | null
          id?: string
          integration_modules?: string[] | null
          name?: string
          objective?: string | null
          organization_id?: string | null
          periodicity?: string
          position_id?: string
          sla_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_routines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_routines_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          active: boolean
          approval_limits: string | null
          contract_types: string[] | null
          cost_center_id: string | null
          created_at: string
          department_id: string | null
          evidence_requirements: string | null
          id: string
          level_hierarchy: number
          name: string
          organization_id: string | null
          parent_id: string | null
          responsibilities: string | null
          salary_max: number | null
          salary_min: number | null
          substitution_rules: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          approval_limits?: string | null
          contract_types?: string[] | null
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          evidence_requirements?: string | null
          id?: string
          level_hierarchy?: number
          name: string
          organization_id?: string | null
          parent_id?: string | null
          responsibilities?: string | null
          salary_max?: number | null
          salary_min?: number | null
          substitution_rules?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          approval_limits?: string | null
          contract_types?: string[] | null
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          evidence_requirements?: string | null
          id?: string
          level_hierarchy?: number
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          responsibilities?: string | null
          salary_max?: number | null
          salary_min?: number | null
          substitution_rules?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          account_id: string | null
          active: boolean
          category: string | null
          cest: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          ncm: string | null
          organization_id: string | null
          type: string
          unit: string | null
          unit_price: number
          updated_at: string
          user_id: string
          vida_util_economica_anos: number | null
          vida_util_fiscal_anos: number | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          category?: string | null
          cest?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          ncm?: string | null
          organization_id?: string | null
          type?: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
          user_id: string
          vida_util_economica_anos?: number | null
          vida_util_fiscal_anos?: number | null
        }
        Update: {
          account_id?: string | null
          active?: boolean
          category?: string | null
          cest?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          ncm?: string | null
          organization_id?: string | null
          type?: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
          vida_util_economica_anos?: number | null
          vida_util_fiscal_anos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          cargo: string | null
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
          phone: string | null
          theme_preference: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          cargo?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          must_change_password?: boolean
          phone?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          cargo?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reconciliation_rules: {
        Row: {
          account_id: string | null
          active: boolean
          conta_bancaria_id: string | null
          cost_center_id: string | null
          created_at: string
          description_pattern: string
          entity_id: string | null
          hits: number
          id: string
          last_applied_at: string | null
          match_mode: string
          max_value: number | null
          min_value: number | null
          name: string
          organization_id: string
          priority: number
          tipo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          conta_bancaria_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description_pattern: string
          entity_id?: string | null
          hits?: number
          id?: string
          last_applied_at?: string | null
          match_mode?: string
          max_value?: number | null
          min_value?: number | null
          name: string
          organization_id: string
          priority?: number
          tipo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          conta_bancaria_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description_pattern?: string
          entity_id?: string | null
          hits?: number
          id?: string
          last_applied_at?: string | null
          match_mode?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
          organization_id?: string
          priority?: number
          tipo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_deliveries: {
        Row: {
          channel: string
          chat_binding_id: string | null
          chat_id_masked: string | null
          created_at: string
          delivery_attempt: number
          error: string | null
          escalated_from: string | null
          escalation_level: number
          external_message_id: string | null
          feedback_at: string | null
          feedback_comment: string | null
          feedback_score: string | null
          id: string
          link_opened_at: string | null
          organization_id: string
          recipient_role: string | null
          recipient_user_id: string | null
          run_id: string
          sent_at: string | null
          signed_link_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          chat_binding_id?: string | null
          chat_id_masked?: string | null
          created_at?: string
          delivery_attempt?: number
          error?: string | null
          escalated_from?: string | null
          escalation_level?: number
          external_message_id?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_score?: string | null
          id?: string
          link_opened_at?: string | null
          organization_id: string
          recipient_role?: string | null
          recipient_user_id?: string | null
          run_id: string
          sent_at?: string | null
          signed_link_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          chat_binding_id?: string | null
          chat_id_masked?: string | null
          created_at?: string
          delivery_attempt?: number
          error?: string | null
          escalated_from?: string | null
          escalation_level?: number
          external_message_id?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_score?: string | null
          id?: string
          link_opened_at?: string | null
          organization_id?: string
          recipient_role?: string | null
          recipient_user_id?: string | null
          run_id?: string
          sent_at?: string | null
          signed_link_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_deliveries_chat_binding_id_fkey"
            columns: ["chat_binding_id"]
            isOneToOne: false
            referencedRelation: "org_chat_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_escalated_from_fkey"
            columns: ["escalated_from"]
            isOneToOne: false
            referencedRelation: "report_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "report_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      report_recipients: {
        Row: {
          active: boolean
          chat_binding_id: string | null
          created_at: string
          escalation_level: number
          id: string
          mask_values_override: boolean | null
          role: string | null
          schedule_id: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          chat_binding_id?: string | null
          created_at?: string
          escalation_level?: number
          id?: string
          mask_values_override?: boolean | null
          role?: string | null
          schedule_id: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          chat_binding_id?: string | null
          created_at?: string
          escalation_level?: number
          id?: string
          mask_values_override?: boolean | null
          role?: string | null
          schedule_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_recipients_chat_binding_id_fkey"
            columns: ["chat_binding_id"]
            isOneToOne: false
            referencedRelation: "org_chat_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_recipients_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          created_by: string | null
          error: string | null
          expires_at: string | null
          generated_at: string
          id: string
          organization_id: string
          payload: Json | null
          pdf_path: string | null
          schedule_id: string | null
          signed_token: string | null
          status: string
          template_code: string
          trigger_source: string
        }
        Insert: {
          created_by?: string | null
          error?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          organization_id: string
          payload?: Json | null
          pdf_path?: string | null
          schedule_id?: string | null
          signed_token?: string | null
          status?: string
          template_code: string
          trigger_source?: string
        }
        Update: {
          created_by?: string | null
          error?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          organization_id?: string
          payload?: Json | null
          pdf_path?: string | null
          schedule_id?: string | null
          signed_token?: string | null
          status?: string
          template_code?: string
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          created_by: string
          cron: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          mask_values: boolean
          next_run_at: string | null
          notes: string | null
          organization_id: string
          severity_threshold: Json | null
          template_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cron?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          mask_values?: boolean
          next_run_at?: string | null
          notes?: string | null
          organization_id: string
          severity_threshold?: Json | null
          template_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cron?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          mask_values?: boolean
          next_run_at?: string | null
          notes?: string | null
          organization_id?: string
          severity_threshold?: Json | null
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_template_code_fkey"
            columns: ["template_code"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["code"]
          },
        ]
      }
      report_templates: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          default_payload_schema: Json | null
          default_schedule_cron: string | null
          description: string | null
          id: string
          name: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          created_at?: string
          default_payload_schema?: Json | null
          default_schedule_cron?: string | null
          description?: string | null
          id?: string
          name: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          default_payload_schema?: Json | null
          default_schedule_cron?: string | null
          description?: string | null
          id?: string
          name?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          organization_id: string | null
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          id?: string
          organization_id?: string | null
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          organization_id?: string | null
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          request_id: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          request_id: string
          type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          request_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_tasks: {
        Row: {
          approved_by: string | null
          assigned_to: string | null
          created_at: string
          created_by: string
          due_date: string | null
          executed_by: string | null
          id: string
          organization_id: string
          request_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          executed_by?: string | null
          id?: string
          organization_id: string
          request_id: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          executed_by?: string | null
          id?: string
          organization_id?: string
          request_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_tasks_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          account_id: string | null
          area_responsavel: string | null
          assigned_to: string | null
          cashflow_entry_id: string | null
          classified_at: string | null
          classified_by: string | null
          competencia: string | null
          cost_center_id: string | null
          created_at: string
          data_vencimento: string | null
          description: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          justificativa: string | null
          organization_id: string
          priority: string
          reference_id: string | null
          reference_module: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          area_responsavel?: string | null
          assigned_to?: string | null
          cashflow_entry_id?: string | null
          classified_at?: string | null
          classified_by?: string | null
          competencia?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_vencimento?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          justificativa?: string | null
          organization_id: string
          priority?: string
          reference_id?: string | null
          reference_module?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          area_responsavel?: string | null
          assigned_to?: string | null
          cashflow_entry_id?: string | null
          classified_at?: string | null
          classified_by?: string | null
          competencia?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_vencimento?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          justificativa?: string | null
          organization_id?: string
          priority?: string
          reference_id?: string | null
          reference_module?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_cashflow_entry_id_fkey"
            columns: ["cashflow_entry_id"]
            isOneToOne: false
            referencedRelation: "cashflow_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_overrides: {
        Row: {
          account_id: string | null
          cost_center_id: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string | null
          override_type: string
          scenario_id: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          account_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          override_type?: string
          scenario_id: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          account_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          override_type?: string
          scenario_id?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "scenario_overrides_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_overrides_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_overrides_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "planning_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_maturity_targets: {
        Row: {
          bank_freshness_days: number
          classification_target_pct: number
          created_at: string
          documents_required: string[]
          id: string
          organization_id: string
          overdue_critical_days: number
          overdue_max_count: number
          payroll_close_required: boolean
          period_close_required: boolean
          reconciliation_target_pct: number
          routines_overdue_tolerance_pct: number
          routines_target_pct: number
          sector: string
          updated_at: string
        }
        Insert: {
          bank_freshness_days?: number
          classification_target_pct?: number
          created_at?: string
          documents_required?: string[]
          id?: string
          organization_id: string
          overdue_critical_days?: number
          overdue_max_count?: number
          payroll_close_required?: boolean
          period_close_required?: boolean
          reconciliation_target_pct?: number
          routines_overdue_tolerance_pct?: number
          routines_target_pct?: number
          sector: string
          updated_at?: string
        }
        Update: {
          bank_freshness_days?: number
          classification_target_pct?: number
          created_at?: string
          documents_required?: string[]
          id?: string
          organization_id?: string
          overdue_critical_days?: number
          overdue_max_count?: number
          payroll_close_required?: boolean
          period_close_required?: boolean
          reconciliation_target_pct?: number
          routines_overdue_tolerance_pct?: number
          routines_target_pct?: number
          sector?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_maturity_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_onboarding: {
        Row: {
          checklist: Json
          completeness_score: number
          created_at: string
          freshness_score: number
          id: string
          last_calculated_at: string
          maturity_label: string | null
          notes: string | null
          organization_id: string
          routines_score: number
          score: number
          sector: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist?: Json
          completeness_score?: number
          created_at?: string
          freshness_score?: number
          id?: string
          last_calculated_at?: string
          maturity_label?: string | null
          notes?: string | null
          organization_id: string
          routines_score?: number
          score?: number
          sector: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist?: Json
          completeness_score?: number
          created_at?: string
          freshness_score?: number
          id?: string
          last_calculated_at?: string
          maturity_label?: string | null
          notes?: string | null
          organization_id?: string
          routines_score?: number
          score?: number
          sector?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_onboarding_history: {
        Row: {
          checklist: Json
          completeness_score: number
          created_at: string
          freshness_score: number
          id: string
          maturity_label: string | null
          organization_id: string
          period_month: string
          routines_score: number
          score: number
          sector: string
          snapshot_at: string
        }
        Insert: {
          checklist?: Json
          completeness_score?: number
          created_at?: string
          freshness_score?: number
          id?: string
          maturity_label?: string | null
          organization_id: string
          period_month: string
          routines_score?: number
          score?: number
          sector: string
          snapshot_at?: string
        }
        Update: {
          checklist?: Json
          completeness_score?: number
          created_at?: string
          freshness_score?: number
          id?: string
          maturity_label?: string | null
          organization_id?: string
          period_month?: string
          routines_score?: number
          score?: number
          sector?: string
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_onboarding_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      supplier_agreements: {
        Row: {
          created_at: string | null
          data_acordo: string | null
          descricao: string
          entity_id: string | null
          id: string
          organization_id: string | null
          status: string | null
          user_id: string
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_acordo?: string | null
          descricao: string
          entity_id?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
          user_id: string
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_acordo?: string | null
          descricao?: string
          entity_id?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
          user_id?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_agreements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_agreements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          enabled: boolean
          id: string
          label: string
          maintenance_message: string | null
          module_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          label: string
          maintenance_message?: string | null
          module_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          label?: string
          maintenance_message?: string | null
          module_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_cost_center_access: {
        Row: {
          cost_center_id: string
          created_at: string
          granted_by: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          cost_center_id: string
          created_at?: string
          granted_by: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          cost_center_id?: string
          created_at?: string
          granted_by?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cost_center_access_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cost_center_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          granted_by: string
          id: string
          module: string
          organization_id: string
          tab: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          granted_by: string
          id?: string
          module: string
          organization_id: string
          tab?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          granted_by?: string
          id?: string
          module?: string
          organization_id?: string
          tab?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      etl_jobs_unified: {
        Row: {
          created_at: string | null
          created_by: string | null
          failed_count: number | null
          finished_at: string | null
          id: string | null
          module: string | null
          ok_count: number | null
          organization_id: string | null
          origin: string | null
          pipeline_key: string | null
          skipped_count: number | null
          source: string | null
          started_at: string | null
          status: string | null
          total_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_reconciliation_rules: {
        Args: { p_only_unclassified?: boolean; p_org_id: string }
        Returns: Json
      }
      assign_backoffice_operator_to_org: {
        Args: { _org_id: string; _target_user_id: string }
        Returns: undefined
      }
      auto_reconcile_statement_batch: {
        Args: { p_limit?: number; p_min_score?: number; p_org_id: string }
        Returns: Json
      }
      change_org_member_role: {
        Args: { _new_role: string; _org_id: string; _target_user_id: string }
        Returns: undefined
      }
      check_linked_transactions: { Args: { p_user_id: string }; Returns: Json }
      crm_generate_contract_from_opportunity: {
        Args: { p_opportunity_id: string }
        Returns: string
      }
      etl_cancel_job: { Args: { p_job_id: string }; Returns: undefined }
      etl_claim_items: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          external_ref: string | null
          id: string
          idempotency_key: string
          job_id: string
          last_error: string | null
          mapped: Json | null
          max_attempts: number
          next_attempt_at: string
          organization_id: string
          processed_at: string | null
          raw: Json
          seq: number
          status: string
          target_id: string | null
          target_table: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "etl_job_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      etl_finalize_job: { Args: { p_job_id: string }; Returns: undefined }
      etl_mark_item_failure: {
        Args: { p_error: string; p_item_id: string }
        Returns: undefined
      }
      etl_mark_item_skipped: {
        Args: { p_item_id: string; p_reason?: string }
        Returns: undefined
      }
      etl_mark_item_success: {
        Args: {
          p_item_id: string
          p_mapped?: Json
          p_target_id?: string
          p_target_table?: string
        }
        Returns: undefined
      }
      etl_retry_failed: { Args: { p_job_id: string }; Returns: number }
      etl_retry_item: { Args: { p_item_id: string }; Returns: undefined }
      get_all_subsidiary_ids: {
        Args: { p_holding_id: string }
        Returns: string[]
      }
      get_cashflow_summary_by_period: {
        Args: { _from: string; _organization_id: string; _to: string }
        Returns: Json
      }
      get_dashboard_kpis: { Args: { _organization_id: string }; Returns: Json }
      get_user_org_ids: { Args: { p_user_id: string }; Returns: string[] }
      has_backoffice_org_access: { Args: { _org_id: string }; Returns: boolean }
      has_backoffice_role: { Args: { _roles: string[] }; Returns: boolean }
      has_module_access: {
        Args: {
          p_module: string
          p_org_id: string
          p_tab?: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_org_role: {
        Args: { p_org_id: string; p_roles: string[]; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_org_member: {
        Args: { _org_id: string; _role: string; _user_id: string }
        Returns: undefined
      }
      is_backoffice: { Args: never; Returns: boolean }
      is_holding: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      it_compute_tco: {
        Args: { p_from: string; p_org: string; p_to: string }
        Returns: {
          category: string
          depreciation: number
          direct_cost: number
          entity_id: string
          entity_type: string
          incident_cost: number
          movement_cost: number
          name: string
          tco_per_user: number
          tco_total: number
          users_count: number
        }[]
      }
      it_generate_depreciation_schedule: {
        Args: { p_equipment_id: string }
        Returns: Json
      }
      it_materialize_equipment_installments: {
        Args: { p_equipment_id: string }
        Returns: Json
      }
      it_materialize_recurring_costs: {
        Args: { p_months_ahead?: number; p_org_id: string }
        Returns: Json
      }
      it_tco_summary: {
        Args: { p_from: string; p_org: string; p_to: string }
        Returns: {
          category: string
          depreciation: number
          direct_cost: number
          entity_id: string
          entity_type: string
          incident_cost: number
          movement_cost: number
          name: string
          tco_per_user: number
          tco_total: number
          users_count: number
        }[]
      }
      juridico_approve_settlement: {
        Args: { p_settlement_id: string }
        Returns: Json
      }
      juridico_expense_is_posted: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      juridico_post_expense_to_cashflow: {
        Args: { p_expense_id: string }
        Returns: string
      }
      juridico_settlement_cashflow_status: {
        Args: { p_settlement_id: string }
        Returns: {
          parcelas_lancadas: number
          parcelas_total: number
        }[]
      }
      match_statement_to_cashflow: {
        Args: { p_statement_id: string }
        Returns: {
          cashflow_id: string
          data_prevista: string
          data_realizada: string
          descricao: string
          score: number
          status: string
          tipo: string
          valor_previsto: number
          valor_realizado: number
        }[]
      }
      match_statement_to_cashflow_v2: {
        Args: { p_statement_id: string }
        Returns: {
          cashflow_id: string
          data_prevista: string
          data_realizada: string
          descricao: string
          score: number
          score_data: number
          score_texto: number
          score_valor: number
          status: string
          tipo: string
          valor_previsto: number
          valor_realizado: number
        }[]
      }
      propagate_benefit_to_subsidiaries: {
        Args: { p_benefit_id: string }
        Returns: Json
      }
      recompute_payroll_item_from_events: {
        Args: { p_employee_id: string; p_run_id: string }
        Returns: undefined
      }
      recompute_payroll_run_totals: {
        Args: { p_run_id: string }
        Returns: undefined
      }
      reconcile_statement_entry: {
        Args: { p_cashflow_id: string; p_statement_id: string }
        Returns: undefined
      }
      remove_org_member: {
        Args: { _org_id: string; _target_user_id: string }
        Returns: undefined
      }
      rotate_endpoint_secret: {
        Args: { p_endpoint_id: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_bank_balances_daily: {
        Args: { p_org_id: string; p_snapshot_date?: string }
        Returns: Json
      }
      unreconcile_statement_entry: {
        Args: { p_statement_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "master" | "admin" | "user"
      bsc_frequencia: "mensal" | "trimestral" | "semestral" | "anual"
      bsc_indicator_status: "abaixo" | "parcial" | "atingido" | "superado"
      bsc_perspectiva: "financeira" | "clientes" | "processos" | "aprendizado"
      bsc_status: "em_elaboracao" | "ativo" | "encerrado"
      bsc_tipo: "individual" | "departamento" | "empresa"
      it_acquisition_form:
        | "compra_a_vista"
        | "compra_parcelada"
        | "leasing"
        | "comodato"
        | "locacao"
        | "outro"
      it_audit_action: "insert" | "update" | "delete" | "status_change"
      it_billing_cycle:
        | "mensal"
        | "anual"
        | "por_usuario"
        | "por_volume"
        | "por_consumo"
        | "vitalicio"
        | "outro"
      it_conservation_state: "novo" | "bom" | "regular" | "ruim" | "sucata"
      it_criticality: "baixa" | "media" | "alta" | "critica"
      it_economic_status:
        | "novo"
        | "em_uso_saudavel"
        | "proximo_substituicao"
        | "substituicao_recomendada"
        | "obsoleto"
      it_equipment_status:
        | "ativo"
        | "disponivel"
        | "em_uso"
        | "em_manutencao"
        | "extraviado"
        | "baixado"
        | "vendido"
        | "inativo"
      it_equipment_type:
        | "notebook"
        | "desktop"
        | "monitor"
        | "celular"
        | "tablet"
        | "impressora"
        | "roteador"
        | "servidor"
        | "nobreak"
        | "periferico"
        | "outro"
      it_impact_level: "baixo" | "medio" | "alto" | "critico"
      it_incident_status:
        | "registrado"
        | "em_analise"
        | "em_tratativa"
        | "resolvido"
        | "encerrado"
      it_incident_type:
        | "quebra_equipamento"
        | "furto"
        | "roubo"
        | "perda"
        | "dano_eletrico"
        | "dano_mau_uso"
        | "indisponibilidade_sistema"
        | "indisponibilidade_internet"
        | "vazamento_dados"
        | "acesso_indevido"
        | "ataque_cibernetico"
        | "falha_operacional"
        | "outro"
      it_movement_type:
        | "entrega"
        | "devolucao"
        | "transferencia"
        | "manutencao_envio"
        | "manutencao_retorno"
        | "baixa"
        | "venda"
        | "extravio"
        | "reativacao"
        | "outro"
      it_system_category:
        | "erp"
        | "crm"
        | "financeiro"
        | "rh"
        | "contabilidade"
        | "marketing"
        | "vendas"
        | "comunicacao"
        | "armazenamento"
        | "seguranca"
        | "bi"
        | "automacao"
        | "outro"
      it_system_status:
        | "ativo"
        | "em_teste"
        | "cancelado"
        | "suspenso"
        | "em_implantacao"
      it_telecom_status:
        | "ativo"
        | "suspenso"
        | "cancelado"
        | "em_implantacao"
        | "em_analise"
      it_telecom_type:
        | "banda_larga"
        | "link_dedicado"
        | "telefonia_fixa"
        | "telefonia_movel"
        | "chip_corporativo"
        | "vpn"
        | "mpls"
        | "outro"
      it_ticket_category:
        | "suporte_tecnico"
        | "manutencao_equipamento"
        | "solicitacao_acesso"
        | "bloqueio_acesso"
        | "instalacao_sistema"
        | "problema_sistema"
        | "problema_internet"
        | "problema_email"
        | "solicitacao_compra"
        | "solicitacao_troca"
        | "seguranca_informacao"
        | "outro"
      it_ticket_priority: "baixa" | "media" | "alta" | "critica"
      it_ticket_status:
        | "aberto"
        | "em_analise"
        | "em_atendimento"
        | "aguardando_terceiro"
        | "aguardando_solicitante"
        | "resolvido"
        | "cancelado"
      juridico_expense_type:
        | "honorario"
        | "custas"
        | "deposito_judicial"
        | "pericia"
        | "preposto"
        | "viagem"
        | "outros"
      juridico_instancia: "primeira" | "segunda" | "superior" | "extraordinaria"
      juridico_natureza:
        | "civel"
        | "trabalhista"
        | "tributario"
        | "criminal"
        | "administrativo"
        | "familia"
        | "consumidor"
        | "outros"
      juridico_polo: "ativo" | "passivo" | "terceiro_interessado"
      juridico_probabilidade: "remota" | "possivel" | "provavel"
      juridico_settlement_status:
        | "proposto"
        | "aprovado"
        | "em_pagamento"
        | "concluido"
        | "cancelado"
        | "inadimplente"
      juridico_status:
        | "ativo"
        | "suspenso"
        | "arquivado"
        | "extinto"
        | "transitado_julgado"
      nine_box_dimension: "desempenho" | "potencial"
      nine_box_recomendacao:
        | "manter"
        | "desenvolver"
        | "promover"
        | "realocar"
        | "acompanhar"
        | "desligamento_em_analise"
      nine_box_source: "gestor" | "auto" | "par"
      nine_box_status: "rascunho" | "em_calibracao" | "calibrada"
      one_on_one_humor: "muito_bom" | "bom" | "neutro" | "ruim" | "critico"
      one_on_one_status:
        | "agendada"
        | "realizada"
        | "remarcada"
        | "cancelada"
        | "pendente"
      one_on_one_tipo: "mensal" | "quinzenal" | "trimestral" | "extraordinaria"
      pdi_action_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      pdi_action_tipo:
        | "treinamento"
        | "mentoria"
        | "pratica"
        | "leitura"
        | "curso"
        | "reuniao"
        | "outro"
      pdi_status:
        | "nao_iniciado"
        | "em_andamento"
        | "em_atraso"
        | "concluido"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master", "admin", "user"],
      bsc_frequencia: ["mensal", "trimestral", "semestral", "anual"],
      bsc_indicator_status: ["abaixo", "parcial", "atingido", "superado"],
      bsc_perspectiva: ["financeira", "clientes", "processos", "aprendizado"],
      bsc_status: ["em_elaboracao", "ativo", "encerrado"],
      bsc_tipo: ["individual", "departamento", "empresa"],
      it_acquisition_form: [
        "compra_a_vista",
        "compra_parcelada",
        "leasing",
        "comodato",
        "locacao",
        "outro",
      ],
      it_audit_action: ["insert", "update", "delete", "status_change"],
      it_billing_cycle: [
        "mensal",
        "anual",
        "por_usuario",
        "por_volume",
        "por_consumo",
        "vitalicio",
        "outro",
      ],
      it_conservation_state: ["novo", "bom", "regular", "ruim", "sucata"],
      it_criticality: ["baixa", "media", "alta", "critica"],
      it_economic_status: [
        "novo",
        "em_uso_saudavel",
        "proximo_substituicao",
        "substituicao_recomendada",
        "obsoleto",
      ],
      it_equipment_status: [
        "ativo",
        "disponivel",
        "em_uso",
        "em_manutencao",
        "extraviado",
        "baixado",
        "vendido",
        "inativo",
      ],
      it_equipment_type: [
        "notebook",
        "desktop",
        "monitor",
        "celular",
        "tablet",
        "impressora",
        "roteador",
        "servidor",
        "nobreak",
        "periferico",
        "outro",
      ],
      it_impact_level: ["baixo", "medio", "alto", "critico"],
      it_incident_status: [
        "registrado",
        "em_analise",
        "em_tratativa",
        "resolvido",
        "encerrado",
      ],
      it_incident_type: [
        "quebra_equipamento",
        "furto",
        "roubo",
        "perda",
        "dano_eletrico",
        "dano_mau_uso",
        "indisponibilidade_sistema",
        "indisponibilidade_internet",
        "vazamento_dados",
        "acesso_indevido",
        "ataque_cibernetico",
        "falha_operacional",
        "outro",
      ],
      it_movement_type: [
        "entrega",
        "devolucao",
        "transferencia",
        "manutencao_envio",
        "manutencao_retorno",
        "baixa",
        "venda",
        "extravio",
        "reativacao",
        "outro",
      ],
      it_system_category: [
        "erp",
        "crm",
        "financeiro",
        "rh",
        "contabilidade",
        "marketing",
        "vendas",
        "comunicacao",
        "armazenamento",
        "seguranca",
        "bi",
        "automacao",
        "outro",
      ],
      it_system_status: [
        "ativo",
        "em_teste",
        "cancelado",
        "suspenso",
        "em_implantacao",
      ],
      it_telecom_status: [
        "ativo",
        "suspenso",
        "cancelado",
        "em_implantacao",
        "em_analise",
      ],
      it_telecom_type: [
        "banda_larga",
        "link_dedicado",
        "telefonia_fixa",
        "telefonia_movel",
        "chip_corporativo",
        "vpn",
        "mpls",
        "outro",
      ],
      it_ticket_category: [
        "suporte_tecnico",
        "manutencao_equipamento",
        "solicitacao_acesso",
        "bloqueio_acesso",
        "instalacao_sistema",
        "problema_sistema",
        "problema_internet",
        "problema_email",
        "solicitacao_compra",
        "solicitacao_troca",
        "seguranca_informacao",
        "outro",
      ],
      it_ticket_priority: ["baixa", "media", "alta", "critica"],
      it_ticket_status: [
        "aberto",
        "em_analise",
        "em_atendimento",
        "aguardando_terceiro",
        "aguardando_solicitante",
        "resolvido",
        "cancelado",
      ],
      juridico_expense_type: [
        "honorario",
        "custas",
        "deposito_judicial",
        "pericia",
        "preposto",
        "viagem",
        "outros",
      ],
      juridico_instancia: ["primeira", "segunda", "superior", "extraordinaria"],
      juridico_natureza: [
        "civel",
        "trabalhista",
        "tributario",
        "criminal",
        "administrativo",
        "familia",
        "consumidor",
        "outros",
      ],
      juridico_polo: ["ativo", "passivo", "terceiro_interessado"],
      juridico_probabilidade: ["remota", "possivel", "provavel"],
      juridico_settlement_status: [
        "proposto",
        "aprovado",
        "em_pagamento",
        "concluido",
        "cancelado",
        "inadimplente",
      ],
      juridico_status: [
        "ativo",
        "suspenso",
        "arquivado",
        "extinto",
        "transitado_julgado",
      ],
      nine_box_dimension: ["desempenho", "potencial"],
      nine_box_recomendacao: [
        "manter",
        "desenvolver",
        "promover",
        "realocar",
        "acompanhar",
        "desligamento_em_analise",
      ],
      nine_box_source: ["gestor", "auto", "par"],
      nine_box_status: ["rascunho", "em_calibracao", "calibrada"],
      one_on_one_humor: ["muito_bom", "bom", "neutro", "ruim", "critico"],
      one_on_one_status: [
        "agendada",
        "realizada",
        "remarcada",
        "cancelada",
        "pendente",
      ],
      one_on_one_tipo: ["mensal", "quinzenal", "trimestral", "extraordinaria"],
      pdi_action_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      pdi_action_tipo: [
        "treinamento",
        "mentoria",
        "pratica",
        "leitura",
        "curso",
        "reuniao",
        "outro",
      ],
      pdi_status: [
        "nao_iniciado",
        "em_andamento",
        "em_atraso",
        "concluido",
        "cancelado",
      ],
    },
  },
} as const
