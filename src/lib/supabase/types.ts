// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.4'
  }
  public: {
    Tables: {
      ccb_solicitacoes: {
        Row: {
          admin_notes: string | null
          bdigital_response_file: string | null
          borrower_data: Json
          created_at: string
          docs_paths: Json
          guarantees_data: Json
          id: string
          operation_data: Json
          pdf_file_path: string | null
          requested_value: number
          status: string
          term_months: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          bdigital_response_file?: string | null
          borrower_data?: Json
          created_at?: string
          docs_paths?: Json
          guarantees_data?: Json
          id?: string
          operation_data?: Json
          pdf_file_path?: string | null
          requested_value: number
          status?: string
          term_months: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          bdigital_response_file?: string | null
          borrower_data?: Json
          created_at?: string
          docs_paths?: Json
          guarantees_data?: Json
          id?: string
          operation_data?: Json
          pdf_file_path?: string | null
          requested_value?: number
          status?: string
          term_months?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ccb_solicitacoes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      access_logs: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      border_items: {
        Row: {
          acquisition_value: number
          border_id: string
          created_at: string
          document_number: string
          due_date: string | null
          face_value: number
          id: string
          rate: string | null
        }
        Insert: {
          acquisition_value: number
          border_id: string
          created_at?: string
          document_number: string
          due_date?: string | null
          face_value: number
          id?: string
          rate?: string | null
        }
        Update: {
          acquisition_value?: number
          border_id?: string
          created_at?: string
          document_number?: string
          due_date?: string | null
          face_value?: number
          id?: string
          rate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'border_items_border_id_fkey'
            columns: ['border_id']
            isOneToOne: false
            referencedRelation: 'borders'
            referencedColumns: ['id']
          },
        ]
      }
      borders: {
        Row: {
          amount: number
          border_number: string
          cedente: string
          created_at: string
          id: string
          items_count: number | null
          status: string
        }
        Insert: {
          amount: number
          border_number: string
          cedente: string
          created_at?: string
          id?: string
          items_count?: number | null
          status: string
        }
        Update: {
          amount?: number
          border_number?: string
          cedente?: string
          created_at?: string
          id?: string
          items_count?: number | null
          status?: string
        }
        Relationships: []
      }
      company_bank_accounts: {
        Row: {
          account_number: string | null
          bank_code: string | null
          bank_name: string
          branch: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          owner_document: string
          owner_name: string
          pix_key: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_number?: string | null
          bank_code?: string | null
          bank_name: string
          branch?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          owner_document: string
          owner_name: string
          pix_key?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string
          branch?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          owner_document?: string
          owner_name?: string
          pix_key?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      contract_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string
          file_path: string
          id: string
          operation_id: string | null
          reason: string | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name: string
          file_path: string
          id?: string
          operation_id?: string | null
          reason?: string | null
          version_number?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          file_path?: string
          id?: string
          operation_id?: string | null
          reason?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'contract_versions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contract_versions_operation_id_fkey'
            columns: ['operation_id']
            isOneToOne: false
            referencedRelation: 'credit_operations'
            referencedColumns: ['id']
          },
        ]
      }
      credit_operations: {
        Row: {
          borrower_id: string
          cedente: string
          created_at: string | null
          document_number: string
          due_date: string
          face_value: number
          id: string
          installments: number | null
          issue_date: string
          observations: string | null
          receivable_type: string
          receivable_type_other: string | null
          requested_value: number
          sacado: string
          signature_envelope_id: string | null
          signature_status: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          borrower_id: string
          cedente: string
          created_at?: string | null
          document_number: string
          due_date: string
          face_value: number
          id?: string
          installments?: number | null
          issue_date: string
          observations?: string | null
          receivable_type: string
          receivable_type_other?: string | null
          requested_value: number
          sacado: string
          signature_envelope_id?: string | null
          signature_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          borrower_id?: string
          cedente?: string
          created_at?: string | null
          document_number?: string
          due_date?: string
          face_value?: number
          id?: string
          installments?: number | null
          issue_date?: string
          observations?: string | null
          receivable_type?: string
          receivable_type_other?: string | null
          requested_value?: number
          sacado?: string
          signature_envelope_id?: string | null
          signature_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'credit_operations_borrower_id_fkey'
            columns: ['borrower_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      debenture_series: {
        Row: {
          created_at: string
          debenture_id: string
          id: string
          indexer: string
          maturity_date: string | null
          rate: number
          series_number: string
          volume: number
        }
        Insert: {
          created_at?: string
          debenture_id: string
          id?: string
          indexer: string
          maturity_date?: string | null
          rate: number
          series_number: string
          volume: number
        }
        Update: {
          created_at?: string
          debenture_id?: string
          id?: string
          indexer?: string
          maturity_date?: string | null
          rate?: number
          series_number?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: 'debenture_series_debenture_id_fkey'
            columns: ['debenture_id']
            isOneToOne: false
            referencedRelation: 'debentures'
            referencedColumns: ['id']
          },
        ]
      }
      debenture_subscriptions: {
        Row: {
          created_at: string
          document_number: string | null
          id: string
          investor_name: string
          quantity: number
          series_id: string
          subscription_date: string | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          id?: string
          investor_name: string
          quantity?: number
          series_id: string
          subscription_date?: string | null
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          document_number?: string | null
          id?: string
          investor_name?: string
          quantity?: number
          series_id?: string
          subscription_date?: string | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'debenture_subscriptions_series_id_fkey'
            columns: ['series_id']
            isOneToOne: false
            referencedRelation: 'debenture_series'
            referencedColumns: ['id']
          },
        ]
      }
      debentures: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          issue_date: string | null
          issuer_name: string
          total_volume: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string | null
          issuer_name: string
          total_volume: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string | null
          issuer_name?: string
          total_volume?: number
        }
        Relationships: []
      }
      financial_parameters: {
        Row: {
          ad_valorem_base: string | null
          ad_valorem_rate: number | null
          analysis_fee: number | null
          analysis_fee_type: string | null
          collection_fee: number | null
          default_interest_rate: number | null
          discount_rate_monthly: number | null
          grace_period_days: number | null
          id: string
          interest_rate_monthly: number | null
          iof_daily_rate: number | null
          iof_fixed_rate: number | null
          max_operation_value: number | null
          max_term_days: number | null
          min_operation_value: number | null
          min_term_days: number | null
          penalty_rate: number | null
          receivable_type: string
          structuring_fee: number | null
          structuring_fee_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ad_valorem_base?: string | null
          ad_valorem_rate?: number | null
          analysis_fee?: number | null
          analysis_fee_type?: string | null
          collection_fee?: number | null
          default_interest_rate?: number | null
          discount_rate_monthly?: number | null
          grace_period_days?: number | null
          id?: string
          interest_rate_monthly?: number | null
          iof_daily_rate?: number | null
          iof_fixed_rate?: number | null
          max_operation_value?: number | null
          max_term_days?: number | null
          min_operation_value?: number | null
          min_term_days?: number | null
          penalty_rate?: number | null
          receivable_type: string
          structuring_fee?: number | null
          structuring_fee_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ad_valorem_base?: string | null
          ad_valorem_rate?: number | null
          analysis_fee?: number | null
          analysis_fee_type?: string | null
          collection_fee?: number | null
          default_interest_rate?: number | null
          discount_rate_monthly?: number | null
          grace_period_days?: number | null
          id?: string
          interest_rate_monthly?: number | null
          iof_daily_rate?: number | null
          iof_fixed_rate?: number | null
          max_operation_value?: number | null
          max_term_days?: number | null
          min_operation_value?: number | null
          min_term_days?: number | null
          penalty_rate?: number | null
          receivable_type?: string
          structuring_fee?: number | null
          structuring_fee_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'financial_parameters_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      investment_products: {
        Row: {
          application_cotization_months: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          financial_settlement: string | null
          global_quotas: number | null
          grace_period: string | null
          id: string
          ir_rules: string | null
          is_active: boolean | null
          is_archived: boolean | null
          is_highlighted: boolean | null
          management_policy: string | null
          manager: string | null
          max_quotas_per_investor: number | null
          min_investment: number
          min_quotas_per_investor: number | null
          offer_end_date: string | null
          offer_start_date: string | null
          progress: number | null
          quota_value: number | null
          rate: string
          rating: string | null
          redemption_cotization_months: number | null
          redemption_rules: string | null
          risk: string
          series_id: string | null
          sold_quotas: number | null
          status: string
          target_audience: string | null
          term: string
          title: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          application_cotization_months?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          financial_settlement?: string | null
          global_quotas?: number | null
          grace_period?: string | null
          id?: string
          ir_rules?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_highlighted?: boolean | null
          management_policy?: string | null
          manager?: string | null
          max_quotas_per_investor?: number | null
          min_investment: number
          min_quotas_per_investor?: number | null
          offer_end_date?: string | null
          offer_start_date?: string | null
          progress?: number | null
          quota_value?: number | null
          rate: string
          rating?: string | null
          redemption_cotization_months?: number | null
          redemption_rules?: string | null
          risk: string
          series_id?: string | null
          sold_quotas?: number | null
          status: string
          target_audience?: string | null
          term: string
          title: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          application_cotization_months?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          financial_settlement?: string | null
          global_quotas?: number | null
          grace_period?: string | null
          id?: string
          ir_rules?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_highlighted?: boolean | null
          management_policy?: string | null
          manager?: string | null
          max_quotas_per_investor?: number | null
          min_investment?: number
          min_quotas_per_investor?: number | null
          offer_end_date?: string | null
          offer_start_date?: string | null
          progress?: number | null
          quota_value?: number | null
          rate?: string
          rating?: string | null
          redemption_cotization_months?: number | null
          redemption_rules?: string | null
          risk?: string
          series_id?: string | null
          sold_quotas?: number | null
          status?: string
          target_audience?: string | null
          term?: string
          title?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'investment_products_series_id_fkey'
            columns: ['series_id']
            isOneToOne: false
            referencedRelation: 'debenture_series'
            referencedColumns: ['id']
          },
        ]
      }
      investment_proofs: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          investment_id: string
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          investment_id: string
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          investment_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'investment_proofs_investment_id_fkey'
            columns: ['investment_id']
            isOneToOne: false
            referencedRelation: 'investments'
            referencedColumns: ['id']
          },
        ]
      }
      investments: {
        Row: {
          bank_account_id: string | null
          created_at: string | null
          id: string
          product_id: string
          quotas: number
          rejection_reason: string | null
          status: string | null
          total_value: number
          transfer_date: string | null
          transfer_value: number | null
          unit_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          quotas: number
          rejection_reason?: string | null
          status?: string | null
          total_value: number
          transfer_date?: string | null
          transfer_value?: number | null
          unit_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          quotas?: number
          rejection_reason?: string | null
          status?: string | null
          total_value?: number
          transfer_date?: string | null
          transfer_value?: number | null
          unit_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'investments_bank_account_id_fkey'
            columns: ['bank_account_id']
            isOneToOne: false
            referencedRelation: 'company_bank_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'investments_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'investment_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'investments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      kyc_documents: {
        Row: {
          document_type: string
          file_path: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          document_type: string
          file_path: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          document_type?: string
          file_path?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      operation_calculations: {
        Row: {
          ad_valorem_value: number | null
          analysis_value: number | null
          calculated_at: string | null
          calculation_memory: Json | null
          discount_value: number | null
          effective_cost_rate: number | null
          id: string
          interest_value: number | null
          iof_daily_value: number | null
          iof_fixed_value: number | null
          net_value: number | null
          operation_id: string | null
          structuring_value: number | null
          term_days: number | null
          total_discounts: number | null
        }
        Insert: {
          ad_valorem_value?: number | null
          analysis_value?: number | null
          calculated_at?: string | null
          calculation_memory?: Json | null
          discount_value?: number | null
          effective_cost_rate?: number | null
          id?: string
          interest_value?: number | null
          iof_daily_value?: number | null
          iof_fixed_value?: number | null
          net_value?: number | null
          operation_id?: string | null
          structuring_value?: number | null
          term_days?: number | null
          total_discounts?: number | null
        }
        Update: {
          ad_valorem_value?: number | null
          analysis_value?: number | null
          calculated_at?: string | null
          calculation_memory?: Json | null
          discount_value?: number | null
          effective_cost_rate?: number | null
          id?: string
          interest_value?: number | null
          iof_daily_value?: number | null
          iof_fixed_value?: number | null
          net_value?: number | null
          operation_id?: string | null
          structuring_value?: number | null
          term_days?: number | null
          total_discounts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'operation_calculations_operation_id_fkey'
            columns: ['operation_id']
            isOneToOne: true
            referencedRelation: 'credit_operations'
            referencedColumns: ['id']
          },
        ]
      }
      operation_documents: {
        Row: {
          category: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          operation_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          operation_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          operation_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'operation_documents_operation_id_fkey'
            columns: ['operation_id']
            isOneToOne: false
            referencedRelation: 'credit_operations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'operation_documents_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      operation_status_history: {
        Row: {
          borrower_observation: string | null
          changed_at: string | null
          changed_by: string | null
          id: string
          internal_observation: string | null
          new_status: string
          old_status: string | null
          operation_id: string | null
        }
        Insert: {
          borrower_observation?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          internal_observation?: string | null
          new_status: string
          old_status?: string | null
          operation_id?: string | null
        }
        Update: {
          borrower_observation?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          internal_observation?: string | null
          new_status?: string
          old_status?: string | null
          operation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'operation_status_history_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'operation_status_history_operation_id_fkey'
            columns: ['operation_id']
            isOneToOne: false
            referencedRelation: 'credit_operations'
            referencedColumns: ['id']
          },
        ]
      }
      parameter_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changes: Json
          id: string
          parameter_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changes: Json
          id?: string
          parameter_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changes?: Json
          id?: string
          parameter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'parameter_history_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parameter_history_parameter_id_fkey'
            columns: ['parameter_id']
            isOneToOne: false
            referencedRelation: 'financial_parameters'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          avatar_url: string | null
          created_at: string | null
          credit_limit: number | null
          document_number: string | null
          email: string | null
          entity_type: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_borrower: boolean | null
          is_investor: boolean | null
          is_pep: boolean | null
          is_staff: boolean | null
          kyc_status: Database['public']['Enums']['kyc_status'] | null
          lgpd_accepted: boolean | null
          lgpd_accepted_at: string | null
          pf_birth_city: string | null
          pf_father_name: string | null
          pf_marital_status: string | null
          pf_mother_name: string | null
          pf_nationality: string | null
          pf_occupation: string | null
          pf_rg: string | null
          phone: string | null
          pj_annual_revenue: number | null
          pj_cnae: string | null
          pj_company_name: string | null
          pj_foundation_date: string | null
          pj_rep_cpf: string | null
          pj_rep_is_procurator: boolean | null
          pj_rep_name: string | null
          pj_rep_rg: string | null
          pj_rep_role: string | null
          pj_tax_regime: string | null
          pj_trade_name: string | null
          requires_password_change: boolean | null
          role: Database['public']['Enums']['app_role']
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          created_at?: string | null
          credit_limit?: number | null
          document_number?: string | null
          email?: string | null
          entity_type?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          is_borrower?: boolean | null
          is_investor?: boolean | null
          is_pep?: boolean | null
          is_staff?: boolean | null
          kyc_status?: Database['public']['Enums']['kyc_status'] | null
          lgpd_accepted?: boolean | null
          lgpd_accepted_at?: string | null
          pf_birth_city?: string | null
          pf_father_name?: string | null
          pf_marital_status?: string | null
          pf_mother_name?: string | null
          pf_nationality?: string | null
          pf_occupation?: string | null
          pf_rg?: string | null
          phone?: string | null
          pj_annual_revenue?: number | null
          pj_cnae?: string | null
          pj_company_name?: string | null
          pj_foundation_date?: string | null
          pj_rep_cpf?: string | null
          pj_rep_is_procurator?: boolean | null
          pj_rep_name?: string | null
          pj_rep_rg?: string | null
          pj_rep_role?: string | null
          pj_tax_regime?: string | null
          pj_trade_name?: string | null
          requires_password_change?: boolean | null
          role?: Database['public']['Enums']['app_role']
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          created_at?: string | null
          credit_limit?: number | null
          document_number?: string | null
          email?: string | null
          entity_type?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_borrower?: boolean | null
          is_investor?: boolean | null
          is_pep?: boolean | null
          is_staff?: boolean | null
          kyc_status?: Database['public']['Enums']['kyc_status'] | null
          lgpd_accepted?: boolean | null
          lgpd_accepted_at?: string | null
          pf_birth_city?: string | null
          pf_father_name?: string | null
          pf_marital_status?: string | null
          pf_mother_name?: string | null
          pf_nationality?: string | null
          pf_occupation?: string | null
          pf_rg?: string | null
          phone?: string | null
          pj_annual_revenue?: number | null
          pj_cnae?: string | null
          pj_company_name?: string | null
          pj_foundation_date?: string | null
          pj_rep_cpf?: string | null
          pj_rep_is_procurator?: boolean | null
          pj_rep_name?: string | null
          pj_rep_rg?: string | null
          pj_rep_role?: string | null
          pj_tax_regime?: string | null
          pj_trade_name?: string | null
          requires_password_change?: boolean | null
          role?: Database['public']['Enums']['app_role']
          updated_at?: string | null
        }
        Relationships: []
      }
      risk_analysis_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          operation_id: string | null
          raw_serasa_data: Json | null
          risk_level: string | null
          serasa_score: number | null
          sio_score: number | null
          triggers: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          operation_id?: string | null
          raw_serasa_data?: Json | null
          risk_level?: string | null
          serasa_score?: number | null
          sio_score?: number | null
          triggers?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          operation_id?: string | null
          raw_serasa_data?: Json | null
          risk_level?: string | null
          serasa_score?: number | null
          sio_score?: number | null
          triggers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'risk_analysis_history_operation_id_fkey'
            columns: ['operation_id']
            isOneToOne: false
            referencedRelation: 'credit_operations'
            referencedColumns: ['id']
          },
        ]
      }
      serasa_consultations: {
        Row: {
          created_at: string
          document_number: string
          id: string
          raw_response: Json
          risk_level: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          document_number: string
          id?: string
          raw_response: Json
          risk_level: string
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          document_number?: string
          id?: string
          raw_response?: Json
          risk_level?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      user_bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          bank_code: string
          bank_name: string
          branch: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          owner_document: string
          owner_name: string
          pix_key: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type: string
          bank_code: string
          bank_name: string
          branch?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          owner_document: string
          owner_name: string
          pix_key?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          bank_code?: string
          bank_name?: string
          branch?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          owner_document?: string
          owner_name?: string
          pix_key?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_bank_accounts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_investment: {
        Args: { p_investment_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      set_active_bank_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      set_active_user_bank_account: {
        Args: { p_account_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: 'admin' | 'investor' | 'borrower' | 'staff'
      kyc_status: 'pending' | 'under_review' | 'approved' | 'rejected'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ['admin', 'investor', 'borrower', 'staff'],
      kyc_status: ['pending', 'under_review', 'approved', 'rejected'],
    },
  },
} as const
