import { handleSyncHealth } from '../../../server/sync-routes';

export async function GET() {
    return handleSyncHealth();
}
