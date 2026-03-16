/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validate that all index fields exist in the table.
 *
 * @param indexes - Array of index definitions
 * @param fieldNames - Set of valid field names
 * @returns Validation error object if invalid, undefined if valid
 */
export const validateIndexes = (
  indexes: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<string>
  }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const invalidIndex = indexes
    .flatMap((index) =>
      index.fields
        .filter((fieldName) => !fieldNames.has(fieldName))
        .map((fieldName) => ({ indexName: index.name, fieldName }))
    )
    .at(0)

  if (invalidIndex) {
    return {
      message: `Index "${invalidIndex.indexName}" references non-existent column "${invalidIndex.fieldName}"`,
      path: ['indexes'],
    }
  }

  return undefined
}
