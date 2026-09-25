// A full page load, not router.push: the board's cross-origin isolation headers
// (next.config.js) only apply when the document loads, and Python's input()
// needs them. A client-side navigation would leave the board unisolated.
export function openBoard(projectId: string) {
  window.location.assign(`/board/${projectId}`)
}
