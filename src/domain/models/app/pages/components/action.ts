/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SuccessPageActionSchema } from '../../forms/on-success'

/**
 * Toast notification variant
 */
export const ToastVariantSchema = Schema.Literals(['success', 'error', 'warning', 'info']).annotate(
  {
    title: 'Toast Variant',
    description: 'Visual style of the toast notification',
  }
)

/**
 * Toast notification configuration
 *
 * @example
 * ```yaml
 * toast:
 *   message: Record created successfully
 *   variant: success
 * ```
 */
export const ToastSchema = Schema.Struct({
  /** Message to display */
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(ToastVariantSchema),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
}).annotate({
  title: 'Toast',
  description: 'Toast notification configuration',
})

/**
 * Action response behavior type
 *
 * Controls what happens to the form after a successful action:
 *
 * - `navigate`: Navigate to the `navigate` path (default when `navigate` is set)
 * - `reset`: Clear the form fields to their default values for rapid repeat entry.
 *   `preserveFields` may be used to retain selected field values across the reset.
 * - `message`: Show only the inline toast/message; the form keeps its values
 * - `successPage`: Replace the form with a custom success page (title, message,
 *   action buttons, optional summary of submitted values, optional redirect)
 * - `role-landing`: Navigate to the app's configured `auth.landingPath` so the
 *   existing per-role landing resolver redirects each authenticated user to
 *   their own `auth.roles[].defaultLanding`. Lets a SINGLE login form land
 *   different roles on different pages without a hardcoded `navigate` path.
 *   Only meaningful on a `type: auth`, `method: login` action and requires
 *   `auth.landingPath` (plus per-role `defaultLanding`) to be configured.
 */
export const ActionResponseTypeSchema = Schema.Literals([
  'navigate',
  'reset',
  'message',
  'successPage',
  'role-landing',
]).annotate({
  title: 'Action Response Type',
  description:
    'Form behavior after a successful action (navigate, reset, message, successPage, role-landing)',
})

/**
 * Action response handler
 *
 * Defines what happens after a successful or failed action.
 *
 * @example
 * ```yaml
 * onSuccess:
 *   navigate: /dashboard
 *   toast:
 *     message: Welcome back!
 *     variant: success
 *
 * # Quick-entry form that resets after every submission
 * onSuccess:
 *   type: reset
 *   preserveFields: [category, location]
 *   toast:
 *     message: Item added!
 *     variant: success
 *
 * # Replace the form with a custom success page after submission
 * onSuccess:
 *   type: successPage
 *   title: Thank you!
 *   message: Your response has been recorded.
 *   showSummary: true
 *   actions:
 *     - { label: Submit another, action: reset }
 *     - { label: Go home, action: navigate, url: / }
 *
 * # Single login form, per-role landing — each role lands on its own
 * # auth.roles[].defaultLanding via the engine's landingPath resolver
 * onSuccess:
 *   type: role-landing
 *   toast:
 *     message: Welcome back!
 *     variant: success
 * ```
 */
