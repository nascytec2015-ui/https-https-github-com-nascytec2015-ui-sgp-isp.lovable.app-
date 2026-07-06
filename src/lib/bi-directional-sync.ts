import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;

// Tipo para dados sincronizáveis
interface SyncRecord {
    id: string;
    updated_at: string;
    [key: string]: any;
}

interface SyncConfig {
    postgresHost: string;
    postgresPort: number;
    postgresUser: string;
    postgresPassword: string;
    postgresDB: string;
    supabaseUrl: string;
    supabaseKey: string;
    syncInterval: number;
    syncPriority: 'supabase' | 'local';
}

class BiDirectionalSync {
    private pool: pg.Pool;
    private supabase: ReturnType<typeof createClient>;
    private config: SyncConfig;
    private syncTimer: NodeJS.Timer | null = null;
    private isSyncing = false;

    private tables = [
        'profiles',
        'user_roles',
        'planos',
        'clientes',
        'ordens_servico',
        'os_materiais',
        'projetos_ftth'
    ];

    constructor(config: SyncConfig) {
        this.config = config;

        // Inicializar pool PostgreSQL
        this.pool = new Pool({
            host: config.postgresHost,
            port: config.postgresPort,
            user: config.postgresUser,
            password: config.postgresPassword,
            database: config.postgresDB,
        });

        // Inicializar cliente Supabase
        this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }

    /**
     * Iniciar sincronização periódica
     */
    async start() {
        console.log('[SYNC] Iniciando sincronização bidirecional...');

        // Executar uma sincronização imediatamente
        await this.sync();

        // Depois, agendar sincronizações periódicas
        this.syncTimer = setInterval(() => {
            this.sync().catch(err =>
                console.error('[SYNC] Erro na sincronização periódica:', err)
            );
        }, this.config.syncInterval);
    }

