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

/**
 * The commands whose second word is a CLOSED verb set, and the handler module
 * each one dispatches that word in. Only the location is written here; the
 * verbs themselves are read out of each module by {@link extractSubverbs}, so
 * a verb added to or removed from a handler moves the vocabulary with it.
 *
 * A command whose second word is open — a file (`design-system app.ts`,
 * `import <source>`), a manual address (`docs config`) — does not belong here:
 * any word is legal there, so there is nothing to check.
 */
export const SUBVERB_HANDLERS: Readonly<Record<string, string>> = {
  admin: 'src/cli/commands/admin.ts',
  secret: 'src/cli/commands/secret.ts',
  library: 'src/cli/commands/library.ts',
  env: 'src/cli/commands/env.ts',
}

/** The identifiers a handler compares its verb against: `subcommand === 'create'`. */
const VERB_IDENTIFIERS: ReadonlySet<string> = new Set(['subcommand', 'verb'])

/** The constants a handler tabulates its verbs in: an array, or a dispatch map. */
const VERB_ARRAY = 'SUBCOMMANDS'
const VERB_MAP = 'VERBS'

/**
 * The verbs one handler module dispatches, from its source text. Three shapes,
 * all the CLI uses today: a string compared to an identifier named `subcommand`
 * or `verb` (`=== 'adopt'`, `!== 'create'`), the members of a
 * `const SUBCOMMANDS = [...]`, and the keys of a `const VERBS = { ... }`. An
 * empty result means the handler changed shape, and the caller fails on it. Pure.
 */
export const extractSubverbs = (fileName: string, source: string): readonly string[] => {
  const sourceFile = parseModule(fileName, source)
  const verbs = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
    ) {
      const sides = [unwrapExpression(node.left), unwrapExpression(node.right)]
      const named = sides.some((side) => ts.isIdentifier(side) && VERB_IDENTIFIERS.has(side.text))
      if (named) {
        for (const side of sides) if (ts.isStringLiteralLike(side)) verbs.add(side.text)
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const initializer = unwrapExpression(node.initializer)
      if (node.name.text === VERB_ARRAY && ts.isArrayLiteralExpression(initializer)) {
        for (const element of initializer.elements) {
          if (ts.isStringLiteralLike(element)) verbs.add(element.text)
        }
      }
      if (node.name.text === VERB_MAP && ts.isObjectLiteralExpression(initializer)) {
        for (const property of initializer.properties) {
          const key = property.name
          if (key !== undefined && (ts.isIdentifier(key) || ts.isStringLiteralLike(key))) {
            verbs.add(key.text)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return [...verbs].sort()
}
