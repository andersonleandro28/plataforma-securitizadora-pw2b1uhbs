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
          id: string
          is_escrow: boolean | null
          reference_id: string | null
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
          id?: string
          is_escrow?: boolean | null
          reference_id?: string | null
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
          id?: string
          is_escrow?: boolean | null
          reference_id?: string | null
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
      [_ in never]: never
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

// ====== DATABASE EXTENDED CONTEXT (auto-generated) ======
// This section contains actual PostgreSQL column types, constraints, RLS policies,
// functions, triggers, indexes and materialized views not present in the type definitions above.
// IMPORTANT: The TypeScript types above map UUID, TEXT, VARCHAR all to "string".
// Use the COLUMN TYPES section below to know the real PostgreSQL type for each column.
// Always use the correct PostgreSQL type when writing SQL migrations.

// --- COLUMN TYPES (actual PostgreSQL types) ---
// Use this to know the real database type when writing migrations.
// "string" in TypeScript types above may be uuid, text, varchar, timestamptz, etc.
// Table: access_logs
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   created_at: timestamp with time zone (not null, default: now())
// Table: audit_logs
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (nullable)
//   action: text (not null)
//   entity_type: text (not null)
//   entity_id: uuid (nullable)
//   details: jsonb (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: border_items
//   id: uuid (not null, default: gen_random_uuid())
//   border_id: uuid (not null)
//   document_number: text (not null)
//   due_date: date (nullable)
//   face_value: numeric (not null)
//   rate: text (nullable)
//   acquisition_value: numeric (not null)
//   created_at: timestamp with time zone (not null, default: now())
// Table: borders
//   id: uuid (not null, default: gen_random_uuid())
//   border_number: text (not null)
//   cedente: text (not null)
//   amount: numeric (not null)
//   status: text (not null)
//   items_count: integer (nullable, default: 0)
//   created_at: timestamp with time zone (not null, default: now())
// Table: ccb_avalistas
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (not null)
//   name: text (not null)
//   document: text (not null)
//   income: numeric (nullable)
//   address: text (nullable)
//   phone: text (nullable)
//   relationship: text (nullable)
//   docs_paths: jsonb (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: ccb_avalistas_documentos
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (nullable)
//   nome_arquivo: text (not null)
//   url: text (not null)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: ccb_conjuges
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (not null)
//   name: text (not null)
//   document: text (not null)
//   dob: date (nullable)
//   phone: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: ccb_solicitacoes
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   status: text (not null, default: 'pendente'::text)
//   requested_value: numeric (not null)
//   term_months: integer (not null)
//   borrower_data: jsonb (not null, default: '{}'::jsonb)
//   operation_data: jsonb (not null, default: '{}'::jsonb)
//   guarantees_data: jsonb (not null, default: '{}'::jsonb)
//   docs_paths: jsonb (not null, default: '{}'::jsonb)
//   pdf_file_path: text (nullable)
//   bdigital_response_file: text (nullable)
//   admin_notes: text (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
//   deleted_at: timestamp with time zone (nullable)
// Table: company_bank_accounts
//   id: uuid (not null, default: gen_random_uuid())
//   bank_name: text (not null)
//   branch: text (nullable)
//   account_number: text (nullable)
//   pix_key: text (nullable)
//   owner_name: text (not null)
//   owner_document: text (not null)
//   notes: text (nullable)
//   is_active: boolean (nullable, default: false)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
//   updated_by: uuid (nullable)
//   bank_code: text (nullable)
// Table: config_ccb
//   id: uuid (not null, default: gen_random_uuid())
//   partner_name: text (not null, default: 'BDIGITAL'::text)
//   interest_rate_monthly: numeric (not null, default: 2.5)
//   interest_rate_annual: numeric (not null, default: 34.49)
//   iof_rate: numeric (not null, default: 0.38)
//   irrf_rate: numeric (not null, default: 1.5)
//   multiplier_factor: numeric (not null, default: 1.0)
//   max_term_months: integer (not null, default: 36)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
//   fixed_emission_cost: numeric (not null, default: 0)
//   iof_daily_rate_30: numeric (not null, default: 0.0041)
//   iof_daily_rate_after: numeric (not null, default: 0.00274)
// Table: contract_versions
//   id: uuid (not null, default: gen_random_uuid())
//   operation_id: uuid (nullable)
//   version_number: integer (not null, default: 1)
//   file_path: text (not null)
//   file_name: text (not null)
//   reason: text (nullable)
//   created_by: uuid (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: credit_operations
//   id: uuid (not null, default: gen_random_uuid())
//   borrower_id: uuid (not null)
//   receivable_type: text (not null)
//   receivable_type_other: text (nullable)
//   cedente: text (not null)
//   sacado: text (not null)
//   document_number: text (not null)
//   face_value: numeric (not null)
//   requested_value: numeric (not null)
//   issue_date: date (not null)
//   due_date: date (not null)
//   installments: integer (nullable, default: 1)
//   observations: text (nullable)
//   status: text (nullable, default: 'enviado'::text)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
//   signature_envelope_id: text (nullable)
//   signature_status: text (nullable, default: 'pending'::text)
//   signature_url: text (nullable)
//   payment_receipt_url: text (nullable)
//   liquidation_date: date (nullable)
//   liquidation_value: numeric (nullable)
//   sacado_document: text (nullable)
//   sacado_email: text (nullable)
//   sacado_phone: text (nullable)
// Table: dados_bancarios_ccb
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (nullable)
//   user_id: uuid (nullable)
//   bank: text (nullable)
//   branch: text (nullable)
//   account: text (nullable)
//   owner_name: text (nullable)
//   owner_document: text (nullable)
//   pix_key: text (nullable)
//   docs_paths: jsonb (nullable, default: '{}'::jsonb)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: debenture_series
//   id: uuid (not null, default: gen_random_uuid())
//   debenture_id: uuid (not null)
//   series_number: text (not null)
//   volume: numeric (not null)
//   indexer: text (not null)
//   rate: numeric (not null)
//   maturity_date: date (nullable)
//   created_at: timestamp with time zone (not null, default: now())
// Table: debenture_subscriptions
//   id: uuid (not null, default: gen_random_uuid())
//   series_id: uuid (not null)
//   investor_name: text (not null)
//   document_number: text (nullable)
//   quantity: integer (not null, default: 1)
//   unit_price: numeric (not null)
//   total_amount: numeric (not null)
//   subscription_date: date (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   investment_id: uuid (nullable)
//   status: text (nullable, default: 'Ativo'::text)
//   deleted_at: timestamp with time zone (nullable)
//   deleted_by: uuid (nullable)
// Table: debentures
//   id: uuid (not null, default: gen_random_uuid())
//   issuer_name: text (not null)
//   total_volume: numeric (not null)
//   issue_date: date (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   created_by: uuid (nullable)
// Table: expenses
//   id: uuid (not null, default: gen_random_uuid())
//   supplier_id: uuid (nullable)
//   description: text (not null)
//   category: text (not null)
//   amount: numeric (not null)
//   due_date: date (not null)
//   payment_date: date (nullable)
//   status: text (nullable, default: 'pending'::text)
//   invoice_file_path: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
//   created_by: uuid (nullable)
//   category_id: uuid (nullable)
// Table: financial_parameters
//   id: uuid (not null, default: gen_random_uuid())
//   receivable_type: text (not null)
//   interest_rate_monthly: numeric (nullable, default: 0)
//   discount_rate_monthly: numeric (nullable, default: 0)
//   ad_valorem_rate: numeric (nullable, default: 0)
//   ad_valorem_base: text (nullable, default: 'face_value'::text)
//   structuring_fee: numeric (nullable, default: 0)
//   structuring_fee_type: text (nullable, default: 'fixed'::text)
//   analysis_fee: numeric (nullable, default: 0)
//   analysis_fee_type: text (nullable, default: 'fixed'::text)
//   collection_fee: numeric (nullable, default: 0)
//   penalty_rate: numeric (nullable, default: 0)
//   default_interest_rate: numeric (nullable, default: 0)
//   iof_fixed_rate: numeric (nullable, default: 0)
//   iof_daily_rate: numeric (nullable, default: 0)
//   min_operation_value: numeric (nullable, default: 0)
//   max_operation_value: numeric (nullable, default: 0)
//   min_term_days: integer (nullable, default: 0)
//   max_term_days: integer (nullable, default: 0)
//   grace_period_days: integer (nullable, default: 0)
//   updated_by: uuid (nullable)
//   updated_at: timestamp with time zone (nullable, default: now())
// Table: investment_products
//   id: uuid (not null, default: gen_random_uuid())
//   title: text (not null)
//   type: text (not null)
//   rate: text (not null)
//   term: text (not null)
//   min_investment: numeric (not null)
//   risk: text (not null)
//   progress: integer (nullable, default: 0)
//   status: text (not null)
//   created_at: timestamp with time zone (not null, default: now())
//   series_id: uuid (nullable)
//   description: text (nullable)
//   redemption_rules: text (nullable)
//   ir_rules: text (nullable)
//   rating: text (nullable, default: 'Risco Médio'::text)
//   manager: text (nullable)
//   management_policy: text (nullable)
//   currency: text (nullable, default: 'BRL'::text)
//   global_quotas: integer (nullable, default: 1000)
//   quota_value: numeric (nullable, default: 1000)
//   min_quotas_per_investor: integer (nullable, default: 1)
//   max_quotas_per_investor: integer (nullable, default: 100)
//   sold_quotas: integer (nullable, default: 0)
//   application_cotization_months: integer (nullable, default: 0)
//   redemption_cotization_months: integer (nullable, default: 0)
//   financial_settlement: text (nullable)
//   is_active: boolean (nullable, default: true)
//   is_archived: boolean (nullable, default: false)
//   target_audience: text (nullable)
//   grace_period: text (nullable)
//   offer_start_date: date (nullable)
//   offer_end_date: date (nullable)
//   is_highlighted: boolean (nullable, default: false)
//   updated_at: timestamp with time zone (nullable, default: now())
//   updated_by: uuid (nullable)
//   created_by: uuid (nullable)
//   allow_early_redemption: boolean (nullable, default: false)
//   early_redemption_penalty_pct: numeric (nullable, default: 0)
//   early_redemption_discount_pct: numeric (nullable, default: 0)
//   min_grace_period_months: integer (nullable, default: 0)
// Table: investment_proofs
//   id: uuid (not null, default: gen_random_uuid())
//   investment_id: uuid (not null)
//   file_path: text (not null)
//   file_name: text (not null)
//   file_size: bigint (nullable)
//   uploaded_at: timestamp with time zone (nullable, default: now())
// Table: investment_redemptions
//   id: uuid (not null, default: gen_random_uuid())
//   investment_id: uuid (nullable)
//   user_id: uuid (nullable)
//   requested_quotas: integer (not null)
//   gross_value: numeric (not null)
//   net_value: numeric (not null)
//   penalty_applied: numeric (nullable, default: 0)
//   discount_applied: numeric (nullable, default: 0)
//   status: text (nullable, default: 'pending'::text)
//   rejection_reason: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
//   updated_by: uuid (nullable)
//   tax_amount: numeric (nullable, default: 0)
//   tax_rate: numeric (nullable, default: 0)
//   yield_amount: numeric (nullable, default: 0)
//   is_reinvestment: boolean (nullable, default: false)
//   reinvestment_product_id: uuid (nullable)
//   reinvestment_quotas: integer (nullable, default: 0)
// Table: investments
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   product_id: uuid (not null)
//   bank_account_id: uuid (nullable)
//   quotas: integer (not null)
//   unit_price: numeric (not null)
//   total_value: numeric (not null)
//   status: text (nullable, default: 'pending_transfer'::text)
//   rejection_reason: text (nullable)
//   transfer_date: date (nullable)
//   transfer_value: numeric (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
//   redeemed_quotas: integer (nullable, default: 0)
//   contract_url: text (nullable)
// Table: kyc_documents
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   document_type: text (not null)
//   file_path: text (not null)
//   status: text (nullable, default: 'uploaded'::text)
//   uploaded_at: timestamp with time zone (nullable, default: now())
//   reviewed_at: timestamp with time zone (nullable)
//   reviewed_by: uuid (nullable)
//   rejection_reason: text (nullable)
// Table: operacoes_antecipacao
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (nullable)
//   user_id: uuid (nullable)
//   net_value: numeric (not null, default: 0)
//   installments: jsonb (not null, default: '[]'::jsonb)
//   partner_bank: text (not null, default: 'BDIGITAL'::text)
//   status: text (not null, default: 'ativa'::text)
//   created_at: timestamp with time zone (not null, default: now())
//   updated_at: timestamp with time zone (not null, default: now())
// Table: operation_calculations
//   id: uuid (not null, default: gen_random_uuid())
//   operation_id: uuid (nullable)
//   term_days: integer (nullable)
//   discount_value: numeric (nullable)
//   interest_value: numeric (nullable)
//   ad_valorem_value: numeric (nullable)
//   structuring_value: numeric (nullable)
//   analysis_value: numeric (nullable)
//   iof_fixed_value: numeric (nullable)
//   iof_daily_value: numeric (nullable)
//   total_discounts: numeric (nullable)
//   net_value: numeric (nullable)
//   effective_cost_rate: numeric (nullable)
//   calculation_memory: jsonb (nullable)
//   calculated_at: timestamp with time zone (nullable, default: now())
// Table: operation_documents
//   id: uuid (not null, default: gen_random_uuid())
//   operation_id: uuid (nullable)
//   file_path: text (not null)
//   file_name: text (not null)
//   file_type: text (not null)
//   file_size: bigint (not null)
//   category: text (nullable, default: 'comprobatorio'::text)
//   uploaded_by: uuid (nullable)
//   uploaded_at: timestamp with time zone (nullable, default: now())
// Table: operation_status_history
//   id: uuid (not null, default: gen_random_uuid())
//   operation_id: uuid (nullable)
//   old_status: text (nullable)
//   new_status: text (not null)
//   changed_by: uuid (nullable)
//   changed_at: timestamp with time zone (nullable, default: now())
//   internal_observation: text (nullable)
//   borrower_observation: text (nullable)
// Table: parameter_history
//   id: uuid (not null, default: gen_random_uuid())
//   parameter_id: uuid (nullable)
//   changes: jsonb (not null)
//   changed_by: uuid (nullable)
//   changed_at: timestamp with time zone (nullable, default: now())
// Table: profiles
//   id: uuid (not null)
//   full_name: text (nullable)
//   updated_at: timestamp with time zone (nullable, default: now())
//   avatar_url: text (nullable)
//   role: app_role (not null, default: 'investor'::app_role)
//   email: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
//   entity_type: text (nullable)
//   document_number: text (nullable)
//   phone: text (nullable)
//   address_street: text (nullable)
//   address_number: text (nullable)
//   address_complement: text (nullable)
//   address_neighborhood: text (nullable)
//   address_city: text (nullable)
//   address_state: text (nullable)
//   address_zip: text (nullable)
//   is_pep: boolean (nullable, default: false)
//   lgpd_accepted: boolean (nullable, default: false)
//   lgpd_accepted_at: timestamp with time zone (nullable)
//   kyc_status: kyc_status (nullable, default: 'pending'::kyc_status)
//   is_admin: boolean (nullable, default: false)
//   is_staff: boolean (nullable, default: false)
//   is_investor: boolean (nullable, default: false)
//   is_borrower: boolean (nullable, default: false)
//   pf_mother_name: text (nullable)
//   pf_father_name: text (nullable)
//   pf_marital_status: text (nullable)
//   pf_occupation: text (nullable)
//   pf_nationality: text (nullable, default: 'Brasileira'::text)
//   pf_birth_city: text (nullable)
//   pf_rg: text (nullable)
//   pj_company_name: text (nullable)
//   pj_trade_name: text (nullable)
//   pj_tax_regime: text (nullable)
//   pj_annual_revenue: numeric (nullable)
//   pj_cnae: text (nullable)
//   pj_foundation_date: date (nullable)
//   pj_rep_name: text (nullable)
//   pj_rep_cpf: text (nullable)
//   pj_rep_rg: text (nullable)
//   pj_rep_role: text (nullable)
//   pj_rep_is_procurator: boolean (nullable, default: false)
//   requires_password_change: boolean (nullable, default: false)
//   credit_limit: numeric (nullable, default: 100000)
//   is_blocked: boolean (not null, default: false)
//   wallet_balance: numeric (nullable, default: 0)
//   pf_birth_date: date (nullable)
//   pj_state_registration: text (nullable)
//   kyc_signature_envelope_id: text (nullable)
//   kyc_signature_status: text (nullable, default: 'pending'::text)
//   kyc_signature_url: text (nullable)
//   kyc_consolidated_pdf: text (nullable)
//   is_accountant: boolean (nullable, default: false)
// Table: recebiveis_ccb
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (nullable)
//   acquisition_value: numeric (not null)
//   boleto_count: integer (not null)
//   boleto_unit_value: numeric (not null)
//   gross_profit: numeric (nullable)
//   tir_effective: numeric (nullable)
//   provision_amount: numeric (nullable)
//   payment_receipt_url: text (nullable)
//   boletos_list_url: text (nullable)
//   boletos: jsonb (not null, default: '[]'::jsonb)
//   status: text (nullable, default: 'Ativo'::text)
//   created_at: timestamp with time zone (nullable, default: now())
//   created_by: uuid (nullable)
//   tomador_id: uuid (nullable)
// Table: risk_analysis_history
//   id: uuid (not null, default: gen_random_uuid())
//   operation_id: uuid (nullable)
//   serasa_score: integer (nullable)
//   sio_score: numeric (nullable)
//   risk_level: text (nullable)
//   triggers: jsonb (nullable)
//   raw_serasa_data: jsonb (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
//   created_by: uuid (nullable)
// Table: serasa_consultations
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   document_number: text (not null)
//   score: integer (not null)
//   risk_level: text (not null)
//   raw_response: jsonb (not null)
//   created_at: timestamp with time zone (not null, default: now())
// Table: suppliers
//   id: uuid (not null, default: gen_random_uuid())
//   company_name: text (not null)
//   document_number: text (not null)
//   contact_name: text (nullable)
//   email: text (nullable)
//   phone: text (nullable)
//   category: text (nullable)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
//   created_by: uuid (nullable)
// Table: transaction_categories
//   id: uuid (not null, default: gen_random_uuid())
//   name: text (not null)
//   type: text (not null)
//   created_at: timestamp with time zone (not null, default: now())
// Table: treasury_transactions
//   id: uuid (not null, default: gen_random_uuid())
//   type: text (not null)
//   amount: numeric (not null)
//   description: text (not null)
//   category: text (not null)
//   date: date (not null)
//   is_escrow: boolean (nullable, default: false)
//   created_at: timestamp with time zone (not null, default: now())
//   created_by: uuid (nullable)
//   expense_id: uuid (nullable)
//   category_id: uuid (nullable)
//   reference_id: uuid (nullable)
// Table: user_bank_accounts
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   bank_code: text (not null)
//   bank_name: text (not null)
//   branch: text (nullable)
//   account_number: text (nullable)
//   account_type: text (not null)
//   pix_key: text (nullable)
//   owner_name: text (not null)
//   owner_document: text (not null)
//   notes: text (nullable)
//   is_active: boolean (nullable, default: false)
//   created_at: timestamp with time zone (nullable, default: now())
//   updated_at: timestamp with time zone (nullable, default: now())
// Table: usuarios_avalistas
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (nullable)
//   user_id: uuid (nullable)
//   name: text (not null)
//   document: text (not null)
//   dob: date (nullable)
//   zip: text (nullable)
//   street: text (nullable)
//   number: text (nullable)
//   neighborhood: text (nullable)
//   city: text (nullable)
//   state: text (nullable)
//   phone: text (nullable)
//   email: text (nullable)
//   income: numeric (nullable)
//   relationship: text (nullable)
//   docs_paths: jsonb (nullable, default: '{}'::jsonb)
//   created_at: timestamp with time zone (nullable, default: now())
// Table: usuarios_conjuges
//   id: uuid (not null, default: gen_random_uuid())
//   ccb_id: uuid (nullable)
//   user_id: uuid (nullable)
//   name: text (not null)
//   document: text (not null)
//   dob: date (nullable)
//   zip: text (nullable)
//   street: text (nullable)
//   number: text (nullable)
//   neighborhood: text (nullable)
//   city: text (nullable)
//   state: text (nullable)
//   phone: text (nullable)
//   email: text (nullable)
//   docs_paths: jsonb (nullable, default: '{}'::jsonb)
//   created_at: timestamp with time zone (nullable, default: now())

