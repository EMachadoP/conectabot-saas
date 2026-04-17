-- Drop orphaned pre-workspace-isolation RLS policies that coexist with
-- workspace-scoped policies and bypass tenant data isolation.
--
-- The workspace isolation migration (20260318120000) created *_workspace_select
-- policies but did not drop these older team-based policies. PostgreSQL
-- combines permissive policies with OR, so the most permissive one wins,
-- rendering workspace isolation ineffective for admins and agents.

-- conversations: "has_role('admin') OR assigned_to IS NULL" leaks all rows to admins
DROP POLICY IF EXISTS "Users can view team conversations" ON public.conversations;

-- conversations: broad UPDATE policy not scoped to workspace
DROP POLICY IF EXISTS "Agents can update any conversation" ON public.conversations;

-- messages: USING (true) — any authenticated user sees all messages
DROP POLICY IF EXISTS "messages_select_all_agents" ON public.messages;

-- messages: uses can_access_conversation() which ignores workspace boundaries
DROP POLICY IF EXISTS "Users can view team messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert team messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update team messages" ON public.messages;

-- participants: "has_role('admin')" leaks all participants to any admin
DROP POLICY IF EXISTS "Users can view accessible participants" ON public.participants;

-- contacts: old insert policy without workspace scoping
DROP POLICY IF EXISTS "Users can insert contacts" ON public.contacts;