export const ActionResponseSchema = Schema.Struct({
  /** Behavior type — defaults to `navigate` when `navigate` is set */
  type: Schema.optional(ActionResponseTypeSchema),
  /** Path to navigate to after action */
  navigate: Schema.optional(
    Schema.String.annotate({
      description: 'URL path to navigate to. Supports $variable references.',
      examples: ['/dashboard', '/posts/$record.slug'],
    })
  ),
  /**
   * Field names whose values are retained after a `type: reset` response.
   * All other fields are cleared to their default values. Only meaningful
   * when `type` is `reset`.
   */
  preserveFields: Schema.optional(
    Schema.Array(Schema.String).annotate({
      description:
        'Field names retained after a reset. Only meaningful when type is "reset". All other fields are cleared.',
      examples: [
        ['category', 'location'],
        ['project', 'date'],
      ],
    })
  ),
  /**
   * Heading shown on the success page. Only meaningful when `type` is
   * `successPage`. Supports `$variable` references.
   */
  title: Schema.optional(
    Schema.String.annotate({
      description: 'Success page heading. Only meaningful when type is "successPage".',
      examples: ['Thank you for your feedback!', 'Ticket Created'],
    })
  ),
  /**
   * Body message shown below the heading on the success page. Only meaningful
   * when `type` is `successPage`. Supports `$variable` references.
   */
  message: Schema.optional(
    Schema.String.annotate({
      description: 'Success page body message. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * Action buttons rendered on the success page (`reset` and/or `navigate`).
   * Only meaningful when `type` is `successPage`. Shares the
   * `SuccessPageAction` shape with the standalone Forms feature.
   */
  actions: Schema.optional(
    Schema.Array(SuccessPageActionSchema).annotate({
      description: 'Success page action buttons. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * When `true`, the success page lists a read-only summary of the submitted
   * field values. Only meaningful when `type` is `successPage`.
   */
  showSummary: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Render a read-only summary of submitted values on the success page. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * URL to navigate to after the success page is shown (after a short delay).
   * May interpolate `$record.id` (and other `$record.X` fields) resolved from
   * the created/updated record. Only meaningful when `type` is `successPage`.
   */
  redirect: Schema.optional(
    Schema.String.annotate({
      description:
        'URL navigated to after the success page is shown. Supports $record.X interpolation. Only meaningful when type is "successPage".',
      examples: ['/support/tickets/$record.id'],
    })
  ),
  /** Toast notification to show */
  toast: Schema.optional(ToastSchema),
}).annotate({
  title: 'Action Response',
  description: 'Defines behavior after action success or failure',
})

/**
 * Auth action - authentication operations
 *
 * @example
 * ```yaml
 * action:
 *   type: auth
 *   method: login
 *   strategy: email
 *   onSuccess:
 *     navigate: /dashboard
 * ```
 */
export const AuthActionSchema = Schema.Struct({
  type: Schema.Literal('auth'),
  /** Auth method */
  method: Schema.Literals([
    'login',
    'signup',
    'logout',
    'resetPassword',
    'setNewPassword',
    'verifyEmail',
  ]).annotate({
    description: 'Authentication operation to perform',
  }),
  /** Auth strategy */
  strategy: Schema.optional(
    Schema.Literals(['email', 'magicLink', 'oauth']).annotate({
      description: 'Authentication strategy to use',
    })
  ),
  /** OAuth provider name (required when strategy is oauth) */
  provider: Schema.optional(
    Schema.String.annotate({
      description: 'OAuth provider name (e.g., google, github)',
      examples: ['google', 'github', 'discord'],
    })
  ),
  /**
   * Custom submit-button label for the embedded auth form. When omitted, the
   * renderer falls back to the localized built-in label for the `method`
   * (`Sign In` / `Sign Up` / `Send Reset Link` / `Set New Password`, resolved
   * through the page `meta.lang` + app `languages`). Supports a `$t:key`
   * translation reference. Additive/backward-compatible.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: login
   *   strategy: email
   *   submitLabel: Se connecter
   * ```
   */
  submitLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Custom submit-button label for the auth form. Defaults to the localized built-in label for the method. Supports $t:key translation references.',
      examples: ['Sign In', 'Se connecter', '$t:auth.submit'],
    })
  ),
  /**
   * Custom in-flight (pending) submit-button label for the embedded auth form —
   * the text shown while the request is running. When omitted, the renderer
   * falls back to the localized built-in pending label for the `method`
   * (`Signing in…` / `Creating account…` / …). Supports a `$t:key` translation
   * reference. Threaded to the shared auth-form island the same way
   * `submitLabel` is, so a localized console never shows a hardcoded
   * `Loading...`. Additive/backward-compatible.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: login
   *   strategy: email
   *   submitLabel: Se connecter
   *   pendingLabel: Connexion…
   * ```
   */
  pendingLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Custom in-flight (pending) submit-button label for the auth form. Defaults to the localized built-in pending label for the method. Supports $t:key translation references.',
      examples: ['Signing in…', 'Connexion…', '$t:auth.pending'],
    })
  ),
  /**
   * Per-field label/placeholder overrides for the embedded auth form. Each
   * entry targets a field by `name` (`email`, `password`, …) and overrides its
   * visible `label` and/or input `placeholder`. Fields not listed keep their
   * localized built-in label. Both `label` and `placeholder` support `$t:key`
   * translation references. Additive/backward-compatible — the default
   * email/password field set is unchanged when this is omitted.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: login
   *   strategy: email
   *   fields:
   *     - { name: email, label: Adresse e-mail, placeholder: vous@exemple.com }
   *     - { name: password, label: Mot de passe }
   * ```
   */
  fields: Schema.optional(
    Schema.Array(
      Schema.Struct({
        /** Field name to target (must match a rendered auth field, e.g. `email`) */
        name: Schema.String.annotate({
          description: 'Name of the auth field to override (e.g. email, password)',
          examples: ['email', 'password'],
        }),
        /** Visible label override. Supports $t:key translation references. */
        label: Schema.optional(
          Schema.String.annotate({
            description: 'Visible label override for this field. Supports $t:key references.',
            examples: ['Adresse e-mail', 'Mot de passe', '$t:auth.email.label'],
          })
        ),
        /** Input placeholder override. Supports $t:key translation references. */
        placeholder: Schema.optional(
          Schema.String.annotate({
            description: 'Input placeholder override for this field. Supports $t:key references.',
            examples: ['vous@exemple.com', '$t:auth.email.placeholder'],
          })
        ),
      })
    ).annotate({
      description:
        'Per-field label/placeholder overrides for the auth form. Targets fields by name. Additive — default fields are used when omitted.',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'Auth Action',
  description: 'Authentication action (login, signup, logout, etc.)',
})

/**
 * CRUD action - data operations
 *
 * @example
 * ```yaml
 * action:
 *   type: crud
 *   operation: create
 *   table: posts
 *   onSuccess:
 *     navigate: /posts
 *     toast:
 *       message: Post created!
 *       variant: success
 * ```
 */
export const CrudActionSchema = Schema.Struct({
  type: Schema.Literal('crud'),
  /** CRUD operation */
  operation: Schema.Literals(['create', 'update', 'delete']).annotate({
    description: 'Data operation to perform',
  }),
  /** Target table name (must exist in app.tables) */
  table: Schema.String.annotate({
    description: 'Table to perform the operation on',
  }),
  /** Show a confirmation prompt before executing the action */
  confirm: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, shows a confirmation prompt before executing the action',
    })
  ),
  /** Custom confirmation message to display (requires confirm: true) */
  confirmMessage: Schema.optional(
    Schema.String.annotate({
      description: 'Custom confirmation message. Defaults to a generic confirmation prompt.',
      examples: ['Are you sure you want to delete this record?'],
    })
  ),
  /** Static data payload for bulk update operations */
  data: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Field values to apply in bulk update operations',
      examples: [{ status: 'shipped' }, { archived: true }],
    })
  ),
  /**
   * Custom submit-button label for the embedded CRUD form. When omitted, the
   * renderer falls back to the localized built-in label for the `operation`
   * (`Create` / `Update` / `Delete`, resolved through the page `meta.lang` +
   * app `languages`). Supports a `$t:key` translation reference. Mirrors
   * `AuthActionSchema.submitLabel`. Additive/backward-compatible — existing
   * CRUD forms without this field keep the built-in label.
   *
   * @example
   * ```yaml
   * action:
   *   type: crud
   *   operation: create
   *   table: clients
   *   submitLabel: Enregistrer
   * ```
   */
  submitLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Custom submit-button label for the CRUD form. Defaults to the localized built-in label for the operation (Create/Update/Delete). Supports $t:key translation references.',
      examples: ['Create', 'Enregistrer', '$t:crud.submit'],
    })
  ),
  /**
   * Per-field label/placeholder overrides for the embedded CRUD form. Each
   * entry targets a field by `name` (the table column name) and overrides its
   * visible `label` and/or input `placeholder`. Fields not listed keep their
   * table-schema-derived label. Both `label` and `placeholder` support
   * `$t:key` translation references. Mirrors `AuthActionSchema.fields`.
   * Additive/backward-compatible — the table-derived field set is unchanged
   * when this is omitted.
   *
   * @example
   * ```yaml
   * action:
   *   type: crud
   *   operation: create
   *   table: clients
   *   fields:
   *     - { name: name, label: Nom du client, placeholder: Entreprise SARL }
   *     - { name: email, label: Adresse e-mail }
   * ```
   */
  fields: Schema.optional(
    Schema.Array(
      Schema.Struct({
        /** Field name to target (must match a table column rendered in the form) */
        name: Schema.String.annotate({
          description: 'Name of the CRUD field to override (matches a table column, e.g. name)',
          examples: ['name', 'email'],
        }),
        /** Visible label override. Supports $t:key translation references. */
        label: Schema.optional(
          Schema.String.annotate({
            description: 'Visible label override for this field. Supports $t:key references.',
            examples: ['Nom du client', 'Adresse e-mail', '$t:crud.name.label'],
          })
        ),
        /** Input placeholder override. Supports $t:key translation references. */
        placeholder: Schema.optional(
          Schema.String.annotate({
            description: 'Input placeholder override for this field. Supports $t:key references.',
            examples: ['Entreprise SARL', '$t:crud.name.placeholder'],
          })
        ),
      })
    ).annotate({
      description:
        'Per-field label/placeholder overrides for the CRUD form. Targets fields by name (table column). Additive — table-derived fields are used when omitted.',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'CRUD Action',
  description: 'Data operation action (create, update, delete)',
})

/**
 * Automation action - invoke a named automation
 *
 * @example
 * ```yaml
 * action:
 *   type: automation
 *   name: generate-monthly-report
 *   inputData:
 *     month: '$currentMonth'
 *     format: pdf
 *   await: true
 *   onSuccess:
 *     toast:
 *       message: Report generated!
 *       variant: success
 *     navigate: /reports
 * ```
 */
export const AutomationActionSchema = Schema.Struct({
  type: Schema.Literal('automation'),
  /** Automation name (must match an automation defined in app.automations) */
  name: Schema.String.annotate({
    description: 'Automation name (must match an automation defined in app.automations)',
  }),
  /** Key-value pairs passed to the automation as input */
  inputData: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'Key-value pairs passed to the automation as input. Supports $variable references.',
    })
  ),
  /** Whether to wait for completion before triggering response */
  await: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Wait for completion before triggering response (default: false = fire-and-forget)',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'Automation Action',
  description: 'Invoke a named automation from a page component (button click, form submit)',
})

