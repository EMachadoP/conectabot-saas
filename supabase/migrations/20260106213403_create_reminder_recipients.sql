-- Create reminder_recipients table for multi-recipient support
-- Allows N recipients per reminder (replacing single contact_id approach)

CREATE TABLE IF NOT EXISTS public.reminder_recipients (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminder_jobs(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  
  -- Target information (snapshot at creation time)
  type text not null check (type in ('person', 'group')),
  jid text not null,
  display_name text not null,
  phone_e164 text, -- snapshot for persons, null for groups
  
  created_at timestamptz not null default now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reminder_recipients_reminder 
ON public.reminder_recipients(reminder_id);

CREATE INDEX IF NOT EXISTS idx_reminder_recipients_team 
ON public.reminder_recipients(team_id);

CREATE INDEX IF NOT EXISTS idx_reminder_recipients_jid 
ON public.reminder_recipients(jid);

-- Enable RLS
ALTER TABLE public.reminder_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies (team-based)
CREATE POLICY "team_select_reminder_recipients"
ON public.reminder_recipients FOR SELECT
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_insert_reminder_recipients"
ON public.reminder_recipients FOR INSERT
WITH CHECK (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_update_reminder_recipients"
ON public.reminder_recipients FOR UPDATE
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_delete_reminder_recipients"
ON public.reminder_recipients FOR DELETE
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

-- Comments
COMMENT ON TABLE public.reminder_recipients IS 'Recipients for calendar event reminders (supports N recipients per reminder)';
COMMENT ON COLUMN public.reminder_recipients.reminder_id IS 'Reference to the reminder job';
COMMENT ON COLUMN public.reminder_recipients.team_id IS 'Team that owns this recipient';
COMMENT ON COLUMN public.reminder_recipients.type IS 'Recipient type: person or group';
COMMENT ON COLUMN public.reminder_recipients.jid IS 'WhatsApp JID for message delivery (e.g., 5511999999999@s.whatsapp.net)';
COMMENT ON COLUMN public.reminder_recipients.display_name IS 'Snapshot of display name at creation time';
COMMENT ON COLUMN public.reminder_recipients.phone_e164 IS 'Snapshot of phone number in E.164 format (only for persons)';
