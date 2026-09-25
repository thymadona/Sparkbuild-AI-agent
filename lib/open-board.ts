// A full page load, not router.push: the board's cross-origin isolation headers
// (next.config.js) only apply when the document loads, and Python's input()
// needs them. A client-side navigation would leave the board unisolated.
export function openBoard(projectId: string) {
  // Back may restore this page from the browser cache, loading spinner and stale
  // lesson list included (a second Start would make a duplicate project): reload it.
  window.addEventListener('pageshow', (e) => e.persisted && location.reload(), { once: true })
  window.location.assign(`/board/${projectId}`)
}
