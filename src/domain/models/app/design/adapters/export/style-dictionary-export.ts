/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { jsonFileContent, type AdapterFile } from './adapter-export-values'
import type { StyleDictionaryConfig } from '@/domain/models/api/admin/design-system/adapter-style-dictionary'

/**
 * The Style Dictionary adapter: two configs carrying no token of their own.
 *
 * Style Dictionary builds from sources, so the config points at the bundle's
 * own light document, relative to the config itself
 * (`adapters/style-dictionary/` → `../../tokens/base.tokens.json`). Running
 * `style-dictionary build --config adapters/style-dictionary/config.json` from
 * the bundle root therefore builds from the tokens every other adapter was
 * projected from, and never from a path outside the bundle.
 *
 * Style Dictionary has no modes, so dark is the second config,
 * `config.dark.json`: its only source is the bundle's dark document, a
 * complete token set, and its `css/variables` file is scoped by
 * `options.selector`, which replaces `:root` with `.dark` (Style Dictionary
 * 5.7.0, `lib/common/formats.js`). Each run reads one document, so the dark
 * colours never override the light ones under the same names.
 */

/** Where the light config is written, inside the bundle. */
const STYLE_DICTIONARY_FILE = 'adapters/style-dictionary/config.json'

/** Where the dark config is written, inside the bundle. */
const STYLE_DICTIONARY_DARK_FILE = 'adapters/style-dictionary/config.dark.json'

/** The config: the bundle's light tokens as source, one CSS custom-property platform. */
const CONFIG: StyleDictionaryConfig = {
  source: ['../../tokens/base.tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [{ destination: 'variables.css', format: 'css/variables' }],
    },
  },
}

/** The dark config: the bundle's dark tokens as source, the same platform under `.dark`. */
const DARK_CONFIG: StyleDictionaryConfig = {
  source: ['../../tokens/dark.tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [
        {
          destination: 'variables.dark.css',
          format: 'css/variables',
          options: { selector: '.dark' },
        },
      ],
    },
  },
}

/**
 * The Style Dictionary subtree: `adapters/style-dictionary/config.json` and
 * `adapters/style-dictionary/config.dark.json`.
 *
 * It takes no input: the config names where the tokens are, never what they hold.
 */
export const exportStyleDictionary = (): readonly AdapterFile[] => [
  { path: STYLE_DICTIONARY_FILE, content: jsonFileContent(CONFIG) },
  { path: STYLE_DICTIONARY_DARK_FILE, content: jsonFileContent(DARK_CONFIG) },
]
