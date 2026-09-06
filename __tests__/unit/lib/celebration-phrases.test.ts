import { pickPhrase } from '@/lib/celebration-phrases'

describe('pickPhrase', () => {
  it('never returns the same phrase as lastPhrase when the bank has other options', () => {
    const bank = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) {
      expect(pickPhrase(bank, 'a')).not.toBe('a')
    }
  })

  it('returns the only phrase when the bank has just one', () => {
    expect(pickPhrase(['only'], 'only')).toBe('only')
  })

  it('returns a phrase from the bank when there is no last phrase', () => {
    const bank = ['a', 'b']
    expect(bank).toContain(pickPhrase(bank, null))
  })
})
