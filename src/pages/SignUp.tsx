import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Loader2, Briefcase, Building2, User, ChevronRight, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

export default function SignUp() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [authLoading, setAuthLoading] = useState(false)
  const [formData, setFormData] = useState({
    role: 'investor',
    entity_type: 'pf',
    full_name: '',
    document_number: '',
    pf_birth_date: '',
    phone: '',
    pj_company_name: '',
    pj_trade_name: '',
    pj_state_registration: '',
    pj_rep_name: '',
    pj_rep_cpf: '',
    pj_rep_role: '',
    address_zip: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
  })

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  if (user) return <Navigate to="/" replace />

  const handleCepBlur = async () => {
    const cep = formData.address_zip.replace(/\D/g, '')
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            address_street: data.logradouro || prev.address_street,
            address_neighborhood: data.bairro || prev.address_neighborhood,
            address_city: data.localidade || prev.address_city,
            address_state: data.uf || prev.address_state,
          }))
        }
      } catch (err) {
        console.error('Erro ao buscar CEP', err)
      }
    }
  }

  const renderInput = (
    label: string,
    field: keyof typeof formData,
    type = 'text',
    props: any = {},
  ) => (
    <div className="space-y-1">
      <Label className="text-xs">
        {label} {props.required !== false && '*'}
      </Label>
      <Input
        type={type}
        required={props.required !== false}
        value={formData[field] as string}
        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
        className="h-9 text-sm"
        {...props}
      />
    </div>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 4) {
      if (step === 2 && !formData.document_number)
        return toast.error('Preencha os campos obrigatórios.')
      return setStep(step + 1)
    }
    if (formData.password !== formData.confirmPassword)
      return toast.error('As senhas não coincidem.')
    if (formData.password.length < 6)
      return toast.error('A senha deve ter pelo menos 6 caracteres.')
    if (!formData.terms) return toast.error('Você deve aceitar os termos para continuar.')

    setAuthLoading(true)
    try {
      const res = await supabase.functions.invoke('public-signup', { body: formData })
      if (res.error || res.data?.error) throw new Error(res.error?.message || res.data?.error)

      await signIn(formData.email, formData.password)
      toast.success('Conta criada com sucesso! Bem-vindo.')
      navigate('/')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta. Verifique os dados e tente novamente.')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg shadow-lg border-primary/10 animate-fade-in-up">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">Criar Conta</CardTitle>
          <CardDescription>Junte-se à Plataforma Securitizadora</CardDescription>
        </CardHeader>
        <div className="px-6 py-2">
          <Progress value={(step / 4) * 100} className="h-2" />
        </div>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Qual o seu objetivo?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'investor' })}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 border rounded-xl transition-all',
                        formData.role === 'investor'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'hover:border-primary/50',
                      )}
                    >
                      <Briefcase className="h-5 w-5 mb-2" />
                      <span className="font-medium text-sm">Quero Investir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'borrower' })}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 border rounded-xl transition-all',
                        formData.role === 'borrower'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'hover:border-primary/50',
                      )}
                    >
                      <Building2 className="h-5 w-5 mb-2" />
                      <span className="font-medium text-sm">Tomar Crédito</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Tipo de Cadastro</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, entity_type: 'pf' })}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 border rounded-xl transition-all',
                        formData.entity_type === 'pf'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'hover:border-primary/50',
                      )}
                    >
                      <User className="h-5 w-5 mb-2" />
                      <span className="font-medium text-sm">Pessoa Física</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, entity_type: 'pj' })}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 border rounded-xl transition-all',
                        formData.entity_type === 'pj'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'hover:border-primary/50',
                      )}
                    >
                      <Building2 className="h-5 w-5 mb-2" />
                      <span className="font-medium text-sm">Pessoa Jurídica</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && formData.entity_type === 'pf' && (
              <div className="space-y-3 animate-fade-in">
                {renderInput('Nome Completo', 'full_name')}
                <div className="grid grid-cols-2 gap-3">
                  {renderInput('CPF', 'document_number', 'text', { placeholder: '000.000.000-00' })}
                  {renderInput('Data de Nasc.', 'pf_birth_date', 'date')}
                </div>
                {renderInput('Telefone / WhatsApp', 'phone', 'text', {
                  placeholder: '(00) 00000-0000',
                })}
              </div>
            )}

            {step === 2 && formData.entity_type === 'pj' && (
              <div className="space-y-3 animate-fade-in">
                {renderInput('Razão Social', 'pj_company_name')}
                <div className="grid grid-cols-2 gap-3">
                  {renderInput('CNPJ', 'document_number', 'text', {
                    placeholder: '00.000.000/0001-00',
                  })}
                  {renderInput('Nome Fantasia', 'pj_trade_name')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {renderInput('Inscrição Estadual', 'pj_state_registration', 'text', {
                    required: false,
                  })}
                  {renderInput('Telefone / WhatsApp', 'phone')}
                </div>
                <div className="pt-2 border-t mt-2">
                  <h4 className="text-xs font-semibold mb-2">Responsável Legal</h4>
                  {renderInput('Nome Completo', 'pj_rep_name')}
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {renderInput('CPF', 'pj_rep_cpf')}
                    {renderInput('Cargo', 'pj_rep_role')}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    {renderInput('CEP', 'address_zip', 'text', { onBlur: handleCepBlur })}
                  </div>
                  <div className="col-span-2">
                    {renderInput('Rua / Logradouro', 'address_street')}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">{renderInput('Número', 'address_number')}</div>
                  <div className="col-span-2">
                    {renderInput('Complemento', 'address_complement', 'text', { required: false })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">{renderInput('Bairro', 'address_neighborhood')}</div>
                  <div className="col-span-1">{renderInput('Cidade', 'address_city')}</div>
                  <div className="col-span-1">{renderInput('UF', 'address_state')}</div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 animate-fade-in">
                {renderInput(
                  formData.entity_type === 'pj' ? 'E-mail Corporativo' : 'E-mail Pessoal',
                  'email',
                  'email',
                )}
                <div className="grid grid-cols-2 gap-3">
                  {renderInput('Senha', 'password', 'password')}
                  {renderInput('Confirmar Senha', 'confirmPassword', 'password')}
                </div>
                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="terms"
                    checked={formData.terms}
                    onCheckedChange={(c: boolean) => setFormData({ ...formData, terms: c })}
                  />
                  <Label htmlFor="terms" className="text-xs font-normal leading-tight mt-0.5">
                    Declaro que li e concordo com os Termos de Uso, Políticas de Privacidade e
                    normas de KYC da plataforma.
                  </Label>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2">
            <div className="flex justify-between w-full">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  disabled={authLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              ) : (
                <div></div>
              )}
              <Button type="submit" disabled={authLoading}>
                {authLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                {step < 4 ? (
                  <>
                    <span className="mr-1">Próximo</span> <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  'Finalizar Cadastro'
                )}
              </Button>
            </div>
            {step === 1 && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link to="/login">Já tem conta? Entre no sistema</Link>
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
