'use client'

export { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Toaster>

export function Toaster({ ...props }: ToasterProps) {
  return <Toaster solid toastOptions={{}} {...props} />
}
