'use client'

import LoginForm from './LoginForm'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const featuredProjects = [
  { id: '1', title: 'My Awesome Portfolio', lessonId: 1, creator: 'Alex' },
  { id: '2', title: 'Click Counter Game', lessonId: 3, creator: 'Sam' },
  { id: '3', title: 'Mood Button Board', lessonId: 2, creator: 'Jordan' },
  { id: '4', title: 'Random Quote Machine', lessonId: 5, creator: 'Taylor' },
]

const gradients: Record<number, string> = {
  1: 'from-violet-600 to-fuchsia-600',
  2: 'from-blue-600 to-cyan-500',
  3: 'from-amber-500 to-orange-600',
  4: 'from-red-600 to-pink-500',
  5: 'from-emerald-500 to-teal-600',
  6: 'from-brand-500 to-indigo-600',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" />

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="relative animate-slide-up">
          <span className="mb-6 inline-block rounded-full bg-brand-900/80 border border-brand-800 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300">
            For students, age 10–16
          </span>
          <h1 className="font-display text-5xl font-bold leading-tight text-white sm:text-6xl">
            Build real web apps.<br />
            <span className="text-brand-400">Learn by doing.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-400 leading-relaxed">
            Type what you want to make. Your AI tutor helps you understand it — step by step. No setup, no downloads, just building.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#login" className="rounded-full bg-brand-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition-all hover:shadow-brand-500/50">
              Start building free
            </a>
            <a href="/explore" className="rounded-full border border-surface-600 px-8 py-3.5 text-base font-semibold text-gray-300 hover:border-brand-400 hover:text-white transition-colors">
              See what students built →
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="font-display text-3xl font-bold text-white text-center mb-3">How it works</h2>
        <p className="text-center text-gray-500 mb-16">Three steps. No experience needed.</p>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { step: '01', title: 'Pick a lesson', body: 'Start with a guided project — a personal page, a game, a tool. 6 lessons, each with 5 tasks.', color: 'text-brand-400' },
            { step: '02', title: 'Build with AI', body: 'Ask questions in plain English. The AI explains and guides you — it never just does it for you.', color: 'text-amber-400' },
            { step: '03', title: 'Share your work', body: 'Hit Share and get a public link. Show your teacher, your friends, the internet.', color: 'text-teal-400' },
          ].map(({ step, title, body, color }) => (
            <div key={step} className="rounded-2xl border border-surface-600 bg-surface-800 p-6">
              <span className={`font-display text-4xl font-bold ${color} opacity-60`}>{step}</span>
              <h3 className="font-display mt-3 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery preview */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl font-bold text-white">Built by students</h2>
          <a href="/explore" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">See all →</a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProjects.map((p) => (
            <div key={p.id} className="rounded-xl overflow-hidden border border-surface-600 bg-surface-800 hover:border-brand-500/50 transition-colors">
              <div className={`h-32 bg-gradient-to-br ${gradients[p.lessonId] ?? 'from-gray-600 to-gray-700'} opacity-80`} />
              <div className="p-3">
                <p className="font-semibold text-white text-sm truncate">{p.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">by {p.creator}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <div className="border-y border-surface-600 bg-surface-800/60">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-surface-600 px-6 py-8">
          {[
            { value: '500+', label: 'Students' },
            { value: '2,400+', label: 'Projects built' },
            { value: '6', label: 'Guided lessons' },
            { value: '100%', label: 'Free' },
          ].map(({ value, label }) => (
            <div key={label} className="flex-1 text-center py-4 sm:py-0 px-4">
              <p className="font-display text-3xl font-bold text-brand-400">{value}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA / Login */}
      <section id="login" className="mx-auto max-w-md px-6 py-24 text-center">
        <h2 className="font-display text-3xl font-bold text-white mb-3">Ready to start?</h2>
        <p className="text-gray-400 mb-8">No password needed. Just your school email.</p>
        <LoginForm />
      </section>

      <Footer />
    </div>
  )
}
