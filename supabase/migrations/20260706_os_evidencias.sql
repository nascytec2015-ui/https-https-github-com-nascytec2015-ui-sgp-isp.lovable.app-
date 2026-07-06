-- ============ EVIDÊNCIAS DA OS ============
CREATE TABLE public.os_evidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'video', 'documento')),
  url TEXT NOT NULL,
  descricao TEXT,
  tamanho_bytes INTEGER,
  mime_type TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_os_evidencias_os ON public.os_evidencias(os_id);
CREATE INDEX idx_os_evidencias_tipo ON public.os_evidencias(tipo);
CREATE INDEX idx_os_evidencias_criado_por ON public.os_evidencias(criado_por);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_evidencias TO authenticated;
GRANT ALL ON public.os_evidencias TO service_role;

-- RLS
ALTER TABLE public.os_evidencias ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Visualizar evidências OS" ON public.os_evidencias
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ordens_servico o
  WHERE o.id = os_evidencias.os_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'atendente')
      OR (public.has_role(auth.uid(), 'tecnico') AND o.tecnico_id = auth.uid())
    )
));

CREATE POLICY "Criar evidências OS" ON public.os_evidencias
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.ordens_servico o
  WHERE o.id = os_evidencias.os_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'atendente')
      OR (public.has_role(auth.uid(), 'tecnico') AND o.tecnico_id = auth.uid())
    )
));

CREATE POLICY "Deletar evidências OS" ON public.os_evidencias
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ordens_servico o
  WHERE o.id = os_evidencias.os_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'atendente')
      OR (public.has_role(auth.uid(), 'tecnico') AND o.tecnico_id = auth.uid())
    )
));
