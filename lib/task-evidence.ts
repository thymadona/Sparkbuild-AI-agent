import type { LessonTask } from '@/lib/lessons'
import type { BoardState } from '@/lib/board/reducer'
import { fileOf } from '@/lib/board/code'
import {
  awaitingEditor,
  nextStepIndex,
  stepAction,
  stepNodeId,
  taskCodeNodeId,
  taskPageId,
} from '@/lib/board/tasks'
import { describeScene, type SceneId } from '@/lib/board/scenes'
import { isRuntimeCheck, runTaskChecks, type TaskCheck } from '@/lib/task-checks'

// `stale`: the source was edited after the run whose output is shown.
export interface Program {
  file: string
  source: string
  stdout: string | null
  error: string | null
  stale: boolean
  ran?: boolean
}

// What the tutor judges a task on: every editable program on the task's page and
// what its last run printed. A code_run event carries the exact source and output
// of the run that just happened, which is fresher than the debounced saved board.
export function taskPrograms(
  board: BoardState,
  task: LessonTask,
  entry: string,
  run?: { nodeId: string; source: string; stdout: string; stderr: string }
): Program[] {
  const page = board.pages.find((p) => p.id === taskPageId(task))
  const out: Program[] = []
  for (const id of page?.nodeIds ?? []) {
    const n = board.nodes[id]
    if (n?.type !== 'code' || !n.editable || n.language !== 'python') continue
    const output = page?.nodeIds
      .map((i) => board.nodes[i])
      .reverse()
      .find((o) => o?.type === 'output' && o.forNodeId === id)
    const ran = run?.nodeId === id
    // Outputs written before `ran` existed carry no source; they count as fresh.
    const stale =
      !ran && output?.type === 'output' && output.ran !== undefined && output.ran !== n.source
    out.push({
      file: fileOf(n, entry),
      source: ran ? run.source : n.source,
      stdout: ran ? run.stdout : output?.type === 'output' ? output.stdout : null,
      stale,
      ...(ran ? { ran } : {}),
      error: ran
        ? run.stderr.trim().split('\n').slice(-3).join('\n') || null
        : output?.type === 'output' && output.stderr
          ? output.stderr.trim().split('\n').slice(-3).join('\n')
          : null,
    })
  }
  return out
}

// The run is the proof the program does something; "I'm done" alone never counts.
export const hasRun = (programs: Program[]) => programs.some((p) => p.stdout !== null && !p.stale)

// A definite answer for an outputContains check, from the run the browser reported:
// the program it names must have run cleanly on its current code and printed a match.
// undefined when only Python could tell (world events, calls, fed input()).
export function outputVerdict(
  check: TaskCheck,
  programs: Program[],
  entry: string
): boolean | undefined {
  if (check.kind !== 'outputContains' || check.inputs?.length) return undefined
  const p = programs.find((x) => x.file === (check.file ?? entry))
  if (!p || p.stdout === null || p.stale || p.error) return false
  try {
    return new RegExp(check.pattern, check.flags).test(p.stdout)
  } catch {
    return true // a broken pattern must not dead-end a child
  }
}

export function describeEvidence(programs: Program[]): string {
  if (!programs.length) return 'EVIDENCE: the student has no code on this page yet.'
  return [
    'EVIDENCE (what the student really wrote and what it printed):',
    ...programs.map(
      (p) =>
        `--- ${p.file}${p.ran ? ' (the run that just happened)' : ''} ---\n${p.source.slice(0, 1500)}\n--- output ---\n${p.stdout === null ? '(not run yet)' : p.stdout.slice(0, 500) || '(nothing printed)'}${p.stale ? '\n(edited since it last ran: this output is from older code)' : ''}${p.error ? `\n--- error ---\n${p.error}` : ''}`
    ),
  ].join('\n')
}

