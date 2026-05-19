/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const generateJunctionTableName = (sourceTable: string, relatedTable: string): string =>
  `${sourceTable}_${relatedTable}`

const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  people: 'person',
  children: 'child',
  men: 'man',
  women: 'woman',
  teeth: 'tooth',
  feet: 'foot',
  geese: 'goose',
  mice: 'mouse',
  dice: 'die',
  oxen: 'ox',
  indices: 'index',
  matrices: 'matrix',
  vertices: 'vertex',
  analyses: 'analysis',
  criteria: 'criterion',
  phenomena: 'phenomenon',
  data: 'datum',
  media: 'medium',
}

export const toSingular = (tableName: string): string =>
  IRREGULAR_PLURALS[tableName] ?? (tableName.endsWith('s') ? tableName.slice(0, -1) : tableName)

export const generateJunctionTableDDL = (
  sourceTable: string,
  relatedTable: string,
  tableUsesView?: ReadonlyMap<string, boolean>
): string => {
  const junctionTableName = generateJunctionTableName(sourceTable, relatedTable)
  const sourceColumnName = `${toSingular(sourceTable)}_id`
  const relatedColumnName = `${toSingular(relatedTable)}_id`

  const sourceTableName =
    tableUsesView?.get(sourceTable) === true ? `${sourceTable}_base` : sourceTable
  const relatedTableName =
    tableUsesView?.get(relatedTable) === true ? `${relatedTable}_base` : relatedTable

  const columns = [
    `${sourceColumnName} INTEGER NOT NULL`,
    `${relatedColumnName} INTEGER NOT NULL`,
    `PRIMARY KEY (${sourceColumnName}, ${relatedColumnName})`,
    `CONSTRAINT ${junctionTableName}_${sourceColumnName}_fkey FOREIGN KEY (${sourceColumnName}) REFERENCES ${sourceTableName}(id)`,
    `CONSTRAINT ${junctionTableName}_${relatedColumnName}_fkey FOREIGN KEY (${relatedColumnName}) REFERENCES ${relatedTableName}(id)`,
  ]

  return `CREATE TABLE IF NOT EXISTS ${junctionTableName} (\n  ${columns.join(',\n  ')}\n)`
}
