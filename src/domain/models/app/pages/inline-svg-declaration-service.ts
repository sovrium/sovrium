/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { objectNodes } from '@/domain/kernel/config-parsing/config-node-walk'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { isLiteralPublicSvgPath } from './components/component-types/content/image'

/** A page and a file it draws through `inlineSvg`. */
export interface InlineSvgDeclaration {
  readonly page: string
  readonly path: string
}

/** The slice of an app {@link inlineSvgDeclarations} reads. */
interface InlineSvgApp {
  readonly pages?: ReadonlyArray<{
    readonly name: string
    readonly components?: unknown
    readonly layout?: unknown
  }>
  readonly components?: ReadonlyArray<{ readonly name: string }>
}

/**
 * What `inlineSvg` names under these vars. A bare `$input` is that input's value,
 * or `undefined` when nothing here fills it. Anything else is itself, a
 * `$record.` token included, for the caller to judge.
 */
const filledSource = (
  source: string,
  vars: Readonly<Record<string, unknown>>
): string | undefined => {
  const input = /^\$(\w+)$/.exec(source)?.[1]
  if (input === undefined) return source
  const filled = vars[input]
  return typeof filled === 'string' ? filled : undefined
}

/** A placement's vars, each one a `$input` of the template around it read through that template. */
const placedVars = (
  written: unknown,
  vars: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(isRecord(written) ? written : {}).map(([name, value]) => [
      name,
      typeof value === 'string' ? filledSource(value, vars) : value,
    ])
  )

/** Every source drawn under a subtree, following each template it places into that template. */
const drawnSources = (
  value: unknown,
  templates: NonNullable<InlineSvgApp['components']>,
  vars: Readonly<Record<string, unknown>>,
  followed: ReadonlySet<string>
): readonly string[] =>
  objectNodes(value).flatMap((node) => {
    const own =
      typeof node['inlineSvg'] === 'string' ? filledSource(node['inlineSvg'], vars) : undefined
    const name = node['$ref'] ?? node['component']
    const template =
      typeof name === 'string' && !followed.has(name)
        ? templates.find((candidate) => candidate.name === name)
        : undefined
    const placed =
      template === undefined
        ? []
        : drawnSources(
            template,
            templates,
            placedVars(node['vars'], vars),
            new Set([...followed, template.name])
          )
    return own === undefined ? placed : [own, ...placed]
  })

/**
 * Every value an `inlineSvg` of the config takes, read as written, wherever the
 * node sits: the schema does not reach a breakpoint's children or a card slot,
 * which decode as open records, so this is what holds them to a literal path.
 */
export const inlineSvgSources = (app: InlineSvgApp): readonly string[] => [
  ...new Set(
    drawnSources([app.pages, app.components], app.components ?? [], {}, new Set<string>())
  ),
]

/**
 * Every file each page draws, once per page: written on a node, or reached
 * through a template it places, whose input may hold the path.
 */
export const inlineSvgDeclarations = (app: InlineSvgApp): readonly InlineSvgDeclaration[] =>
  (app.pages ?? []).flatMap((page) =>
    [
      ...new Set(
        drawnSources([page.components, page.layout], app.components ?? [], {}, new Set<string>())
      ),
    ]
      .filter(isLiteralPublicSvgPath)
      .map((path) => ({ page: page.name, path }))
  )

/** The warning for a file that will not be drawn: one line naming the page and the path. */
export const undrawnInlineSvgWarning = ({ page, path }: InlineSvgDeclaration): string =>
  `The page "${page}" draws ${path}, which is not an SVG drawing in the public directory: it falls back to a plain image.`
