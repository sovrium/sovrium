/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The npm side of third-party license attribution, shared by the payload
 * generator (`scripts/build/generate-embedded-licenses.ts`), the desktop
 * notices generator and `Third-Party License Drift`, so the three cannot
 * disagree about which packages ship or what their notice says.
 *
 *   - {@link normalizeLicense}: a declared license as an SPDX expression.
 *   - {@link classifyLicense}: does a license expression require its text?
 *   - {@link walkProductionClosure}: the packages a production install reaches.
 *   - {@link extractNotice}: the package's own LICENSE file, split into its
 *     copyright line(s) and the license body, so identical bodies dedupe.
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { LICENSE_SUPPLEMENTS, type LicenseSupplement } from './third-party-license-supplements'

export type LicenseClass = 'permissive' | 'attribution' | 'unknown'

/** SPDX identifiers that grant use without asking for their text to travel separately. */
const PERMISSIVE_IDS = [
  'MIT',
  'MIT-0',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'Unlicense',
  'CC0-1.0',
  'BlueOak-1.0.0',
  'Zlib',
  'WTFPL',
  'BSL-1.0',
  'Unicode-3.0',
  'Unicode-DFS-2016',
  'CDLA-Permissive-2.0',
] as const

const GNU_IDS = ['GPL-2.0', 'GPL-3.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'AGPL-3.0'].flatMap(
  (id) => [`${id}-only`, `${id}-or-later`]
)

/** SPDX identifiers whose terms require their text (or source) to accompany the code. */
const ATTRIBUTION_IDS = [
  'MPL-1.1',
  'MPL-2.0',
  'OFL-1.1',
  'EPL-1.0',
  'EPL-2.0',
  'CDDL-1.0',
  'CDDL-1.1',
  'PSF-2.0',
  'Python-2.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'EUPL-1.2',
  'OSL-3.0',
  'SSPL-1.0',
  'BUSL-1.1',
  ...GNU_IDS,
] as const

const CLASS_OF: ReadonlyMap<string, LicenseClass> = new Map([
  ...PERMISSIVE_IDS.map((id) => [id, 'permissive'] as const),
  ...ATTRIBUTION_IDS.map((id) => [id, 'attribution'] as const),
])

/** Case-insensitive lookup to the canonical SPDX spelling. */
const CANONICAL: ReadonlyMap<string, string> = new Map(
  [...CLASS_OF.keys()].map((id) => [id.toUpperCase(), id] as const)
)

/**
 * Non-SPDX spellings mapped to the one identifier they can only mean. Keys are
 * upper-cased, comma-free and single-spaced, AFTER a leading `the` and a
 * trailing `license` are dropped (so `The MIT License` is looked up as `MIT`).
 * A spelling that could mean two licenses (`BSD`, `GPL`, `Apache 1.1`) is
 * deliberately absent: it stays unrecognised, which fails the gate.
 */
export const LICENSE_ALIASES: Readonly<Record<string, string>> = {
  // The bare family name: every Apache license still in use is 2.0, and the one
  // package declaring it (sqlite-vec) is dual MIT / Apache-2.0 upstream.
  APACHE: 'Apache-2.0',
  'APACHE 2': 'Apache-2.0',
  'APACHE 2.0': 'Apache-2.0',
  'APACHE-2': 'Apache-2.0',
  APACHE2: 'Apache-2.0',
  'APACHE LICENSE 2.0': 'Apache-2.0',
  'APACHE LICENSE VERSION 2.0': 'Apache-2.0',
  'APACHE VERSION 2.0': 'Apache-2.0',
  'BSD 2-CLAUSE': 'BSD-2-Clause',
  'BSD 3-CLAUSE': 'BSD-3-Clause',
}

const RANK: Readonly<Record<LicenseClass, number>> = { permissive: 0, attribution: 1, unknown: 2 }

/** A parsed SPDX expression: AND binds tighter than OR, parentheses group. */
type LicenseNode =
  | { readonly kind: 'id'; readonly id: string }
  | { readonly kind: 'and' | 'or'; readonly left: LicenseNode; readonly right: LicenseNode }

