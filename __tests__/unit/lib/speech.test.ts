import { stripMarkdown } from '@/lib/speech'

describe('stripMarkdown', () => {
  it('strips backticks around code', () => {
    expect(stripMarkdown('make a box called `age`')).toBe('make a box called age')
  })

  it('strips doubled asterisks around bold text', () => {
    expect(stripMarkdown('this is **important**')).toBe('this is important')
  })

  it('leaves a lone multiplication asterisk alone', () => {
    expect(stripMarkdown('2 * 3 * 4')).toBe('2 * 3 * 4')
  })
})
