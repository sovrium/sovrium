/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { submitSchemaConfig } from './schema-config-submit'

export interface SchemaAiAgentProps {
  readonly submitToTable?: string
  readonly configField?: string
  readonly formatField?: string
  readonly placeholder?: string
  readonly chatHeight?: number
  readonly id?: string
  readonly className?: string
  readonly submitContext?: Readonly<Record<string, unknown>>
}

function useSendState(props: SchemaAiAgentProps, prompt: string) {
  const { submitToTable, configField, formatField, submitContext } = props
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const handleSend = useCallback(async () => {
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
      content: prompt,
      format: 'ai',
      ...(submitContext !== undefined ? { submitContext } : {}),
    }).catch((cause: unknown) => (cause instanceof Error ? cause.message : 'Send failed'))
    setError(result)
    setIsPending(false)
  }, [submitToTable, configField, formatField, prompt, submitContext])

  return { isPending, error, handleSend }
}

export default function SchemaAiAgentIsland(props: SchemaAiAgentProps): ReactElement {
  const { placeholder, chatHeight = 360 } = props
  const [prompt, setPrompt] = useState('')
  const { isPending, error, handleSend } = useSendState(props, prompt)

  const onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value),
    []
  )
  const onSend = useCallback(() => void handleSend(), [handleSend])
  const style = useMemo<CSSProperties>(() => ({ minHeight: `${chatHeight}px` }), [chatHeight])

  return (
    <div
      className="border-border bg-background-raised flex flex-col gap-3 rounded-md border p-3"
      data-component="schema-ai-agent"
      style={style}
    >
      <textarea
        value={prompt}
        placeholder={placeholder}
        onChange={onChange}
        className="border-border bg-background flex-1 resize-none rounded px-3 py-2 text-sm"
        rows={4}
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
          disabled={isPending}
          onClick={onSend}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
