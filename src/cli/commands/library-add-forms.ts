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
 * block again writes the same bytes and changes nothing.
 *
 * Pure planning, no writes: a refusal comes back as its message, and the
 * caller (`library-add-plan.ts`) refuses with it, before anything is written.
 */

import { dirname, join } from 'node:path'
import { bindingName, provenanceHeader, renderTsFragment, renderYamlFragment } from './library-wire'
import type { PlannedInstall, RootFormat } from './library-add-plan'
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

/** One shipped form's install under `formId`, or the message refusing it. */
const planOneForm = (
  input: BlockFormsInput,
  { form, relativePath, absolutePath, onDisk }: FormPlace,
  formId: number
): PlannedInstall | string => {
  const { entry, target } = input
  const id = input.catalogue.libraryEntryId(entry)
  const header = provenanceHeader(id, input.version)
  const fragment = { id: formId, ...form }
  const content =
    input.format === 'typescript'
      ? renderTsFragment(header, bindingName(form.name), fragment)
      : renderYamlFragment(header, fragment)
  if (onDisk !== undefined && onDisk !== content)
    return (
      `Error: ${relativePath} already exists and differs from what ${id} would write.\n\n` +
      '  It was edited after it was installed, and library add never overwrites an edit.\n' +
      '  Keep it, or move it aside and run the command again.'
    )
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
    present: onDisk !== undefined,
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
