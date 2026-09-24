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
        // as Google avatars loading. Without isolation (any browser on /board
        // today) the worker has no SharedArrayBuffer, so input() only reads the
        // `inputs` passed to run() up front and gets end-of-file after that.
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
    ]
  },
}

module.exports = nextConfig
