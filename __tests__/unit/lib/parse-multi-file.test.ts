import { isCodeResponse, parseMultiFileResponse, parseSummary } from '@/lib/parse-multi-file'

const wellFormed = `--- FILE: index.html ---
<!DOCTYPE html>
<html></html>
--- DONE ---
Made the button round.`

const withLeadingProse = `I'll redesign the layout: add a counter and a round button.
--- FILE: index.html ---
<!DOCTYPE html>
<html></html>
--- DONE ---
Made the button round.`

const askReply = `Nice work! What should the button do when clicked?`

describe('isCodeResponse', () => {
  it('recognizes a well-formed build response', () => {
    expect(isCodeResponse(wellFormed)).toBe(true)
  })

  it('recognizes a build response even when the model prepends prose before the FILE header', () => {
    expect(isCodeResponse(withLeadingProse)).toBe(true)
  })

  it('rejects a plain ask-mode reply', () => {
    expect(isCodeResponse(askReply)).toBe(false)
  })
})

describe('parseMultiFileResponse', () => {
  it('parses files even with leading prose before the FILE header', () => {
    const parsed = parseMultiFileResponse(withLeadingProse)
    expect(parsed).toEqual({ 'index.html': '<!DOCTYPE html>\n<html></html>' })
  })

  it('returns null for a non-code reply', () => {
    expect(parseMultiFileResponse(askReply)).toBeNull()
  })
})

describe('parseSummary', () => {
  it('drops any leading prose and file blocks, keeping only the text after DONE', () => {
    expect(parseSummary(withLeadingProse)).toBe('Made the button round.')
  })
})
