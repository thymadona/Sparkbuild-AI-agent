import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  MessageSquareCode,
  PlayCircle,
  Trophy,
  X,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Mascot from '@/app/board/Mascot'
import { LESSONS, lessonDisplayTitle } from '@/lib/lessons'
import { getSessionUser } from '@/lib/auth/session'

const FEATURES = [
  {
    icon: MessageSquareCode,
    chipClass: 'bg-teal-400',
    title: 'Watch it, then predict it',
    description:
      'Sparky demos the idea on the board first. Your child predicts what happens next before anything is spelled out, so the guess is the lesson.',
  },
  {
    icon: CheckCircle2,
    chipClass: 'bg-secondary',
    title: 'Tap, match, and debug, not just click Next',
    description:
      'Concept checks vary by lesson: tap the blocks that turn 5 into 11, match a piece to its job, spot the missing line. A miss gets an explanation, never a silent skip forward.',
  },
  {
    icon: PlayCircle,
    chipClass: 'bg-amber-300',
    title: 'Real code, real output, right there',
    description:
      "The keyboard opens once the board shows the idea landed. Then it's a live code editor with a Run button, and Sparky narrates the actual code your child just ran.",
  },
] as const

const PROBLEM_LIST = [
  'Type a prompt, the AI builds the whole project',
  'The student watches it appear and hits submit',
  'No way to tell whether the student understood any of it',
]

const SOLUTION_LIST = [
  'The AI tutor walks the board with them before it writes a line',
  'The keyboard stays locked until the board shows they understand',
  'Every lesson leaves evidence a parent or teacher can actually see',
]

const JOURNEY_WEEKS = LESSONS.slice(3, 6)

