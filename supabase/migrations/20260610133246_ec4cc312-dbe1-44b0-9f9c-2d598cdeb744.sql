-- Main OS table
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL UNIQUE NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tipo public.os_tipo NOT NULL,
  status public.os_status NOT NULL DEFAULT 'aberta',
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

-- Materials used per OS
CREATE TABLE public.os_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ordens_servico_numero_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_materiais TO authenticated;
GRANT ALL ON public.os_materiais TO service_role;

-- RLS
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_materiais ENABLE ROW LEVEL SECURITY;

-- ordens_servico policies
-- Admin and atendente can view all; tecnico sees own assignments
CREATE POLICY "Visualizar OS" ON public.ordens_servico
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (public.has_role(auth.uid(), 'tecnico') AND tecnico_id = auth.uid())
);

-- Admin and atendente create OS
CREATE POLICY "Criar OS" ON public.ordens_servico
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
);

-- Admin/atendente edit all; tecnico edits own (to update status/datas)
CREATE POLICY "Atualizar OS" ON public.ordens_servico
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (public.has_role(auth.uid(), 'tecnico') AND tecnico_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (public.has_role(auth.uid(), 'tecnico') AND tecnico_id = auth.uid())
);

-- Only admin deletes
CREATE POLICY "Remover OS" ON public.ordens_servico
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- os_materiais policies — follow parent OS access
CREATE POLICY "Visualizar materiais OS" ON public.os_materiais
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ordens_servico o
  WHERE o.id = os_materiais.os_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'atendente')
      OR (public.has_role(auth.uid(), 'tecnico') AND o.tecnico_id = auth.uid())
    )
));

CREATE POLICY "Gerir materiais OS" ON public.os_materiais
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ordens_servico o
  WHERE o.id = os_materiais.os_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'atendente')
      OR (public.has_role(auth.uid(), 'tecnico') AND o.tecnico_id = auth.uid())
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.ordens_servico o
  WHERE o.id = os_materiais.os_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'atendente')
      OR (public.has_role(auth.uid(), 'tecnico') AND o.tecnico_id = auth.uid())
    )
));

-- updated_at trigger
CREATE TRIGGER update_ordens_servico_updated_at
BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_os_cliente ON public.ordens_servico(cliente_id);
CREATE INDEX idx_os_tecnico ON public.ordens_servico(tecnico_id);
CREATE INDEX idx_os_status ON public.ordens_servico(status);
CREATE INDEX idx_os_materiais_os ON public.os_materiais(os_id);