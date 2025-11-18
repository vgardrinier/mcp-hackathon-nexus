-- Grant execute permissions for RPC functions
-- This allows the service_role to call setup_new_user

GRANT EXECUTE ON FUNCTION setup_new_user(UUID, TEXT) TO service_role;

