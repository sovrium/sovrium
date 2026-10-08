/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Layer, Semaphore } from 'effect'
import {
  OfficeConvertError,
  OfficeConverter,
  type OfficeFile,
} from '@/application/ports/services/office-converter'
import { parseOfficeEnv, type OfficeConfig } from '@/domain/models/process-env/office'
import { postGotenbergForm } from './gotenberg-client'

/**
 * The live office engine: Gotenberg's LibreOffice route, or a LibreOffice
 * installed on the machine run headless through `Bun.spawn`.
 *
 * Either way the file it receives has already lost its external links and
 * fetching fields (the convert step cleans it), and the sidecar is meant to
 * run on a network with no outbound route. `soffice` has no such wall: it runs
 * on this host, with its network, so it is for files the operator trusts.
 *
 * The engine never sees the caller's file name: it gets `input.<type>` and
 * answers `input.pdf` ({@link engineFileName}), so no name can point a write
 * or a read outside the scratch directory. Only the office types are sent.
 */

/** The types the office engine is sent; RTF is not one (it cannot be cleaned). */
const OFFICE_EXTENSIONS: ReadonlySet<string> = new Set([
  'docx',
  'xlsx',
  'pptx',
  'odt',
  'ods',
  'odp',
])

/** The fixed name a file reaches the engine under, or `undefined` for a type it is not sent. */
export const engineFileName = (name: string): string | undefined => {
  const extension = /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase()
  return extension !== undefined && OFFICE_EXTENSIONS.has(extension)
    ? `input.${extension}`
    : undefined
}

/** The PDF a conversion of {@link engineFileName} leaves beside it. */
const ENGINE_OUTPUT_NAME = 'input.pdf'

/** The largest PDF an office conversion may answer with: 100 MB. */
const MAX_OFFICE_OUTPUT_BYTES = 100 * 1024 * 1024

const fail = (reason: OfficeConvertError['reason'], message: string) =>
  new OfficeConvertError({ reason, message: `${reason}: ${message}` })

const timedOut = (config: OfficeConfig) =>
  fail(
    'render_timeout',
    `the conversion took longer than OFFICE_TIMEOUT_MS (${String(config.timeoutMs)} ms)`
  )

const isAbort = (cause: unknown): boolean =>
  cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')

/** Gotenberg `POST /forms/libreoffice/convert`. */
const viaGotenberg = (config: OfficeConfig, url: string) => (file: OfficeFile) =>
  Effect.tryPromise({
    try: () =>
      postGotenbergForm({
        baseUrl: url,
        route: '/forms/libreoffice/convert',
        files: [{ name: file.name, bytes: file.bytes, contentType: 'application/octet-stream' }],
        fields: {},
        timeoutMs: config.timeoutMs,
        maxOutputBytes: MAX_OFFICE_OUTPUT_BYTES,
      }),
    catch: (cause) =>
      isAbort(cause)
        ? timedOut(config)
        : fail(
            'office_unavailable',
            `the office engine at OFFICE_URL could not be reached (${String(cause)})`
          ),
  }).pipe(
    Effect.flatMap((result) =>
      result.ok
        ? Effect.succeed(result.bytes)
        : Effect.fail(
            fail(
              'office_conversion_failed',
              `the office engine refused "${file.name}" (${result.message})`
            )
          )
    ),
    Effect.withSpan('office.gotenberg-convert')
  )

/** The places a LibreOffice is installed when `OFFICE_SOFFICE_PATH` names none. */
const SOFFICE_CANDIDATES: ReadonlyArray<string> = [
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/opt/homebrew/bin/soffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
]

const findSoffice = async (configured: string | undefined): Promise<string | undefined> => {
  if (configured !== undefined)
    return (await Bun.file(configured).exists()) ? configured : undefined
  const onPath = Bun.which('soffice')
  if (onPath !== null) return onPath
  const found = await Promise.all(SOFFICE_CANDIDATES.map((path) => Bun.file(path).exists()))
  return SOFFICE_CANDIDATES[found.indexOf(true)]
}

/**
 * Kill the whole process group a detached `soffice` leads. The `soffice`
 * launcher forks `soffice.bin`, which a signal to the launcher alone leaves
 * running; the group takes both. An already-empty group (`ESRCH`) and Windows,
 * which has no process groups, fall back to the launcher itself.
 */
