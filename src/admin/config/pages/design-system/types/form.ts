/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `form` — a bound form renders a live submit control, so the drawings below
// are composed from the controls a form is made of.
//
// A form BOUND to a table, or carrying an `action`, renders a live submit
// control pointed at something. The design system is a preview frame, and a
// preview frame may carry no write path, so the variants and option showcases
// here are compositions: they are what a form LOOKS like, and the behaviour —
// validation, submission, the record it writes — has to be read.
//
// The BARE mode is a different case and the `States` strip at the foot of this
// page now draws it for real: a `form` with children and no binding carries no
// action, no method and no submit button, which is the shape [internal ref] A3
// clause 1 names in so many words. The catalogue's own specimen is that form.
//
// ─── WHY NO CONTROL HERE SAYS “SAVE” ──────────────────────────────────────
//
// A3 clause 2 bounds a preview frame by the ACCESSIBLE NAME of its controls,
// and the sweep is page-wide rather than scoped to a specimen: ten illustrative
// buttons reading “Save” are ten write affordances to anyone reading this page
// by name, whatever the markup around them says. They read “Confirm”, which
// documents the same control and claims nothing the console does not offer.
// The `[internal ref]` precedent decides the direction — the fix for a
// forbidden verb is the rename, never a narrowing of the sweep.
//
// The decision the drawings carry: a form declares its fields OR binds a table.
// Declared fields are a questionnaire — the page decides what is asked. A bound
// form is a record editor — the table decides, and the form follows it as the
// table changes.

import type { PageComponent, TypePageBody } from './body-shape'

const card = (children: readonly unknown[]) => ({
  type: 'card' as const,
  props: { className: 'w-96 max-w-full' },
  children,
})

const heading = (content: string) => ({
  type: 'text' as const,
  element: 'h3' as const,
  content,
  props: { className: 'text-foreground text-base font-semibold' },
})

const actions = (submit: string) => ({
  type: 'container' as const,
  element: 'div' as const,
  props: { className: 'flex justify-end gap-2 pt-2' },
  children: [
    {
      type: 'button' as const,
      variant: 'secondary' as const,
      children: [{ type: 'text' as const, element: 'span' as const, content: 'Cancel' }],
    },
    {
      type: 'button' as const,
      children: [{ type: 'text' as const, element: 'span' as const, content: submit }],
    },
  ],
})

const field = (label: string, control: unknown, extra: Record<string, unknown> = {}) =>
  ({ type: 'field' as const, fieldLabel: label, ...extra, children: [control] }) as PageComponent

const input = (name: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'input' as const,
    ...extra,
    props: { name, ...(extra['props'] as object) },
  }) as PageComponent

const muted = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    content,
    props: { className: 'text-foreground-subtle text-[11px]' },
  }) as PageComponent

const box = (children: readonly unknown[], className = 'flex w-80 max-w-full flex-col gap-3') =>
  ({
    type: 'container' as const,
    element: 'div' as const,
    props: { className },
    children,
  }) as PageComponent

const submit = (label: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex justify-end pt-1' },
    children: [{ type: 'button', children: [{ type: 'text', element: 'span', content: label }] }],
  }) as PageComponent

