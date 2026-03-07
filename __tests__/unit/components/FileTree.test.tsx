/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import FileTree from '@/components/FileTree'

describe('FileTree', () => {
  it('shows empty state when files object is empty', () => {
    render(<FileTree files={{}} />)
    expect(screen.getByText(/no files yet/i)).toBeInTheDocument()
  })

  it('renders a single file name', () => {
    render(<FileTree files={{ 'index.html': '<!DOCTYPE html>' }} />)
    expect(screen.getByText('index.html')).toBeInTheDocument()
  })

  it('renders multiple file names', () => {
    render(<FileTree files={{ 'index.html': '...', 'style.css': '...' }} />)
    expect(screen.getByText('index.html')).toBeInTheDocument()
    expect(screen.getByText('style.css')).toBeInTheDocument()
  })

  it('does not show empty-state text when files are present', () => {
    render(<FileTree files={{ 'index.html': '' }} />)
    expect(screen.queryByText(/no files yet/i)).not.toBeInTheDocument()
  })
})
