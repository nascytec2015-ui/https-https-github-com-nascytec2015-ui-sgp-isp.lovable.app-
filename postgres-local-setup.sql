-- ============ TABELAS DE CONTROLE DE SINCRONIZAÇÃO ============

-- Enum types (mesmos do Supabase)
CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico', 'atendente');
CREATE TYPE public.cliente_status AS ENUM ('ativo', 'bloqueado', 'cancelado');
CREATE TYPE public.os_tipo AS ENUM ('instalacao', 'manutencao', 'mudanca_endereco', 'visita_tecnica');
CREATE TYPE public.os_status AS ENUM ('aberta', 'agendada', 'em_andamento', 'concluida', 'cancelada');

-- Log de sincronização
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL,
  operacao TEXT NOT NULL,
  pk UUID,
  dados JSONB,
  origem TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  sincronizado BOOLEAN DEFAULT false
);
CREATE INDEX idx_sync_logs_tabela ON public.sync_logs(tabela);
CREATE INDEX idx_sync_logs_sincronizado ON public.sync_logs(sincronizado);
CREATE INDEX idx_sync_logs_timestamp ON public.sync_logs(timestamp);

-- Rastreamento de conflitos
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL,
  registro_id UUID NOT NULL,
  supabase_data JSONB,
  local_data JSONB,
  resolucao TEXT,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_conflicts_tabela ON public.sync_conflicts(tabela);
CREATE INDEX idx_sync_conflicts_resolvido ON public.sync_conflicts(resolvido_em);

-- Versão de sincronização (para saber qual banco é mais recente)
CREATE TABLE IF NOT EXISTS public.sync_versions (
  tabela TEXT PRIMARY KEY,
  ultima_sincronizacao TIMESTAMPTZ,
  versao_local INT DEFAULT 0,
  versao_supabase INT DEFAULT 0
);

-- Inserir tabelas que serão sincronizadas
INSERT INTO public.sync_versions (tabela, ultima_sincronizacao, versao_local, versao_supabase)
VALUES 
  ('profiles', now(), 0, 0),
  ('user_roles', now(), 0, 0),
  ('planos', now(), 0, 0),
  ('clientes', now(), 0, 0),
  ('ordens_servico', now(), 0, 0),
  ('os_materiais', now(), 0, 0),
  ('os_evidencias', now(), 0, 0),
  ('projetos_ftth', now(), 0, 0)
ON CONFLICT (tabela) DO NOTHING;

-- Função para registrar mudanças
CREATE OR REPLACE FUNCTION public.log_sync_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.sync_logs (tabela, operacao, pk, dados, origem)
  VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW), 'local');
  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
