/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fail-closed readers over the TypeScript compiler API, for drift checks that
 * need to ask questions of `src/` without importing it.
 *
 * WHY EVERY LOOKUP THROWS
 * -----------------------
 * A drift check exists to compare two things. When the lookup that produces one
 * side returns `[]` or `''` on a miss, the comparison still runs — over an
 * empty set — and reports SUCCESS. That is the worst possible outcome: a
 * renamed const or restructured struct silently converts the gate into
 * decoration, and nothing in the output says so.
 *
 * So every reader here throws {@link AstLookupError} the moment a named symbol
 * is absent or has the wrong shape. `[internal ref]` converts a thrown
 * error into a failed check with the stack attached, and the standalone CLI
 * shims exit 2. Missing is unrepresentable as success.
 *
 * SYNTACTIC ONLY
 * --------------
 * `ts.createSourceFile`, never `ts.createProgram`. No type checker, so no
 * `tsconfig` resolution, no `lib.d.ts` load, and no whole-program cost — the
 * questions these checks ask (what does this struct declare, what does this
 * const hold, which function encloses this node) are all answerable from
 * syntax. Anything needing real type resolution is out of scope by design and
 * should be documented as a limit by the caller rather than approximated here.
 */

import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

/** Repository root — this file lives at `[internal ref]`. */
const REPO_ROOT = join(import.meta.dir, '..', '..')

/** A repo-relative path for error messages. */
const display = (filePath: string): string => relative(REPO_ROOT, filePath)

/**
 * Thrown by every named-symbol lookup that misses.
 *
 * See the module header: a miss that returns an empty value reads as a clean
 * comparison, so it must not be representable.
 */
export class AstLookupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AstLookupError'
  }
}

/** Throw an {@link AstLookupError}. Typed `never` so callers can `return fail(…)`. */
export const fail = (message: string): never => {
  throw new AstLookupError(message)
}

// =============================================================================
// Parsing
// =============================================================================

/**
 * Thrown when a module does not parse.
 *
 * Separate from {@link AstLookupError} because the two say different things. A
 * lookup error says "I read this file and the symbol you asked for is not in
 * it". This says "I never read this file at all" — and the second one, left
 * silent, is the more expensive: every subsequent query returns nothing and the
 * check reports a clean comparison over a module it could not open.
 */
export class AstParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AstParseError'
  }
}

/**
 * The parser dialect a filename implies.
 *
 * **This was a hardcoded `ts.ScriptKind.TSX`, and that was a live defect.** In
 * TSX, `<V>` opens a JSX element, so a generic arrow function — `const f = <V>(x:
 * V) => x`, ordinary TypeScript in a `.ts` file — parses as an unclosed tag and
 * the parser abandons the rest of the module. Measured 2026-09-15 over
 * `src/ scripts/ [internal ref]`: **42 `.ts` files** carried at least one syntax
 * diagnostic, several of them opening well inside the first hundred lines, and
 * three of them were modules of the drift kit itself (`lib/drift/baseline.ts`,
 * `lib/drift/canaries.ts`, `lib/effect/steps.ts`).
 *
 * The cost was not theoretical. W7 split `src/application/use-cases/tables/programs.ts`
 * and re-spelled one generic arrow as a `function` declaration; nine Effect
 * exports that had carried spans all along became visible to the span census in
 * that commit, and the census jumped 272 → 281 for a change that added no
 * telemetry. A detector that loses a file reports a SMALLER census rather than
 * failing, which is exactly the failure its own corpus floor exists to catch —
 * and the floor did not catch it, because 272 sat comfortably above 180.
 *
 * With the kind derived from the extension, the same corpus plus `[internal ref]` and
 * `apps/` — 5,781 files — parses with zero diagnostics.
 */
const scriptKindOf = (filePath: string): ts.ScriptKind => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) return ts.ScriptKind.TSX
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
    return ts.ScriptKind.JS
  }
  return ts.ScriptKind.TS
}

