// Optional local test dependency. Install PGlite outside production and point
// BOO_PGLITE_MODULE at its module, or install it in your development environment.
const { PGlite } = await import(
  process.env.BOO_PGLITE_MODULE || "@electric-sql/pglite"
);
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
try {
  const root = fileURLToPath(new URL("../", import.meta.url)).replace(
    /\/$/,
    "",
  );
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema vault_private;create schema extensions;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,is_anonymous bool);create table vault_private.staff(user_id uuid primary key,role text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function extensions.digest(v text,a text) returns bytea language sql immutable as $$select sha256(convert_to(v,'UTF8'))$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    await fs.readFile(
      root + "/supabase/migrations/20261029045008_little_boo_game.sql",
      "utf8",
    ),
  );
  // One fictional pre-release submission proves the real migration's backfill.
  await db.exec(
    `insert into auth.users(id,phone,phone_confirmed_at,is_anonymous) values('e0000000-0000-4000-8000-000000000001','+15558880001',now(),false);select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',false);select public.boo_game('profile','{"display":"Fictional Earlier Player","house":"Altruismo","grade":"4th"}');select public.boo_game('upload','{"id":"f0000000-0000-4000-8000-000000000001","name":"Fictional Earlier Student","house":"Altruismo","grade":"4th","mode":"children","consent":true,"hash":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","key":"little-boo/v1/f0000000-0000-4000-8000-000000000001.bin","capsule":"fictional","proofHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');`,
  );
  const migrationName = (await fs.readdir(root + "/supabase/migrations")).find(
    (name) => name.endsWith("_little_boo_student_contributions.sql"),
  );
  const migration = await fs.readFile(
    root + "/supabase/migrations/" + migrationName,
    "utf8",
  );
  await db.exec(migration);
  const check = await db.query(
    `select count(*)::int total,sum(points)::int points from boo_private.contributions where source='backfill' and voided_at is null`,
  );
  if (check.rows[0].total !== 1 || check.rows[0].points !== 3)
    throw Error("Backfill failed");
  const backfill = migration.slice(
    migration.indexOf("with existing as ("),
    migration.indexOf("create function boo_private.score_events"),
  );
  await db.exec(backfill);
  const again = await db.query(
    `select count(*)::int total from boo_private.contributions`,
  );
  if (again.rows[0].total !== 1) throw Error("Backfill duplicated");
  console.log("PASS: one legacy accepted photo backfilled +3 exactly once.");
  await db.exec(
    "delete from boo_private.photos where owner='e0000000-0000-4000-8000-000000000001';delete from boo_private.people where owner='e0000000-0000-4000-8000-000000000001';delete from boo_private.contributions where user_id='e0000000-0000-4000-8000-000000000001';delete from boo_private.notifications where user_id='e0000000-0000-4000-8000-000000000001';delete from boo_private.players where user_id='e0000000-0000-4000-8000-000000000001';delete from auth.users where id='e0000000-0000-4000-8000-000000000001';",
  );
  for (const name of [
    "little_boo_contributions.sql",
    "little_boo.sql",
    "little_boo_phases.sql",
  ]) {
    try {
      const sql = await fs.readFile(root + "/supabase/tests/" + name, "utf8");
      await db.exec(sql);
      console.log("PASS: " + name);
    } catch (e) {
      throw e;
    }
  }
  await db.close();
} catch (e) {
  console.error(
    JSON.stringify({
      message: e.message,
      code: e.code,
      where: e.where,
      detail: e.detail,
    }),
  );
  process.exitCode = 1;
}
