---
name: issue-workflow
description: Runs this repo's issue → branch → commit → PR loop for real work (features, bugs, chores, docs) with very minimal one-line messages — find or open a GitHub issue, work on a `<type>/<slug>` branch, commit as a single conventional-commit line, and open a PR whose body is just `Closes #N.`. Use whenever the user says "ship", "let's work on X", "start on Y", "open an issue for Z", references an issue number to pick up, or wants pending working-tree changes taken through the full flow. Also use when wrapping up work to open the PR. Do not use for pure exploration, throwaway scratch scripts, or one-line edits made inline at the user's explicit direction without any request to track them.
---

# Issue workflow: issue → branch → commit → PR, minimal messages

Take the pending working-tree changes (or a task the user describes) through the full
GitHub flow with the shortest messages that still say what changed. No bullet lists, no
"Summary / Test plan" sections, no prose beyond one line each.

GitHub calls (issue, PR) go through `gh` if installed; otherwise use the GitHub MCP tools
(`mcp__github__*`) — load them via ToolSearch first, e.g.
`select:mcp__github__issue_write,mcp__github__create_pull_request,mcp__github__list_issues`.
Derive owner/repo from `git remote get-url origin` (`thymadona/Sparkbuild-AI-agent`).
`gh` is not installed on the usual dev machine, so expect the MCP path.

## Steps

1. **Issue** — reuse before creating. If the user names a number ("pick up #9"), use it
   (`gh issue view <N>` / MCP `mcp__github__get_issue`). Otherwise search first:
   ```bash
   gh issue list --state open --search "<keywords>"
   ```
   MCP: `mcp__github__list_issues` / `mcp__github__search_issues`. If nothing matches,
   open one — one-line title, one-line body:
   ```bash
   gh issue create --title "<what changed>" --body "<one-line summary of the issue>"
   ```
   MCP: `mcp__github__issue_write` with `method: "create"`.
2. **Branch** — branched off wherever you currently are (main not required), named
   `<type>/<slug>` with `type` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
   (e.g. `refactor/schema-per-table`):
   ```bash
   git switch -c <type>/<slug>
   ```
3. **Work and commit** — run `bun run format` and `bun run lint` first (CI runs
   `format:check`). Stage only the files belonging to the change (never blanket
   `git add -A` if unrelated untracked files exist). Message is a single
   conventional-commit line plus whatever footer the environment requires:
   ```
   <type>(<scope>): <what changed>
   ```
   Normal git safety rules apply — no `--no-verify`, confirm before any force-push.
4. **PR** — tell the user what you are about to push and to which branch, confirm, then
   push with `-u` and open the PR against `main`:
   ```bash
   git push -u origin <type>/<slug>
   gh pr create --base main --title "<same as commit>" --body "Closes #<issue>."
   ```
   MCP: `mcp__github__create_pull_request` with `base: "main"`.

## Rules

- Title/message everywhere: one line, imperative, lowercase after the
  conventional-commit prefix.
- The PR body is just `Closes #<issue>.` plus any footer the environment requires —
  nothing else. The one exception: if the change adds a migration or an env var, add
  one line naming it (still no headings).
- Partial work: write `Refs #<issue>.` instead of `Closes`, and leave the issue open.
- Closing an issue without a PR (duplicate, abandoned, decided against):
  `gh issue close <N> --comment "<one-line reason>"` — MCP `mcp__github__issue_write`
  with `method: "update"`, `state: "closed"`.
- Do not merge; leave the PR open for review.
