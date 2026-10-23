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
 * ─── GEIST IS LEFT OUT WHEN NO FACE USES IT ────────────────────────────────
 *
 * The platform's `sans` and `mono` faces are Geist and Geist Mono. When the
 * app self-hosts its own `sans` (or `mono`) face, the Geist file standing for
 * it is drawn by no rule, so neither the file nor its `@font-face` rule is
 * carried.
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
  /** The Geist families no face draws any more. */
  readonly replaced: readonly string[]
  /** One sentence per face, stylesheet or file that is not carried. */
  readonly notices: readonly string[]
}

/** The Geist family each platform face is drawn with. */
const GEIST_FAMILY_OF: Readonly<Record<string, string>> = {
  sans: 'Geist Variable',
  mono: 'Geist Mono Variable',
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
    const replaced = families.flatMap((font) =>
      GEIST_FAMILY_OF[font.key] !== undefined &&
      isLocal(font.url) &&
      files.some((file) => file.family === font.family)
        ? [GEIST_FAMILY_OF[font.key] as string]
        : []
    )
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
      replaced,
      notices: [...remote, ...missing],
    } satisfies BrandFonts
  }).pipe(
    Effect.withSpan('design-system.brand-fonts', {
      attributes: { 'design.font_families': familiesWithUrl(app).length },
    })
  )

/** Whether a font file stands for a Geist face no rule draws any more. */
export const isReplacedFont = (brand: BrandFonts, font: DesignKitFontFile): boolean =>
  brand.replaced.includes(font.family)

/**
 * A stylesheet of the bundle with its Geist rules no face draws removed and
 * the app's own faces declared, their sources under `directory`.
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
  if (brand.rules.length === 0 && brand.replaced.length === 0) return stylesheet
  const kept = stylesheet.replaceAll(FACE_PATTERN, (rule) =>
    brand.replaced.includes(descriptorsOf(rule).family) ? '' : rule
  )
  const rules = brand.rules.map((rule) => rule.replaceAll("url('fonts/", `url('${directory}`))
  return `${kept.trimEnd()}\n${rules.join('\n')}\n`
}
