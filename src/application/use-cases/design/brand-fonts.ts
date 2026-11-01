/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The faces an app self-hosts through `design.typeScale.families.*.url`,
 * carried into the portable bundle.
 *
 * The renderer loads such a face with a `<link rel="stylesheet">` in the page
 * head, which the kit and the page drawings do not keep: a drawing copied out
 * of its server would fall back to another face. So the bundle reads the
 * stylesheet from the app's public directory, copies every face file its
 * `@font-face` rules name under `fonts/`, and declares those rules in each
 * stylesheet it writes, pointed at the copies.
 *
 * ─── A REMOTE FACE IS NAMED, NEVER FETCHED ─────────────────────────────────
 *
 * An export is offline. A family whose `url` is another site's is left out
 * and named in a notice, with the address, so the designer knows the drawing
 * falls back for it; a local stylesheet or face file that is missing is named
 * the same way. Nothing is ever failed for it.
 *
 * ─── A FACE NO RULE DRAWS IS LEFT OUT ──────────────────────────────────────
 *
 * The platform's `sans` and `mono` faces are Geist and Geist Mono. Once the
 * theme has re-pointed `--font-sans` or `--font-mono` at the app's own family,
 * whether or not that family carries a `url`, no rule of the stylesheet
 * resolves to the Geist face any more. So a face is kept exactly while some
 * rule outside the `@font-face` rules still names its family, and only the
 * files of the faces kept are shipped.
 */

import { posix } from 'node:path'
import { Effect, Option } from 'effect'
import { DesignKitAssets } from '@/application/ports/services/design-kit-assets'
import type {
  DesignKitAssetFile,
  DesignKitFontFile,
} from '@/application/ports/services/design-kit-assets'
import type { App } from '@/domain/models/app'

/** The faces an app self-hosts, ready to be carried. */
export interface BrandFonts {
  /** Every face file the app's stylesheets name, by its bundle file name. */
  readonly files: readonly DesignKitFontFile[]
  /** Each carried `@font-face` rule, its sources at `fonts/<file>`. */
  readonly rules: readonly string[]
  /** One sentence per face, stylesheet or file that is not carried. */
  readonly notices: readonly string[]
}

const FACE_PATTERN = /@font-face\s*\{[^}]*\}/g
const URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g

interface Family {
  readonly key: string
  readonly family: string
  readonly url: string
}

/** Every family the type scale loads through a `url`, in config order. */
const familiesWithUrl = (app: App): readonly Family[] =>
  Object.entries(app.design?.typeScale?.families ?? {}).flatMap(([key, value]) => {
    const font = value as { readonly family?: string; readonly url?: string }
    return font.url === undefined || font.family === undefined
      ? []
      : [{ key, family: font.family, url: font.url }]
  })

const isLocal = (url: string): boolean => url.startsWith('/') && !url.startsWith('//')

/** A `url(…)` target of a stylesheet at `from`, as a root-relative path; none when remote. */
const resolvedTarget = (from: string, target: string): string | undefined => {
  const bare = target.replace(/[?#].*$/, '')
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) || bare.startsWith('//')) return undefined
  return bare.startsWith('/') ? posix.normalize(bare) : posix.join(posix.dirname(from), bare)
}

/** The family, weight and style an `@font-face` rule declares. */
const descriptorsOf = (rule: string) => ({
  family: /font-family\s*:\s*["']?([^;"']+)/i.exec(rule)?.[1]?.trim() ?? '',
  weight: /font-weight\s*:\s*([^;}]+)/i.exec(rule)?.[1]?.trim() ?? '400',
  style: /font-style\s*:\s*italic/i.test(rule) ? ('italic' as const) : ('normal' as const),
})

