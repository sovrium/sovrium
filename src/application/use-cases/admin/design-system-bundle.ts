/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The portable design-system bundle: ONE directory a design tool or an
 * assistant can be handed whole, and the zip of it.
 *
 * It is a projection, never a second builder. The tokens are
 * `buildDesignSystem(app, mode)` for each mode, the brief is
 * `renderDesignSystemMarkdown` of the light document, the stylesheets are
 * spelt from those same two documents (`design-system-bundle-files.ts`), and
 * the kit is the catalogue drawn by the real renderer
 * (`design-system-kit.ts`). So the bundle cannot describe a different design
 * system from the `md` and `json` exports beside it.
 *
 * ─── THE MANIFEST IS THE BUNDLE'S CHECKSUM ─────────────────────────────────
 *
 * `manifest.json` lists every other file with its size and SHA-256, in path
 * order (`bundle-manifest.ts` is the wire contract). It is what the CLI writes
 * last, what the zip carries first, and what the manifest read answers.
 *
 * ─── ONE SPELLING ON EVERY SURFACE ─────────────────────────────────────────
 *
 * `tokens/*.tokens.json` is indented, two spaces and a final newline, whether
 * the bundle is written by the CLI, downloaded as a zip, shared, or read file
 * by file. So one config yields one bundle, and one SHA-256 per file, on every
 * surface: a tool that checksums what the CLI wrote can verify what the server
 * served. (`GET /api/admin/design-system.json` stays the compact standalone
 * export it always was; it is not a bundle file.)
 *
 * ─── THE BINARY FILES ARE COPIED, NEVER INLINED ────────────────────────────
 *
 * The fonts the stylesheet names, the sample media the specimens draw, and the
 * app's own logo files when they sit in its public directory travel as files
 * beside the text, under `fonts/` and `assets/`. The fonts travel again inside
 * the Claude Design project, which is published on its own; the media and the
 * logo do not, since a published system holds pictures, video and sound only
 * as uploads, so its cards draw the media specimens without them. A logo
 * declared as an `https://` URL is named in the brief and never fetched.
 *
 * ─── WHAT IS NEVER IN IT ───────────────────────────────────────────────────
 *
 * No `app.env[]` value and no table data: every file is built from `design`,
 * the operator's name and the platform catalogue, never from the rest of the
 * config. The same bound as the two exports it is built from.
 */

import { Data, Deferred, Effect, Exit, Option } from 'effect'
import { DesignKitAssets } from '@/application/ports/services/design-kit-assets'
import { buildDeflatedZip } from '@/application/use-cases/automations/action-handlers/file-zip'
import {
  DESIGN_SYSTEM_BUNDLE_FORMAT,
  designSystemDocumentSchema,
  type DesignSystemBundleFileRole,
  type DesignSystemBundleManifest,
  type DesignSystemDocument,
  type DesignSystemMode,
} from '@/domain/models/api/admin/design-system'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import {
  CLAUDE_DESIGN_FONTS_DIR,
  exportProviderAdapters,
  PROVIDER_ADAPTER_NAMES,
} from '@/domain/models/app/design/adapters/export'
import { buildDesignSystem } from './design-system'
import {
  renderLlmsIndex,
  renderResolverDocument,
  renderTailwindStylesheet,
  renderThemeStylesheet,
} from './design-system-bundle-files'
import { buildDesignSystemKit, type DesignSystemKit } from './design-system-kit'
import { withoutSampleMedia } from './design-system-kit-document'
import { renderDesignSystemMarkdown } from './design-system-markdown'
import type { CSSCompilationError, CSSCompiler } from '@/application/ports/services/css-compiler'
import type {
  DesignKitAssetFile,
  DesignKitAssetReadError,
  DesignKitFontFile,
} from '@/application/ports/services/design-kit-assets'
import type { PageRenderer } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'

/** One file of the bundle, with the bytes it holds. */
export interface DesignSystemBundleEntry {
  readonly path: string
  readonly mediaType: string
  readonly role: DesignSystemBundleFileRole
  readonly bytes: Uint8Array
}

/** The bundle: its manifest (and that manifest's own bytes), and every other file. */
export interface DesignSystemBundle {
  readonly manifest: DesignSystemBundleManifest
  readonly manifestBytes: Uint8Array
  readonly files: ReadonlyArray<DesignSystemBundleEntry>
}

/** A token document failed its own wire schema; nothing is handed over. */
export class DesignSystemBundleError extends Data.TaggedError('DesignSystemBundleError')<{
  readonly cause: unknown
}> {}

/** Every failure building a bundle can surface. */
export type DesignSystemBundleFailure =
  DesignSystemBundleError | CSSCompilationError | DesignKitAssetReadError

/** The bundle file name of the manifest. */
export const BUNDLE_MANIFEST_PATH = 'manifest.json'

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  css: 'text/css',
  html: 'text/html',
}

const mediaTypeOf = (path: string): string =>
  MEDIA_TYPES[path.slice(path.lastIndexOf('.') + 1)] ?? 'application/octet-stream'

