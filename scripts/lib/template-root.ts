/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the shipped templates live — the ONE place a script names the tree.
 *
 * The templates are the fifth declared DATA tree under `src/` ([internal ref] A4):
 * `src/templates/<slug>/` holds one template's config, seed, public assets,
 * content and `template.yaml`, and `src/templates/catalog.json` indexes them.
 * Before A4 the tree sat at the repository root as `templates/`, and a dozen
 * scripts each spelled that path for themselves. Spelling it once is what lets
 * the next move of the tree be a one-line change rather than a census.
 */

import { join } from 'node:path'

/** The repository root, from this file's position. */
const REPO_ROOT = join(import.meta.dir, '..', '..')

/** The templates root, repo-relative and POSIX-spelled. */
export const TEMPLATES_ROOT = 'src/templates'

/** The catalogue every template is listed in, repo-relative. */
export const CATALOG_PATH = `${TEMPLATES_ROOT}/catalog.json`

/** The templates root as an absolute path. */
export const templatesRootAbsolute = (): string => join(REPO_ROOT, TEMPLATES_ROOT)
