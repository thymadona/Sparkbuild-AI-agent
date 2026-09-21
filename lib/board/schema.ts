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
    source: z.string().max(4000),
    editable: z.boolean(),
    highlightLines: z.array(z.number().int().positive()).default([]),
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
export const CLIENT_ONLY_TYPES = ['output', 'trace', 'preview'] as const
