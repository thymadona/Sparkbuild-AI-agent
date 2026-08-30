import Link from 'next/link'
import { ArrowRight, CheckCircle2, MessageSquareCode, PlayCircle, Share2, Star } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { LESSONS } from '@/lib/lessons'
import { getSessionUser } from '@/lib/auth/session'

// Fixed dark text for chips whose fill (teal-400/amber-300/secondary) stays
// bright in both themes — fg-primary would flip to near-white in dark mode
// and vanish against them.
const ON_CHIP = 'text-slate-900'

const FEATURES = [
  {
    icon: MessageSquareCode,
    chipClass: 'bg-teal-400',
    title: 'Ask mode teaches. Build mode ships.',
    description: 'The AI tutors by default and only writes full code once a task says you\'re ready — it guides, it doesn\'t solve.',
  },
  {
    icon: CheckCircle2,
    chipClass: 'bg-secondary',
    title: 'Tasks unlock as you learn',
    description: 'Each lesson checks your actual code before it lets you mark a task done — no boxes ticked for work you didn\'t do.',
  },
  {
    icon: Share2,
    chipClass: 'bg-amber-300',
    title: 'Ship it, share it',
    description: 'Every project gets a live link. Show your family, remix a classmate\'s, or browse what everyone else built.',
  },
] as const

export default async function Home() {
  const user = await getSessionUser()
  const isLoggedIn = !!user

  const heroCta = isLoggedIn
    ? { href: '/dashboard', label: 'Go to dashboard' }
    : { href: '/register', label: 'Start building free' }
  const bannerCta = isLoggedIn
    ? { href: '/dashboard', label: 'Go to dashboard' }
    : { href: '/register', label: 'Create your free account' }

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" isLoggedIn={isLoggedIn} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b-2 border-surface-600 px-6 pb-20 pt-32 md:pt-40">
          <div className="mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-2">
            <div>
              <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-800 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
                AI-assisted coding · ages 10–16
              </span>
              <h1 className="mt-6 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg lg:text-display-xl">
                Build the future, one{' '}
                <span className="inline-block -rotate-2 rounded-md border-2 border-surface-600 bg-secondary px-2 text-white">
                  line
                </span>
                <br />
                at a time.
              </h1>
              <p className="mt-6 max-w-md text-body-lg text-fg-secondary">
                Six weeks, six real projects. An AI tutor that nudges instead of solving, so what ships is actually yours.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={heroCta.href}
                  className="group inline-flex items-center gap-2 rounded-lg border-2 border-surface-600 bg-brand-500 px-6 py-3.5 font-display text-base font-bold text-white shadow-hard-lg transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {heroCta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/about"
                  className="rounded-lg border-2 border-surface-600 bg-surface-800 px-6 py-3.5 font-display text-base font-bold text-fg-primary shadow-hard-lg transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  See the curriculum
                </Link>
              </div>
            </div>

            {/* Demo video — real product walkthrough, replaces a static screenshot */}
            <div className="relative mx-auto w-full max-w-xl">
              <div className="aspect-video w-full overflow-hidden rounded-xl border-2 border-surface-600 bg-surface-800 shadow-hard-lg">
                <iframe
                  src="https://player.vimeo.com/video/1218045859?title=0&byline=0&portrait=0"
                  className="h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title="SparkBuild demo"
                />
              </div>
              <div className="absolute -right-4 -top-4 flex h-14 w-14 rotate-6 items-center justify-center rounded-full border-2 border-surface-600 bg-amber-300 shadow-hard">
                <Star className={`h-6 w-6 fill-current ${ON_CHIP}`} />
              </div>
              <div className="absolute -bottom-6 -left-6 -rotate-3 rounded-lg border-2 border-surface-600 bg-teal-400 px-4 py-2 shadow-hard">
                <div className="flex items-center gap-2">
                  <PlayCircle className={`h-4 w-4 ${ON_CHIP}`} />
                  <span className={`text-sm font-bold ${ON_CHIP}`}>Watch demo</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why it sticks */}
        <section className="border-b-2 border-surface-600 bg-surface-800 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg">
              Why it actually sticks
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {FEATURES.map(({ icon: Icon, chipClass, title, description }) => (
                <div
                  key={title}
                  className="flex h-full flex-col rounded-xl border-2 border-surface-600 bg-surface-900 p-6 shadow-hard-lg"
                >
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full border-2 border-surface-600 ${chipClass}`}>
                    <Icon className={`h-6 w-6 ${ON_CHIP}`} />
                  </div>
                  <h3 className="font-display text-lg font-bold text-fg-primary">{title}</h3>
                  <p className="mt-3 text-sm text-fg-secondary">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Curriculum preview */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg">
                Six weeks. Six real builds.
              </h2>
              <Link
                href="/about"
                className="text-sm font-bold text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
              >
                See the full curriculum →
              </Link>
            </div>
            <div className="mt-10 flex gap-5 overflow-x-auto pb-4">
              {LESSONS.map((lesson, i) => (
                <div
                  key={lesson.id}
                  className="w-64 shrink-0 rounded-xl border-2 border-surface-600 bg-surface-800 p-6 shadow-hard"
                >
                  <span className="font-display text-3xl font-extrabold text-brand-500/30">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold text-fg-primary">{lesson.title}</h3>
                  <p className="mt-2 text-sm text-fg-secondary">{lesson.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="relative overflow-hidden border-y-2 border-surface-600 bg-brand-500 px-6 py-24 text-center text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-headline-lg-mobile sm:text-headline-lg lg:text-display-xl">
              Ready to build something weird?
            </h2>
            <p className="mt-4 text-body-lg text-white/85">
              {isLoggedIn
                ? 'Pick up right where you left off.'
                : 'No install, no setup. Just a school email and your first idea.'}
            </p>
            <Link
              href={bannerCta.href}
              className={`mt-10 inline-flex items-center gap-3 rounded-xl border-2 border-surface-600 bg-amber-300 px-8 py-4 font-display text-lg font-extrabold shadow-hard-lg transition-all active:translate-x-1 active:translate-y-1 active:shadow-none ${ON_CHIP}`}
            >
              {bannerCta.label}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
