/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: write the repository-root `.env.example` from the one env reference.
 *
 * `ENV_EXAMPLE_CONTENT` (`src/cli/commands/env-example-template.ts`) is what
 * `sovrium init` scaffolds and what the manual quotes. The root `.env.example`
 * used to be a hand-kept copy of it, and it lagged: it went on suggesting
 * `BASE_URL=http://localhost:3000` with no note after the reference had learnt
 * why a localhost `BASE_URL` on a server is wrong, and it missed every row added
 * since. This generator makes the root file a derivative, byte for byte, and the
 * `Generated-Assets Drift` row in `[internal ref]`
 * fails whenever the two differ.
 *
 * ## Why the root file carries no repository-only extras
 *
 * Nothing in this repository's own development reads it. Bun loads `.env` and
 * `.env.local`, never `.env.example`; the console preview reads
 * `src/admin/.env.example` (`bun run app:admin`); a template boots from the
 * variables `[internal ref]` hands it; each worktree's ports sit in
 * its gitignored `.env.local`. So the old localhost `BASE_URL` served no
 * development path, and leaving `BASE_URL` unset — as the reference says — is
 * what local development wants anyway. The file is a reader's reference, and the
 * reader is best served by the same text `sovrium init` writes. A real
 * repository-only variable belongs in an appended block written here, never in
 * a hand edit of the output.
 *
 * Regenerate after editing `ENV_EXAMPLE_CONTENT`:
 *   bun run scripts/build/generate-root-env-example.ts
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ENV_EXAMPLE_CONTENT } from '@/cli/commands/env-example-template'

const ROOT_ENV_EXAMPLE = resolve(import.meta.dir, '..', '..', '.env.example')

if (import.meta.main) {
  writeFileSync(ROOT_ENV_EXAMPLE, ENV_EXAMPLE_CONTENT)
  console.log('Wrote .env.example from ENV_EXAMPLE_CONTENT')
}
