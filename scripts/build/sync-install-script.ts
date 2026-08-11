#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate `apps/website/public/install` from the canonical `install.sh`.
 *
 * ## Why this script exists
 *
 * `https://sovrium.com/install` is the primary distribution path — the target of
 * `curl -fsSL https://sovrium.com/install | sh`. The website serves it as a
 * static asset from `apps/website/public/install`, which for most of the repo's
 * life was a hand-maintained byte-copy of `install.sh`.
 *
 * That drifted. Commit `52dce238f` ("sync /install script with the canonical
 * install.sh") is the repair from the last time, and nothing prevented a repeat:
 * the two files sit on opposite sides of the public-changelog boundary
 * (`install.sh` is a product path, `apps/` is not), so they also could not
 * legally be fixed in one commit.
 *
 * Generating the copy removes the failure mode rather than policing it. There is
 * one tracked source; the served file is gitignored and rebuilt.
 *
 * ## Every consumer must call this first
 *
 * A generated file that is absent is worse than a stale one — it 404s the
 * install one-liner. The callers are, deliberately, explicit rather than hidden
 * inside a copier:
 *
 * | Consumer                          | Why it needs the file                     |
 * | --------------------------------- | ----------------------------------------- |
 * | `bun run app:website`             | Local preview serves `/install`           |
 * | `[internal ref]` | `serve-the-install-script.spec.ts` reads it off disk |
 * | `scripts/build/publish-website-repo.ts` | Ships `apps/website/` to the public repo |
 * | `scripts/build/website-payload.ts`      | Builds the Scalingo deploy tree     |
 *
 * The last two are load-bearing: `publish-website-repo.ts` walks the FILESYSTEM,
 * not git, so a present-but-gitignored file is published correctly and an absent
 * one silently disappears from production. `public/install` is therefore also
 * listed in that script's `REQUIRED_FILES`, so a missed sync fails the publish
 * closed instead of shipping a website without an installer.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// `import.meta.url` rather than Bun's `import.meta.dir`: Playwright's
// globalSetup — one of this module's four callers — runs under Node, where
// `import.meta.dir` is undefined and every path built from it throws.
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The one tracked copy. Edits go here. */
export const INSTALL_SOURCE_PATH = 'install.sh'

/** The generated copy the website serves at `/install`. Gitignored. */
export const INSTALL_SERVED_PATH = join('apps', 'website', 'public', 'install')

export interface SyncResult {
  /** True when the served copy was absent or differed and has been rewritten. */
  readonly written: boolean
  /** Absolute path of the file this run is responsible for. */
  readonly servedPath: string
}

/**
 * Copy `install.sh` over the served asset, byte for byte.
 *
 * Idempotent and content-addressed: an already-correct file is left untouched so
 * a watch-mode preview does not churn its mtime on every invocation.
 */
export function syncInstallScript(projectRoot: string = PROJECT_ROOT): SyncResult {
  const sourcePath = join(projectRoot, INSTALL_SOURCE_PATH)
  const servedPath = join(projectRoot, INSTALL_SERVED_PATH)

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Cannot generate ${INSTALL_SERVED_PATH}: ${INSTALL_SOURCE_PATH} does not exist at ${sourcePath}`
    )
  }

  const source = readFileSync(sourcePath, 'utf8')
  if (existsSync(servedPath) && readFileSync(servedPath, 'utf8') === source) {
    return { written: false, servedPath }
  }

  mkdirSync(dirname(servedPath), { recursive: true })
  writeFileSync(servedPath, source)
  return { written: true, servedPath }
}

if (import.meta.main) {
  const result = syncInstallScript()
  console.log(
    result.written
      ? `✓ Generated ${INSTALL_SERVED_PATH} from ${INSTALL_SOURCE_PATH}`
      : `✓ ${INSTALL_SERVED_PATH} already matches ${INSTALL_SOURCE_PATH}`
  )
}
