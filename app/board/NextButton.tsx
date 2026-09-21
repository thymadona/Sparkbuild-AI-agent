'use client'

// Shown once a step has revealed its answer: the next box opens only when the student taps it.
export default function NextButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white disabled:opacity-50"
    >
      Next ▸
    </button>
  )
}
