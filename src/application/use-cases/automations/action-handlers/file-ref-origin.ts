/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  classifyStepRead,
  type StepAction,
} from '@/domain/models/app/automations/step-read-service'
import { isRecord, type Raw } from './document-run'
import { authoredActionProps } from './run-context-resolution'
import type { ActionRunContext, AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/**
 * WHO CHOSE A FILE REFERENCE: the configuration, or the run's data.
 *
 * A file reference names what a step reads and may hand on — an email
 * attachment, a merge input. Its SHAPE decides what can be reached: a key in
 * a bucket, a private asset, a record's attachment, a URL. That choice belongs
 * to whoever wrote the configuration. So a reference is judged by the prop as
 * the config wrote it, not by the value it resolved to:
 *
 * - written out as an object (`{ key, bucket }`, `{ asset }`, `{ record }`,
 *   `{ url }`, `{ step }`), whose filled-in values are run data in an authored
 *   shape, it is the configuration's — unless a template swapped the shape;
 * - one template (`'{{trigger.data.files}}'`, or a named template's `$files`)
 *   the run fills with a reference or a list of them, it is the run's data.
 *
 * A reference from run data may only name a file THIS RUN produced: `{ step }`
 * naming one of its file-producing steps, or the key of a file such a step
 * wrote (a temporary one, or one it attached, with that bucket). It is never
 * parsed out of a JSON string: a string is a key.
 */

/** Where a file reference came from. */
export type FileRefOrigin = 'config' | 'run-data'

/** One file reference, with the prop it was read from and who chose it. */
export interface FileRefItem {
  readonly ref: unknown
  readonly origin: FileRefOrigin
  readonly prop: string
}

/** Text a run fills in: a `{{…}}` template, or a named template's `$name`. */
const isFilledIn = (value: unknown): boolean =>
  typeof value === 'string' && (value.includes('{{') || /\$[A-Za-z_]/.test(value))

/** The prop as the configuration wrote it, or `undefined` when a step built the props. */
const configuredValue = (
  runContext: ActionRunContext,
  name: string
): { readonly value: unknown } | undefined => {
  if (runContext.propsFinal !== true) return { value: authoredActionProps(runContext)[name] }
  const configured = runContext.rawAction['$configuredProps']
  return isRecord(configured) ? { value: configured[name] } : undefined
}

/** The kind of reference a value is, as far as its shape decides what it reaches. */
const formOf = (value: unknown): string => {
  if (typeof value === 'string') return 'key'
  if (!isRecord(value)) return 'none'
  if ('file' in value) return `input:${formOf(value['file'])}`
  if (typeof value['step'] === 'string') return 'step'
  if (typeof value['asset'] === 'string') return 'asset'
  if (isRecord(value['record'])) return 'record'
  if (typeof value['url'] === 'string') return 'url'
  return 'keyed'
}

/** Whether a configured `{ key, bucket? }` lets the run choose the file outright. */
const runChoosesKeyedFile = (configured: Raw): boolean => {
  const { key, bucket } = configured
  const fixedBucket = typeof bucket === 'string' && bucket !== '' && !isFilledIn(bucket)
  return isFilledIn(key) && !fixedBucket
}

/**
 * Whether a configured `{ asset }` or `{ step }` lets the run choose what it
 * names: the shape is the configuration's, but a filled-in name is the
 * request's choice, so the reference counts as run data.
 */
const runNamesTarget = (configured: Raw): boolean => {
  const form = formOf(configured)
  return (form === 'asset' || form === 'step') && isFilledIn(configured[form])
}

/** Who chose one reference, given the value the config wrote in its place. */
const originOf = (configured: unknown, resolved: unknown): FileRefOrigin => {
  if (typeof configured === 'string') return isFilledIn(configured) ? 'run-data' : 'config'
  if (!isRecord(configured)) return 'run-data'
  if ('file' in configured) {
    return originOf(configured['file'], isRecord(resolved) ? resolved['file'] : undefined)
  }
  if (formOf(configured) !== formOf(resolved) || runNamesTarget(configured)) return 'run-data'
  return formOf(configured) === 'keyed' && runChoosesKeyedFile(configured) ? 'run-data' : 'config'
}

/** The references a value holds: a list, or one reference. A string is never parsed. */
const itemsOf = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) return value
  return value === undefined || value === null || value === '' ? [] : [value]
}

/**
 * The file references of the list prop `name` (`attachments`, `inputs`,
 * `images`), each with who chose it. `resolved` is the prop's value as the
 * run filled it, its types kept.
 */
export const fileRefsOf = (
  resolved: unknown,
  name: string,
  runContext: ActionRunContext | undefined
): readonly FileRefItem[] => {
  const items = itemsOf(resolved)
  if (runContext === undefined) return items.map((ref) => ({ ref, origin: 'config', prop: name }))
  const configured = configuredValue(runContext, name)
  const written = configured === undefined ? undefined : configured.value
  return items.map((ref, index) => {
    const origin =
      configured === undefined
        ? 'run-data'
        : Array.isArray(written)
          ? originOf(written[index], ref)
          : originOf(written, ref)
    return { ref, origin, prop: name }
  })
}

