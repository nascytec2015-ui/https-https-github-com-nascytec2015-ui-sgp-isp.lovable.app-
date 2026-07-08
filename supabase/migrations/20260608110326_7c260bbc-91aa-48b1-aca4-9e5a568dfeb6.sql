-- 1. Remove a permissão de execução pública e anônima das funções (Usando text)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 2. Concede a permissão apenas para usuários logados (authenticated)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(UUID) TO authenticated;
