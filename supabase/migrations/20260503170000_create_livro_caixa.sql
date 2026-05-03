DO $$
BEGIN
  -- 1. Create saldo_caixa
  CREATE TABLE IF NOT EXISTS public.saldo_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saldo_atual NUMERIC(12,2) DEFAULT 0 NOT NULL,
    saldo_anterior NUMERIC(12,2) DEFAULT 0 NOT NULL,
    data_atualizacao TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
  );

  -- 2. Create movimentacoes_caixa
  CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saída')),
    categoria TEXT NOT NULL CHECK (categoria IN ('subscrição_debênture', 'liquidação_recebível', 'pagamento_ccb', 'depósito', 'juros_entrada', 'fornecedor', 'aquisição_ccb', 'aquisição_recebível', 'despesa', 'juros_saída')),
    descricao TEXT,
    valor NUMERIC(12,2) NOT NULL,
    saldo_anterior NUMERIC(12,2) NOT NULL,
    saldo_novo NUMERIC(12,2) NOT NULL,
    referencia_id UUID,
    referencia_tipo TEXT CHECK (referencia_tipo IN ('subscrição', 'recebível', 'ccb', 'fornecedor', 'despesa', 'depósito', 'outro')),
    referencia_numero TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 3. Create mapeamento_movimentacoes
  CREATE TABLE IF NOT EXISTS public.mapeamento_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimentacao_caixa_id UUID REFERENCES public.movimentacoes_caixa(id) ON DELETE CASCADE NOT NULL,
    origem_tabela TEXT CHECK (origem_tabela IN ('subscrições', 'recebíveis', 'ccb', 'fornecedores', 'despesas', 'depósitos', 'juros')),
    origem_id UUID NOT NULL,
    sincronizado BOOLEAN DEFAULT false,
    data_sincronizacao TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(origem_tabela, origem_id)
  );

END $$;

-- Setup RLS para saldo_caixa
ALTER TABLE public.saldo_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_saldo_caixa_select" ON public.saldo_caixa;
CREATE POLICY "admin_saldo_caixa_select" ON public.saldo_caixa FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_saldo_caixa_update" ON public.saldo_caixa;
CREATE POLICY "admin_saldo_caixa_update" ON public.saldo_caixa FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_saldo_caixa_insert" ON public.saldo_caixa;
CREATE POLICY "admin_saldo_caixa_insert" ON public.saldo_caixa FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Setup RLS para movimentacoes_caixa
ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_movimentacoes_caixa_select" ON public.movimentacoes_caixa;
CREATE POLICY "admin_movimentacoes_caixa_select" ON public.movimentacoes_caixa FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_movimentacoes_caixa_insert" ON public.movimentacoes_caixa;
CREATE POLICY "admin_movimentacoes_caixa_insert" ON public.movimentacoes_caixa FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_movimentacoes_caixa_update" ON public.movimentacoes_caixa;
CREATE POLICY "admin_movimentacoes_caixa_update" ON public.movimentacoes_caixa FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Setup RLS para mapeamento_movimentacoes
ALTER TABLE public.mapeamento_movimentacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_mapeamento_select" ON public.mapeamento_movimentacoes;
CREATE POLICY "admin_mapeamento_select" ON public.mapeamento_movimentacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_mapeamento_insert" ON public.mapeamento_movimentacoes;
CREATE POLICY "admin_mapeamento_insert" ON public.mapeamento_movimentacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_mapeamento_update" ON public.mapeamento_movimentacoes;
CREATE POLICY "admin_mapeamento_update" ON public.mapeamento_movimentacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: Processar movimentações e atualizar saldo
CREATE OR REPLACE FUNCTION public.processa_movimentacao_caixa()
RETURNS trigger AS $$
DECLARE
  v_saldo_atual NUMERIC(12,2);
BEGIN
  -- Bloqueia a linha do usuário para evitar concorrência
  SELECT saldo_atual INTO v_saldo_atual
  FROM public.saldo_caixa
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  -- Se não existir, cria o saldo inicial zerado
  IF NOT FOUND THEN
    INSERT INTO public.saldo_caixa (user_id, saldo_atual, saldo_anterior)
    VALUES (NEW.user_id, 0, 0)
    RETURNING saldo_atual INTO v_saldo_atual;
  END IF;

  IF NEW.tipo = 'saída' THEN
    IF v_saldo_atual < NEW.valor THEN
      RAISE EXCEPTION 'Saldo insuficiente para esta operação';
    END IF;
    NEW.saldo_anterior := v_saldo_atual;
    NEW.saldo_novo := v_saldo_atual - NEW.valor;
  ELSIF NEW.tipo = 'entrada' THEN
    NEW.saldo_anterior := v_saldo_atual;
    NEW.saldo_novo := v_saldo_atual + NEW.valor;
  END IF;

  -- Atualiza a tabela de saldo
  UPDATE public.saldo_caixa
  SET saldo_anterior = v_saldo_atual,
      saldo_atual = NEW.saldo_novo,
      data_atualizacao = NOW(),
      updated_at = NOW()
  WHERE user_id = NEW.user_id;

  NEW.created_at := NOW();
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_processa_movimentacao_caixa ON public.movimentacoes_caixa;
CREATE TRIGGER trg_processa_movimentacao_caixa
BEFORE INSERT ON public.movimentacoes_caixa
FOR EACH ROW
EXECUTE FUNCTION public.processa_movimentacao_caixa();

-- Trigger: Proteger campos vitais de alterações pós-registro
CREATE OR REPLACE FUNCTION public.protect_movimentacao_core_fields()
RETURNS trigger AS $$
BEGIN
  IF NEW.valor <> OLD.valor OR NEW.tipo <> OLD.tipo OR NEW.categoria <> OLD.categoria OR NEW.saldo_anterior <> OLD.saldo_anterior OR NEW.saldo_novo <> OLD.saldo_novo THEN
    RAISE EXCEPTION 'Não é permitido alterar os campos financeiros da movimentação';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_movimentacao_core_fields ON public.movimentacoes_caixa;
CREATE TRIGGER trg_protect_movimentacao_core_fields
BEFORE UPDATE ON public.movimentacoes_caixa
FOR EACH ROW
EXECUTE FUNCTION public.protect_movimentacao_core_fields();

-- Trigger: Bloquear duplicação de transações registradas
CREATE OR REPLACE FUNCTION public.check_duplicidade_mapeamento()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.mapeamento_movimentacoes WHERE origem_tabela = NEW.origem_tabela AND origem_id = NEW.origem_id) THEN
    RAISE EXCEPTION 'Esta operação já foi registrada no caixa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_duplicidade_mapeamento ON public.mapeamento_movimentacoes;
CREATE TRIGGER trg_check_duplicidade_mapeamento
BEFORE INSERT ON public.mapeamento_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.check_duplicidade_mapeamento();
