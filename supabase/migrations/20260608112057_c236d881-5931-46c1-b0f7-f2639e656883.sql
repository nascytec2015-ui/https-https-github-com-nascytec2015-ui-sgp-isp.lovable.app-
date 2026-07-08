-- Cria uma versão da função que aceita especificamente o tipo app_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    -- Converte o ENUM para texto e faz a busca na tabela de permissões
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = _user_id AND role = _role
    );
END;
$$;

-- Concede permissão de execução para todos os perfis na nova função
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, public;
