/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The CLI's command set, read out of the dispatch tables in `src/cli/index.ts`.
 *
 * PARSED rather than imported: `src/cli/index.ts` is the binary's argv entry
 * point and runs on import. Two readers need the set — `Docs CLI Command Drift`
 * (a documented `sovrium <cmd>` that no longer dispatches) and the
 * skill-reference generator (the verb catalogue it publishes) — and one parser
 * keeps them from disagreeing about what a verb is.
 */

import ts from 'typescript'
import { parseModule, unwrapExpression } from './ts-ast-reader'

/** The dispatch tables in `src/cli/index.ts` whose keys are the command set. */
export const DISPATCH_TABLES: readonly string[] = ['exitCommands', 'persistentCommands']

/**
 * Extract the dispatch-table keys from `src/cli/index.ts` source text.
 *
 * Walks the AST for the `DISPATCH_TABLES` variable declarations and collects
 * their object-literal property names. Returns the command set plus which
 * tables were actually located, so the caller can fail loudly on a shape
 * change instead of proceeding with a partial set. Pure.
 */
export const extractDispatchCommands = (
  source: string
): { readonly commands: readonly string[]; readonly tablesFound: readonly string[] } => {
  const sourceFile = parseModule('index.ts', source)
  const commands = new Set<string>()
  const tablesFound = new Set<string>()

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      DISPATCH_TABLES.includes(node.name.text)
    ) {
      const initializer =
        node.initializer === undefined ? undefined : unwrapExpression(node.initializer)
      if (initializer !== undefined && ts.isObjectLiteralExpression(initializer)) {
        tablesFound.add(node.name.text)
        for (const property of initializer.properties) {
          const key = property.name
          if (key !== undefined && (ts.isIdentifier(key) || ts.isStringLiteral(key))) {
            commands.add(key.text)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return { commands: [...commands].sort(), tablesFound: [...tablesFound].sort() }
}

/** The global help's lines, as the `HELP_TEXT` array literal in `src/cli/index.ts` spells them. */
export const extractGlobalHelpLines = (source: string): readonly string[] => {
  const sourceFile = parseModule('index.ts', source)
  const found: string[][] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'HELP_TEXT'
    ) {
      const initializer =
        node.initializer === undefined ? undefined : unwrapExpression(node.initializer)
      // `[…].join('\n')` as well as a bare `[…]`.
      const array =
        initializer !== undefined &&
        ts.isCallExpression(initializer) &&
        ts.isPropertyAccessExpression(initializer.expression)
          ? unwrapExpression(initializer.expression.expression)
          : initializer
      if (array !== undefined && ts.isArrayLiteralExpression(array)) {
        found.push(
          array.elements.flatMap((element) =>
            ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)
              ? [element.text]
              : []
          )
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  const [lines] = found
  if (lines === undefined || lines.length === 0) {
    throw new Error('could not locate the HELP_TEXT array literal in src/cli/index.ts')
  }
  return lines
}
