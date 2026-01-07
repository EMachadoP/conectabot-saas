-- Create or replace generic function for updating updated_at timestamp
-- This function can be reused across multiple tables

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_sac_tickets_updated_at ON public.sac_tickets;

-- Create trigger to auto-update updated_at on sac_tickets
CREATE TRIGGER trg_sac_tickets_updated_at
BEFORE UPDATE ON public.sac_tickets
FOR EACH ROW 
EXECUTE FUNCTION public.set_updated_at();

-- Add comment
COMMENT ON FUNCTION public.set_updated_at() IS 'Generic trigger function to automatically update updated_at timestamp on row updates';
