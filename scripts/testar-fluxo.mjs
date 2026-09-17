// Testa o ciclo de vida completo do documento (upload -> checagem -> revisão ->
// aprovação), a máquina de estados, o ajuste de offsets ao aplicar sinalizações,
// e a aplicação de RLS por papel (sócio/advogado/estagiário) contra um Postgres
// in-process (PGlite) com stubs de auth/storage equivalentes ao Supabase real.
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });

async function exec(sql) {
  return db.exec(sql);
}

async function asUser(userId, fn) {
  // SET LOCAL só vale dentro de uma transação em andamento; como cada exec()
  // aqui é autocommit, precisa ser SET de sessão mesmo (revertido no finally).
  await exec(`set role authenticated; set app.current_user_id = '${userId}';`);
  try {
    return await fn();
  } finally {
    await exec(`reset role; reset app.current_user_id;`);
  }
}

async function query(sql) {
  const res = await db.query(sql);
  return res.rows;
}

async function expectError(promise, matcher, label) {
  try {
    await promise;
  } catch (err) {
    const msg = String(err.message || err);
    if (matcher && !msg.includes(matcher)) {
      throw new Error(`[${label}] erro esperado continha "${matcher}" mas veio: ${msg}`);
    }
    console.log(`  ok (rejeitado como esperado): ${label}`);
    return;
  }
  throw new Error(`[${label}] deveria ter lançado erro e não lançou.`);
}

