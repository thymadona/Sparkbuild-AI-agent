import nextConfig from '@/next.config.js'

// Python's input() on the board needs cross-origin isolation. require-corp (not
// credentialless) so iPad Safari is isolated too, and the worker must match the page.
describe('next.config.js headers', () => {
  it('isolates the board and gives the worker the same COEP', async () => {
    const rules = await nextConfig.headers!()
    const of = (source: string) =>
      Object.fromEntries(
        rules.find((r) => r.source === source)!.headers.map((h) => [h.key, h.value])
      )
    expect(of('/board/:path*')).toEqual({
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    })
    expect(of('/py-worker.js')).toEqual({ 'Cross-Origin-Embedder-Policy': 'require-corp' })
    expect(rules.some((r) => r.source.includes('/editor'))).toBe(false)
  })
})
