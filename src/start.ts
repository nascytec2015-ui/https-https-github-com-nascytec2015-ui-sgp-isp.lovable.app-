import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Middleware para inicializar sincronização no servidor
const syncMiddleware = createMiddleware().server(async ({ next }) => {
  // Importar apenas no servidor
  try {
    const { initializeSync } = await import("./server/sync-routes");
    await initializeSync();
  } catch (err) {
    console.error("[SYNC] Erro ao inicializar sincronização:", err);
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [syncMiddleware, errorMiddleware],
}));
