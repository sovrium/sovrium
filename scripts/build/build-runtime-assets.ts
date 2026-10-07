/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Runnable wrapper: build the runtime assets into `dist/` (the client runtime
 * loader and its split chunks, the island bundle, the static client scripts,
 * and the page search runtime).
 * Invoked by `scripts/build/build-binary.ts` before generating the embedded manifest.
 */

import { join } from 'node:path'
import { buildRuntimeAssets } from '../lib/runtime-assets'

const ROOT = join(import.meta.dir, '..', '..')
await buildRuntimeAssets(join(ROOT, 'dist'), join(ROOT, 'src'))
console.log(
  'runtime assets built into dist/ (client-bundle.js, client-chunks/, client-scripts/, ' +
    'island-chunks/, page-search-runtime.js)'
)
