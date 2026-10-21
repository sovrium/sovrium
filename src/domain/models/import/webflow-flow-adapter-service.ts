/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Webflow automations adapter: a site's form webhooks as `CanonicalFlow`s.
 *
 * Webflow switched Logic off, so a site's only automation is a webhook its
 * forms fire (pinned under `[internal ref]`). It
 * reads the files `sovrium import fetch webflow:<siteId>` wrote, parsed, by
 * snapshot path:
 *
 * - `raw/webhooks.json`: the site's webhooks. Each `form_submission` webhook
 *   becomes one flow: a `form` trigger on the form its `filter.name` names (or
 *   on every form, when it has no filter), then an `http` step sending the
 *   submission to the webhook's own address, in the shape Webflow sent it —
 *   `{ triggerType, payload: { name, siteId, formId, data } }`. The operator
 *   keeps the integration the webhook fed, which now runs from Sovrium.
 * - `raw/forms/page-NNNN.json`: the site's forms, to resolve a filter to the
 *   form's id and its fields, which become the `data` the step sends.
 * - `raw/sovrium-unread.json`: the lists the token could not read.
 *
 * Every other trigger type has no Sovrium counterpart and is reported, as is
 * Logic; nothing is guessed.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { toEnvName } from './capability-url-service'
import type { CanonicalExpression, CanonicalFlow, CanonicalStep } from './canonical-flow'
import type { ImportReport } from './import-report'

/** The webhook list of a Webflow snapshot. */
export const WEBFLOW_WEBHOOKS_PATH = 'raw/webhooks.json'

const FORMS_PAGE = /^raw\/forms\/page-\d+\.json$/
const UNREAD_PATH = 'raw/sovrium-unread.json'

type Json = Readonly<Record<string, unknown>>
type NeverImportable = NonNullable<ImportReport['automations']>['neverImportable'][number]
type Unmapped = ImportReport['unmapped'][number]

/** What the adapter returns. */
export interface WebflowFlowRead {
  readonly flows: readonly CanonicalFlow[]
  /** What the site holds that cannot be imported, Logic first. */
  readonly neverImportable: readonly NeverImportable[]
  /** What each imported flow changes for the operator. */
  readonly notes: readonly Unmapped[]
}

const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** One form of the site: its id, its name and its fields' names. */
interface WebflowForm {
  readonly id: string
  readonly name: string
  readonly fields: readonly string[]
}

/** A form's field names: `fields` is a list of `{ <fieldId>: { displayName } }`. */
const fieldNamesOf = (form: Json): readonly string[] =>
  arrayOf(form['fields']).flatMap((entry) =>
    Object.values(isRecord(entry) ? entry : {}).flatMap((field) => {
      const name = isRecord(field) ? textOf(field['displayName']) : undefined
      return name === undefined ? [] : [name]
    })
  )

/** Every form of the snapshot's form pages, in page order. */
const formsOf = (files: ReadonlyMap<string, unknown>): readonly WebflowForm[] =>
  [...files.keys()]
    .filter((path) => FORMS_PAGE.test(path))
    .toSorted()
    .flatMap((path) => {
      const page = files.get(path)
      return arrayOf(isRecord(page) ? page['forms'] : undefined)
    })
    .flatMap((form) => {
      if (!isRecord(form)) return []
      const id = textOf(form['id'])
      const name = textOf(form['displayName'])
      return id === undefined || name === undefined
        ? []
        : [{ id, name, fields: fieldNamesOf(form) }]
    })

/** A form, with the column each of its fields is stored under when that is known. */
interface ResolvedForm extends WebflowForm {
  readonly columnOf: (field: string) => string | undefined
}

/** A reference to one field of the submission that started the run. */
const fieldRef = (field: string): CanonicalExpression => ({
  kind: 'expression',
  source: field,
  tokens: [{ kind: 'ref', root: 'trigger', path: [field] }],
})

/** The step sending a submission on to the webhook's address, as Webflow sent it. */
const forwardStep = (
  { url, urlEnv }: { readonly url: string; readonly urlEnv: string },
  siteId: string,
  formName: string | undefined,
  form: ResolvedForm | undefined
): CanonicalStep => ({
  id: 'forward',
  name: 'Send the submission on',
  kind: 'http',
  method: 'POST',
  url,
  urlEnv,
  headers: {},
  body: {
    triggerType: 'form_submission',
    payload: {
      ...(formName === undefined ? {} : { name: formName }),
      siteId,
      ...(form === undefined ? {} : { formId: form.id }),
      ...(form === undefined
        ? {}
        : {
            data: Object.fromEntries(
              form.fields.map((field) => [field, fieldRef(form.columnOf(field) ?? field)])
            ),
          }),
    },
  },
})

/** The host a destination URL names, for the report; the path may carry a secret. */
const hostOf = (url: string): string => URL.parse(url)?.host ?? 'its destination'

/** The note telling where a migrated webhook now fires from. */
const firesFromNote = (
  name: string,
  url: string,
  filter: string | undefined,
  form: WebflowForm | undefined
): Unmapped => {
  const watched = filter === undefined ? 'any form' : `"${filter}"`
  const unresolved =
    form === undefined && filter !== undefined
      ? ' The form was not among the forms the token could read, so the fields the step sends are left for you to name.'
      : ''
  return {
    domain: 'automations',
    source: name,
    kind: 'trigger',
    reason:
      `The Webflow webhook on ${watched} now fires from Sovrium: once switched on, this automation sends each submission to ${hostOf(url)}. ` +
      `Delete the webhook in Webflow then, or every submission arrives twice.${unresolved}`,
  }
}

