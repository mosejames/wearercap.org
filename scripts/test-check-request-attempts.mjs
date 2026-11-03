// Local PostgreSQL engine only. No network, production connection or notifications.
// Install @electric-sql/pglite outside the repo and set CR_PGLITE_MODULE if needed.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.CR_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema cr_private;
    grant usage on schema cr_private,auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.cr_requests(id uuid primary key, owner_id uuid, reference bigint unique);
    create table public.cr_history(request_id uuid);
    -- Transaction-failure fixture: both request and history must roll back.
    create function public.cr_attempt_test_failure() returns void language plpgsql as $$begin
      insert into public.cr_requests values('20000000-0000-4000-8000-000000000001',auth.uid(),99);
      insert into public.cr_history values('20000000-0000-4000-8000-000000000001');
      raise exception 'fixture submission failure' using errcode='23514';
    end$$;
    insert into public.cr_requests values('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',42),
      ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',43);`);
  const migration = (await fs.readdir(new URL('../supabase/migrations/', import.meta.url))).find(n => n.endsWith('_check_request_attempt_diagnostics.sql'));
  await db.exec(await fs.readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'));
  const event = { attempt_id: '30000000-0000-4000-8000-000000000001', correlation_id: '40000000-0000-4000-8000-000000000001', sequence: 1, stage: 'submit', outcome: 'started', error_code: null, reference: null };
  const log = e => db.query('select public.cr_log_attempt($1::jsonb)', [JSON.stringify(e)]);
  await db.exec(`select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);set role authenticated;`);
  await log(event); // First independent committed request.
  await db.exec('reset role; begin;');
  await assert.rejects(db.query('select public.cr_attempt_test_failure()'), /fixture submission failure/);
  await db.exec('rollback; set role authenticated;');
  await log({ ...event, sequence: 2, outcome: 'failed', error_code: '23514' }); // After rollback.
  await log({ ...event, sequence: 2, outcome: 'failed', error_code: '23514' }); // Transport replay.
  await assert.rejects(db.query('select * from cr_private.attempt_events'), /permission denied/);
  await assert.rejects(db.exec('delete from cr_private.attempt_events'), /permission denied/);
  await assert.rejects(db.exec(`insert into cr_private.attempt_events(attempt_id) values(gen_random_uuid())`), /permission denied/);
  await assert.rejects(log({ ...event, sequence: 3, message: 'private payload' }), /Invalid diagnostic fields/);
  await assert.rejects(log({ ...event, sequence: 3, outcome: 'failed', error_code: 'secret@example.test' }), /check constraint/);
  await assert.rejects(log({ ...event, sequence: 3, outcome: 'failed' }), /check constraint/);
  await assert.rejects(log({ ...event, sequence: 3, stage: 'private filename' }), /check constraint/);
  await log({ ...event, sequence: 3, outcome: 'succeeded', reference: 42 });
  await log({ ...event, sequence: 4, outcome: 'succeeded', reference: 43 }); // Other owner: omitted.
  await log({ ...event, sequence: 5, outcome: 'succeeded', reference: 999 }); // Invented: omitted.
  await db.exec('reset role;');
  const rows = (await db.query('select * from cr_private.attempt_events order by sequence')).rows;
  assert.equal(rows.length, 5); assert.equal(rows[1].error_code, '23514');
  assert.equal(rows[2].reference, 42); assert.equal(rows[3].reference, null); assert.equal(rows[4].reference, null);
  assert(rows.every(r => r.recorded_at instanceof Date));
  assert.equal((await db.query('select count(*)::int n from public.cr_history')).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from public.cr_requests where reference=99')).rows[0].n, 0);
  await db.exec(`set role anon;`);
  await assert.rejects(log(event), /permission denied/);
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);set role authenticated;`);
  await assert.rejects(log(event), /Sign in required/);
  console.log('PASS: exact migration; independent commits survive submission rollback; replay deduplication; server timestamps; private table permissions; anonymous/unsigned denial; field/code allowlists; owned/existing request numbers only.');
  console.log('LIMIT: submission rollback uses a deliberate transaction-failure fixture, not the full historical finance schema or hosted PostgREST.');
} finally { await db.close(); }