export default async function Home() {
  const user = await getSessionUser()
  const isLoggedIn = !!user

  const heroCta = isLoggedIn
    ? { href: '/lessons', label: 'Go to lessons' }
    : { href: '/register', label: "Start your child's first lesson free" }
  const bannerCta = isLoggedIn
    ? { href: '/lessons', label: 'Go to lessons' }
    : { href: '/register', label: 'Start your first lesson' }

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" isLoggedIn={isLoggedIn} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b-2 border-surface-600 px-6 pb-20 pt-32 md:pt-40">
          <div className="mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-2">
            <div>
              <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-800 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
                AI-directed coding · Ages 10–16
              </span>
              <h1 className="mt-6 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg lg:text-display-xl">
                Kids who learn to code with AI, not from it.
              </h1>
              <p className="mt-6 max-w-lg text-body-lg text-fg-secondary">
                SparkBuild&apos;s AI tutor won&apos;t finish the project for your child. It
                won&apos;t let them move on until they&apos;ve proven they understand it themselves:
                building real judgment, not just working code.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <Link
                  href={heroCta.href}
                  className="group inline-flex items-center gap-2 rounded-lg border-2 border-surface-600 bg-brand-500 px-6 py-3.5 font-display text-base font-bold text-white shadow-hard-lg transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {heroCta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="text-sm font-bold text-brand-600 transition-colors hover:text-brand-500"
                >
                  See how the board works ↓
                </Link>
              </div>
            </div>

            {/* Board preview mock — purely illustrative, everything it shows is already said in text */}
            <div
              aria-hidden="true"
              className="mx-auto w-full max-w-xl rounded-xl border-2 border-surface-600 bg-surface-800 p-5 shadow-hard-lg"
            >
              <div className="mb-5 flex items-center gap-4">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-700">
                  <div className="h-full w-[62%] rounded-full bg-spark" />
                </div>
                <span className="flex shrink-0 items-center gap-1 font-display text-sm font-bold text-fg-primary">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  80 XP
                </span>
              </div>
              <p className="mb-3 font-display text-base font-bold text-fg-primary">
                Meet print. Watch Sparky.
              </p>
              <div className="mb-3 flex items-center justify-between gap-4 rounded-lg bg-brand-800 px-4 py-3.5">
                <code className="font-mono text-sm text-brand-50">
                  print(
                  <span className="rounded bg-amber-400 px-1 text-brand-800">
                    &quot;hello&quot;
                  </span>
                  )
                </code>
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <div className="rounded-lg bg-surface-900 px-3 py-1 text-xs font-bold text-fg-primary">
                    hello
                  </div>
                  <Mascot state="speaking" className="size-9" />
                </div>
              </div>
              <p className="mb-4 text-sm font-semibold text-fg-muted">
                Sparky says only the words.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fg-secondary">3 of 3</span>
                <span className="rounded-full border-2 border-surface-600 px-3 py-1 text-xs font-bold text-fg-primary">
                  ↺ Again
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section id="problem" className="border-b-2 border-surface-600 bg-surface-800 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-900 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
                The problem
              </span>
              <h2 className="mt-4 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg">
                Most &quot;AI coding&quot; apps for kids just watch the AI build it.
              </h2>
              <p className="mt-4 text-body-lg text-fg-secondary">
                Schools can see what a student submitted. They can&apos;t see whether the student,
                or the AI, did the thinking.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-surface-600 bg-surface-900 p-6">
                <h3 className="text-label-caps uppercase text-fg-muted">Most AI coding apps</h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {PROBLEM_LIST.map((line) => (
                    <li key={line} className="flex gap-3 text-sm text-fg-secondary">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border-2 border-spark bg-surface-800 p-6 shadow-hard">
                <h3 className="text-label-caps uppercase text-fg-muted">SparkBuild</h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {SOLUTION_LIST.map((line) => (
                    <li key={line} className="flex gap-3 text-sm text-fg-primary">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-spark" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b-2 border-surface-600 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-800 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
                How it works
              </span>
              <h2 className="mt-4 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg">
                Every lesson happens on one board.
              </h2>
              <p className="mt-4 text-body-lg text-fg-secondary">
                Sparky walks your child through the idea on the board: watch it, predict it, tap it,
                before the keyboard ever opens.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {FEATURES.map(({ icon: Icon, chipClass, title, description }) => (
                <div
                  key={title}
                  className="flex h-full flex-col rounded-xl border-2 border-surface-600 bg-surface-800 p-6 shadow-hard-lg"
                >
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full border-2 border-surface-600 ${chipClass}`}
                  >
                    <Icon className="h-6 w-6 text-fg-primary" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-fg-primary">{title}</h3>
                  <p className="mt-3 text-sm text-fg-secondary">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Journey */}
        <section id="journey" className="border-b-2 border-surface-600 bg-surface-800 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-900 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
                Your journey
              </span>
              <h2 className="mt-4 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg">
                Learning that feels like a game, because grinding through variables shouldn&apos;t
                feel like a chore.
              </h2>
              <p className="mt-4 text-body-lg text-fg-secondary">
                Six weeks, one path, harder every week. XP, streaks and badges keep the momentum,
                but none of it unlocks the next lesson: only real understanding does that.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-6">
                <p className="sr-only">Lesson 4 of 6</p>
                <div aria-hidden="true" className="flex items-center gap-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-teal-500 bg-teal-400 text-sm font-bold text-fg-primary"
                    >
                      ✓
                    </div>
                  ))}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-surface-600 bg-brand-500 text-sm font-bold text-white">
                    4
                  </div>
                  {[5, 6].map((n) => (
                    <div
                      key={n}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-surface-600 bg-surface-900 text-sm font-bold text-fg-muted"
                    >
                      {n}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4">
                  {JOURNEY_WEEKS.map((lesson, i) => (
                    <div
                      key={lesson.id}
                      className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 bg-surface-900 p-5 ${
                        i === 0 ? 'border-spark shadow-hard-lg' : 'border-surface-600 shadow-hard'
                      }`}
                    >
                      <div>
                        {lesson.badge && (
                          <span className="text-label-caps uppercase text-fg-muted">
                            {lesson.badge}
                          </span>
                        )}
                        <h3 className="mt-1 font-display text-lg font-bold text-fg-primary">
                          {lessonDisplayTitle(lesson)}
                        </h3>
                        <p className="mt-1 text-sm text-fg-secondary">{lesson.description}</p>
                      </div>
                      <Link
                        href={isLoggedIn ? '/lessons' : '/register'}
                        className="shrink-0 rounded-full bg-surface-700 px-4 py-2 text-sm font-bold text-fg-primary transition-colors hover:bg-surface-600"
                      >
                        {i === 0 ? 'Start' : 'Start →'}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="h-fit rounded-xl border-2 border-surface-600 bg-surface-900 p-6 shadow-hard">
                <p className="text-label-caps uppercase text-fg-muted">Your level</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-fg-primary">Rookie</h3>
                <div className="mt-3 flex items-center gap-2 text-sm font-bold text-spark">
                  <Flame className="h-4 w-4" />
                  4-day streak
                </div>
                <div className="mt-5 flex justify-between text-xs font-bold text-fg-secondary">
                  <span>80 XP</span>
                  <span>20 to Coder</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-700">
                  <div className="h-full w-4/5 rounded-full bg-spark" />
                </div>
                <p className="mt-5 text-label-caps uppercase text-fg-muted">Badges</p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-300 px-3 py-1.5 text-sm font-bold text-fg-primary">
                  <Trophy className="h-4 w-4" />
                  Robot Whisperer
                </div>
                <p className="mt-5 text-xs text-fg-muted">Example student progress</p>
              </aside>
            </div>
          </div>
        </section>

        {/* Schools */}
        <section id="schools" className="px-6 py-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-500 px-8 py-14 text-white sm:px-14">
            <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <span className="inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-label-caps uppercase text-white/80">
                  For schools
                </span>
                <h2 className="mt-4 font-display text-headline-lg-mobile sm:text-headline-lg">
                  Also built for classrooms.
                </h2>
                <p className="mt-4 max-w-xl text-body-md text-white/80">
                  SparkBuild runs as a partnered coding elective too: same AI tutor, same
                  board-first teaching, and evidence a teacher can actually use to see who
                  understood the lesson. We&apos;re inviting a small group of Phnom Penh schools to
                  pilot it this term.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-surface-600 bg-amber-300 px-6 py-3.5 font-display text-base font-bold text-fg-primary shadow-hard-lg transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  Partner your school
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <span className="text-sm text-white/70">
                  One free trial session, no term-long commitment.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-y-2 border-surface-600 bg-brand-500 px-6 py-24 text-center text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-headline-lg-mobile sm:text-headline-lg lg:text-display-xl">
              Start today, for free.
            </h2>
            <p className="mt-4 text-body-lg text-white/85">
              Your child&apos;s first lesson is on us. No credit card, no commitment: just Sparky
              the robot and one honest question. Do you actually understand what you just built?
            </p>
            <Link
              href={bannerCta.href}
              className="mt-10 inline-flex items-center gap-3 rounded-xl border-2 border-surface-600 bg-amber-300 px-8 py-4 font-display text-lg font-extrabold text-fg-primary shadow-hard-lg transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
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