    /**
     * Parar sincronização
     */
    stop() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        console.log('[SYNC] Sincronização parada');
    }

    /**
     * Executar ciclo completo de sincronização
     */
    private async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            console.log(`[SYNC] Iniciando ciclo de sincronização - ${new Date().toISOString()}`);

            for (const table of this.tables) {
                try {
                    await this.syncTable(table);
                } catch (err) {
                    console.error(`[SYNC] Erro ao sincronizar tabela ${table}:`, err);
                    // Continuar com próximas tabelas mesmo se uma falhar
                }
            }

            console.log(`[SYNC] Ciclo concluído - ${new Date().toISOString()}`);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Sincronizar uma tabela específica
     */
    private async syncTable(tableName: string) {
        try {
            // Buscar registros do Supabase
            const { data: supabaseData, error: supabaseError } = await this.supabase
                .from(tableName)
                .select('*');

            if (supabaseError) throw supabaseError;

            // Buscar registros do PostgreSQL local
            const localResult = await this.pool.query(
                `SELECT * FROM public."${tableName}"`
            );
            const localData = localResult.rows;

            // Sincronizar Supabase → Local
            await this.syncDirection(tableName, supabaseData || [], localData, 'supabase-to-local');

            // Sincronizar Local → Supabase
            await this.syncDirection(tableName, localData, supabaseData || [], 'local-to-supabase');

            console.log(`[SYNC] Tabela ${tableName} sincronizada`);
        } catch (err) {
            console.error(`[SYNC] Erro ao sincronizar ${tableName}:`, err);
        }
    }

    /**
     * Sincronizar direção (origem → destino)
     */
    private async syncDirection(
        tableName: string,
        source: SyncRecord[],
        destination: SyncRecord[],
        direction: string
    ) {
        const destMap = new Map(destination.map(r => [r.id, r]));

        for (const sourceRecord of source) {
            const destRecord = destMap.get(sourceRecord.id);

            if (!destRecord) {
                // Registro existe apenas na origem - inserir no destino
                await this.insertRecord(tableName, sourceRecord, direction);
            } else if (new Date(sourceRecord.updated_at) > new Date(destRecord.updated_at)) {
                // Registro foi atualizado na origem - atualizar no destino
                await this.updateRecord(tableName, sourceRecord, direction);
            } else if (new Date(sourceRecord.updated_at) !== new Date(destRecord.updated_at)) {
                // Conflito - registrar para manual resolution
                await this.recordConflict(tableName, sourceRecord.id, sourceRecord, destRecord);
            }
        }
    }

    /**
     * Inserir novo registro no destino
     */
    private async insertRecord(tableName: string, record: SyncRecord, direction: string) {
        try {
            if (direction === 'supabase-to-local') {
                // Inserir no PostgreSQL local
                const cols = Object.keys(record).join(', ');
                const vals = Object.values(record).map((_, i) => `$${i + 1}`).join(', ');
                await this.pool.query(
                    `INSERT INTO public."${tableName}" (${cols}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING`,
                    Object.values(record)
                );
            } else {
                // Inserir no Supabase
                const { error } = await this.supabase
                    .from(tableName)
                    .insert([record]);

                if (error) throw error;
            }

            await this.logSync(tableName, 'INSERT', record.id, 'success', direction);
        } catch (err) {
            console.error(`[SYNC] Erro ao inserir ${tableName}:`, err);
            await this.logSync(tableName, 'INSERT', record.id, 'error', direction);
        }
    }

    /**
     * Atualizar registro no destino
     */
    private async updateRecord(tableName: string, record: SyncRecord, direction: string) {
        try {
            if (direction === 'supabase-to-local') {
                // Atualizar no PostgreSQL local
                const setClauses = Object.keys(record)
                    .filter(k => k !== 'id')
                    .map((k, i) => `"${k}" = $${i + 2}`)
                    .join(', ');

                await this.pool.query(
                    `UPDATE public."${tableName}" SET ${setClauses} WHERE id = $1`,
                    [record.id, ...Object.values(record).filter((_, i) => i !== 0)]
                );
            } else {
                // Atualizar no Supabase
                const { error } = await this.supabase
                    .from(tableName)
                    .update(record)
                    .eq('id', record.id);

                if (error) throw error;
            }

            await this.logSync(tableName, 'UPDATE', record.id, 'success', direction);
        } catch (err) {
            console.error(`[SYNC] Erro ao atualizar ${tableName}:`, err);
            await this.logSync(tableName, 'UPDATE', record.id, 'error', direction);
        }
    }

    /**
     * Registrar conflito para resolução manual
     */
    private async recordConflict(
        tableName: string,
        recordId: string,
        source: SyncRecord,
        destination: SyncRecord
    ) {
        try {
            await this.pool.query(
                `INSERT INTO public.sync_conflicts (tabela, registro_id, supabase_data, local_data)
         VALUES ($1, $2, $3, $4)`,
                [tableName, recordId, JSON.stringify(source), JSON.stringify(destination)]
            );
            console.warn(`[SYNC] Conflito registrado em ${tableName}:${recordId}`);
        } catch (err) {
            console.error('[SYNC] Erro ao registrar conflito:', err);
        }
    }

    /**
     * Log de sincronização
     */
    private async logSync(
        tableName: string,
        operacao: string,
        pk: string,
        status: string,
        direction: string
    ) {
        try {
            await this.pool.query(
                `INSERT INTO public.sync_logs (tabela, operacao, pk, origem)
         VALUES ($1, $2, $3, $4)`,
                [tableName, `${operacao}:${status}`, pk, direction]
            );
        } catch (err) {
            console.error('[SYNC] Erro ao registrar log:', err);
        }
    }

    /**
     * Verificar saúde da sincronização
     */
    async checkHealth(): Promise<{
        postgres: boolean;
        supabase: boolean;
        lastSync: Date | null;
    }> {
        const health = {
            postgres: false,
            supabase: false,
            lastSync: null as Date | null
        };

        try {
            const res = await this.pool.query('SELECT NOW()');
            health.postgres = !!res.rows[0];
        } catch {
            console.error('[SYNC] PostgreSQL indisponível');
        }

        try {
            const { data } = await this.supabase.from('sync_versions').select('ultima_sincronizacao').limit(1);
            health.supabase = !!data;
            if (data?.[0]) {
                health.lastSync = new Date(data[0].ultima_sincronizacao);
            }
        } catch {
            console.error('[SYNC] Supabase indisponível');
        }

        return health;
    }

    /**
     * Encerrar conexões
     */
    async close() {
        this.stop();
        await this.pool.end();
    }
}

export default BiDirectionalSync;
export type { SyncConfig, SyncRecord };
