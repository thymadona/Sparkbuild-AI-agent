/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Preview from '@/components/Preview'

describe('Preview', () => {
  it('shows placeholder when code is empty', () => {
    render(<Preview code="" />)
    expect(screen.getByText(/preview will appear/i)).toBeInTheDocument()
  })

  it('shows error state when content does not start with <!DOCTYPE html>', () => {
    render(<Preview code="Sorry, I cannot help with that." />)
    expect(screen.getByText(/invalid output/i)).toBeInTheDocument()
    expect(screen.queryByTitle('Live preview')).not.toBeInTheDocument()
  })

  it('shows error state for plain JSON response', () => {
    render(<Preview code='{"error": "rate limited"}' />)
    expect(screen.getByText(/invalid output/i)).toBeInTheDocument()
  })

  it('renders iframe with srcDoc for valid uppercase DOCTYPE', () => {
    const html = '<!DOCTYPE html><html><body>Hello</body></html>'
    render(<Preview code={html} />)
    const iframe = screen.getByTitle('Live preview')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('srcdoc', html)
  })

  it('renders iframe for lowercase <!doctype html>', () => {
    const html = '<!doctype html><html><body>Hello</body></html>'
    render(<Preview code={html} />)
    expect(screen.getByTitle('Live preview')).toBeInTheDocument()
  })

  it('renders iframe for DOCTYPE with leading whitespace', () => {
    const html = '  <!DOCTYPE html><html><body>Hi</body></html>'
    render(<Preview code={html} />)
    expect(screen.getByTitle('Live preview')).toBeInTheDocument()
  })

  it('iframe has sandbox="allow-scripts allow-forms" (no allow-same-origin)', () => {
    const html = '<!DOCTYPE html><html><body></body></html>'
    render(<Preview code={html} />)
    const iframe = screen.getByTitle('Live preview')
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-forms')
  })
})