/**
 * Filter action - cross-component data filtering
 *
 * @example
 * ```yaml
 * action:
 *   type: filter
 *   targetDataSource: product-list
 *   field: category
 *   operator: eq
 * ```
 */
export const FilterActionSchema = Schema.Struct({
  type: Schema.Literal('filter'),
  /** Target data source ID to apply filter to */
  targetDataSource: Schema.String.annotate({
    description: 'ID of the data source to filter (matches dataSource.targetId)',
  }),
  /** Field to filter on */
  field: Schema.String.annotate({
    description: 'Field name to apply the filter to',
  }),
  /** Filter operator */
  operator: Schema.optional(
    Schema.Literals(['eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte']).annotate({
      description: 'Comparison operator (defaults to eq)',
    })
  ),
}).annotate({
  title: 'Filter Action',
  description: 'Cross-component filter action targeting a data source',
})

/**
 * Navigate Action
 *
 * Pure navigation primitive — first-class for callers (e.g. Kanban card
 * `onClick`) that just want to move the user to a new page without a
 * mutation side-effect. `crud` actions can already navigate via their
 * `onSuccess.navigate` response, but that path is overloaded with a
 * mutation; this variant is the navigate-only shape.
 *
 * `path` supports `$record.X` substitution at render time so
 * row-bound elements (cards, table rows) can navigate to a per-record
 * destination.
 *
 * @example
 * ```yaml
 * # Card onClick to record detail
 * onClick:
 *   type: navigate
 *   path: '/tasks/$record.id'
 *
 * # Static path
 * onClick:
 *   type: navigate
 *   path: '/dashboard'
 * ```
 */
