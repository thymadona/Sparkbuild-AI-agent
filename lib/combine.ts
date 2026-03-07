export function buildCombinedHtml(files: Record<string, string>): string {
  const html = files['index.html'] ?? ''
  const css = files['style.css'] ?? ''
  const js = files['script.js'] ?? ''

  // Remove external link/script references that won't resolve in srcdoc
  let combined = html
    .replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '')
    .replace(/<script[^>]+src=["'][^"']*["'][^>]*><\/script>/gi, '')

  combined = css ? combined.replace('</head>', `<style>\n${css}\n</style>\n</head>`) : combined
  combined = js ? combined.replace('</body>', `<script>\n${js}\n</script>\n</body>`) : combined
  return combined
}
