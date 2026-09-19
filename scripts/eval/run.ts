// Offline regression harness for the AI tutor: replays frozen fixtures
// (scripts/eval/fixtures/*.json) against the LIVE model with today's prompts,
// and asserts the reply on deterministic facts already known from the
// fixture (lib/eval-assertions.ts) — not a second model call judging the
// first. This is not part of `bun run test`/CI: it costs real DeepSeek
// tokens and the model isn't deterministic, so it's a manual/periodic check,
// mainly worth running right after a prompt or task-guard change.
//
// Usage: bun run eval  [fixture-name-substring]
import { readdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type OpenAI from 'openai'
import { deepseek, MODEL } from '@/lib/gemini'
import { checkReply } from '@/lib/eval-assertions'
import type { PromptContext } from '@/types'

interface EvalFixture {
  name: string
  description: string
  context: PromptContext
}

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function loadFixtures(filter?: string): EvalFixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf-8')) as EvalFixture)
    .filter((fx) => !filter || fx.name.includes(filter))
}

async function replay(context: PromptContext): Promise<string> {
  const reasoningParams =
    context.mode === 'build'
      ? { thinking: { type: 'enabled' as const }, reasoning_effort: context.reasoning_effort }
      : { thinking: { type: 'disabled' as const } }

  const completion = await deepseek.chat.completions.create({
    model: MODEL,
    stream: false,
    messages: [
      { role: 'system', content: context.system_content },
      ...context.history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: context.user_content },
    ],
    ...reasoningParams,
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
    thinking: { type: 'enabled' | 'disabled' }
    reasoning_effort?: 'low' | 'high' | 'max'
  })

  return completion.choices[0]?.message?.content ?? ''
}

async function main() {
  const filter = process.argv[2]
  const fixtures = loadFixtures(filter)

  if (fixtures.length === 0) {
    console.log(filter ? `No fixtures matching "${filter}".` : 'No fixtures found in scripts/eval/fixtures/.')
    return
  }

  let failed = 0
  for (const fixture of fixtures) {
    const reply = await replay(fixture.context)
    const violations = checkReply(fixture.context, reply)

    if (violations.length === 0) {
      console.log(`PASS  ${fixture.name}`)
    } else {
      failed++
      console.log(`FAIL  ${fixture.name}`)
      console.log(`      ${fixture.description}`)
      console.log(`      reply: ${JSON.stringify(reply)}`)
      for (const v of violations) console.log(`      - ${v}`)
    }
  }

  console.log(`\n${fixtures.length - failed}/${fixtures.length} fixtures passed.`)
  if (failed > 0) process.exit(1)
}

await main()