export const NavigateActionSchema = Schema.Struct({
  type: Schema.Literal('navigate'),
  /** Destination URL path. Supports `$record.X` substitution. */
  path: Schema.String.annotate({
    description: 'Destination URL path (supports $record.X substitution)',
  }),
  /** Optional success handler (rarely used for pure navigation). */
  onSuccess: Schema.optional(ActionResponseSchema),
  /** Optional error handler (e.g. router rejection). */
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'Navigate Action',
  description: 'Pure navigation action — no mutation side-effect',
})

/**
 * Toast Action
 *
 * Pure notification primitive — first-class for callers (e.g. a reorderable
 * list `onReorder` handler) that just want to surface a transient toast
 * without a mutation or navigation side-effect. Mirrors the inline
 * `ToastSchema` shape used by `ActionResponse.toast`, lifted to a top-level
 * action variant discriminated by `type: 'toast'`.
 *
 * @example
 * ```yaml
 * # Reorderable list onReorder handler
 * onReorder:
 *   type: toast
 *   message: Reordered
 *   variant: success
 *
 * # Minimal toast
 * onClick:
 *   type: toast
 *   message: Copied to clipboard
 * ```
 */
export const ToastActionSchema = Schema.Struct({
  type: Schema.Literal('toast'),
  /** Message to display. Supports $variable references. */
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(ToastVariantSchema),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
}).annotate({
  title: 'Toast Action',
  description: 'Pure notification action — shows a transient toast with no side-effect',
})

/**
 * Fetch Toast Response Schema
 *
 * Shape used by `FetchActionSchema.onSuccess` / `.onError` to describe a
 * toast notification rendered after a `fetch` action completes. Distinct from
 * the standalone `ToastActionSchema` because the fetch-response variant
 * supports an action button (`actionLabel` + `actionUrl`) and a broader
 * variant set (`default`/`destructive` in addition to the standard
 * `success`/`error`/`warning`/`info`) used by component-library toast UIs.
 */
export const FetchToastResponseSchema = Schema.Struct({
  type: Schema.Literal('toast'),
  /** Message to display. Supports $variable references. */
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(
    Schema.Literals(['default', 'success', 'destructive', 'error', 'warning', 'info']).annotate({
      description: 'Visual style of the toast notification',
    })
  ),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
  /** Label of an optional action button rendered inside the toast */
  actionLabel: Schema.optional(
    Schema.String.annotate({
      description: 'Label of an optional action button rendered inside the toast',
      examples: ['Undo', 'Retry'],
    })
  ),
  /** URL invoked (POST) when the toast action button is clicked */
  actionUrl: Schema.optional(
    Schema.String.annotate({
      description:
        'URL invoked (POST) when the toast action button is clicked. Required with actionLabel.',
    })
  ),
}).annotate({
  title: 'Fetch Toast Response',
  description: 'Toast notification rendered after a fetch action completes',
})

/**
 * Inline status region populated on a fetch action's success.
 *
 * Distinct from the TRANSIENT `toast`: a status writes a PERSISTENT inline message
 * into a sibling element (announced as a `role="status"` ARIA live region) that
 * stays on screen — the "Export généré" badge that confirms an export completed,
 * rather than a toast that auto-dismisses.
 *
 * `target` names a sibling component's `props.id`; on success the client fills that
 * element with `message` and promotes it to a `role="status"` live region.
 */
const FetchSuccessStatusSchema = Schema.Struct({
  /** `props.id` of the sibling element the status message is written into. */
  target: Schema.String.annotate({
    description:
      'props.id of the sibling element the status message is written into (promoted to role=status).',
    examples: ['export-status', 'save-indicator'],
  }),
  /** The status message. Supports `$variable` / `$session.<field>` references. */
  message: Schema.String.annotate({
    description:
      'Persistent status message written into the target region. Supports $variable references.',
    examples: ['Export généré', 'Saved'],
  }),
}).annotate({
  title: 'Fetch Success Status',
  description:
    'A persistent inline role="status" region populated on success (the persistent counterpart to a transient toast).',
})

