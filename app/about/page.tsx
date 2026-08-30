import { LESSONS } from '@/lib/lessons'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getSessionUser } from '@/lib/auth/session'

export default async function AboutPage() {
  const user = await getSessionUser()

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" isLoggedIn={!!user} />

      <main className="mx-auto max-w-3xl px-6 py-24">
        <section>
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-400">About</span>
          <h1 className="font-display mt-2 text-4xl font-bold text-fg-primary leading-tight">
            A place to learn to code<br />by building real things.
          </h1>
          <p className="mt-6 text-lg text-fg-secondary leading-relaxed">
            CodeBuilder is a guided coding platform for students aged 10–16. Instead of watching videos or memorising syntax, you build actual websites — a personal page, an interactive game, a tool that fetches live data — and an AI tutor helps you when you get stuck.
          </p>
        </section>

        <section className="mt-16 rounded-2xl border border-surface-600 bg-surface-800 p-8">
          <h2 className="font-display text-2xl font-bold text-fg-primary">For teachers and parents</h2>
          <p className="mt-3 text-fg-secondary leading-relaxed">
            Each of the 6 guided lessons takes 45–60 minutes. Students work entirely in their browser — nothing to install. Projects are saved automatically. Students can share their work with a public link. Teachers can see activity in the admin dashboard.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-fg-secondary">
            {[
              'No account setup for students — just a school email',
              'AI is in tutor mode by default — it guides, never solves for you',
              'All student work is private by default; students choose to share',
              'Works on any device with a modern browser',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-teal-600 dark:text-teal-400 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-fg-primary mb-6">The 6-week curriculum</h2>
          <div className="space-y-5">
            {LESSONS.map((lesson, i) => (
              <div key={lesson.id} className="flex gap-4">
                <span className="font-display text-xl font-bold text-brand-500/30 w-8 shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-semibold text-fg-primary">{lesson.title}</p>
                  <p className="text-sm text-fg-muted mt-0.5">{lesson.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 text-center">
          <a href="/" className="inline-block rounded-full bg-brand-500 px-8 py-3.5 font-semibold text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">
            Get started free
          </a>
        </section>
      </main>

      <Footer />
    </div>
  )
}
