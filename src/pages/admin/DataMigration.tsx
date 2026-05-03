import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { Loader2, Trash2, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { exportToCSV } from '@/lib/export-utils'

export default function DataMigration() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tablesExist, setTablesExist] = useState(true)
  const [integrityStatus, setIntegrityStatus] = useState<Record<string, string>>({})

  useEffect(() => {
    checkTables()
  }, [])

  const checkTables = async () => {
    try {
      setChecking(true)
      const { error } = await supabase.from('movimentacoes_caixa').select('id').limit(1)
      if (error && error.code === '42P01') {
        setTablesExist(false)
      } else {
        setTablesExist(true)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setChecking(false)
    }
  }

  const checkIntegrity = async () => {
    const checks = [
      { name: 'subscrições', table: 'debenture_subscriptions' },
      { name: 'ccb', table: 'ccb_solicitacoes' },
      { name: 'recebíveis', table: 'recebiveis_ccb' },
      { name: 'despesas', table: 'expenses' },
      { name: 'fornecedores', table: 'suppliers' },
    ]

    const status: Record<string, string> = {}
    for (const check of checks) {
      const { count, error } = await supabase
        .from(check.table)
        .select('*', { count: 'exact', head: true })
      if (error || count === 0 || count === null) {
        toast.warning(`Tabela ${check.name} pode estar corrompida. Verifique manualmente.`)
        status[check.name] = 'warning'
      } else {
        status[check.name] = 'ok'
      }
    }
    setIntegrityStatus(status)
  }

  const handleCleanup = async () => {
    try {
      setLoading(true)

      // PARTE 3: Export CSV Backup
      if (tablesExist) {
        const { data: movs, error: fetchErr } = await supabase
          .from('movimentacoes_caixa')
          .select('*')
        if (!fetchErr && movs && movs.length > 0) {
          exportToCSV(movs, 'backup_movimentacoes_caixa.csv')
          toast.success('Backup exportado com sucesso.')
        }
      }

      // PARTE 1: Execute cleanup RPC
      const { error: rpcErr } = await supabase.rpc('limpar_tabelas_problematicas')
      if (rpcErr) throw rpcErr

      setTablesExist(false)

      // PARTE 2: Verify integrity
      await checkIntegrity()

      // PARTE 4: Success Confirmation
      toast.success('Limpeza concluída. Tabelas problemáticas removidas.')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro durante a limpeza: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Limpeza de Dados e Integridade</h1>
        <p className="text-muted-foreground mt-2">
          Ferramenta para remoção de tabelas problemáticas e verificação da integridade das raízes
          financeiras.
        </p>
      </div>

      {!tablesExist && (
        <Alert className="bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Ambiente Limpo</AlertTitle>
          <AlertDescription className="text-emerald-700">
            As tabelas problemáticas (movimentacoes_caixa, saldo_caixa, mapeamento_movimentacoes) já
            foram deletadas e o banco de dados encontra-se limpo de duplicações.
          </AlertDescription>
        </Alert>
      )}

      {Object.keys(integrityStatus).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status de Integridade</CardTitle>
            <CardDescription>
              Resultado da verificação nas tabelas raiz após a limpeza.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {Object.entries(integrityStatus).map(([table, status]) => (
                <li key={table} className="flex items-center justify-between p-3 border rounded-md">
                  <span className="capitalize font-medium">{table}</span>
                  {status === 'ok' ? (
                    <span className="flex items-center text-emerald-600 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Íntegra
                    </span>
                  ) : (
                    <span className="flex items-center text-orange-600 text-sm font-medium">
                      <AlertTriangle className="w-4 h-4 mr-1" /> Alerta (Vazia/Corrompida)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {tablesExist && (
        <Card className="border-red-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Remover Tabelas Problemáticas
            </CardTitle>
            <CardDescription>
              Esta ação fará o backup automático dos dados em formato CSV e deletará permanentemente
              as tabelas
              <code className="mx-1 px-1 bg-muted rounded">movimentacoes_caixa</code>,
              <code className="mx-1 px-1 bg-muted rounded">saldo_caixa</code> e
              <code className="mx-1 px-1 bg-muted rounded">mapeamento_movimentacoes</code>.
            </CardDescription>
          </CardHeader>
          <CardFooter className="bg-red-50/50 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-red-600 font-medium">
              Esta ação não afeta os recebíveis, subscrições ou CCBs.
            </span>
            <Button
              onClick={handleCleanup}
              disabled={loading}
              variant="destructive"
              className="gap-2 w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando Limpeza...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Fazer Backup e Deletar
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