/** One stylesheet's rules with their sources rewritten, and the files they name. */
const carryStylesheet = (url: string, css: string) =>
  Effect.gen(function* () {
    const assets = yield* DesignKitAssets
    const rules = [...css.matchAll(FACE_PATTERN)].map((match) => match[0])
    const targets = [
      ...new Set(
        rules.flatMap((rule) =>
          [...rule.matchAll(URL_PATTERN)].flatMap((match) => {
            const path = resolvedTarget(url, match[1] ?? match[2] ?? match[3] ?? '')
            return path === undefined ? [] : [path]
          })
        )
      ),
    ]
    const found = yield* Effect.forEach(targets, (path) =>
      Effect.map(assets.publicFile(path), (file) => [path, Option.getOrUndefined(file)] as const)
    )
    const byPath = new Map(found)
    const carried = rules.map((rule) =>
      rule.replaceAll(URL_PATTERN, (whole, double?: string, single?: string, bare?: string) => {
        const path = resolvedTarget(url, double ?? single ?? bare ?? '')
        const file = path === undefined ? undefined : byPath.get(path)
        return file === undefined ? 'none' : `url('fonts/${file.fileName}')`
      })
    )
    const files = rules.flatMap((rule, index) =>
      [...rule.matchAll(URL_PATTERN)].flatMap((match) => {
        const path = resolvedTarget(url, match[1] ?? match[2] ?? match[3] ?? '')
        const file: DesignKitAssetFile | undefined =
          path === undefined ? undefined : byPath.get(path)
        return file === undefined
          ? []
          : [{ ...file, ...descriptorsOf(carried[index] ?? rule) } satisfies DesignKitFontFile]
      })
    )
    const missing = found.flatMap(([path, file]) => (file === undefined ? [path] : []))
    return { rules: carried, files, missing }
  })

const decoder = new TextDecoder()

/**
 * The faces `app` self-hosts, read from its public directory.
 *
 * @param app - the validated config.
 */
export const collectBrandFonts = (app: App) =>
  Effect.gen(function* () {
    const assets = yield* DesignKitAssets
    const families = familiesWithUrl(app)
    const remote = families
      .filter((font) => !isLocal(font.url))
      .map(
        (font) =>
          `Note: the ${font.key} face ${font.family} is loaded from ${font.url}, which an ` +
          'export never fetches, so the drawings fall back for it.'
      )
    const urls = [...new Set(families.filter((font) => isLocal(font.url)).map((f) => f.url))]
    const sheets = yield* Effect.forEach(urls, (url) =>
      Effect.flatMap(assets.publicFile(url), (file) =>
        Option.isNone(file)
          ? Effect.succeed({ url, rules: [], files: [], missing: [url] })
          : Effect.map(carryStylesheet(url, decoder.decode(file.value.bytes)), (sheet) => ({
              url,
              ...sheet,
            }))
      )
    )
    const files = sheets
      .flatMap((sheet) => sheet.files)
      .filter((file, index, all) => all.findIndex((o) => o.fileName === file.fileName) === index)
    const missing = sheets.flatMap((sheet) =>
      sheet.missing.map(
        (path) =>
          `Note: ${path}, named by the type scale's stylesheet ${sheet.url}, is not in the ` +
          'public directory, so the bundle does not carry it.'
      )
    )
    return {
      files,
      rules: sheets.flatMap((sheet) => sheet.rules),
      notices: [...remote, ...missing],
    } satisfies BrandFonts
  }).pipe(
    Effect.withSpan('design-system.brand-fonts', {
      attributes: { 'design.font_families': familiesWithUrl(app).length },
    })
  )

/**
 * The families a stylesheet declares an `@font-face` for that some other rule
 * of it still resolves to.
 *
 * @param stylesheet - a stylesheet as {@link withBrandFaces} returns it.
 */
export const drawnFaceFamilies = (stylesheet: string): ReadonlySet<string> => {
  const drawing = stylesheet.replaceAll(FACE_PATTERN, '')
  return new Set(
    [...stylesheet.matchAll(FACE_PATTERN)]
      .map((match) => descriptorsOf(match[0]).family)
      .filter((family) => family !== '' && drawing.includes(family))
  )
}

/**
 * A stylesheet of the bundle with the app's own faces declared, their sources
 * under `directory`, and every face no rule draws removed: the Geist face a
 * family of the app's re-pointed variable no longer reaches, above all.
 *
 * @param stylesheet - the stylesheet as the kit writes it.
 * @param brand - the faces the app self-hosts.
 * @param directory - where the stylesheet finds the bundle's `fonts/`.
 */
export const withBrandFaces = (
  stylesheet: string,
  brand: BrandFonts,
  directory = '../fonts/'
): string => {
  const rules = brand.rules.map((rule) => rule.replaceAll("url('fonts/", `url('${directory}`))
  const declared =
    rules.length === 0 ? stylesheet : `${stylesheet.trimEnd()}\n${rules.join('\n')}\n`
  const drawn = drawnFaceFamilies(declared)
  return declared.replaceAll(FACE_PATTERN, (rule) =>
    drawn.has(descriptorsOf(rule).family) ? rule : ''
  )
}