// The scripted step on the student's screen: which one, what it asks, what they picked and how often
// they missed. Without it the tutor can only say "answer the question", never help with THIS question.
// null when the task has no step on the board yet.
export function describeStep(board: BoardState, task: LessonTask): string | null {
  const total = task.steps?.length ?? 0
  let at = -1
  for (let i = 0; i < total; i++) {
    const n = board.nodes[stepNodeId(task, i)]
    if (!n) break
    at = i
    if (!('answered' in n) || !n.answered) break
  }
  const n = at >= 0 ? board.nodes[stepNodeId(task, at)] : undefined
  if (!n) return null
  const head = `- The student is on scripted step ${at + 1} of ${total}. What they must do next: ${stepAction(n) || 'follow the card'}. Say that in your own short words. The step`
  const done = 'answered' in n && n.answered ? ' (already answered)' : ''
  switch (n.type) {
    case 'quiz':
      return `${head}${done}, a multiple-choice question: "${n.prompt}"${n.code ? ` about the code ${JSON.stringify(n.code)}` : ''}. Options: ${(n.options ?? []).map((o, i) => `${i === n.answer ? `${o} (RIGHT)` : o}`).join(' | ')}. They picked ${n.picked != null ? JSON.stringify(n.options?.[n.picked]) : 'nothing yet'}; misses: ${n.attempts}.`
    case 'order':
      return `${head}${done}, put these lines in order: ${n.lines.map((l) => JSON.stringify(l)).join(', ')} (that is the right order). Their row now: ${n.arranged.map((i) => JSON.stringify(n.lines[i])).join(', ') || 'empty'}; misses: ${n.attempts}.`
    case 'bug':
      return `${head}${done}, find the broken line in ${JSON.stringify(n.code)}. The broken line is line ${n.bugLine + 1}: ${n.explain} They picked ${n.picked != null ? `line ${n.picked + 1}` : 'nothing yet'}; misses: ${n.attempts}.`
    case 'match':
      return `${head}${done}, match code to its job: ${n.pairs.map((p) => `${p.left} = ${p.right}`).join('; ')}. Matched so far: ${n.matched.length} of ${n.pairs.length}; misses: ${n.attempts}.`
    case 'learn':
      return `${head}${done}, an explainer card ("${n.prompt}"), showing part ${n.frame + 1} of ${n.frames.length}: ${n.frames[Math.min(n.frame, n.frames.length - 1)].note ?? ''}`
    case 'sandbox':
      return `${head}${done}, a "type words and watch Sparky say them" sandbox: ${n.prompt} They have tried ${n.seen.length} of ${n.need} different lines${n.seen.length ? `: ${n.seen.map((w) => JSON.stringify(w)).join(', ')}` : ''}.`
    case 'stage': {
      const program = n.program.map((i) => n.palette[i]?.label).filter(Boolean)
      return `${head}${done}, a scene puzzle: "${n.prompt}". ${describeScene(n.scene as SceneId, n.config, n.goal)} Blocks they can tap: ${n.palette.map((b) => b.label).join(', ')}. Their program now: ${program.join(', ') || 'empty'}; failed runs: ${n.attempts}. A working program is: ${n.solution.map((i) => n.palette[i]?.label).join(', ')} (never say it before 3 failed runs).`
    }
    default:
      return null
  }
}

// Where the student is inside the task right now, and what is on their screen.
// The tutor cannot see the screen, so without this it talks about whatever the
// board summary happens to mention.
export function describeTaskState(
  board: BoardState,
  task: LessonTask,
  programs: Program[],
  entry = 'main.py'
): string {
  const lines = ['TASK STATE (what the student sees right now):']
  if (awaitingEditor(board, task, taskPageId(task))) {
    const shown = nextStepIndex(board, task) ?? task.steps?.length ?? 0
    lines.push(
      describeStep(board, task) ??
        `- Scripted concept steps, about ${shown} of ${task.steps?.length ?? 0}.`
    )
    lines.push('- There is no editor yet. Do not talk about code they cannot see.')
    return lines.join('\n')
  }
  if (task.go) lines.push(`- Instruction on screen: "${task.go}"`)
  if (task.then) {
    lines.push(
      board.nodes[`${taskCodeNodeId(task)}_2`]
        ? `- The first program is finished and its checks are done. A second program (${task.then.file}) is showing: "${task.then.go}". The student is working on ${task.then.file} now. Talk ONLY about ${task.then.file}: never recap, praise or quote the first program's output, and say "line 2" only for ${task.then.file}.`
        : `- A second program appears right below the first as soon as they Run the first one and it is right. If this run is right, do not ask them to change the first program again: say one short sentence of praise, then tell them to look below ("${task.then.go}"). If it is not right yet, help with the first program only.`
    )
  }
  // "New words" means different from what each program started as.
  const started = [
    task.starter && `main program started as:\n${task.starter}`,
    task.then && `${task.then.file} started as:\n${task.then.source}`,
  ].filter(Boolean)
  if (started.length)
    lines.push(
      `- What the student was given (their words must differ from these):\n${started.join('\n')}`
    )
  const code = programs[0]?.source ?? ''
  for (const c of task.checks ?? []) {
    const v = outputVerdict(c, programs, entry)
    const state =
      v !== undefined
        ? v
          ? 'met (checked against the run)'
          : 'NOT met'
        : isRuntimeCheck(c)
          ? 'judge from the output'
          : runTaskChecks([c], code)[0].passed
            ? 'met'
            : 'not met'
    lines.push(`- requirement "${c.label}": ${state}`)
  }
  return lines.join('\n')
}
