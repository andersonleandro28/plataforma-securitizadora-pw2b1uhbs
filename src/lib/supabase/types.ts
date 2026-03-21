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
      investment_products: {
        Row: {
          created_at: string
          id: string
          min_investment: number
          progress: number | null
          rate: string
          risk: string
          status: string
          term: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_investment: number
          progress?: number | null
          rate: string
          risk: string
          status: string
          term: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          min_investment?: number
          progress?: number | null
          rate?: string
          risk?: string
          status?: string
          term?: string
          title?: string
          type?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
// Table: debenture_series
//   id: uuid (not null, default: gen_random_uuid())
//   debenture_id: uuid (not null)
//   series_number: text (not null)
//   volume: numeric (not null)
//   indexer: text (not null)
//   rate: numeric (not null)
//   maturity_date: date (nullable)
//   created_at: timestamp with time zone (not null, default: now())
// Table: debentures
//   id: uuid (not null, default: gen_random_uuid())
//   issuer_name: text (not null)
//   total_volume: numeric (not null)
//   issue_date: date (nullable)
//   created_at: timestamp with time zone (not null, default: now())
//   created_by: uuid (nullable)
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
// Table: serasa_consultations
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   document_number: text (not null)
//   score: integer (not null)
//   risk_level: text (not null)
//   raw_response: jsonb (not null)
//   created_at: timestamp with time zone (not null, default: now())

// --- CONSTRAINTS ---
// Table: access_logs
//   PRIMARY KEY access_logs_pkey: PRIMARY KEY (id)
//   FOREIGN KEY access_logs_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: border_items
//   FOREIGN KEY border_items_border_id_fkey: FOREIGN KEY (border_id) REFERENCES borders(id) ON DELETE CASCADE
//   PRIMARY KEY border_items_pkey: PRIMARY KEY (id)
// Table: borders
//   PRIMARY KEY borders_pkey: PRIMARY KEY (id)
// Table: debenture_series
//   FOREIGN KEY debenture_series_debenture_id_fkey: FOREIGN KEY (debenture_id) REFERENCES debentures(id) ON DELETE CASCADE
//   PRIMARY KEY debenture_series_pkey: PRIMARY KEY (id)
// Table: debentures
//   FOREIGN KEY debentures_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id)
//   PRIMARY KEY debentures_pkey: PRIMARY KEY (id)
// Table: investment_products
//   PRIMARY KEY investment_products_pkey: PRIMARY KEY (id)
// Table: kyc_documents
//   PRIMARY KEY kyc_documents_pkey: PRIMARY KEY (id)
//   FOREIGN KEY kyc_documents_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
//   FOREIGN KEY kyc_documents_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: profiles
//   CHECK profiles_entity_type_check: CHECK ((entity_type = ANY (ARRAY['pf'::text, 'pj'::text])))
//   FOREIGN KEY profiles_id_fkey: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
//   PRIMARY KEY profiles_pkey: PRIMARY KEY (id)
// Table: serasa_consultations
//   PRIMARY KEY serasa_consultations_pkey: PRIMARY KEY (id)
//   FOREIGN KEY serasa_consultations_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

// --- ROW LEVEL SECURITY POLICIES ---
// Table: access_logs
//   Policy "access_logs_insert_own" (INSERT, PERMISSIVE) roles={public}
//     WITH CHECK: ((auth.uid() = user_id) OR (auth.role() = 'anon'::text))
//   Policy "access_logs_select_own" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = user_id)
// Table: border_items
//   Policy "auth_all_border_items" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: borders
//   Policy "auth_all_borders" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: debenture_series
//   Policy "auth_all_series" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: debentures
//   Policy "auth_all_debentures" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: investment_products
//   Policy "auth_all_investment_products" (ALL, PERMISSIVE) roles={authenticated}
//     USING: true
//     WITH CHECK: true
// Table: kyc_documents
//   Policy "admin_all_kyc_docs" (ALL, PERMISSIVE) roles={authenticated}
//     USING: is_admin()
//   Policy "kyc_docs_insert_own" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "kyc_docs_select_own" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = user_id)
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
// Table: serasa_consultations
//   Policy "authenticated_insert" (INSERT, PERMISSIVE) roles={authenticated}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "authenticated_select" (SELECT, PERMISSIVE) roles={authenticated}
//     USING: (auth.uid() = user_id)

// --- DATABASE FUNCTIONS ---
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

// --- TRIGGERS ---
// Table: access_logs
//   on_access_log_created: CREATE TRIGGER on_access_log_created AFTER INSERT ON public.access_logs FOR EACH ROW EXECUTE FUNCTION invoke_login_notification()
