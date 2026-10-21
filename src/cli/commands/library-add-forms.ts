/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library add` — the forms a block ships beside its component.
 *
 * A page `form` never adds a record on its own, so a block that adds one places
 * a `forms[]` entry with `formRef` and ships that entry with it
 * (`LibraryEntry.forms`). Each is installed as its own fragment,
 * `library/form/<name>.<ext>`, wired under `forms`, and opens with the block's
 * provenance line — so the operator can tell both files came from one install.
 *
 * A form needs an `id` the config does not use. A new one takes the next free
 * id; a fragment already on disk keeps the id it carries, so installing the
 * block again writes the same bytes and changes nothing. A form re-added with
 * new parameters follows the component's rule (`library-add-reinstall.ts`):
 * rewritten while it is unedited, kept as an edit otherwise — and replaced,
 * edited or not, under `--update`.
 *
 * Pure planning, no writes: a refusal comes back as its message, and the
 * caller (`library-add-plan.ts`) refuses with it, before anything is written.
 */

import { dirname, join } from 'node:path'
import { defaultParams } from './library-add-params'
import {
  asOf,
  editedMessage,
  placementOf,
  reinstallOf,
  renderFragment,
} from './library-add-reinstall'
import { bindingName } from './library-wire'
import type { RootFormat } from './library-add-config'
import type { PlannedInstall } from './library-add-plan'
import type { InstallParams, RenderWith } from './library-add-reinstall'
import type {
  LibraryBlockForm,
  LibraryCatalogueApi,
  LibraryEntry,
  LibraryParamValue,
} from '@/library/manifest/define'

/** What planning a block's forms reads. */
interface BlockFormsInput {
  readonly catalogue: Pick<LibraryCatalogueApi, 'entryForms' | 'libraryEntryId'>
  readonly version: string
  /** `--update`: replace each form fragment with what this version writes, edited or not. */
  readonly update?: boolean
  readonly format: RootFormat
  readonly configPath: string
  /** The form names the config already uses. */
  readonly takenNames: ReadonlySet<string>
  readonly parsed: unknown
  readonly entry: LibraryEntry
  readonly target: {
    readonly name: string
    readonly params: Readonly<Record<string, LibraryParamValue | undefined>>
    readonly requiredBy?: string
  }
}

/** The `id` an installed form fragment already carries, YAML or TypeScript. */
const installedFormId = (onDisk: string | undefined): number | undefined => {
  const match = onDisk?.match(/^id:\s*(\d+)\s*$/m) ?? onDisk?.match(/"id":\s*(\d+)/)
  return match?.[1] === undefined ? undefined : Number(match[1])
}

/** The largest form id the config uses, 0 when it declares none. */
const highestFormId = (parsed: unknown): number => {
  const forms = (parsed as Readonly<Record<string, unknown>> | undefined)?.['forms']
  return Array.isArray(forms)
    ? forms.reduce<number>((highest, form: unknown) => {
        const id = (form as { readonly id?: unknown } | null)?.id
        return typeof id === 'number' && id > highest ? id : highest
      }, 0)
    : 0
}

const readIfExists = async (path: string): Promise<string | undefined> =>
  (await Bun.file(path).exists()) ? Bun.file(path).text() : undefined

/** Where one shipped form lands, and what is on disk there. */
interface FormPlace {
  readonly form: LibraryBlockForm
  readonly relativePath: string
  readonly absolutePath: string
  readonly onDisk: string | undefined
}

/** This form as the block writes it with `params`, the parameter line recorded or not. */
const formRenderer =
  (input: BlockFormsInput, form: LibraryBlockForm, formId: number): RenderWith =>
  (params: InstallParams, recordParams: boolean): string => {
    const shipped =
      input.catalogue
        .entryForms(input.entry, { name: input.target.name, params })
        .find((candidate) => candidate.name === form.name) ?? form
    return renderFragment({
      format: input.format,
      id: input.catalogue.libraryEntryId(input.entry),
      version: input.version,
      params,
      recordParams,
      binding: bindingName(form.name),
      value: { id: formId, ...shipped },
    })
  }

/** One shipped form's install under `formId`, or the message refusing it. */
const planOneForm = (
  input: BlockFormsInput,
  { form, relativePath, absolutePath, onDisk }: FormPlace,
  formId: number
): PlannedInstall | string => {
  const { entry, target } = input
  const id = input.catalogue.libraryEntryId(entry)
  const render = formRenderer(input, form, formId)
  const content = render(target.params, true)
  const verdict = reinstallOf({
    entry,
    onDisk,
    content,
    params: target.params,
    defaults: defaultParams(entry, input.parsed),
    render,
  })
  const update = input.update === true
  if (verdict.kind === 'edited' && !update)
    return editedMessage(relativePath, id, verdict.against, asOf(entry, target.name))
  if (onDisk === undefined && input.takenNames.has(form.name))
    return (
      `Error: the config already defines a form named "${form.name}".\n\n` +
      `  Install ${id} under another name with --as <name>, e.g.\n` +
      `  sovrium library add ${id} --as ${target.name}-2`
    )
  return {
    id,
    entry,
    name: form.name,
    key: 'forms',
    relativePath,
    absolutePath,
    content,
    env: entry.env,
    ...placementOf(verdict, onDisk, content, update ? input.version : undefined),
    ...(target.requiredBy === undefined ? {} : { requiredBy: target.requiredBy }),
  }
}

/**
 * One install per form the block ships, or the message refusing the install:
 * an edited fragment is never overwritten, and a form name the config already
 * uses is refused, as the component's own name is.
 */
export const planBlockForms = async (
  input: BlockFormsInput
): Promise<readonly PlannedInstall[] | string> => {
  const { catalogue, entry, target, format } = input
  const forms = catalogue.entryForms(entry, { name: target.name, params: target.params })
  const extension = format === 'typescript' ? 'ts' : 'yaml'
  const located = await Promise.all(
    forms.map(async (form) => {
      const relativePath = `library/form/${form.name}.${extension}`
      const absolutePath = join(dirname(input.configPath), relativePath)
      return { form, relativePath, absolutePath, onDisk: await readIfExists(absolutePath) }
    })
  )
  const firstFree = highestFormId(input.parsed) + 1
  const planned = located.map((place, index) =>
    planOneForm(input, place, installedFormId(place.onDisk) ?? firstFree + index)
  )
  const refusal = planned.find((item): item is string => typeof item === 'string')
  return refusal ?? planned.filter((item): item is PlannedInstall => typeof item !== 'string')
}
