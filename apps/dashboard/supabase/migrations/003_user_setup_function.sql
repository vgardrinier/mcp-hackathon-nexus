-- Function to automatically set up a new user after Supabase Auth signup
-- This should be called via a database trigger or manually after user creation

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

-- Trigger to automatically set up user when they sign up via Supabase Auth
-- Note: This requires enabling the auth.users trigger in Supabase dashboard
-- or calling setup_new_user() manually from your app after signup

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM setup_new_user(NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To enable automatic user setup, run this in Supabase SQL editor:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();

