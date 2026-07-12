import BiDirectionalSync from '../lib/bi-directional-sync';
import type { SyncConfig } from '../lib/bi-directional-sync';

let syncService: BiDirectionalSync | null = null;
let isInitialized = false;

/**
 * Inicializar o serviço de sincronização
 */
export async function initializeSync() {
    if (isInitialized) {
        console.log('[SYNC-API] Serviço já inicializado');
        return;
    }

    try {
        const config: SyncConfig = {
            postgresHost: process.env.POSTGRES_HOST || 'localhost',
            postgresPort: parseInt(process.env.POSTGRES_PORT || '5432'),
            postgresUser: process.env.POSTGRES_USER || 'postgresql',
            postgresPassword: process.env.POSTGRES_PASSWORD || '',
            postgresDB: process.env.POSTGRES_DB || 'sgp_isp',
            supabaseUrl: process.env.SUPABASE_URL || '',
            supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            syncInterval: parseInt(process.env.SYNC_INTERVAL || '30000'),
            syncPriority: (process.env.SYNC_PRIORITY as 'supabase' | 'local') || 'supabase',
        };

        console.log('[SYNC-API] Inicializando sincronização com config:', {
            host: config.postgresHost,
            port: config.postgresPort,
            db: config.postgresDB,
            interval: config.syncInterval,
            priority: config.syncPriority
        });

        syncService = new BiDirectionalSync(config);
        await syncService.start();
        isInitialized = true;

        console.log('[SYNC-API] Serviço de sincronização ativo');
    } catch (err) {
        console.error('[SYNC-API] Erro ao inicializar sincronização:', err);
        throw err;
    }
}

/**
 * API: GET /api/sync/health
 * Verificar saúde da sincronização
 */
export async function handleSyncHealth() {
    if (!syncService) {
        return new Response(JSON.stringify({
            postgres: false,
            supabase: false,
            lastSync: null,
            isSyncing: false,
            error: 'Serviço não inicializado'
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const health = await syncService.checkHealth();
        return new Response(JSON.stringify({
            ...health,
            isSyncing: false,
            timestamp: new Date().toISOString()
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        console.error('[SYNC-API] Erro ao verificar saúde:', err);
        return new Response(JSON.stringify({
            error: 'Erro ao verificar sincronização'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

/**
 * Parar o serviço de sincronização
 */
export async function stopSync() {
    if (syncService) {
        await syncService.close();
        syncService = null;
        isInitialized = false;
        console.log('[SYNC-API] Serviço de sincronização parado');
    }
}

export default initializeSync;

