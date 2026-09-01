// Temporary diagnostic instrumentation for the /staff render path.
//
// The production symptom was a page that streamed its shell and then died at
// the function timeout, which tells you *that* something stalled but not
// *which* query. Rather than guess, each step records its own duration and the
// caller logs one greppable line per render:
//
//   [timing] staff-overview total=18234 prompts_total=18010 classes=6 ...
//
// Remove this once the slow step is identified and fixed.
export function marks() {
  return {} as Record<string, number>
}

export async function timed<T>(
  into: Record<string, number>,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    return await fn()
  } finally {
    into[label] = Date.now() - start
  }
}

export function logMarks(scope: string, into: Record<string, number>, total: number): void {
  const parts = Object.entries(into)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  console.log(`[timing] ${scope} total=${total} ${parts}`)
}
