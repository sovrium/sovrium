/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The config `sovrium design-system import` writes into, for both halves of
 * the command — the token import and the page import (`--pages`): the one
 * `--config` names or the one discovered in the working directory, judged as
 * `sovrium validate` judges it before anything is read from the drawing.
 */

import { resolve } from 'node:path'
import { refuse } from './app-prelude'
import { indented } from './library-add-config'
import { lazyImportSchema } from './utils'
import { loadConfigForValidationWithSources, validateParsedConfig } from './validate'

const USAGE =
  'Usage:\n  sovrium design-system import <file|folder> --config <app.yaml|app.json|app.ts> ' +
  '[--pages] [--from <format>] [--dry-run | --write] [--json]'

/** The config to import into: `--config`, else the one discovered in the working directory. */
export const resolveConfig = async (config: string | undefined): Promise<string> => {
  if (config !== undefined) {
    const path = resolve(process.cwd(), config)
    return (await Bun.file(path).exists()) ? path : refuse(`Error: No config file at "${config}".`)
  }
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())
  return discovered === undefined
    ? refuse(`Error: No app config found in ${process.cwd()}. Name one with --config.\n\n${USAGE}`)
    : resolve(process.cwd(), discovered)
}

/** Load and judge the config, refusing with the verdict `sovrium validate` gives. */
export const loadValidConfig = async (configPath: string) => {
  const loaded = await loadConfigForValidationWithSources(configPath)
  const outcome = await validateParsedConfig(loaded.parsed, loaded.refSources)
  if (outcome.errors.length > 0) {
    return refuse(
      `Error: The config does not validate, so the import changed nothing.\n\n${indented(outcome.errors)}`
    )
  }
  return loaded
}
