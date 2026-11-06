import type { Dictionary } from '@/lib/i18n/dict'

/** Questions shown on the homepage; the full set lives on /faq/. */
export const HOME_FAQ_LIMIT = 8

export function faqQuestions(dictionary: Dictionary): { q: string; a: string }[] {
  return (dictionary.faq?.questions ?? []).filter(
    (item): item is { q: string; a: string } => Boolean(item.q && item.a),
  )
}

export function homeFaqQuestions(dictionary: Dictionary): { q: string; a: string }[] {
  return faqQuestions(dictionary).slice(0, HOME_FAQ_LIMIT)
}

/** Stable per-question anchor id, e.g. `faq-3-is-smoothscroll-safe`. */
export function faqAnchorId(question: string, index: number): string {
  const slug = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return `faq-${index}-${slug || 'q'}`
}