/** The one file reference of the prop `name` (`file`, `image`), with who chose it. */
export const fileRefOf = (
  resolved: unknown,
  name: string,
  runContext: ActionRunContext | undefined
): FileRefItem => {
  if (runContext === undefined) return { ref: resolved, origin: 'config', prop: name }
  const configured = configuredValue(runContext, name)
  const origin = configured === undefined ? 'run-data' : originOf(configured.value, resolved)
  return { ref: resolved, origin, prop: name }
}

const FILE_STEP_TYPES: ReadonlySet<unknown> = new Set(['document', 'pdf', 'file'])

/** A `file` operator that removes a file: it reads none, and it writes none either. */
const REMOVES_A_FILE: ReadonlySet<string> = new Set(['file/delete'])

/**
 * Whether a declared step writes a file: a document, PDF or file operator the
 * step-read classification says reads no stored file (`none`). What a writer
 * hands on is a file it just wrote. An operator that reads stored files —
 * `list`, `getMetadata`, `signUrl`, `download`, `inspect`, the parsers — is
 * classified as a read (`unknown`), and the keys its output carries name files
 * this run did NOT produce: counting them would let run data name any file
 * they list. An operator no classification knows does not count either.
 */
const writesFile = (app: App, action: Raw): boolean => {
  if (!FILE_STEP_TYPES.has(action['type'])) return false
  if (REMOVES_A_FILE.has(`${String(action['type'])}/${String(action['operator'])}`)) return false
  return classifyStepRead(app, action as StepAction).kind === 'none'
}

/** The names of every step of the automation that writes a file, nested ones included. */
const fileStepNames = (app: App, automation: AutomationContext): ReadonlySet<string> => {
  const declared = app.automations?.find((candidate) => candidate.name === automation.name)
  const walk = (value: unknown): readonly string[] => {
    if (Array.isArray(value)) return value.flatMap(walk)
    if (!isRecord(value)) return []
    const own = typeof value['name'] === 'string' && writesFile(app, value) ? [value['name']] : []
    return [...own, ...Object.values(value).flatMap(walk)]
  }
  return new Set(walk(declared?.actions))
}

const isWrittenFile = (value: unknown): value is Raw =>
  isRecord(value) && typeof value['key'] === 'string' && value['key'] !== ''

/**
 * The files a writing step's output says it wrote: the output itself (`key`,
 * with its `bucket` when attached), and each part of a split (`files`). Nothing
 * else it carries — a source it read from is not a file it wrote.
 */
const writtenFilesOf = (output: unknown): readonly Raw[] => {
  if (!isRecord(output)) return []
  const parts = Array.isArray(output['files']) ? output['files'].filter(isWrittenFile) : []
  return [...(isWrittenFile(output) ? [output] : []), ...parts]
}

/** What this run produced: the names of its file steps and the files they wrote. */
interface RunFiles {
  readonly steps: ReadonlySet<string>
  readonly keys: ReadonlyMap<string, string | undefined>
}

const runFilesOf = (
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
): RunFiles => {
  const steps = fileStepNames(app, automation)
  const outputs = Object.entries(runContext?.previousSteps ?? {}).filter(([name]) =>
    steps.has(name)
  )
  const keys = new Map(
    outputs
      .flatMap(([, output]) => writtenFilesOf(output))
      .map((file) => [
        String(file['key']),
        typeof file['bucket'] === 'string' ? file['bucket'] : undefined,
      ])
  )
  return { steps, keys }
}

/** Whether `key` is a file this run wrote, in `bucket` (`undefined`: a temporary one). */
const wroteFile = (run: RunFiles, key: unknown, bucket: unknown): boolean =>
  typeof key === 'string' &&
  run.keys.has(key) &&
  run.keys.get(key) === (typeof bucket === 'string' ? bucket : undefined)

/** Whether a reference from run data names a file this run produced. */
const namesRunFile = (ref: unknown, run: RunFiles): boolean => {
  const inner = isRecord(ref) && 'file' in ref ? ref['file'] : ref
  if (typeof inner === 'string') return wroteFile(run, inner, undefined)
  const form = formOf(inner)
  if (form === 'step' && isRecord(inner)) return run.steps.has(String(inner['step']))
  return form === 'keyed' && isRecord(inner) && wroteFile(run, inner['key'], inner['bucket'])
}

/** The step a `{ step }` reference names (inside a `{ file }` wrapper too), or `undefined`. */
const stepNamed = (ref: unknown): string | undefined => {
  const inner = isRecord(ref) && 'file' in ref ? ref['file'] : ref
  return isRecord(inner) && typeof inner['step'] === 'string' ? inner['step'] : undefined
}

