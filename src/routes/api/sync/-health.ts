import { handleSyncHealth } from '../../../server/sync-routes';

// Servir endpoint de API diretamente
export default async function handler(request: Request) {
    if (request.method === 'GET') {
        return await handleSyncHealth();
    }
    return new Response('Method not allowed', { status: 405 });
}
