import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;


/*** Tipo para registros sincronizáveis ***/
interface SyncRecord {

    id: string;

    updated_at: string;

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



    /*** Tabelas sincronizadas ***/
    private tables = [

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



        try {


            console.log(

                `[SYNC] Iniciando ciclo - ${new Date().toISOString()
                }`

            );




            for (const table of this.tables) {


                try {


                    await this.syncTable(
                        table
                    );


                } catch (err) {


                    console.error(

                        `[SYNC] Erro tabela ${table}:`,

                        err

                    );


                }


            }





            console.log(

                `[SYNC] Ciclo concluído - ${new Date().toISOString()
                }`

            );



        }
        finally {


            this.isSyncing = false;


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

            const sourceDate =
                new Date(sourceRecord.updated_at);



            const destinationDate =
                new Date(destRecord.updated_at);


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



                const { error } =
                    await this.supabase
                        .from(tableName)
                        .insert([record]);



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



                const fields =
                    Object.keys(record)
                        .filter(k => k !== 'id');




                const setClauses =
                    fields
                        .map(
                            (field, index) =>
                                `"${field}" = $${index + 2}`
                        )
                        .join(',');





                await this.pool.query(

                    `
                    UPDATE public."${tableName}"
                    SET ${setClauses}
                    WHERE id = $1
                    `,


                    [

                        record.id,

                        ...fields.map(
                            f => record[f]
                        )

                    ]

                );



            }
            else {



                const { error } =

                    await this.supabase

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



        try {


            console.warn(

                `[SYNC] Resolvendo conflito ${tableName}:${recordId}`

            );





            let winner:
                'source'
                |
                'destination';


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
                        data[0].ultima_sincronizacao
                    );


            }



        } catch {


            console.error(
                '[SYNC] Supabase offline'
            );


        }

        return health;


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