/**
 * Why a reference may not be read, or `undefined` when it may. A `{ step }`
 * only ever reads a step of the automation that writes files, whoever wrote
 * it: what a step that listed, read or signed stored files returns names no
 * file of this run. Beyond that, one the configuration wrote always may; one
 * from run data only when it names a file this run produced.
 */
export const fileRefRefusal = (
  item: FileRefItem,
  scope: {
    readonly app: App
    readonly automation: AutomationContext
    readonly runContext: ActionRunContext | undefined
  }
): string | undefined => {
  if (item.origin === 'config') {
    const step = stepNamed(item.ref)
    return step === undefined || fileStepNames(scope.app, scope.automation).has(step)
      ? undefined
      : `${item.prop} names step "${step}", which writes no file: a { step } reference only reads a step of this automation that writes one`
  }
  // From run data, a step is one of this run's file steps or nothing (`namesRunFile`).
  return namesRunFile(item.ref, runFilesOf(scope.app, scope.automation, scope.runContext))
    ? undefined
    : `${item.prop} from run data may only name a file this run produced — { step: <name> } or a file a step of this run wrote; a key, { key, bucket }, { asset }, { record } or { url } is written in the configuration`
}

/** A stored file as a read compares it: its key, and its bucket (`undefined`: none named). */
interface StoredFile {
  readonly key: string
  readonly bucket: string | undefined
}

const storedFileOf = (value: unknown): StoredFile | undefined =>
  isRecord(value) && typeof value['key'] === 'string' && value['key'] !== ''
    ? {
        key: value['key'],
        bucket: typeof value['bucket'] === 'string' ? value['bucket'] : undefined,
      }
    : undefined

/**
 * The stored files the configuration wrote out inside a value: each
 * `{ key, bucket }` in an authored shape (see {@link originOf}), read at the
 * same place of the value the run filled. Where a template stands in place of
 * an object, what it put there is run data, and nothing beneath it counts.
 */
const configuredFilesIn = (configured: unknown, resolved: unknown): readonly StoredFile[] => {
  if (Array.isArray(configured)) {
    if (!Array.isArray(resolved)) return []
    return configured.flatMap((item, index) => configuredFilesIn(item, resolved[index]))
  }
  if (!isRecord(configured) || !isRecord(resolved)) return []
  const own =
    'key' in configured && originOf(configured, resolved) === 'config'
      ? storedFileOf(resolved)
      : undefined
  const nested = Object.keys(configured).flatMap((name) =>
    configuredFilesIn(configured[name], resolved[name])
  )
  return own === undefined ? nested : [own, ...nested]
}

/**
 * Why a stored file `{ key, bucket }` found anywhere in the prop `name` (a
 * document's `data`, which a template draws from) may not be read, or
 * `undefined` when it may. One the configuration wrote out in that prop may —
 * its key filled in by the run or not; so may one equal to it, which reaches
 * nothing the configuration did not already name. Any other shape came from
 * the run's data, and may only name a file this run produced.
 */
export const storedFileRefusal = (
  ref: unknown,
  within: { readonly name: string; readonly resolved: unknown },
  scope: Parameters<typeof fileRefRefusal>[1]
): string | undefined => {
  const { runContext } = scope
  if (runContext === undefined) return undefined
  const configured = configuredValue(runContext, within.name)
  const named = configured === undefined ? [] : configuredFilesIn(configured.value, within.resolved)
  const file = storedFileOf(ref)
  const isNamed =
    file !== undefined &&
    named.some((candidate) => candidate.key === file.key && candidate.bucket === file.bucket)
  return isNamed ? undefined : fileRefRefusal({ ref, origin: 'run-data', prop: within.name }, scope)
}

/** Every string the configuration wrote out, not filled in, anywhere in a value. */
const authoredStrings = (configured: unknown): readonly string[] => {
  if (typeof configured === 'string') return isFilledIn(configured) ? [] : [configured]
  if (Array.isArray(configured)) return configured.flatMap(authoredStrings)
  return isRecord(configured) ? Object.values(configured).flatMap(authoredStrings) : []
}

/**
 * Why a plain-string picture source (a declared asset's path) found in the
 * prop `name` may not be read, or `undefined` when it may: one the template
 * wrote as a literal may, and so may one the configuration wrote out in that
 * prop; a name the run's data supplied never reaches a declared asset.
 */
export const assetNameRefusal = (
  source: string,
  within: { readonly name: string; readonly literal: boolean },
  runContext: ActionRunContext | undefined
): string | undefined => {
  if (runContext === undefined || within.literal) return undefined
  const configured = configuredValue(runContext, within.name)
  const authored = configured === undefined ? [] : authoredStrings(configured.value)
  return authored.includes(source)
    ? undefined
    : `${within.name} from run data cannot name a declared asset; write the asset path in the template or the configuration`
}