const form: TypePageBody = {
  drawings: [
    {
      label: 'inline fields',
      children: [
        card([
          heading('Request access'),
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-3 pt-2' },
            children: [
              {
                type: 'field',
                fieldLabel: 'Work email',
                required: true,
                children: [
                  {
                    type: 'input',
                    inputType: 'email',
                    props: { name: 'email', placeholder: 'name@company.com' },
                  },
                ],
              },
              {
                type: 'field',
                fieldLabel: 'Why do you need access?',
                children: [{ type: 'textarea', rows: 3, props: { name: 'why' } }],
              },
            ],
          },
          actions('Send request'),
        ]),
      ],
    },
    {
      label: 'bound: create',
      children: [
        card([
          heading('New contact'),
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-3 pt-2' },
            children: [
              {
                type: 'field',
                fieldLabel: 'Name',
                required: true,
                children: [{ type: 'input', props: { name: 'name' } }],
              },
              {
                type: 'field',
                fieldLabel: 'Role',
                children: [{ type: 'input', props: { name: 'role' } }],
              },
              {
                type: 'field',
                fieldLabel: 'Status',
                children: [
                  {
                    type: 'select',
                    emptyOption: { label: 'Not set' },
                    options: [
                      { label: 'Active', value: 'active' },
                      { label: 'Paused', value: 'paused' },
                    ],
                    props: { name: 'status' },
                  },
                ],
              },
            ],
          },
          actions('Create'),
        ]),
      ],
    },
    {
      label: 'bound: edit, two columns',
      children: [
        {
          type: 'card',
          props: { className: 'w-full max-w-2xl' },
          children: [
            heading('Ada Lovelace'),
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 gap-3 pt-2 md:grid-cols-2' },
              children: [
                {
                  type: 'field',
                  fieldLabel: 'Name',
                  children: [
                    { type: 'input', props: { name: 'edit-name', value: 'Ada Lovelace' } },
                  ],
                },
                {
                  type: 'field',
                  fieldLabel: 'Role',
                  children: [{ type: 'input', props: { name: 'edit-role', value: 'Analyst' } }],
                },
                {
                  type: 'field',
                  fieldLabel: 'Starts',
                  children: [
                    {
                      type: 'date-picker',
                      dateFormat: 'DD/MM/YYYY',
                      props: { name: 'edit-starts' },
                    },
                  ],
                },
                {
                  type: 'field',
                  fieldLabel: 'Ends',
                  children: [
                    { type: 'date-picker', dateFormat: 'DD/MM/YYYY', props: { name: 'edit-ends' } },
                  ],
                },
              ],
            },
            actions('Confirm'),
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'binding',
      title: 'Binding',
      configKey: 'form.dataSource | endpoint | formRef',
      drawings: [
        {
          label: 'fields[] → action.automation',
          children: [
            box([
              field('Work email', input('b-email', { inputType: 'email' })),
              submit('Send request'),
            ]),
          ],
        },
        {
          label: 'dataSource · create',
          children: [
            box([field('Name', input('b-name')), field('Role', input('b-role')), submit('Create')]),
          ],
        },
        {
          label: 'dataSource · edit',
          children: [
            box([
              field('Name', input('b-edit', { props: { value: 'Ada Lovelace' } })),
              submit('Confirm'),
            ]),
          ],
        },
        {
          label: 'endpoint · POST | PUT | PATCH',
          children: [
            box([
              field('Work email', input('b-post', { inputType: 'email' })),
              submit('Subscribe'),
            ]),
          ],
        },
        {
          label: 'responseEnvelope: sovrium',
          children: [
            box([
              field('Work email', input('b-env1', { inputType: 'email' }), {
                fieldError: 'That address is already registered.',
              }),
            ]),
          ],
        },
        {
          label: 'responseEnvelope: better-auth',
          children: [
            box([
              muted('Sign-in failed — check your email and password.'),
              field('Email', input('b-env2')),
            ]),
          ],
        },
        {
          label: 'responseEnvelope: raw',
          children: [
            box([muted('Something went wrong. Try again.'), field('Email', input('b-env3'))]),
          ],
        },
        {
          label: 'formRef: newsletter',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: '- type: form\n  formRef: newsletter',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'layout',
      title: 'Layout',
      configKey: 'form.layout | fieldGroups',
      drawings: [
        {
          label: "layout: 'single-column'",
          children: [
            box([field('Name', input('l-1')), field('Role', input('l-2')), submit('Confirm')]),
          ],
        },
        {
          label: "layout: 'two-column'",
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex w-full max-w-2xl flex-col gap-3' },
              children: [
                {
                  type: 'grid',
                  props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-2' },
                  children: [
                    field('Name', input('l-3')),
                    field('Role', input('l-4')),
                    field('Priority', input('l-5')),
                    field('Amount', input('l-6')),
                  ],
                },
                submit('Confirm'),
              ],
            } as PageComponent,
          ],
        },
        {
          label: 'fieldGroups: [ … ]',
          children: [
            box([
              muted('IDENTITY'),
              field('Name', input('l-7')),
              muted('COMMERCIAL'),
              field('Amount', input('l-8')),
              submit('Confirm'),
            ]),
          ],
        },
      ],
    },
    {
      id: 'wizard',
      title: 'Wizard',
      configKey: 'form.wizard.steps[]',
      drawings: [
        {
          label: 'step 1 of 3',
          children: [
            box([muted('Basics · Numbers · Files'), field('Name', input('w-1')), submit('Next')]),
          ],
        },
        {
          label: 'step 2 of 3',
          children: [
            box([
              muted('✓ Basics · Numbers · Files'),
              field('Amount', input('w-2')),
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex justify-between pt-1' },
                children: [
                  {
                    type: 'button',
                    variant: 'secondary',
                    children: [{ type: 'text', element: 'span', content: 'Back' }],
                  },
                  {
                    type: 'button',
                    children: [{ type: 'text', element: 'span', content: 'Next' }],
                  },
                ],
              } as PageComponent,
            ]),
          ],
        },
        {
          label: 'step 3 of 3',
          children: [
            box([
              muted('✓ Basics · ✓ Numbers · Files'),
              field('Attachment', { type: 'file-upload' }),
              submit('Create record'),
            ]),
          ],
        },
      ],
    },
    {
      id: 'controls',
      title: 'Controls',
      configKey: 'form.fields[].control',
      drawings: [
        { label: "control: 'text'", children: [box([field('Name', input('c-text'))])] },
        {
          label: "control: 'email'",
          children: [box([field('Work email', input('c-email', { inputType: 'email' }))])],
        },
        {
          label: "control: 'password'",
          children: [box([field('Password', input('c-pass', { inputType: 'password' }))])],
        },
        {
          label: "control: 'number'",
          children: [box([field('Amount', { type: 'number-input', props: { name: 'c-num' } })])],
        },
        {
          label: "control: 'tel' | 'url'",
          children: [
            box([
              field('Phone', input('c-tel', { inputType: 'tel' })),
              field('Website', input('c-url', { inputType: 'url' })),
            ]),
          ],
        },
        {
          label: "control: 'textarea'",
          children: [box([field('Notes', { type: 'textarea', rows: 3, props: { name: 'c-ta' } })])],
        },
        {
          label: "control: 'select'",
          children: [
            box([
              field('Stage', {
                type: 'select',
                options: [
                  { label: 'Proposal', value: 'p' },
                  { label: 'Won', value: 'w' },
                ],
                props: { name: 'c-sel' },
              }),
            ]),
          ],
        },
        {
          label: "control: 'record-picker'",
          children: [
            box([field('Company', input('c-rp', { props: { placeholder: 'Search companies' } }))]),
          ],
        },
        {
          label: 'control: (omitted)',
          children: [box([field('Active', { type: 'checkbox', checked: true })])],
        },
      ],
    },
    {
      id: 'field-options',
      title: 'Field options',
      configKey: 'form.fields[].*',
      drawings: [
        { label: 'label', children: [box([field('What should we call you?', input('f-label'))])] },
        {
          label: 'description',
          children: [
            box([
              field('Workspace URL', input('f-desc'), {
                fieldDescription:
                  'Lowercase letters and hyphens. This becomes part of every link you share.',
              }),
            ]),
          ],
        },
        {
          label: 'placeholder',
          children: [
            box([field('Company', input('f-ph', { props: { placeholder: 'Acme Europe' } }))]),
          ],
        },
        {
          label: 'readOnly: true',
          children: [
            box([
              field(
                'Reference',
                input('f-ro', { props: { value: 'INV-2026-0184', readOnly: true } })
              ),
            ]),
          ],
        },
        {
          label: 'disabled: true',
          children: [
            box([
              field(
                'Reference',
                input('f-dis', { props: { value: 'INV-2026-0184', disabled: true } })
              ),
            ]),
          ],
        },
        {
          label: 'hidden: true',
          children: [box([muted('source: september-campaign — submitted, not shown')])],
        },
        {
          label: 'defaultValue',
          children: [
            box([
              field('Stage', {
                type: 'select',
                options: [
                  { label: 'Proposal', value: 'p' },
                  { label: 'Won', value: 'w' },
                ],
                defaultValue: 'p',
                props: { name: 'f-def' },
              }),
            ]),
          ],
        },
        {
          label: 'options[]',
          children: [
            box([
              field('Priority', {
                type: 'select',
                options: [
                  { label: 'High', value: 'h' },
                  { label: 'Low', value: 'l' },
                ],
                props: { name: 'f-opt' },
              }),
            ]),
          ],
        },
        {
          label: 'optionsSource',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'optionsSource:\n  table: stages\n  labelField: name\n  valueField: slug',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'conditions',
      title: 'Conditions',
      configKey: 'visibleWhen | requiredWhen | disabledWhen',
      drawings: [
        {
          label: 'visibleWhen · not met',
          children: [
            box([
              field('Status', {
                type: 'select',
                options: [
                  { label: 'Draft', value: 'd' },
                  { label: 'Paid', value: 'p' },
                ],
                defaultValue: 'd',
                props: { name: 'cd-1' },
              }),
            ]),
          ],
        },
        {
          label: 'visibleWhen · met',
          children: [
            box([
              field('Status', {
                type: 'select',
                options: [
                  { label: 'Draft', value: 'd' },
                  { label: 'Paid', value: 'p' },
                ],
                defaultValue: 'p',
                props: { name: 'cd-2' },
              }),
              field('Paid on', {
                type: 'date-picker',
                dateFormat: 'DD/MM/YYYY',
                props: { name: 'cd-3' },
              }),
            ]),
          ],
        },
        { label: 'requiredWhen · not met', children: [box([field('Reason', input('cd-4'))])] },
        {
          label: 'requiredWhen · met',
          children: [box([field('Reason', input('cd-5'), { required: true })])],
        },
        { label: 'disabledWhen · not met', children: [box([field('Discount', input('cd-6'))])] },
        {
          label: 'disabledWhen · met',
          children: [box([field('Discount', input('cd-7', { props: { disabled: true } }))])],
        },
      ],
    },
    {
      id: 'files',
      title: 'Files',
      configKey: 'accept | dropZone | maxFiles',
      drawings: [
        { label: 'file input', children: [box([field('Attachment', { type: 'file-upload' })])] },
        {
          label: "accept: 'application/pdf'",
          children: [box([field('Proposal', { type: 'file-upload', accept: 'application/pdf' })])],
        },
        {
          label: 'dropZone: true',
          children: [box([field('Attachment', { type: 'file-upload', dropZone: true })])],
        },
        {
          label: 'maxFiles: 3',
          children: [
            box([field('Attachments', { type: 'file-upload', dropZone: true, maxFiles: 3 })]),
          ],
        },
      ],
    },
    {
      id: 'prefill',
      title: 'Prefill',
      configKey: 'form.inlinePrefill | lockPrefill',
      drawings: [
        {
          label: 'inlinePrefill',
          children: [box([field('Company', input('p-1', { props: { value: 'Acme Europe' } }))])],
        },
        {
          label: 'lockPrefill: true',
          children: [
            box([
              field('Company', input('p-2', { props: { value: 'Acme Europe', readOnly: true } })),
              muted('🔒 Set by the link you followed.'),
            ]),
          ],
        },
      ],
    },
    {
      id: 'success',
      title: 'Success',
      configKey: 'action.onSuccess.type',
      drawings: [
        { label: "onSuccess: 'navigate'", children: [box([muted('→ /records/invoices/184')])] },
        {
          label: "onSuccess: 'reset'",
          children: [box([muted('Saved. Ready for the next one.'), field('Name', input('s-1'))])],
        },
        {
          label: "onSuccess: 'message'",
          children: [
            box([
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex items-center justify-end gap-3' },
                children: [
                  muted('Saved'),
                  {
                    type: 'button',
                    children: [{ type: 'text', element: 'span', content: 'Confirm' }],
                  },
                ],
              } as PageComponent,
            ]),
          ],
        },
        {
          label: "onSuccess: 'successPage'",
          children: [
            box([
              {
                type: 'text',
                element: 'h4',
                content: 'Request received',
                props: { className: 'text-foreground text-base font-semibold' },
              } as PageComponent,
              muted('We will reply to ada@example.com within two working days.'),
              {
                type: 'button',
                variant: 'secondary',
                children: [{ type: 'text', element: 'span', content: 'Back to the site' }],
              } as PageComponent,
            ]),
          ],
        },
        {
          label: "onSuccess: 'role-landing'",
          children: [box([muted('→ the landing route this role declares')])],
        },
        {
          label: 'onError: toast',
          children: [
            box([
              field('Work email', input('s-2', { inputType: 'email' }), {
                fieldError: 'That address is already registered.',
              }),
            ]),
          ],
        },
      ],
    },
    {
      id: 'saving',
      title: 'Saving',
      configKey: 'form.autoSave',
      drawings: [
        {
          label: "saveMode: 'auto'",
          children: [
            box([
              field('Name', input('sv-1', { props: { value: 'Ada Lovelace' } })),
              muted('Saved'),
            ]),
          ],
        },
        {
          label: "saveMode: 'onBlur'",
          children: [
            box([
              field('Name', input('sv-2', { props: { value: 'Ada Lovelace' } })),
              muted('Saved'),
            ]),
          ],
        },
        {
          label: "saveMode: 'manual'",
          children: [
            box([
              field('Name', input('sv-3', { props: { value: 'Ada Lovelace' } })),
              submit('Confirm'),
            ]),
          ],
        },
        {
          label: "indicator: 'inline'",
          children: [box([field('Name', input('sv-4')), muted('Saved')])],
        },
        { label: "indicator: 'toast'", children: [box([muted('Saved — bottom right, fading')])] },
        { label: "indicator: 'toolbar'", children: [box([muted('All changes saved')])] },
      ],
    },
    {
      // NOT `States`, and down to ONE drawing. This section used to draw
      // `default`, `focus`, `invalid` and `disabled` as compositions, under the
      // same heading the fixed strip at the foot of the page carries — and the
      // strip now draws those same four names on the catalogue's own bare form,
      // rendered rather than depicted. Two sections named `States`, drawing the
      // same four states, is a page that cannot be scanned or linked to.
      //
      // What the strip does NOT have is the one state the vocabulary does not
      // distinguish: the moment between the click and the answer. That is what
      // is left here, under the name it actually is.
      id: 'submitting',
      title: 'Submitting',
      configKey: 'form — between the click and the answer',
      drawings: [
        {
          label: 'submit pressed',
          children: [
            box([
              field('Name', input('st-5', { props: { value: 'Ada Lovelace', disabled: true } })),
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex justify-end pt-1' },
                children: [
                  {
                    type: 'button',
                    children: [{ type: 'text', element: 'span', content: 'Saving…' }],
                  },
                ],
              } as PageComponent,
            ]),
          ],
        },
      ],
    },
  ],
}

export default form
