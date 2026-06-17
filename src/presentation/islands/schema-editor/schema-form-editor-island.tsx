/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type ChangeEvent, type ReactElement } from 'react'
import { submitSchemaConfig } from './schema-config-submit'

export interface SchemaFormEditorProps {
  readonly submitToTable?: string
  readonly configField?: string
  readonly formatField?: string
  readonly sections?: readonly string[]
  readonly readOnly?: boolean
  readonly id?: string
  readonly className?: string
  readonly submitContext?: Readonly<Record<string, unknown>>
}

const DEFAULT_SECTIONS = ['tables', 'fields', 'pages'] as const

function serializeConfig(sections: readonly string[], values: Record<string, string>): string {
  const config = sections.reduce<Record<string, string>>(
    (acc, section) => ({ ...acc, [section]: values[section] ?? '' }),
    {}
  )
  return JSON.stringify(config)
}

function useFormSubmit(
  props: SchemaFormEditorProps,
  sections: readonly string[],
  values: Record<string, string>
) {
  const { submitToTable, configField, formatField, submitContext } = props
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const handleSubmit = useCallback(async () => {
    if (!submitToTable || !configField || !formatField) {
      setError('Editor is missing its submit target configuration')
      return
    }
    setIsPending(true)
    setError(undefined)
    const result = await submitSchemaConfig({
      submitToTable,
      configField,
      formatField,
      content: serializeConfig(sections, values),
      format: 'form',
      ...(submitContext !== undefined ? { submitContext } : {}),
    }).catch((cause: unknown) => (cause instanceof Error ? cause.message : 'Submit failed'))
    setError(result)
    setIsPending(false)
  }, [submitToTable, configField, formatField, sections, values, submitContext])

  return { isPending, error, handleSubmit }
}

function SectionField(props: {
  readonly section: string
  readonly value: string
  readonly readOnly: boolean
  readonly onChange: (section: string, next: string) => void
}): ReactElement {
  const { section, value, readOnly, onChange } = props
  const handle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(section, event.target.value),
    [section, onChange]
  )
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium capitalize">{section}</span>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={handle}
        className="border-border bg-background rounded px-2 py-1 text-sm"
        placeholder={`Define ${section}…`}
      />
    </label>
  )
}

export default function SchemaFormEditorIsland(props: SchemaFormEditorProps): ReactElement {
  const { readOnly = false } = props
  const sections = props.sections && props.sections.length > 0 ? props.sections : DEFAULT_SECTIONS

  const [values, setValues] = useState<Record<string, string>>({})
  const { isPending, error, handleSubmit } = useFormSubmit(props, sections, values)

  const onFieldChange = useCallback((section: string, next: string) => {
    setValues((prev) => ({ ...prev, [section]: next }))
  }, [])
  const onSubmit = useCallback(() => void handleSubmit(), [handleSubmit])

  return (
    <div
      className="border-border bg-background-raised flex flex-col gap-4 rounded-md border p-3"
      data-component="schema-form-editor"
    >
      {sections.map((section) => (
        <SectionField
          key={section}
          section={section}
          value={values[section] ?? ''}
          readOnly={readOnly}
          onChange={onFieldChange}
        />
      ))}
      {error !== undefined && (
        <p
          role="alert"
          className="text-error-solid text-sm"
        >
          {error}
        </p>
      )}
      <div>
        <button
          type="button"
          disabled={isPending || readOnly}
          onClick={onSubmit}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