// --- CONSTRAINTS ---
// Table: access_logs
//   PRIMARY KEY access_logs_pkey: PRIMARY KEY (id)
//   FOREIGN KEY access_logs_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: audit_logs
//   PRIMARY KEY audit_logs_pkey: PRIMARY KEY (id)
//   FOREIGN KEY audit_logs_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
// Table: border_items
//   FOREIGN KEY border_items_border_id_fkey: FOREIGN KEY (border_id) REFERENCES borders(id) ON DELETE CASCADE
//   PRIMARY KEY border_items_pkey: PRIMARY KEY (id)
// Table: borders
//   PRIMARY KEY borders_pkey: PRIMARY KEY (id)
// Table: ccb_avalistas
//   FOREIGN KEY ccb_avalistas_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   PRIMARY KEY ccb_avalistas_pkey: PRIMARY KEY (id)
// Table: ccb_avalistas_documentos
//   FOREIGN KEY ccb_avalistas_documentos_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   PRIMARY KEY ccb_avalistas_documentos_pkey: PRIMARY KEY (id)
// Table: ccb_conjuges
//   FOREIGN KEY ccb_conjuges_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   PRIMARY KEY ccb_conjuges_pkey: PRIMARY KEY (id)
// Table: ccb_solicitacoes
//   PRIMARY KEY ccb_solicitacoes_pkey: PRIMARY KEY (id)
//   FOREIGN KEY ccb_solicitacoes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
// Table: company_bank_accounts
//   PRIMARY KEY company_bank_accounts_pkey: PRIMARY KEY (id)
//   FOREIGN KEY company_bank_accounts_updated_by_fkey: FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
// Table: config_ccb
//   PRIMARY KEY config_ccb_pkey: PRIMARY KEY (id)
// Table: contract_versions
//   FOREIGN KEY contract_versions_created_by_fkey: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
//   FOREIGN KEY contract_versions_operation_id_fkey: FOREIGN KEY (operation_id) REFERENCES credit_operations(id) ON DELETE CASCADE
//   PRIMARY KEY contract_versions_pkey: PRIMARY KEY (id)
// Table: credit_operations
//   FOREIGN KEY credit_operations_borrower_id_fkey: FOREIGN KEY (borrower_id) REFERENCES profiles(id)
//   PRIMARY KEY credit_operations_pkey: PRIMARY KEY (id)
// Table: dados_bancarios_ccb
//   FOREIGN KEY dados_bancarios_ccb_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   PRIMARY KEY dados_bancarios_ccb_pkey: PRIMARY KEY (id)
//   FOREIGN KEY dados_bancarios_ccb_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: debenture_series
//   FOREIGN KEY debenture_series_debenture_id_fkey: FOREIGN KEY (debenture_id) REFERENCES debentures(id) ON DELETE CASCADE
//   PRIMARY KEY debenture_series_pkey: PRIMARY KEY (id)
// Table: debenture_subscriptions
//   FOREIGN KEY debenture_subscriptions_deleted_by_fkey: FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL
//   FOREIGN KEY debenture_subscriptions_investment_id_fkey: FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
//   PRIMARY KEY debenture_subscriptions_pkey: PRIMARY KEY (id)
//   FOREIGN KEY debenture_subscriptions_series_id_fkey: FOREIGN KEY (series_id) REFERENCES debenture_series(id) ON DELETE CASCADE
// Table: debentures
//   FOREIGN KEY debentures_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id)
//   PRIMARY KEY debentures_pkey: PRIMARY KEY (id)
// Table: expenses
//   FOREIGN KEY expenses_category_id_fkey: FOREIGN KEY (category_id) REFERENCES transaction_categories(id) ON DELETE SET NULL
//   FOREIGN KEY expenses_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
//   PRIMARY KEY expenses_pkey: PRIMARY KEY (id)
//   FOREIGN KEY expenses_supplier_id_fkey: FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
// Table: financial_parameters
//   PRIMARY KEY financial_parameters_pkey: PRIMARY KEY (id)
//   UNIQUE financial_parameters_receivable_type_key: UNIQUE (receivable_type)
//   FOREIGN KEY financial_parameters_updated_by_fkey: FOREIGN KEY (updated_by) REFERENCES profiles(id)
// Table: investment_products
//   FOREIGN KEY investment_products_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id)
//   PRIMARY KEY investment_products_pkey: PRIMARY KEY (id)
//   FOREIGN KEY investment_products_series_id_fkey: FOREIGN KEY (series_id) REFERENCES debenture_series(id) ON DELETE SET NULL
//   FOREIGN KEY investment_products_updated_by_fkey: FOREIGN KEY (updated_by) REFERENCES auth.users(id)
// Table: investment_proofs
//   FOREIGN KEY investment_proofs_investment_id_fkey: FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
//   PRIMARY KEY investment_proofs_pkey: PRIMARY KEY (id)
// Table: investment_redemptions
//   FOREIGN KEY investment_redemptions_investment_id_fkey: FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
//   PRIMARY KEY investment_redemptions_pkey: PRIMARY KEY (id)
//   FOREIGN KEY investment_redemptions_reinvestment_product_id_fkey: FOREIGN KEY (reinvestment_product_id) REFERENCES investment_products(id) ON DELETE SET NULL
//   FOREIGN KEY investment_redemptions_updated_by_fkey: FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
//   FOREIGN KEY investment_redemptions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
// Table: investments
//   FOREIGN KEY investments_bank_account_id_fkey: FOREIGN KEY (bank_account_id) REFERENCES company_bank_accounts(id) ON DELETE SET NULL
//   PRIMARY KEY investments_pkey: PRIMARY KEY (id)
//   FOREIGN KEY investments_product_id_fkey: FOREIGN KEY (product_id) REFERENCES investment_products(id) ON DELETE CASCADE
//   FOREIGN KEY investments_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
// Table: kyc_documents
//   PRIMARY KEY kyc_documents_pkey: PRIMARY KEY (id)
//   FOREIGN KEY kyc_documents_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
//   FOREIGN KEY kyc_documents_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: operacoes_antecipacao
//   FOREIGN KEY operacoes_antecipacao_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   UNIQUE operacoes_antecipacao_ccb_id_key: UNIQUE (ccb_id)
//   PRIMARY KEY operacoes_antecipacao_pkey: PRIMARY KEY (id)
//   FOREIGN KEY operacoes_antecipacao_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: operation_calculations
//   FOREIGN KEY operation_calculations_operation_id_fkey: FOREIGN KEY (operation_id) REFERENCES credit_operations(id) ON DELETE CASCADE
//   UNIQUE operation_calculations_operation_id_key: UNIQUE (operation_id)
//   PRIMARY KEY operation_calculations_pkey: PRIMARY KEY (id)
// Table: operation_documents
//   FOREIGN KEY operation_documents_operation_id_fkey: FOREIGN KEY (operation_id) REFERENCES credit_operations(id) ON DELETE CASCADE
//   PRIMARY KEY operation_documents_pkey: PRIMARY KEY (id)
//   FOREIGN KEY operation_documents_uploaded_by_fkey: FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
// Table: operation_status_history
//   FOREIGN KEY operation_status_history_changed_by_fkey: FOREIGN KEY (changed_by) REFERENCES profiles(id)
//   FOREIGN KEY operation_status_history_operation_id_fkey: FOREIGN KEY (operation_id) REFERENCES credit_operations(id) ON DELETE CASCADE
//   PRIMARY KEY operation_status_history_pkey: PRIMARY KEY (id)
// Table: parameter_history
//   FOREIGN KEY parameter_history_changed_by_fkey: FOREIGN KEY (changed_by) REFERENCES profiles(id)
//   FOREIGN KEY parameter_history_parameter_id_fkey: FOREIGN KEY (parameter_id) REFERENCES financial_parameters(id) ON DELETE CASCADE
//   PRIMARY KEY parameter_history_pkey: PRIMARY KEY (id)
// Table: profiles
//   CHECK profiles_entity_type_check: CHECK ((entity_type = ANY (ARRAY['pf'::text, 'pj'::text])))
//   FOREIGN KEY profiles_id_fkey: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
//   PRIMARY KEY profiles_pkey: PRIMARY KEY (id)
// Table: recebiveis_ccb
//   FOREIGN KEY recebiveis_ccb_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   FOREIGN KEY recebiveis_ccb_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
//   PRIMARY KEY recebiveis_ccb_pkey: PRIMARY KEY (id)
//   FOREIGN KEY recebiveis_ccb_tomador_id_fkey: FOREIGN KEY (tomador_id) REFERENCES profiles(id) ON DELETE SET NULL
// Table: risk_analysis_history
//   FOREIGN KEY risk_analysis_history_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
//   FOREIGN KEY risk_analysis_history_operation_id_fkey: FOREIGN KEY (operation_id) REFERENCES credit_operations(id) ON DELETE CASCADE
//   PRIMARY KEY risk_analysis_history_pkey: PRIMARY KEY (id)
// Table: serasa_consultations
//   PRIMARY KEY serasa_consultations_pkey: PRIMARY KEY (id)
//   FOREIGN KEY serasa_consultations_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: suppliers
//   FOREIGN KEY suppliers_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
//   PRIMARY KEY suppliers_pkey: PRIMARY KEY (id)
// Table: transaction_categories
//   UNIQUE transaction_categories_name_key: UNIQUE (name)
//   PRIMARY KEY transaction_categories_pkey: PRIMARY KEY (id)
// Table: treasury_transactions
//   FOREIGN KEY treasury_transactions_category_id_fkey: FOREIGN KEY (category_id) REFERENCES transaction_categories(id) ON DELETE SET NULL
//   FOREIGN KEY treasury_transactions_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
//   FOREIGN KEY treasury_transactions_expense_id_fkey: FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
//   UNIQUE treasury_transactions_expense_id_key: UNIQUE (expense_id)
//   PRIMARY KEY treasury_transactions_pkey: PRIMARY KEY (id)
//   CHECK treasury_transactions_type_check: CHECK ((type = ANY (ARRAY['in'::text, 'out'::text])))
// Table: user_bank_accounts
//   PRIMARY KEY user_bank_accounts_pkey: PRIMARY KEY (id)
//   FOREIGN KEY user_bank_accounts_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
// Table: usuarios_avalistas
//   FOREIGN KEY usuarios_avalistas_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   PRIMARY KEY usuarios_avalistas_pkey: PRIMARY KEY (id)
//   FOREIGN KEY usuarios_avalistas_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: usuarios_conjuges
//   FOREIGN KEY usuarios_conjuges_ccb_id_fkey: FOREIGN KEY (ccb_id) REFERENCES ccb_solicitacoes(id) ON DELETE CASCADE
//   PRIMARY KEY usuarios_conjuges_pkey: PRIMARY KEY (id)
//   FOREIGN KEY usuarios_conjuges_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

