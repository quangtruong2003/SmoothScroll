const BASE_URL = 'https://smoothscroll.top'

interface JsonLdProps {
  /** Override the page URL path (e.g. "/how-it-works"). Defaults to root. */
  path?: string
}

export function JsonLd({ path = '' }: JsonLdProps) {
  const softwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SmoothScroll',
    operatingSystem: 'Windows',
    applicationCategory: 'UtilitiesApplication',
    description:
      'A 120 Hz easing engine for every wheel tick, in every app. Free, no telemetry, open-source.',
    url: `${BASE_URL}${path}`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    softwareVersion: '1.19',
    screenshot: `${BASE_URL}/assets/og-image.png`,
  }

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SmoothScroll',
    url: BASE_URL,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </>
  )
}
