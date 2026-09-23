import { z } from 'zod'

export const NodeId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_]+$/)

const base = {
  id: NodeId,
  parentId: NodeId.nullable(), // null = direct child of the page root
  createdBy: z.enum(['tutor', 'student', 'system']),
}

export const Lang = z.enum(['python'])

export const TraceStep = z.object({
  line: z.number().int().positive(),
  stdout: z.string().max(500).default(''),
  callStack: z.array(z.string().max(60)).max(20),
  vars: z
    .array(
      z.object({
        name: z.string().max(60),
        type: z.string().max(40),
        repr: z.string().max(80),
        items: z.array(z.string().max(40)).max(12).optional(),
      })
    )
    .max(10),
})

export type TraceStep = z.infer<typeof TraceStep>

export const BoardNode = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('heading'), text: z.string().max(120) }),
  z.object({ ...base, type: z.literal('text'), markdown: z.string().max(1200) }),
  z.object({
    ...base,
    type: z.literal('code'),
    language: Lang,
    // The project file this node edits. Absent means the lesson's entry file
    // (main.py), which is every node except a multi-file task like bugzap.
    file: z.string().max(64).optional(),
    // The task's `# TASK: <id>` comment. When set, the editor shows only that
    // task's block of `source` (lib/board/code.ts blockOf). Absent: whole file.
    anchor: z.string().max(80).optional(),
    source: z.string().max(4000),
    editable: z.boolean(),
    caption: z.string().max(120).optional(),
  }),
  // Written by the client runner, never by the tutor:
  z.object({
    ...base,
    type: z.literal('output'),
    forNodeId: NodeId,
    stdout: z.string(),
    stderr: z.string(),
    ok: z.boolean(),
    // The source that produced this output. Lets a later edit be told apart from a run.
    ran: z.string().max(4000).optional(),
  }),
  z.object({
    ...base,
    type: z.literal('trace'),
    forNodeId: NodeId,
    steps: z.array(TraceStep).max(200),
    cursor: z.number().int().min(0).default(0),
  }),
  z.object({ ...base, type: z.literal('preview'), forNodeId: NodeId }),
  z.object({
    ...base,
    type: z.literal('quiz'),
    kind: z.enum(['predict_output', 'multiple_choice', 'fill_blank']),
    prompt: z.string().max(400),
    options: z.array(z.string().max(120)).max(5).optional(),
    answered: z.boolean().default(false),
    // A scripted, graded step (lib/lessons.ts LessonStep). Absent `answer` = ungraded tutor quiz.
    code: z.string().max(200).optional(),
    answer: z.number().int().min(0).optional(),
    explain: z.string().max(160).optional(),
    picked: z.number().int().min(0).nullable().optional(),
    attempts: z.number().int().min(0).default(0),
  }),
  // "Fill the blank and watch Sparky say it." Written by the client from a lesson step.
  z.object({
    ...base,
    type: z.literal('sandbox'),
    prompt: z.string().max(120),
    template: z.string().max(60),
    chips: z.array(z.string().max(30)).max(4).default([]),
    value: z.string().max(40).default(''),
    said: z.string().max(40).default(''),
    seen: z.array(z.string().max(40)).max(12).default([]),
    need: z.number().int().min(1).max(4).default(1),
    answered: z.boolean().default(false),
  }),
  // A short animated explainer: each frame shows a line of code and what Sparky says about it.
  z.object({
    ...base,
    type: z.literal('learn'),
    prompt: z.string().max(120),
    // `say` is the pre-stage shape of `note`; boards saved with it still load.
    frames: z
      .array(
        z.object({
          code: z.string().max(60),
          note: z.string().max(60).optional(),
          say: z.string().max(80).optional(),
          hl: z.string().max(30).optional(),
          speak: z.string().max(40).optional(),
        })
      )
      .min(1)
      .max(4),
    frame: z.number().int().min(0).default(0),
    answered: z.boolean().default(false),
  }),
  // Tap lines into the right order, then Sparky says them. `lines` is the correct order.
  z.object({
    ...base,
    type: z.literal('order'),
    prompt: z.string().max(120),
    lines: z.array(z.string().max(40)).min(2).max(4),
    arranged: z.array(z.number().int().min(0).max(3)).max(4).default([]),
    attempts: z.number().int().min(0).default(0),
    answered: z.boolean().default(false),
  }),
  // Tap the broken line of a short program.
  z.object({
    ...base,
    type: z.literal('bug'),
    prompt: z.string().max(120),
    code: z.string().max(200),
    bugLine: z.number().int().min(0).max(5),
    explain: z.string().max(120),
    picked: z.number().int().min(0).nullable().optional(),
    attempts: z.number().int().min(0).default(0),
    answered: z.boolean().default(false),
  }),
  // Step through a short program line by line (authored frames, no run). Done at the last frame.
  z.object({
    ...base,
    type: z.literal('walk'),
    prompt: z.string().max(120),
    code: z.string().max(200),
    frames: z
      .array(
        z.object({
          line: z.number().int().positive(),
          vars: z.record(
            z.string().max(30),
            z.union([z.string().max(40), z.array(z.string().max(20)).max(6)])
          ),
          out: z.string().max(100).optional(),
          stack: z.array(z.string().max(30)).max(4).optional(),
          note: z.string().max(60).optional(),
        })
      )
      .min(2)
      .max(12),
    cursor: z.number().int().min(0).default(0),
    answered: z.boolean().default(false),
  }),
  // Tap a code piece, then tap what it does. `picked` is the piece waiting for its partner.
  z.object({
    ...base,
    type: z.literal('match'),
    prompt: z.string().max(120),
    pairs: z
      .array(z.object({ left: z.string().max(30), right: z.string().max(30) }))
      .min(2)
      .max(4),
    matched: z.array(z.number().int().min(0).max(3)).max(4).default([]),
    picked: z.number().int().min(0).nullable().optional(),
    attempts: z.number().int().min(0).default(0),
    answered: z.boolean().default(false),
  }),
  // A live scene plus a tap-the-blocks program (lib/board/scenes). Won when the program's final state meets `goal`.
  z.object({
    ...base,
    type: z.literal('stage'),
    prompt: z.string().max(120),
    scene: z.enum(['room', 'grid', 'boxes', 'machine']),
    config: z.record(z.string(), z.unknown()).default({}),
    goal: z.record(z.string(), z.unknown()).default({}),
    palette: z
      .array(
        z.object({ label: z.string().max(40), ops: z.array(z.string().max(40)).min(1).max(6) })
      )
      .min(1)
      .max(8),
    // A program that wins: shown after three misses so a child is never stuck.
    solution: z.array(z.number().int().min(0).max(7)).max(8),
    program: z.array(z.number().int().min(0).max(7)).max(8).default([]),
    attempts: z.number().int().min(0).default(0),
    answered: z.boolean().default(false),
  }),
  z.object({
    ...base,
    type: z.literal('diagram'),
    kind: z.enum(['variable_boxes', 'list_boxes', 'flow', 'loop_counter', 'call_stack']),
    data: z.record(z.string(), z.unknown()), // validated per kind in the renderer
  }),
])
export type BoardNode = z.infer<typeof BoardNode>

export const BoardOp = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), pageId: z.string(), node: BoardNode }),
  z.object({ op: z.literal('update'), id: NodeId, patch: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal('remove'), id: NodeId }),
  z.object({ op: z.literal('focus'), id: NodeId }),
  z.object({ op: z.literal('new_page'), pageId: z.string(), title: z.string().max(40) }),
])
export type BoardOp = z.infer<typeof BoardOp>

// Node types only client code may create.
export const CLIENT_ONLY_TYPES = [
  'output',
  'trace',
  'preview',
  'sandbox',
  'learn',
  'order',
  'bug',
  'walk',
  'match',
  'stage',
] as const

// Fields that record what the student did on a step. The tutor may not write
// them, or it could resolve the gate the lesson keeps in front of the editor.
export const STUDENT_STEP_FIELDS = [
  'picked',
  'attempts',
  'answered',
  'seen',
  'said',
  'value',
  'frame',
  'arranged',
  'matched',
  'program',
] as const
