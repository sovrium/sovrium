/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DevTools } from '@effect/experimental'
import { Layer } from 'effect'

export const DevToolsLayer = DevTools.layer()

export const isDevToolsEnabled = (): boolean => process.env['EFFECT_DEVTOOLS'] === '1'

export const DevToolsLayerOptional = isDevToolsEnabled() ? DevToolsLayer : Layer.empty
