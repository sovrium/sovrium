/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { join } from 'node:path'
import { buildRuntimeAssets } from './lib/runtime-assets'

const ROOT = join(import.meta.dir, '..', '..')
await buildRuntimeAssets(join(ROOT, 'dist'), join(ROOT, 'src'))
console.log('✓ runtime assets built into dist/ (client-bundle.js, client-scripts/, island-chunks/)')
