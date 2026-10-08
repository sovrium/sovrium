/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isDotSegment, type ValueEncoding } from './helper-encoding'

/**
 * Position-aware rendering, as an AST rewrite.
 *
 * The template text an author wrote is never encoded; only what an expression
 * inserts is. So every `{{…}}` (and `{{{…}}}`) the rewrite reaches becomes a
 * call of {@link ENCODE_VALUE_HELPER} over the original expression:
 * `{{trigger.data.id}}` reads as `{{encode trigger.data.id "url"}}` and
 * `{{uppercase name}}` as `{{encode (uppercase name) "url"}}`. The helper is
 * handed in at render time, never registered, so it is not part of the helper
 * surface an author can call.
 *
 * Left as written: an expression whose helper already produced the encoding
 * (`urlEncode` in a URL, `escapeHtml` in a body), a bare `$env.X` (operator
 * config, not run data), and, in JSON, an expression outside a string literal.
 */

/** The name of the render-time helper the rewrite calls. */
export const ENCODE_VALUE_HELPER = '__sovriumEncodeValue'

type Node = hbs.AST.Node
type Program = hbs.AST.Program
type Mustache = hbs.AST.MustacheStatement
type Block = hbs.AST.BlockStatement
type PathNode = hbs.AST.PathExpression

/** Helpers whose output is already encoded for the place, so not encoded twice. */
const ALREADY_ENCODED: Readonly<Record<ValueEncoding, ReadonlySet<string>>> = {
  html: new Set(['escapeHtml', 'safeHtml']),
  url: new Set(['urlEncode', 'encodeUri', 'encodeUriComponent', 'urlPath']),
  json: new Set(),
}

const isPath = (node: Node): node is PathNode => node.type === 'PathExpression'

/** Whether a mustache calls a helper rather than reading a path. */
const callsHelper = (node: Mustache, isHelper: (name: string) => boolean): boolean =>
  node.params.length > 0 ||
  node.hash !== undefined ||
  (isPath(node.path) && node.path.parts.length === 1 && isHelper(node.path.original))

/** Whether a mustache is left as written under `encoding`. */
const keepsAsWritten = (
  node: Mustache,
  encoding: ValueEncoding,
  isHelper: (name: string) => boolean
): boolean => {
  if (!isPath(node.path)) return false
  if (callsHelper(node, isHelper)) return ALREADY_ENCODED[encoding].has(node.path.original)
  return node.path.parts[0] === '$env'
}

/** The expression a wrapped mustache hands the encoder: its path, or its helper call. */
const valueOf = (node: Mustache, isHelper: (name: string) => boolean): hbs.AST.Expression => {
  if (!isPath(node.path) || !callsHelper(node, isHelper)) return node.path
  const call: hbs.AST.SubExpression = {
    type: 'SubExpression',
    path: node.path,
    params: node.params,
    hash: node.hash,
    loc: node.loc,
  }
  return call
}

const wrap = (
  node: Mustache,
  encoding: ValueEncoding,
  isHelper: (name: string) => boolean
): Mustache => {
  // A literal standing in for a helper name (`{{"name" x}}`) is not a value the
  // encoder can be handed: left as written.
  if (!isPath(node.path) && callsHelper(node, isHelper)) return node
  const helper: PathNode = {
    type: 'PathExpression',
    data: false,
    depth: 0,
    parts: [ENCODE_VALUE_HELPER],
    original: ENCODE_VALUE_HELPER,
    loc: node.loc,
  }
  const mode: hbs.AST.StringLiteral = {
    type: 'StringLiteral',
    value: encoding,
    original: encoding,
    loc: node.loc,
  }
  const noHash: hbs.AST.Hash = { type: 'Hash', pairs: [], loc: node.loc }
  return { ...node, path: helper, params: [valueOf(node, isHelper), mode], hash: noHash }
}

/**
 * Whether a JSON text is inside a string literal after `text`, starting from
 * `inString`. A backslash escapes the next character.
 */
const jsonStringStateAfter = (text: string, inString: boolean): boolean =>
  [...text].reduce<{ readonly inString: boolean; readonly escaped: boolean }>(
    (state, char) => {
      if (state.escaped) return { inString: state.inString, escaped: false }
      if (state.inString && char === '\\') return { inString: true, escaped: true }
      if (char === '"') return { inString: !state.inString, escaped: false }
      return state
    },
    { inString, escaped: false }
  ).inString

/**
 * Rewrite every expression of `program` for `encoding`, in document order, so
 * the JSON string state carried over the literal text is the one each
 * expression sits in.
 */
export const encodeExpressions = (
  program: Program,
  encoding: ValueEncoding,
  isHelper: (name: string) => boolean
): Program => {
  let inJsonString = false
  const visitProgram = (p: Program | undefined): Program | undefined =>
    p === undefined ? undefined : { ...p, body: p.body.map(visit) }
  const visit = (node: hbs.AST.Statement): hbs.AST.Statement => {
    if (node.type === 'ContentStatement') {
      inJsonString = jsonStringStateAfter((node as hbs.AST.ContentStatement).value, inJsonString)
      return node
    }
    if (node.type === 'MustacheStatement') {
      const mustache = node as Mustache
      if (encoding === 'json' && !inJsonString) return node
      return keepsAsWritten(mustache, encoding, isHelper)
        ? node
        : wrap(mustache, encoding, isHelper)
    }
    if (node.type === 'BlockStatement') {
      const block = node as Block
      const inner = visitProgram(block.program) as Program
      const rewritten: Block = {
        ...block,
        program: inner,
        inverse: visitProgram(block.inverse) as Program,
      }
      return rewritten
    }
    return node
  }
  return visitProgram(program) as Program
}

/** Whether a template is nothing but one expression (whitespace aside). */
export const isSingleExpression = (program: Program): boolean => {
  const meaningful = program.body.filter(
    (node) =>
      !(node.type === 'ContentStatement' && (node as hbs.AST.ContentStatement).value.trim() === '')
  )
  return meaningful.length === 1 && meaningful[0]?.type === 'MustacheStatement'
}

/**
 * Whether a rendered URL's path holds a `.` or `..` segment. A value from run
 * data cannot be encoded out of one: `%2E%2E` resolves back to `..`.
 */
export const hasDotSegment = (url: string): boolean => {
  const afterAuthority = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '')
  const path = afterAuthority.split(/[?#]/, 1)[0] ?? ''
  return path.split('/').some(isDotSegment)
}
