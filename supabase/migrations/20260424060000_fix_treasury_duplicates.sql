DO $$
BEGIN
  -- 1. Identificar e limpar lançamentos duplicados (Cleanup)
  -- Mantém apenas o registro mais recente para cada expense_id
  DELETE FROM public.treasury_transactions
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER(PARTITION BY expense_id ORDER BY created_at DESC, id DESC) as rn
      FROM public.treasury_transactions
      WHERE expense_id IS NOT NULL
    ) t
    WHERE t.rn > 1
  );
END $$;

-- 2. Vínculo Único: Adicionar constraint UNIQUE para garantir relacionamento 1:1 e integridade atômica
ALTER TABLE public.treasury_transactions DROP CONSTRAINT IF EXISTS treasury_transactions_expense_id_key;
ALTER TABLE public.treasury_transactions ADD CONSTRAINT treasury_transactions_expense_id_key UNIQUE (expense_id);

-- 3. Prevenção de Duplicidade: Atualizar a trigger para utilizar Trava de Idempotência (UPSERT)
CREATE OR REPLACE FUNCTION public.sync_expense_to_treasury()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    -- Realiza INSERT, mas se o registro já existir (conflito no expense_id), realiza UPDATE (Upsert)
    INSERT INTO public.treasury_transactions (
      type, 
      amount, 
      date, 
      description, 
      category, 
      expense_id, 
      is_escrow
    )
    VALUES (
      'out', 
      NEW.amount, 
      COALESCE(NEW.payment_date, NEW.due_date), 
      NEW.description, 
      NEW.category, 
      NEW.id, 
      false
    )
    ON CONFLICT (expense_id) DO UPDATE SET
      amount = EXCLUDED.amount,
      date = EXCLUDED.date,
      description = EXCLUDED.description,
      category = EXCLUDED.category;
      
  ELSIF NEW.status = 'pending' THEN
    -- Se voltar para pendente, remove o lançamento da tesouraria
    DELETE FROM public.treasury_transactions WHERE expense_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
