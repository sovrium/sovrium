/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: every pinned vendor specification → one gzipped operation set the
 * binary ships, `src/library/generated/<provider>.json.gz`.
 *
 * Reads `[internal ref]<provider>/` (pinned by `bun run
 * library:refresh <provider>`), normalises it through `[internal ref]`,
 * and writes the set. Functional facts only — the normaliser never copies a
 * vendor `description`.
 *
 * Regenerate after a refresh or an overrides edit:
 *   bun run build:library-operations            # every pinned provider
 *   bun run build:library-operations stripe     # one provider
 *
 * `Library Operations` (the drift gate) regenerates the same sets in memory and
 * fails when a committed file differs, so an edited override without a
 * regeneration cannot land.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { relative } from 'node:path'
import { formatBytes, printDocument, printFailure } from '@/infrastructure/logging/cli-output'
import { REPO_ROOT } from '../lib/drift/walk'
import {
  GENERATED_DIR,
  compressSet,
  generateProvider,
  generatedPath,
  pinnedProviders,
  serialiseSet,
} from '../lib/library-sources'

const reasonsOf = (skipped: readonly { readonly reason: string }[]): string =>
  Object.entries(
    skipped.reduce<Readonly<Record<string, number>>>(
      (acc, { reason }) => ({ ...acc, [reason]: (acc[reason] ?? 0) + 1 }),
      {}
    )
  )
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ')

const main = (): void => {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
  const available = pinnedProviders()
  const unknown = requested.filter((provider) => !available.includes(provider))
  if (unknown.length > 0) {
    printFailure({
      headline: `No pinned source for ${unknown.join(', ')}; nothing was generated.`,
      guidance: 'Pin it first with `bun run library:refresh <provider>`.',
    })
    process.exit(1)
  }
  const providers = requested.length > 0 ? requested : available
  mkdirSync(GENERATED_DIR, { recursive: true })
  const lines = providers.map((provider) => {
    const { set, skipped, shaMismatches } = generateProvider(provider)
    if (shaMismatches.length > 0) {
      printFailure({
        headline: `${provider}: ${shaMismatches.join(', ')} no longer match the pinned sha256; nothing was written.`,
        guidance: `Re-pin with \`bun run library:refresh ${provider}\`, or restore the file.`,
      })
      process.exit(1)
    }
    const text = serialiseSet(set)
    const bytes = compressSet(text)
    const path = generatedPath(provider)
    writeFileSync(path, bytes)
    return {
      glyph: 'ok' as const,
      text: `${provider}: ${set.operations.length} operations, ${Object.keys(set.groups).length} groups, ${formatBytes(bytes.length)} gzipped (${formatBytes(text.length)} raw)`,
      detail: [
        `→ ${relative(REPO_ROOT, path)}`,
        ...(skipped.length > 0 ? [`skipped: ${reasonsOf(skipped)}`] : []),
      ],
    }
  })
  printDocument([lines])
}

if (import.meta.main) main()
