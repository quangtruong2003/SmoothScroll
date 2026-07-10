// Inline BASE_URL for the playwright run
const url = 'http://localhost:3001'
const { spawnSync } = require('child_process')
const args = ['exec', 'playwright', 'test', ...process.argv.slice(2)]
const child = spawnSync('pnpm', args, {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BASE_URL: url },
  shell: true,
})
process.exit(child.status ?? 0)
