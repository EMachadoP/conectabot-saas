# Double AI Token Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dobrar os limites de tokens de IA dos 3 planos (Start, Pro, Enterprise) via migration SQL, sem alterar preços ou outros limites.

**Architecture:** Uma única migration SQL que faz UPDATE em `public.plans`. A função `can_perform_action()` já lê `max_ai_tokens` em runtime, então o efeito é imediato para todos os workspaces após aplicar a migration.

**Tech Stack:** Supabase CLI, PostgreSQL

---

## File Structure

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/20260417120000_double_ai_token_limits_v2.sql` |

Nenhum arquivo de código ou frontend precisa ser alterado.

---

### Task 1: Criar a migration SQL

**Files:**
- Create: `supabase/migrations/20260417120000_double_ai_token_limits_v2.sql`

- [ ] **Step 1: Verificar limites atuais no banco**

```bash
supabase db diff --use-migra
```

Ou consultar diretamente qual é o valor atual para confirmar antes de mudar:

```bash
supabase db reset --debug 2>&1 | grep -i token || true
```

Alternativa via SQL no Supabase Studio:
```sql
SELECT name, max_ai_tokens FROM public.plans ORDER BY price_cents;
```

Resultado esperado:
```
 name       | max_ai_tokens
------------+--------------
 start      |       150000
 pro        |       600000
 enterprise |      4000000
```

- [ ] **Step 2: Criar o arquivo de migration**

Crie o arquivo `supabase/migrations/20260417120000_double_ai_token_limits_v2.sql` com o conteúdo:

```sql
-- Double AI token limits for all plans (prices unchanged)
UPDATE public.plans SET max_ai_tokens = 300000  WHERE name = 'start';
UPDATE public.plans SET max_ai_tokens = 1200000 WHERE name = 'pro';
UPDATE public.plans SET max_ai_tokens = 8000000 WHERE name = 'enterprise';
```

- [ ] **Step 3: Aplicar a migration**

```bash
supabase db push
```

Resultado esperado:
```
Applying migration 20260417120000_double_ai_token_limits_v2.sql...
Done.
```

- [ ] **Step 4: Verificar que os novos limites foram aplicados**

No Supabase Studio ou via psql, execute:

```sql
SELECT name, max_ai_tokens FROM public.plans ORDER BY price_cents;
```

Resultado esperado:
```
 name       | max_ai_tokens
------------+--------------
 start      |       300000
 pro        |      1200000
 enterprise |      8000000
```

- [ ] **Step 5: Verificar na UI de Billing**

Abrir `BillingSettings` no browser. Na seção "Comparativo de Planos":
- Start deve mostrar **300.000 tokens de IA**
- Pro deve mostrar **1.200.000 tokens de IA**
- Enterprise deve mostrar **8.000.000 tokens de IA**

Na seção "Tokens de IA" do workspace Pro (exemplo da screenshot):
- O limite deve aparecer como **1.200.000 tokens** (não mais 600.000)
- O progresso de 599.613 deve ser mostrado sobre 1.200.000 (≈50%, status "Saudável")

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260417120000_double_ai_token_limits_v2.sql
git commit -m "feat: double AI token limits for all plans (Start 300k, Pro 1.2M, Enterprise 8M)"
```
