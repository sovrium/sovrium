/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SuccessPageActionSchema } from '../../forms/on-success'

export const ToastVariantSchema = Schema.Literal('success', 'error', 'warning', 'info').annotations(
  {
    title: 'Toast Variant',
    description: 'Visual style of the toast notification',
  }
)

export const ToastSchema = Schema.Struct({
  message: Schema.String.annotations({
    description: 'Toast notification message. Supports $variable references.',
  }),
  variant: Schema.optional(ToastVariantSchema),
  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
}).annotations({
  title: 'Toast',
  description: 'Toast notification configuration',
})

export const ActionResponseTypeSchema = Schema.Literal(
  'navigate',
  'reset',
  'message',
  'successPage',
  'role-landing'
).annotations({
  title: 'Action Response Type',
  description:
    'Form behavior after a successful action (navigate, reset, message, successPage, role-landing)',
})

export const ActionResponseSchema = Schema.Struct({
  type: Schema.optional(ActionResponseTypeSchema),
  navigate: Schema.optional(
    Schema.String.annotations({
      description: 'URL path to navigate to. Supports $variable references.',
      examples: ['/dashboard', '/posts/$record.slug'],
    })
  ),
  preserveFields: Schema.optional(
    Schema.Array(Schema.String).annotations({
      description:
        'Field names retained after a reset. Only meaningful when type is "reset". All other fields are cleared.',
      examples: [
        ['category', 'location'],
        ['project', 'date'],
      ],
    })
  ),
  title: Schema.optional(
    Schema.String.annotations({
      description: 'Success page heading. Only meaningful when type is "successPage".',
      examples: ['Thank you for your feedback!', 'Ticket Created'],
    })
  ),
  message: Schema.optional(
    Schema.String.annotations({
      description: 'Success page body message. Only meaningful when type is "successPage".',
    })
  ),
  actions: Schema.optional(
    Schema.Array(SuccessPageActionSchema).annotations({
      description: 'Success page action buttons. Only meaningful when type is "successPage".',
    })
  ),
  showSummary: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Render a read-only summary of submitted values on the success page. Only meaningful when type is "successPage".',
    })
  ),
  redirect: Schema.optional(
    Schema.String.annotations({
      description:
        'URL navigated to after the success page is shown. Supports $record.X interpolation. Only meaningful when type is "successPage".',
      examples: ['/support/tickets/$record.id'],
    })
  ),
  toast: Schema.optional(ToastSchema),
}).annotations({
  title: 'Action Response',
  description: 'Defines behavior after action success or failure',
})

export const AuthActionSchema = Schema.Struct({
  type: Schema.Literal('auth'),
  method: Schema.Literal(
    'login',
    'signup',
    'logout',
    'resetPassword',
    'setNewPassword',
    'verifyEmail'
  ).annotations({
    description: 'Authentication operation to perform',
  }),
  strategy: Schema.optional(
    Schema.Literal('email', 'magicLink', 'oauth').annotations({
      description: 'Authentication strategy to use',
    })
  ),
  provider: Schema.optional(
    Schema.String.annotations({
      description: 'OAuth provider name (e.g., google, github)',
      examples: ['google', 'github', 'discord'],
    })
  ),
  submitLabel: Schema.optional(
    Schema.String.annotations({
      description:
        'Custom submit-button label for the auth form. Defaults to the localized built-in label for the method. Supports $t:key translation references.',
      examples: ['Sign In', 'Se connecter', '$t:auth.submit'],
    })
  ),
  fields: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String.annotations({
          description: 'Name of the auth field to override (e.g. email, password)',
          examples: ['email', 'password'],
        }),
        label: Schema.optional(
          Schema.String.annotations({
            description: 'Visible label override for this field. Supports $t:key references.',
            examples: ['Adresse e-mail', 'Mot de passe', '$t:auth.email.label'],
          })
        ),
        placeholder: Schema.optional(
          Schema.String.annotations({
            description: 'Input placeholder override for this field. Supports $t:key references.',
            examples: ['vous@exemple.com', '$t:auth.email.placeholder'],
          })
        ),
      })
    ).annotations({
      description:
        'Per-field label/placeholder overrides for the auth form. Targets fields by name. Additive — default fields are used when omitted.',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'Auth Action',
  description: 'Authentication action (login, signup, logout, etc.)',
})