/** One `form_submission` webhook as a flow, and the note telling where it now fires from. */
const flowOf = (
  webhook: Json,
  siteId: string,
  forms: readonly ResolvedForm[],
  urlEnv: string
): { readonly flow: CanonicalFlow; readonly note: Unmapped } | undefined => {
  const url = textOf(webhook['url'])
  const id = textOf(webhook['id'])
  if (url === undefined || id === undefined) return undefined
  const filter = isRecord(webhook['filter']) ? textOf(webhook['filter']['name']) : undefined
  const form = forms.find((one) => filter !== undefined && one.name === filter)
  const name = `Webflow ${filter ?? 'form'} submission`
  const flow: CanonicalFlow = {
    tool: 'webflow',
    sourceId: id,
    name,
    active: true,
    trigger: { kind: 'form', form: form?.id ?? filter ?? 'any form of the site' },
    steps: [forwardStep({ url, urlEnv }, siteId, filter, form)],
    edges: [{ from: 'trigger', to: 'forward' }],
  }
  return { flow, note: firesFromNote(name, url, filter, form) }
}

const LOGIC: NeverImportable = {
  what: 'Webflow Logic flows',
  reason:
    'Webflow switched Logic off on 2025-06-27 and its API exposes none; a site’s form webhooks are the only automations left to import.',
}

const DASHBOARD_WEBHOOKS: NeverImportable = {
  what: 'Webhooks added in the Webflow dashboard',
  reason:
    'Webflow’s API documents only the webhooks apps created; one added under Site settings › Integrations may be missing from the list. Check that page.',
}

/** A trigger type with no Sovrium counterpart, once per type. */
const otherTriggersOf = (webhooks: readonly Json[]): readonly NeverImportable[] =>
  [
    ...new Set(
      webhooks.flatMap((webhook) => {
        const type = textOf(webhook['triggerType'])
        return type === undefined || type === 'form_submission' ? [] : [type]
      })
    ),
  ]
    .toSorted()
    .map((type) => ({
      what: `Webflow "${type}" webhooks`,
      reason:
        'Only form-submission webhooks have a Sovrium trigger; the others are left in Webflow.',
    }))

/** The lists the token could not read, each naming the scope it lacks. */
const unreadOf = (files: ReadonlyMap<string, unknown>): readonly NeverImportable[] =>
  arrayOf(files.get(UNREAD_PATH)).flatMap((entry) => {
    const resource = isRecord(entry) ? textOf(entry['resource']) : undefined
    const scope = isRecord(entry) ? textOf(entry['scope']) : undefined
    return resource === undefined || scope === undefined
      ? []
      : [
          {
            what: `Webflow ${resource}`,
            reason: `The token was refused the site's ${resource}: give it the ${scope} scope and fetch again.`,
          },
        ]
  })

/**
 * The env variable each webhook's address is read from, as a webhook address
 * is a credential: `WEBFLOW_WEBHOOK_<FORM>_URL`, numbered from the second
 * webhook on the same form.
 */
const urlEnvNames = (webhooks: readonly Json[]): readonly string[] => {
  const forms = webhooks.map((webhook) =>
    isRecord(webhook['filter']) ? (textOf(webhook['filter']['name']) ?? 'any form') : 'any form'
  )
  const named = forms.map((form, index) => {
    const before = forms.slice(0, index).filter((other) => other === form).length
    return toEnvName('webflow webhook', form, before === 0 ? '' : String(before + 1), 'url')
  })
  // Two forms whose names spell the same variable still get one each.
  return named.map((name, index) => {
    const clash = named.slice(0, index).filter((other) => other === name).length
    return clash === 0 ? name : toEnvName(name, String(clash + 1))
  })
}

/** A Webflow snapshot's form webhooks as flows, with what cannot be imported. */
export const adaptWebflowFlows = (snapshot: {
  readonly siteId: string
  readonly files: ReadonlyMap<string, unknown>
  /**
   * The column a form's field is stored under once the form is imported with
   * its responses table, so the request sends what the submission held.
   */
  readonly columnOf?: (formId: string, field: string) => string | undefined
}): WebflowFlowRead => {
  const listing = snapshot.files.get(WEBFLOW_WEBHOOKS_PATH)
  const webhooks = arrayOf(isRecord(listing) ? listing['webhooks'] : undefined).filter(isRecord)
  const forms = formsOf(snapshot.files).map((form) => ({
    ...form,
    columnOf: (field: string) => snapshot.columnOf?.(form.id, field),
  }))
  const formHooks = webhooks.filter((webhook) => webhook['triggerType'] === 'form_submission')
  const envNames = urlEnvNames(formHooks)
  const mapped = formHooks.flatMap((webhook, index) => {
    const one = flowOf(webhook, snapshot.siteId, forms, envNames[index] ?? 'WEBFLOW_WEBHOOK_URL')
    return one === undefined ? [] : [one]
  })
  return {
    flows: mapped.map((one) => one.flow),
    neverImportable: [
      LOGIC,
      ...(listing === undefined ? [] : [DASHBOARD_WEBHOOKS]),
      ...otherTriggersOf(webhooks),
      ...unreadOf(snapshot.files),
    ],
    notes: mapped.map((one) => one.note),
  }
}
