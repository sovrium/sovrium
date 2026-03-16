/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DevTools } from '@effect/experimental'
import { Layer } from 'effect'

/**
 * Effect DevTools layer for development debugging
 *
 * Provides runtime tracing and telemetry via the Effect DevTools extension.
 * Enable by setting EFFECT_DEVTOOLS=1 environment variable.
 *
 * Requirements:
 * - Install VS Code/Cursor Effect extension: https://marketplace.visualstudio.com/items?itemName=effectful-tech.effect-vscode
 * - Set EFFECT_DEVTOOLS=1 in your environment
 * - Run the application
 * - Open Effect panel in your editor to see telemetry
 *
 * @example
 * ```bash
 * EFFECT_DEVTOOLS=1 bun run start
 * ```
 *
 * @see https://effect.website/docs/getting-started/devtools/
 */
export const DevToolsLayer = DevTools.layer()

/**
 * Check if DevTools should be enabled based on environment variable
 */
export const isDevToolsEnabled = (): boolean => process.env['EFFECT_DEVTOOLS'] === '1'

/**
 * Conditionally provide DevTools layer based on environment
 *
 * Returns the DevTools layer if EFFECT_DEVTOOLS=1, otherwise returns an empty layer.
 * This allows safe integration without runtime overhead when disabled.
 */
export const DevToolsLayerOptional = isDevToolsEnabled() ? DevToolsLayer : Layer.empty
