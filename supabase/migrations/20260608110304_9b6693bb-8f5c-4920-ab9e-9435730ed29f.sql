CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO public USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK (true);

-- ============ USER ROLES ============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated, anon;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view roles" ON public.user_roles FOR SELECT TO public USING (true);

-- Versão 1: Dois parâmetros
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _role text)
RETURNS boolean 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = _user_id AND role = _role
    );
END;
$$;

-- Versão 2: Um parâmetro
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

-- Função auxiliar has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, text) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, public;

-- ============ TRIGGER: profile + first admin ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'atendente');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ UPDATED_AT ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PLANOS ============
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  velocidade_down INT NOT NULL DEFAULT 0,
  velocidade_up INT NOT NULL DEFAULT 0,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.planos TO authenticated, anon, service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read planos" ON public.planos FOR SELECT TO public USING (true);
CREATE POLICY "Allow public write planos" ON public.planos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update planos" ON public.planos FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete planos" ON public.planos FOR DELETE TO public USING (true);

DROP TRIGGER IF EXISTS update_planos_updated_at ON public.planos;
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CLIENTES ============
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL,
  ppoe_user TEXT,
  ppoe_pass TEXT,
  ip_fixo TEXT,
  observacoes TEXT,
  status public.cliente_status NOT NULL DEFAULT 'ativo',
  data_ativacao DATE DEFAULT CURRENT_DATE,
  data_cancelamento DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LINHA CORRIGIDA DE CREATE PARA GRANT:
GRANT ALL ON public.clientes TO authenticated, anon, service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read clientes" ON public.clientes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public create clientes" ON public.clientes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update clientes" ON public.clientes FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete clientes" ON public.clientes FOR DELETE TO public USING (true);

DROP TRIGGER IF EXISTS update_clientes_updated_at ON public.clientes;
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
