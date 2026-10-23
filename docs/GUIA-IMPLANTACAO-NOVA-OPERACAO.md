# Guia Completo de Implantação — Nexum Security 360° em Nova Operação

> **Público-alvo:** Diretores, gestores operacionais e implantadores (não-programadores).  
> **Finalidade deste documento:** Este arquivo reúne todas as especificações e instruções necessárias para subir uma instância **nova, limpa e independente** da plataforma **Nexum Security 360°** em um novo projeto na plataforma **Skip** conectado a um novo banco de dados **Supabase**.  
> **Como usar:** Copie o conteúdo deste arquivo e envie ao agente de IA do novo projeto Skip como instrução mestre da nova operação.

---

## 1. Visão Geral da Plataforma

A **Nexum Security 360°** é uma plataforma institucional para **Securitizadoras de Crédito**, desenhada para fazer a gestão completa e centralizada do ciclo de securitização: captação de recursos via debêntures/títulos de investimento (Passivo) e originação/aquisição de direitos creditórios e CCBs (Ativo), com tesouraria, contabilidade gerencial (DRE/DFC) e inteligência analítica integradas.

### Módulos Principais do Sistema Real:

1. **Perfis & Compliance KYC (PF e PJ):**
   - Onboarding digital com validação rigorosa de CPF e CNPJ.
   - Suporte a procuradores e representantes legais para Pessoas Jurídicas.
   - Upload e custódia de documentos comprobatórios (balanços, certidões, contratos sociais, CNH) em bucket seguro (`kyc-documents`).
   - Dossiê cadastral consolidado com exportação em PDF e controle de status (Pendente, Em Análise, Aprovado, Rejeitado).

2. **Passivo — Catálogo de Produtos e Debêntures:**
   - Gestão de Escrituras de Emissão e Séries de Debêntures vinculadas com numeração, volume, prazos e indexadores (CDI, IPCA, Pré-fixado, etc.).
   - Catálogo flexível de produtos de investimento com suporte a **Regime de Juros Acumulado** (capitalização com liquidação no vencimento/resgate) ou **Regime de Juros Mensal** (rendimento pago periodicamente sem amortizar o principal).
   - Emissão automatizada do **Termo de Subscrição de Debêntures** e do **Certificado de Cautela** nominativa em PDF com assinatura eletrônica.

3. **Ativo — Operações de Crédito & CCB (Cédula de Crédito Bancário):**
   - Antecipação de Recebíveis com cronograma de parcelas e os **6 tipos canônicos homologados**:
     1. **Cheque** (pré-datados e à vista)
     2. **Nota Promissória** (títulos de crédito por promessa de pagamento)
     3. **Contrato de Mútuo** (mútuo financeiro com prazos ou garantias)
     4. **Confissão de Dívida** (instrumentos públicos ou particulares)
     5. **Recebível Contratual** (prestação de serviços, locação, fornecimento)
     6. **Outros** (com descrição personalizada da garantia/origem)
   - Emissão de CCB Digital, minutas de Aditivos Contratuais e envio automático da **Notificação de Cessão de Crédito** formal aos sacados devedores com link público de tomada de ciência.

4. **Aportes e Resgates de Investidores com Ajuste Manual:**
   - Fluxo de aprovação de investimentos com envio e validação de comprovantes de transferência.
   - Solicitação de resgates com cálculo automático de carência, amortização de cotas, retenção de imposto de renda (IRRF) ou conversão automática para reinvestimento em novas séries.
   - Painel administrativo com permissão para **ajuste manual de valor líquido e imposto**, permitindo conciliação exata de centavos antes do pagamento.

5. **Tesouraria & Livro Caixa:**
   - Controle de contas bancárias da empresa securitizadora com conciliação manual e automática.
   - Transferências financeiras entre contas internas da própria securitizadora com pareamento atômico de débitos e créditos.
   - **Tarifas PIX PF e PJ por Conta Bancária:** configuração individual de custo de transferência PIX por conta, com lançamento automático de despesa na tesouraria e estorno inteligente ao desfazer transferências.
   - Gestão de Despesas Administrativas e Recorrentes com parcelamento inteligente (saneamento preventivo que assegura que parcelas futuras não nasçam como pagas).

6. **Planejamento Financeiro, DRE e DFC:**
   - **Fluxo de Caixa Projetado:** visão tabular mês a mês das receitas contratuais esperadas, despesas recorrentes e possibilidade de lançamentos manuais projetados.
   - **DRE (Demonstrativo do Resultado do Exercício):** apuração real de receitas brutas de cessão, deduções, despesas de captação (juros de investidores), despesas operacionais e cálculo dos tributos federais da securitizadora.
   - **DFC (Demonstrativo do Fluxo de Caixa):** classificação direta pelo padrão contábil FASB 95 em Atividades Operacionais, Atividades de Investimento e Atividades de Financiamento.

7. **Assistente Virtual Nexum:**
   - Chat inteligente contextual alimentado pela base de conhecimento institucional (`src/lib/assistant-knowledge.ts`), segmentando respostas por perfil de acesso (investidor, tomador, analista e administrador).

---

## 2. Inventário de Migrations do Banco de Dados

O banco de dados possui **92 arquivos de migração** em `supabase/migrations/`.  
Para uma implantação limpa em uma nova operação, as migrações são divididas estritamente em duas categorias:

- **APLICAR (75 migrations):** Migrações estruturais que criam tabelas, colunas, tipos enumerados, índices, funções de banco (RPCs), triggers de auditoria/cálculo, buckets de armazenamento e tabelas de domínio. **Devem ser executadas em ordem cronológica.**
- **PULAR (17 migrations):** Scripts corretivos que continham dados de testes da operação piloto anterior (nomes de clientes específicos, correções manuais de datas de CCB de terceiros, deleções de tabelas de protótipo já descontinuadas, ou cadastros de administradores com e-mails e senhas conhecidos). **Não devem ser aplicadas na nova operação para manter o banco limpo e seguro.**

### Tabela Classificada de Migrations

