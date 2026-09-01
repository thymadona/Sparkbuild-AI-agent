import { ImageResponse } from 'next/og'
import { logoDataUri } from '@/lib/logo-svg'

// Link preview card for social/chat unfurls (Telegram, Slack, X, iMessage…).
export const alt = 'Student Code Builder'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#f8f7ff',
          fontFamily: 'sans-serif',
        }}
      >
        <img src={logoDataUri()} alt="" width={240} height={240} />
        <div
          style={{
            display: 'flex',
            marginTop: 36,
            fontSize: 68,
            fontWeight: 700,
            color: '#1b1b2f',
            letterSpacing: -1,
          }}
        >
          Student Code Builder
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 16,
            fontSize: 34,
            color: '#503fcb',
          }}
        >
          Build web apps with AI — type a prompt, get a live preview
        </div>
      </div>
    ),
    size
  )
}
