/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Freeze `src/admin/app.ts` into the embedded admin preset the binary mounts.
 *
 * ## What this replaced
 *
 * The console used to ship as `src/infrastructure/assets/dashboard/dashboard-app.yaml`,
 * embedded through the `with { type: 'file' }` manifest and parsed + decoded on
 * the first request. That artifact was hand-written YAML living inside `src/`,
 * so it could not be booted, previewed, or restyled the way an app can. It is
 * now `src/admin/` — a first-class Sovrium app ([internal ref] D1), relocated under
 * `src/` by [internal ref] D3 — and this script is the bridge between the two facts:
 *
 *  - the console must be AUTHORED as an app, so `bun run app:admin` boots it
 *    and `config/design.ts` restyles it;
 *  - it must be CONSUMED as a value, as a decoded config frozen into a `src/`
 *    module, so the binary mounts one settled artifact rather than decoding a
 *    tree on first request.
 *
 * `SCAN_SOURCES` in `generate-css-assets.ts` is `['src', 'templates']` — read it
 * there rather than here, and note what that list does NOT need to say any
 * more. It carried an explicit `'apps/admin'` entry for as long as the console
 * lived outside `src`, and the entry retired with the move rather than being
 * dropped: the console's classes still reach the binary's candidate corpus,
 * now because `src` contains them. `apps/website` and `apps/partner` remain
 * deliberately outside that list — an operator's app must not push its classes
 * into Sovrium's binary, and those two are Sovrium's own deployed surfaces
 * rather than the console every user runs.
 *
 * ## Ordering is load-bearing
 *
 * This generator runs BEFORE `generate-css-assets.ts`, both in
 * `build-binary.ts` and in `ALWAYS_ON_ASSETS`. The emitted module is scanned
 * for Tailwind candidates like any other `src/` file, so the corpus must be
 * built from the SETTLED preset bytes. Reverse the order and the binary ships a
 * console whose own chrome classes were never compiled — a silently unstyled
 * `/_admin`, with no error anywhere.
 *
 * For the same reason the emitted file must NOT be negated in
 * `generate-css-assets.ts`: it is the only place those classes exist inside
 * `src/`.
 *
 * ## Why the emitted comments avoid class-shaped tokens
 *
 * The candidate scanner harvests identifiers out of comments as readily as out
 * of code (`reference_css_candidate_corpus_harvests_identifiers`). A doc block
 * casually writing `p-4` or `text-sm` would inject a candidate the console does
 * not use and can never drop. The header below therefore names no utility.
 *
 * ## Validation
 *
 * The config is decoded through the SAME pipeline `sovrium validate` runs
 * (`decodeAppConfigObject`), so a preset that would fail at boot fails the build
 * instead. That is the whole guarantee of D4: the operator cannot break the
 * console, and neither can we, because a broken preset never reaches a binary.
 *
 * Pure script: file IO plus Prettier. No Effect.
 *
 * Run: `bun run build:admin-preset`
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { decodeAppConfigObject } from '../../src/application/use-cases/config/decode-app-config'
import { loadSchemaFromTsFile } from '../../src/infrastructure/config/file-loader'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** The ONE place the console's authored config is named. */
export const ADMIN_APP_PATH = 'src/admin/app.ts'

/** The emitted module, inside `src/` so the CSS candidate scanner walks it. */
export const OUTPUT_PATH = 'src/infrastructure/assets/embedded-admin-preset.generated.ts'

/**
 * Normalise the emitted object so the file is REPRODUCIBLE.
 *
 * Key order is sorted recursively, so reordering the authored config — which
 * changes nothing the runtime observes — does not move the emitted bytes. That
 * matters because `Generated Assets Drift` regenerates this file and compares
 * it byte-for-byte against the committed one: an unstable key order would fail
 * that gate on a change that means nothing.
 *
 * A `PRESET_SHA256` constant was emitted here at first, as the identity a drift
 * gate would compare. It was removed unread: the byte-for-byte regeneration
 * above is strictly stronger than a checksum of the same file, and a constant
 * nothing consumes is the shape this codebase calls an inert surface.
 */
const canonicalise = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalise)
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
  return Object.fromEntries(entries.map(([k, v]) => [k, canonicalise(v)] as const))
}

/**
 * Build the module text for an already-validated preset object.
 *
 * Exported so a unit test can assert the emitted shape without running the
 * whole generator against the real app.
 */
export const renderPresetModule = (preset: unknown): string => {
  const json = JSON.stringify(canonicalise(preset), null, 2)

  return `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AUTO-GENERATED by scripts/build/generate-admin-preset.ts — DO NOT EDIT.
 *
 * The Sovrium Native Admin Dashboard, frozen from ${ADMIN_APP_PATH} at build
 * time and embedded in the binary as a value. Edit the app, not this file.
 *
 * Regenerate: bun run build:admin-preset
 */

/* eslint-disable max-lines -- a data file: its length is the console's size, not a structure to split */

import type { AppEncoded } from '@/domain/models/app'

/**
 * The console's authored configuration, validated at build time.
 *
 * The explicit \`: AppEncoded\` annotation is load-bearing, not style. It was
 * \`as const satisfies AppEncoded\`, which left the binding's type INFERRED from
 * the literal — and once the console grew past what the declaration emitter
 * will serialise, \`tsc -p tsconfig.build.json\` failed with TS7056 ("the
 * inferred type of this node exceeds the maximum length the compiler will
 * serialize"). That runs only inside \`bun run build\`, so it surfaced in the
 * release job, after a \`release:\` commit was already on main. An annotation
 * makes the emitted declaration one type REFERENCE instead of a serialised
 * literal, and keeps the same compile-time validity check \`satisfies\` gave:
 * an object literal is still checked for excess properties against the type
 * it is annotated with. Nothing consumes the narrow literal type — the readers
 * (\`src/infrastructure/assets/admin-preset.ts\`, \`scripts/harness/check-css-parity.ts\`)
 * both hand it straight to a schema decode, whose input IS \`AppEncoded\`.
 */
export const EMBEDDED_ADMIN_PRESET: AppEncoded = ${json}
`
}

const write = async (relative: string, contents: string): Promise<void> => {
  const target = join(REPO_ROOT, relative)
  const config = await prettier.resolveConfig(target)
  const formatted = await prettier.format(contents, { ...config, parser: 'typescript' })
  writeFileSync(target, formatted)
}

export const generateAdminPreset = async (): Promise<string> => {
  const parsed = await loadSchemaFromTsFile(join(REPO_ROOT, ADMIN_APP_PATH))
  const decoded = decodeAppConfigObject(parsed)
  if (!decoded.valid) {
    printStderr(`${ADMIN_APP_PATH} is not a valid Sovrium configuration:`)
    for (const error of decoded.errors) printStderr(`  ${error}`)
    process.exit(1)
  }
  // The RAW parsed object is emitted, never `decoded.app`. The decoded value
  // carries schema-applied defaults and branded types that do not round-trip
  // through JSON; the runtime re-decodes the raw object with the SAME schema,
  // so whatever defaults exist are applied there, once, by the schema itself.
  await write(OUTPUT_PATH, renderPresetModule(parsed))
  return OUTPUT_PATH
}

if (import.meta.main) {
  const written = await generateAdminPreset()
  console.log(`${written} — generated from ${ADMIN_APP_PATH}`)
}