| #   | Arquivo de Migração                                                    | Classificação | Justificativa / Finalidade                                                                                                                |
| --- | ---------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20260320025012_create_serasa_consultations.sql`                       | **APLICAR**   | Estrutura da tabela de consultas Serasa e políticas RLS. _(Ignorar o bloco DO final de usuário teste `test@example.com`)_                 |
| 2   | `20260320031500_seed_anderson_user.sql`                                | **PULAR**     | Cria usuário específico da operação piloto anterior com senha estática.                                                                   |
| 3   | `20260320032204_add_profiles_and_logs.sql`                             | **APLICAR**   | Estrutura base de perfis de usuário (`profiles`) e logs de acesso.                                                                        |
| 4   | `20260320040000_add_avatar_and_webhooks.sql`                           | **APLICAR**   | Bucket `avatars` e colunas de foto de perfil.                                                                                             |
| 5   | `20260320050000_add_user_roles.sql`                                    | **APLICAR**   | Enum `app_role` e controle de permissões.                                                                                                 |
| 6   | `20260320060000_admin_profiles_policies.sql`                           | **APLICAR**   | Políticas de RLS para administradores gerenciarem perfis.                                                                                 |
| 7   | `20260320070000_fix_profiles_rls_recursion.sql`                        | **APLICAR**   | Correção técnica de recursão de políticas RLS em perfis.                                                                                  |
| 8   | `20260320113703_add_kyc_schema.sql`                                    | **APLICAR**   | Schema completo de onboarding KYC e bucket `kyc-documents`.                                                                               |
| 9   | `20260320124500_fix_access_logs_rls.sql`                               | **APLICAR**   | Políticas RLS seguras para logs de acesso.                                                                                                |
| 10  | `20260320153000_add_multirole_and_kyc_fields.sql`                      | **APLICAR**   | Suporte a múltiplos papéis (`is_admin`, `is_staff`, `is_investor`, `is_borrower`).                                                        |
| 11  | `20260320155317_add_pj_procurator.sql`                                 | **APLICAR**   | Campos cadastrais de procurador/representante para Pessoa Jurídica.                                                                       |
| 12  | `20260320180000_create_debentures.sql`                                 | **APLICAR**   | Tabelas de emissão de debêntures e séries.                                                                                                |
| 13  | `20260320193000_create_deeds_bucket.sql`                               | **APLICAR**   | Bucket de armazenamento `deeds` para escrituras de debêntures.                                                                            |
| 14  | `20260321000000_add_import_tables.sql`                                 | **APLICAR**   | Tabelas base de produtos de investimento e borderôs.                                                                                      |
| 15  | `20260321040000_create_debenture_subscriptions.sql`                    | **APLICAR**   | Tabela de subscrições de debêntures e auditoria.                                                                                          |
| 16  | `20260321060000_enrich_investment_products.sql`                        | **APLICAR**   | Campos financeiros estendidos para produtos de investimento.                                                                              |
| 17  | `20260322143000_ensure_storage_bucket.sql`                             | **APLICAR**   | Bucket `operation-docs` para documentos de operações de crédito.                                                                          |
| 18  | `20260322144710_fix_contract_versions_fk.sql`                          | **APLICAR**   | Ajuste de chaves estrangeiras em versões contratuais.                                                                                     |
| 19  | `20260322160000_credit_operations.sql`                                 | **APLICAR**   | Tabelas centrais de operações de crédito, cálculos e parâmetros financeiros.                                                              |
| 20  | `20260322160500_digital_signature.sql`                                 | **APLICAR**   | Tabelas de assinatura digital de minutas contratuais.                                                                                     |
| 21  | `20260322163000_operation_enhancements.sql`                            | **APLICAR**   | Melhorias nos cálculos de ad valorem e deságio de operações.                                                                              |
| 22  | `20260322164500_fix_operations_fk.sql`                                 | **APLICAR**   | Ajuste de integridade referencial nas operações de crédito.                                                                               |
| 23  | `20260322180000_create_risk_analysis.sql`                              | **APLICAR**   | Tabelas de score e comitê de risco de crédito.                                                                                            |
| 24  | `20260322190000_add_credit_limits.sql`                                 | **APLICAR**   | Campo `credit_limit` na tabela `profiles`.                                                                                                |
| 25  | `20260323015424_storage_cors_and_mime.sql`                             | **APLICAR**   | Configuração de tipos MIME permitidos e CORS no Storage.                                                                                  |
| 26  | `20260323120000_investment_products_full.sql`                          | **APLICAR**   | Estrutura de cotas, valor unitário e limites por investidor.                                                                              |
| 27  | `20260323192500_add_bank_code.sql`                                     | **APLICAR**   | Coluna `bank_code` para compensação bancária (COMPE).                                                                                     |
| 28  | `20260323194000_fix_investments_profiles_fk.sql`                       | **APLICAR**   | Vínculo estrutural entre investimentos e perfis.                                                                                          |
| 29  | `20260323200000_user_bank_accounts.sql`                                | **APLICAR**   | Tabela de contas bancárias dos clientes (investidores e tomadores).                                                                       |
| 30  | `20260324035014_ccb_digital.sql`                                       | **APLICAR**   | Tabela `ccb_solicitacoes`, bucket `ccb-docs` e fluxo de CCB.                                                                              |
| 31  | `20260324041000_fix_ccb_profiles_fk.sql`                               | **APLICAR**   | Ajuste de chaves estrangeiras em CCBs.                                                                                                    |
| 32  | `20260324100000_investment_flow.sql`                                   | **APLICAR**   | Tabela `company_bank_accounts` e bucket `investment-proofs`.                                                                              |
| 33  | `20260325120000_investment_redemptions.sql`                            | **APLICAR**   | Tabela de solicitações de resgates de cotas.                                                                                              |
| 34  | `20260325160000_admin_kyc_storage_policy.sql`                          | **APLICAR**   | Políticas de acesso administrativo aos anexos cadastrais.                                                                                 |
| 35  | `20260325172300_add_user_management_fields.sql`                        | **APLICAR**   | Campos administrativos de bloqueio e reset de senha.                                                                                      |
| 36  | `20260325184500_fix_investment_redemptions_fk.sql`                     | **APLICAR**   | Vínculo referencial nas solicitações de resgate.                                                                                          |
| 37  | `20260325195000_atomic_redemptions.sql`                                | **APLICAR**   | Procedure atômica para liquidação e pagamento de resgates.                                                                                |
| 38  | `20260325203000_cleanup_investments_queue.sql`                         | **PULAR**     | Delete de limpeza da fila de testes da operação antiga.                                                                                   |
| 39  | `20260331120000_add_signup_fields.sql`                                 | **APLICAR**   | Campos complementares de cadastro e termos legais.                                                                                        |
| 40  | `20260401120000_docusign_integration.sql`                              | **APLICAR**   | Colunas de integração para envelopes DocuSign.                                                                                            |
| 41  | `20260401170000_add_liquidation_fields.sql`                            | **APLICAR**   | Colunas `liquidation_date` e `liquidation_value` em operações.                                                                            |
| 42  | `20260401205000_ccb_dynamic_fields.sql`                                | **APLICAR**   | Campos para parametrização dinâmica de CCBs.                                                                                              |
| 43  | `20260401220000_ccb_updates.sql`                                       | **APLICAR**   | Atualização estrutural das rotinas de cálculo de CCB.                                                                                     |
| 44  | `20260402100000_ccb_simulation_and_operations.sql`                     | **APLICAR**   | Tabelas de simulação financeira de crédito.                                                                                               |
| 45  | `20260403000000_ccb_detailed_entities.sql`                             | **APLICAR**   | Entidades de garantias reais, avalistas e fiadores.                                                                                       |
| 46  | `20260403162037_investments_sync.sql`                                  | **APLICAR**   | RPCs `approve_investment` e `cancel_investment`.                                                                                          |
| 47  | `20260403170000_revert_realtime_soft_delete.sql`                       | **APLICAR**   | Ajuste técnico de publicação do Supabase Realtime.                                                                                        |
| 48  | `20260403190838_add_ccb_iof_daily.sql`                                 | **APLICAR**   | Campos de IOF adicional e diário nas operações de crédito.                                                                                |
| 49  | `20260403212100_accounting_and_expenses.sql`                           | **APLICAR**   | Tabela `expenses` e plano de contas base.                                                                                                 |
| 50  | `20260403222136_create_recebiveis_ccb.sql`                             | **APLICAR**   | Tabela `recebiveis_ccb` e array de boletos/parcelas.                                                                                      |
| 51  | `20260423204900_add_sacado_details_to_operations.sql`                  | **APLICAR**   | Campos para qualificação de sacados/devedores em antecipações.                                                                            |
| 52  | `20260423211800_enable_realtime_recebiveis.sql`                        | **APLICAR**   | Habilitação de Realtime para monitoramento de recebíveis.                                                                                 |
| 53  | `20260424002718_create_storage_buckets.sql`                            | **APLICAR**   | Garantia da existência de todos os buckets de armazenamento.                                                                              |
| 54  | `20260424040000_treasury_transactions.sql`                             | **APLICAR**   | Tabela central `treasury_transactions` da tesouraria.                                                                                     |
| 55  | `20260424051615_add_expense_trigger.sql`                               | **APLICAR**   | Trigger de sincronização de despesas com o livro de tesouraria.                                                                           |
| 56  | `20260424060000_fix_treasury_duplicates.sql`                           | **APLICAR**   | Constraint UNIQUE de despesas na tesouraria e upsert.                                                                                     |
| 57  | `20260425175136_cleanup_borrower_test_data.sql`                        | **PULAR**     | Deleção de dados de testes de operações e tomadores anteriores.                                                                           |
| 58  | `20260425183100_transaction_categories.sql`                            | **APLICAR**   | Tabela `transaction_categories` e categorias padrão.                                                                                      |
| 59  | `20260425203402_add_irrf_to_redemptions.sql`                           | **APLICAR**   | Campos para apuração e retenção de IRRF em resgates.                                                                                      |
| 60  | `20260425205901_add_reinvestment_columns.sql`                          | **APLICAR**   | Estrutura de reinvestimento de resgates em novos produtos.                                                                                |
| 61  | `20260425211553_fix_treasury_redemptions.sql`                          | **APLICAR**   | Lançamentos contábeis automáticos de resgate na tesouraria.                                                                               |
| 62  | `20260425213921_update_redemption_logic.sql`                           | **APLICAR**   | Validações de limites e saldo remanescente do investimento.                                                                               |
| 63  | `20260425215702_update_process_redemption_payment.sql`                 | **APLICAR**   | Procedure atualizada de processamento de resgates.                                                                                        |
| 64  | `20260425222808_fix_redemption_subscriptions.sql`                      | **APLICAR**   | Baixa automática nas debêntures subscritas ao pagar resgate.                                                                              |
| 65  | `20260425230050_add_contract_to_investments.sql`                       | **APLICAR**   | Colunas de contrato e minuta vinculados aos investimentos.                                                                                |
| 66  | `20260426011712_sync_subscription_dates.sql`                           | **APLICAR**   | Trigger de sincronização de datas de transferência.                                                                                       |
| 67  | `20260426030000_add_deleted_at_to_ccb.sql`                             | **APLICAR**   | Coluna `deleted_at` para exclusão lógica de CCBs.                                                                                         |
| 68  | `20260426032510_add_tomador_id_to_recebiveis.sql`                      | **APLICAR**   | Coluna `tomador_id` na tabela `recebiveis_ccb`.                                                                                           |
| 69  | `20260426033620_ccb_treasury_integration.sql`                          | **APLICAR**   | Trigger que espelha recebimentos de CCB na tesouraria.                                                                                    |
| 70  | `20260426035000_ccb_installments_liquidation.sql`                      | **APLICAR**   | Procedure de liquidação de parcelas de CCB.                                                                                               |
| 71  | `20260426035000_fix_treasury_triggers.sql`                             | **APLICAR**   | Tratamento de conflitos de concorrência em triggers da tesouraria.                                                                        |
| 72  | `20260426044405_sync_investment_dates.sql`                             | **APLICAR**   | Trigger em cascata para sincronização de datas contábeis.                                                                                 |
| 73  | `20260427040654_fix_dates_timezone.sql`                                | **APLICAR**   | Padronização de datas para evitar deslocamento de fuso horário UTC-3.                                                                     |
| 74  | `20260427042304_rename_requires_password_change.sql`                   | **APLICAR**   | Padronização de nomenclatura da coluna de troca de senha.                                                                                 |
| 75  | `20260427161500_fix_date_discrepancies.sql`                            | **PULAR**     | Ajuste corretivo exclusivo para dados passados da operação anterior.                                                                      |
| 76  | `20260503163500_accounting_sync_cleanup.sql`                           | **PULAR**     | Limpeza de dados duplicados pontuais da base de transição anterior.                                                                       |
| 77  | `20260503164500_migration_tesouraria.sql`                              | **APLICAR**   | Função `processa_movimentacao_caixa` para o Livro Caixa contábil.                                                                         |
| 78  | `20260503164614_fix_migrar_dados_historicos.sql`                       | **APLICAR**   | Ajustes das rotinas de cálculo do caixa e saldos.                                                                                         |
| 79  | `20260503165000_update_migration_function.sql`                         | **APLICAR**   | Atualizações de funções de sincronização financeira.                                                                                      |
| 80  | `20260503170000_create_livro_caixa.sql`                                | **APLICAR**   | Estruturas base de apoio ao Livro Caixa e DRE.                                                                                            |
| 81  | `20260503170008_fix_rls_movimentacoes_caixa.sql`                       | **APLICAR**   | Políticas de RLS para o Livro Caixa com papel administrador.                                                                              |
| 82  | `20260503170009_update_migrar_dados_historicos.sql`                    | **APLICAR**   | Rotina de recálculo de saldo da conta caixa.                                                                                              |
| 83  | `20260503171000_fix_admin_rls_and_profile.sql`                         | **APLICAR**   | Funções de segurança `is_admin()` essenciais para toda a plataforma.                                                                      |
| 84  | `20260503171300_fix_accounting_rls_v2.sql`                             | **APLICAR**   | Reforço de segurança para consultas de contabilidade gerencial.                                                                           |
| 85  | `20260503173000_fix_accounting_rls_and_admin.sql`                      | **APLICAR**   | Garantia de permissão ampla para o gestor contábil.                                                                                       |
| 86  | `20260503174500_fix_rls_for_accounting_admin.sql`                      | **APLICAR**   | Políticas definitivas para visualização do Livro Caixa pelo admin.                                                                        |
| 87  | `20260503184535_add_limpeza_rpc.sql`                                   | **PULAR**     | RPC para deletar tabelas de rascunho já inexistentes em banco novo.                                                                       |
| 88  | `20260503185353_cleanup_problematic_tables.sql`                        | **PULAR**     | DROP TABLE em cascata de tabelas transitórias antigas.                                                                                    |
| 89  | `20260503203000_fix_ccb_null_payment_dates.sql`                        | **PULAR**     | Atualização de boletos dos clientes específicos Osvaldir e Carlos.                                                                        |
| 90  | `20260503203947_fix_ccb_payment_dates.sql`                             | **PULAR**     | Atualização de boletos dos clientes Rafael, Osvaldir e Carlos.                                                                            |
| 91  | `20260503204500_fix_ccb_dates_osvaldir_carlos.sql`                     | **PULAR**     | Ajuste manual repetido de clientes da operação anterior.                                                                                  |
| 92  | `20260503220000_fix_rafael_kieslark_installments.sql`                  | **PULAR**     | Correção de parcelas com nomes de clientes da operação piloto.                                                                            |
| 93  | `20260506031145_create_investments_view.sql`                           | **APLICAR**   | View unificada `investments_view` para painéis de investimentos.                                                                          |
| 94  | `20260506041234_fix_investments_rls_and_view.sql`                      | **APLICAR**   | Permissões de leitura e segurança na view de investimentos.                                                                               |
| 95  | `20260526030512_ensure_investments_rls.sql`                            | **APLICAR**   | Isolamento de dados entre investidores na tabela de investimentos.                                                                        |
| 96  | `20260526040000_fix_investments_rls_and_seed.sql`                      | **PULAR**     | Seed de usuário e senha da operação anterior.                                                                                             |
| 97  | `20260527004046_clear_investment_data.sql`                             | **PULAR**     | Delete de investimentos de teste da base piloto.                                                                                          |
| 98  | `20260527004656_restore_investment_products.sql`                       | **PULAR**     | Cadastro de produtos fictícios Sea Connection e senha estática.                                                                           |
| 99  | `20260527011703_update_admin_seed.sql`                                 | **PULAR**     | Atualização de credenciais de usuário da operação antiga.                                                                                 |
| 100 | `20260527014500_alter_indexer_nullable.sql`                            | **APLICAR**   | Torna o campo `indexer` anulável para suportar produtos pré-fixados.                                                                      |
| 101 | `20260527024558_seed_admin_user.sql`                                   | **PULAR**     | Seed do usuário Anderson Leandro com senha hardcoded.                                                                                     |
| 102 | `20260527134731_product_lookup_tables.sql`                             | **APLICAR**   | Tabelas auxiliares de status, risco e moedas.                                                                                             |
| 103 | `20260527150000_create_product_reference_tables.sql`                   | **APLICAR**   | Tabelas `product_statuses`, `product_risk_ratings`, `product_currencies`.                                                                 |
| 104 | `20260527160000_seed_product_dictionaries.sql`                         | **APLICAR**   | Dicionários de domínio ('Em Captação', 'Esgotado', 'Baixo', 'BRL', etc.). _(Remover apenas o bloco IF final da debênture Sea Connection)_ |
| 105 | `20260527212727_update_investment_products_rls.sql`                    | **APLICAR**   | Políticas de visualização pública/autenticada dos produtos.                                                                               |
| 106 | `20260729172000_manual_yield_entries.sql`                              | **APLICAR**   | Tabela `manual_yield_entries` para controle de rentabilidade manual.                                                                      |
| 107 | `20260814214000_kyc_docs_delete_policy.sql`                            | **APLICAR**   | Permissão de remoção/substituição de documentos KYC no Storage.                                                                           |
| 108 | `20260814234631_create_movimentacoes_caixa.sql`                        | **APLICAR**   | Tabela definitiva `movimentacoes_caixa` com RLS e índices.                                                                                |
| 109 | `20260814235200_create_mapeamento_movimentacoes.sql`                   | **APLICAR**   | Tabela de rastreabilidade contábil `mapeamento_movimentacoes`.                                                                            |
| 110 | `20260815030241_add_type_to_expenses.sql`                              | **APLICAR**   | Campo `type` em despesas (operacional, administrativa, captação).                                                                         |
| 111 | `20260916150000_add_interest_type_to_investment_products.sql`          | **APLICAR**   | Suporte nativo aos regimes de juros: `cumulative` e `monthly`.                                                                            |
| 112 | `20260916160000_sync_investments_and_subscriptions.sql`                | **APLICAR**   | Trigger de sincronização atômica entre investimentos e debêntures.                                                                        |
| 113 | `20260916170000_reject_and_delete_investments.sql`                     | **APLICAR**   | RPC para rejeição e cancelamento de aportes com estorno de cotas.                                                                         |
| 114 | `20260916180000_add_installments_data_to_credit_operations.sql`        | **APLICAR**   | Campo `installments_data` JSONB em `credit_operations`.                                                                                   |
| 115 | `20260917225000_revert_ccb_installment.sql`                            | **APLICAR**   | Procedure de reversão de parcelas pagas em CCB.                                                                                           |
| 116 | `20260918233000_fix_revert_ccb_installment_liquidation.sql`            | **APLICAR**   | Correção nas chamadas de estorno de liquidação de CCB.                                                                                    |
| 117 | `20260918234500_fix_overload_revert_ccb_installment_liquidation.sql`   | **APLICAR**   | Sobrecarga de tipos e parâmetros da procedure de reversão.                                                                                |
| 118 | `20260919010000_create_notifications.sql`                              | **APLICAR**   | Tabela `notifications` e central de notificações in-app.                                                                                  |
| 119 | `20260920040000_credit_operations_installments.sql`                    | **APLICAR**   | RPCs de liquidação e prorrogação de parcelas de antecipação.                                                                              |
| 120 | `20260920050000_update_extend_credit_operation_installment.sql`        | **APLICAR**   | Cálculo de juros e multas por prorrogação de recebível.                                                                                   |
| 121 | `20260920060000_single_installment_receivables.sql`                    | **APLICAR**   | Suporte financeiro para recebíveis de parcela única.                                                                                      |
| 122 | `20260920070000_resilient_single_installment_operations.sql`           | **APLICAR**   | Resiliência contra cronogramas vazios em operações simples.                                                                               |
| 123 | `20260920080000_liquidate_credit_operation_full.sql`                   | **APLICAR**   | Procedure de quitação integral da operação de crédito.                                                                                    |
| 124 | `20260920235600_sync_redemptions_treasury_caixa.sql`                   | **APLICAR**   | Integração em tempo real de resgates com a tesouraria e Livro Caixa.                                                                      |
| 125 | `20260921010000_sync_single_installment_liquidation.sql`               | **APLICAR**   | Conciliação contábil da liquidação de recebíveis pontuais.                                                                                |
| 126 | `20260921020000_installment_operations_auto_liquidation.sql`           | **APLICAR**   | Auto-liquidação da operação quando a última parcela é quitada.                                                                            |
| 127 | `20260921030000_fix_extended_installments_and_liquidation_status.sql`  | **APLICAR**   | Regra estrita: parcelas prorrogadas nunca são consideradas pagas.                                                                         |
| 128 | `20260921040000_fix_receivables_installments_liquidation.sql`          | **APLICAR**   | RPCs robustos de prorrogação e baixa de parcelas.                                                                                         |
| 129 | `20260921050000_fix_ccb_osvaldir_dre_may_2026.sql`                     | **PULAR**     | Correção de transações com ID do cliente Osvaldir no DRE.                                                                                 |
| 130 | `20260921060000_restore_borrower_credit_limit_on_liquidation.sql`      | **APLICAR**   | Restaura o limite do tomador exclusivamente no status 'liquidado'.                                                                        |
| 131 | `20260921070000_unify_liquidation_and_paid_status_credit_limit.sql`    | **APLICAR**   | Padronização de consumo de limite entre os status da operação.                                                                            |
| 132 | `20260921223000_fix_borrower_credit_limit_and_restore_paid_status.sql` | **APLICAR**   | **Regra Pétrea:** status 'pago' consome limite; só 'liquidado' libera limite.                                                             |
| 133 | `20260922030500_admin_insert_ccb.sql`                                  | **APLICAR**   | Permissão de cadastro direto de CCBs pelo administrador.                                                                                  |
| 134 | `20260922120000_sync_ccb_installments_boletos.sql`                     | **APLICAR**   | Sincronização automática entre cronograma e boletos emitidos.                                                                             |
| 135 | `20260922130000_delete_cancelled_credit_operation.sql`                 | **APLICAR**   | RPC de cancelamento seguro de operação de crédito.                                                                                        |
| 136 | `20260922183000_add_bank_account_id_to_transactions.sql`               | **APLICAR**   | Campo `bank_account_id` para conciliação por conta bancária.                                                                              |
| 137 | `20260923000000_repair_redemption_and_decrement_total_value.sql`       | **APLICAR**   | Decremento atômico de cotas e valor financeiro no resgate.                                                                                |
| 138 | `20260923010000_notifications_admin_insert.sql`                        | **APLICAR**   | Permissão para administradores enviarem notificações in-app.                                                                              |
| 139 | `20260923020000_send_notification_admin_rpc.sql`                       | **APLICAR**   | RPC `send_system_notification` para avisos do sistema.                                                                                    |
| 140 | `20260923030000_fix_investor_wallet_and_redemption_payout.sql`         | **APLICAR**   | Gestão de saldo em carteira e pagamento em conta externa.                                                                                 |
| 141 | `20260923040000_add_deleted_at_to_treasury_and_delete_rpc.sql`         | **APLICAR**   | Exclusão lógica e rastreável de lançamentos avulsos da tesouraria.                                                                        |
| 142 | `20260924100000_bank_accounts_transfer_and_pair.sql`                   | **APLICAR**   | Tabela `bank_transfers` e fluxo de transferências entre contas da empresa.                                                                |
| 143 | `20260924120000_fix_get_bank_account_balance_deduplications.sql`       | **APLICAR**   | RPC `get_bank_account_balance` para saldo real por conta bancária.                                                                        |
| 144 | `20260924210000_create_credit_managers.sql`                            | **APLICAR**   | Tabelas de Gestores de Crédito (`credit_managers`) e comissões.                                                                           |
| 145 | `20260925180000_add_commission_rate_applied_to_operations.sql`         | **APLICAR**   | Registro de comissão aplicada na esteira de concessão de crédito.                                                                         |
| 146 | `20260925193000_create_company_settings.sql`                           | **APLICAR**   | Tabela `company_settings` (dados da securitizadora para preâmbulos).                                                                      |
| 147 | `20260925220000_add_debenture_escritura_and_series.sql`                | **APLICAR**   | Estrutura avançada de vinculação de escrituras e séries.                                                                                  |
| 148 | `20260928140000_add_escritura_registro_fields.sql`                     | **APLICAR**   | Campos de registro em Cartório de Títulos e Documentos (RTD).                                                                             |
| 149 | `20260928143000_debenture_contract_cache_invalidation.sql`             | **APLICAR**   | Invalidação automática de cache de termos contratuais.                                                                                    |
| 150 | `20260928150000_add_cautela_to_investments.sql`                        | **APLICAR**   | Colunas `cautela_url` e data de emissão em investimentos.                                                                                 |
| 151 | `20260928200000_admin_internal_investments.sql`                        | **APLICAR**   | Fluxo de lançamento interno de aportes pela tesouraria.                                                                                   |
| 152 | `20260929030000_investor_authorization_post_launch.sql`                | **APLICAR**   | Tabela de autorizações/aceites eletrônicos de investimentos.                                                                              |
| 153 | `20260929200000_extend_ccb_installment.sql`                            | **APLICAR**   | Procedure de prorrogação e renegociação de parcelas de CCB.                                                                               |
| 154 | `20260930120000_create_notificacoes_cessao.sql`                        | **APLICAR**   | Tabela `notificacoes_cessao`, hash seguro e aceite pelo sacado.                                                                           |
| 155 | `20261002050000_create_projected_cashflow_manual_entries.sql`          | **APLICAR**   | Tabela `projected_cashflow_manual_entries` para projeções financeiras.                                                                    |
| 156 | `20261002161500_add_recurring_expenses.sql`                            | **APLICAR**   | Suporte a despesas recorrentes (mensais, anuais) e parcelamento.                                                                          |
| 157 | `20261005190000_monthly_interest_redemption.sql`                       | **APLICAR**   | Procedure de resgate exclusivo de rendimentos mensais sem baixar principal.                                                               |
| 158 | `20261006220000_sync_investment_manual_value.sql`                      | **APLICAR**   | Sincronização e ajuste manual de valor e rendimento em aportes.                                                                           |
| 159 | `20261007100000_sync_redemption_manual_value.sql`                      | **APLICAR**   | Ajuste manual de valor líquido e IRRF em solicitações de resgates.                                                                        |
| 160 | `20261007140000_sanitize_future_recurring_expenses.sql`                | **APLICAR**   | Trigger e saneamento que impede que despesas futuras nasçam como pagas.                                                                   |
| 161 | `20261007180000_automatic_pix_fee.sql`                                 | **APLICAR**   | Tarifas PIX PF/PJ por conta e débito automático na tesouraria.                                                                            |
| 162 | `20261007190000_fix_pj_profiles_full_name.sql`                         | **APLICAR**   | Trigger de garantia de nome/razão social em cadastros PJ.                                                                                 |

---

## 3. Inventário de Funções de Backend (Edge Functions)

Todas as **26 Edge Functions** de `supabase/functions/` devem ser publicadas no novo Supabase.  
Abaixo está o descritivo de cada uma em linguagem de produto:

1. **`acknowledge-cessao-notification`**  
   _Finalidade:_ Registra formalmente a ciência do sacado/devedor ao receber a notificação de cessão de crédito através de link público, capturando IP, data, hora e geolocalização para validade jurídica.

2. **`admin-create-user`**  
   _Finalidade:_ Permite ao Administrador cadastrar novos usuários (investidores, tomadores, analistas de backoffice) diretamente pelo painel administrativo, gerando credenciais seguras via Supabase Auth Admin.

3. **`admin-update-user`**  
   _Finalidade:_ Permite alterar dados sensíveis de usuários (e-mail, telefone, bloqueio de acesso, permissões) sem exigir que o próprio usuário faça login.

4. **`batch-import-users`**  
   _Finalidade:_ Importação em lote de clientes (planilhas CSV/JSON) para cadastrar investidores ou tomadores legados de uma só vez com validação de duplicidade de CPF/CNPJ.

5. **`calculate-operation`**  
   _Finalidade:_ Motor de cálculo financeiro de antecipação de recebíveis e CCBs. Aplica taxas de juros, taxa de deságio, ad valorem, taxa de estruturação/análise e calcula IOF (diário e adicional).

6. **`calculate-risk`**  
   _Finalidade:_ Avalia a matriz de risco do tomador e do sacado com base em garantias, histórico de liquidações, apontamentos e concentração de carteira, atribuindo rating (A, B, C, D ou Crítico).

7. **`delete-user`**  
   _Finalidade:_ Exclusão segura de usuário no Supabase Auth e desativação coerente de seus vínculos cadastrais pela equipe de compliance.

8. **`docusign-callback`**  
   _Finalidade:_ Webhook que recebe o evento do DocuSign quando todas as partes concluem a assinatura de um contrato, atualizando o status da operação para "Assinado" e baixando o PDF certificado.

9. **`docusign-envelope`**  
   _Finalidade:_ Cria e envia envelopes no DocuSign contendo a minuta do contrato de cessão, debênture ou CCB para coleta de assinatura eletrônica dos representantes e devedores.

10. **`extract-debenture-data`**  
    _Finalidade:_ Leitura estruturada e OCR de escrituras de emissão de debêntures em PDF, extraindo automaticamente número de série, quantidade de títulos, remuneração e datas de vencimento.

11. **`generate-aditivo`**  
    _Finalidade:_ Gera em PDF o Termo Aditivo de Cessão e Aquisição de Direitos Creditórios com a relação dos títulos adquiridos, dados do cedente, sacados, prazos e condições financeiras.

12. **`generate-cessao-notification`**  
    _Finalidade:_ Emite em PDF a Notificação Formal de Cessão de Crédito exigida por lei (Art. 290 do Código Civil) para comunicação ao devedor/sacado de que o título pertence à securitizadora.

13. **`generate-debenture-cautela`**  
    _Finalidade:_ Emite o Certificado Provisório ou Cautela de Debêntures Nominativas em nome do investidor com numeração das debêntures subscritas, dados da escritura e carimbo institucional.

14. **`generate-kyc-pdf`**  
    _Finalidade:_ Gera a Ficha Cadastral e Dossiê de Compliance KYC consolidado (dados do titular, representantes PJ, faturamento, certidões) para auditoria e arquivo legal.

15. **`generate-redemption-receipt`**  
    _Finalidade:_ Emite o Comprovante de Liquidação Financeira de Resgate para entrega ao investidor, discriminando valor bruto resgatado, imposto de renda retido na fonte (IRRF) e valor líquido creditado.

16. **`generate-subscription-term`**  
    _Finalidade:_ Gera o Boletim/Termo de Subscrição e Integralização de Debêntures formalizando o aporte financeiro do investidor na série escolhida.

17. **`invite-user`**  
    _Finalidade:_ Envia e-mail transacional de convite a novos clientes com link de primeiro acesso seguro para conclusão do cadastro e definição de senha.

18. **`notify-ccb-adjustment`**  
    _Finalidade:_ Notifica o tomador e a tesouraria por e-mail sobre alterações contratuais, prorrogação de parcelas ou amortizações extraordinárias em sua CCB.

19. **`public-signup`**  
    _Finalidade:_ Endpoint do formulário público de auto-cadastro na página inicial, criando o usuário com validação de e-mail e atribuindo o perfil inicial correspondente.

20. **`send-login-notification`**  
    _Finalidade:_ Envio de alerta de segurança por e-mail a cada login realizado com sucesso, contendo data, hora e IP de acesso para prevenção de fraudes.

21. **`send-operation-email`**  
    _Finalidade:_ Notificação por e-mail ao cliente quando sua solicitação de antecipação ou CCB é aprovada, liquidada ou necessita de novos documentos.

22. **`send-to-signature`**  
    _Finalidade:_ Despacha minutas contratuais para o provedor de assinatura digital configurado para coleta das assinaturas das partes.

23. **`serasa-integration`**  
    _Finalidade:_ Conecta à API do Serasa Experian para obter score de crédito, ocorrências de protestos, cheques sem fundos, falências e pendências financeiras do CNPJ ou CPF consultado.

24. **`serve-pdf`**  
    _Finalidade:_ Entrega com segurança e assinatura temporária os PDFs gerados na nuvem para download ou visualização em tela pelos usuários autenticados.

25. **`signature-webhook`**  
    _Finalidade:_ Webhook receptivo para provedores alternativos de assinatura eletrônica homologados no sistema.

26. **`submit-ccb`**  
    _Finalidade:_ Recebe a proposta comercial preenchida pelo tomador no formulário de CCB Digital, valida a consistência das garantias e envia para análise do comitê de crédito.

---

## 4. Credenciais e Segredos do Ambiente (Secrets)

Para que a nova operação funcione sem erros, ela precisa possuir suas **próprias contas corporativas** nos serviços externos integrados.  
Nenhuma chave ou credencial da operação anterior deve ser reaproveitada.

| Nome do Segredo (Secret)    | Serviço / Provedor | O que é e onde obter na nova operação                                                                                                                                                                                                                                         |
| --------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase Novo      | Gerado automaticamente pelo Supabase nas configurações do projeto novo (`Settings -> API`).                                                                                                                                                                                   |
| `SUPABASE_ANON_KEY`         | Supabase Novo      | Chave pública `anon/public` do Supabase novo (`Settings -> API`).                                                                                                                                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Novo      | Chave privada com poderes de superadministrador do Supabase novo (`Settings -> API -> service_role`). **Nunca expor no frontend.**                                                                                                                                            |
| `SUPABASE_DB_URL`           | Supabase Novo      | String de conexão direta do PostgreSQL do projeto novo (`Settings -> Database -> Connection string`).                                                                                                                                                                         |
| `RESEND_API_KEY`            | Resend             | Chave de API da conta corporativa da nova empresa no Resend ([resend.com](https://resend.com)). Necessário cadastrar o domínio de e-mail corporativo da empresa (ex: `@novaempresa.com.br`) e validar os registros DNS (SPF e DKIM) para envio dos e-mails transacionais.     |
| `SERASA_API_KEY`            | Serasa Experian    | Chave de autenticação da conta da nova empresa junto ao Serasa Experian / Datacred para consultas de score e birôs de crédito. _(Caso a empresa ainda não possua contrato ativo, o sistema opera com o simulador determinístico interno homologado sem travar a plataforma)_. |
| `DOCUSIGN_INTEGRATION_KEY`  | DocuSign           | Client ID / Integration Key criado no portal de desenvolvedores do DocuSign da nova securitizadora ([docusign.com](https://www.docusign.com)).                                                                                                                                |
| `DOCUSIGN_ACCOUNT_ID`       | DocuSign           | ID numérico da conta corporativa DocuSign da nova empresa (visível no painel da conta).                                                                                                                                                                                       |
| `DOCUSIGN_USER_ID`          | DocuSign           | GUID do usuário/administrador designado da conta DocuSign da nova empresa.                                                                                                                                                                                                    |
| `DOCUSIGN_PRIVATE_KEY`      | DocuSign           | Chave privada RSA gerada na conta DocuSign da empresa para autenticação via JWT (formato PEM iniciando em `-----BEGIN RSA PRIVATE KEY-----`).                                                                                                                                 |

---

## 5. Passo a Passo de Implantação (Checklist para Não-Programadores)

Siga as fases numeradas. Cada fase possui caixas de seleção `[ ]` para acompanhamento do progresso:

### Fase 1: Criação do Projeto na Skip

- [ ] Criar um projeto novo na plataforma **Skip** com o nome da nova securitizadora (ex: _Nova Securitizadora 360°_).
- [ ] Como primeira mensagem para o agente no chat do projeto novo, digite exatamente:
  > _"Olá, estou implantando esta plataforma para uma nova operação de securitização. Segue em anexo/abaixo o arquivo `docs/GUIA-IMPLANTACAO-NOVA-OPERACAO.md` com todo o inventário de migrations, regras de negócio e funções de backend. Por favor, leia este guia e use-o como especificação mestra da implantação."_
- [ ] Cole o texto deste guia na conversa para que o agente do novo projeto configure o frontend e as rotas com máxima fidelidade.

### Fase 2: Criação do Projeto Supabase Novo

- [ ] Acessar [supabase.com](https://supabase.com) e criar uma organização em nome da nova empresa (ou selecionar uma existente).
- [ ] Criar um novo projeto no Supabase (escolha a região mais próxima dos usuários, preferencialmente `South America (São Paulo)`).
- [ ] Definir uma senha forte para o banco de dados e salvá-la em local seguro.
- [ ] Copiar e anotar em um bloco de notas:
  - `Project URL` (ex: `https://xyz...supabase.co`)
  - `anon public key`
  - `service_role secret key`
  - `Connection string (URI)` de conexão ao Postgres.

