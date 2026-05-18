import Link from 'next/link'

interface FooterProps {
  locale: string
  dict: {
    footer?: {
      tagline?: string
      links?: { github?: string; license?: string }
    }
  }
}

export function Footer({ locale, dict }: FooterProps) {
  const { footer: f = { tagline: '', links: { github: '', license: '' } } } = dict

  return (
    <footer className="border-t py-8 mt-16 pb-32 sm:pb-8">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{f.tagline ?? ''}</p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="https://github.com/quangtruong2003/SmoothScroll" className="hover:text-foreground transition-colors">
            {f.links?.github ?? ''}
          </Link>
          <Link href="https://github.com/quangtruong2003/SmoothScroll/blob/main/LICENSE" className="hover:text-foreground transition-colors">
            {f.links?.license ?? ''}
          </Link>
        </div>
      </div>
    </footer>
  )
}
