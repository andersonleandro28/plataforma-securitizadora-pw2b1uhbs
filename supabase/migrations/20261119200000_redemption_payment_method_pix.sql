-- Modalidade de pagamento do pedido de resgate (TED ou saque por PIX).
-- Pedidos já existentes recebem 'ted' pelo DEFAULT, preservando o comportamento atual.

ALTER TABLE public.investment_redemptions
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'ted';

ALTER TABLE public.investment_redemptions
  ADD COLUMN IF NOT EXISTS pix_key TEXT;

ALTER TABLE public.investment_redemptions
  DROP CONSTRAINT IF EXISTS investment_redemptions_payment_method_check;

ALTER TABLE public.investment_redemptions
  ADD CONSTRAINT investment_redemptions_payment_method_check
  CHECK (payment_method IN ('ted', 'pix'));
