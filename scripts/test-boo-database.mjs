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
    `create role anon;create role authenticated;create schema auth;create schema vault_private;create schema extensions;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,is_anonymous bool,deleted_at timestamptz,banned_until timestamptz);create table vault_private.staff(user_id uuid primary key,role text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function extensions.digest(v text,a text) returns bytea language sql immutable as $$select sha256(convert_to(v,'UTF8'))$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
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
  const firstNameMigration = (
    await fs.readdir(root + "/supabase/migrations")
  ).find((name) => name.endsWith("_little_boo_first_name_guesses.sql"));
  if (firstNameMigration)
    await db.exec(
      await fs.readFile(
        root + "/supabase/migrations/" + firstNameMigration,
        "utf8",
      ),
    );
  const nicknameMigration = (
    await fs.readdir(root + "/supabase/migrations")
  ).find((name) => name.endsWith("_little_boo_confirmed_nickname_credit.sql"));
  if (nicknameMigration)
    await db.exec(
      await fs.readFile(
        root + "/supabase/migrations/" + nicknameMigration,
        "utf8",
      ),
    );
  const revealMigration = (
    await fs.readdir(root + "/supabase/migrations")
  ).find((name) => name.endsWith("_little_boo_private_reveal.sql"));
  if (revealMigration)
    await db.exec(
      await fs.readFile(
        root + "/supabase/migrations/" + revealMigration,
        "utf8",
      ),
    );
  const contributorMigration = process.env.BOO_CONTRIBUTOR_MIGRATION || (await fs.readdir(root + '/supabase/migrations')).find(name => name.endsWith('_little_boo_contributor_reveal_access.sql'));
  if (contributorMigration) await db.exec(await fs.readFile(process.env.BOO_CONTRIBUTOR_MIGRATION || root + '/supabase/migrations/' + contributorMigration, 'utf8'));
  const scopedSettingsMigration=(await fs.readdir(root + "/supabase/migrations")).find(name=>name.endsWith("_little_boo_scoped_settings_updates.sql"));
  if(scopedSettingsMigration){
    const repair=await fs.readFile(root + "/supabase/migrations/"+scopedSettingsMigration,"utf8");
    await db.exec(repair);await db.exec(repair);
    const scoped=await db.query(`select count(*)::int writes from regexp_matches(pg_get_functiondef('boo_private.game(text,jsonb)'::regprocedure),'update boo_private.settings set [^;]+ where id=true;','g')`);
    if(scoped.rows[0].writes!==3)throw Error("All three game settings writes must have an explicit singleton predicate");
    console.log("PASS: scoped settings/finalize/drawing SQL guard patch, idempotent twice");
  }
  const restrictedMigration=(await fs.readdir(root + "/supabase/migrations")).find(name=>name.endsWith("_little_boo_restore_guesser_reveal_access.sql"));
  if(restrictedMigration){const sql=await fs.readFile(root+"/supabase/migrations/"+restrictedMigration,"utf8");await db.exec(sql);await db.exec(sql);console.log("PASS: pre-close guesser-only restoration, idempotent twice");}
  const publicWinnersMigration=(await fs.readdir(root + "/supabase/migrations")).find(name=>name.endsWith("_little_boo_public_winners.sql"));
  if(publicWinnersMigration)await db.exec(await fs.readFile(root+"/supabase/migrations/"+publicWinnersMigration,"utf8"));
  const ownerMigration=process.env.BOO_OWNER_REVEAL_MIGRATION || (await fs.readdir(root + "/supabase/migrations")).find(name=>name.endsWith("_little_boo_owner_reveal_access.sql"));
  if(ownerMigration){const sql=await fs.readFile(process.env.BOO_OWNER_REVEAL_MIGRATION || root+"/supabase/migrations/"+ownerMigration,"utf8");await db.exec(sql);await db.exec(sql);console.log("PASS: owner normal reveal exception, idempotent twice");}
  for (const name of [
    "little_boo_contributions.sql",
    "little_boo.sql",
    "little_boo_phases.sql",
    "little_boo_first_names.sql",
    "little_boo_reveal.sql",
  ]) {
    try {
      const sql = await fs.readFile(root + "/supabase/tests/" + name, "utf8");
      await db.exec(sql);
      console.log("PASS: " + name);
    } catch (e) {
      throw e;
    }
  }
  if (firstNameMigration) {
    const source = await fs.readFile(
      root + "/supabase/migrations/" + firstNameMigration,
      "utf8",
    );
    const repair = source
      .split("-- BEGIN FIRST-NAME REPAIR")[1]
      ?.split("-- END FIRST-NAME REPAIR")[0];
    const fixture = await fs.readFile(
      root + "/supabase/tests/little_boo_first_name_repair.sql",
      "utf8",
    );
    const chunks = fixture.split("-- APPLY_ACTUAL_REPAIR");
    if (!repair || chunks.length !== 3)
      throw Error("Repair test boundaries missing");
    await db.exec(chunks[0]);
    await db.exec(repair);
    await db.exec(chunks[1]);
    await db.exec(repair);
    await db.exec(chunks[2]);
    console.log(
      "PASS: little_boo_first_name_repair.sql (actual repair twice, rollback only)",
    );
  }
  if (nicknameMigration) {
    const source = await fs.readFile(
      root + "/supabase/migrations/" + nicknameMigration,
      "utf8",
    );
    const body = source.replace(/^begin;\s*/, "").replace(/commit;\s*$/, "");
    const chunks = (
      await fs.readFile(
        root + "/supabase/tests/little_boo_nickname_repair.sql",
        "utf8",
      )
    ).split("-- APPLY_ACTUAL_NICKNAME_MIGRATION");
    if (chunks.length !== 3) throw Error("Nickname test boundaries missing");
    await db.exec(chunks[0]);
    await db.exec(body);
    await db.exec(chunks[1]);
    await db.exec(body);
    await db.exec(chunks[2]);
    console.log(
      "PASS: little_boo_nickname_repair.sql (actual nickname migration twice, rollback only)",
    );
  }
  const reviewedRepair = await fs.readFile(root + "/supabase/repairs/little_boo_reviewed_spelling_credit.sql", "utf8");
  const reviewedFixture = (await fs.readFile(root + "/supabase/tests/little_boo_reviewed_spelling_credit.sql", "utf8")).split("-- APPLY_ACTUAL_REVIEWED_REPAIR");
  await db.exec(reviewedFixture[0]);
  await db.exec("savepoint changed_review;update boo_private.plays set guess='Changed fictional guess' where user_id='a6000000-0000-4000-8000-000000000003';");
  let rejectedChangedReview=false;
  try {await db.exec(reviewedRepair);}catch(e){rejectedChangedReview=e.message.includes('changed; no credits');}
  await db.exec("rollback to savepoint changed_review;");
  if(!rejectedChangedReview)throw Error("Changed reviewed attempt must reject atomically");
  await db.exec(reviewedRepair);
  await db.exec(reviewedFixture[1]);
  await db.exec(reviewedRepair);
  await db.exec(reviewedFixture[2]);
  console.log("PASS: exact 24 reviewed spelling attempts, 1/3 points, scope/preservation, atomic tamper rejection and idempotent rerun (rollback only)");
  if(publicWinnersMigration){
    const chunks=(await fs.readFile(root+"/supabase/tests/little_boo_public_winners.sql","utf8")).split("-- CHECK_AS_ANON");
    await db.exec(chunks[0]);await db.exec("set local role anon");
    const publicResult=(await db.query("select public.boo_winners() result")).rows[0].result;
    if(publicResult.winners.length!==3||publicResult.winners.some(w=>Object.keys(w).sort().join(',')!=='name,place,points'))throw Error("Anonymous public-winner shape leaked private fields");
    await db.exec("reset role");await db.exec(chunks[1]);console.log("PASS: anonymous approved top-three only, freeze/publication/approval/mismatch/hide gates, no phones/IDs/photos or personal results");
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
