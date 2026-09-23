# Tech stack

This file records the **decisions**. The full stack table is in [README.md](../README.md#tech-stack).
The hard engineering rules are in [CLAUDE.md](../CLAUDE.md) and the topic skills under
`.claude/skills/`. They are linked, not copied, so they cannot drift apart.

## Locked (change only with the owner's explicit approval)

- **AI model:** DeepSeek `deepseek-v4-flash`.
- **Python runs only in the browser** (Pyodide). Student code never runs on the server.
- **Database:** Postgres through Drizzle. No other database or ORM.
- **Hosting:** Vercel.

## Policies for every feature

- **Tests are required.** Every feature adds Jest tests, and CI (lint · format · typecheck · test)
  must pass before merge.
- **Every device.** Every feature works on laptop, tablet and phone.
- **AI cost:** no cap for now. We optimise for learning and watch cost later (see backlog).

## Tenancy & domains

- **B2C is a tenant too.** Every organization (school) and the built-in B2C org
  "SparkBuild Direct" share one Postgres database. Tenant data carries an `org_id`, and every
  query filters by it on top of the ownership predicate.
- **The subdomain picks the org.** `sparkbuild.space` = landing page · `app.` = SparkBuild Direct
  (B2C) · `console.` = platform owner · `<school>.` = each school. Wildcard `*.sparkbuild.space`
  on Vercel; `proxy.ts` resolves the host to an org.
- **Sign-in works across subdomains** (Better Auth + Google). The exact method is decided in the
  D2 spec from current docs.
- **Payments (locked): ABA PayWay / KHQR.** Currency is decided in the D7 spec.
