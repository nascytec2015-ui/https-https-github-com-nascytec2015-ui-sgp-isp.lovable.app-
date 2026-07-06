import { useEffect, useState } from 'react';

interface SyncHealth {
    postgres: boolean;
    supabase: boolean;
    lastSync: Date | null;
    isSyncing: boolean;
}

const defaultHealth: SyncHealth = {
    postgres: false,
    supabase: false,
    lastSync: null,
    isSyncing: false
};

/**
 * Hook para monitorar o status da sincronização
 */
export function useSyncStatus() {
    const [health, setHealth] = useState<SyncHealth>(defaultHealth);

    useEffect(() => {
        // Verificar saúde a cada 5 segundos
        const interval = setInterval(async () => {
            try {
                const response = await fetch('/api/sync/health');
                if (response.ok) {
                    const data = await response.json();
                    setHealth(data);
                }
            } catch (err) {
                console.error('Erro ao verificar sincronização:', err);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return health;
}

/**
 * Componente visual do status de sincronização
 */
export function SyncStatusIndicator() {
    const health = useSyncStatus();

    const getStatusIcon = () => {
        if (!health.postgres && !health.supabase) {
            return '🔴'; // Ambos offline
        }
        if (health.postgres && health.supabase) {
            return '🟢'; // Ambos online
        }
        return '🟡'; // Um offline
    };

    const getStatusText = () => {
        if (!health.postgres && !health.supabase) {
            return 'Sem conexão';
        }
        if (health.postgres && health.supabase) {
            return 'Sincronizado';
        }
        return health.postgres ? 'Só Local' : 'Só Supabase';
    };

    const getDetailText = () => {
        const parts = [];
        if (health.postgres) parts.push('PostgreSQL ✓');
        else parts.push('PostgreSQL ✗');

        if (health.supabase) parts.push('Supabase ✓');
        else parts.push('Supabase ✗');

        if (health.lastSync) {
            const diff = Math.round((Date.now() - health.lastSync.getTime()) / 1000);
            parts.push(`Último sync: ${diff}s atrás`);
        }

        return parts.join(' • ');
    };

    return (
        <div className="flex items-center gap-2 px-3 py-1 text-xs rounded-full bg-muted">
            <span className="text-lg">{getStatusIcon()}</span>
            <div>
                <div className="font-semibold">{getStatusText()}</div>
                <div className="text-muted-foreground text-xs">{getDetailText()}</div>
            </div>
        </div>
    );
}

export default useSyncStatus;
