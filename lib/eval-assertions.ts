// Deterministic, model-free checks for a tutor reply against facts already
// baked into its own system prompt — no DB, no network, no second model call
// judging the first. Used by scripts/eval/run.ts to catch regressions in
// replayed turns; safe to unit test directly.
//
// ponytail: the phrase/pattern lists below are heuristics tuned from real
// bugs (abaac24, the jsdom fix), not an exhaustive grammar of "praise" or
// "code". Extend them from real transcripts as new false negatives turn up.

const COMPLETION_PHRASES = [
  'great job',
  'you did it',
  'all done',
  "you're done",
  'you are done',
  'well done',
  'you finished',
  'you completed',
  'task complete',
  'task is complete',
  "that's complete",
  'nailed it',
]

/** buildTaskNudge (lib/task-guard.ts) writes this verbatim for any unmet checklist item. */
function hasUnmetRequirement(systemContent: string): boolean {
  return systemContent.includes('NOT DONE YET')
}

/**
 * Catches the abaac24/jsdom-fix class of bug: the tutor already has the
 * checklist verdict in its own system prompt, so if the checklist says a
 * requirement is unmet, the reply should not congratulate the student on
 * finishing the task anyway.
 */
export function checkTaskCompletionContradiction(systemContent: string, reply: string): string[] {
  if (!hasUnmetRequirement(systemContent)) return []
  const lower = reply.toLowerCase()
  const hit = COMPLETION_PHRASES.find((phrase) => lower.includes(phrase))
  return hit ? [`reply claims completion ("${hit}") while a checklist requirement is still NOT DONE YET`] : []
}

// Markup, fences, or a line that reads as Python: a call to print()/input(), an
// assignment on its own line, or a block header like "for x in y:".
const CODE_PATTERN =
  /```|<[a-z!][^\s>]*(?:\s[^>]*)?>|\b(?:print|input)\(|^\s*\w+\s*=\s*\S.*$|^\s*(?:def|for|while|if|elif|else|try|except|class)\b.*:\s*$/im

/** Checks the reply against ASK_SYSTEM_PROMPT's own stated rules (lib/gemini.ts) — currently unenforced anywhere. */
export function checkAskModeFormat(reply: string): string[] {
  const violations: string[] = []

  if (CODE_PATTERN.test(reply)) {
    violations.push('contains a code block or markup — rule 1 forbids showing code, even one line')
  }

  const sentences = reply
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length > 3) {
    violations.push(`has ${sentences.length} sentences — rule 2 caps replies at 3`)
  }

  const questionMarks = (reply.match(/\?/g) ?? []).length
  if (questionMarks !== 1) {
    violations.push(`has ${questionMarks} question marks — rule 5 requires exactly one`)
  } else if (!/\?\s*$/.test(reply.trim())) {
    violations.push('the question is not the reply\'s final sentence — rule 5 requires ending with it')
  }

  return violations
}

export interface EvalReplyContext {
  mode: 'ask' | 'build'
  system_content: string
}

/** All deterministic checks that apply to a turn's mode, combined. */
export function checkReply(context: EvalReplyContext, reply: string): string[] {
  const violations = checkTaskCompletionContradiction(context.system_content, reply)
  if (context.mode === 'ask') violations.push(...checkAskModeFormat(reply))
  return violations
}
