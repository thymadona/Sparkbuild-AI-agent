import { checkAskModeFormat, checkReply, checkTaskCompletionContradiction } from '@/lib/eval-assertions'

describe('checkTaskCompletionContradiction', () => {
  it('flags completion language when the checklist has an unmet requirement', () => {
    const system = 'stuff\n- The title has your name: NOT DONE YET.\nmore stuff'
    const violations = checkTaskCompletionContradiction(system, "Great job, you're all done!")
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatch(/great job/)
  })

  it('passes when every requirement is DONE', () => {
    const system = '- The title has your name: DONE.'
    expect(checkTaskCompletionContradiction(system, "Great job, you're all done!")).toEqual([])
  })

  it('passes when nothing is unmet and the reply avoids completion language', () => {
    const system = 'no checklist here at all'
    expect(checkTaskCompletionContradiction(system, 'Try renaming the button.')).toEqual([])
  })

  it('does not flag a reply that avoids completion language even with an unmet requirement', () => {
    const system = '- The title has your name: NOT DONE YET.'
    expect(checkTaskCompletionContradiction(system, 'Look at the h1 tag. What should it say?')).toEqual([])
  })
})

describe('checkAskModeFormat', () => {
  it('passes a well-formed ask-mode reply', () => {
    expect(checkAskModeFormat('Your button looks great! What should it say when clicked?')).toEqual([])
  })

  it('flags a code block', () => {
    const violations = checkAskModeFormat('Just add this: ```<button>Go</button>```')
    expect(violations.some((v) => v.includes('code block'))).toBe(true)
  })

  it('flags Python code lines', () => {
    expect(checkAskModeFormat('Try this: print("hi"). Does it work?')[0]).toMatch(/code/)
    expect(checkAskModeFormat('Look at this.\nname = "Ada"\nDoes it work?')[0]).toMatch(/code/)
    expect(checkAskModeFormat('Fix it.\nfor i in range(3):\nWhat happens?')[0]).toMatch(/code/)
  })

  it('does not flag prose that merely names Python words', () => {
    expect(checkAskModeFormat('Your print line shows the name. What should it say next?')).toEqual([])
    expect(checkAskModeFormat('If the loop never stops, look at **Repeat it**. What changes each time?')).toEqual([])
  })

  it('flags raw markup even without fences', () => {
    const violations = checkAskModeFormat('Try <button onclick="go()">Go</button> right there.')
    expect(violations.some((v) => v.includes('code block'))).toBe(true)
  })

  it('flags more than 3 sentences', () => {
    const violations = checkAskModeFormat('One. Two. Three. Four?')
    expect(violations.some((v) => v.includes('sentences'))).toBe(true)
  })

  it('flags zero question marks', () => {
    const violations = checkAskModeFormat('Nice work on that button.')
    expect(violations.some((v) => v.includes('question marks'))).toBe(true)
  })

  it('flags more than one question mark', () => {
    const violations = checkAskModeFormat('Did that work? What happened next?')
    expect(violations.some((v) => v.includes('question marks'))).toBe(true)
  })

  it('flags a question that is not the final sentence', () => {
    const violations = checkAskModeFormat('What should it say? Try that next.')
    expect(violations.some((v) => v.includes('final sentence'))).toBe(true)
  })
})

describe('checkReply', () => {
  it('skips ask-mode format rules in build mode', () => {
    const context = { mode: 'build' as const, system_content: 'no checklist' }
    expect(checkReply(context, 'no question mark here.')).toEqual([])
  })

  it('applies both checks in ask mode', () => {
    const context = { mode: 'ask' as const, system_content: '- x: NOT DONE YET.' }
    const violations = checkReply(context, "You're all done! Nice work.")
    expect(violations.some((v) => v.includes('completion'))).toBe(true)
    expect(violations.some((v) => v.includes('question marks'))).toBe(true)
  })
})
