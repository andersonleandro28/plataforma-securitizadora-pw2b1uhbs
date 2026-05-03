DO $$
DECLARE
  v_admin_id UUID;
  v_deleted_count INT;
  v_saldo_calculado NUMERIC;
  v_saldo_atual NUMERIC;
  v_user_record RECORD;
BEGIN
  -- 1. Create auditoria_limpeza table
  CREATE TABLE IF NOT EXISTS public.auditoria_limpeza (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acao TEXT NOT NULL,
    descricao TEXT NOT NULL,
    data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
  );

  -- Handle RLS
  ALTER TABLE public.auditoria_limpeza ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "admin_all_auditoria" ON public.auditoria_limpeza;
  CREATE POLICY "admin_all_auditoria" ON public.auditoria_limpeza
    FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND (profiles.role = 'admin'::app_role OR profiles.is_admin = true)
      )
    );

  -- Tentar pegar um admin logado ou o primeiro admin da base
  SELECT id INTO v_admin_id FROM public.profiles WHERE is_admin = true OR role = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
  END IF;

  -- 2. Deletar tabelas antigas se existirem
  DROP TABLE IF EXISTS public.movimentacoes_tesouraria CASCADE;
  DROP TABLE IF EXISTS public.contas_tesouraria CASCADE;
  DROP TABLE IF EXISTS public.movimentacoes_escrow CASCADE;
  DROP TABLE IF EXISTS public.parametros_sistema CASCADE;
  
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.auditoria_limpeza (acao, descricao, user_id)
    VALUES ('deletar_tabela', 'Tabelas antigas de tesouraria foram removidas (se existiam)', v_admin_id);
  END IF;

  -- 3. Limpar dados duplicados em movimentacoes_caixa
  WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER(PARTITION BY referencia_id, categoria ORDER BY created_at DESC) as rn
    FROM public.movimentacoes_caixa
    WHERE referencia_id IS NOT NULL
  )
  DELETE FROM public.movimentacoes_caixa WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 AND v_admin_id IS NOT NULL THEN
    INSERT INTO public.auditoria_limpeza (acao, descricao, user_id)
    VALUES ('limpar_duplicatas', 'Removidos ' || v_deleted_count || ' registros duplicados em movimentacoes_caixa', v_admin_id);
  END IF;

  -- 4. Limpar duplicações no mapeamento_movimentacoes
  WITH map_dups AS (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY origem_tabela, origem_id ORDER BY created_at DESC) as rn
    FROM public.mapeamento_movimentacoes
  )
  DELETE FROM public.mapeamento_movimentacoes WHERE id IN (SELECT id FROM map_dups WHERE rn > 1);

  -- 5. Validar e ajustar saldo_caixa
  FOR v_user_record IN SELECT DISTINCT user_id FROM public.movimentacoes_caixa LOOP
      SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0)
      INTO v_saldo_calculado
      FROM public.movimentacoes_caixa WHERE user_id = v_user_record.user_id;

      SELECT saldo_atual INTO v_saldo_atual FROM public.saldo_caixa WHERE user_id = v_user_record.user_id;

      IF v_saldo_atual IS NULL THEN
         INSERT INTO public.saldo_caixa (user_id, saldo_atual, saldo_anterior) VALUES (v_user_record.user_id, v_saldo_calculado, 0);
         IF v_admin_id IS NOT NULL THEN
             INSERT INTO public.auditoria_limpeza (acao, descricao, user_id)
             VALUES ('ajustar_saldo', 'Criado saldo_caixa inicial: ' || v_saldo_calculado || ' para user ' || v_user_record.user_id, v_admin_id);
         END IF;
      ELSIF v_saldo_calculado <> v_saldo_atual THEN
         UPDATE public.saldo_caixa SET saldo_anterior = saldo_atual, saldo_atual = v_saldo_calculado, data_atualizacao = NOW() WHERE user_id = v_user_record.user_id;
         IF v_admin_id IS NOT NULL THEN
             INSERT INTO public.auditoria_limpeza (acao, descricao, user_id)
             VALUES ('ajustar_saldo', 'Ajustado saldo_caixa de ' || v_saldo_atual || ' para ' || v_saldo_calculado || ' devido a divergência (User: ' || v_user_record.user_id || ')', v_admin_id);
         END IF;
      END IF;
  END LOOP;

  IF v_admin_id IS NOT NULL THEN
      INSERT INTO public.auditoria_limpeza (acao, descricao, user_id)
      VALUES ('deletar_página', 'A página Tesouraria & Escrow foi removida da rota e menu de navegação no frontend', v_admin_id);
  END IF;

END $$;
