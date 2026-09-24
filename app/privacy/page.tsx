import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getSessionUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Privacy Policy · SparkBuild' }

const CONTACT_EMAIL = 'thymadonakh@gmail.com'

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What we collect',
    body: [
      'Your Google account basics: your name, email address and profile picture, which Google shares when you sign in. We never see your Google password.',
      'What you do in the course: the Python code you write, your chats with the AI tutor and helper, and which tasks and lessons you have finished.',
      'Class details your teacher adds, such as your full name, your class, and a parent’s email or Telegram contact used for class invoices and receipts.',
      'Sign-in session records, including the IP address and browser type, so we can keep your account secure.',
    ],
  },
  {
    title: 'How we use it',
    body: [
      'To run the course: sign you in, save your work, track your progress, and let your teacher see how you are doing.',
      'To power the AI tutor: your messages and code are sent to our AI provider (DeepSeek) to generate replies. We do not send your email address.',
      'To send class invoices and receipts to parents over Telegram, when a teacher chooses to.',
      'We do not sell your data, show ads, or use tracking or advertising cookies. The only cookie we set keeps you signed in.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'Your teachers and SparkBuild administrators can see your profile, code, chats and progress.',
      'Service providers that host or process data for us: Vercel (hosting), our database host, Google (sign-in), DeepSeek (AI replies) and Telegram (messages to parents). They only use it to provide their service to us.',
      'We may disclose information if the law requires it.',
    ],
  },
  {
    title: 'Google user data',
    body: [
      'We only request your basic Google profile (name, email, picture) to sign you in. We do not access your Gmail, Drive, contacts or any other Google data.',
      'SparkBuild’s use of information received from Google APIs follows the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    title: 'Children',
    body: [
      'SparkBuild is built for students aged 11–16 and is used through schools and classes. Accounts are set up with a teacher, and we collect only what is needed to run the course.',
    ],
  },
  {
    title: 'Keeping and deleting data',
    body: [
      'We keep your data while your account is active. You, a parent, or your school can ask us to see, correct or delete it at any time by emailing us. Deleting an account removes its code, chats and progress.',
    ],
  },
  {
    title: 'Changes',
    body: [
      'If we change this policy we will update this page and the date below. Big changes will be shared with schools first.',
    ],
  },
]

export default async function PrivacyPage() {
  const isLoggedIn = !!(await getSessionUser())

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" isLoggedIn={isLoggedIn} />

      <main className="mx-auto max-w-3xl px-6 py-24">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-400">
          Privacy
        </span>
        <h1 className="font-display mt-2 text-4xl font-bold text-fg-primary leading-tight">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-fg-muted">Last updated: 24 September 2026</p>
        <p className="mt-6 text-lg text-fg-secondary leading-relaxed">
          SparkBuild (sparkbuild.space) is a Python coding course for students. This page explains
          what information we collect, why, and what you can do about it.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-12">
            <h2 className="font-display text-2xl font-bold text-fg-primary">{s.title}</h2>
            <ul className="mt-4 space-y-3 text-fg-secondary leading-relaxed">
              {s.body.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-12 rounded-2xl border border-surface-600 bg-surface-800 p-8">
          <h2 className="font-display text-2xl font-bold text-fg-primary">Contact</h2>
          <p className="mt-3 text-fg-secondary leading-relaxed">
            Questions or requests about your data? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-400 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
