-- Improved handle_new_user function
-- This version ensures user creation NEVER fails, even if profile creation fails

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
    v_name TEXT;
    v_tenant_exists BOOLEAN;
BEGIN
    -- 1. Ensure default tenant exists (create if needed)
    SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = default_tenant_id)
    INTO v_tenant_exists;
    
    IF NOT v_tenant_exists THEN
        BEGIN
            INSERT INTO public.tenants (id, name, slug, is_active)
            VALUES (default_tenant_id, 'Tenant Padrão', 'default', true)
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log but don't fail
                RAISE LOG 'Failed to create default tenant: % %', SQLERRM, SQLSTATE;
        END;
    END IF;

    -- 2. Extract name from metadata
    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- 3. Try to create profile (don't fail if it doesn't work)
    BEGIN
        INSERT INTO public.profiles (id, email, name, tenant_id)
        VALUES (NEW.id, NEW.email, v_name, default_tenant_id)
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            tenant_id = COALESCE(EXCLUDED.tenant_id, public.profiles.tenant_id);
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail user creation
            RAISE LOG 'Failed to create profile for user %: % (SQLSTATE: %)', 
                NEW.id, SQLERRM, SQLSTATE;
    END;

    -- 4. Try to add to tenant_members (don't fail if it doesn't work)
    BEGIN
        INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
        VALUES (default_tenant_id, NEW.id, 'member', true)
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail user creation
            RAISE LOG 'Failed to create tenant_member for user %: % (SQLSTATE: %)', 
                NEW.id, SQLERRM, SQLSTATE;
    END;

    -- Always return NEW to allow user creation to succeed
    RETURN NEW;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, authenticated, anon;

-- Comment explaining the function
COMMENT ON FUNCTION public.handle_new_user() IS 
'Trigger function that creates profile and tenant membership for new users.
Uses SECURITY DEFINER to bypass RLS. Errors are logged but never fail user creation.';