/**
 * Sibling data-bound component(s) to re-query after a fetch action succeeds — by
 * `props.id`. The named component(s) re-issue their read (a DB-table `dataSource`
 * OR a `dataSource.system` read endpoint), so a freshly-mutated list reflects the
 * change without a full reload (e.g. a pending-erasure table re-fetching after the
 * erase POST). Accepts a single id or an array.
 */
const FetchSuccessRefetchSchema = Schema.Union([
  Schema.String,
  Schema.Array(Schema.String).pipe(Schema.check(Schema.isMinLength(1))),
]).annotate({
  title: 'Fetch Success Refetch',
  description:
    'props.id (or array of ids) of sibling data-bound component(s) to re-query on success. Works for both a DB-table dataSource and a dataSource.system read endpoint.',
})

/**
 * Success response for a `fetch` action — the toast slot PLUS the additive
 * client-state effects (`status`, `refetch`).
 *
 * Re-uses every `FetchToastResponseSchema` field (so existing toast-only `onSuccess`
 * configs validate unchanged), then layers two effects on top:
 *  - `status`: write a PERSISTENT inline `role="status"` region (distinct from the
 *    transient toast) — the "Export généré" badge;
 *  - `refetch`: re-query sibling data-bound component(s) by `props.id` — so a
 *    sibling `dataSource.system` (or DB-table) list reflects a just-made mutation.
 *
 * `type` + `message` stay required (the toast slot is unchanged); `status` / `refetch`
 * ride ALONGSIDE the toast (a brief success toast can coexist with the persistent
 * status badge and the list refresh).
 */
export const FetchSuccessResponseSchema = Schema.Struct({
  ...FetchToastResponseSchema.fields,
  /** Persistent inline `role="status"` region populated on success. */
  status: Schema.optional(FetchSuccessStatusSchema),
  /** Sibling data-bound component id(s) to re-query on success. */
  refetch: Schema.optional(FetchSuccessRefetchSchema),
}).annotate({
  title: 'Fetch Success Response',
  description:
    'Success handler for a fetch action: the toast slot plus optional client-state effects — a persistent inline status region (status) and a sibling data-bound refetch (refetch).',
})

/**
 * Fetch dispatch mode — how the client carries out a fetch action.
 *
 * Controls whether the action is a `fetch()` (the default fire-and-display
 * interaction), a browser navigation, a native file download, or an OAuth
 * authorize round-trip. The non-`fetch` modes are what let a single config
 * `action` express the admin dashboard's bespoke operate gestures (CSV export,
 * file download, connection authorize) — the "Consoles-as-Config" CAP-3b
 * action-mode extensions.
 *
 * - `fetch` (default): client `fetch()` to `url`, then dispatch the
 *   `onSuccess` / `onError` toast based on the response.
 * - `navigate`: navigate the browser to `url` instead of fetching — for server
 *   responses that drive the browser directly (a CSV export at `?format=csv`
 *   returned with `Content-Disposition: attachment`, or a server-issued
 *   redirect). No client toast.
 * - `download`: save `url` as a native file. The client issues a credentialed
 *   `fetch` of `url` (so the page-level GET is observable and reaches
 *   session-bound endpoints — a bare `<a download>` would route through the
 *   browser's download manager and bypass the page network), then saves the
 *   response blob through a transient `download`-attributed anchor (optionally
 *   named by `filename`) — for binary objects such as a bucket file or the GDPR
 *   archive. No client toast.
 * - `oauth`: initiate an OAuth authorize → provider → callback round-trip:
 *   request `url` (an authorize endpoint returning the provider consent URL as
 *   DATA at `redirectKey`, default `url`), navigate the browser to that URL, and
 *   let the provider return to `callbackPath`. For a connection `authorize`.
 */
export const FetchActionModeSchema = Schema.Literals([
  'fetch',
  'navigate',
  'download',
  'oauth',
]).annotate({
  title: 'Fetch Action Mode',
  description:
    'Dispatch mode: fetch (default, client fetch + toast), navigate (browser navigation, e.g. ?format=csv export), download (native file download), oauth (authorize → provider → callback round-trip)',
})

/**
 * Response-envelope interpretation — how the success/error decision reads the
 * response body. Lets a fetch action target a NON-Sovrium endpoint whose body
 * is not the Sovrium `{ items }` / Zod shape (the CAP-3b envelope tolerance).
 *
 * - `sovrium` (default): success keyed on a 2xx status; messages read from the
 *   Sovrium error shape.
 * - `better-auth`: the target is a Better-Auth admin endpoint (`/api/auth/admin/*`)
 *   whose envelope is always-200 and enumeration-safe — success/error is decided
 *   from the body's `error` field, not purely from the HTTP status.
 * - `raw`: make no body-shape assumptions; success = any 2xx, error = any
 *   non-2xx, with no message extraction.
 */
export const FetchResponseEnvelopeSchema = Schema.Literals([
  'sovrium',
  'better-auth',
  'raw',
]).annotate({
  title: 'Fetch Response Envelope',
  description:
    'Response-envelope interpretation: sovrium (default), better-auth (always-200 enumeration-safe envelope at /api/auth/admin/*), raw (status-only, no body assumptions)',
})

