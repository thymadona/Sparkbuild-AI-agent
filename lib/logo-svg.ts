/**
 * The Student Code Builder mark as a standalone SVG string, for places that
 * cannot render the React component in `components/Logo.tsx` — Satori-rendered
 * metadata images (`app/apple-icon.tsx`, `app/opengraph-image.tsx`), which take
 * images as data URIs rather than JSX.
 *
 * `app/icon.svg` holds the same artwork as a static file. If the mark changes,
 * update all three.
 */

const MARK = `
  <g transform="translate(6,6)">
    <path d="M74 36 L24 100 L74 164" fill="none" stroke="#3a3468" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M126 36 L176 100 L126 164" fill="none" stroke="#3a3468" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 94.1 66.5 L 105.7 88.3 L 130.0 84.0 L 112.9 101.8 L 124.5 123.6 L 102.3 112.8 L 85.1 130.6 L 88.5 106.1 L 66.3 95.3 L 90.6 91.0 Z" fill="#3a3468" />
  </g>
  <path d="M74 36 L24 100 L74 164" fill="none" stroke="#3a3468" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M126 36 L176 100 L126 164" fill="none" stroke="#3a3468" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M74 36 L24 100 L74 164" fill="none" stroke="#503fcb" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M126 36 L176 100 L126 164" fill="none" stroke="#503fcb" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 94.1 66.5 L 105.7 88.3 L 130.0 84.0 L 112.9 101.8 L 124.5 123.6 L 102.3 112.8 L 85.1 130.6 L 88.5 106.1 L 66.3 95.3 L 90.6 91.0 Z" fill="#b87502" stroke="#3a3468" stroke-width="6" stroke-linejoin="round" />
`

/** The mark on an optional rounded plate, as raw SVG markup. */
export function logoSvg({ plate }: { plate?: string } = {}): string {
  const background = plate
    ? `<rect width="200" height="200" rx="44" fill="${plate}" />`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${background}${MARK}</svg>`
}

/**
 * The same markup as a `data:` URI. Satori resolves `<img src>` itself and has
 * no network access inside the image route, so metadata images embed the mark
 * this way rather than fetching `/icon.svg`.
 */
export function logoDataUri(options?: { plate?: string }): string {
  return `data:image/svg+xml;base64,${Buffer.from(logoSvg(options)).toString('base64')}`
}
