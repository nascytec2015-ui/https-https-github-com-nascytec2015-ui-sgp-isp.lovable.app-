# 🔄 Configuração de Sincronização Bidirecional

Guia completo para configurar sincronização automática entre **Supabase** e **PostgreSQL Local**.

---

## 📋 Pré-requisitos

- ✅ PostgreSQL rodando localmente em `localhost:5432`
- ✅ pgAdmin4 para gerenciar o banco
- ✅ Supabase com as credenciais configuradas
- ✅ Node.js e npm instalados

---

## 🚀 1. Preparar PostgreSQL Local

### 1.1 Executar Script de Setup

```bash
# Windows (PowerShell)
psql -h localhost -U postgresql -d sgp_isp -f postgres-local-setup.sql

# Linux/Mac
psql -h localhost -U postgresql -d sgp_isp -f postgres-local-setup.sql
```

**Credenciais:**
- Host: `localhost`
- Porta: `5432`
- Usuário: `postgresql`
- Senha: `R23f80N19`
- Banco: `sgp_isp`

### 1.2 Verificar Tabelas Criadas

Execute no pgAdmin4 ou psql:

```sql
SELECT * FROM public.sync_logs;
SELECT * FROM public.sync_conflicts;
SELECT * FROM public.sync_versions;
```

---

## 🔧 2. Configurar Variáveis de Ambiente

As variáveis já estão no `.env`:

```env
# PostgreSQL Local (Sincronização)
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
POSTGRES_USER="postgresql"
POSTGRES_PASSWORD="R23f80N19"
POSTGRES_DB="sgp_isp"

# Sincronização
SYNC_INTERVAL="30000"          # 30 segundos
SYNC_PRIORITY="supabase"       # Prioridade em conflitos
```

---

## 📦 3. Instalar Dependências

```bash
npm install pg @supabase/supabase-js
```

---

## ▶️ 4. Iniciar Sincronização

A sincronização é iniciada automaticamente quando o servidor começa.

### 4.1 Verificar Status

O app expõe um endpoint para verificar saúde:

```bash
curl http://localhost:5173/api/sync/health
```

**Resposta esperada:**
```json
{
  "postgres": true,
  "supabase": true,
  "lastSync": "2026-07-06T10:30:45.123Z",
  "isSyncing": false,
  "timestamp": "2026-07-06T10:30:50.456Z"
}
```

### 4.2 Usar Hook React

No seu componente:

```tsx
import { SyncStatusIndicator } from '@/hooks/use-sync-status';

export function MyComponent() {
  return (
    <div>
      <SyncStatusIndicator />
    </div>
  );
}
```

---

## 🔄 Como Funciona a Sincronização

### Fluxo:
1. **Cada 30 segundos** (configurável), o serviço verifica ambos os bancos
2. **Compara timestamps** (`updated_at`) de cada registro
3. **Sincroniza o mais recente** para o outro banco
4. **Registra operações** em `sync_logs`
5. **Detecta conflitos** e armazena em `sync_conflicts`

### Prioridades:
- **`SYNC_PRIORITY=supabase`**: Se houver conflito, Supabase vence
- **`SYNC_PRIORITY=local`**: Se houver conflito, PostgreSQL local vence

---

## 📊 Monitorar Sincronização

### Ver Logs de Sincronização:
```sql
SELECT * FROM public.sync_logs 
ORDER BY timestamp DESC 
LIMIT 20;
```

### Ver Conflitos Detectados:
```sql
SELECT * FROM public.sync_conflicts 
WHERE resolvido_em IS NULL;
```

### Ver Versões Sincronizadas:
```sql
SELECT * FROM public.sync_versions;
```

---

## 🚨 Cenários de Falha

### Supabase cai, PostgreSQL online ✅
- App continua funcionando com banco local
- Sincronização pausa automaticamente
- Quando Supabase volta, sincroniza mudanças

### PostgreSQL cai, Supabase online ✅
- App funciona com Supabase
- Sincronização pausa automaticamente
- Quando PostgreSQL volta, sincroniza mudanças

### Ambos caem ❌
- App não consegue sincronizar
- Componente `SyncStatusIndicator` mostra 🔴

---

## 🛠️ Resolução de Conflitos Manual

Quando há conflito, registra-se em `sync_conflicts`:

```sql
-- Ver conflito
SELECT * FROM public.sync_conflicts 
WHERE resolvido_em IS NULL 
LIMIT 1;

-- Resolver (elevar dados do Supabase)
UPDATE public.sync_conflicts 
SET resolvido_em = NOW(), resolucao = 'supabase_won'
WHERE id = 'id_do_conflito';
```

---

## 🔐 Segurança

- ✅ Credenciais no `.env` (não versionado)
- ✅ RLS do Supabase continua válido
- ✅ PostgreSQL local com autenticação
- ⚠️ **Não compartilhe `.env` com credenciais**

---

## 📱 Uso em Produção

### Recomendações:

1. **Use variáveis de ambiente seguras:**
   ```bash
   # Em produção, use variáveis do sistema/infra
   export POSTGRES_PASSWORD="$(aws secretsmanager...)"
   ```

2. **Configure frequência apropriada:**
   ```env
   SYNC_INTERVAL="60000"  # 1 minuto em produção
   ```

3. **Monitore `sync_logs`:**
   - Configurar alertas se sincronização parar
   - Limpar logs antigos periodicamente

4. **Backup automático:**
   - PostgreSQL local: `pg_dump`
   - Supabase: backups automáticos

---

## 🐛 Troubleshooting

### "Cannot connect to PostgreSQL"
```bash
# Verificar se PostgreSQL está rodando
psql -h localhost -U postgresql -d sgp_isp -c "SELECT 1"
```

### "Cannot connect to Supabase"
```bash
# Verificar credenciais no .env
echo $SUPABASE_URL
echo $SUPABASE_PUBLISHABLE_KEY
```

### "Sincronização parou"
- Verificar logs: `/api/sync/health`
- Verificar `sync_logs` no PostgreSQL
- Reiniciar servidor: `npm run dev`

---

## 📞 Suporte

Para mais informações:
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Supabase Docs: https://supabase.com/docs
- Node.js pg: https://node-postgres.com/