### Fase 3: Aplicação das Migrations no Supabase Novo

- [ ] No projeto novo da Skip, certifique-se de que o backend Supabase foi conectado com as credenciais anotadas na Fase 2.
- [ ] O agente de IA do novo projeto pode aplicar as migrações automaticamente ou você pode colá-las no **SQL Editor** do painel do Supabase.
- [ ] Aplicar estritamente as **75 migrations marcadas como APLICAR** na ordem cronológica (ver Seção 2).
- [ ] **Atenção:** Pular e não aplicar as 17 migrações marcadas como **PULAR** para evitar dados de terceiros e inconsistências.
- [ ] Verificar se os 5 buckets foram criados em `Storage`:
  - `avatars`
  - `kyc-documents`
  - `deeds`
  - `operation-docs`
  - `investment-proofs`
  - `ccb-docs`

### Fase 4: Configuração dos Segredos e Deploy das Edge Functions

- [ ] No painel do novo projeto Supabase, acesse `Settings -> Edge Functions -> Secrets` (ou configure via ferramenta de secrets na Skip).
- [ ] Adicionar os segredos descritos na Seção 4:
  - `RESEND_API_KEY`
  - `SERASA_API_KEY`
  - `DOCUSIGN_INTEGRATION_KEY`
  - `DOCUSIGN_ACCOUNT_ID`
  - `DOCUSIGN_USER_ID`
  - `DOCUSIGN_PRIVATE_KEY`