/** Parse a NORMALISED expression; `undefined` when it is not well formed. */
const parseExpression = (spdx: string): LicenseNode | undefined => {
  const tokens = [...spdx.matchAll(/\(|\)|[^\s()]+/g)].map((m) => m[0])
  let at = 0
  const primary = (): LicenseNode | undefined => {
    const token = tokens[at]
    if (token === undefined || token === ')' || token === 'AND' || token === 'OR') return undefined
    at += 1
    if (token === '(') {
      const inner = orExpr()
      if (inner === undefined || tokens[at] !== ')') return undefined
      at += 1
      return inner
    }
    if (tokens[at] === 'WITH') {
      // `Apache-2.0 WITH LLVM-exception`: an exception only ever grants more.
      if (tokens[at + 1] === undefined) return undefined
      at += 2
    }
    return { kind: 'id', id: token }
  }
  const binary =
    (op: 'AND' | 'OR', kind: 'and' | 'or', next: () => LicenseNode | undefined) =>
    (): LicenseNode | undefined => {
      let left = next()
      while (left !== undefined && tokens[at] === op) {
        at += 1
        const right = next()
        left = right === undefined ? undefined : { kind, left, right }
      }
      return left
    }
  const andExpr = binary('AND', 'and', primary)
  const orExpr = binary('OR', 'or', andExpr)
  const tree = orExpr()
  return tree !== undefined && at === tokens.length ? tree : undefined
}

const termKey = (raw: string): string =>
  raw
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/\s+license$/i, '')
    .toUpperCase()

/** One license term (no operator) to its SPDX identifier, or `undefined`. */
const normalizeTerm = (raw: string): string | undefined => {
  const key = termKey(raw)
  return CANONICAL.get(key) ?? LICENSE_ALIASES[key]
}

const EXCEPTION = /^[A-Za-z0-9.+-]+-exception(-[0-9.]+)?$/i

type Token = '(' | ')' | 'AND' | 'OR' | 'WITH' | '/' | { readonly word: string }

const tokenize = (expression: string): readonly Token[] =>
  [...expression.matchAll(/\(|\)|\/|[^\s()/]+/g)].map((m): Token => {
    const text = m[0]
    if (text === '(' || text === ')' || text === '/') return text
    const upper = text.toUpperCase()
    return upper === 'AND' || upper === 'OR' || upper === 'WITH' ? upper : { word: text }
  })

/**
 * A declared license, as an SPDX expression — or `undefined` when any part of
 * it cannot be mapped to exactly one identifier. The mapping never guesses:
 *
 *   - each term goes through {@link LICENSE_ALIASES} or an exact
 *     (case-insensitive) SPDX identifier, nothing else;
 *   - lower-case `and` / `or` / `with` become the SPDX operators;
 *   - Cargo's legacy `MIT/Apache-2.0` is an OR, but only in an expression
 *     with no other operator, where precedence cannot be in doubt;
 *   - a `WITH` exception is kept verbatim when it looks like one;
 *   - redundant outer parentheses are dropped.
 */
