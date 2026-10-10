/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LOGIN_PAGE_PATTERN } from '../../auth/auth'
import { ActionResponseSchema } from './action-response'
import { ButtonVariantSchema } from './button-variant'

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
  type: Schema.Literal('auth').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /** Auth method */
  method: Schema.Literals([
    'login',
    'signup',
    'logout',
    'resetPassword',
    'setNewPassword',
    'verifyEmail',
    'registerPasskey',
    // Second factor: the sign-in step after a password, and the enrolment,
    // removal and fresh set of recovery codes a security page offers
    'verifyTwoFactor',
    'enableTwoFactor',
    'disableTwoFactor',
    'regenerateBackupCodes',
    // Invitations, from the invitee's side (token read from the page address)
    // and from the inviter's side (one pending invitation, by `target`)
    'acceptInvitation',
    'declineInvitation',
    'resendInvitation',
    'revokeInvitation',
    // The reader's own credentials and sessions, one item by `target`
    'createApiKey',
    'revokeApiKey',
    'renamePasskey',
    'removePasskey',
    'revokeSession',
    'revokeOtherSessions',
    // A member's role, set by someone allowed to administer accounts
    'setRole',
    // The reader's binding to an external sign-in provider, named by
    // `provider`: connect it through the provider, or disconnect it
    'linkAccount',
    'unlinkAccount',
  ]).annotate({
    description:
      'What the action performs: the authentication operation under `type: auth`, or the HTTP verb under `type: fetch` (default GET). The account methods act on the signed-in reader’s own sessions, passkeys, API keys and two-step verification — `regenerateBackupCodes` replaces the reader’s recovery codes with a new set, shown once, after her password; `setRole`, `resendInvitation` and `revokeInvitation` need the administer-accounts capability. `linkAccount` connects the signed-in reader’s account to the sign-in provider named by `provider` (sending the browser through it and back), `unlinkAccount` disconnects it; disconnecting the reader’s only way in is refused.',
  }),
  /** Auth strategy */
  strategy: Schema.optional(
    Schema.Literals(['email', 'magicLink', 'oauth', 'sso', 'passkey']).annotate({
      description:
        'Authentication strategy to use. sso renders one button per auth.sso provider (or the one named by provider) and, when a provider lists domains, an email field that routes to the provider owning the domain. passkey renders a passkey sign-in button.',
    })
  ),
  /** OAuth provider name (required when strategy is oauth), or an auth.sso id */
  provider: Schema.optional(
    Schema.String.annotate({
      description:
        'OAuth provider name when strategy is oauth (e.g. google, github), the id of one auth.sso provider when strategy is sso, or the provider linkAccount and unlinkAccount connect (sovrium-cloud on an app hosted on Sovrium Cloud).',
      examples: ['google', 'github', 'okta'],
    })
  ),
  /**
   * The ONE item an item-level method acts on — a session, a passkey, an API
   * key, a member or an invitation — by id. Almost always `$record.id`, read
   * from the row the button sits in. Required by `revokeSession`,
   * `renamePasskey`, `removePasskey`, `revokeApiKey`, `setRole`,
   * `resendInvitation` and `revokeInvitation`; inert on every other method.
   *
   * The id is checked against the reader server-side: a session, passkey or
   * key that is not the reader's own, or a member the reader may not
   * administer, answers 404 exactly like one that does not exist.
   */
  target: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Id of the one session, passkey, API key, member or invitation an item-level method acts on — usually $record.id from the row the action sits in. An id the reader may not act on answers as if it did not exist.',
        examples: ['$record.id'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Which second factor `verifyTwoFactor` checks. `totp` (default) is the
   * authenticator-app code, `backupCode` one of the recovery codes shown at
   * enrolment. No code is sent by mail, so there is no `email` factor.
   */
  factor: Schema.optional(
    Schema.Literals(['totp', 'backupCode']).annotate({
      description:
        'Second factor `verifyTwoFactor` checks: totp (authenticator code, default) or backupCode (a recovery code). Inert on every other method.',
    })
  ),
  /**
   * Whether a successful `verifyTwoFactor` marks this browser as trusted, so
   * the second step is skipped on it for the trust period the two-factor
   * config sets. The form shows it as a "Trust this device" checkbox; this
   * key only decides whether that checkbox is offered.
   */
  trustDevice: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Offer "Trust this device" on the two-factor step, so a successful code skips the step on this browser for the configured trust period (default: false). Inert on every other method.',
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
        'Submit-button label for the form this action embeds. Defaults to the localized built-in label for the method or operation. Supports $t:key translation references.',
      examples: ['Sign In', 'Se connecter', '$t:auth.submit'],
    })
  ),
  /**
   * The WEIGHT of the auth form's submit button, in the button vocabulary.
   *
   * An auth page can hold two forms side by side whose answers are not equal:
   * an invitation is accepted or declined, a device is trusted or not. Drawn
   * with the same primary fill, the two buttons read as two equally main
   * actions, and the one the reader is meant to weigh twice looks exactly like
   * the one they are invited to take.
   *
   * The same key, with the same members, that `endpoint.submitVariant` gives a
   * custom-endpoint form ({@link ButtonVariantSchema}, the list a `button`
   * component accepts) — so an auth submit and a button asking for `secondary`
   * cannot look different. Omitting it keeps the primary fill every auth form
   * has today, to the byte.
   *
   * It weighs the forms drawn as fields plus a submit: every credential method
   * (by password or magic link), the second factor, the invitations, and the
   * account methods. It has NO effect on the single-control sign-ins —
   * `strategy: oauth`, `strategy: sso`, `strategy: passkey` and
   * `method: registerPasskey` — whose button is drawn by its own branch of the
   * auth-form island and ignores the key.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: declineInvitation
   *   submitLabel: Decline
   *   submitVariant: secondary
   * ```
   */
  submitVariant: Schema.optional(
    ButtonVariantSchema.annotate({
      description:
        "Visual weight of the auth form's submit button, from the platform button vocabulary (the same members a `button` component accepts). Omit for the primary 'default' fill, unchanged. Set 'secondary' for the lesser of two answers drawn side by side, such as declining an invitation beside accepting it. Applies to the forms drawn as fields plus a submit (credential methods, the second factor, invitations, account methods); ignored by `strategy: oauth`, `strategy: sso`, `strategy: passkey` and `method: registerPasskey`, which draw their own sign-in button.",
      examples: ['secondary', 'outline', 'destructive'],
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
        'Per-field label/placeholder overrides for the form this action embeds. Targets fields by name. Additive — the default fields are used when omitted.',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
  /**
   * Where a password sign-in sends an account that still owes its second step.
   *
   * Without it, a `login` form on an account with two-step on stays on its
   * page and says a code is needed, so the `verifyTwoFactor` form must sit on
   * that same page. With it, the form opens `navigate` instead — the usual
   * two-screen sign-in: the password first, then the code on its own page,
   * only for the accounts that have two-step on. The pending attempt goes with
   * the reader, and so does where the sign-in was headed: the code page's own
   * `onSuccess.navigate` wins when it names one, and the sign-in form's
   * destination applies otherwise. That destination is kept on the server
   * beside the attempt, never read from the code page's address.
   *
   * A path on this app, never a host, and with no query or fragment: the same
   * rule as `auth.loginPage`. Inert on every method but `login`.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: login
   *   strategy: email
   *   onSuccess: { navigate: /apps }
   *   onTwoFactor: { navigate: /two-step }
   * ```
   */
  onTwoFactor: Schema.optional(
    Schema.Struct({
      navigate: Schema.String.pipe(
        Schema.annotate({
          description:
            'Path of the page holding the `verifyTwoFactor` form. An app-relative path: it starts with a single / and carries no host, query or fragment.',
          examples: ['/two-step', '/sign-in/code'],
        }),
        // `makeFilter` first, then `isPattern`: the filter puts the refused
        // value in a message a person can act on, and the pattern keeps the
        // published JSON Schema `pattern` (as `auth.loginPage` does).
        Schema.check(
          Schema.makeFilter((value) =>
            LOGIN_PAGE_PATTERN.test(value)
              ? true
              : `onTwoFactor.navigate ${JSON.stringify(value)} must be a path on this app: it starts with a single / and carries no host, query, fragment or whitespace (e.g. "/two-step").`
          ),
          Schema.isPattern(LOGIN_PAGE_PATTERN)
        )
      ),
    }).annotate({
      description:
        'Where a `login` form sends an account that still owes its two-step code, instead of staying on the page with a message. The code page’s own `onSuccess.navigate` applies after the code, else this form’s. Inert on every other method.',
    })
  ),
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
  type: Schema.Literal('crud').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
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
        'Submit-button label for the form this action embeds. Defaults to the localized built-in label for the method or operation. Supports $t:key translation references.',
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
        'Per-field label/placeholder overrides for the form this action embeds. Targets fields by name. Additive — the default fields are used when omitted.',
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
  type: Schema.Literal('automation').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
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

/** @public */
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>
/** @public */
export type CrudAction = Schema.Schema.Type<typeof CrudActionSchema>
/** @public */
export type AutomationAction = Schema.Schema.Type<typeof AutomationActionSchema>