/**
 * Parse one module syntactically. `setParentNodes` is required for `.parent` walks.
 *
 * **Throws on a syntax error**, rather than handing back the truncated tree the
 * parser recovered. This is the fail-closed rule of the named-symbol readers
 * applied one level earlier: a half-parsed module answers every question with
 * "not present", and "not present" is indistinguishable from "clean" to every
 * caller in this directory. Making a mis-parse unrepresentable is what stops the
 * {@link scriptKindOf} class of defect recurring under a different cause — a new
 * file extension, a syntax the pinned TypeScript does not know yet, or a caller
 * handing over bytes that are not a module at all.
 */
export function parseModule(filePath: string, text: string): ts.SourceFile {
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(filePath)
  )
  // `parseDiagnostics` is not on the public `SourceFile` type — the supported
  // route to syntax diagnostics is a whole Program, which costs a `tsconfig`
  // resolution and a `lib.d.ts` load this module exists to avoid. Read
  // defensively, so a TypeScript upgrade that renames the field degrades to
  // today's behaviour rather than throwing on every file.
  const diagnostics =
    (sourceFile as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ??
    []
  const first = diagnostics[0]
  if (first === undefined) return sourceFile
  const where = first.start === undefined ? '' : ` at position ${first.start}`
  throw new AstParseError(
    `${display(filePath)} does not parse${where}: ` +
      `${ts.flattenDiagnosticMessageText(first.messageText, ' ')} ` +
      `(${diagnostics.length} syntax diagnostic(s), read as ` +
      `${ts.ScriptKind[scriptKindOf(filePath)]}). A truncated parse answers every query with ` +
      '"absent", which reads as a clean comparison — so the parse failure is reported here ' +
      'rather than surviving as a smaller census.'
  )
}

/**
 * The same text with every COMMENT blanked out, offsets preserved.
 *
 * For a caller that scans text but must not read its own documentation as code.
 * Cheap enough per file, and meant to be run only over files a cheap text pass
 * has already matched — which is what lets `check-layout.ts` keep its "text
 * rather than AST" trade over four thousand files.
 *
 * It exists because the honest limitation that check's header admits had become
 * a real finding: the docblock explaining its `spawn` marker quotes
 * `Bun.spawn(`, and the gate reported the check itself as starting child
 * processes. A rule that flags the paragraph describing it is a rule its reader
 * learns to disbelieve.
 *
 * ## Why this is not `ts.createScanner`
 *
 * The scanner was the first implementation and it is WRONG here, in a way that
 * looks right on a small probe. Run standalone it has no parser context, so a
 * `/` is a division sign or the start of a regex literal by guess — and one
 * wrong guess swallows text to the next `/` and desynchronises everything
 * after it. Measured 2026-09-15 on this repository: two of four comment
 * matches in `check-layout.ts` survived the scan, and one in this very file
 * did, while an isolated five-line probe stripped every comment perfectly.
 *
 * Deriving the mask from the PARSED token spans has no such failure mode: a
 * token span is what the compiler itself decided is code, and everything
 * outside one is trivia by construction.
 *
 * A file that does not parse falls back to the raw text — the direction that
 * over-reports rather than under-reports, since a caller's finding is then
 * visible and arguable instead of silently absent.
 */
export function withoutComments(text: string, filePath = 'probe.ts'): string {
  let sourceFile: ts.SourceFile
  try {
    sourceFile = parseModule(filePath, text)
  } catch {
    return text
  }

  const mask = new Uint8Array(text.length)
  const markTokens = (node: ts.Node): void => {
    // A JSDoc block is a COMMENT that TypeScript also models as AST nodes, and
    // `getChildren()` hands them over like any other child. Marking them would
    // keep every `/** … */` in the output — which is how the first version of
    // this function stripped `//` comments perfectly and left the docblocks
    // untouched, looking correct on a probe that used only line comments.
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) {
      return
    }
    if (node.getChildCount(sourceFile) === 0) {
      const start = node.getStart(sourceFile)
      for (let at = start; at < node.getEnd(); at += 1) mask[at] = 1
      return
    }
    for (const child of node.getChildren(sourceFile)) markTokens(child)
  }
  markTokens(sourceFile)

  let out = ''
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at] ?? ''
    out += mask[at] === 1 || char === '\n' ? char : ' '
  }
  return out
}

