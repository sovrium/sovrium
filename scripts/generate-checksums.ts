/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = Bun.argv.slice(2)

const dirIdx = args.indexOf('--dir')
const dirArg = dirIdx !== -1 ? args[dirIdx + 1] : undefined
const dir = dirArg ?? process.cwd()

const outputIdx = args.indexOf('--output')
const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : undefined

const files = readdirSync(dir)
  .filter((f) => f.startsWith('sovrium-') && f.endsWith('.tar.gz'))
  .sort()

if (files.length === 0) {
  console.error('No sovrium-*.tar.gz files found in', dir)
  process.exit(1)
}

const lines: readonly string[] = files.map((file) => {
  const content = readFileSync(join(dir, file))
  const hash = new Bun.CryptoHasher('sha256').update(content).digest('hex')
  return `${hash}  ${file}`
})

const output = lines.join('\n') + '\n'

if (outputFile) {
  writeFileSync(join(dir, outputFile), output)
  console.log(`Checksums written to ${outputFile}`)
} else {
  process.stdout.write(output)
}

console.error(`Generated checksums for ${files.length} file(s)`)