export const normalizeLicense = (declared: string | undefined): string | undefined => {
  if (declared === undefined || declared.trim().length === 0) return undefined
  const tokens = tokenize(declared)
  const hasSlash = tokens.includes('/')
  if (hasSlash && tokens.some((t) => t === 'AND' || t === 'OR' || t === 'WITH')) return undefined
  const out: string[] = []
  let words: string[] = []
  let afterWith = false
  const flush = (): boolean => {
    if (words.length === 0) return true
    const phrase = words.join(' ')
    words = []
    if (afterWith) {
      afterWith = false
      if (!EXCEPTION.test(phrase)) return false
      out.push(phrase)
      return true
    }
    const id = normalizeTerm(phrase)
    if (id === undefined) return false
    out.push(id)
    return true
  }
  for (const token of tokens) {
    if (typeof token === 'object') {
      words.push(token.word)
      continue
    }
    if (!flush()) return undefined
    if (token === 'WITH') afterWith = true
    out.push(token === '/' ? 'OR' : token)
  }
  if (!flush() || afterWith) return undefined
  const expression = out.join(' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
  const normalized = stripOuterParens(expression)
  return parseExpression(normalized) === undefined ? undefined : normalized
}

const stripOuterParens = (expression: string): string => {
  if (!expression.startsWith('(') || !expression.endsWith(')')) return expression
  let depth = 0
  for (let i = 0; i < expression.length; i += 1) {
    if (expression[i] === '(') depth += 1
    if (expression[i] === ')') depth -= 1
    if (depth === 0 && i < expression.length - 1) return expression
  }
  return stripOuterParens(expression.slice(1, -1))
}

const evaluate = (node: LicenseNode): LicenseClass => {
  if (node.kind === 'id') return CLASS_OF.get(node.id) ?? 'unknown'
  const left = evaluate(node.left)
  const right = evaluate(node.right)
  // AND: every term applies, so the most demanding wins. OR: the licensee
  // elects the least demanding alternative.
  const pick = node.kind === 'and' ? RANK[left] >= RANK[right] : RANK[left] <= RANK[right]
  return pick ? left : right
}

/**
 * Classify one license expression. It is first normalised
 * ({@link normalizeLicense}); one that cannot be is `unknown`, never
 * permissive. `undefined` (no license field and no readable LICENSE file) is
 * unknown too.
 */
export const classifyLicense = (expression: string | undefined): LicenseClass => {
  const spdx = normalizeLicense(expression)
  const tree = spdx === undefined ? undefined : parseExpression(spdx)
  return tree === undefined ? 'unknown' : evaluate(tree)
}

/** One package of the production closure. */
export interface ClosurePackage {
  readonly name: string
  readonly version: string
  readonly license: string | undefined
  readonly hasNotice: boolean
  /** The installed directory. */
  readonly dir: string
  /**
   * Declares `os` or `cpu`: a per-platform native package. Which ones are
   * installed depends on the machine, so they are excluded from generated,
   * committed notices (the family package carries the notice) to keep the
   * payload byte-identical on every platform.
   */
  readonly platformSpecific: boolean
}

export const LICENSE_FILE = /^(LICEN[CS]E|COPYING)(\.(md|txt|markdown)|-[A-Za-z0-9.-]+)?$/i

/** A package's declared license, falling back to the first line of its LICENSE file. */
const readDeclaredLicense = (
  dir: string,
  manifest: Record<string, unknown>
): string | undefined => {
  const field = manifest['license']
  if (typeof field === 'string' && field.trim().length > 0) return field
  if (
    typeof field === 'object' &&
    field !== null &&
    typeof (field as { type?: unknown }).type === 'string'
  )
    return (field as { type: string }).type
  const legacy = manifest['licenses']
  if (Array.isArray(legacy)) {
    const types = legacy
      .map((entry) => (entry as { type?: unknown }).type)
      .filter((type): type is string => typeof type === 'string')
    if (types.length > 0) return types.join(' OR ')
  }
  const file = readdirSync(dir).find((name) => LICENSE_FILE.test(name))
  if (file === undefined) return undefined
  const firstLine = readFileSync(join(dir, file), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (firstLine === undefined) return undefined
  if (/^(the\s+)?mit license/i.test(firstLine)) return 'MIT'
  if (/^isc license/i.test(firstLine)) return 'ISC'
  return firstLine
}

const resolvePackageDir = (name: string, from: string, root: string): string | undefined => {
  let dir = from
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (dir === root || dirname(dir) === dir) return undefined
    dir = dirname(dir)
  }
}

/**
 * Walk the production dependency closure from the root manifest. An
 * `optionalDependencies` entry that is not installed (another platform's
 * native package) is skipped; a missing REQUIRED dependency is too, because
 * `bun install` is what reports that.
 */
export const walkProductionClosure = (
  root: string,
  manifestPath: string = join(root, 'package.json')
): readonly ClosurePackage[] => {
  const rootManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    readonly dependencies?: Record<string, string>
  }
  const seen = new Map<string, ClosurePackage>()
  const queue: Array<{ readonly name: string; readonly from: string }> = Object.keys(
    rootManifest.dependencies ?? {}
  ).map((name) => ({ name, from: root }))
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const dir = resolvePackageDir(next.name, next.from, root)
    if (dir === undefined || seen.has(dir)) continue
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >
    seen.set(dir, {
      name: typeof manifest['name'] === 'string' ? manifest['name'] : next.name,
      version: typeof manifest['version'] === 'string' ? manifest['version'] : '?',
      license: readDeclaredLicense(dir, manifest),
      hasNotice: readdirSync(dir).some((file) => /^NOTICE(\.(md|txt))?$/i.test(file)),
      dir,
      platformSpecific: manifest['os'] !== undefined || manifest['cpu'] !== undefined,
    })
    const deps = {
      ...((manifest['dependencies'] as Record<string, string> | undefined) ?? {}),
      ...((manifest['optionalDependencies'] as Record<string, string> | undefined) ?? {}),
    }
    for (const dep of Object.keys(deps)) queue.push({ name: dep, from: dir })
  }
  return [...seen.values()]
}