/** Strip the type-level wrappers that sit between a node and its real value. */
export function unwrapExpression(node: ts.Expression): ts.Expression {
  let current = node
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression
  }
  return current
}

/**
 * Effect Schema builders that decorate a schema and return it.
 *
 * `Schema.Struct({…}).pipe(Schema.annotate({…}))` and
 * `Schema.Struct({…}).annotate({…})` are both live in `src/` — the struct is
 * the RECEIVER of the chained call, not the call. Kept as a closed list rather
 * than "unwrap any method call", because unwrapping `Schema.optional(x)` would
 * yield the `Schema` namespace and quietly turn a real struct miss into a
 * different kind of miss.
 *
 * **This list is a NAME-MATCH against source text, so an API rename silently
 * blinds it.** Effect 4 renamed `annotations` to `annotate`; until this entry
 * was updated, `unwrapSchemaDeclaration` stopped recognising the decorator
 * chain on every schema already migrated, and returned the un-unwrapped call —
 * making `check-permission-evaluator-drift.ts` compare against nothing while
 * still reporting success. That is the "walker is green because it checks
 * nothing" failure, and no gate catches it: the drift check passes either way.
 *
 * `annotations` is retained only because the migration is mid-flight and both
 * spellings coexist; remove it once no `.annotations(` remains in `src/`.
 */
const CHAINED_SCHEMA_MODIFIERS = new Set(['pipe', 'annotate', 'annotations'])

/** Strip the decorator chain wrapping a schema declaration's real builder call. */
export function unwrapSchemaDeclaration(node: ts.Expression): ts.Expression {
  let current = unwrapExpression(node)
  for (;;) {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      CHAINED_SCHEMA_MODIFIERS.has(current.expression.name.text)
    ) {
      current = unwrapExpression(current.expression.expression)
      continue
    }
    return current
  }
}

/** The initializer of a top-level `const <name> = …`, or `undefined`. */
export function findConstInitializer(sf: ts.SourceFile, name: string): ts.Expression | undefined {
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer
      ) {
        return declaration.initializer
      }
    }
  }
  return undefined
}

// =============================================================================
// Fail-closed readers
// =============================================================================

/**
 * Read a `const <name> = ['a', 'b'] as const` string array. Throws on a miss.
 *
 * Parsed rather than imported: importing the module would pull the whole
 * `AppSchema` domain graph into a tooling script for a seven-element list.
 */
export function readConstStringArray(sf: ts.SourceFile, name: string): readonly string[] {
  const initializer = findConstInitializer(sf, name)
  if (!initializer) return fail(`const '${name}' not found in ${display(sf.fileName)}`)
  const literal = unwrapExpression(initializer)
  if (!ts.isArrayLiteralExpression(literal)) {
    return fail(`const '${name}' in ${display(sf.fileName)} is not an array literal`)
  }
  const values = literal.elements.filter(ts.isStringLiteralLike).map((element) => element.text)
  if (values.length === 0) {
    return fail(`const '${name}' in ${display(sf.fileName)} holds no string members`)
  }
  return values
}

/** The declared name of an object-literal property, when it has a static one. */
const staticPropertyName = (property: ts.ObjectLiteralElementLike): string | undefined => {
  const { name } = property
  if (!name) return undefined
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text
  return undefined
}

/**
 * Read the property names of a `const <name> = { … }` dispatch map.
 * Throws on a miss — an unresolved guard silently voids whatever excuse it
 * exists to justify.
 */
