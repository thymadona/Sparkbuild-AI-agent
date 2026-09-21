import type { BoardOp } from '@/lib/board/schema'

// A scripted lesson standing in for the tutor until Phase 2. `client` ops are
// what the runner would write (output nodes); everything else is tutor ops.
export interface Step {
  caption?: string
  ops?: BoardOp[]
  client?: BoardOp[]
  wait?: number
}

const T = 'tutor' as const

export const fixture: Step[] = [
  {
    caption: "Hi, I'm Spark! Today the computer will say hello.",
    ops: [
      { op: 'new_page', pageId: 'p1', title: 'Say hello' },
      {
        op: 'add',
        pageId: 'p1',
        node: { id: 'h1', parentId: null, createdBy: T, type: 'heading', text: 'Make it talk' },
      },
    ],
  },
  {
    caption: 'This is one line of code. What do you think it shows?',
    ops: [
      {
        op: 'add',
        pageId: 'p1',
        node: {
          id: 'c1',
          parentId: null,
          createdBy: T,
          type: 'code',
          language: 'python',
          source: 'print("hello")',
          editable: true,
          caption: 'Your first program',
        },
      },
      {
        op: 'add',
        pageId: 'p1',
        node: {
          id: 'q1',
          parentId: null,
          createdBy: T,
          type: 'quiz',
          kind: 'multiple_choice',
          prompt: 'What appears on screen?',
          options: ['print', 'hello', '"hello"'],
          answered: false,
          attempts: 0,
        },
      },
    ],
    wait: 1800,
  },
  {
    caption: 'Yes, hello! print shows words on the screen.',
    client: [
      {
        op: 'add',
        pageId: 'p1',
        node: {
          id: 'o1',
          parentId: null,
          createdBy: 'system',
          type: 'output',
          forNodeId: 'c1',
          stdout: 'hello\n',
          stderr: '',
          ok: true,
        },
      },
    ],
    ops: [{ op: 'focus', id: 'o1' }],
    wait: 1200,
  },
  {
    caption: "Now let's save a word in a box.",
    ops: [
      { op: 'new_page', pageId: 'p2', title: 'Variables' },
      {
        op: 'add',
        pageId: 'p2',
        node: {
          id: 'h2',
          parentId: null,
          createdBy: T,
          type: 'heading',
          text: 'A variable is a box',
        },
      },
      {
        op: 'add',
        pageId: 'p2',
        node: {
          id: 't2',
          parentId: null,
          createdBy: T,
          type: 'text',
          markdown: 'A **variable** holds a value. Give it a name.',
        },
      },
    ],
  },
  {
    caption: 'Line 1 puts "Mia" in a box called name.',
    ops: [
      {
        op: 'add',
        pageId: 'p2',
        node: {
          id: 'c2',
          parentId: null,
          createdBy: T,
          type: 'code',
          language: 'python',
          source: 'name = "Mia"\nprint(name)',
          editable: true,
        },
      },
      {
        op: 'add',
        pageId: 'p2',
        node: {
          id: 'd2',
          parentId: null,
          createdBy: T,
          type: 'diagram',
          kind: 'variable_boxes',
          data: { vars: [{ name: 'name', value: '"Mia"' }] },
        },
      },
    ],
    wait: 1800,
  },
  {
    caption: 'Now line 2 reads the box. Try changing Mia to your name!',
    ops: [{ op: 'focus', id: 'c2' }],
  },
]
