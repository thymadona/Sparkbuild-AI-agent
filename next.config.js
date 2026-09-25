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
        // `require-corp`, not `credentialless`: Safari (every iPad browser)
        // ignores `credentialless`. So anything the board loads from another
        // site must send CORP or CORS headers (jsDelivr and Google Fonts do).
        // The headers only apply on a full page load, so entering and leaving
        // the board never use client-side navigation (lib/open-board.ts).
        source: '/board/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      {
        // A dedicated worker takes its COEP from its own script response, so
        // /py-worker.js needs the same policy as the board that spawns it —
        // otherwise the browser refuses to start it.
        source: '/py-worker.js',
        headers: [{ key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }],
      },
    ]
  },
}

module.exports = nextConfig
