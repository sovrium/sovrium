/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const env: Record<string, string> = { ...process.env } as Record<string, string>
env['DATABASE_URL'] = 'file:./drizzle/sqlite-gen.db'

const proc = Bun.spawnSync(['bunx', 'drizzle-kit', 'generate'], {
  env,
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
})

process.exit(proc.exitCode ?? 1)
