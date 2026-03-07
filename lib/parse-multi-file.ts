export function parseMultiFileResponse(text: string): Record<string, string> | null {
  if (!text.includes('--- FILE:')) return null
  const result: Record<string, string> = {}
  const parts = text.split(/^--- FILE: .+? ---$/m)
  const headers = Array.from(text.matchAll(/^--- FILE: (.+?) ---$/gm))
  for (let i = 0; i < headers.length; i++) {
    result[headers[i][1].trim()] = (parts[i + 1] ?? '').trim()
  }
  return Object.keys(result).length > 0 ? result : null
}
