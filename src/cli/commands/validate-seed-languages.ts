/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seed files `sovrium validate` reads: those of an app with translatable
 * fields, for a value naming a language the app does not declare.
 *
 * Only that question is asked here. The rest of a seed folder is judged by
 * `sovrium seed`, which plans every file before writing a row; a language the
 * config dropped is the one seed mistake an edit to `app.yaml` alone creates,
 * so it is caught where that edit is checked.
 */

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { seedTablesOf } from '@/application/use-cases/seed/seed-config'
import { checkTranslatableValues } from '@/application/use-cases/seed/seed-translatable'
import {
  declaresTranslatable,
  recordLanguageOrder,
} from '@/domain/models/app/tables/translatable-field-service'
import { loadSeedFiles } from './seed-load'
import type { App } from '@/domain/models/app'

/**
 * Every seed value of a translatable field in `<projectDir>/seed/` that names
 * an undeclared language, as a message naming the file, the field and the
 * language. Empty when the app has no translatable field or no seed folder.
 */
export const seedLanguageIssues = async (
  app: Readonly<App>,
  projectDir: string
): Promise<readonly string[]> => {
  const tables = seedTablesOf(app)
  if (!tables.some((table) => table.fields.some(declaresTranslatable))) return []
  const seedDir = join(projectDir, 'seed')
  const found = await stat(seedDir).catch(() => undefined)
  if (found?.isDirectory() !== true) return []
  const loaded = await loadSeedFiles(seedDir, true)
  return loaded.ok
    ? checkTranslatableValues(loaded.files, tables, recordLanguageOrder(app.languages))
    : []
}