- [ ] Publicar as **26 Edge Functions** de `supabase/functions/` no novo projeto Supabase (o agente da Skip executa isso via comando de deploy ou você pode usar o Supabase CLI).

### Fase 5: Criação do Usuário Administrador e Configuração Inicial pela Interface Web

- [ ] Criar o primeiro usuário no Supabase Auth com o e-mail corporativo do administrador da nova empresa (ex: `admin@novaempresa.com.br`).
- [ ] No SQL Editor do Supabase novo, executar o comando abaixo para promover este usuário a Superadministrador:
  ```sql
  UPDATE public.profiles
  SET role = 'admin', is_admin = true, is_staff = true
  WHERE email = 'admin@novaempresa.com.br';
  ```
- [ ] Fazer login na interface web da plataforma e acessar o menu de configurações para cadastrar os dados da nova empresa:
  - **1. Dados da Securitizadora (`/admin/company`):**
    - [ ] Preencher Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Inscrição Municipal e Endereço Completo da sede.
    - [ ] Cadastrar Nome, Cargo e CPF do Diretor/Representante legal que assinará os contratos.
    - [ ] Informar o Capital Social e Enquadramento Regulatório (ex: _Resolução CVM nº 60/2021_).
  - **2. Contas Bancárias da Securitizadora (`/admin/bank-accounts`):**
    - [ ] Cadastrar as contas bancárias institucionais que a securitizadora usará para receber aportes e pagar resgates/operações.
    - [ ] Informar Banco, Agência, Conta Corrente, Chave PIX e Nome do Titular.
    - [ ] **Configurar as Tarifas PIX:** definir o custo da **Tarifa PIX PF** (ex: R$ 0,00 ou taxa contratada) e da **Tarifa PIX PJ** (ex: R$ 1,50) para que o Livro Caixa compute automaticamente a despesa bancária a cada transferência.
  - **3. Parâmetros Financeiros Globais (`/admin/parameters`):**
    - [ ] Configurar as taxas padrão: Juros Mensais, Taxa de Deságio, Ad Valorem, Tarifa de Análise e Estruturação.
    - [ ] Configurar regras específicas para cada um dos tipos canônicos de recebíveis (Cheque, Promissória, Mútuo, Confissão de Dívida, Contratual, Outros).
  - **4. Escrituras e Catálogo de Produtos de Investimento (`/admin/debentures` e `/admin/products`):**
    - [ ] Cadastrar a primeira Escritura de Emissão de Debêntures e suas respectivas Séries (ex: _1ª Emissão - Série Única_).
    - [ ] Criar os produtos de investimento que serão ofertados aos investidores, definindo a rentabilidade (% do CDI, IPCA + taxa ou taxa fixa ao ano), valor da cota mínima, prazo de carência e regime de rentabilidade (**Juros Acumulados** ou **Juros Mensais**).
  - **5. Gestores de Crédito (`/admin/managers`):**
    - [ ] Se a nova operação trabalhar com correspondentes, parceiros ou assessores de crédito comissionados, cadastrá-los informando o percentual de comissão sobre o volume originado.