// --- ROW LEVEL SECURITY POLICIES ---
// Table: access_logs
//   Policy "access_logs_insert_own" (INSERT, PERMISSIVE) roles={public}
//     WITH CHECK: ((auth.uid() = user_id) OR (auth.role() = 'anon'::text))
//   Policy "access_logs_select_own" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = user_id)
// Table: audit_logs
//   Policy "auth_all_audit_logs" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: border_items
//   Policy "auth_all_border_items" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: borders
//   Policy "auth_all_borders" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: ccb_avalistas
//   Policy "auth_all_ccb_avalistas" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: ccb_avalistas_documentos
//   Policy "auth_all_ccb_avalistas_docs" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
// Table: ccb_conjuges
//   Policy "auth_all_ccb_conjuges" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: ccb_solicitacoes
//   Policy "admin_all_ccb" (ALL, PERMISSIVE) roles={authenticated}
//     USING: (is_admin() OR (EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::app_role)))))
//   Policy "borrower_insert_own" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "borrower_select_own" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = user_id)
// Table: company_bank_accounts
//   Policy "auth_all_company_bank_accounts" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: config_ccb
//   Policy "auth_all_config_ccb" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: contract_versions
//   Policy "auth_all_contract_versions" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: credit_operations
//   Policy "auth_all_credit_operations" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: dados_bancarios_ccb
//   Policy "auth_all_dados_bancarios_ccb" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: debenture_series
//   Policy "auth_all_series" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: debenture_subscriptions
//   Policy "auth_all_subscriptions" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: debentures
//   Policy "auth_all_debentures" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: expenses
//   Policy "auth_all_expenses" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
// Table: financial_parameters
//   Policy "auth_all_financial_parameters" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: investment_products
//   Policy "auth_all_investment_products" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: investment_proofs
//   Policy "auth_all_investment_proofs" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: investment_redemptions
//   Policy "auth_all_investment_redemptions" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: investments
//   Policy "auth_all_investments" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: kyc_documents
//   Policy "admin_all_kyc_docs" (ALL, PERMISSIVE) roles={authenticated}
//     USING: is_admin()
//   Policy "kyc_docs_insert_own" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "kyc_docs_select_own" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = user_id)
// Table: operacoes_antecipacao
//   Policy "auth_all_operacoes_antecipacao" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: operation_calculations
//   Policy "auth_all_operation_calculations" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: operation_documents
//   Policy "auth_all_operation_documents" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: operation_status_history
//   Policy "auth_all_operation_status_history" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: parameter_history
//   Policy "auth_all_parameter_history" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: profiles
//   Policy "admin_select_profiles" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: is_admin()
//   Policy "admin_update_profiles" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: is_admin()
//     WITH CHECK: is_admin()
//   Policy "profiles_select_own" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = id)
//   Policy "profiles_update_own" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = id)
//     WITH CHECK: (auth.uid() = id)
// Table: recebiveis_ccb
//   Policy "auth_all_recebiveis_ccb" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: risk_analysis_history
//   Policy "auth_risk_analysis_insert" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: true
//   Policy "auth_risk_analysis_select" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: true
// Table: serasa_consultations
//   Policy "authenticated_insert" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "authenticated_select" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = user_id)
// Table: suppliers
//   Policy "auth_all_suppliers" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
// Table: transaction_categories
//   Policy "auth_all_transaction_categories" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: treasury_transactions
//   Policy "auth_all_treasury_transactions" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: user_bank_accounts
//   Policy "Users can delete own bank accounts" (DELETE, PERMISSIVE) roles={authenticated}
//     USING: ((user_id = auth.uid()) OR is_admin())
//   Policy "Users can insert own bank accounts" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: ((user_id = auth.uid()) OR is_admin())
//   Policy "Users can update own bank accounts" (UPDATE, PERMISSIVE) roles={authenticated}
//     USING: ((user_id = auth.uid()) OR is_admin())
//     WITH CHECK: ((user_id = auth.uid()) OR is_admin())
//   Policy "Users can view own bank accounts" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: ((user_id = auth.uid()) OR is_admin())
// Table: usuarios_avalistas
//   Policy "auth_all_usuarios_avalistas" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: usuarios_conjuges
//   Policy "auth_all_usuarios_conjuges" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true

