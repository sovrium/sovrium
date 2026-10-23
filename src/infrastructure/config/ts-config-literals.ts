/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TypeScript Config Literals - Infrastructure Layer
 *
 * Where a value of a `.ts` config is WRITTEN: following one page entry's path
 * (`pages[0].components[2].content`) through the source of the config module,
 * with the TypeScript compiler's own parser, down to the expression that
 * produces it. `sovrium design-system import --pages` rewrites a value in
 * place only when that expression is a string or number literal reached
 * through object and array literals alone, in the module that owns the page:
 * then changing that literal changes that value and nothing else.
 *
 * Any other expression is COMPUTED: a template with a substitution, a constant,
 * a helper's return, a spread. Its site is still named — the literal a helper
 * returns, followed into the module that declares it, or else the expression
 * itself — so the operator knows where to make the edit by hand.
 *
 * Nothing here evaluates the config or writes a file: it reads the sources
 * the caller hands over and returns ranges.
 */

import { dirname, join, relative } from 'node:path'
import type ts from 'typescript'

/** One value of a config, as its source writes it. */
export type ConfigValueSite =
  | {
      /** A literal of the module that owns the page, reached through literals alone. */
      readonly kind: 'literal'
      readonly file: string
      readonly line: number
      readonly start: number
      readonly end: number
      /** The literal's own text, quotes included. */
      readonly text: string
    }
  | {
      /** A value computed: where it is, as `file` and 1-based `line`. */
      readonly kind: 'computed'
      readonly file: string
      readonly line: number
    }

/** The config's module sources, by absolute path, the root first. */
export interface ConfigSources {
  readonly root: string
  readonly files: ReadonlyMap<string, string>
}

type Step = string | number

/** Where a walk stands: a node of a parsed file, and whether it hopped through a name or a call. */
interface At {
  readonly node: ts.Node
  readonly file: ts.SourceFile
  readonly hopped: boolean
}

const MODULE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']

/** A parser over the handed-over sources, each file parsed once. */
const parserOf = (compiler: typeof ts, sources: ConfigSources) => {
  const parsed = new Map<string, ts.SourceFile>()
  return (path: string): ts.SourceFile | undefined => {
    const cached = parsed.get(path)
    if (cached !== undefined) return cached
    const text = sources.files.get(path)
    if (text === undefined) return undefined
    const file = compiler.createSourceFile(path, text, compiler.ScriptTarget.Latest, true)
    parsed.set(path, file)
    return file
  }
}

/** Strip the wrappers that do not change a value: parentheses, `as`, `satisfies`, `!`. */
const unwrapped = (compiler: typeof ts, node: ts.Node): ts.Node =>
  compiler.isParenthesizedExpression(node) ||
  compiler.isAsExpression(node) ||
  compiler.isSatisfiesExpression(node) ||
  compiler.isNonNullExpression(node) ||
  compiler.isTypeAssertionExpression(node)
    ? unwrapped(compiler, node.expression)
    : node

const lineOf = (file: ts.SourceFile, node: ts.Node): number =>
  file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1

/** The name a property is written under, when it is a plain one. */
const propertyName = (compiler: typeof ts, name: ts.PropertyName): string | undefined =>
  compiler.isIdentifier(name) || compiler.isStringLiteral(name) || compiler.isNumericLiteral(name)
    ? name.text
    : undefined

/** The expression a top-level `const` or exported declaration of a file binds to a name. */
const declarationIn = (
  compiler: typeof ts,
  file: ts.SourceFile,
  name: string
): ts.Node | undefined =>
  file.statements.reduce<ts.Node | undefined>((found, statement) => {
    if (found !== undefined) return found
    if (compiler.isFunctionDeclaration(statement) && statement.name?.text === name) return statement
    if (!compiler.isVariableStatement(statement)) return undefined
    return statement.declarationList.declarations.find(
      (declaration) => compiler.isIdentifier(declaration.name) && declaration.name.text === name
    )?.initializer
  }, undefined)

