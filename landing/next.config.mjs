import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

let appVersion = 'latest'
for (const [relPath, pickVersion] of [
  ['../src-tauri/tauri.conf.json', (c) => c.version],
  ['./lib/i18n/en.json', (c) => c?.stats?.fallback?.version?.replace(/^v/, '')],
]) {
  try {
    const conf = JSON.parse(fs.readFileSync(path.resolve(__dirname, relPath), 'utf-8'))
    const candidate = pickVersion(conf)
    if (typeof candidate === 'string' && candidate.length > 0) {
      appVersion = candidate
      break
    }
  } catch {}
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  outputFileTracingRoot: path.resolve(__dirname),
  basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
}

export default nextConfig
