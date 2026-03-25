import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ProductForm({ data, onChange, seriesList }: any) {
  const tSold = (data.sold_quotas || 0) * (data.quota_value || 0)
  const tGlobal = (data.global_quotas || 0) * (data.quota_value || 0)

  return (
    <Tabs defaultValue="geral" className="w-full">
      <TabsList className="flex flex-wrap w-full justify-start h-auto">
        <TabsTrigger value="geral">Geral</TabsTrigger>
        <TabsTrigger value="oferta">Oferta</TabsTrigger>
        <TabsTrigger value="prazos">Prazos</TabsTrigger>
        <TabsTrigger value="resgate">Regras de Resgate</TabsTrigger>
        <TabsTrigger value="extra">Avançado</TabsTrigger>
      </TabsList>

      <TabsContent value="geral" className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2">
            <Label>Nome do Produto *</Label>
            <Input value={data.title} onChange={(e) => onChange('title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Rating de Risco</Label>
            <Select value={data.rating} onValueChange={(v) => onChange('rating', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Risco Baixo">Risco Baixo</SelectItem>
                <SelectItem value="Risco Médio">Risco Médio</SelectItem>
                <SelectItem value="Risco Alto">Risco Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={data.status} onValueChange={(v) => onChange('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Em Captação">Em Captação</SelectItem>
                <SelectItem value="Últimas Cotas">Últimas Cotas</SelectItem>
                <SelectItem value="Esgotado">Esgotado</SelectItem>
                <SelectItem value="Encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Série Vinculada (Obrigatório para aportes)</Label>
            <Select value={data.series_id || ''} onValueChange={(v) => onChange('series_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a série" />
              </SelectTrigger>
              <SelectContent>
                {seriesList.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    Série {s.series_number} ({s.indexer})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Gestor</Label>
            <Input
              value={data.manager || ''}
              onChange={(e) => onChange('manager', e.target.value)}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="oferta" className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <Select value={data.currency} onValueChange={(v) => onChange('currency', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real (BRL)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor da Cota</Label>
            <Input
              type="number"
              value={data.quota_value || ''}
              onChange={(e) => onChange('quota_value', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Qtd. Global de Cotas</Label>
            <Input
              type="number"
              value={data.global_quotas || ''}
              onChange={(e) => onChange('global_quotas', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cotas Mín. por Investidor</Label>
            <Input
              type="number"
              value={data.min_quotas_per_investor || ''}
              onChange={(e) => onChange('min_quotas_per_investor', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cotas Máx. por Investidor</Label>
            <Input
              type="number"
              value={data.max_quotas_per_investor || ''}
              onChange={(e) => onChange('max_quotas_per_investor', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rentabilidade Alvo</Label>
            <Input
              value={data.rate || ''}
              onChange={(e) => onChange('rate', e.target.value)}
              placeholder="Ex: CDI + 3% a.a."
            />
          </div>
        </div>
        <div className="bg-muted/30 p-3 rounded-md border text-sm flex justify-between">
          <span>
            Volume Total: <strong>{tGlobal.toLocaleString('pt-BR')}</strong>
          </span>
          <span>
            Volume Vendido:{' '}
            <strong>
              {tSold.toLocaleString('pt-BR')} ({data.sold_quotas || 0} cotas)
            </strong>
          </span>
        </div>
      </TabsContent>

      <TabsContent value="prazos" className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Aplicação Cotização (Meses)</Label>
            <Input
              type="number"
              value={data.application_cotization_months || ''}
              onChange={(e) => onChange('application_cotization_months', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Resgate Cotização (Meses)</Label>
            <Input
              type="number"
              value={data.redemption_cotization_months || ''}
              onChange={(e) => onChange('redemption_cotization_months', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Liquidação Financeira</Label>
            <Textarea
              value={data.financial_settlement || ''}
              onChange={(e) => onChange('financial_settlement', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Tributação (Regras de IR)</Label>
            <Textarea
              value={data.ir_rules || ''}
              onChange={(e) => onChange('ir_rules', e.target.value)}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="resgate" className="space-y-4 py-4">
        <div className="space-y-4 border rounded-lg p-5 bg-muted/10">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="allow_early"
              checked={data.allow_early_redemption}
              onCheckedChange={(c) => {
                onChange('allow_early_redemption', c)
                if (!c) {
                  onChange('early_redemption_penalty_pct', 0)
                  onChange('early_redemption_discount_pct', 0)
                }
              }}
              className="mt-1"
            />
            <div className="space-y-1">
              <label htmlFor="allow_early" className="text-sm font-semibold cursor-pointer">
                Permitir Resgate Antecipado
              </label>
              <p className="text-xs text-muted-foreground">
                Se habilitado, os investidores poderão solicitar o resgate de cotas antes do
                vencimento final do produto, sujeito a multas e descontos configurados abaixo.
              </p>
            </div>
          </div>

          {!data.allow_early_redemption ? (
            <div className="bg-muted p-3 rounded-md border text-sm text-muted-foreground mt-4">
              Configuração atual: O resgate será permitido <strong>apenas no vencimento</strong> da
              série.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
              <div className="space-y-1.5">
                <Label>Multa sobre Principal (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 5"
                  value={data.early_redemption_penalty_pct || ''}
                  onChange={(e) => onChange('early_redemption_penalty_pct', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto no Rendimento (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 50"
                  value={data.early_redemption_discount_pct || ''}
                  onChange={(e) =>
                    onChange('early_redemption_discount_pct', Number(e.target.value))
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5 pt-4 border-t mt-4">
            <Label>Prazo de Carência Mínimo (meses)</Label>
            <Input
              type="number"
              className="w-full sm:w-1/2"
              placeholder="Ex: 6"
              value={data.min_grace_period_months || ''}
              onChange={(e) => onChange('min_grace_period_months', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Tempo mínimo que o investimento precisa ficar bloqueado antes de qualquer solicitação
              de resgate.
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="extra" className="space-y-4 py-4">
        <div className="space-y-1.5">
          <Label>Descrição Completa</Label>
          <Textarea
            className="h-24"
            value={data.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Público-Alvo</Label>
            <Input
              value={data.target_audience || ''}
              onChange={(e) => onChange('target_audience', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo do Produto</Label>
            <Input
              value={data.term || ''}
              onChange={(e) => onChange('term', e.target.value)}
              placeholder="Ex: 24 meses"
            />
          </div>
        </div>
        <div className="flex items-center gap-6 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="active"
              checked={data.is_active}
              onCheckedChange={(c) => onChange('is_active', c)}
            />
            <label htmlFor="active" className="text-sm font-medium">
              Produto Ativo na Vitrine
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="highlight"
              checked={data.is_highlighted}
              onCheckedChange={(c) => onChange('is_highlighted', c)}
            />
            <label htmlFor="highlight" className="text-sm font-medium">
              Destaque Principal
            </label>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