// --- DATABASE FUNCTIONS ---
// FUNCTION approve_investment(uuid)
//   CREATE OR REPLACE FUNCTION public.approve_investment(p_investment_id uuid)
//    RETURNS void
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   DECLARE
//       v_inv RECORD;
//       v_prod RECORD;
//   BEGIN
//       SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id FOR UPDATE;
//       IF v_inv.status != 'awaiting_review' THEN
//           RAISE EXCEPTION 'Investment is not pending review';
//       END IF;
//
//       SELECT * INTO v_prod FROM public.investment_products WHERE id = v_inv.product_id FOR UPDATE;
//
//       -- Increment sold quotas
//       UPDATE public.investment_products
//       SET sold_quotas = COALESCE(sold_quotas, 0) + v_inv.quotas
//       WHERE id = v_inv.product_id;
//
//       -- Approve investment
//       UPDATE public.investments
//       SET status = 'approved', updated_at = NOW()
//       WHERE id = p_investment_id;
//
//       -- Sync to legacy debenture_subscriptions
//       IF v_prod.series_id IS NOT NULL THEN
//           INSERT INTO public.debenture_subscriptions (investment_id, series_id, investor_name, document_number, quantity, unit_price, total_amount, subscription_date, status)
//           SELECT
//               p_investment_id,
//               v_prod.series_id,
//               COALESCE(p.full_name, p.email),
//               p.document_number,
//               v_inv.quotas,
//               v_inv.unit_price,
//               v_inv.total_value,
//               CURRENT_DATE,
//               'Ativo'
//           FROM public.profiles p WHERE p.id = v_inv.user_id;
//       END IF;
//   END;
//   $function$
//
// FUNCTION cancel_investment(uuid, uuid)
//   CREATE OR REPLACE FUNCTION public.cancel_investment(p_investment_id uuid, p_admin_id uuid)
//    RETURNS void
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   DECLARE
//       v_inv RECORD;
//       v_prod RECORD;
//   BEGIN
//       SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id FOR UPDATE;
//
//       IF v_inv.status = 'cancelled' OR v_inv.status = 'Excluído' THEN
//           RETURN;
//       END IF;
//
//       IF v_inv.status = 'approved' THEN
//           SELECT * INTO v_prod FROM public.investment_products WHERE id = v_inv.product_id FOR UPDATE;
//
//           -- Revert sold quotas
//           UPDATE public.investment_products
//           SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_inv.quotas)
//           WHERE id = v_inv.product_id;
//
//           -- Soft delete the subscription
//           UPDATE public.debenture_subscriptions
//           SET status = 'Excluído', deleted_at = NOW(), deleted_by = p_admin_id
//           WHERE investment_id = p_investment_id;
//       END IF;
//
//       -- Update investment status
//       UPDATE public.investments
//       SET status = 'Excluído', updated_at = NOW()
//       WHERE id = p_investment_id;
//
//       -- Log audit
//       INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
//       VALUES (
//           'investments',
//           p_investment_id,
//           'admin_deleted_investment',
//           p_admin_id,
//           jsonb_build_object('message', 'Investimento ' || p_investment_id || ' excluído pelo Admin.')
//       );
//   END;
//   $function$
//
// FUNCTION handle_new_user()
//   CREATE OR REPLACE FUNCTION public.handle_new_user()
//    RETURNS trigger
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   BEGIN
//     INSERT INTO public.profiles (id, full_name, email, created_at)
//     VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email, NEW.created_at)
//     ON CONFLICT (id) DO NOTHING;
//     RETURN NEW;
//   END;
//   $function$
//
// FUNCTION invoke_login_notification()
//   CREATE OR REPLACE FUNCTION public.invoke_login_notification()
//    RETURNS trigger
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   DECLARE
//     req_id bigint;
//   BEGIN
//     -- Invokes the edge function. Fails silently if net extension is unavailable.
//     SELECT net.http_post(
//         url := 'https://misoqvscsydxqcsfjaux.supabase.co/functions/v1/send-login-notification',
//         headers := '{"Content-Type": "application/json"}'::jsonb,
//         body := jsonb_build_object('record', row_to_json(NEW))
//     ) INTO req_id;
//     RETURN NEW;
//   EXCEPTION WHEN OTHERS THEN
//     RETURN NEW;
//   END;
//   $function$
//
// FUNCTION invoke_operation_email_notification()
//   CREATE OR REPLACE FUNCTION public.invoke_operation_email_notification()
//    RETURNS trigger
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   DECLARE
//     req_id bigint;
//   BEGIN
//     -- Invokes the edge function. Fails silently if net extension is unavailable.
//     SELECT net.http_post(
//         url := 'https://misoqvscsydxqcsfjaux.supabase.co/functions/v1/send-operation-email',
//         headers := '{"Content-Type": "application/json"}'::jsonb,
//         body := jsonb_build_object('record', row_to_json(NEW), 'old_record', row_to_json(OLD))
//     ) INTO req_id;
//     RETURN NEW;
//   EXCEPTION WHEN OTHERS THEN
//     RETURN NEW;
//   END;
//   $function$
//
// FUNCTION is_admin()
//   CREATE OR REPLACE FUNCTION public.is_admin()
//    RETURNS boolean
//    LANGUAGE sql
//    SECURITY DEFINER
//    SET search_path TO 'public'
//   AS $function$
//     SELECT EXISTS (
//       SELECT 1 FROM public.profiles
//       WHERE id = auth.uid() AND (role = 'admin'::app_role OR is_admin = true)
//     );
//   $function$
//
// FUNCTION log_operation_status_change()
//   CREATE OR REPLACE FUNCTION public.log_operation_status_change()
//    RETURNS trigger
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   BEGIN
//     IF OLD.status IS DISTINCT FROM NEW.status THEN
//       INSERT INTO public.operation_status_history (operation_id, old_status, new_status, changed_by)
//       VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
//     END IF;
//     RETURN NEW;
//   END;
//   $function$
//
// FUNCTION process_redemption_payment(uuid, uuid)
//   CREATE OR REPLACE FUNCTION public.process_redemption_payment(p_redemption_id uuid, p_admin_id uuid)
//    RETURNS void
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   DECLARE
//       v_redemption RECORD;
//       v_investment RECORD;
//       v_product RECORD;
//       v_profile RECORD;
//       v_cat_resgate uuid;
//       v_cat_imposto uuid;
//       v_cat_invest uuid;
//       v_reinvest_amount numeric := 0;
//       v_troco numeric := 0;
//       v_new_inv_id uuid;
//       v_target_product RECORD;
//       v_sub_id uuid;
//   BEGIN
//       SELECT * INTO v_redemption FROM public.investment_redemptions WHERE id = p_redemption_id FOR UPDATE;
//       IF v_redemption.status != 'approved' THEN
//           RAISE EXCEPTION 'O resgate precisa estar aprovado para ser pago.';
//       END IF;
//
//       SELECT * INTO v_investment FROM public.investments WHERE id = v_redemption.investment_id FOR UPDATE;
//
//       IF v_redemption.requested_quotas > (v_investment.quotas - COALESCE(v_investment.redeemed_quotas, 0)) THEN
//           RAISE EXCEPTION 'Quantidade de resgate excede o saldo disponível do investimento.';
//       END IF;
//
//       SELECT * INTO v_product FROM public.investment_products WHERE id = v_investment.product_id FOR UPDATE;
//       SELECT * INTO v_profile FROM public.profiles WHERE id = v_redemption.user_id FOR UPDATE;
//
//       SELECT id INTO v_cat_resgate FROM public.transaction_categories WHERE name = 'Resgates e Rendimentos' LIMIT 1;
//       SELECT id INTO v_cat_imposto FROM public.transaction_categories WHERE name = 'Impostos e Taxas' LIMIT 1;
//       SELECT id INTO v_cat_invest FROM public.transaction_categories WHERE name = 'Investimento' LIMIT 1;
//
//       IF v_cat_invest IS NULL THEN
//           SELECT id INTO v_cat_invest FROM public.transaction_categories LIMIT 1;
//       END IF;
//
//       UPDATE public.investment_products
//       SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
//       WHERE id = v_product.id;
//
//       UPDATE public.investments
//       SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
//           status = CASE WHEN quotas <= (COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas) THEN 'resgatado' ELSE status END,
//           updated_at = NOW()
//       WHERE id = v_investment.id;
//
//       IF v_product.series_id IS NOT NULL THEN
//           -- Tenta achar pela subscription atrelada ao investimento primeiro
//           SELECT id INTO v_sub_id FROM public.debenture_subscriptions
//           WHERE investment_id = v_investment.id
//           ORDER BY created_at ASC LIMIT 1;
//
//           -- Fallback: achar pelo documento e status Ativo
//           IF v_sub_id IS NULL THEN
//               SELECT id INTO v_sub_id FROM public.debenture_subscriptions
//               WHERE series_id = v_product.series_id
//                 AND document_number = v_profile.document_number
//                 AND (status = 'Ativo' OR status IS NULL)
//               ORDER BY created_at ASC LIMIT 1;
//           END IF;
//
//           IF v_sub_id IS NOT NULL THEN
//               UPDATE public.debenture_subscriptions
//               SET quantity = GREATEST(0, quantity - v_redemption.requested_quotas),
//                   total_amount = GREATEST(0, total_amount - (v_redemption.requested_quotas * unit_price))
//               WHERE id = v_sub_id;
//
//               UPDATE public.debenture_subscriptions
//               SET status = 'Encerrado'
//               WHERE quantity <= 0 AND id = v_sub_id;
//           END IF;
//
//           INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
//           VALUES (
//               'debenture_series',
//               v_product.series_id,
//               'redemption_returned_to_stock',
//               p_admin_id,
//               jsonb_build_object(
//                   'message', 'Retorno de ' || v_redemption.requested_quotas || ' debêntures por resgate do investidor ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor') || ' em ' || TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY')
//               )
//           );
//       END IF;
//
//       IF v_redemption.is_reinvestment AND v_redemption.reinvestment_product_id IS NOT NULL THEN
//           SELECT * INTO v_target_product FROM public.investment_products WHERE id = v_redemption.reinvestment_product_id FOR UPDATE;
//
//           v_reinvest_amount := v_redemption.reinvestment_quotas * COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000);
//           v_troco := v_redemption.net_value - v_reinvest_amount;
//
//           IF v_troco < 0 THEN
//               v_troco := 0;
//           END IF;
//
//           UPDATE public.profiles
//           SET wallet_balance = COALESCE(wallet_balance, 0) + v_troco
//           WHERE id = v_profile.id;
//
//           v_new_inv_id := gen_random_uuid();
//           INSERT INTO public.investments (
//               id, user_id, product_id, bank_account_id, quotas, unit_price, total_value, status, transfer_date
//           ) VALUES (
//               v_new_inv_id, v_profile.id, v_target_product.id, v_investment.bank_account_id, v_redemption.reinvestment_quotas,
//               COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000), v_reinvest_amount, 'approved', CURRENT_DATE
//           );
//
//           UPDATE public.investment_products
//           SET sold_quotas = COALESCE(sold_quotas, 0) + v_redemption.reinvestment_quotas
//           WHERE id = v_target_product.id;
//
//           IF v_target_product.series_id IS NOT NULL THEN
//               INSERT INTO public.debenture_subscriptions (
//                   investment_id, series_id, investor_name, document_number, quantity, unit_price, total_amount, subscription_date, status
//               ) VALUES (
//                   v_new_inv_id, v_target_product.series_id, COALESCE(v_profile.full_name, v_profile.pj_company_name, v_profile.email),
//                   v_profile.document_number, v_redemption.reinvestment_quotas, COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000),
//                   v_reinvest_amount, CURRENT_DATE, 'Ativo'
//               );
//           END IF;
//
//           INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
//           VALUES ('out', v_redemption.net_value, 'Resgate (Base p/ Reinvestimento) - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Resgates e Rendimentos', v_cat_resgate, CURRENT_DATE, p_admin_id, true, p_redemption_id);
//
//           INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
//           VALUES ('in', v_reinvest_amount, 'Integralização por Conversão de Crédito - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Investimento', v_cat_invest, CURRENT_DATE, p_admin_id, true, v_new_inv_id);
//
//           IF v_troco > 0 THEN
//               INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
//               VALUES ('out', v_troco, 'Resgate de Sobra de Subscrição - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Resgates e Rendimentos', v_cat_resgate, CURRENT_DATE, p_admin_id, true, p_redemption_id);
//           END IF;
//
//       ELSE
//           UPDATE public.profiles
//           SET wallet_balance = COALESCE(wallet_balance, 0) + v_redemption.net_value
//           WHERE id = v_profile.id;
//
//           INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
//           VALUES ('out', v_redemption.net_value, 'Pagamento de Resgate - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Resgates e Rendimentos', v_cat_resgate, CURRENT_DATE, p_admin_id, true, p_redemption_id);
//       END IF;
//
//       IF COALESCE(v_redemption.tax_amount, 0) > 0 THEN
//           INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
//           VALUES ('out', v_redemption.tax_amount, 'Imposto a Recolher (IRRF) - Resgate ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Impostos e Taxas', v_cat_imposto, CURRENT_DATE, p_admin_id, true, p_redemption_id);
//       END IF;
//
//       UPDATE public.investment_redemptions
//       SET status = 'paid', updated_at = NOW(), updated_by = p_admin_id
//       WHERE id = p_redemption_id;
//
//       INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
//       VALUES (
//           'investment_redemptions',
//           p_redemption_id,
//           'redemption_paid',
//           p_admin_id,
//           jsonb_build_object(
//               'net_value', v_redemption.net_value,
//               'tax_amount', v_redemption.tax_amount,
//               'quotas', v_redemption.requested_quotas,
//               'is_reinvestment', COALESCE(v_redemption.is_reinvestment, false),
//               'reinvest_amount', v_reinvest_amount,
//               'troco', v_troco,
//               'investor_id', v_profile.id
//           )
//       );
//   END;
//   $function$
//
// FUNCTION set_active_bank_account(uuid)
//   CREATE OR REPLACE FUNCTION public.set_active_bank_account(p_account_id uuid)
//    RETURNS void
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   BEGIN
//     UPDATE public.company_bank_accounts SET is_active = false WHERE id != p_account_id;
//     UPDATE public.company_bank_accounts SET is_active = true WHERE id = p_account_id;
//   END;
//   $function$
//
// FUNCTION set_active_user_bank_account(uuid, uuid)
//   CREATE OR REPLACE FUNCTION public.set_active_user_bank_account(p_account_id uuid, p_user_id uuid)
//    RETURNS void
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   BEGIN
//     UPDATE public.user_bank_accounts SET is_active = false WHERE user_id = p_user_id AND id != p_account_id;
//     UPDATE public.user_bank_accounts SET is_active = true WHERE id = p_account_id;
//   END;
//   $function$
//
// FUNCTION sync_expense_to_treasury()
//   CREATE OR REPLACE FUNCTION public.sync_expense_to_treasury()
//    RETURNS trigger
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   BEGIN
//     IF NEW.status = 'paid' THEN
//       -- Realiza INSERT, mas se o registro já existir (conflito no expense_id), realiza UPDATE (Upsert)
//       INSERT INTO public.treasury_transactions (
//         type,
//         amount,
//         date,
//         description,
//         category,
//         expense_id,
//         is_escrow
//       )
//       VALUES (
//         'out',
//         NEW.amount,
//         COALESCE(NEW.payment_date, NEW.due_date),
//         NEW.description,
//         NEW.category,
//         NEW.id,
//         false
//       )
//       ON CONFLICT (expense_id) DO UPDATE SET
//         amount = EXCLUDED.amount,
//         date = EXCLUDED.date,
//         description = EXCLUDED.description,
//         category = EXCLUDED.category;
//
//     ELSIF NEW.status = 'pending' THEN
//       -- Se voltar para pendente, remove o lançamento da tesouraria
//       DELETE FROM public.treasury_transactions WHERE expense_id = NEW.id;
//     END IF;
//
//     RETURN NEW;
//   END;
//   $function$
//
// FUNCTION sync_subscription_date_to_investment()
//   CREATE OR REPLACE FUNCTION public.sync_subscription_date_to_investment()
//    RETURNS trigger
//    LANGUAGE plpgsql
//    SECURITY DEFINER
//   AS $function$
//   BEGIN
//     IF NEW.investment_id IS NOT NULL AND NEW.subscription_date IS DISTINCT FROM OLD.subscription_date THEN
//       -- Update the investment transfer_date
//       UPDATE public.investments
//       SET transfer_date = NEW.subscription_date,
//           updated_at = NOW()
//       WHERE id = NEW.investment_id
//         AND transfer_date IS DISTINCT FROM NEW.subscription_date;
//
//       -- Log the automatic sync
//       INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
//       VALUES (
//         'investments',
//         NEW.investment_id,
//         'auto_sync_transfer_date',
//         auth.uid(),
//         jsonb_build_object(
//           'message', 'Data de transferência sincronizada automaticamente a partir da subscrição.',
//           'old_date', OLD.subscription_date,
//           'new_date', NEW.subscription_date,
//           'source_subscription_id', NEW.id
//         )
//       );
//     END IF;
//     RETURN NEW;
//   END;
//   $function$
//