/** A package's notice: its copyright line(s), and the license body without them. */
export interface ExtractedNotice {
  /** The LICENSE file(s) read, relative to the package. */
  readonly files: readonly string[]
  readonly copyright: readonly string[]
  /** The license text with the copyright lines removed, whitespace-normalised. */
  readonly body: string
  /** sha256 of `body`, the dedupe key. */
  readonly bodyId: string
}

// A copyright STATEMENT: `Copyright`/`©`, an optional `(c)`, then a year, a
// capitalised name or `by`. Deliberately case-sensitive after the keyword, so
// the Apache text's wrapped `copyright notice that is included…` and its
// `(c) You must retain…` clause stay in the body where they belong.
const COPYRIGHT_LINE = /^\s*(?:[Cc]opyright|COPYRIGHT|©)\s*(?:\([cC]\)|©)?\s*(?:\d|[A-Z]|by\s)/

/** Split a license text into copyright lines and a normalised body. */
export const splitNotice = (text: string): Pick<ExtractedNotice, 'copyright' | 'body'> => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  // Template lines (`Copyright [yyyy] [name of copyright owner]` in the Apache
  // appendix, `<year> <copyright holders>` in a canonical text) name nobody.
  const copyright = lines
    .filter((line) => COPYRIGHT_LINE.test(line) && !/\[yyyy\]|<year>|<copyright/i.test(line))
    .map((line) => line.trim())
  const body = lines
    .filter((line) => !COPYRIGHT_LINE.test(line))
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { copyright: [...new Set(copyright)], body }
}

/** The dedupe key: texts differing only in whitespace or line wrapping are one text. */
export const bodyIdOf = (body: string): string =>
  createHash('sha256').update(body.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16)

/**
 * The notice a package ships in its own LICENSE file(s) — several when a
 * dual-licensed package ships one per license (`LICENSE-MIT`, `LICENSE-APACHE`).
 * `undefined` when the package ships none, or only an empty one: that is a
 * finding for the gate, never an empty notice.
 */
export const extractNotice = (dir: string): ExtractedNotice | undefined => {
  if (!existsSync(dir)) return undefined
  const files = readdirSync(dir)
    .filter((name) => LICENSE_FILE.test(name) && statSync(join(dir, name)).isFile())
    .sort()
  const texts = files.map((file) => readFileSync(join(dir, file), 'utf8'))
  const joined = texts.join('\n\n')
  const { copyright, body } = splitNotice(joined)
  if (body.length === 0) return undefined
  return { files, copyright, body, bodyId: bodyIdOf(body) }
}

