import Navbar from '@/components/Navbar'
import SignOutButton from './SignOutButton'

// Where proxy.ts sends every member of a suspended org. Nothing of theirs is
// deleted: when the org is reactivated they carry on where they left off.
export default function PausedPage() {
  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" />
      <div className="flex min-h-screen items-center justify-center px-4 pt-20 sm:px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-3xl font-bold text-fg-primary">Access is paused</h1>
          <p className="mt-3 text-fg-secondary">
            Your school’s SparkBuild access is paused for now. Your code and progress are safe. Ask
            your teacher or school when it will be back.
          </p>
          <div className="mt-8">
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  )
}