async function main() {
  await exec('create extension if not exists pgcrypto;');
  await exec('create extension if not exists pg_trgm;');

  await exec(`
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
      id text primary key, name text not null, public boolean not null default false, file_size_limit bigint
    );
  `);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await exec(sql);
  }
  console.log(`Schema aplicado (${files.length} migrações).\n`);

  // Réplica das GRANTs que o Supabase já provisiona por padrão em todo projeto
  // real (RLS é a única barreira lá; aqui simulamos o mesmo ambiente).
  await exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end $$;
    grant usage on schema public to authenticated;
    grant all on all tables in schema public to authenticated;
    grant all on all sequences in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
  `);

  console.log('--- Setup: usuários, cliente, tipo de peça ---');
  const [socio] = await query(`
    insert into auth.users (email, raw_user_meta_data)
    values ('anderson@bragadantas.com.br', '{"nome": "Anderson Dantas", "perfil": "socio"}'::jsonb)
    returning id;
  `);
  const [advogado] = await query(`
    insert into auth.users (email, raw_user_meta_data)
    values ('advogada@bragadantas.com.br', '{"nome": "Advogada Exemplo", "perfil": "advogado"}'::jsonb)
    returning id;
  `);
  const [estagiario] = await query(`
    insert into auth.users (email, raw_user_meta_data)
    values ('estagiario@bragadantas.com.br', '{"nome": "Estagiário Exemplo", "perfil": "estagiario"}'::jsonb)
    returning id;
  `);
  const socioId = socio.id, advogadoId = advogado.id, estagiarioId = estagiario.id;

  const [tipoPeca] = await query(`select id from tipos_peca where slug = 'contrato_parceria';`);
  const [cliente] = await query(`
    insert into clientes (nome, tipo, preferencias_negociadas)
    values ('Cliente Exemplo Ltda', 'empresa', '{"prazo_sigilo_minimo_meses": 24, "trava_incessibilidade": false}'::jsonb)
    returning id;
  `);

  console.log('--- RLS: estagiário só cria documento com autor_id = si mesmo ---');
  const textoOriginal = 'CLAUSULA 1. O PARCEIRO se compromete a atuar com diligência. Outrossim, fica certo que a CONTRATANTE pagará pontualmente.';

  await asUser(estagiarioId, async () => {
    const [doc] = await query(`
      insert into documentos (titulo, texto_extraido, texto_trabalho, tipo_peca_id, cliente_id, autor_id, socio_revisor_id)
      values ('Minuta de teste', '${textoOriginal}', '${textoOriginal}', '${tipoPeca.id}', '${cliente.id}', '${estagiarioId}', '${socioId}')
      returning id, status, versao;
    `);
    assert.equal(doc.status, 'rascunho');
    globalThis.__docId = doc.id;
    console.log('  ok: estagiário criou documento em rascunho, id=' + doc.id);

    await expectError(
      query(`
        insert into documentos (titulo, texto_extraido, texto_trabalho, tipo_peca_id, cliente_id, autor_id, socio_revisor_id)
        values ('Minuta de outra pessoa', 'x', 'x', '${tipoPeca.id}', '${cliente.id}', '${advogadoId}', '${socioId}')
        returning id;
      `),
      null,
      'estagiário não pode criar documento em nome de outra pessoa'
    );
  });

  const docId = globalThis.__docId;

  console.log('\n--- Máquina de estados ---');
  await asUser(estagiarioId, async () => {
    const [doc] = await query(`select * from transicionar_documento_status('${docId}', 'em_checagem');`);
    assert.equal(doc.status, 'em_checagem');
    console.log('  ok: estagiário move rascunho -> em_checagem');

    await expectError(
      query(`select * from transicionar_documento_status('${docId}', 'aguardando_socio');`),
      'não tem permissão',
      'estagiário sozinho não pode enviar direto ao sócio (precisa de advogado/sócio)'
    );
  });

  await asUser(advogadoId, async () => {
    const [doc] = await query(`select * from transicionar_documento_status('${docId}', 'aguardando_socio');`);
    assert.equal(doc.status, 'aguardando_socio');
    console.log('  ok: advogado aprova o envio ao sócio em nome do estagiário');
  });

  console.log('\n--- Correção direta do sócio + trilha imutável ---');
  await asUser(socioId, async () => {
    const [docAntes] = await query(`select texto_trabalho from documentos where id = '${docId}';`);
    const idx = docAntes.texto_trabalho.indexOf('Outrossim, fica certo que');
    const trecho = 'Outrossim, fica certo que';
    const [correcao] = await query(`
      select * from corrigir_diretamente(
        '${docId}', ${idx}, ${idx + trecho.length}, '${trecho}', 'Além disso,',
        null, 'juridiques_excesso', null
      );
    `);
    assert.equal(correcao.texto_depois, 'Além disso,');
    const [docDepois] = await query(`select texto_trabalho from documentos where id = '${docId}';`);
    assert.ok(docDepois.texto_trabalho.includes('Além disso, a CONTRATANTE'.split(' ')[0]));
    assert.ok(!docDepois.texto_trabalho.includes('Outrossim'));
    console.log('  ok: correção direta aplicada e refletida no texto de trabalho');
  });

  const [{ count: totalTransicoesAntes }] = await query(
    `select count(*)::int as count from documento_transicoes where documento_id = '${docId}';`
  );
  await asUser(advogadoId, async () => {
    // Sem política de DELETE para "authenticated", o RLS já barra por conta
    // própria (0 linhas afetadas, sem erro) — é a primeira camada de defesa.
    await query(`delete from documento_transicoes where documento_id = '${docId}';`);
  });
  const [{ count: totalTransicoesDepois }] = await query(
    `select count(*)::int as count from documento_transicoes where documento_id = '${docId}';`
  );
  assert.equal(totalTransicoesDepois, totalTransicoesAntes, 'RLS deveria ter impedido a exclusão (0 linhas afetadas)');
  console.log('  ok: RLS não expõe documento_transicoes para DELETE de "authenticated" (0 linhas afetadas)');

  // Segunda camada: mesmo com privilégio de dono de tabela (bypassando RLS,
  // como uma função SECURITY DEFINER com bug faria), o trigger de imutabilidade
  // ainda impede a alteração.
  await expectError(
    query(`delete from documento_transicoes where documento_id = '${docId}';`),
    'imutáveis',
    'trigger de imutabilidade bloqueia até quem bypassa RLS (dono da tabela)'
  );

  console.log('\n--- Sinalizações e ajuste de offsets ao aplicar em lote ---');
  const [docAtual] = await query(`select texto_trabalho from documentos where id = '${docId}';`);
  const texto = docAtual.texto_trabalho;
  const trechoA = 'diligência';
  const trechoB = 'pontualmente';
  const offA = texto.indexOf(trechoA);
  const offB = texto.indexOf(trechoB);
  assert.ok(offA >= 0 && offB > offA, 'pré-condição: os dois trechos de teste devem existir no texto e em ordem');

  await exec(`
    insert into sinalizacoes (documento_id, trecho_original, offset_inicio, offset_fim, categoria, natureza, sugestao_ajuste, justificativa, severidade, regra_estilo_id)
    values
      ('${docId}', '${trechoA}', ${offA}, ${offA + trechoA.length}, 'juridiques_excesso', 'estilo', 'zelo', 'termo mais direto', 'baixa',
        (select id from regras_estilo limit 1)),
      ('${docId}', '${trechoB}', ${offB}, ${offB + trechoB.length}, 'ruido_informacao_desnecessaria', 'estilo', 'em dia', 'mais direto', 'baixa',
        (select id from regras_estilo limit 1));
  `);

  await asUser(advogadoId, async () => {
    const [{ aplicar_sinalizacoes_em_lote: total }] = await query(`select aplicar_sinalizacoes_em_lote('${docId}');`);
    assert.equal(Number(total), 2);
  });

  const [docFinal] = await query(`select texto_trabalho from documentos where id = '${docId}';`);
  assert.ok(docFinal.texto_trabalho.includes('zelo'));
  assert.ok(docFinal.texto_trabalho.includes('em dia'));
  assert.ok(!docFinal.texto_trabalho.includes(trechoA));
  assert.ok(!docFinal.texto_trabalho.includes(trechoB));
  console.log('  ok: as duas sinalizações foram aplicadas corretamente mesmo com deslocamento de offsets entre elas');

  const sinalizacoesAplicadas = await query(
    `select offset_inicio, offset_fim from sinalizacoes where documento_id = '${docId}' and resolucao = 'aplicada' order by offset_inicio;`
  );
  for (const s of sinalizacoesAplicadas) {
    const trechoNoOffset = docFinal.texto_trabalho.slice(s.offset_inicio, s.offset_fim);
    assert.ok(
      trechoNoOffset === 'zelo' || trechoNoOffset === 'em dia',
      `offset_fim da sinalização deveria delimitar o texto recém-aplicado, mas [${s.offset_inicio},${s.offset_fim}) = "${trechoNoOffset}"`
    );
  }
  console.log('  ok: offset_fim de cada sinalização aplicada delimita corretamente o texto novo (não o antigo)');

  console.log('\n--- Aprovação e promoção a modelo ---');
  await asUser(advogadoId, async () => {
    await expectError(
      query(`select * from aprovar_documento('${docId}');`),
      'permissão',
      'advogado não pode aprovar (só o sócio designado)'
    );
  });

  await asUser(socioId, async () => {
    const [doc] = await query(`select * from aprovar_documento('${docId}');`);
    assert.equal(doc.status, 'aprovado');
    console.log('  ok: sócio aprova o documento');

    const [modelo] = await query(`
      select * from promover_documento_a_modelo('${docId}', 'MOD-TESTE-001', '[]'::jsonb, true);
    `);
    assert.equal(modelo.codigo, 'MOD-TESTE-001');
    console.log('  ok: sócio promove o documento aprovado a modelo genérico');
  });

  const [notif] = await query(`select * from notificacoes where usuario_id = '${estagiarioId}' and tipo = 'documento_aprovado';`);
  assert.ok(notif, 'estagiário deveria ter recebido notificação de aprovação');
  console.log('  ok: notificação de aprovação criada para o autor da minuta');

  console.log('\n--- Pedir ajuste exige observação e prazo ---');
  const [doc2] = await query(`
    insert into documentos (titulo, texto_extraido, texto_trabalho, tipo_peca_id, cliente_id, autor_id, socio_revisor_id)
    values ('Minuta 2', 'texto', 'texto', '${tipoPeca.id}', '${cliente.id}', '${advogadoId}', '${socioId}')
    returning id;
  `);
  await asUser(advogadoId, async () => {
    await query(`select * from transicionar_documento_status('${doc2.id}', 'em_checagem');`);
    await query(`select * from transicionar_documento_status('${doc2.id}', 'aguardando_socio');`);
  });
  await asUser(socioId, async () => {
    await expectError(
      query(`select * from pedir_ajuste_equipe('${doc2.id}', null, null);`),
      'observação e prazo',
      'pedir ajuste sem observação/prazo deve falhar'
    );
    const [doc] = await query(`select * from pedir_ajuste_equipe('${doc2.id}', 'Revisar cláusula de foro.', '2026-10-01');`);
    assert.equal(doc.status, 'em_ajuste_pela_equipe');
    console.log('  ok: pedir ajuste com observação e prazo funciona e muda o status');
  });

  console.log('\n--- Visibilidade por RLS (SELECT em documentos) ---');
  await asUser(estagiarioId, async () => {
    const rows = await query(`select id from documentos;`);
    assert.equal(rows.length, 1, 'estagiário só deve ver a própria minuta');
  });
  await asUser(advogadoId, async () => {
    const rows = await query(`select id from documentos;`);
    assert.equal(rows.length, 2, 'advogado vê a própria + a do estagiário');
  });
  await asUser(socioId, async () => {
    const rows = await query(`select id from documentos;`);
    assert.equal(rows.length, 2, 'sócio vê todas as minutas');
  });
  console.log('  ok: visibilidade por papel confere');

  console.log('\n--- Reconciliação: só o sócio confirma ---');
  const [fonte] = await query(`
    insert into fontes_reconciliacao (cliente_candidato_nome, fonte, referencia_externa_id, dados_brutos)
    values ('Cliente Exemplo LTDA (Drive)', 'google_drive', 'drive-folder-123', '{}'::jsonb)
    returning id;
  `);
  await asUser(advogadoId, async () => {
    await expectError(
      query(`select * from confirmar_reconciliacao('${fonte.id}', '${cliente.id}');`),
      'Só o sócio',
      'advogado não pode confirmar reconciliação'
    );
  });
  await asUser(socioId, async () => {
    const [confirmado] = await query(`select * from confirmar_reconciliacao('${fonte.id}', '${cliente.id}');`);
    assert.equal(confirmado.status, 'confirmado');
    console.log('  ok: sócio confirma reconciliação e vincula ao cliente existente');
  });

  console.log('\n--- Perfil (Tela 4): advogado não vê perfil de outra pessoa ---');
  await asUser(advogadoId, async () => {
    const rows = await query(`select usuario_id from vw_perfil_usuario;`);
    const ids = rows.map((r) => r.usuario_id);
    assert.ok(ids.includes(advogadoId));
    assert.ok(!ids.includes(estagiarioId), 'advogado não deveria ver o perfil do estagiário na Tela 4');
  });
  await asUser(socioId, async () => {
    const rows = await query(`select usuario_id from vw_perfil_usuario;`);
    assert.equal(rows.length, 3, 'sócio vê o perfil de todo mundo');
  });
  console.log('  ok: regra de visibilidade de perfil confere');

  console.log('\nTodos os cenários passaram.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nFALHA:', err);
    process.exit(1);
  });
