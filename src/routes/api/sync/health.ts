import { handleSyncHealth } from '../../../server/sync-routes';

export const Route = {
    async GET() {
        return handleSyncHealth();
    },
};