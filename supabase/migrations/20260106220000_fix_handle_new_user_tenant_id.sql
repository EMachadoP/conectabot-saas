-- Fix: Update handle_new_user trigger to include tenant_id
-- This fixes the "tenant_id violates not-null constraint" error during signup

-- Drop and recreate the trigger function to include tenant_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID;
BEGIN
    -- Get the default tenant ID (or create one if it doesn't exist)
    SELECT id INTO default_tenant_id
    FROM public.tenants
    WHERE slug = 'default'
    LIMIT 1;

    -- If no default tenant exists, create one
    IF default_tenant_id IS NULL THEN
        INSERT INTO public.tenants (id, name, slug, is_active)
        VALUES (
            '00000000-0000-0000-0000-000000000001',
            'Tenant Padrão',
            'default',
            true
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id INTO default_tenant_id;
    END IF;

    -- Create profile with tenant_id
    INSERT INTO public.profiles (id, email, name, tenant_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
        default_tenant_id
    );

    -- Also add user to tenant_members
    INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
    VALUES (default_tenant_id, NEW.id, 'member', true)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