const killGroup = (child: {
  readonly pid: number
  kill: (signal?: number | NodeJS.Signals) => void
}) => {
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

/** Run `soffice --headless --convert-to pdf` on the file in a scratch directory, removed after. */
const runSoffice = async (soffice: string, file: OfficeFile, timeoutMs: number) => {
  const dir = await mkdtemp(join(tmpdir(), 'sovrium-office-'))
  try {
    const input = join(dir, file.name)
    await writeFile(input, file.bytes)
    const child = Bun.spawn(
      [
        soffice,
        '--headless',
        '--norestore',
        `-env:UserInstallation=file://${join(dir, 'profile')}`,
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        input,
      ],
      // Its own process group, so a timeout kills `soffice.bin` with the launcher.
      { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore', detached: true }
    )
    const deadline = { hit: false }
    const timer = setTimeout(() => {
      deadline.hit = true
      killGroup(child)
    }, timeoutMs)
    const code = await child.exited.finally(() => clearTimeout(timer))
    // Whatever the launcher left behind once it exits is reaped with the group.
    killGroup(child)
    if (deadline.hit) return { kind: 'timeout' } as const
    const pdf = await readFile(join(dir, ENGINE_OUTPUT_NAME)).catch(() => undefined)
    return pdf === undefined || code !== 0
      ? ({ kind: 'failed' } as const)
      : ({ kind: 'ok', bytes: new Uint8Array(pdf) } as const)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const viaSoffice = (config: OfficeConfig) => (file: OfficeFile) =>
  Effect.gen(function* () {
    const soffice = yield* Effect.tryPromise({
      try: () => findSoffice(config.sofficePath),
      catch: () => fail('office_unavailable', 'LibreOffice could not be looked for'),
    })
    if (soffice === undefined) {
      return yield* fail(
        'office_unavailable',
        config.sofficePath === undefined
          ? 'OFFICE_PROVIDER=soffice found no LibreOffice; set OFFICE_SOFFICE_PATH to its soffice executable'
          : `OFFICE_SOFFICE_PATH (${config.sofficePath}) is not a LibreOffice soffice executable`
      )
    }
    const outcome = yield* Effect.tryPromise({
      try: () => runSoffice(soffice, file, config.timeoutMs),
      catch: (cause) =>
        fail(
          'office_conversion_failed',
          `LibreOffice could not convert "${file.name}" (${String(cause)})`
        ),
    })
    if (outcome.kind === 'timeout') return yield* timedOut(config)
    if (outcome.kind === 'failed') {
      return yield* fail('office_conversion_failed', `LibreOffice could not convert "${file.name}"`)
    }
    return outcome.bytes
  }).pipe(Effect.withSpan('office.soffice-convert'))

/** A conversion handed the file under {@link engineFileName}, or refused for a type it is not sent. */
const underEngineName =
  (convert: (file: OfficeFile) => Effect.Effect<Uint8Array, OfficeConvertError>) =>
  (file: OfficeFile): Effect.Effect<Uint8Array, OfficeConvertError> => {
    const name = engineFileName(file.name)
    return name === undefined
      ? Effect.fail(
          fail(
            'office_conversion_failed',
            'the office engine converts docx, xlsx, pptx, odt, ods and odp files only'
          )
        )
      : convert({ name, bytes: file.bytes })
  }

/** A converter that refuses every file with one reason. */
const unavailable = (message: string) => () => Effect.fail(fail('office_unavailable', message))

/** The office engine an env snapshot configures. */
export const makeOfficeConverter = (
  env: Readonly<Record<string, string | undefined>>
): OfficeConverter['Service'] => {
  const parsed = parseOfficeEnv(env)
  if (!parsed.ok) return { convertToPdf: unavailable(parsed.error) }
  const { config } = parsed
  // `OFFICE_CONCURRENCY` conversions at once; the others wait their turn.
  const permits = Semaphore.makeUnsafe(config.concurrency)
  const bounded =
    (convert: (file: OfficeFile) => Effect.Effect<Uint8Array, OfficeConvertError>) =>
    (file: OfficeFile) =>
      permits.withPermits(1)(convert(file))
  if (config.provider === 'soffice')
    return { convertToPdf: bounded(underEngineName(viaSoffice(config))) }
  if (config.provider === 'gotenberg') {
    return config.url === undefined
      ? {
          convertToPdf: unavailable(
            'OFFICE_PROVIDER=gotenberg needs OFFICE_URL set to the Gotenberg base URL'
          ),
        }
      : { convertToPdf: bounded(underEngineName(viaGotenberg(config, config.url))) }
  }
  return {
    convertToPdf: unavailable(
      'no office engine is configured; set OFFICE_PROVIDER to gotenberg (with OFFICE_URL) or soffice'
    ),
  }
}

/** The live layer, reading `process.env` once when built; nothing is started. */
export const OfficeConverterLive = Layer.sync(OfficeConverter, () =>
  makeOfficeConverter(process.env)
)