export const CrudActionSchema = Schema.Struct({
  type: Schema.Literal('crud'),
  operation: Schema.Literal('create', 'update', 'delete').annotations({
    description: 'Data operation to perform',
  }),
  table: Schema.String.annotations({
    description: 'Table to perform the operation on',
  }),
  confirm: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, shows a confirmation prompt before executing the action',
    })
  ),
  confirmMessage: Schema.optional(
    Schema.String.annotations({
      description: 'Custom confirmation message. Defaults to a generic confirmation prompt.',
      examples: ['Are you sure you want to delete this record?'],
    })
  ),
  data: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).annotations({
      description: 'Field values to apply in bulk update operations',
      examples: [{ status: 'shipped' }, { archived: true }],
    })
  ),
  submitLabel: Schema.optional(
    Schema.String.annotations({
      description:
        'Custom submit-button label for the CRUD form. Defaults to the localized built-in label for the operation (Create/Update/Delete). Supports $t:key translation references.',
      examples: ['Create', 'Enregistrer', '$t:crud.submit'],
    })
  ),
  fields: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String.annotations({
          description: 'Name of the CRUD field to override (matches a table column, e.g. name)',
          examples: ['name', 'email'],
        }),
        label: Schema.optional(
          Schema.String.annotations({
            description: 'Visible label override for this field. Supports $t:key references.',
            examples: ['Nom du client', 'Adresse e-mail', '$t:crud.name.label'],
          })
        ),
        placeholder: Schema.optional(
          Schema.String.annotations({
            description: 'Input placeholder override for this field. Supports $t:key references.',
            examples: ['Entreprise SARL', '$t:crud.name.placeholder'],
          })
        ),
      })
    ).annotations({
      description:
        'Per-field label/placeholder overrides for the CRUD form. Targets fields by name (table column). Additive — table-derived fields are used when omitted.',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'CRUD Action',
  description: 'Data operation action (create, update, delete)',
})

export const AutomationActionSchema = Schema.Struct({
  type: Schema.Literal('automation'),
  name: Schema.String.annotations({
    description: 'Automation name (must match an automation defined in app.automations)',
  }),
  inputData: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).annotations({
      description:
        'Key-value pairs passed to the automation as input. Supports $variable references.',
    })
  ),
  await: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Wait for completion before triggering response (default: false = fire-and-forget)',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'Automation Action',
  description: 'Invoke a named automation from a page component (button click, form submit)',
})

export const FilterActionSchema = Schema.Struct({
  type: Schema.Literal('filter'),
  targetDataSource: Schema.String.annotations({
    description: 'ID of the data source to filter (matches dataSource.targetId)',
  }),
  field: Schema.String.annotations({
    description: 'Field name to apply the filter to',
  }),
  operator: Schema.optional(
    Schema.Literal('eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte').annotations({
      description: 'Comparison operator (defaults to eq)',
    })
  ),
}).annotations({
  title: 'Filter Action',
  description: 'Cross-component filter action targeting a data source',
})

export const NavigateActionSchema = Schema.Struct({
  type: Schema.Literal('navigate'),
  path: Schema.String.annotations({
    description: 'Destination URL path (supports $record.X substitution)',
  }),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'Navigate Action',
  description: 'Pure navigation action — no mutation side-effect',
})

export const ToastActionSchema = Schema.Struct({
  type: Schema.Literal('toast'),
  message: Schema.String.annotations({
    description: 'Toast notification message. Supports $variable references.',
  }),
  variant: Schema.optional(ToastVariantSchema),
  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
}).annotations({
  title: 'Toast Action',
  description: 'Pure notification action — shows a transient toast with no side-effect',
})