/** Whether a bundle file is text the per-file read answers. */
export const isBundleTextMediaType = (mediaType: string): boolean =>
  mediaType.startsWith('text/') || mediaType === 'application/json'

const encoder = new TextEncoder()

const textEntry = (
  path: string,
  role: DesignSystemBundleFileRole,
  text: string
): DesignSystemBundleEntry => ({
  path,
  role,
  mediaType: mediaTypeOf(path),
  bytes: encoder.encode(text),
})

const sha256Of = (bytes: Uint8Array): string =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

/** One mode's token document, validated against its wire schema. */
const validatedDocument = (app: App, mode: DesignSystemMode) => {
  const decoded = decodeSafe(designSystemDocumentSchema)(buildDesignSystem(app, mode))
  return decoded.success
    ? Effect.succeed(decoded.data as Readonly<DesignSystemDocument>)
    : Effect.fail(new DesignSystemBundleError({ cause: decoded.error }))
}

/** The bundle's one JSON spelling — see the module docblock. */
const serialise = (document: unknown): string => `${JSON.stringify(document, undefined, 2)}\n`

/**
 * `css/theme.css` alone — the stylesheet read answers it without drawing the
 * kit, and it is byte for byte the file the bundle carries.
 */
export const buildDesignSystemThemeStylesheet = (
  app: App
): Effect.Effect<string, DesignSystemBundleError> =>
  Effect.gen(function* () {
    const light = yield* validatedDocument(app, 'light')
    const dark = yield* validatedDocument(app, 'dark')
    return renderThemeStylesheet(light, dark, app.name)
  }).pipe(Effect.withSpan('design-system.theme-stylesheet'))

const manifestOf = (
  app: App,
  files: ReadonlyArray<DesignSystemBundleEntry>
): DesignSystemBundleManifest => ({
  format: DESIGN_SYSTEM_BUNDLE_FORMAT,
  version: 1,
  app: { name: app.name },
  modes: ['light', 'dark'],
  files: files.map((file) => ({
    path: file.path,
    mediaType: file.mediaType,
    bytes: file.bytes.byteLength,
    sha256: sha256Of(file.bytes),
    role: file.role,
  })),
  adapters: [...PROVIDER_ADAPTER_NAMES],
})

/** Where the bundle keeps its copied assets. */
const ASSETS_DIR = 'assets'

/** One copied file at the bundle's path. */
const copied = (
  file: DesignKitAssetFile,
  bundleDir: string,
  role: DesignSystemBundleFileRole
): DesignSystemBundleEntry => ({
  path: `${bundleDir}/${file.fileName}`,
  mediaType: file.mediaType,
  role,
  bytes: file.bytes,
})

/** One copied file, written at the bundle's path and again inside the Claude Design project. */
const copiedTwice = (
  file: DesignKitAssetFile,
  bundleDir: string,
  projectDir: string,
  role: DesignSystemBundleFileRole
): readonly DesignSystemBundleEntry[] => [
  { path: `${bundleDir}/${file.fileName}`, mediaType: file.mediaType, role, bytes: file.bytes },
  // The Claude Design project is published on its own, so what its pages and
  // its tokens name travels inside it.
  {
    path: `${projectDir}/${file.fileName}`,
    mediaType: file.mediaType,
    role: 'adapter',
    bytes: file.bytes,
  },
]

/** The logo files the app declares in its public directory; an `https://` mark is not fetched. */
const logoFiles = (app: App) =>
  Effect.gen(function* () {
    const assets = yield* DesignKitAssets
    const sources = [app.design?.logo?.src, app.design?.logo?.srcDark].filter(
      (source): source is string => source !== undefined && source.startsWith('/')
    )
    const found = yield* Effect.forEach([...new Set(sources)], assets.publicFile)
    const files = found.flatMap((file) => (Option.isSome(file) ? [file.value] : []))
    // Two declared paths with one basename would collide in `assets/`: the first keeps it.
    return files.filter(
      (file, index) => files.findIndex((other) => other.fileName === file.fileName) === index
    )
  })

/**
 * The provider projections, from the same two documents and the same kit. The
 * Claude Design cards draw the media specimens without their sample media,
 * which the project does not carry, and its tokens name each font by its path
 * under the project's `fonts/`.
 */
const adapterEntries = (
  appName: string,
  modes: {
    readonly light: Readonly<DesignSystemDocument>
    readonly dark: Readonly<DesignSystemDocument>
  },
  kit: DesignSystemKit,
  fonts: readonly DesignKitFontFile[]
): readonly DesignSystemBundleEntry[] =>
  exportProviderAdapters({
    appName,
    light: modes.light,
    dark: modes.dark,
    components: kit.manifest.types,
    previews: Object.fromEntries(
      Object.entries(kit.previews).map(([type, body]) => [type, withoutSampleMedia(body)])
    ),
    stylesheet: kit.stylesheet,
    fonts: fonts.map((font) => ({
      family: font.family,
      file: `fonts/${font.fileName}`,
      weight: font.weight,
      style: font.style,
    })),
  }).map((file) => textEntry(file.path, 'adapter', file.content))

