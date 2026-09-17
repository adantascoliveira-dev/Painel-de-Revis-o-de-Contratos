import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a service role key: bypassa RLS. Só para uso server-side em
 * caminhos que já fizeram sua própria checagem de autorização (motor de regras
 * de estilo, worker de contexto do cliente, upload/download de Storage,
 * sincronização com Google Drive/ClickUp). Nunca importar em código que roda
 * no navegador nem devolver a resposta direto de uma rota sem antes validar
 * quem está pedindo.
 */
export function criarClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
