export default function Footer() {
  return (
    <footer className="border-t border-surface-600 bg-surface-900 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between">
        <a href="/" className="font-display text-lg font-bold text-white">
          <span className="text-brand-400">Code</span>Builder
        </a>
        <nav className="flex gap-6 text-sm text-gray-500">
          <a href="/about" className="hover:text-white transition-colors">About</a>
          <a href="/lessons" className="hover:text-white transition-colors">Lessons</a>
          <a href="/explore" className="hover:text-white transition-colors">Explore</a>
        </nav>
        <p className="text-xs text-gray-600">Built for students. Powered by AI.</p>
      </div>
    </footer>
  )
}