export function readObjectLiteralKeys(sf: ts.SourceFile, name: string): readonly string[] {
  const initializer = findConstInitializer(sf, name)
  if (!initializer) return fail(`dispatch map '${name}' not found in ${display(sf.fileName)}`)
  const object = unwrapExpression(initializer)
  if (!ts.isObjectLiteralExpression(object)) {
    return fail(`dispatch map '${name}' in ${display(sf.fileName)} is not an object literal`)
  }
  const keys = object.properties.flatMap((property) => {
    const key = staticPropertyName(property)
    return key === undefined ? [] : [key]
  })
  if (keys.length === 0) {
    return fail(`dispatch map '${name}' in ${display(sf.fileName)} has no keys`)
  }
  return keys
}

/** One member of an Effect `Schema.Struct`. */
export interface StructMember {
  readonly key: string
  readonly initializer: ts.Expression
}

/**
 * Read the direct members of `const <name> = Schema.Struct({ … })`, following
 * any `.pipe(…)` / `.annotations(…)` decorator chain. Throws when the
 * declaration is absent or is not a struct.
 */
export function readStructMembers(sf: ts.SourceFile, name: string): readonly StructMember[] {
  const initializer = findConstInitializer(sf, name)
  if (!initializer) return fail(`schema struct '${name}' not found in ${display(sf.fileName)}`)
  const call = unwrapSchemaDeclaration(initializer)
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== 'Struct'
  ) {
    return fail(`schema struct '${name}' in ${display(sf.fileName)} is not a Schema.Struct(…)`)
  }
  const [argument] = call.arguments
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    return fail(`Schema.Struct for '${name}' in ${display(sf.fileName)} has no members`)
  }
  const members = argument.properties.flatMap<StructMember>((property) => {
    if (!ts.isPropertyAssignment(property)) return []
    const key = staticPropertyName(property)
    return key === undefined ? [] : [{ key, initializer: property.initializer }]
  })
  if (members.length === 0) {
    return fail(`Schema.Struct for '${name}' in ${display(sf.fileName)} has no members`)
  }
  return members
}

// =============================================================================
// Subtree queries
// =============================================================================

/**
 * Visit every node in a subtree, root first.
 *
 * Seventeen files had written this four-line recursion, several of them twice.
 * It is here so the 5 files that use this module AND still call
 * `ts.forEachChild` directly stop needing to.
 */
export function visitAll(node: ts.Node, fn: (node: ts.Node) => void): void {
  fn(node)
  ts.forEachChild(node, (child) => {
    visitAll(child, fn)
  })
}

/**
 * `<object>.<property>` for a call whose callee is a namespaced member, else
 * `undefined`.
 *
 * `Effect.gen(…)` yields `'Effect.gen'`; `foo()`, `a.b.c()` and `obj[k]()` all
 * yield `undefined`. The narrowness is the point — this answers "which
 * namespace API is being called here", and a looser version would accept
 * `this.x()` and `a.b.c()` as namespaced calls they are not.
 *
 * `check-effect-runtime-drift.ts` and `check-effect-span-census.ts` carried
 * byte-identical copies of this, which is exactly the divergence risk a shared
 * reader exists to remove: the two gates count Effect call sites and must agree
 * on what one IS.
 */
export function memberCalleeOf(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node)) return undefined
  const { expression } = node
  if (!ts.isPropertyAccessExpression(expression)) return undefined
  if (!ts.isIdentifier(expression.expression)) return undefined
  return `${expression.expression.text}.${expression.name.text}`
}

/** One module specifier named by an `import` or `export … from` declaration. */
export interface ModuleReference {
  readonly specifier: string
  readonly kind: 'import' | 'export'
  readonly node: ts.ImportDeclaration | ts.ExportDeclaration
}

/**
 * Every `import '…'` / `export … from '…'` specifier in a module.
 *
 * Statement-level only: a dynamic `import(…)` is a call expression and is NOT
 * reported here, because a caller asking "what does this file statically
 * depend on" and a caller asking "what can this file reach at runtime" want
 * different answers, and conflating them silently gives both the wrong one.
 */