const FetchToastResponseSchema = Schema.Struct({
  type: Schema.Literal('toast'),
  message: Schema.String.annotations({
    description: 'Toast notification message. Supports $variable references.',
  }),
  variant: Schema.optional(
    Schema.Literal('default', 'success', 'destructive', 'error', 'warning', 'info').annotations({
      description: 'Visual style of the toast notification',
    })
  ),
  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
  actionLabel: Schema.optional(
    Schema.String.annotations({
      description: 'Label of an optional action button rendered inside the toast',
      examples: ['Undo', 'Retry'],
    })
  ),
  actionUrl: Schema.optional(
    Schema.String.annotations({
      description:
        'URL invoked (POST) when the toast action button is clicked. Required with actionLabel.',
    })
  ),
}).annotations({
  title: 'Fetch Toast Response',
  description: 'Toast notification rendered after a fetch action completes',
})

export const FetchActionSchema = Schema.Struct({
  type: Schema.Literal('fetch'),
  url: Schema.String.annotations({
    description: 'Target URL for the fetch call (e.g. /api/tables/contacts/records)',
  }),
  method: Schema.optional(
    Schema.Literal('GET', 'POST', 'PUT', 'PATCH', 'DELETE').annotations({
      description: 'HTTP method (defaults to GET)',
    })
  ),
  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).annotations({
      description: 'Request headers. Content-Type defaults to application/json when body is set.',
    })
  ),
  body: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).annotations({
      description: 'JSON request body (serialized with JSON.stringify)',
    })
  ),
  onSuccess: Schema.optional(FetchToastResponseSchema),
  onError: Schema.optional(FetchToastResponseSchema),
}).annotations({
  title: 'Fetch Action',
  description: 'Client-side fetch action with optional success/error toast response',
})

export const OpenDrawerActionSchema = Schema.Struct({
  action: Schema.Literal('openDrawer'),
  component: Schema.String.annotations({
    description:
      "ID of the drawer page-component to open (matches a sibling `{ type: 'drawer', id }`)",
  }),
  props: Schema.optional(
    Schema.Struct({
      width: Schema.optional(
        Schema.Number.pipe(
          Schema.int(),
          Schema.greaterThan(0),
          Schema.annotations({ description: 'Drawer width in pixels for this trigger instance' })
        )
      ),
    }).annotations({
      description: 'Per-trigger overrides applied to the referenced drawer component',
    })
  ),
}).annotations({
  title: 'Open Drawer Action',
  description:
    'Opens a referenced drawer component (record-detail quick-edit pattern). Discriminated by the `action: openDrawer` literal (not `type`).',
})

export const ActionSchema = Schema.Union(
  AuthActionSchema,
  CrudActionSchema,
  AutomationActionSchema,
  FilterActionSchema,
  NavigateActionSchema,
  ToastActionSchema,
  FetchActionSchema,
  OpenDrawerActionSchema
).pipe(
  Schema.annotations({
    identifier: 'Action',
    title: 'Action',
    description:
      'Component action. Discriminated by type: auth (authentication), crud (data operations), automation (invoke workflow), filter (cross-component filtering), navigate (pure URL navigation), toast (transient notification), fetch (client-side HTTP with toast response). Open-drawer is discriminated by `action: openDrawer` instead of `type` (PG-04 quick-edit drawer pattern).',
  })
)

export type Action = Schema.Schema.Type<typeof ActionSchema>
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>
export type CrudAction = Schema.Schema.Type<typeof CrudActionSchema>
export type AutomationAction = Schema.Schema.Type<typeof AutomationActionSchema>
export type FilterAction = Schema.Schema.Type<typeof FilterActionSchema>
export type NavigateAction = Schema.Schema.Type<typeof NavigateActionSchema>
export type ToastAction = Schema.Schema.Type<typeof ToastActionSchema>
export type FetchAction = Schema.Schema.Type<typeof FetchActionSchema>
export type OpenDrawerAction = Schema.Schema.Type<typeof OpenDrawerActionSchema>
export type ActionResponse = Schema.Schema.Type<typeof ActionResponseSchema>
export type ActionResponseType = Schema.Schema.Type<typeof ActionResponseTypeSchema>
export type Toast = Schema.Schema.Type<typeof ToastSchema>
export type ToastVariant = Schema.Schema.Type<typeof ToastVariantSchema>
