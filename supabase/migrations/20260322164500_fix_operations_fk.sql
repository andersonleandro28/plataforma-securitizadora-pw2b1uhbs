DO $BODY$
BEGIN
  -- Fix credit_operations.borrower_id to reference public.profiles
  ALTER TABLE public.credit_operations DROP CONSTRAINT IF EXISTS credit_operations_borrower_id_fkey;
  ALTER TABLE public.credit_operations ADD CONSTRAINT credit_operations_borrower_id_fkey FOREIGN KEY (borrower_id) REFERENCES public.profiles(id);

  -- Fix operation_status_history.changed_by to reference public.profiles
  ALTER TABLE public.operation_status_history DROP CONSTRAINT IF EXISTS operation_status_history_changed_by_fkey;
  ALTER TABLE public.operation_status_history ADD CONSTRAINT operation_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);

  -- Fix operation_documents.uploaded_by to reference public.profiles
  ALTER TABLE public.operation_documents DROP CONSTRAINT IF EXISTS operation_documents_uploaded_by_fkey;
  ALTER TABLE public.operation_documents ADD CONSTRAINT operation_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);

  -- Fix parameter_history.changed_by to reference public.profiles
  ALTER TABLE public.parameter_history DROP CONSTRAINT IF EXISTS parameter_history_changed_by_fkey;
  ALTER TABLE public.parameter_history ADD CONSTRAINT parameter_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);
  
  -- Fix financial_parameters.updated_by to reference public.profiles
  ALTER TABLE public.financial_parameters DROP CONSTRAINT IF EXISTS financial_parameters_updated_by_fkey;
  ALTER TABLE public.financial_parameters ADD CONSTRAINT financial_parameters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);
END $BODY$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
