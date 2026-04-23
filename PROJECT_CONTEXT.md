# PROJECT_CONTEXT.md — ConectaBot SaaS

Arquivo de contexto para Claude Code. Atualizado a cada sessão.

---

## Visão Geral do Projeto

**ConectaBot** é uma plataforma SaaS multi-tenant de atendimento via WhatsApp. Inclui:
- Inbox de conversas em tempo real (WhatsApp via Z-API)
- IA para respostas automáticas (OpenAI / Gemini)
- Transcrição de áudios (OpenAI Whisper / gpt-4o-mini-transcribe)
- Gestão de times, workspaces, billing (Stripe)
- Módulo SAC com tickets
- Calendário de eventos / agendamentos

**Stack:**
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Supabase (Postgres + Edge Functions Deno + Realtime + RLS)
- Integração WhatsApp: Z-API
- IA: OpenAI (GPT-4o, Whisper) e Gemini
- Pagamentos: Stripe
- Deploy: Vercel (frontend) + Supabase (backend)

**Projeto Supabase:** `rzlrslywbszlffmaglln`

---

## Estrutura Principal

```
src/
  components/inbox/   — Chat, mensagens, áudio, IA control bar
  components/ui/      — shadcn/ui components
  pages/              — Rotas principais (Admin, Inbox, SAC, etc.)
  hooks/              — Lógica reutilizável (useConversations, useAuth, etc.)
  contexts/           — TenantContext, ActiveConversationContext
  integrations/supabase/ — Cliente Supabase e types gerados

supabase/
  functions/          — Edge Functions Deno
    zapi-webhook/     — Recebe webhooks do WhatsApp (Z-API)
    ai-generate-reply/ — Gera respostas com IA
    transcribe-audio/  — Transcreve áudios com OpenAI Whisper
    ai-maybe-reply/   — Decide se IA deve responder
  migrations/         — Histórico de migrations Postgres
```

---

## Estado Atual da Branch

**Branch ativa:** `codex/mobile-inbox-realtime`  
**Branch principal:** `main`

### Commits recentes (branch atual):
- `685a36e` fix: improve mobile inbox realtime behavior
- `1918f86` fix: add workspace_id to zapi_settings payload
- `2d0eee9` fix: scope Z-API settings to active workspace
- `fe806fd` fix: drop orphaned RLS policies (cross-tenant leak)
- `5673eb4` fix: filter inbox by active workspace

---

## Sessão 2026-04-22 — Fix: Erro de áudio com OPENAI_API_KEY

### Problema Relatado
Mensagens de áudio exibiam no chat:
- `[Erro na transcrição]` como transcrição
- `[Áudio - OPENAI_API_KEY não configurada. Por favor, execute]` como conteúdo

### Causa Raiz
A Edge Function `transcribe-audio` não tem `OPENAI_API_KEY` configurada como secret do Supabase. Quando falha, o bloco de erro sobrescrevia o campo `content` da mensagem com a mensagem técnica de erro.

### Arquivos Alterados

**`supabase/functions/transcribe-audio/index.ts`** (linha ~184)
- Antes: atualizava `content` da mensagem com texto técnico de erro
- Depois: bloco de erro só atualiza `transcript: null`, `transcribed_at` e `transcript_provider: 'error'`. O campo `content` NÃO é mais sobrescrito.

**`src/components/inbox/ChatMessage.tsx`**
- Adicionada verificação `isRealTranscript`: só exibe a transcrição se o valor não começa com `[` (evita mostrar marcadores como `[Erro na transcrição]`)
- `localContent` não é mais exibido para mensagens `audio` quando começa com `[` (evita mostrar placeholders de erro)

### Pendência: Limpeza do Banco
Mensagens já contaminadas no banco podem ter:
- `content = '[Áudio - OPENAI_API_KEY não configurada...]'`
- `transcript = '[Erro na transcrição]'`

Para limpar, executar no Supabase SQL Editor:
```sql
UPDATE messages
SET
  content = '[Áudio]',
  transcript = null,
  transcript_provider = null,
  transcribed_at = null
WHERE
  message_type = 'audio'
  AND (
    content LIKE '[Áudio - OPENAI_API_KEY%'
    OR transcript = '[Erro na transcrição]'
    OR transcript = '[Sem áudio detectável]'
  );
```

### Pendência: Configurar OPENAI_API_KEY
Para transcrição funcionar, executar:
```bash
npx supabase secrets set OPENAI_API_KEY="sk-..."
```

Ou via dashboard: Supabase > Project Settings > Edge Functions > Secrets.

---

## Decisões Técnicas Relevantes

- **Multi-tenant**: isolamento por `workspace_id` em todas as tabelas com RLS
- **Z-API**: integração via webhook + polling. Token de segurança por workspace em `zapi_settings`
- **IA**: trigger automático pós-transcrição de áudio (`transcribe-audio` chama `ai-maybe-reply` ao finalizar)
- **Áudio**: `audio_auto_transcribe` é setting por workspace, mas o webhook **não verifica esse setting** antes de disparar transcrição — todos os áudios são enviados para transcrição independente da configuração
- **Transcrição**: usa `gpt-4o-mini-transcribe` com fallback para `whisper-1`

---

## Próximos Passos Sugeridos

1. Configurar `OPENAI_API_KEY` nos secrets do Supabase
2. Executar SQL de limpeza para mensagens contaminadas
3. Considerar checar `audio_auto_transcribe` no webhook antes de disparar transcrição (hoje isso não é verificado)
4. Adicionar indicador visual no chat quando áudio está "aguardando transcrição" vs "sem transcrição disponível"
