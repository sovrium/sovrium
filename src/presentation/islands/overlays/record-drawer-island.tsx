/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react'
import { dispatch, subscribe } from '@/presentation/islands/_shared/event-bus'
import { useRecordQuery } from '../hooks/use-records-query'
import {
  DrawerContent,
  isStructured,
  type DrawerAction,
  type RecordDrawerField,
} from './record-drawer-content'
import { DialogSurface, RegionSurface } from './record-drawer-surfaces'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

interface RecordDrawerIslandProps {
  readonly id?: string
  readonly title?: string
  readonly role?: 'dialog' | 'region'
  readonly table?: string
  readonly system?: SystemDetailSource
  readonly recordFields?: ReadonlyArray<RecordDrawerField>
  readonly actions?: ReadonlyArray<DrawerAction>
  readonly canEdit?: boolean
}

type Values = Record<string, string>
type RawRecord = Record<string, unknown>

const EMPTY_FIELDS: ReadonlyArray<RecordDrawerField> = []
const EMPTY_ACTIONS: ReadonlyArray<DrawerAction> = []
const EMPTY_RECORD: RawRecord = {}
const DEFAULT_TITLE = "Détail de l'enregistrement"

function toFormValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function toFormValues(record: RawRecord): Values {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toFormValue(value)]))
}

async function fetchRecord(table: string, recordId: string): Promise<RawRecord> {
  const res = await fetch(`/api/tables/${table}/records/${recordId}`)
  if (!res.ok) return {}
  const body = (await res.json()) as { readonly record?: RawRecord }
  return body.record ?? (body as RawRecord)
}

function useRecordDrawer(
  id: string | undefined,
  table: string | undefined,
  system: SystemDetailSource | undefined
) {
  const [open, setOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | undefined>()
  const [record, setRecord] = useState<RawRecord>(EMPTY_RECORD)
  const [values, setValues] = useState<Values>({})

  useEffect(() => {
    if (!id) return undefined
    return subscribe('sovrium:open-drawer', (detail) => {
      if (detail.id !== id) return
      setRecordId(toFormValue(detail.record['id']) || undefined)
      setOpen(true)
    })
  }, [id])

  useEffect(() => {
    if ((!table && !system) || typeof window === 'undefined') return undefined
    const tryOpen = (): boolean => {
      const deepLinkId = new URLSearchParams(window.location.search).get('record')
      if (!deepLinkId) return false
      setRecordId(deepLinkId)
      setOpen(true)
      return true
    }
    if (tryOpen()) return undefined
    const timers = [0, 100, 250, 450].map((delay) => setTimeout(tryOpen, delay))
    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [table, system])

  useEffect(() => {
    if (!open || !table || !recordId) return
    void fetchRecord(table, recordId).then((raw) => {
      setRecord(raw)
      setValues(toFormValues(raw))
    })
  }, [open, table, recordId])

  return { open, setOpen, recordId, record, values, setValues }
}

interface SaveParams {
  readonly recordFields: ReadonlyArray<RecordDrawerField>
  readonly values: Values
  readonly table: string | undefined
  readonly recordId: string | undefined
  readonly setOpen: (open: boolean) => void
  readonly setError: (error: string | undefined) => void
}

function useRecordSave(params: SaveParams): () => void {
  const { recordFields, values, table, recordId, setOpen, setError } = params
  const save = useCallback(async () => {
    const editable = recordFields.filter((field) => !isStructured(field))
    const blank = editable.find((field) => (values[field.name] ?? '').trim().length === 0)
    if (blank) {
      setError(`Le champ « ${blank.name} » est requis.`)
      return
    }
    if (!table || !recordId) return
    const payload = Object.fromEntries(editable.map((f) => [f.name, values[f.name] ?? '']))
    const res = await fetch(`/api/tables/${table}/records/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setError('La validation a échoué.')
      return
    }
    dispatch('sovrium:crud-success', { table, operation: 'update', recordId })
    setOpen(false)
  }, [recordFields, values, table, recordId, setOpen, setError])
  return useCallback(() => void save(), [save])
}

function useDrawerRecord(
  system: SystemDetailSource | undefined,
  recordId: string | undefined,
  tableRecord: RawRecord
): RawRecord {
  const systemQuery = useRecordQuery('record-drawer', system ? { system } : undefined, recordId)
  return system ? (systemQuery.data ?? EMPTY_RECORD) : tableRecord
}

function useDrawerHandlers(
  setValues: Dispatch<SetStateAction<Values>>,
  setOpen: (open: boolean) => void,
  setError: (error: string | undefined) => void
): { readonly onChange: (name: string, value: string) => void; readonly onClose: () => void } {
  const onChange = useCallback(
    (name: string, value: string) => {
      setError(undefined)
      setValues((prev) => ({ ...prev, [name]: value }))
    },
    [setValues, setError]
  )
  const onClose = useCallback(() => setOpen(false), [setOpen])
  return { onChange, onClose }
}

export default function RecordDrawerIsland({
  id,
  title,
  role = 'dialog',
  table,
  system,
  recordFields = EMPTY_FIELDS,
  actions = EMPTY_ACTIONS,
  canEdit = true,
}: RecordDrawerIslandProps): ReactElement | null {
  const {
    open,
    setOpen,
    recordId,
    record: tableRecord,
    values,
    setValues,
  } = useRecordDrawer(id, table, system)
  const record = useDrawerRecord(system, recordId, tableRecord)
  const [error, setError] = useState<string | undefined>()
  const surfaceTitle = title ?? DEFAULT_TITLE
  const { onChange, onClose } = useDrawerHandlers(setValues, setOpen, setError)
  const onSave = useRecordSave({ recordFields, values, table, recordId, setOpen, setError })

  const body = (
    <DrawerContent
      fields={recordFields}
      values={values}
      record={record}
      canEdit={canEdit}
      error={error}
      actions={actions}
      onChange={onChange}
      onSave={onSave}
    />
  )

  if (role === 'region') {
    if (!open) return null
    return (
      <RegionSurface
        title={surfaceTitle}
        body={body}
        onClose={onClose}
      />
    )
  }
  return (
    <DialogSurface
      title={surfaceTitle}
      body={body}
      open={open}
      onOpenChange={setOpen}
    />
  )
}
