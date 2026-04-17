# Design: Dobrar Limites de Tokens de IA

**Data:** 2026-04-17

## Objetivo

Dobrar a quantidade de tokens de IA disponíveis em todos os planos, mantendo os preços inalterados. Clientes Pro existentes se beneficiam imediatamente sem nenhuma ação adicional.

## Novos Limites

| Plano      | Tokens Atual | Tokens Novo |
|------------|-------------|-------------|
| Start      | 150.000     | 300.000     |
| Pro        | 600.000     | 1.200.000   |
| Enterprise | 4.000.000   | 8.000.000   |

Preços, limites de mensagens e limites de membros permanecem inalterados.

## Implementação

### Única mudança: migration SQL

**Arquivo:** `supabase/migrations/20260417120000_double_ai_token_limits_v2.sql`

```sql
UPDATE public.plans SET max_ai_tokens = 300000  WHERE name = 'start';
UPDATE public.plans SET max_ai_tokens = 1200000 WHERE name = 'pro';
UPDATE public.plans SET max_ai_tokens = 8000000 WHERE name = 'enterprise';
```

### Frontend

Nenhuma alteração. O componente `BillingSettings.tsx` (linha 383) lê `plan.max_ai_tokens` diretamente do banco via `useBillingOverview` — os novos valores aparecem automaticamente.

## Efeito em Clientes Ativos

A função `can_perform_action()` no Supabase lê `max_ai_tokens` em runtime. Após aplicar a migration:

- Clientes Pro com uso atual próximo de 600.000 tokens passam a ter 1.200.000 disponíveis imediatamente.
- Nenhum reset de ciclo ou ajuste de uso necessário.
- Nenhuma alteração no Stripe (preços não mudam).

## Fora do Escopo

- Alterações de preço
- Limites de mensagens ou membros
- Reset de uso do ciclo atual
- Alterações no Stripe
