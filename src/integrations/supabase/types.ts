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
      cashflow_entries: {
        Row: {
          account_id: string | null
          categoria: string | null
          contract_id: string | null
          contract_installment_id: string | null
          cost_center_id: string | null
          created_at: string
          data_prevista: string
          data_realizada: string | null
          descricao: string
          entity_id: string | null
          id: string
          notes: string | null
          organization_id: string | null
          source: string
          status: string
          tipo: string
          updated_at: string
          user_id: string
          valor_previsto: number
          valor_realizado: number | null
        }
        Insert: {
          account_id?: string | null
          categoria?: string | null
          contract_id?: string | null
          contract_installment_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_prevista: string
          data_realizada?: string | null
          descricao: string
          entity_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          source?: string
          status?: string
          tipo?: string
          updated_at?: string
          user_id: string
          valor_previsto?: number
          valor_realizado?: number | null
        }
        Update: {
          account_id?: string | null
          categoria?: string | null
          contract_id?: string | null
          contract_installment_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          data_prevista?: string
          data_realizada?: string | null
          descricao?: string
          entity_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          source?: string
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "cashflow_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          vencimento: string
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
          vencimento: string
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
          vencimento?: string
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
      dp_benefits: {
        Row: {
          active: boolean
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
      dp_config: {
        Row: {
          created_at: string
          fgts_pct: number | null
          id: string
          inss_patronal_pct: number | null
          organization_id: string | null
          provisao_13_pct: number | null
          provisao_ferias_pct: number | null
          rat_pct: number | null
          terceiros_pct: number | null
          updated_at: string
          user_id: string
          vt_desconto_pct: number | null
        }
        Insert: {
          created_at?: string
          fgts_pct?: number | null
          id?: string
          inss_patronal_pct?: number | null
          organization_id?: string | null
          provisao_13_pct?: number | null
          provisao_ferias_pct?: number | null
          rat_pct?: number | null
          terceiros_pct?: number | null
          updated_at?: string
          user_id: string
          vt_desconto_pct?: number | null
        }
        Update: {
          created_at?: string
          fgts_pct?: number | null
          id?: string
          inss_patronal_pct?: number | null
          organization_id?: string | null
          provisao_13_pct?: number | null
          provisao_ferias_pct?: number | null
          rat_pct?: number | null
          terceiros_pct?: number | null
          updated_at?: string
          user_id?: string
          vt_desconto_pct?: number | null
        }
        Relationships: [
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
      employee_terminations: {
        Row: {
          aviso_previo: number | null
          created_at: string
          decimo_terceiro_proporcional: number | null
          employee_id: string
          ferias_proporcionais: number | null
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
          created_at?: string
          decimo_terceiro_proporcional?: number | null
          employee_id: string
          ferias_proporcionais?: number | null
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
          created_at?: string
          decimo_terceiro_proporcional?: number | null
          employee_id?: string
          ferias_proporcionais?: number | null
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
          organization_id: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          provisao_mensal: number | null
          status: string
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
          organization_id?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          provisao_mensal?: number | null
          status?: string
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
          organization_id?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          provisao_mensal?: number | null
          status?: string
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
      payroll_items: {
        Row: {
          adicionais: number | null
          comissoes: number | null
          created_at: string
          dsr: number | null
          employee_id: string
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
          cargo: string | null
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          cargo?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          cargo?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      check_linked_transactions: { Args: { p_user_id: string }; Returns: Json }
      get_user_org_ids: { Args: { p_user_id: string }; Returns: string[] }
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
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "master" | "admin" | "user"
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
    },
  },
} as const
