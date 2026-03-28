export default function Footer() {
  return (
    <footer className="border-t border-surface-600 bg-surface-900 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between">
        <a href="/" className="font-display text-lg font-bold text-fg-primary">
          <span className="text-brand-600 dark:text-brand-400">Code</span>Builder
        </a>
        <nav className="flex gap-6 text-sm text-fg-muted">
          <a href="/about" className="hover:text-fg-primary transition-colors">About</a>
          <a href="/lessons" className="hover:text-fg-primary transition-colors">Lessons</a>
          <a href="/explore" className="hover:text-fg-primary transition-colors">Explore</a>
        </nav>
        <p className="text-xs text-fg-muted">Built for students. Powered by AI.</p>
      </div>
    </footer>
  )
}