/**
 * Fetch action - generic HTTP fetch / navigate / download / oauth operate action
 *
 * Triggers a client-side `fetch()` call to an arbitrary URL (typically a
 * Sovrium API endpoint such as `/api/tables/<name>/records`) and dispatches
 * an `onSuccess` / `onError` toast based on the HTTP response status.
 *
 * Useful for thin "fire-and-display" interactions where a full `crud`
 * variant (with structured operation/table validation) is overkill — for
 * example a "Save quick note" button or a "Mark as read" toggle that just
 * pings an endpoint and surfaces a transient toast.
 *
 * Beyond the default `fetch`, the `mode` field carries the admin dashboard's
 * bespoke operate gestures into config: a confirm-gated mutate (`confirm`) to
 * any path (`url` is unrestricted — `/api/auth/admin/*`, the public
 * `/api/buckets/*`, …), a `navigate` CSV export, a `download` of a bucket file,
 * and an `oauth` connection authorize. `responseEnvelope` makes the success
 * decision tolerant of a non-Sovrium body (Better-Auth's always-200 envelope).
 *
 * @example
 * ```yaml
 * # Fire-and-display (default mode)
 * action:
 *   type: fetch
 *   url: /api/tables/contacts/records
 *   method: POST
 *   body: { name: 'Alice', email: 'alice@example.com' }
 *   onSuccess:
 *     type: toast
 *     variant: success
 *     message: Contact saved!
 *   onError:
 *     type: toast
 *     variant: destructive
 *     message: Save failed
 *
 * # Confirm-gated mutate against the Better-Auth admin plugin (envelope-tolerant)
 * action:
 *   type: fetch
 *   url: /api/auth/admin/ban-user
 *   method: POST
 *   body: { userId: '$record.id' }
 *   confirm: true
 *   confirmMessage: Bannir ce compte ?
 *   responseEnvelope: better-auth
 *
 * # CSV export — navigate the browser to the export endpoint
 * action:
 *   type: fetch
 *   mode: navigate
 *   url: /api/tables/contacts/export?format=csv
 *
 * # File download of a bucket object
 * action:
 *   type: fetch
 *   mode: download
 *   url: /api/buckets/default/files/$record.key
 *   filename: $record.name
 *
 * # Connection authorize — OAuth round-trip
 * action:
 *   type: fetch
 *   mode: oauth
 *   url: /api/admin/connections/$record.id/authorize
 *   method: POST
 *   redirectKey: authorizationUrl
 *   callbackPath: /api/admin/connections/$record.name/callback
 * ```
 */
export const FetchActionSchema = Schema.Struct({
  type: Schema.Literal('fetch'),
  /**
   * Target URL for the action (any absolute path or fully-qualified URL). Not
   * restricted to a `/api/admin/*` prefix — may target the Better-Auth admin
   * plugin (`/api/auth/admin/*`) or the public buckets API (`/api/buckets/*`).
   */
  url: Schema.String.annotate({
    description:
      'Target URL (any absolute path or fully-qualified URL; not prefix-restricted). e.g. /api/tables/contacts/records, /api/auth/admin/ban-user, /api/buckets/default/files/<key>',
  }),
  /**
   * Dispatch mode (defaults to `fetch`). See `FetchActionModeSchema` — selects
   * client fetch vs browser navigate / native download / OAuth round-trip.
   */
  mode: Schema.optional(FetchActionModeSchema),
  /** HTTP method (defaults to GET) */
  method: Schema.optional(
    Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).annotate({
      description: 'HTTP method (defaults to GET)',
    })
  ),
  /** Optional request headers */
  headers: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      description: 'Request headers. Content-Type defaults to application/json when body is set.',
    })
  ),
  /** Optional JSON request body (serialized with JSON.stringify) */
  body: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'JSON request body (serialized with JSON.stringify). String values support $record.<field> and the $session.<field> token (resolved client-side from the caller session, e.g. { confirm: "$session.email" }).',
    })
  ),
  /**
   * Show a confirmation prompt before executing the action. Mirrors
   * `CrudActionSchema.confirm` — the minimal gate that turns a fetch action
   * into a confirm-gated operate action (ban, erase, …).
   */
  confirm: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, shows a confirmation prompt before executing the action',
    })
  ),
  /** Custom confirmation message to display (requires confirm: true) */
  confirmMessage: Schema.optional(
    Schema.String.annotate({
      description: 'Custom confirmation message. Defaults to a generic confirmation prompt.',
      examples: ['Bannir ce compte ?', "L'effacement est définitif et irréversible."],
    })
  ),
  /**
   * Suggested download filename — only meaningful when `mode` is `download`.
   * Sets the anchor `download` attribute so the saved file is named regardless
   * of the server's `Content-Disposition`.
   */
  filename: Schema.optional(
    Schema.String.annotate({
      description: 'Suggested download filename. Only meaningful when mode is "download".',
      examples: ['mon-compte.json', 'export.csv', '$record.name'],
    })
  ),
  /**
   * Response field holding the provider redirect URL — only meaningful when
   * `mode` is `oauth` (default `url`). The authorize endpoint returns the
   * provider consent URL as DATA (e.g. `{ authorizationUrl }`), which the client
   * navigates to; `redirectKey` names that field.
   */
  redirectKey: Schema.optional(
    Schema.String.annotate({
      description:
        'Response field holding the OAuth provider redirect URL (default "url"). Only meaningful when mode is "oauth".',
      examples: ['authorizationUrl', 'url'],
    })
  ),
  /**
   * Path the OAuth provider returns to after consent — only meaningful when
   * `mode` is `oauth`. The provider's registered `redirect_uri` must resolve to
   * this callback path (e.g. `/api/admin/connections/:name/callback`).
   */
  callbackPath: Schema.optional(
    Schema.String.annotate({
      description:
        'OAuth provider return path (the registered redirect_uri). Only meaningful when mode is "oauth".',
      examples: ['/api/admin/connections/slack/callback'],
    })
  ),
  /**
   * How to interpret the response body when deciding success/error (default
   * `sovrium`). See `FetchResponseEnvelopeSchema` — set `better-auth` for the
   * `/api/auth/admin/*` always-200 enumeration-safe envelope.
   */
  responseEnvelope: Schema.optional(FetchResponseEnvelopeSchema),
  /**
   * Success handler when the fetch resolves with a 2xx response. The toast slot
   * (back-compat) PLUS optional client-state effects: a persistent inline
   * `role="status"` region (`status`) and a sibling data-bound `refetch`.
   */
  onSuccess: Schema.optional(FetchSuccessResponseSchema),
  /** Toast displayed when the fetch resolves with a non-2xx response or rejects */
  onError: Schema.optional(FetchToastResponseSchema),
}).annotate({
  title: 'Fetch Action',
  description:
    'Client-side operate action: fetch (default) / navigate / download / oauth, with optional confirm gating, arbitrary target path, and non-Sovrium response-envelope tolerance',
})

