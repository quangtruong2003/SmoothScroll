import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

let appVersion = 'latest'
try {
  const tauriConfPath = path.resolve(__dirname, '../src-tauri/tauri.conf.json')
  const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'))
  if (typeof conf.version === 'string' && conf.version.length > 0) {
    appVersion = conf.version
  }
} catch {}

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
