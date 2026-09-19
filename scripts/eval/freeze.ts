// Freezes a real prompts row (captured by app/api/generate/route.ts since
// the `context` snapshot column was added) into a replayable eval fixture
// under scripts/eval/fixtures/. Point this at a prompt id surfaced by a bug
// report so the fix can be regression-tested with `bun run eval`, instead of
// only being verified once by hand.
//
// Usage: bun run eval:freeze <promptId> <fixture-name> "<description>"
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { and, asc, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { messages, prompts } from '@/lib/db/schema'
import type { PromptContext } from '@/types'

async function freeze(promptId: string, name: string, description: string) {
  const [row] = await db.select().from(prompts).where(eq(prompts.id, promptId)).limit(1)
  if (!row) throw new Error(`No prompts row with id ${promptId}`)
  if (!row.context) {
    throw new Error(
      `prompts.${promptId} has no context snapshot — it predates the snapshot column and cannot be replayed.`
    )
  }

  // Best-effort only: the assistant reply isn't linked to this row by FK, so
  // this is a nearest-match for a human to eyeball, not something the
  // fixture's own assertions depend on.
  const [originalReply] = row.projectId
    ? await db
        .select({ content: messages.content })
        .from(messages)
        .where(and(eq(messages.projectId, row.projectId), eq(messages.role, 'assistant'), gte(messages.createdAt, row.createdAt)))
        .orderBy(asc(messages.createdAt))
        .limit(1)
    : []

  const fixture = {
    name,
    description,
    promptId,
    original_reply: originalReply?.content ?? null,
    context: row.context as PromptContext,
  }

  const path = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', `${name}.json`)
  writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n')
  console.log(`wrote ${path}`)
}

const [promptId, name, description] = process.argv.slice(2)
if (!promptId || !name) {
  console.error('Usage: bun run eval:freeze <promptId> <fixture-name> "<description>"')
  process.exit(1)
}

await freeze(promptId, name, description ?? '')
await db.$client.end()
