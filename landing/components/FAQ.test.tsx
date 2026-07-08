import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FAQ } from './sections/FAQ'

const mockDict = {
  faq: {
    title: 'FAQ',
    questions: [
      { q: 'Question 1?', a: 'Answer 1' },
      { q: 'Question 2?', a: 'Answer 2' },
      { q: 'Question 3?', a: 'Answer 3' },
    ],
  },
}

describe('FAQ', () => {
  it('allows multiple items to be open simultaneously', async () => {
    const user = userEvent.setup()
    render(<FAQ dict={mockDict} />)

    const accordionTriggers = screen.getAllByRole('button').slice(1)
    await user.click(accordionTriggers[0])
    await user.click(accordionTriggers[1])

    expect(screen.getByText('Answer 1')).toBeVisible()
    expect(screen.getByText('Answer 2')).toBeVisible()
  })

  it('renders Expand all button when more than 1 question', () => {
    render(<FAQ dict={mockDict} />)
    expect(screen.getByRole('button', { name: /expand all/i })).toBeInTheDocument()
  })

  it('clicking Expand all opens every question', async () => {
    const user = userEvent.setup()
    render(<FAQ dict={mockDict} />)

    await user.click(screen.getByRole('button', { name: /expand all/i }))

    expect(screen.getByText('Answer 1')).toBeVisible()
    expect(screen.getByText('Answer 2')).toBeVisible()
    expect(screen.getByText('Answer 3')).toBeVisible()
  })

  it('clicking Collapse all closes every question', async () => {
    const user = userEvent.setup()
    render(<FAQ dict={mockDict} />)

    const expandAll = screen.getByRole('button', { name: /expand all/i })
    await user.click(expandAll)
    await user.click(screen.getByRole('button', { name: /collapse all/i }))

    expect(screen.queryByText('Answer 1')).toBeNull()
    expect(screen.queryByText('Answer 2')).toBeNull()
  })
})
