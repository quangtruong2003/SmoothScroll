const REPO = 'quangtruong2003/SmoothScroll'
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`
const NON_INSTALLER_EXT = /\.(sig|json|blockmap|sha256|sha512|asc|txt|md)$/i

interface Asset {
  name: string
  browser_download_url: string
}

interface Release {
  tag_name: string
  assets: Asset[]
}

function pickInstaller(assets: Asset[], os: string): string | null {
  const installables = assets.filter((a) => !NON_INSTALLER_EXT.test(a.name))

  if (os === 'mac') {
    const dmg = installables.find((a) => a.name.toLowerCase().endsWith('.dmg'))
    return dmg?.browser_download_url ?? null
  }

  const exe = installables.find((a) => a.name.toLowerCase().endsWith('.exe'))
  if (exe) return exe.browser_download_url
  const msi = installables.find((a) => a.name.toLowerCase().endsWith('.msi'))
  return msi?.browser_download_url ?? null
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const os = searchParams.get('os') ?? 'win'

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'SmoothScroll-Landing',
        },
        next: { revalidate: 600 },
      },
    )
    if (!res.ok) {
      return Response.redirect(RELEASES_PAGE, 302)
    }
    const data = (await res.json()) as Release
    const installerUrl = pickInstaller(data.assets, os)
    if (installerUrl) {
      return Response.redirect(installerUrl, 302)
    }
    return Response.redirect(RELEASES_PAGE, 302)
  } catch {
    return Response.redirect(RELEASES_PAGE, 302)
  }
}
