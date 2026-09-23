/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import BoxesView from '@/app/board/scenes/BoxesView'

describe('BoxesView', () => {
  it('draws a key that is in the state but not in the config, after the configured ones', () => {
    render(<BoxesView config={{ boxes: [{ name: 'orc', value: 3 }] }} state={{ orc: 4, imp: 2 }} />)
    expect(screen.getAllByRole('img').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Box orc holds 4',
      'Box imp holds 2',
    ])
  })
})
