// Aplica todas as migrações de supabase/migrations/ contra um Postgres in-process
// (PGlite), com um schema "auth"/"storage" mínimo simulando o que o Supabase real
// fornece. Serve para validar sintaxe e integridade referencial sem precisar de
// Docker/Supabase CLI local. Não substitui testar contra um projeto Supabase real.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const seedFile = path.join(process.cwd(), 'supabase', 'seed.sql');
const seedExampleFile = path.join(process.cwd(), 'supabase', 'seed.example.sql');

const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });

const stub = `
create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint
);
`;

async function main() {
  console.log('Ativando extensões base (pgcrypto, pg_trgm)...');
  await db.exec('create extension if not exists pgcrypto;');
  await db.exec('create extension if not exists pg_trgm;');

  console.log('Criando stubs de auth/storage...');
  await db.exec(stub);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  console.log(`Encontradas ${files.length} migrações.`);

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    process.stdout.write(`Aplicando ${file} ... `);
    try {
      await db.exec(sql);
      console.log('OK');
    } catch (err) {
      console.log('FALHOU');
      console.error(err);
      process.exit(1);
    }
  }

  console.log('\nTodas as migrações aplicaram sem erro.');

  const arquivoSeed = await access(seedFile).then(() => seedFile).catch(() => null)
    ?? await access(seedExampleFile).then(() => seedExampleFile).catch(() => null);
  if (arquivoSeed) {
    process.stdout.write(`Aplicando ${path.basename(arquivoSeed)} ... `);
    await db.exec(await readFile(arquivoSeed, 'utf8'));
    console.log('OK');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
