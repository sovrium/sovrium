/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * DESIGN.md → canonical tokens.
 *
 * A DESIGN.md is a Markdown file opening with YAML front matter: `colors`,
 * `typography`, `rounded` and `spacing` carry tokens, `name`, `description`
 * and `components` carry what the app does not import. The reader parses the
 * front matter (the domain parses no YAML) and hands it over on the file.
 *
 *  - `colors.<n>` is a colour named `<n>`;
 *  - `rounded.<k>` is a radius and `spacing.<k>` a spacing, both named `<k>`;
 *  - a type role named for a ladder rung (`h3`, `lead`, `bodySmall`, …) is
 *    that rung, and the format's own roles map onto rungs: `display`,
 *    `headline` → `h1`, `title` → `h2`, `body`, `label` → `caption`. A role
 *    named for a rung wins that rung over a role that only maps onto it; the
 *    loser is reported. Any other role passes through for the mapper to report;
 *  - the `body` role's family is the `body` face, the `display` role's (else
 *    `headline`'s) the `title` face, each proposed only when no face of the
 *    app already paints it (the mapper decides, it alone sees the app);
 *  - the dark value of a colour comes from the sidecar at
 *    `.impeccable/design.json`, `extensions.colorMeta.<n>.dark`, and only for
 *    a colour the front matter declares: a layered dark mode. No sidecar, no
 *    dark mode.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { TYPE_SCALE_STEPS } from '../../type-scale'
import {
  adapterError,
  adapterOk,
  hasOwnKey,
  kebabSegment,
  ownValue,
  parseJson,
  resolveAliases,
  unresolvedAlias,
  type AdapterResult,
  type CanonicalImport,
  type CanonicalToken,
  type ImportSource,
  type ImportUnmapped,
  type SourceFile,
} from './canonical-tokens-service'

type JsonObject = Readonly<Record<string, unknown>>

/** The front-matter keys that carry tokens; a DESIGN.md holds at least one. */
const TOKEN_GROUPS = ['colors', 'typography', 'rounded', 'spacing'] as const

/** The front-matter keys the format defines but the app does not import. */
const REPORTED_KEYS = new Set(['name', 'description', 'components'])

/** Where the sidecar sits, relative to the DESIGN.md. */
export const DESIGN_MD_SIDECAR = '.impeccable/design.json'

/** The format's own type roles, and the ladder rung each maps onto. */
const ROLE_RUNGS: Readonly<Record<string, string>> = {
  display: 'display',
  headline: 'h1',
  title: 'h2',
  body: 'body',
  label: 'caption',
}

const isMarkdown = (path: string): boolean => /\.md$/i.test(path)

/** Whether a parsed front matter carries at least one token group. */
const hasTokenGroup = (frontMatter: unknown): frontMatter is JsonObject =>
  isRecord(frontMatter) && TOKEN_GROUPS.some((group) => hasOwnKey(frontMatter, group))

/** The DESIGN.md of a source: the Markdown file whose front matter carries tokens. */
const designFile = (source: ImportSource): SourceFile | undefined =>
  source.files.find((file) => isMarkdown(file.path) && hasTokenGroup(file.frontMatter))

/**
 * Whether a source is a DESIGN.md: a `.md` file whose YAML front matter holds
 * at least one of `colors`, `typography`, `rounded` or `spacing`.
 */
export const isDesignMdSource = (source: ImportSource): boolean => designFile(source) !== undefined

const group = (token: string, reason: string): ImportUnmapped => ({ token, kind: 'group', reason })

const recordAt = (frontMatter: JsonObject, key: string): JsonObject =>
  ((value) => (isRecord(value) ? value : {}))(ownValue(frontMatter, key))

/** The ladder rung a role name spells, in either `bodySmall` or `body-small` form. */
const rungNamed = (role: string): string | undefined => {
  const camel = kebabSegment(role).replace(/-([a-z0-9])/g, (_match, next: string) =>
    next.toUpperCase()
  )
  return TYPE_SCALE_STEPS.find((step) => step === camel)
}

/** One type role, placed: onto a rung, passed through, or reported as the loser of its rung. */
type RolePlacement = { readonly token: CanonicalToken } | { readonly unmapped: ImportUnmapped }

const placeRoles = (typography: JsonObject): readonly RolePlacement[] => {
  const roles = Object.entries(typography)
  const named = new Set(roles.flatMap(([role]) => rungNamed(role) ?? []))
  return roles.map(([role, value]): RolePlacement => {
    const own = rungNamed(role)
    if (own !== undefined) return { token: textStyle(own, value) }
    const mapped = Object.hasOwn(ROLE_RUNGS, role) ? ROLE_RUNGS[role] : undefined
    if (mapped === undefined) return { token: textStyle(role, value) }
    return named.has(mapped)
      ? {
          unmapped: {
            token: `typography.${role}`,
            kind: 'text-style',
            reason: `The \`${mapped}\` rung is set by the role named for it, which wins over \`${role}\`.`,
          },
        }
      : { token: textStyle(mapped, value) }
  })
}

const textStyle = (name: string, value: unknown): CanonicalToken => ({
  path: ['typography', name],
  type: 'typography',
  value,
})

/** The family a role is set in, as a `font.<face>` token, when it states one. */
const roleFamily = (
  typography: JsonObject,
  roles: readonly string[],
  face: string
): readonly CanonicalToken[] => {
  const role = roles.find((name) => isRecord(ownValue(typography, name)))
  const style = role === undefined ? undefined : ownValue(typography, role)
  const family = isRecord(style) ? ownValue(style, 'fontFamily') : undefined
  return family === undefined
    ? []
    : [{ path: ['font', face], type: 'fontFamily', value: family, roleFamily: true }]
}

const scaleTokens = (frontMatter: JsonObject, key: string, type: string) =>
  Object.entries(recordAt(frontMatter, key)).map(([name, value]): CanonicalToken => ({
    path: [key, name],
    type,
    value,
  }))

/** The light tokens, in source spelling (`colors.*`, `rounded.*`), so aliases resolve. */
const lightTokens = (
  frontMatter: JsonObject
): {
  readonly tokens: readonly CanonicalToken[]
  readonly unmapped: readonly ImportUnmapped[]
} => {
  const typography = recordAt(frontMatter, 'typography')
  const roles = placeRoles(typography)
  return {
    tokens: [
      ...scaleTokens(frontMatter, 'colors', 'color'),
      ...scaleTokens(frontMatter, 'rounded', 'dimension'),
      ...scaleTokens(frontMatter, 'spacing', 'dimension'),
      ...roles.flatMap((role) => ('token' in role ? [role.token] : [])),
      ...roleFamily(typography, ['body'], 'body'),
      ...roleFamily(typography, ['display', 'headline'], 'title'),
    ],
    unmapped: roles.flatMap((role) => ('unmapped' in role ? [role.unmapped] : [])),
  }
}

/** `rounded.<k>` is the mapper's `radius.<k>`; every other path is already its own. */
const toMapperPath = (token: CanonicalToken): CanonicalToken =>
  token.path[0] === 'rounded' ? { ...token, path: ['radius', ...token.path.slice(1)] } : token

/** What the front matter carries that the app does not import, in document order. */
const reportedKeys = (frontMatter: JsonObject): readonly ImportUnmapped[] =>
  Object.entries(frontMatter).flatMap(([key, value]): readonly ImportUnmapped[] => {
    if (key === 'components') {
      return isRecord(value)
        ? Object.keys(value).map((name) =>
            group(
              `components.${name}`,
              'Components are never imported: the app draws its own, restyled through ' +
                '`design.components`, so these values are a proposal to read.'
            )
          )
        : [group(key, 'Components are never imported.')]
    }
    if (REPORTED_KEYS.has(key)) {
      return [group(key, 'It describes the design record and names no `design` key.')]
    }
    if ((TOKEN_GROUPS as readonly string[]).includes(key)) {
      return isRecord(value) ? [] : [group(key, 'It is not a mapping of names to values.')]
    }
    return [group(key, 'A DESIGN.md does not define this key, so it names no `design` key.')]
  })

/** The sidecar's `colorMeta` entries, or `undefined` when there is no sidecar. */
const sidecarColorMeta = (
  source: ImportSource
): { readonly ok: true; readonly meta: JsonObject | undefined } | { readonly ok: false } => {
  const file = source.files.find((candidate) => candidate.path === DESIGN_MD_SIDECAR)
  if (file === undefined) return { ok: true, meta: undefined }
  const document = parseJson(file.text)
  if (!isRecord(document)) return { ok: false }
  const extensions = ownValue(document, 'extensions')
  const meta = isRecord(extensions) ? ownValue(extensions, 'colorMeta') : undefined
  return { ok: true, meta: isRecord(meta) ? meta : {} }
}

/** The dark colour tokens the sidecar states for declared colours, and the entries it cannot place. */
const darkTokens = (
  meta: JsonObject,
  colors: JsonObject
): {
  readonly tokens: readonly CanonicalToken[]
  readonly unmapped: readonly ImportUnmapped[]
} => {
  const entries = Object.entries(meta)
  return {
    tokens: entries.flatMap(([name, entry]): readonly CanonicalToken[] => {
      const dark = isRecord(entry) ? ownValue(entry, 'dark') : undefined
      return dark === undefined || !hasOwnKey(colors, name)
        ? []
        : [{ path: ['colors', name], type: 'color', value: dark }]
    }),
    unmapped: entries
      .filter(([name]) => !hasOwnKey(colors, name))
      .map(([name]) =>
        group(
          `extensions.colorMeta.${name}`,
          'The sidecar describes a colour the front matter does not declare, so it is not written.'
        )
      ),
  }
}

/** The canonical import of a front matter and, when there is a sidecar, its colour entries. */
const canonicalOf = (frontMatter: JsonObject, meta: JsonObject | undefined): CanonicalImport => {
  const light = lightTokens(frontMatter)
  const lightResolved = resolveAliases(light.tokens)
  const dark = meta === undefined ? undefined : darkTokens(meta, recordAt(frontMatter, 'colors'))
  const darkResolved =
    dark === undefined ? undefined : resolveAliases(dark.tokens, [...light.tokens, ...dark.tokens])
  const unresolved = [...lightResolved.unresolved, ...(darkResolved?.unresolved ?? [])]
  return {
    light: lightResolved.tokens.map(toMapperPath),
    dark: darkResolved?.tokens.map(toMapperPath),
    unmapped: [
      ...light.unmapped,
      ...reportedKeys(frontMatter),
      ...(dark?.unmapped ?? []),
      ...unresolved.map(unresolvedAlias),
    ],
  }
}

/** Read a DESIGN.md: its front matter is light, its sidecar's dark values are dark. */
export const fromDesignMd = (source: ImportSource): AdapterResult => {
  const frontMatter = designFile(source)?.frontMatter
  if (!hasTokenGroup(frontMatter)) {
    return adapterError(
      'It is not a DESIGN.md: a Markdown file whose YAML front matter declares ' +
        '`colors`, `typography`, `rounded` or `spacing`.'
    )
  }
  const sidecar = sidecarColorMeta(source)
  return sidecar.ok
    ? adapterOk(canonicalOf(frontMatter, sidecar.meta))
    : adapterError(
        `The sidecar at ${DESIGN_MD_SIDECAR} is not a JSON object, so its dark values cannot be read.`
      )
}