### Fase 6: Conexão de Domínio e Checklist de Testes de Aceitação

- [ ] No painel da Skip, conectar o repositório GitHub da nova empresa para versionamento independente.
- [ ] Configurar o domínio customizado (ex: `app.novasecuritizadora.com.br`) apontando os registros CNAME/DNS conforme orientações do painel.
- [ ] **Executar o Checklist de Testes de Aceitação Ponta a Ponta:**
  - [ ] **Teste 1 (KYC Investidor):** Cadastrar um investidor via auto-cadastro, preencher dados, anexar documento e aprovar o cadastro pelo painel admin.
  - [ ] **Teste 2 (Aporte Financeiro):** Como investidor, simular uma solicitação de investimento no produto criado, anexar comprovante fictício e aprovar o aporte no admin com conciliação na conta bancária configurada.
  - [ ] **Teste 3 (Operação de Crédito / Antecipação):** Cadastrar um tomador PJ com limite de crédito de R$ 100.000,00. Lançar uma operação de recebível com tipo "Recebível Contratual" de R$ 10.000,00. Verificar o desconto do limite do tomador para R$ 90.000,00.
  - [ ] **Teste 4 (Liquidação de Recebível):** Dar baixa integral na parcela do recebível. Verificar o crédito do valor na tesouraria/caixa e confirmar que o limite do tomador foi restaurado para R$ 100.000,00.
  - [ ] **Teste 5 (Resgate de Investimento):** Solicitar o resgate do investimento do Teste 2, aplicar ajuste manual de centavos se desejado, pagar o resgate no painel e conferir a dedução de cotas e retenção de IRRF.
  - [ ] **Teste 6 (DRE e DFC):** Acessar `/admin/dre` e `/admin/dfc` e confirmar que as receitas de deságio, despesas de captação, despesas bancárias PIX e tributos foram totalizadas com precisão.

