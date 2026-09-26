// Client-side helpers the console's dialogs and buttons share. Every outcome
// comes from app/api/platform/orgs; these only send and describe it.

export type PersonResult = { status: 'created' | 'granted' | 'invited' }

// What happened to the named admin, in words.
export function personNotice(email: string, result: PersonResult): string {
  if (result.status === 'invited')
    return `${email} already has a SparkBuild account, so they got an invite. They join once they accept it.`
  if (result.status === 'granted') return `${email} is now an admin.`
  return `${email} is the admin. They sign in with Google on that address.`
}

export async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
  return data
}
