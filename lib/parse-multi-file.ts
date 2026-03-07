export function parseMultiFileResponse(text: string): Record<string, string> | null {
  if (!text.includes('--- FILE:')) return null
  // Strip everything from --- DONE --- onward before parsing files
  const doneIdx = text.indexOf('--- DONE ---')
  const filesPart = doneIdx !== -1 ? text.slice(0, doneIdx) : text
  const result: Record<string, string> = {}
  const parts = filesPart.split(/^--- FILE: .+? ---$/m)
  const headers = Array.from(filesPart.matchAll(/^--- FILE: (.+?) ---$/gm))
  for (let i = 0; i < headers.length; i++) {
    result[headers[i][1].trim()] = (parts[i + 1] ?? '').trim()
  }
  return Object.keys(result).length > 0 ? result : null
}

/** Extracts the summary text after --- DONE --- if present */
export function parseSummary(text: string): string | null {
  const doneIdx = text.indexOf('--- DONE ---')
  if (doneIdx === -1) return null
  const after = text.slice(doneIdx + '--- DONE ---'.length).trim()
  return after || null
}
