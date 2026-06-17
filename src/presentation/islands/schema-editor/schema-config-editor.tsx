/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { submitSchemaConfig } from './schema-config-submit'
import type { Extension } from '@codemirror/state'

export interface SchemaConfigEditorProps {
  readonly submitToTable?: string
  readonly configField?: string
  readonly formatField?: string
  readonly initialValue?: string
  readonly height?: number
  readonly lineNumbers?: boolean
  readonly readOnly?: boolean
  readonly id?: string
  readonly className?: string
  readonly submitContext?: Readonly<Record<string, unknown>>
}

export interface SchemaConfigEditorCoreProps extends SchemaConfigEditorProps {
  readonly extension: Extension
  readonly format: 'json' | 'yaml'
}

function useSubmitState(core: SchemaConfigEditorCoreProps, value: string) {
  const { submitToTable, configField, formatField, format, submitContext } = core
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
      content: value,
      format,
      ...(submitContext !== undefined ? { submitContext } : {}),
    }).catch((cause: unknown) => (cause instanceof Error ? cause.message : 'Submit failed'))
    setError(result)
    setIsPending(false)
  }, [submitToTable, configField, formatField, value, format, submitContext])

  return { isPending, error, handleSubmit }
}

export default function SchemaConfigEditor(props: SchemaConfigEditorCoreProps): ReactElement {
  const { initialValue = '', height = 360, lineNumbers = true, readOnly = false, extension } = props
  const [value, setValue] = useState(initialValue)
  const { isPending, error, handleSubmit } = useSubmitState(props, value)

  const extensions = useMemo(() => [extension], [extension])
  const basicSetup = useMemo(() => ({ lineNumbers }), [lineNumbers])
  const onSubmit = useCallback(() => void handleSubmit(), [handleSubmit])

  return (
    <div
      className="border-border bg-background-raised flex flex-col gap-3 rounded-md border p-3"
      data-component="schema-config-editor"
    >
      <CodeMirror
        value={value}
        height={`${height}px`}
        extensions={extensions}
        readOnly={readOnly}
        basicSetup={basicSetup}
        onChange={setValue}
        className="text-sm"
      />
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