/**
 * Open-Drawer action - opens a referenced drawer component (record-detail
 * quick-edit pattern, PG-04).
 *
 * Unlike sibling action variants which use `type` as the discriminator, this
 * schema is discriminated by the literal `action: 'openDrawer'` key — the
 * user-story doc and PG-04 specs define the wire shape as
 * `{ action: 'openDrawer', component: '<drawer-id>', props?: {...} }`,
 * declared this way so the data-table `onRowClick` reads as a verb-phrase
 * ("open Drawer named record-detail") rather than yet another typed
 * action variant. The companion `drawer` page component (referenced by
 * `component`) materialises the slide-in panel that fetches and renders
 * the clicked record's detail.
 *
 * `props.width` overrides the drawer's default size for this trigger
 * instance (other geometry options live on the drawer component itself).
 *
 * @example
 * ```yaml
 * # On a data-table row click, open the `record-detail` drawer
 * onRowClick:
 *   action: openDrawer
 *   component: record-detail
 *   props:
 *     width: 600
 * ```
 */
export const OpenDrawerActionSchema = Schema.Struct({
  /** Discriminator literal — matches `action: openDrawer` in YAML/JSON */
  action: Schema.Literal('openDrawer'),
  /**
   * ID of the drawer component to open. Must match a sibling
   * `{ type: 'drawer', id: '<this-value>' }` component on the same page.
   */
  component: Schema.String.annotate({
    description:
      "ID of the drawer page-component to open (matches a sibling `{ type: 'drawer', id }`)",
  }),
  /** Per-trigger overrides applied to the drawer (currently `width`). */
  props: Schema.optional(
    Schema.Struct({
      width: Schema.optional(
        Schema.Finite.pipe(
          Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
          Schema.annotate({ description: 'Drawer width in pixels for this trigger instance' })
        )
      ),
    }).annotate({
      description: 'Per-trigger overrides applied to the referenced drawer component',
    })
  ),
}).annotate({
  title: 'Open Drawer Action',
  description:
    'Opens a referenced drawer component (record-detail quick-edit pattern). Discriminated by the `action: openDrawer` literal (not `type`).',
})

/**
 * Action Schema
 *
 * Discriminated union of action types that can be triggered by components.
 * The `type` field determines the action variant:
 *
 * - **auth**: Authentication operations (login, signup, logout, etc.)
 * - **crud**: Data operations (create, update, delete)
 * - **automation**: Invoke a named automation workflow
 * - **filter**: Cross-component data source filtering
 * - **navigate**: Pure URL navigation
 * - **toast**: Show a transient toast notification
 * - **fetch**: Client-side fetch with toast response
 * - **openDrawer**: Open a drawer component — discriminated on `action`, NOT on
 *   `type`, which is why it is easy to miss when counting this union. The union
 *   has EIGHT members; a list of seven here has already been read as
 *   authoritative by downstream comments that then undercounted it.
 *
 * @example
 * ```yaml
 * # Login form
 * action:
 *   type: auth
 *   method: login
 *   strategy: email
 *   onSuccess:
 *     navigate: /dashboard
 *     toast:
 *       message: Welcome back!
 *       variant: success
 *
 * # Create record
 * action:
 *   type: crud
 *   operation: create
 *   table: posts
 *   onSuccess:
 *     toast:
 *       message: Post created successfully
 *       variant: success
 *
 * # Trigger automation
 * action:
 *   type: automation
 *   name: generate-report
 *   inputData:
 *     month: '$currentMonth'
 *   await: true
 *   onSuccess:
 *     toast:
 *       message: Report ready!
 *       variant: success
 *
 * # Category filter dropdown
 * action:
 *   type: filter
 *   targetDataSource: product-list
 *   field: category
 *   operator: eq
 *
 * # Generic fetch with toast
 * action:
 *   type: fetch
 *   url: /api/tables/contacts/records
 *   method: POST
 *   body: { name: 'Alice' }
 *   onSuccess:
 *     type: toast
 *     variant: success
 *     message: Saved!
 * ```
 */
