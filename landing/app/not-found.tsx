import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Page not found.</p>
        <Link href="/en" className="text-primary underline-offset-4 hover:underline">
          Go home
        </Link>
      </div>
    </div>
  )
}
