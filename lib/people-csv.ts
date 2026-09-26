import { isStaffAddableRole, normalizeEmail, type StaffAddableRole } from '@/lib/org-people'

// Parses the /staff people import. Pure: it only validates the file; the
// import route applies each good row in its own transaction, so one bad row
// never stops (or half-applies) another.
//
// Columns (header row required, any order, any case):
//   email, name, role (student|teacher), parent_email (optional)

export const MAX_CSV_ROWS = 500

export interface PersonRow {
  line: number
  email: string
  name: string
  role: StaffAddableRole
  parentEmail: string | null
}

export interface RowError {
  line: number
  email: string
  reason: string
}

export type ParseResult =
  { ok: true; rows: PersonRow[]; errors: RowError[] } | { ok: false; error: string }

const HEADER_ALIASES: Record<string, 'email' | 'name' | 'role' | 'parentEmail'> = {
  email: 'email',
  name: 'name',
  role: 'role',
  parent_email: 'parentEmail',
  'parent email': 'parentEmail',
  parentemail: 'parentEmail',
}

// RFC 4180: quoted fields, "" escapes, commas and newlines inside quotes, CRLF
// or LF line ends. Each record carries the 1-based line it starts on, so an
// error points at the line a spreadsheet shows.
export function parseCsvRecords(text: string): { line: number; fields: string[] }[] {
  const records: { line: number; fields: string[] }[] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let start = 1
  const src = text.startsWith('﻿') ? text.slice(1) : text

  const endRecord = () => {
    fields.push(field)
    if (fields.some((f) => f.trim() !== '')) records.push({ line: start, fields })
    fields = []
    field = ''
  }

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        if (c === '\n') line++
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      fields.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      endRecord()
      line++
      start = line
    } else {
      field += c
    }
  }
  if (field !== '' || fields.length > 0) endRecord()
  return records
}

export function parsePeopleCsv(text: string): ParseResult {
  const records = parseCsvRecords(text)
  if (records.length === 0) return { ok: false, error: 'The file is empty' }

  const [header, ...body] = records
  const column: Partial<Record<'email' | 'name' | 'role' | 'parentEmail', number>> = {}
  header.fields.forEach((raw, i) => {
    const key = HEADER_ALIASES[raw.trim().toLowerCase()]
    if (key && column[key] === undefined) column[key] = i
  })
  const missing = (['email', 'name', 'role'] as const).filter((k) => column[k] === undefined)
  if (missing.length > 0)
    return {
      ok: false,
      error: `The first row must name the columns email, name and role (missing: ${missing.join(', ')})`,
    }

  if (body.length === 0) return { ok: false, error: 'The file has no people in it' }
  if (body.length > MAX_CSV_ROWS)
    return { ok: false, error: `Import at most ${MAX_CSV_ROWS} people at a time` }

  const cell = (fields: string[], i: number | undefined) =>
    i === undefined ? '' : (fields[i] ?? '').trim()

  const rows: PersonRow[] = []
  const errors: RowError[] = []
  const seen = new Set<string>()

  for (const { line, fields } of body) {
    const rawEmail = cell(fields, column.email)
    const fail = (reason: string) => errors.push({ line, email: rawEmail, reason })

    const email = normalizeEmail(rawEmail)
    if (!email) {
      fail(rawEmail ? 'Not a valid email' : 'Email is missing')
      continue
    }
    const name = cell(fields, column.name)
    if (!name) {
      fail('Name is missing')
      continue
    }
    const role = cell(fields, column.role).toLowerCase()
    if (!isStaffAddableRole(role)) {
      fail('Role must be student or teacher')
      continue
    }
    const rawParent = cell(fields, column.parentEmail)
    const parentEmail = rawParent ? normalizeEmail(rawParent) : null
    if (rawParent && !parentEmail) {
      fail('Parent email is not valid')
      continue
    }
    if (seen.has(email)) {
      fail('This email is already on an earlier line')
      continue
    }
    seen.add(email)
    rows.push({ line, email, name, role, parentEmail: role === 'student' ? parentEmail : null })
  }

  return { ok: true, rows, errors }
}