export const ActionSchema = Schema.Union([
  AuthActionSchema,
  CrudActionSchema,
  AutomationActionSchema,
  FilterActionSchema,
  NavigateActionSchema,
  ToastActionSchema,
  FetchActionSchema,
  OpenDrawerActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'Action',
    title: 'Action',
    description:
      'Component action. Discriminated by type: auth (authentication), crud (data operations), automation (invoke workflow), filter (cross-component filtering), navigate (pure URL navigation), toast (transient notification), fetch (client-side HTTP with toast response). Open-drawer is discriminated by `action: openDrawer` instead of `type` (PG-04 quick-edit drawer pattern).',
  })
)

/**
 * Row Click Action
 *
 * The subset of {@link ActionSchema} a data-table row click actually honours.
 *
 * The row-click handler implements exactly two variants — `navigate` and
 * `openDrawer` — and returns `undefined` for everything else
 * (`resolveRowClickAction` in
 * `src/presentation/islands/data-table/island/index.tsx`). Typing `onRowClick`
 * as the full eight-member `ActionSchema` therefore accepted six variants that
 * validate and then do nothing: a config declaring
 * `onRowClick: { type: 'fetch', … }` passed validation, shipped, and silently
 * never fired.
 *
 * That silence was deliberate and documented, which is precisely why it is
 * expressed in the type rather than left to a comment: a narrowed union fixes
 * the TypeScript type, the decode-time guard and the published JSON Schema at
 * once, and turns a runtime no-op into an authoring-time error the author can
 * act on.
 *
 * Richer behaviour on a row click belongs on the referenced record-drawer's
 * footer `actions`, where the full `ActionSchema` (including `fetch`) is
 * honoured.
 *
 * @example
 * ```yaml
 * # Navigate to a record page (supports $record.<field> substitution)
 * onRowClick:
 *   type: navigate
 *   path: '/deals/$record.id'
 *
 * # Open a sibling drawer component (PG-04 quick-edit pattern)
 * onRowClick:
 *   action: openDrawer
 *   component: record-detail
 * ```
 */
export const RowClickActionSchema = Schema.Union([
  NavigateActionSchema,
  OpenDrawerActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'RowClickAction',
    title: 'Row Click Action',
    description:
      'Action triggered by a data-table row click. Only two variants are honoured at runtime: `navigate` (pure URL navigation, discriminated by `type: navigate`, `path` supports `$record.X` substitution) and `openDrawer` (opens a sibling drawer component, discriminated by `action: openDrawer`). The remaining Action variants (auth, crud, automation, filter, toast, fetch) are rejected here because the row-click handler ignores them — put richer behaviour on the footer actions of the referenced drawer component instead.',
  })
)

/** @public */
export type Action = Schema.Schema.Type<typeof ActionSchema>
/** @public */
export type RowClickAction = Schema.Schema.Type<typeof RowClickActionSchema>
/** @public */
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>
/** @public */
export type CrudAction = Schema.Schema.Type<typeof CrudActionSchema>
/** @public */
export type AutomationAction = Schema.Schema.Type<typeof AutomationActionSchema>
/** @public */
export type FilterAction = Schema.Schema.Type<typeof FilterActionSchema>
/** @public */
export type NavigateAction = Schema.Schema.Type<typeof NavigateActionSchema>
/** @public */
export type ToastAction = Schema.Schema.Type<typeof ToastActionSchema>
/** @public */
export type FetchAction = Schema.Schema.Type<typeof FetchActionSchema>
/** @public */
export type FetchSuccessResponse = Schema.Schema.Type<typeof FetchSuccessResponseSchema>
/** @public */
export type FetchToastResponse = Schema.Schema.Type<typeof FetchToastResponseSchema>
/** @public */
export type FetchActionMode = Schema.Schema.Type<typeof FetchActionModeSchema>
/** @public */
export type FetchResponseEnvelope = Schema.Schema.Type<typeof FetchResponseEnvelopeSchema>
/** @public */
export type OpenDrawerAction = Schema.Schema.Type<typeof OpenDrawerActionSchema>
/** @public */
export type ActionResponse = Schema.Schema.Type<typeof ActionResponseSchema>
/** @public */
export type ActionResponseType = Schema.Schema.Type<typeof ActionResponseTypeSchema>
/** @public */
export type Toast = Schema.Schema.Type<typeof ToastSchema>
/** @public */
export type ToastVariant = Schema.Schema.Type<typeof ToastVariantSchema>