// --- TRIGGERS ---
// Table: access_logs
//   on_access_log_created: CREATE TRIGGER on_access_log_created AFTER INSERT ON public.access_logs FOR EACH ROW EXECUTE FUNCTION invoke_login_notification()
// Table: credit_operations
//   on_operation_status_change: CREATE TRIGGER on_operation_status_change AFTER UPDATE ON public.credit_operations FOR EACH ROW EXECUTE FUNCTION log_operation_status_change()
//   on_operation_status_change_email: CREATE TRIGGER on_operation_status_change_email AFTER UPDATE ON public.credit_operations FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION invoke_operation_email_notification()
// Table: debenture_subscriptions
//   on_subscription_date_changed: CREATE TRIGGER on_subscription_date_changed AFTER UPDATE OF subscription_date ON public.debenture_subscriptions FOR EACH ROW EXECUTE FUNCTION sync_subscription_date_to_investment()
// Table: expenses
//   on_expense_paid: CREATE TRIGGER on_expense_paid AFTER INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION sync_expense_to_treasury()

// --- INDEXES ---
// Table: financial_parameters
//   CREATE UNIQUE INDEX financial_parameters_receivable_type_key ON public.financial_parameters USING btree (receivable_type)
// Table: operacoes_antecipacao
//   CREATE UNIQUE INDEX operacoes_antecipacao_ccb_id_key ON public.operacoes_antecipacao USING btree (ccb_id)
// Table: operation_calculations
//   CREATE UNIQUE INDEX operation_calculations_operation_id_key ON public.operation_calculations USING btree (operation_id)
// Table: transaction_categories
//   CREATE UNIQUE INDEX transaction_categories_name_key ON public.transaction_categories USING btree (name)
// Table: treasury_transactions
//   CREATE UNIQUE INDEX treasury_transactions_expense_id_key ON public.treasury_transactions USING btree (expense_id)
