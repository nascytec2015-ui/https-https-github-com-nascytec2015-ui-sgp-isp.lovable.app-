import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;


/*** Tipo para registros sincronizáveis ***/
interface SyncRecord {

    id: string;

    updated_at?: string | null;

    created_at?: string | null;

    [key: string]: any;
}

/*** Configuração do sincronizador ***/
interface SyncConfig {

    postgresHost: string;

    postgresPort: number;

    postgresUser: string;

    postgresPassword: string;

    postgresDB: string;


    supabaseUrl: string;

    supabaseKey: string;


    syncInterval: number;


    /*** Quem vence em caso de empate ***/
    syncPriority: 'supabase' | 'local';

}


class BiDirectionalSync {


    private pool: pg.Pool;


    private supabase: ReturnType<typeof createClient>;


    private config: SyncConfig;


    private syncTimer: NodeJS.Timeout | null = null;


    private isSyncing = false;

    private syncStartTime: number = 0;

    private syncStats = {

        tabelas: 0,

        ok: 0,

        conflitos: 0,

        erros: 0

    };

    /*** Tabelas sincronizadas ***/
    private tables = [

        'users',

        'profiles',

        'user_roles',

        'planos',

        'clientes',

        'ordens_servico',

        'os_materiais',

        'os_evidencias',

        'projetos_ftth'

    ];

    constructor(config: SyncConfig) {


        this.config = config;


        /*** PostgreSQL local ***/
        this.pool = new Pool({

            host: config.postgresHost,

            port: config.postgresPort,

            user: config.postgresUser,

            password: config.postgresPassword,

            database: config.postgresDB

        });



        /*** Supabase ***/
        this.supabase = createClient(

            config.supabaseUrl,

            config.supabaseKey

        );


    }


    /*** Iniciar sincronização automática  ***/
    async start() {


        console.log(
            '[SYNC] Iniciando sincronização bidirecional...'
        );



        // sincronização imediata
        await this.sync();



        // sincronização periódica

        this.syncTimer = setInterval(() => {


            this.sync()
                .catch(err => {


                    console.error(
                        '[SYNC] Erro no ciclo:',
                        err
                    );


                });


        }, this.config.syncInterval);


    }

    /*** Parar sincronização ***/
    stop() {


        if (this.syncTimer) {


            clearInterval(
                this.syncTimer
            );


            this.syncTimer = null;


        }



        console.log(
            '[SYNC] Sincronização parada'
        );


    }

    /*** Executa ciclo completo ***/
    private async sync() {

        if (this.isSyncing) {

            return;

        }

        this.isSyncing = true;

        // Inicia contador do tempo ANTES de atualizar o status
        this.syncStartTime = Date.now();


        this.syncStats = {

            tabelas: 0,

            ok: 0,

            conflitos: 0,

            erros: 0

        };


        try {


            await this.updateSyncStatus('running');


            console.log(

                `[SYNC] Iniciando ciclo - ${new Date().toISOString()}`

            );


            for (const table of this.tables) {

                try {


                    await this.syncTable(table);


                    this.syncStats.tabelas++;

                    this.syncStats.ok++;


                } catch (err) {


                    this.syncStats.erros++;


                    console.error(

                        `[SYNC] Erro tabela ${table}`,

                        err

                    );


                }

            }


            await this.updateSyncStatus('online');


            console.log(

                `[SYNC] Ciclo concluído - ${new Date().toISOString()}`

            );


        } catch (err) {


            this.syncStats.erros++;


            console.error(

                '[SYNC] Erro geral no ciclo:',

                err

            );


            await this.updateSyncStatus('error');


        }
        finally {


            this.isSyncing = false;

            // limpa contador para evitar reutilização
            this.syncStartTime = 0;


        }


    }

    /*** Sincronizar uma tabela específica ***/
    private async syncTable(tableName: string) {

        try {


            // Buscar dados Supabase

            const { data: supabaseData, error: supabaseError } =
                await this.supabase
                    .from(tableName)
                    .select('*');

            if (supabaseError) {

                throw supabaseError;

            }

            // Buscar dados PostgreSQL

            const localResult = await this.pool.query(

                `SELECT * FROM public."${tableName}"`

            );

            const localData = localResult.rows;


            /*** Supabase → PostgreSQL ***/
            await this.syncDirection(

                tableName,

                supabaseData || [],

                localData,

                'supabase-to-local'

            );

            /*** PostgreSQL → Supabase ***/
            await this.syncDirection(

                tableName,

                localData,

                supabaseData || [],

                'local-to-supabase'

            );

            console.log(

                `[SYNC] Tabela ${tableName} sincronizada`

            );

        } catch (err) {


            console.error(

                `[SYNC] Erro sincronizando ${tableName}:`,

                err

            );


        }

    }