export function moduleReferencesIn(sf: ts.SourceFile): readonly ModuleReference[] {
  const found: ModuleReference[] = []
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      found.push({ specifier: statement.moduleSpecifier.text, kind: 'import', node: statement })
      continue
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      found.push({ specifier: statement.moduleSpecifier.text, kind: 'export', node: statement })
    }
  }
  return found
}

/** Every identifier name appearing anywhere in a subtree. */
export function identifiersIn(node: ts.Node): ReadonlySet<string> {
  const names = new Set<string>()
  const visit = (current: ts.Node): void => {
    if (ts.isIdentifier(current)) names.add(current.text)
    ts.forEachChild(current, visit)
  }
  visit(node)
  return names
}

/** Whether a subtree contains a `<ns>.<method>(…)` call. */
export function containsMethodCall(node: ts.Node, method: string): boolean {
  let found = false
  const visit = (current: ts.Node): void => {
    if (found) return
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === method
    ) {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

/**
 * The nearest enclosing NAMED function, or `'<module scope>'`.
 *
 * This is the question a blob-of-text scan cannot answer, and the reason a
 * report can say WHICH function holds an offending expression rather than only
 * which file.
 */
export function enclosingFunctionName(node: ts.Node): string {
  let current: ts.Node | undefined = node
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text
    if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const { parent }: { parent: ts.Node | undefined } = current
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text
      }
      if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text
      }
    }
    current = current.parent
  }
  return '<module scope>'
}

/** The 1-based line of a node's first token. */
export const lineOf = (sf: ts.SourceFile, node: ts.Node): number =>
  sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

/** A node's source text, first line only, trimmed — for report snippets. */
export const snippetOf = (sf: ts.SourceFile, node: ts.Node): string =>
  node.getText(sf).split('\n')[0]?.trim() ?? ''

// =============================================================================
// Import resolution
// =============================================================================

/**
 * Resolve an import specifier to an absolute path present in `has`.
 *
 * Handles the `@/` alias (which maps to `src/`) and relative specifiers, trying
 * the extension and `index` forms Bun resolves. Bare package specifiers return
 * `undefined` — nothing outside the repository is parsed.
 */
export function resolveImportSpecifier(
  fromFile: string,
  specifier: string,
  has: (path: string) => boolean
): string | undefined {
  const base = specifier.startsWith('@/')
    ? join(REPO_ROOT, 'src', specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : undefined
  if (base === undefined) return undefined
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (has(candidate)) return candidate
  }
  return undefined
}

/**
 * A TypeScript top-level statement, described the way an ESTree consumer sees it.
 *
 * The point is a law with TWO readers. `[internal ref]` states what a
 * barrel may hold as one predicate over `{ type, source }`; an ESLint rule feeds
 * it `Program.body` nodes directly, and a drift check has a TypeScript AST
 * instead. This is the whole of the translation between them, kept here rather
 * than in the check because SC6 puts AST reading in one module — and because a
 * second consumer will want the same mapping rather than a second copy of it.
 *
 * An unmapped statement kind returns `''` on purpose. Every consumer so far
 * treats an unknown type as "not a pass-through", which is the safe direction:
 * a statement form nobody has classified is reported until someone decides it
 * belongs.
 */
export interface EstreeLikeStatement {
  readonly type: string
  readonly source?: unknown
}

/** Map one TypeScript statement onto {@link EstreeLikeStatement}. */
export function asEstreeStatement(statement: ts.Statement): EstreeLikeStatement {
  if (ts.isImportDeclaration(statement)) return { type: 'ImportDeclaration' }
  if (!ts.isExportDeclaration(statement)) return { type: '' }
  return {
    type: statement.exportClause === undefined ? 'ExportAllDeclaration' : 'ExportNamedDeclaration',
    source: statement.moduleSpecifier,
  }
}
