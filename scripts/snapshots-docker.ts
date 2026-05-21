/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { join } from 'node:path'

const PLAYWRIGHT_VERSION = '1.60.0'
const IMAGE = `mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy`

const PROJECT_ROOT = join(import.meta.dir, '..')

const forwarded = process.argv.slice(2)
const hasGrep = forwarded.some((arg) => arg === '--grep' || arg.startsWith('--grep='))
const playwrightArgs = hasGrep ? forwarded : [...forwarded, '--grep', '@regression']

const containerScript = [
  'set -euo pipefail',
  'apt-get update -qq && apt-get install -y -qq unzip docker.io >/dev/null',
  'export DOCKER_HOST=unix:///var/run/docker.sock',
  'curl -fsSL https://bun.sh/install | bash',
  'export PATH="$HOME/.bun/bin:$PATH"',
  'cd /work',
  'bun install --frozen-lockfile',
  `UPDATE_SNAPSHOTS=true SOVRIUM_FORCE_NATIVE_FREE_CSS=1 bunx playwright test --workers=1 ${playwrightArgs
    .map((a) => `'${a.replace(/'/g, "'\\''")}'`)
    .join(' ')}`.trim(),
].join('\n')

const dockerArgs: readonly string[] = [
  'run',
  '--rm',
  '--platform=linux/amd64',
  '-v',
  '/var/run/docker.sock:/var/run/docker.sock',
  '--network=host',
  '-v',
  `${PROJECT_ROOT}:/work`,
  '-w',
  '/work',
  IMAGE,
  'bash',
  '-c',
  containerScript,
]

console.log('▸ Docker-canonical snapshot regeneration')
console.log(`  image:    ${IMAGE} (linux/amd64)`)
console.log(
  `  target:   ${playwrightArgs.length > 0 ? playwrightArgs.join(' ') : 'full @regression suite'}`
)
console.log('  note:     emulated amd64 on an arm64 host is slow — expect minutes per file.\n')

const proc = Bun.spawnSync(['docker', ...dockerArgs], {
  cwd: PROJECT_ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
})

if (proc.exitCode !== 0) {
  console.error(`\n✗ Docker snapshot regeneration failed (exit ${proc.exitCode})`)
  process.exit(proc.exitCode ?? 1)
}

console.log('\n✓ Snapshots regenerated. Review the `*-chromium.png` diff before committing.')
