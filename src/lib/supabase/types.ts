// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.4'
  }
  public: {
    Tables: {
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
      ccb_avalistas: {
        Row: {
          address: string | null
          ccb_id: string
          created_at: string | null
          docs_paths: Json | null
          document: string
          id: string
          income: number | null
          name: string
          phone: string | null
          relationship: string | null
        }
        Insert: {
          address?: string | null
          ccb_id: string
          created_at?: string | null
          docs_paths?: Json | null
          document: string
          id?: string
          income?: number | null
          name: string
          phone?: string | null
          relationship?: string | null
        }
        Update: {
          address?: string | null
          ccb_id?: string
          created_at?: string | null
          docs_paths?: Json | null
          document?: string
          id?: string
          income?: number | null
          name?: string
          phone?: string | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ccb_avalistas_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: false
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
        ]
      }
      ccb_avalistas_documentos: {
        Row: {
          ccb_id: string | null
          created_at: string | null
          id: string
          nome_arquivo: string
          url: string
        }
        Insert: {
          ccb_id?: string | null
          created_at?: string | null
          id?: string
          nome_arquivo: string
          url: string
        }
        Update: {
          ccb_id?: string | null
          created_at?: string | null
          id?: string
          nome_arquivo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ccb_avalistas_documentos_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: false
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
        ]
      }
      ccb_conjuges: {
        Row: {
          ccb_id: string
          created_at: string | null
          dob: string | null
          document: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          ccb_id: string
          created_at?: string | null
          dob?: string | null
          document: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          ccb_id?: string
          created_at?: string | null
          dob?: string | null
          document?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ccb_conjuges_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: false
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
        ]
      }
      ccb_solicitacoes: {
        Row: {
          admin_notes: string | null
          bdigital_response_file: string | null
          borrower_data: Json
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      config_ccb: {
        Row: {
          created_at: string
          fixed_emission_cost: number
          id: string
          interest_rate_annual: number
          interest_rate_monthly: number
          iof_daily_rate_30: number
          iof_daily_rate_after: number
          iof_rate: number
          irrf_rate: number
          max_term_months: number
          multiplier_factor: number
          partner_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixed_emission_cost?: number
          id?: string
          interest_rate_annual?: number
          interest_rate_monthly?: number
          iof_daily_rate_30?: number
          iof_daily_rate_after?: number
          iof_rate?: number
          irrf_rate?: number
          max_term_months?: number
          multiplier_factor?: number
          partner_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixed_emission_cost?: number
          id?: string
          interest_rate_annual?: number
          interest_rate_monthly?: number
          iof_daily_rate_30?: number
          iof_daily_rate_after?: number
          iof_rate?: number
          irrf_rate?: number
          max_term_months?: number
          multiplier_factor?: number
          partner_name?: string
          updated_at?: string
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
          liquidation_date: string | null
          liquidation_value: number | null
          observations: string | null
          payment_receipt_url: string | null
          receivable_type: string
          receivable_type_other: string | null
          requested_value: number
          sacado: string
          sacado_document: string | null
          sacado_email: string | null
          sacado_phone: string | null
          signature_envelope_id: string | null
          signature_status: string | null
          signature_url: string | null
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
          liquidation_date?: string | null
          liquidation_value?: number | null
          observations?: string | null
          payment_receipt_url?: string | null
          receivable_type: string
          receivable_type_other?: string | null
          requested_value: number
          sacado: string
          sacado_document?: string | null
          sacado_email?: string | null
          sacado_phone?: string | null
          signature_envelope_id?: string | null
          signature_status?: string | null
          signature_url?: string | null
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
          liquidation_date?: string | null
          liquidation_value?: number | null
          observations?: string | null
          payment_receipt_url?: string | null
          receivable_type?: string
          receivable_type_other?: string | null
          requested_value?: number
          sacado?: string
          sacado_document?: string | null
          sacado_email?: string | null
          sacado_phone?: string | null
          signature_envelope_id?: string | null
          signature_status?: string | null
          signature_url?: string | null
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
      dados_bancarios_ccb: {
        Row: {
          account: string | null
          bank: string | null
          branch: string | null
          ccb_id: string | null
          created_at: string | null
          docs_paths: Json | null
          id: string
          owner_document: string | null
          owner_name: string | null
          pix_key: string | null
          user_id: string | null
        }
        Insert: {
          account?: string | null
          bank?: string | null
          branch?: string | null
          ccb_id?: string | null
          created_at?: string | null
          docs_paths?: Json | null
          id?: string
          owner_document?: string | null
          owner_name?: string | null
          pix_key?: string | null
          user_id?: string | null
        }
        Update: {
          account?: string | null
          bank?: string | null
          branch?: string | null
          ccb_id?: string | null
          created_at?: string | null
          docs_paths?: Json | null
          id?: string
          owner_document?: string | null
          owner_name?: string | null
          pix_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'dados_bancarios_ccb_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: false
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
        ]
      }
      debenture_series: {
        Row: {
          created_at: string
          debenture_id: string
          id: string
          indexer: string | null
          maturity_date: string | null
          rate: number
          series_number: string
          volume: number
        }
        Insert: {
          created_at?: string
          debenture_id: string
          id?: string
          indexer?: string | null
          maturity_date?: string | null
          rate: number
          series_number: string
          volume: number
        }
        Update: {
          created_at?: string
          debenture_id?: string
          id?: string
          indexer?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
          document_number: string | null
          id: string
          investment_id: string | null
          investor_name: string
          quantity: number
          series_id: string
          status: string | null
          subscription_date: string | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_number?: string | null
          id?: string
          investment_id?: string | null
          investor_name: string
          quantity?: number
          series_id: string
          status?: string | null
          subscription_date?: string | null
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_number?: string | null
          id?: string
          investment_id?: string | null
          investor_name?: string
          quantity?: number
          series_id?: string
          status?: string | null
          subscription_date?: string | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'debenture_subscriptions_investment_id_fkey'
            columns: ['investment_id']
            isOneToOne: false
            referencedRelation: 'investments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'debenture_subscriptions_investment_id_fkey'
            columns: ['investment_id']
            isOneToOne: false
            referencedRelation: 'investments_view'
            referencedColumns: ['id']
          },
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
      expenses: {
        Row: {
          amount: number
          category: string
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string
          id: string
          invoice_file_path: string | null
          payment_date: string | null
          status: string | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          invoice_file_path?: string | null
          payment_date?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          invoice_file_path?: string | null
          payment_date?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'transaction_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
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
          allow_early_redemption: boolean | null
          application_cotization_months: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          early_redemption_discount_pct: number | null
          early_redemption_penalty_pct: number | null
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
          min_grace_period_months: number | null
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
          yield_split_pct: number
        }
        Insert: {
          allow_early_redemption?: boolean | null
          application_cotization_months?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          early_redemption_discount_pct?: number | null
          early_redemption_penalty_pct?: number | null
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
          min_grace_period_months?: number | null
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
          yield_split_pct?: number
        }
        Update: {
          allow_early_redemption?: boolean | null
          application_cotization_months?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          early_redemption_discount_pct?: number | null
          early_redemption_penalty_pct?: number | null
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
          min_grace_period_months?: number | null
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
          yield_split_pct?: number
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
          {
            foreignKeyName: 'investment_proofs_investment_id_fkey'
            columns: ['investment_id']
            isOneToOne: false
            referencedRelation: 'investments_view'
            referencedColumns: ['id']
          },
        ]
      }
      investment_redemptions: {
        Row: {
          created_at: string | null
          discount_applied: number | null
          gross_value: number
          id: string
          investment_id: string | null
          is_reinvestment: boolean | null
          net_value: number
          penalty_applied: number | null
          reinvestment_product_id: string | null
          reinvestment_quotas: number | null
          rejection_reason: string | null
          requested_quotas: number
          status: string | null
          tax_amount: number | null
          tax_rate: number | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          yield_amount: number | null
        }
        Insert: {
          created_at?: string | null
          discount_applied?: number | null
          gross_value: number
          id?: string
          investment_id?: string | null
          is_reinvestment?: boolean | null
          net_value: number
          penalty_applied?: number | null
          reinvestment_product_id?: string | null
          reinvestment_quotas?: number | null
          rejection_reason?: string | null
          requested_quotas: number
          status?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          yield_amount?: number | null
        }
        Update: {
          created_at?: string | null
          discount_applied?: number | null
          gross_value?: number
          id?: string
          investment_id?: string | null
          is_reinvestment?: boolean | null
          net_value?: number
          penalty_applied?: number | null
          reinvestment_product_id?: string | null
          reinvestment_quotas?: number | null
          rejection_reason?: string | null
          requested_quotas?: number
          status?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          yield_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'investment_redemptions_investment_id_fkey'
            columns: ['investment_id']
            isOneToOne: false
            referencedRelation: 'investments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'investment_redemptions_investment_id_fkey'
            columns: ['investment_id']
            isOneToOne: false
            referencedRelation: 'investments_view'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'investment_redemptions_reinvestment_product_id_fkey'
            columns: ['reinvestment_product_id']
            isOneToOne: false
            referencedRelation: 'investment_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'investment_redemptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      investments: {
        Row: {
          bank_account_id: string | null
          contract_url: string | null
          created_at: string | null
          id: string
          product_id: string
          quotas: number
          redeemed_quotas: number | null
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
          contract_url?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          quotas: number
          redeemed_quotas?: number | null
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
          contract_url?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          quotas?: number
          redeemed_quotas?: number | null
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
      manual_yield_entries: {
        Row: {
          client_percentage: number
          created_at: string
          created_by: string | null
          gross_percentage: number
          id: string
          period: string
          product_id: string
          securitizadora_percentage: number
          updated_at: string
        }
        Insert: {
          client_percentage: number
          created_at?: string
          created_by?: string | null
          gross_percentage: number
          id?: string
          period: string
          product_id: string
          securitizadora_percentage: number
          updated_at?: string
        }
        Update: {
          client_percentage?: number
          created_at?: string
          created_by?: string | null
          gross_percentage?: number
          id?: string
          period?: string
          product_id?: string
          securitizadora_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'manual_yield_entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'manual_yield_entries_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'investment_products'
            referencedColumns: ['id']
          },
        ]
      }
      operacoes_antecipacao: {
        Row: {
          ccb_id: string | null
          created_at: string
          id: string
          installments: Json
          net_value: number
          partner_bank: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ccb_id?: string | null
          created_at?: string
          id?: string
          installments?: Json
          net_value?: number
          partner_bank?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ccb_id?: string | null
          created_at?: string
          id?: string
          installments?: Json
          net_value?: number
          partner_bank?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'operacoes_antecipacao_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: true
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
        ]
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
      product_currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
          symbol?: string
        }
        Relationships: []
      }
      product_risk_ratings: {
        Row: {
          created_at: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      product_statuses: {
        Row: {
          created_at: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
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
          force_password_change: boolean | null
          full_name: string | null
          id: string
          is_accountant: boolean | null
          is_admin: boolean | null
          is_blocked: boolean
          is_borrower: boolean | null
          is_investor: boolean | null
          is_pep: boolean | null
          is_staff: boolean | null
          kyc_consolidated_pdf: string | null
          kyc_signature_envelope_id: string | null
          kyc_signature_status: string | null
          kyc_signature_url: string | null
          kyc_status: Database['public']['Enums']['kyc_status'] | null
          lgpd_accepted: boolean | null
          lgpd_accepted_at: string | null
          pf_birth_city: string | null
          pf_birth_date: string | null
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
          pj_state_registration: string | null
          pj_tax_regime: string | null
          pj_trade_name: string | null
          requires_password_change: boolean | null
          role: Database['public']['Enums']['app_role']
          updated_at: string | null
          wallet_balance: number | null
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
          force_password_change?: boolean | null
          full_name?: string | null
          id: string
          is_accountant?: boolean | null
          is_admin?: boolean | null
          is_blocked?: boolean
          is_borrower?: boolean | null
          is_investor?: boolean | null
          is_pep?: boolean | null
          is_staff?: boolean | null
          kyc_consolidated_pdf?: string | null
          kyc_signature_envelope_id?: string | null
          kyc_signature_status?: string | null
          kyc_signature_url?: string | null
          kyc_status?: Database['public']['Enums']['kyc_status'] | null
          lgpd_accepted?: boolean | null
          lgpd_accepted_at?: string | null
          pf_birth_city?: string | null
          pf_birth_date?: string | null
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
          pj_state_registration?: string | null
          pj_tax_regime?: string | null
          pj_trade_name?: string | null
          requires_password_change?: boolean | null
          role?: Database['public']['Enums']['app_role']
          updated_at?: string | null
          wallet_balance?: number | null
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
          force_password_change?: boolean | null
          full_name?: string | null
          id?: string
          is_accountant?: boolean | null
          is_admin?: boolean | null
          is_blocked?: boolean
          is_borrower?: boolean | null
          is_investor?: boolean | null
          is_pep?: boolean | null
          is_staff?: boolean | null
          kyc_consolidated_pdf?: string | null
          kyc_signature_envelope_id?: string | null
          kyc_signature_status?: string | null
          kyc_signature_url?: string | null
          kyc_status?: Database['public']['Enums']['kyc_status'] | null
          lgpd_accepted?: boolean | null
          lgpd_accepted_at?: string | null
          pf_birth_city?: string | null
          pf_birth_date?: string | null
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
          pj_state_registration?: string | null
          pj_tax_regime?: string | null
          pj_trade_name?: string | null
          requires_password_change?: boolean | null
          role?: Database['public']['Enums']['app_role']
          updated_at?: string | null
          wallet_balance?: number | null
        }
        Relationships: []
      }
      recebiveis_ccb: {
        Row: {
          acquisition_value: number
          boleto_count: number
          boleto_unit_value: number
          boletos: Json
          boletos_list_url: string | null
          ccb_id: string | null
          created_at: string | null
          created_by: string | null
          gross_profit: number | null
          id: string
          payment_receipt_url: string | null
          provision_amount: number | null
          status: string | null
          tir_effective: number | null
          tomador_id: string | null
        }
        Insert: {
          acquisition_value: number
          boleto_count: number
          boleto_unit_value: number
          boletos?: Json
          boletos_list_url?: string | null
          ccb_id?: string | null
          created_at?: string | null
          created_by?: string | null
          gross_profit?: number | null
          id?: string
          payment_receipt_url?: string | null
          provision_amount?: number | null
          status?: string | null
          tir_effective?: number | null
          tomador_id?: string | null
        }
        Update: {
          acquisition_value?: number
          boleto_count?: number
          boleto_unit_value?: number
          boletos?: Json
          boletos_list_url?: string | null
          ccb_id?: string | null
          created_at?: string | null
          created_by?: string | null
          gross_profit?: number | null
          id?: string
          payment_receipt_url?: string | null
          provision_amount?: number | null
          status?: string | null
          tir_effective?: number | null
          tomador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'recebiveis_ccb_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: false
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recebiveis_ccb_tomador_id_fkey'
            columns: ['tomador_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
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
      suppliers: {
        Row: {
          category: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          document_number: string
          email: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          document_number: string
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          document_number?: string
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      treasury_transactions: {
        Row: {
          amount: number
          category: string
          category_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          expense_id: string | null
          external_ref: string | null
          id: string
          is_escrow: boolean | null
          reference_id: string | null
          referencia_tipo: string | null
          saldo_anterior: number | null
          saldo_novo: number | null
          status: string | null
          type: string
        }
        Insert: {
          amount: number
          category: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          expense_id?: string | null
          external_ref?: string | null
          id?: string
          is_escrow?: boolean | null
          reference_id?: string | null
          referencia_tipo?: string | null
          saldo_anterior?: number | null
          saldo_novo?: number | null
          status?: string | null
          type: string
        }
        Update: {
          amount?: number
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          expense_id?: string | null
          external_ref?: string | null
          id?: string
          is_escrow?: boolean | null
          reference_id?: string | null
          referencia_tipo?: string | null
          saldo_anterior?: number | null
          saldo_novo?: number | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'treasury_transactions_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'transaction_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treasury_transactions_expense_id_fkey'
            columns: ['expense_id']
            isOneToOne: true
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
        ]
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
      usuarios_avalistas: {
        Row: {
          ccb_id: string | null
          city: string | null
          created_at: string | null
          dob: string | null
          docs_paths: Json | null
          document: string
          email: string | null
          id: string
          income: number | null
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          relationship: string | null
          state: string | null
          street: string | null
          user_id: string | null
          zip: string | null
        }
        Insert: {
          ccb_id?: string | null
          city?: string | null
          created_at?: string | null
          dob?: string | null
          docs_paths?: Json | null
          document: string
          email?: string | null
          id?: string
          income?: number | null
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          relationship?: string | null
          state?: string | null
          street?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          ccb_id?: string | null
          city?: string | null
          created_at?: string | null
          dob?: string | null
          docs_paths?: Json | null
          document?: string
          email?: string | null
          id?: string
          income?: number | null
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          relationship?: string | null
          state?: string | null
          street?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'usuarios_avalistas_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: false
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
        ]
      }
      usuarios_conjuges: {
        Row: {
          ccb_id: string | null
          city: string | null
          created_at: string | null
          dob: string | null
          docs_paths: Json | null
          document: string
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          state: string | null
          street: string | null
          user_id: string | null
          zip: string | null
        }
        Insert: {
          ccb_id?: string | null
          city?: string | null
          created_at?: string | null
          dob?: string | null
          docs_paths?: Json | null
          document: string
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          ccb_id?: string | null
          city?: string | null
          created_at?: string | null
          dob?: string | null
          docs_paths?: Json | null
          document?: string
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'usuarios_conjuges_ccb_id_fkey'
            columns: ['ccb_id']
            isOneToOne: false
            referencedRelation: 'ccb_solicitacoes'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      investments_view: {
        Row: {
          bank_account_id: string | null
          contract_url: string | null
          created_at: string | null
          id: string | null
          product_id: string | null
          quotas: number | null
          redeemed_quotas: number | null
          rejection_reason: string | null
          status: string | null
          total_value: number | null
          transfer_date: string | null
          transfer_value: number | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bank_account_id?: string | null
          contract_url?: string | null
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          quotas?: number | null
          redeemed_quotas?: number | null
          rejection_reason?: string | null
          status?: string | null
          total_value?: number | null
          transfer_date?: string | null
          transfer_value?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bank_account_id?: string | null
          contract_url?: string | null
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          quotas?: number | null
          redeemed_quotas?: number | null
          rejection_reason?: string | null
          status?: string | null
          total_value?: number | null
          transfer_date?: string | null
          transfer_value?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
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
    }
    Functions: {
      approve_investment: {
        Args: { p_investment_id: string }
        Returns: undefined
      }
      cancel_investment: {
        Args: { p_admin_id: string; p_investment_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      limpar_tabelas_problematicas: { Args: never; Returns: boolean }
      process_redemption_payment: {
        Args: { p_admin_id: string; p_redemption_id: string }
        Returns: undefined
      }
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
      app_role: 'admin' | 'investor' | 'borrower' | 'staff' | 'accountant'
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
      app_role: ['admin', 'investor', 'borrower', 'staff', 'accountant'],
      kyc_status: ['pending', 'under_review', 'approved', 'rejected'],
    },
  },
} as const
