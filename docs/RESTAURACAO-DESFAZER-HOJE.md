# Pedido de restauração — desfazer alterações de hoje (agente do Maestro)

> Documento de execução interna, gerado em 2026-11-21. O usuário (Anderson)
> pediu para desfazer TUDO que foi feito hoje no projeto. Este run NÃO
> executou a restauração: o ambiente do agente não possui comando git
> (não há shell/exec disponível) e o reflog do repositório não pôde ser
> lido pelas ferramentas de arquivo. Nada no código nem no banco foi
> alterado neste run — nem a restauração, nem a bagunça.

## Estado verificado neste run

- Branch local `main` e `origin/main` em: `ce484f7d20998ef94678ad1a1882ca22f10ad398`
  (working tree e remoto sincronizados; não há commit pendente local).
- Última mensagem de commit em `.git/COMMIT_EDITMSG`: `v0.0.930`.
- Último fetch registrado (`FETCH_HEAD`): `21f10c2dabcbba553d66217468cc0b517a581f54`.
- Referência mais antiga do repositório: v0.0.711; último trabalho legítimo
  conhecido antes de hoje: v0.0.1163 (quitação de CCB com saldo em aberto).

## Passos para executar a restauração (requer git)

1. Listar os commits de hoje (de qualquer autoria, em especial do Maestro):
   ```
   git log --oneline --since="2026-11-21 00:00" --all
   ```
2. Identificar o último commit anterior a hoje (v0.0.1163 ou seguinte legítima).
3. Preferir revert (preserva histórico):
   ```
   git revert --no-commit <hash1> <hash2> ... && git commit -m "Restauração: desfaz alterações de 2026-11-21"
   ```
   Alternativa (estado exato, exige force push):
   ```
   git reset --hard <hash-anterior-a-hoje>
   git push --force-with-lease origin main
   ```
4. Verificar `git diff <hash-anterior-a-hoje> HEAD -- supabase/migrations/`:
   se migrations foram aplicadas hoje no Supabase, reverter código NÃO apaga
   a estrutura. Só dropar se for tabela criada hoje e sem dados do usuário;
   em caso de dúvida, apenas relatar.
5. Rodar QA (lint + typecheck + build) e confirmar navegação normal em
   `/admin/bank-accounts` e demais telas.

## Pendências

- [ ] Listar os commits de hoje (reflog ilegível pelas ferramentas do agente).
- [ ] Executar revert/reset até o commit anterior a hoje.
- [ ] Conferir migrations de hoje no Supabase (list_migrations) e relatar.
