# RCAP Living Playbook: carrying it forward

Website: https://wearercap.org/committee-playbook/

The workspaces are Marketing & Communications, Men of RCAP, Trunk or Treat, and Fall Raffle. The raffle team also has a direct entry at https://wearercap.org/raffle-playbook/ with tailored context for all 24 questions. Each has 24 foundation questions across Purpose, Perspective, People, Provision, Plan, and Pass It On. Members can answer at their own pace, discuss contributions, review optional contextual follow-ups, and create next steps. Follow-up suggestions use explicit local rules, rather than an external AI model. Group agreements require a lead's action.

## Where the knowledge lives

Website contributions are stored in the existing RCAP Supabase project. Every edit preserves the previous answer, and changing an agreed answer reopens it for discussion. Website access uses a verified email and a committee membership list. Initial memberships came from completed committee signups and existing board access. Leads can add sign-in emails on the website. Adding a website member does not grant Google Drive access or send an invitation.

The organization-owned RCAP 2026-27 folder contains Committees and all committee folders. Only participating committee folders contain playbooks. Original editable Docs are preserved. Each pilot also has a separate generated Living Record for website contributions, comments, follow-up questions, next steps and earlier answer versions. Website changes flow to this generated record; edits to the Doc do not flow back to the website. Keep separate human notes in the original editable playbook.

Members can download all committee data as JSON, including revisions and the foundation question catalog. The readable Google Doc is useful even if the website stops running. Its links, ownership and access should be checked at each handoff.

## Drive updater

Apps Script project: https://script.google.com/home/projects/1csWXbwSswIDHMVqFW9yri0tKidQQUtS8Ui_hPx50fj01hqx7DN7pG5AV/edit

Source: `server/playbook/DriveUpdater.gs`. This source writes only to registered fixed generated Docs, authenticates the signed-in member against the fixed Supabase origin, and serializes updates. It uses DocumentApp and UrlFetchApp. The Google authorization screen may request broader Docs access than the code uses. Owner authorization and web app deployment must be completed before automatic syncing works. A draft project is not a live connection.

Deploy as the owner with an accessible web app endpoint. Set `PLAYBOOK_DRIVE_WEBHOOK_URL` in Vercel production to the deployment's `https://script.google.com/macros/s/.../exec` URL and redeploy. The endpoint accepts only registered committee IDs and independently checks a current Supabase member token. No Google refresh token is stored in Vercel or shipped to the browser. The browser calls the existing `api/feedback-draft.js` with `mode: playbook_sync`; this reuses a function entrypoint under the project's function limit.

After authorization, verify a real contribution reaches the correct Doc and that a signed-out or unrelated member request cannot write. A contribution remains saved in Supabase when Drive is unavailable. The website reports a distinct Drive error and offers a retry. Avoid claiming a successful Drive save based only on a database save.

## Succession checklist

1. Name an incoming committee lead and a second ongoing administrator. Add their verified sign-in emails and verify access together.
2. Confirm RCAP controls the repository, hosting, Supabase billing and project access, Google updater, folder access and domain. These services have separate ownership.
3. Existing original and generated Docs are owned by mose@mosejames.com inside an organization-owned shared folder. Folder ownership does not transfer file ownership. Arrange an eligible transfer, Shared Drive move, or organization-owned copies. If IDs change, update the database committee records, frontend original-doc links and Apps Script fixed record map together.
4. Reauthorize and redeploy the updater under the ongoing owner when necessary. Update the Vercel webhook environment variable and verify a real save before the departing owner loses access.
5. Download an export, inspect the readable living record, record unfinished actions, and write the handoff date, incoming lead and access contact in Pass It On.

## Verification

Run `npm run build` and `npm test` before release. Database changes are in `supabase/migrations/20261009180737_committee_living_playbook.sql`. All playbook tables have RLS enabled and no direct anon or authenticated grants. The public RPC is an invoker; its private definer verifies the confirmed user and membership on every action. Static questions are validated against a server catalog. Test coverage includes save-before-navigation, conversation retention, Drive authentication boundaries and question progression. A rollback-only database check verified revision preservation, member agreement denial, cross-committee denial, outsider denial and rejection of forged question IDs.