    /*** Sincronização direção origem → destino ** Resolve conflito automaticamente ***/
    private async syncDirection(

        tableName: string,

        source: SyncRecord[],

        destination: SyncRecord[],

        direction: string

    ) {

        const destMap = new Map(

            destination.map(r => [r.id, r])

        );

        for (const sourceRecord of source) {

            const destRecord =
                destMap.get(sourceRecord.id);


            // Registro novo

            if (!destRecord) {

                await this.insertRecord(

                    tableName,

                    sourceRecord,

                    direction

                );

                continue;

            }

            const sourceTimestamp =
                sourceRecord.updated_at ??
                sourceRecord.created_at;

            const destinationTimestamp =
                destRecord.updated_at ??
                destRecord.created_at;

            if (!sourceTimestamp || !destinationTimestamp) {
                continue;
            }

            const sourceDate = new Date(sourceTimestamp);
            const destinationDate = new Date(destinationTimestamp);

            // ===== DEBUG =====
            console.log(
                `[SYNC-DEBUG] ${tableName}:${sourceRecord.id}`
            );
            console.log(
                `   source      = ${sourceRecord.updated_at}`
            );
            console.log(
                `   destination = ${destRecord.updated_at}`
            );
            console.log(
                `   diff(ms)    = ${sourceDate.getTime() - destinationDate.getTime()
                }`
            );
            // =================

            const diff = Math.abs(
                sourceDate.getTime() - destinationDate.getTime()
            );

            // Ignora diferenças menores que 1 segundo
            if (diff < 1000) {
                continue;
            }

            /*** Origem mais atual ***/
            if (sourceDate > destinationDate) {

                await this.updateRecord(
                    tableName,
                    sourceRecord,
                    direction
                );

                continue;
            }

            /*** Destino mais atual *** Nada para fazer ***/

            if (destinationDate > sourceDate) {

                continue;

            }

            /*** Mesmo horário ** Verificar diferença real ***/

            const sourceJson =
                JSON.stringify(sourceRecord);

            const destinationJson =
                JSON.stringify(destRecord);

            if (sourceJson !== destinationJson) {

                await this.resolveConflict(

                    tableName,

                    sourceRecord.id,

                    sourceRecord,

                    destRecord,

                    direction

                );


            }


        }


    }

    /*** Inserir registro ***/
    private async insertRecord(

        tableName: string,

        record: SyncRecord,

        direction: string

    ) {

        try {

            if (direction === 'supabase-to-local') {

                const columns =
                    Object.keys(record)
                        .map(c => `"${c}"`)
                        .join(',');

                const values =
                    Object.values(record)
                        .map((_, i) => `$${i + 1}`)
                        .join(',');

                // Garantir dependências antes de inserir
                if (tableName === 'profiles') {

                    const check = await this.pool.query(
                        `SELECT 1 FROM public.users WHERE id = $1`,
                        [record.id]
                    );

                    if (check.rowCount === 0) {

                        console.warn(
                            `[SYNC] Pulando profile ${record.id}: usuário não existe`
                        );

                        return;
                    }
                }

                if (tableName === 'user_roles') {

                    const check = await this.pool.query(
                        `SELECT 1 FROM public.users WHERE id = $1`,
                        [record.user_id]
                    );

                    if (check.rowCount === 0) {

                        console.warn(
                            `[SYNC] Pulando user_role ${record.user_id}: usuário não existe`
                        );

                        return;
                    }
                }

                await this.pool.query(
                    `
    INSERT INTO public."${tableName}"
    (${columns})
    VALUES (${values})
    ON CONFLICT(id) DO NOTHING
    `,
                    Object.values(record)
                );
            }
            else {


                const {
                    
                    ...updateData
                } = record;


                const { error } =

                    await (this.supabase as any)

                        .from(tableName)

                        .update(updateData)

                        .eq(
                            'id',
                            record.id
                        );


                if (error) {

                    throw error;

                }


            }

            await this.logSync(

                tableName,

                'INSERT',

                record.id,

                'success',

                direction

            );


        } catch (err) {



            console.error(

                `[SYNC] Erro insert ${tableName}`,

                err

            );


            await this.logSync(

                tableName,

                'INSERT',

                record.id,

                'error',

                direction

            );



        }


    }

    /*** Atualizar registro no destino ***/
    private async updateRecord(

        tableName: string,

        record: SyncRecord,

        direction: string

    ) {

        try {


            if (direction === 'supabase-to-local') {

                const {
                    ...updateData
                } = record;

                const fields = Object.keys(updateData).filter(k => k !== "id");

                const setClauses = fields
                    .map((field, index) => `"${field}" = $${index + 2}`)
                    .join(",");

                await this.pool.query(
                    `
    UPDATE public."${tableName}"
    SET ${setClauses}
    WHERE id = $1
    `,
                    [
                        record.id,
                        ...fields.map(f => updateData[f])
                    ]
                );

            }
            else {

                const { error } =

                    await (this.supabase as any)

                        .from(tableName)

                        .update(record)

                        .eq(
                            'id',
                            record.id
                        );

                if (error) {

                    throw error;

                }



            }


            await this.logSync(

                tableName,

                'UPDATE',

                record.id,

                'success',

                direction

            );




        } catch (err) {



            console.error(

                `[SYNC] Erro update ${tableName}:`,

                err

            );



            await this.logSync(

                tableName,

                'UPDATE',

                record.id,

                'error',

                direction

            );



        }


    }

