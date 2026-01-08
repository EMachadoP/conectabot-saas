-- Alternative fix: Disable RLS check for handle_new_user trigger
-- by granting explicit permissions

-- First, check if tenants table exists and has default tenant
DO $$
BEGIN
    -- Ensure default tenant exists
    INSERT INTO public.tenants (id, name, slug, is_active)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Tenant Padrão',
        'default',
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        is_active = EXCLUDED.is_active;
END $$;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.profiles;
DROP POLICY IF EXISTS "service_role_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;

-- Create a permissive policy for INSERT that allows:
-- 1. Service role (for triggers)
-- 2. Authenticated users creating their own profile
CREATE POLICY "allow_profile_insert"
ON public.profiles
FOR INSERT
WITH CHECK (
    -- Allow service_role to insert anything
    current_setting('role') = 'service_role'
    OR
    -- Allow authenticated users to insert their own profile
    (auth.uid() = id AND auth.role() = 'authenticated')
    OR
    -- Allow if called from trigger (no auth context)
    auth.uid() IS NULL
);

-- Recreate the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
    v_name TEXT;
BEGIN
    -- Extract name from metadata or email
    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- Insert profile (RLS should allow this now)
    INSERT INTO public.profiles (id, email, name, tenant_id)
    VALUES (NEW.id, NEW.email, v_name, default_tenant_id)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        tenant_id = EXCLUDED.tenant_id;

    -- Insert tenant member
    INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
    VALUES (default_tenant_id, NEW.id, 'member', true)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        RAISE WARNING 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
        -- Don't fail the user creation
        RETURN NEW;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, authenticated;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Also ensure tenant_members table has appropriate policies
DROP POLICY IF EXISTS "allow_tenant_member_insert" ON public.tenant_members;
CREATE POLICY "allow_tenant_member_insert"
ON public.tenant_members
FOR INSERT
WITH CHECK (
    current_setting('role') = 'service_role'
    OR auth.uid() = user_id
    OR auth.uid() IS NULL
);
