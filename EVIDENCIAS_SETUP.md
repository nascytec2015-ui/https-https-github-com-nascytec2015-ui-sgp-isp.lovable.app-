# 📸 Como Usar Evidências na Ordem de Serviço

## Exemplo de Integração

```tsx
import { useOsEvidencias } from '@/hooks/use-os-evidencias';
import { EvidenciasOs } from '@/components/ui/evidencias-os';
import { useEffect } from 'react';

interface OsDetailPageProps {
  osId: string;
}

export default function OsDetailPage({ osId }: OsDetailPageProps) {
  const {
    evidencias,
    loading,
    uploadingFile,
    fetchEvidencias,
    uploadEvidencia,
    deleteEvidencia
  } = useOsEvidencias();

  // Carregar evidências ao abrir a página
  useEffect(() => {
    if (osId) {
      fetchEvidencias(osId);
    }
  }, [osId, fetchEvidencias]);

  const handleUpload = async (file: File, tipo: string, descricao: string) => {
    await uploadEvidencia(osId, file, tipo, descricao);
  };

  const handleDelete = async (evidenciaId: string) => {
    // Buscar a URL da evidência
    const evidencia = evidencias.find(e => e.id === evidenciaId);
    if (evidencia) {
      await deleteEvidencia(evidenciaId, evidencia.url);
    }
  };

  return (
    <div className="space-y-6">
      {/* ... outros campos da OS ... */}

      <EvidenciasOs
        osId={osId}
        evidencias={evidencias}
        onUpload={handleUpload}
        onDelete={handleDelete}
        readOnly={false}
      />
    </div>
  );
}
```

---

## 🎯 Funcionalidades

✅ **Upload de múltiplos formatos:**
- 📷 Imagens (JPG, PNG, GIF, WebP, etc)
- 🎬 Vídeos (MP4, WebM, MOV, etc)
- 📄 Documentos (PDF, Word, Excel, etc)

✅ **Validações:**
- Máximo 50MB por arquivo
- Tipos de arquivo restritos
- Descrição opcional para cada arquivo

✅ **Armazenamento:**
- Supabase Storage (cloud)
- Sincronização automática com PostgreSQL local
- URLs públicas e permanentes

✅ **Funcionalidades:**
- Download/Abrir arquivo
- Deletar evidência
- Histórico com data e tamanho
- Ícones por tipo de arquivo

---

## 🗄️ Estrutura do Banco

### Tabela `os_evidencias`:
```sql
id                    -- UUID principal
os_id                 -- Referência à OS
tipo                  -- 'foto', 'video' ou 'documento'
url                   -- URL pública do arquivo
descricao             -- Descrição do arquivo
tamanho_bytes         -- Tamanho em bytes
mime_type             -- Tipo MIME (ex: 'image/jpeg')
criado_por            -- Usuário que enviou
created_at            -- Data/hora do upload
```

---

## 🔒 Segurança

- ✅ Row Level Security (RLS) no Supabase
- ✅ Autenticação obrigatória
- ✅ Apenas técnico/atendente/admin podem ver
- ✅ Permissões por OS

---

## 📝 Adicionar na Migração PostgreSQL

Execute no pgAdmin4:

```sql
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

CREATE INDEX idx_os_evidencias_os ON public.os_evidencias(os_id);
```

---

## ⚙️ Configurar Supabase Storage

1. No Supabase Dashboard:
   - Ir para "Storage"
   - Criar novo bucket: `os_evidencias`
   - Deixar como público (para download)
   - RLS: Ativar

2. Política RLS para upload:
```sql
-- Permitir upload
CREATE POLICY "Usuários autenticados podem fazer upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'os_evidencias');

-- Permitir download
CREATE POLICY "Arquivo público disponível"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'os_evidencias');
```

---

## 🔄 Sincronização com PostgreSQL

A tabela `os_evidencias` é sincronizada automaticamente:
- ✅ A cada 30 segundos com PostgreSQL local
- ✅ Registra em `sync_logs`
- ✅ Detecta conflitos em `sync_conflicts`

Verificar sincronização:
```bash
curl http://localhost:8081/api/sync/health
```

---

## 📱 Usar em Componente

```tsx
import { EvidenciasOs } from '@/components/ui/evidencias-os';

<EvidenciasOs
  osId="uuid-da-os"
  evidencias={meusDados}
  onUpload={handleUpload}
  onDelete={handleDelete}
/>
```

Pronto! 🚀