Branded share image: `public/playbook-og.jpg`, 1200 by 630. Both Open Graph and Twitter metadata use its absolute production HTTPS URL.

## Fall Raffle rollout

The 2026-27 Fall Raffle workspace uses the existing Fall Raffle folder. Initial member access comes from completed raffle signups, with the same named organization administrators as the original rollout. No invitations are sent. Its editable playbook and separate living record are linked from the website. Automatic Drive updates remain pending owner authorization. The source updater map includes the raffle record; publish that updated source when authorizing the script.

## Committee privacy

Global administration is separate from committee leadership. The private admins table initially contains Mose's two sign-in emails and the ongoing RCAP organization email. It has RLS and no direct client grants. Only global admins see the committee switcher. Every other account must have explicit membership for the committee requested, including exports and Drive updates. Leads can manage their own committee and cannot grant global administration. The original blanket grants for other board accounts were removed except where a completed signup establishes membership. The website does not silently redirect an unauthorized committee link into a different playbook. People serving on multiple committees retain explicit memberships, but open each committee through its link.

Google Drive document access is separate and still inherits existing parent-folder sharing. The website's access controls do not revoke those Google permissions.

## Uniform rollout and chair invitations

The Uniform Committee lives at `/uniform-playbook/` with 24 tailored prompts, an editable playbook and a separate living record in the existing Uniform Swap folder. Shekita James has committee lead access. Automatic Drive updates still require authorization and deployment of the current updater source, which now includes uniform and raffle.

Every committee lead sees Invite contributors. Adding a sign-in email grants membership only in that committee and prepares a named, committee-specific invitation to copy or open in email. The app does not send email automatically. The server always grants member access through this invitation action, regardless of a submitted role. Only global admins can assign or change committee chair roles through `set_member_role`.

Contributions and replies display the contributor's name. The name field starts from the signed-in profile when available and remains editable. Names provide attribution; confirmed account identity and committee membership control access.

Uniform sharing uses `public/uniform-playbook-og.jpg`, 1200 by 630, with absolute HTTPS Open Graph and Twitter large-image metadata. Validation: build and all 766 tests pass. A rollback-only database check confirmed invitations cannot cross committees, grant chair roles, or be created by ordinary members.

## Creating the team, not only preserving history

All committee workspaces now introduce the playbook as a place to shape purpose, scope, ideas and working culture. Marketing & Communications has 24 first-year prompts, including creative roles, request scope, approvals, listening and pilots. General prompts offer starting-fresh paths where history was previously assumed. Existing question IDs, sections and titles remain compatible with the server catalog; no contributions, memberships or links are migrated or reset. The editable Google Docs gained an introductory section in place, using revision guards. The updater source carries this framing into future generated records when deployed.

Chair activation: start with the chair’s provisional vision, invite the team to challenge and build on it, ask each person for one idea or question, discuss purpose/scope/working norms together, record genuine group agreements, and choose two to four first actions. Return after the first real project to capture learning. A chair starts the conversation rather than completing the entire playbook alone.

## Ideas & dates

Every workspace has a capture space for ideas, questions, lessons, proposed dates, confirmed dates and recurring reminders. The contributor is credited; replies retain their own authors. Optional timing, context, people to involve and six-P connections keep one item connected across the record. Connected actions refer back to the original idea. Only leads record Agreed or Confirmed date. Changes to agreed wording/context/timing reopen the discussion and turn a previously confirmed date back into a proposal. Updates require the current version and preserve earlier snapshots in the export.

The new private tables have RLS and no direct client grants. The existing verified membership handler remains the authorization boundary through a private wrapper. DriveUpdater.gs now includes ideas, replies, earlier versions and connected-action links. The owner-authorized cloud deployment must use this updated source before Drive can include these items. The authorization flow is still awaiting the user's approval of Google's requested Docs and external-service permissions.
