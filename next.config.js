/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is the default builder in Next 16 and infers the workspace root
  // from the nearest lockfile. An unrelated package-lock.json in a parent
  // directory made it guess wrong, so pin it to this project.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Cross-origin isolation gives Python's input() a SharedArrayBuffer.
        // `credentialless` (not require-corp) keeps third-party images such
        // as Google avatars loading; browsers without it fall back to an
        // up-front inputs box in PythonRunner.
        source: '/editor/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
      {
        // A dedicated worker takes its COEP from its own script response, so
        // /py-worker.js needs the same policy as the isolated editor page that
        // spawns it — otherwise the browser refuses to start it and Python
        // "loads" forever.
        source: '/py-worker.js',
        headers: [{ key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' }],
      },
      {
        // Lesson templates are re-fetched on every "Start lesson" click.
        // Short max-age + background revalidation avoids re-fetching within
        // a session without risking long-lived staleness — nothing
        // guarantees a template file's content never changes without its
        // filename changing (that guarantee only covers lib/lessons.ts
        // catalog versions, not the HTML files themselves).
        source: '/templates/:path*.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=86400',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
