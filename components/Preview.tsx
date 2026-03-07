'use client'

interface PreviewProps {
  code: string
}

export default function Preview({ code }: PreviewProps) {
  if (!code) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        Your preview will appear here after generation.
      </div>
    )
  }

  if (!code.trimStart().startsWith('<!DOCTYPE html>') && !code.trimStart().startsWith('<!doctype html>')) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-red-800 bg-red-950 p-6 max-w-sm text-center">
          <p className="text-red-300 font-medium">Invalid output</p>
          <p className="mt-1 text-sm text-red-400">
            The generated content does not appear to be a valid HTML document.
          </p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      srcDoc={code}
      sandbox="allow-scripts allow-forms"
      className="h-full w-full border-0 bg-white"
      title="Live preview"
    />
  )
}
