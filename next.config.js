/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is the default builder in Next 16 and infers the workspace root
  // from the nearest lockfile. An unrelated package-lock.json in a parent
  // directory made it guess wrong, so pin it to this project.
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