const assembleBundle = (app: App) =>
  Effect.gen(function* () {
    const light = yield* validatedDocument(app, 'light')
    const dark = yield* validatedDocument(app, 'dark')
    const kit = yield* buildDesignSystemKit(app)
    const assets = yield* DesignKitAssets
    const fonts = yield* assets.webFonts
    const samples = (yield* Effect.forEach(kit.sampleMedia, assets.sampleMedia)).flatMap((file) =>
      Option.isSome(file) ? [file.value] : []
    )
    const logos = yield* logoFiles(app)
    const files = [
      textEntry('DESIGN.md', 'brief', renderDesignSystemMarkdown(light, dark, app.name)),
      textEntry('llms.txt', 'index', renderLlmsIndex(app.name)),
      textEntry('tokens/base.tokens.json', 'tokens', serialise(light)),
      textEntry('tokens/dark.tokens.json', 'tokens', serialise(dark)),
      textEntry('tokens/sovrium.resolver.json', 'resolver', renderResolverDocument(app.name)),
      textEntry('css/theme.css', 'css', renderThemeStylesheet(light, dark, app.name)),
      textEntry('css/tailwind.css', 'css', renderTailwindStylesheet(light)),
      ...kit.files.map((file) => textEntry(file.path, 'kit', file.text)),
      ...adapterEntries(app.name, { light, dark }, kit, fonts),
      ...fonts.flatMap((font) => copiedTwice(font, 'fonts', CLAUDE_DESIGN_FONTS_DIR, 'font')),
      ...samples.map((sample) => copied(sample, ASSETS_DIR, 'asset')),
      ...logos.map((logo) => copied(logo, ASSETS_DIR, 'asset')),
    ].toSorted((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
    const manifest = manifestOf(app, files)
    return {
      manifest,
      manifestBytes: encoder.encode(serialise(manifest)),
      files,
    } satisfies DesignSystemBundle
  })

/**
 * The bundle of each config object, built ONCE — including while it is still
 * being built.
 *
 * A config reload builds a new `App`, so the memo dies with the app it was
 * built from — nothing to invalidate. Without it, an assistant reading the
 * bundle file by file would redraw the whole kit on every file it asked for.
 *
 * The memo holds the build's `Deferred` from the moment the first read starts
 * it, so reads arriving while the kit is still drawing wait for that one build
 * instead of each starting their own. A build that fails (or is interrupted)
 * hands its outcome to whoever was waiting and is forgotten, so the next read
 * tries again rather than replaying the failure forever.
 */
const bundleMemo = new WeakMap<
  App,
  Deferred.Deferred<DesignSystemBundle, DesignSystemBundleFailure>
>()

/** Each built bundle's zip, deflated once — a download and a share hit both reuse it. */
const zipMemo = new WeakMap<DesignSystemBundle, Uint8Array>()

/** Build the bundle of one app — the same bundle for every surface that hands it over. */
export const buildDesignSystemBundle = (
  app: App
): Effect.Effect<
  DesignSystemBundle,
  DesignSystemBundleFailure,
  PageRenderer | CSSCompiler | DesignKitAssets
> =>
  Effect.suspend(() => {
    const inFlight = bundleMemo.get(app)
    if (inFlight !== undefined) return Deferred.await(inFlight)
    const build = Deferred.makeUnsafe<DesignSystemBundle, DesignSystemBundleFailure>()
    // eslint-disable-next-line functional/no-expression-statements -- the memo IS the mutation
    bundleMemo.set(app, build)
    return assembleBundle(app).pipe(
      Effect.onExit((exit) =>
        Effect.andThen(
          Exit.isSuccess(exit)
            ? Effect.void
            : Effect.sync(() => {
                // eslint-disable-next-line functional/no-expression-statements -- forget a failed build
                bundleMemo.delete(app)
              }),
          Deferred.done(build, exit)
        )
      ),
      Effect.withSpan('design-system.bundle')
    )
  })

/** The bundle as one zip: the manifest first, then every file in path order. */
export const zipDesignSystemBundle = (bundle: DesignSystemBundle): Uint8Array => {
  const cached = zipMemo.get(bundle)
  if (cached !== undefined) return cached
  const zipped = buildDeflatedZip([
    { name: BUNDLE_MANIFEST_PATH, bytes: bundle.manifestBytes },
    ...bundle.files.map((file) => ({ name: file.path, bytes: file.bytes })),
  ])
  // eslint-disable-next-line functional/no-expression-statements -- the memo IS the mutation
  zipMemo.set(bundle, zipped)
  return zipped
}

/**
 * The listed TEXT file at `path`, or `undefined` — for a binary file, a path
 * that climbs, and a typo alike, so the per-file read answers them one 404.
 */
export const bundleTextFile = (
  bundle: DesignSystemBundle,
  path: string
): DesignSystemBundleEntry | undefined =>
  bundle.files.find((file) => file.path === path && isBundleTextMediaType(file.mediaType))