---

## 6. Avisos Importantes e Regras de Negócio Inegociáveis

### 1. Operação Limpa (Zero Contaminação de Dados)

A nova empresa deve iniciar com **saldo zero, histórico zerado e nenhuma informação de clientes da operação anterior**.  
Nenhum arquivo de backup, tabela de backup (`pre_producao_preserva_investimentos`) ou registros de auditoria da base anterior devem ser transferidos.

### 2. Regra Pétrea do Limite de Crédito do Tomador (Sensibilidade Máxima)

A lógica de consumo e liberação do limite de crédito do tomador segue uma regra institucional estrita que **jamais deve ser alterada**:

- **Operação Aprovada:** Consome o limite de crédito do tomador.
- **Operação com status "Pago":** O status `"pago"` significa que a securitizadora desembolsou o recurso para o cedente (o tomador já recebeu o dinheiro). Portanto, **"pago" CONTINUA CONSUMINDO o limite de crédito do tomador**. Sob nenhuma hipótese uma operação paga deve liberar limite ou retornar para "aprovado".
- **Operação com status "Liquidado":** O status `"liquidado"` significa que o devedor/sacado final pagou o título e o dinheiro entrou de volta no caixa da securitizadora. **SOMENTE O STATUS "LIQUIDADO" LIBERA E RESTAURA O LIMITE DE CRÉDITO DO TOMADOR.**
- Operações canceladas ou reprovadas também liberam o limite.

