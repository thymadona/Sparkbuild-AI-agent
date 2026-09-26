import { MAX_CSV_ROWS, parseCsvRecords, parsePeopleCsv } from '@/lib/people-csv'

const ok = (text: string) => {
  const result = parsePeopleCsv(text)
  if (!result.ok) throw new Error(result.error)
  return result
}

describe('parseCsvRecords', () => {
  it('handles quotes, escaped quotes, commas and newlines inside quotes, CRLF and a BOM', () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n"two\nlines",z\n'
    expect(parseCsvRecords(text)).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['x, y', 'say "hi"'] },
      { line: 4, fields: ['two\nlines', 'z'] },
    ])
  })

  it('keeps a last line with no newline', () => {
    expect(parseCsvRecords('a\nb')).toEqual([
      { line: 1, fields: ['a'] },
      { line: 2, fields: ['b'] },
    ])
  })
})

describe('parsePeopleCsv', () => {
  it('reads the columns in any order and case, normalising email and role', () => {
    const { rows, errors } = ok(
      'Role,EMAIL,Name,Parent Email\nStudent, Dara@School.TEST ,Sok Dara,mum@home.test\nteacher,t@school.test,Ms T,\n'
    )
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        line: 2,
        email: 'dara@school.test',
        name: 'Sok Dara',
        role: 'student',
        parentEmail: 'mum@home.test',
      },
      { line: 3, email: 't@school.test', name: 'Ms T', role: 'teacher', parentEmail: null },
    ])
  })

  it('reports each bad row with its line and a reason, and keeps the good ones', () => {
    const { rows, errors } = ok(
      [
        'email,name,role,parent_email',
        'good@x.test,Good,student,',
        'not-an-email,Bad,student,',
        ',No Email,student,',
        'noname@x.test,,student,',
        'admin@x.test,Boss,admin,',
        'kid@x.test,Kid,student,nope',
        'good@x.test,Again,teacher,',
      ].join('\n')
    )
    expect(rows.map((r) => r.email)).toEqual(['good@x.test'])
    expect(errors).toEqual([
      { line: 3, email: 'not-an-email', reason: 'Not a valid email' },
      { line: 4, email: '', reason: 'Email is missing' },
      { line: 5, email: 'noname@x.test', reason: 'Name is missing' },
      { line: 6, email: 'admin@x.test', reason: 'Role must be student or teacher' },
      { line: 7, email: 'kid@x.test', reason: 'Parent email is not valid' },
      { line: 8, email: 'good@x.test', reason: 'This email is already on an earlier line' },
    ])
  })

  it('rejects the whole file when a required column is missing', () => {
    const result = parsePeopleCsv('email,name\na@x.test,A\n')
    expect(result).toEqual({ ok: false, error: expect.stringContaining('missing: role') })
  })

  it('rejects an empty file and a header with no people', () => {
    expect(parsePeopleCsv('').ok).toBe(false)
    expect(parsePeopleCsv('email,name,role\n').ok).toBe(false)
  })

  it(`rejects more than ${MAX_CSV_ROWS} rows before anything applies`, () => {
    const body = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `p${i}@x.test,P,student`)
    const result = parsePeopleCsv(['email,name,role', ...body].join('\n'))
    expect(result).toEqual({ ok: false, error: expect.stringContaining(`${MAX_CSV_ROWS}`) })
    expect(ok(['email,name,role', ...body.slice(1)].join('\n')).rows).toHaveLength(MAX_CSV_ROWS)
  })
})
