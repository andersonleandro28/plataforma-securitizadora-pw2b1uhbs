import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'

export const EntityTypeStep = ({ formData, setFormData }: any) => (
  <div className="space-y-4 animate-fade-in">
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Tipo de Entidade</Label>
        <Select
          value={formData.entity_type}
          onValueChange={(v) => setFormData({ ...formData, entity_type: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
            <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>CPF / CNPJ *</Label>
        <Input
          value={formData.document_number}
          onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
          placeholder={formData.entity_type === 'pf' ? '000.000.000-00' : '00.000.000/0001-00'}
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label>Telefone / WhatsApp *</Label>
      <Input
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        placeholder="(00) 00000-0000"
      />
    </div>
  </div>
)

export const PfFieldsStep = ({ formData, setFormData }: any) => (
  <div className="space-y-4 animate-fade-in">
    <div className="space-y-2">
      <Label>Nome Completo</Label>
      <Input
        value={formData.full_name}
        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
      />
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>RG</Label>
        <Input
          value={formData.pf_rg}
          onChange={(e) => setFormData({ ...formData, pf_rg: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Nacionalidade</Label>
        <Input
          value={formData.pf_nationality}
          onChange={(e) => setFormData({ ...formData, pf_nationality: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Nome da Mãe</Label>
        <Input
          value={formData.pf_mother_name}
          onChange={(e) => setFormData({ ...formData, pf_mother_name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Nome do Pai (Opcional)</Label>
        <Input
          value={formData.pf_father_name}
          onChange={(e) => setFormData({ ...formData, pf_father_name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Estado Civil</Label>
        <Input
          value={formData.pf_marital_status}
          onChange={(e) => setFormData({ ...formData, pf_marital_status: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Profissão</Label>
        <Input
          value={formData.pf_occupation}
          onChange={(e) => setFormData({ ...formData, pf_occupation: e.target.value })}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Cidade de Nascimento</Label>
        <Input
          value={formData.pf_birth_city}
          onChange={(e) => setFormData({ ...formData, pf_birth_city: e.target.value })}
        />
      </div>
    </div>
  </div>
)

export const PjFieldsStep = ({ formData, setFormData }: any) => (
  <div className="space-y-4 animate-fade-in">
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2 sm:col-span-2">
        <Label>Razão Social</Label>
        <Input
          value={formData.pj_company_name}
          onChange={(e) => setFormData({ ...formData, pj_company_name: e.target.value })}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Nome Fantasia</Label>
        <Input
          value={formData.pj_trade_name}
          onChange={(e) => setFormData({ ...formData, pj_trade_name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>CNAE Principal</Label>
        <Input
          value={formData.pj_cnae}
          onChange={(e) => setFormData({ ...formData, pj_cnae: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Regime Tributário</Label>
        <Select
          value={formData.pj_tax_regime}
          onValueChange={(v) => setFormData({ ...formData, pj_tax_regime: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="simples">Simples Nacional</SelectItem>
            <SelectItem value="presumido">Lucro Presumido</SelectItem>
            <SelectItem value="real">Lucro Real</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Faturamento Anual (R$)</Label>
        <Input
          type="number"
          value={formData.pj_annual_revenue}
          onChange={(e) => setFormData({ ...formData, pj_annual_revenue: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Data de Fundação</Label>
        <Input
          type="date"
          value={formData.pj_foundation_date}
          onChange={(e) => setFormData({ ...formData, pj_foundation_date: e.target.value })}
        />
      </div>
    </div>
  </div>
)

export const PjRepStep = ({ formData, setFormData }: any) => (
  <div className="space-y-4 animate-fade-in">
    <h3 className="text-sm font-medium mb-4 text-muted-foreground">
      Dados do Representante Legal (Sócio-Administrador)
    </h3>
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2 sm:col-span-2">
        <Label>Nome Completo</Label>
        <Input
          value={formData.pj_rep_name}
          onChange={(e) => setFormData({ ...formData, pj_rep_name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Cargo na Empresa</Label>
        <Input
          value={formData.pj_rep_role}
          onChange={(e) => setFormData({ ...formData, pj_rep_role: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>CPF</Label>
        <Input
          value={formData.pj_rep_cpf}
          onChange={(e) => setFormData({ ...formData, pj_rep_cpf: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>RG</Label>
        <Input
          value={formData.pj_rep_rg}
          onChange={(e) => setFormData({ ...formData, pj_rep_rg: e.target.value })}
        />
      </div>
    </div>
    <div className="flex items-center space-x-3 pt-2">
      <Checkbox
        id="is_procurator"
        checked={formData.pj_rep_is_procurator}
        onCheckedChange={(c: boolean) => setFormData({ ...formData, pj_rep_is_procurator: c })}
      />
      <Label htmlFor="is_procurator" className="text-sm font-normal leading-snug">
        O representante legal atua através de procuração.
      </Label>
    </div>
  </div>
)

export const AddressStep = ({ formData, setFormData }: any) => {
  const [loadingCep, setLoadingCep] = useState(false)

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '')
    if (cep.length === 8) {
      setLoadingCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFormData({
            ...formData,
            address_street: data.logradouro || formData.address_street,
            address_neighborhood: data.bairro || formData.address_neighborhood,
            address_city: data.localidade || formData.address_city,
            address_state: data.uf || formData.address_state,
          })
        }
      } catch (err) {
        console.error('Erro ao buscar CEP', err)
      } finally {
        setLoadingCep(false)
      }
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2 relative">
          <Label>CEP</Label>
          <div className="relative">
            <Input
              value={formData.address_zip}
              onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
              onBlur={handleCepBlur}
              placeholder="00000-000"
            />
            {loadingCep && (
              <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Rua / Logradouro</Label>
          <Input
            value={formData.address_street}
            onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Número</Label>
          <Input
            value={formData.address_number}
            onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Complemento (Opcional)</Label>
          <Input
            value={formData.address_complement}
            onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Bairro</Label>
          <Input
            value={formData.address_neighborhood}
            onChange={(e) => setFormData({ ...formData, address_neighborhood: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input
            value={formData.address_city}
            onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Estado (UF)</Label>
          <Input
            value={formData.address_state}
            onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
            maxLength={2}
          />
        </div>
      </div>
    </div>
  )
}
