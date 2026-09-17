import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Sem o genérico Database<> de propósito: o formato exato exigido pelo
// supabase-js (Insert/Update/Relationships por tabela) só existe de verdade
// depois de `supabase gen types typescript --linked` contra um projeto real.
// Os serviços em src/lib/services tipam entrada/saída com as interfaces de
// src/types/database.types.ts nos pontos onde isso importa.

/**
 * Cliente Supabase para rotas/Server Components, autenticado como o usuário da
 * sessão atual. Todo acesso a dados passa pelas políticas de RLS deste usuário.
 */
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Chamado a partir de um Server Component sem permissão de escrita
            // de cookies; o middleware cuida de renovar a sessão nesse caso.
          }
        },
      },
    }
  );
}
