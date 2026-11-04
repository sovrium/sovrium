/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { exportClaudeDesign, type ClaudeDesignExportInput } from './claude-design-export'
import { renderDesignMd } from './design-md-export'
import { renderDesignSidecar, type DesignMdSidecarInput } from './design-md-sidecar-export'
import { exportFigma } from './figma-export'
import { exportStyleDictionary } from './style-dictionary-export'
import { exportTokensStudio } from './tokens-studio-export'
import type { AdapterFile } from './adapter-export-values'

/**
 * Every provider adapter of the design-system bundle, in one call.
 *
 * Each is a pure projection of the bundle's two token documents (plus, for
 * Claude Design, the app name and the component kit, and for the DESIGN.md,
 * the app name, its description and the colour keys it declares), so the same
 * input gives the same bytes, file for file.
 */

/** What every adapter is drawn from. */
export type ProviderAdaptersInput = ClaudeDesignExportInput & DesignMdSidecarInput

/**
 * The DESIGN.md adapter: the file `sovrium design-system --format design-md`
 * prints, and its sidecar. No surface brief and no PRODUCT.md: those name the
 * project's own files, which the bundle does not carry.
 */
export const exportDesignMdAdapter = (input: DesignMdSidecarInput): readonly AdapterFile[] => [
  { path: 'adapters/design-md/DESIGN.md', content: renderDesignMd(input) },
  { path: 'adapters/design-md/.impeccable/design.json', content: renderDesignSidecar(input) },
]

/**
 * The adapters the bundle carries, by the directory each writes under
 * `adapters/`, in the order the manifest lists them.
 */
export const PROVIDER_ADAPTER_NAMES = [
  'claude-design',
  'design-md',
  'figma',
  'style-dictionary',
  'tokens-studio',
] as const

/**
 * Every adapter file, grouped by adapter in {@link PROVIDER_ADAPTER_NAMES} order.
 */
export const exportProviderAdapters = (input: ProviderAdaptersInput): readonly AdapterFile[] => [
  ...exportClaudeDesign(input),
  ...exportDesignMdAdapter(input),
  ...exportFigma(input),
  ...exportStyleDictionary(),
  ...exportTokensStudio(input),
]
