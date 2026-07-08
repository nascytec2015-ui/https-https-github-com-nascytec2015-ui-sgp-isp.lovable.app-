-- ============ 1. CRIAÇÃO DIRETA DOS TIPOS (ENUMS) ============
DROP TYPE IF EXISTS public.os_tipo CASCADE;
CREATE TYPE public.os_tipo AS ENUM ('instalacao', 'reparo', 'mudanca_endereco', 'desativacao', 'outros');

DROP TYPE IF EXISTS public.os_status CASCADE;
CREATE TYPE public.os_status AS ENUM ('aberta', 'em_atendimento', 'concluida', 'cancelada');


-- ============ 2. CRIAÇÃO DA TABELA DE PROJETOS FTTH (MAPAS) ============
CREATE TABLE IF NOT EXISTS public.projetos_ftth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  olt_tx_dbm numeric NOT NULL DEFAULT 3,
  data jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos_ftth TO authenticated, anon;
GRANT ALL ON public.projetos_ftth TO service_role;

ALTER TABLE public.projetos_ftth ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read ftth" ON public.projetos_ftth;
CREATE POLICY "Staff read ftth" ON public.projetos_ftth FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Staff insert ftth" ON public.projetos_ftth;
CREATE POLICY "Staff insert ftth" ON public.projetos_ftth FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Staff update ftth" ON public.projetos_ftth;
CREATE POLICY "Staff update ftth" ON public.projetos_ftth FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Admin delete ftth" ON public.projetos_ftth;
CREATE POLICY "Admin delete ftth" ON public.projetos_ftth FOR DELETE TO public USING (true);

DROP TRIGGER IF EXISTS update_projetos_ftth_updated_at ON public.projetos_ftth;
CREATE TRIGGER update_projetos_ftth_updated_at BEFORE UPDATE ON public.projetos_ftth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============ 3. CRIAÇÃO DA TABELA ORDENS DE SERVIÇO ============
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL UNIQUE NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tipo public.os_tipo NOT NULL,
  status public.os_status NOT NULL DEFAULT 'aberta'::public.os_status,
  descricao TEXT NOT NULL,
  tecnico_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  projeto_ftth_id UUID REFERENCES public.projetos_ftth(id) ON DELETE SET NULL,
  cto_ref TEXT,
  porta_cto INTEGER,
  endereco_atendimento TEXT,
  data_agendada TIMESTAMPTZ,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  valor NUMERIC(10,2) DEFAULT 0,
  forma_pagamento TEXT,
  assinatura_cliente TEXT,
  observacoes_cliente TEXT,
  observacoes_internas TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============ 4. CRIAÇÃO DA TABELA MATERIAIS DA OS ============
CREATE TABLE IF NOT EXISTS public.os_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============ 5. CONCESSÃO DE PERMISSÕES (GRANTS) ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated, anon;
GRANT ALL ON public.ordens_servico TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ordens_servico_numero_seq TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_materiais TO authenticated, anon;
GRANT ALL ON public.os_materiais TO service_role;


-- ============ 6. SEGURANÇA DE LINHA (RLS POLICIES) ============
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_materiais ENABLE ROW LEVEL SECURITY;

-- Políticas para Ordens de Serviço
DROP POLICY IF EXISTS "Visualizar OS" ON public.ordens_servico;
CREATE POLICY "Visualizar OS" ON public.ordens_servico FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Criar OS" ON public.ordens_servico;
CREATE POLICY "Criar OS" ON public.ordens_servico FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Atualizar OS" ON public.ordens_servico;
CREATE POLICY "Atualizar OS" ON public.ordens_servico FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Remover OS" ON public.ordens_servico;
CREATE POLICY "Remover OS" ON public.ordens_servico FOR DELETE TO public USING (true);

-- Políticas para Materiais da OS
DROP POLICY IF EXISTS "Visualizar materiais OS" ON public.os_materiais;
CREATE POLICY "Visualizar materiais OS" ON public.os_materiais FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Gerir materiais OS" ON public.os_materiais;
CREATE POLICY "Gerir materiais OS" ON public.os_materiais FOR ALL TO public USING (true);


-- ============ 7. GATILHOS (TRIGGERS) E ÍNDICES ============
DROP TRIGGER IF EXISTS update_ordens_servico_updated_at ON public.ordens_servico;
CREATE TRIGGER update_ordens_servico_updated_at
BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_os_cliente ON public.ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_tecnico ON public.ordens_servico(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_os_status ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_materiais_os ON public.os_materiais(os_id);
