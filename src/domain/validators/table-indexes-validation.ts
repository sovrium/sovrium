/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