### 3. Tributação Obrigatória de Securitizadora de Créditos (Lei Federal nº 9.718/1998)

As empresas de securitização de créditos são obrigadas ao regime de tributação pelo **Lucro Real**. A plataforma já vem configurada e parametrizada com as alíquotas oficiais e regras de dedução da Receita Federal:

- **PIS (0,65%) e COFINS (4,00%):** Regime cumulativo sobre a receita bruta operacional (spread). A legislação permite a **dedução direta das despesas financeiras de captação** (juros remuneratórios das debêntures pagos aos investidores) da base de cálculo.
- **IRPJ (Imposto de Renda Pessoa Jurídica):** Alíquota de **15% sobre o lucro real**, acrescida do **Adicional de 10%** sobre a parcela do lucro tributável que exceder R$ 20.000,00 por mês (R$ 60.000,00 no trimestre).
- **CSLL (Contribuição Social sobre o Lucro Líquido):** Alíquota de **9%** sobre o lucro real.
- **IOF (Imposto sobre Operações Financeiras):** As operações de cessão definitiva de direitos creditórios e recebíveis realizadas por securitizadoras são isentas/alíquota zero de IOF crédito. _(Caso a operação execute contratos de mútuo financeiro, a plataforma disponibiliza o campo de IOF diário e fixo nos parâmetros financeiros)_.
- **ISS (Imposto Sobre Serviços):** **Não incide** sobre a compra e securitização de direitos creditórios por ausência de prestação de serviços nos termos da Lei Complementar nº 116/2003 (salvo se a securitizadora emitir nota fiscal de prestação de serviço pura de cobrança ou análise).

---

_Documento gerado e homologado para implantação institucional da plataforma Nexum Security 360°._
