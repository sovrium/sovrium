/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { exportClaudeDesign, type ClaudeDesignExportInput } from './claude-design-export'
import { exportFigma } from './figma-export'
import { exportStyleDictionary } from './style-dictionary-export'
import { exportTokensStudio } from './tokens-studio-export'
import type { AdapterFile } from './adapter-export-values'

/**
 * Every provider adapter of the design-system bundle, in one call.
 *
 * Each is a pure projection of the bundle's two token documents (plus, for
 * Claude Design, the app name and the component kit), so the same input gives
 * the same bytes, file for file.
 */

/**
 * The adapters the bundle carries, by the directory each writes under
 * `adapters/`, in the order the manifest lists them.
 */
export const PROVIDER_ADAPTER_NAMES = [
  'claude-design',
  'figma',
  'style-dictionary',
  'tokens-studio',
] as const

/**
 * Every adapter file, grouped by adapter in {@link PROVIDER_ADAPTER_NAMES} order.
 */
export const exportProviderAdapters = (input: ClaudeDesignExportInput): readonly AdapterFile[] => [
  ...exportClaudeDesign(input),
  ...exportFigma(input),
  ...exportStyleDictionary(),
  ...exportTokensStudio(input),
]
