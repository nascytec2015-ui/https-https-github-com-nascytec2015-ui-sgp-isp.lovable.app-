CREATE TABLE public.projetos_ftth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  olt_tx_dbm numeric NOT NULL DEFAULT 3,
  data jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos_ftth TO authenticated;
GRANT ALL ON public.projetos_ftth TO service_role;

ALTER TABLE public.projetos_ftth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read ftth" ON public.projetos_ftth FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff insert ftth" ON public.projetos_ftth FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Staff update ftth" ON public.projetos_ftth FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin delete ftth" ON public.projetos_ftth FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_projetos_ftth_updated_at BEFORE UPDATE ON public.projetos_ftth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();