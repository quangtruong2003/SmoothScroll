import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['en', 'vi', 'zh'] as const
const defaultLocale = 'en'

function getLocaleFromPathname(pathname: string): string | null {
  const firstSegment = pathname.split('/')[1]
  if (locales.includes(firstSegment as (typeof locales)[number])) {
    return firstSegment
  }
  return null
}

function getLocaleFromHeaders(request: NextRequest): string {
  const acceptLang = request.headers.get('accept-language')
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0].split('-')[0].trim()
    if (locales.includes(preferred as (typeof locales)[number])) {
      return preferred
    }
  }
  return defaultLocale
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip internal paths
  if (pathname.startsWith('/_next') || pathname.startsWith('/assets') || pathname.includes('.')) {
    return NextResponse.next()
  }

  const pathLocale = getLocaleFromPathname(pathname)

  if (pathLocale === defaultLocale) {
    // /en/... → rewrite to /en/... internally (keep URL as /en/... for direct access)
    const response = NextResponse.rewrite(new URL(pathname, request.url))
    response.cookies.set('NEXT_LOCALE', defaultLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
    return response
  }

  if (!pathLocale) {
    // No locale in path — rewrite to default locale
    const response = NextResponse.rewrite(new URL(`/en${pathname}`, request.url))
    response.cookies.set('NEXT_LOCALE', defaultLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
    return response
  }

  // Non-default locale with prefix — set cookie and continue
  const response = NextResponse.next()
  response.cookies.set('NEXT_LOCALE', pathLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return response
}

export const config = {
  matcher: ['/((?!_next|assets|.*\\.).*)'],
}
