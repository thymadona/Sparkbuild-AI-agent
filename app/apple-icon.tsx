import { ImageResponse } from 'next/og'
import { logoDataUri } from '@/lib/logo-svg'

// iOS home-screen icon. Apple ignores SVG icons, so app/icon.svg is rendered
// to PNG here rather than reused.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#f8f7ff',
        }}
      >
        <img src={logoDataUri()} alt="" width={156} height={156} />
      </div>
    ),
    size
  )
}
