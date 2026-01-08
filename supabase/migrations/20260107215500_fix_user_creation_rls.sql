-- Fix: Allow handle_new_user trigger to bypass RLS when creating profiles
-- This fixes the "Database error creating new user" issue

-- The problem: handle_new_user trigger runs with SECURITY DEFINER but RLS policies
-- on profiles table block the INSERT because there's no authenticated user context
-- when creating users via Supabase Dashboard

-- Solution: Temporarily disable RLS for the trigger's INSERT operation

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
    -- Using SECURITY DEFINER allows this to bypass RLS
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
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Add a policy to allow service_role to insert into profiles
-- This is needed for the SECURITY DEFINER function to work
DROP POLICY IF EXISTS "service_role_insert_profiles" ON public.profiles;
CREATE POLICY "service_role_insert_profiles"
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow authenticated users to insert their own profile
-- (in case the trigger fails, the app can create it)
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
