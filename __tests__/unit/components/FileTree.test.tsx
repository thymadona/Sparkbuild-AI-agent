/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import FileTree from '@/components/FileTree'

describe('FileTree', () => {
  it('shows empty state when files object is empty', () => {
    render(<FileTree files={{}} onAddFile={jest.fn()} />)
    expect(screen.getByText(/no files yet/i)).toBeInTheDocument()
  })

  it('renders a single file name', () => {
    render(<FileTree files={{ 'index.html': '<!DOCTYPE html>' }} onAddFile={jest.fn()} />)
    expect(screen.getByText('index.html')).toBeInTheDocument()
  })

  it('renders multiple file names', () => {
    render(<FileTree files={{ 'index.html': '...', 'style.css': '...' }} onAddFile={jest.fn()} />)
    expect(screen.getByText('index.html')).toBeInTheDocument()
    expect(screen.getByText('style.css')).toBeInTheDocument()
  })

  it('does not show empty-state text when files are present', () => {
    render(<FileTree files={{ 'index.html': '' }} onAddFile={jest.fn()} />)
    expect(screen.queryByText(/no files yet/i)).not.toBeInTheDocument()
  })
})