    /*** Resolver conflito automaticamente ***/
    private async resolveConflict(

        tableName: string,

        recordId: string,

        source: SyncRecord,

        destination: SyncRecord,

        direction: string

    ) {

        if (tableName === "users") {
            return;
        }

        try {

            console.warn(
                `[SYNC] Resolvendo conflito ${tableName}:${recordId}`
            );

            const sourceUpdated =
                source.updated_at ??
                source.created_at ??
                null;

            const destinationUpdated =
                destination.updated_at ??
                destination.created_at ??
                null;

            if (!sourceUpdated || !destinationUpdated) {
                return;
            }

            let winner: 'source' | 'destination';

            


            /*** Regra:** supabase = Supabase vence ** local = PostgreSQL vence ***/


            if (this.config.syncPriority === 'supabase') {



                winner =
                    direction === 'supabase-to-local'
                        ? 'source'
                        : 'destination';



            }
            else {



                winner =
                    direction === 'local-to-supabase'
                        ? 'source'
                        : 'destination';



            }

            if (winner === 'source') {



                await this.updateRecord(

                    tableName,

                    source,

                    direction

                );



            }
            else {



                const reverseDirection =

                    direction === 'supabase-to-local'

                        ?

                        'local-to-supabase'

                        :

                        'supabase-to-local';


                await this.updateRecord(

                    tableName,

                    destination,

                    reverseDirection

                );



            }


            // Guardar histórico

            await this.recordConflict(

                tableName,

                recordId,

                source,

                destination

            );



            console.log(

                `[SYNC] Conflito resolvido ${tableName}:${recordId} vencedor=${winner}`

            );


        } catch (err) {



            console.error(

                '[SYNC] Erro resolver conflito:',

                err

            );


        }


    }


    /*** Registrar conflito para auditoria ***/
    private async recordConflict(

        tableName: string,

        recordId: string,

        source: SyncRecord,

        destination: SyncRecord

    ) {



        try {



            await this.pool.query(

                `
                INSERT INTO public.sync_conflicts
                (
                    tabela,
                    registro_id,
                    supabase_data,
                    local_data
                )

                VALUES($1,$2,$3,$4)
                `,


                [

                    tableName,

                    recordId,

                    JSON.stringify(source),

                    JSON.stringify(destination)

                ]

            );




            console.warn(

                `[SYNC] Conflito registrado ${tableName}:${recordId}`

            );



        } catch (err) {



            console.error(

                '[SYNC] Erro registrar conflito:',

                err

            );


        }


    }

    /*** Log sincronização ***/
    private async logSync(

        tableName: string,

        operacao: string,

        pk: string,

        status: string,

        direction: string

    ) {


        try {


            await this.pool.query(

                `
                INSERT INTO public.sync_logs
                (
                    tabela,
                    operacao,
                    pk,
                    origem
                )

                VALUES($1,$2,$3,$4)
                `,


                [

                    tableName,

                    `${operacao}:${status}`,

                    pk,

                    direction

                ]

            );



        } catch (err) {



            console.error(

                '[SYNC] Erro log:',

                err

            );


        }


    }

    /*** Saúde do sincronizador ***/
    async checkHealth() {



        const health = {


            postgres: false,


            supabase: false,


            lastSync: null as Date | null


        };


        try {


            const result =
                await this.pool.query(
                    'SELECT NOW()'
                );



            health.postgres =
                !!result.rows[0];



        } catch {


            console.error(
                '[SYNC] PostgreSQL offline'
            );


        }

        try {


            const { data } =

                await this.supabase

                    .from('sync_versions')

                    .select('ultima_sincronizacao')

                    .limit(1);


            health.supabase =
                !!data;

            if (data?.[0]) {


                health.lastSync =
                    new Date(
                        (data[0] as any).ultima_sincronizacao
                    ); 


            }



        } catch {


            console.error(
                '[SYNC] Supabase offline'
            );


        }

        return health;


    }

    private async updateSyncStatus(status: string) {

        try {


            const tempo =
                Date.now() - this.syncStartTime;



            await this.pool.query(

                `
            UPDATE public.sync_status

            SET

            ultima_execucao = NOW(),

            status = $1,

            tabelas_processadas = $2,

            tabelas_ok = $3,

            conflitos_resolvidos = $4,

            erros = $5,

            tempo_execucao = $6

            WHERE id = 1
            `,


                [

                    status,

                    this.syncStats.tabelas,

                    this.syncStats.ok,

                    this.syncStats.conflitos,

                    this.syncStats.erros,

                    tempo

                ]

            );


        } catch (err) {

            console.error(
                '[SYNC] Erro atualizando status:',
                err
            );

        }

    }

    /*** Fechar conexões ***/
    async close() {



        this.stop();



        await this.pool.end();



    }



}

export default BiDirectionalSync;


export type {

    SyncConfig,

    SyncRecord

};