/** The module a relative specifier of a file names, among the sources. */
const moduleOf = (sources: ConfigSources, from: string, specifier: string): string | undefined => {
  if (!specifier.startsWith('.')) return undefined
  const base = join(dirname(from), specifier.replace(/\.(?:js|mjs)$/, ''))
  return MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`).find((path) => sources.files.has(path))
}

/** What a name means where it is read: a declaration of its file, or one it imports. */
const resolveName = (
  compiler: typeof ts,
  context: {
    readonly sources: ConfigSources
    readonly parse: (path: string) => ts.SourceFile | undefined
  },
  file: ts.SourceFile,
  name: string
): { readonly node: ts.Node; readonly file: ts.SourceFile } | undefined => {
  const local = declarationIn(compiler, file, name)
  if (local !== undefined) return { node: local, file }
  const imported = file.statements.flatMap((statement) => {
    if (!compiler.isImportDeclaration(statement)) return []
    const named = statement.importClause?.namedBindings
    if (named === undefined || !compiler.isNamedImports(named)) return []
    const binding = named.elements.find((element) => element.name.text === name)
    if (binding === undefined || !compiler.isStringLiteral(statement.moduleSpecifier)) return []
    return [
      { exported: binding.propertyName?.text ?? name, specifier: statement.moduleSpecifier.text },
    ]
  })[0]
  if (imported === undefined) return undefined
  const path = moduleOf(context.sources, file.fileName, imported.specifier)
  const target = path === undefined ? undefined : context.parse(path)
  const node = target === undefined ? undefined : declarationIn(compiler, target, imported.exported)
  return node === undefined || target === undefined ? undefined : { node, file: target }
}

/** The expression a function returns, when it returns one expression only. */
const returnedBy = (compiler: typeof ts, fn: ts.Node): ts.Node | undefined => {
  if (
    !compiler.isArrowFunction(fn) &&
    !compiler.isFunctionExpression(fn) &&
    !compiler.isFunctionDeclaration(fn)
  ) {
    return undefined
  }
  const { body } = fn
  if (body === undefined) return undefined
  if (!compiler.isBlock(body)) return body
  const returns = body.statements.filter(compiler.isReturnStatement)
  return returns.length === 1 ? returns[0]?.expression : undefined
}

/** One step down from where a walk stands, or `undefined` when the expression is computed there. */
const stepInto = (compiler: typeof ts, at: At, step: Step): ts.Node | undefined => {
  const node = unwrapped(compiler, at.node)
  if (typeof step === 'number') {
    if (!compiler.isArrayLiteralExpression(node)) return undefined
    if (node.elements.slice(0, step + 1).some(compiler.isSpreadElement)) return undefined
    return node.elements[step]
  }
  if (!compiler.isObjectLiteralExpression(node)) return undefined
  const index = node.properties.findLastIndex(
    (candidate) =>
      (compiler.isPropertyAssignment(candidate) ||
        compiler.isShorthandPropertyAssignment(candidate)) &&
      propertyName(compiler, candidate.name) === step
  )
  const property = node.properties[index]
  if (property === undefined) return undefined
  // A spread, an accessor or a computed key after it may set the value again: it is computed.
  const overridden = node.properties
    .slice(index + 1)
    .some(
      (later) =>
        compiler.isSpreadAssignment(later) ||
        later.name === undefined ||
        propertyName(compiler, later.name) === undefined ||
        propertyName(compiler, later.name) === step
    )
  if (overridden) return undefined
  return compiler.isPropertyAssignment(property) ? property.initializer : property.name
}

/** Follow a name or a call to the expression it stands for, marking the walk as hopped. */
const follow = (
  compiler: typeof ts,
  context: {
    readonly sources: ConfigSources
    readonly parse: (path: string) => ts.SourceFile | undefined
  },
  at: At
): At | undefined => {
  const node = unwrapped(compiler, at.node)
  if (compiler.isIdentifier(node)) {
    const resolved = resolveName(compiler, context, at.file, node.text)
    return resolved === undefined ? undefined : { ...resolved, hopped: true }
  }
  if (compiler.isCallExpression(node) && compiler.isIdentifier(node.expression)) {
    const resolved = resolveName(compiler, context, at.file, node.expression.text)
    const returned = resolved === undefined ? undefined : returnedBy(compiler, resolved.node)
    return returned === undefined || resolved === undefined
      ? undefined
      : { node: returned, file: resolved.file, hopped: true }
  }
  return undefined
}

/** Walk a path down from an expression, following names and calls; where it stopped. */
const walk = (
  compiler: typeof ts,
  context: {
    readonly sources: ConfigSources
    readonly parse: (path: string) => ts.SourceFile | undefined
  },
  at: At,
  path: readonly Step[]
): { readonly at: At; readonly complete: boolean } => {
  const [step, ...rest] = path
  if (step === undefined) {
    const followed = follow(compiler, context, at)
    return followed === undefined ? { at, complete: true } : walk(compiler, context, followed, [])
  }
  const next = stepInto(compiler, at, step)
  if (next !== undefined) return walk(compiler, context, { ...at, node: next }, rest)
  const followed = follow(compiler, context, at)
  return followed === undefined ? { at, complete: false } : walk(compiler, context, followed, path)
}

/** The default export of the root module, as an expression. */
const defaultExportOf = (compiler: typeof ts, file: ts.SourceFile): ts.Node | undefined =>
  file.statements.find(compiler.isExportAssignment)?.expression

/**
 * Where one value of a `.ts` config is written.
 *
 * @param sources - the config's module sources; the root holds `export default`.
 * @param path - the value's path from the config root (`['pages', 0, 'components', 2, 'content']`).
 * @returns the literal to rewrite, the site where it is computed, or `undefined` when
 *   the root has no default export to follow.
 */
export const locateConfigValue = async (
  sources: ConfigSources,
  path: readonly Step[]
): Promise<ConfigValueSite | undefined> => {
  const compiler = (await import('typescript')).default
  const parse = parserOf(compiler, sources)
  const root = parse(sources.root)
  const exported = root === undefined ? undefined : defaultExportOf(compiler, root)
  if (root === undefined || exported === undefined) return undefined
  const context = { sources, parse }
  const reached = walk(compiler, context, { node: exported, file: root, hopped: false }, path)
  const node = unwrapped(compiler, reached.at.node)
  const { file } = reached.at
  const at = { file: relative(dirname(sources.root), file.fileName), line: lineOf(file, node) }
  const literal =
    compiler.isStringLiteral(node) ||
    compiler.isNoSubstitutionTemplateLiteral(node) ||
    compiler.isNumericLiteral(node)
  return reached.complete && literal && !reached.at.hopped && file === root
    ? {
        kind: 'literal',
        ...at,
        start: node.getStart(file),
        end: node.getEnd(),
        text: node.getText(file),
      }
    : { kind: 'computed', ...at }
}

/**
 * A literal's text with a new value, in the quote it was written with.
 *
 * @param literal - the literal as written, quotes included.
 * @param value - the new value.
 */
export const rewrittenLiteral = (literal: string, value: string | number): string => {
  if (typeof value === 'number') return String(value)
  const quote = literal[0] === '`' || literal[0] === '"' ? literal[0] : "'"
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
  return `${quote}${quote === '`' ? escaped.replaceAll('${', '\\${') : escaped}${quote}`
}