/** Where a notice came from: the package itself, or a committed supplement. */
export type NoticeOrigin = 'package' | 'supplement'

/** The supplement row covering one package, if any. */
export const supplementFor = (
  ecosystem: LicenseSupplement['ecosystem'],
  name: string,
  supplements: readonly LicenseSupplement[] = LICENSE_SUPPLEMENTS
): LicenseSupplement | undefined =>
  supplements.find((row) => row.ecosystem === ecosystem && row.packages.includes(name))

/** A supplement's notice, read from `licenses/supplements/`. */
export const supplementNotice = (
  row: LicenseSupplement,
  supplementsDir: string
): ExtractedNotice | undefined => {
  const paths = row.files.map((file) => join(supplementsDir, file))
  if (!paths.every((path) => existsSync(path))) return undefined
  const split = splitNotice(paths.map((path) => readFileSync(path, 'utf8')).join('\n\n'))
  // A canonical SPDX text carries placeholder or sample copyright lines; the
  // holder the manifest names replaces them.
  const copyright = row.holder === undefined ? split.copyright : [`Copyright (c) ${row.holder}`]
  if (split.body.length === 0) return undefined
  return { files: row.files, copyright, body: split.body, bodyId: bodyIdOf(split.body) }
}

/**
 * The notice for one package: its own license file first, a supplement only
 * when it ships none. `undefined` is a gate finding.
 */
export const resolveNotice = (
  ecosystem: LicenseSupplement['ecosystem'],
  name: string,
  dir: string,
  supplementsDir: string,
  supplements: readonly LicenseSupplement[] = LICENSE_SUPPLEMENTS
): { readonly notice: ExtractedNotice; readonly origin: NoticeOrigin } | undefined => {
  const own = extractNotice(dir)
  if (own !== undefined) return { notice: own, origin: 'package' }
  const row = supplementFor(ecosystem, name, supplements)
  const supplied = row === undefined ? undefined : supplementNotice(row, supplementsDir)
  return supplied === undefined ? undefined : { notice: supplied, origin: 'supplement' }
}

/** One attributed component, before grouping. */
export interface AttributedComponent {
  readonly name: string
  readonly version: string
  /** The license exactly as the package declares it. */
  readonly declared: string
  readonly notice: ExtractedNotice
}

/**
 * What a listing prints for a component that cannot be normalised. The gate
 * fails such a package before it ships; this only keeps the type total.
 */
export const NO_ASSERTION = 'NOASSERTION'

/** Components grouped by identical license body, for a readable listing. */
export interface GroupedNotices {
  readonly texts: readonly { readonly id: string; readonly text: string }[]
  readonly components: readonly {
    readonly name: string
    readonly version: string
    /** The declared license as an SPDX expression ({@link normalizeLicense}). */
    readonly spdx: string
    /** The license exactly as the package declares it. */
    readonly declared: string
    readonly copyright: readonly string[]
    readonly textId: string
  }[]
}

/** Dedupe by `name@version`, sort by name, and keep each distinct body once. */
export const groupNotices = (components: readonly AttributedComponent[]): GroupedNotices => {
  const unique = [
    ...new Map(components.map((c) => [`${c.name}@${c.version}`, c] as const)).values(),
  ].toSorted((a, b) =>
    a.name === b.name
      ? a.version.localeCompare(b.version, 'en')
      : a.name.localeCompare(b.name, 'en')
  )
  const texts = new Map<string, string>()
  for (const c of unique) if (!texts.has(c.notice.bodyId)) texts.set(c.notice.bodyId, c.notice.body)
  return {
    texts: [...texts]
      .map(([id, text]) => ({ id, text }))
      .toSorted((a, b) => a.id.localeCompare(b.id, 'en')),
    components: unique.map((c) => ({
      name: c.name,
      version: c.version,
      spdx: normalizeLicense(c.declared) ?? NO_ASSERTION,
      declared: c.declared,
      copyright: c.notice.copyright,
      textId: c.notice.bodyId,
    })),
  }
}
