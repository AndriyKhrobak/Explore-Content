# Project Instructions for Claude Code

These rules apply to **every** session in this repo. Read them before
starting any code change.

## Production branch & auto-merge workflow

**Production branch:** `claude/start-new-project-udKpD`. Vercel
auto-deploys from this branch on every push.

For **any** code change, run the full pipeline end-to-end without
asking the user — the user wants zero manual git work:

1. Work on the feature branch assigned to the session (e.g.
   `claude/<task>-<id>`). **Never commit directly** to
   `claude/start-new-project-udKpD`.
2. Run `npm run typecheck` (and any tests) before committing. Fix
   failures; do not commit broken code.
3. Commit with a clear message describing the *why*, not the *what*.
4. `git push -u origin <feature-branch>` (force-with-lease if you
   reset/rebased the branch — only your own feature branches).
5. Open a PR targeting `claude/start-new-project-udKpD` via
   `mcp__github__create_pull_request`.
6. **Immediately merge** the PR via `mcp__github__merge_pull_request`
   (default to `squash`). Vercel will auto-deploy.
7. Report the PR URL + merge status + Vercel deploy expectation to
   the user. If you also need a manual SQL step (see below), include
   it in the same final message.

If any step fails (merge conflict, failing checks, branch protection),
**stop and ask the user** — do not force-push to production or
override checks.

## Supabase / database migrations

The Supabase Postgres DB has **no `_prisma_migrations` table** —
`prisma migrate deploy` runs on Vercel but cannot record state, and
historical migrations were applied outside Prisma. Therefore:

1. Update `prisma/schema.prisma` for any schema change.
2. Add a migration file under
   `prisma/migrations/<YYYYMMDD>_<short_name>/migration.sql` so the
   schema-vs-migrations relationship stays valid for local dev.
3. **Always give the user raw SQL** to paste into
   Supabase Dashboard → SQL Editor → New query → Run.
4. **Do NOT** include `INSERT INTO "_prisma_migrations" (...)` in the
   SQL — that table does not exist; the query will fail with `42P01`.
5. Treat the migration as **unapplied** until the user confirms the
   SQL ran. Mention this explicitly in the final message ("after you
   merge, run this SQL in Supabase before testing").
6. The code change can still be merged to prod — it just won't work
   until the SQL is applied. That's an intentional user-controlled
   step.

## Vercel production-branch setting

If a merge to `claude/start-new-project-udKpD` does not trigger an
auto-deploy:

- The user must verify Vercel → Settings → Git → **Production Branch**
  = `claude/start-new-project-udKpD`.
- Do NOT redeploy older commits; promote the latest preview to
  production instead, or trigger a fresh deploy.

## Stack quick reference

- Nuxt 3 + Vue 3, Tailwind v3
- Prisma 6 ORM, Supabase Postgres
- Hosted on Vercel (Nitro vercel preset)
- Vizard.ai for clip generation, YouTube Data API v3 for upload
- Per-project Google OAuth credentials (BYO Client) — see
  `components/GoogleCredentialsCard.vue` and
  `server/utils/youtube.ts:getProjectOAuthCreds`
