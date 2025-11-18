-- Fix trigger and function permissions
-- Run this in Supabase SQL Editor

-- 1. Make sure the function exists and has correct permissions
CREATE OR REPLACE FUNCTION setup_new_user(user_id UUID, user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  generated_api_key TEXT;
BEGIN
  -- Generate API key
  generated_api_key := gen_random_uuid()::text;

  -- Create user row
  INSERT INTO users (id, email, api_key)
  VALUES (user_id, user_email, generated_api_key)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Install default servers (GitHub and Notion)
  INSERT INTO mcp_server_users (user_id, server_id)
  VALUES
    (user_id, 'github-stdio'),
    (user_id, 'notion-http')
  ON CONFLICT (user_id, server_id) DO NOTHING;

  RETURN generated_api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant execute permissions
GRANT EXECUTE ON FUNCTION setup_new_user(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION setup_new_user(UUID, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION setup_new_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION setup_new_user(UUID, TEXT) TO anon;

-- 3. Make sure trigger function exists
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM setup_new_user(NEW.id, NEW.email);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Drop and recreate trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- 5. Verify trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

