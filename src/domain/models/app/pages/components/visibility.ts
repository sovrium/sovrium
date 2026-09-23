/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  ConditionOperatorsSchema,
  FieldConditionSchema,
} from '@/domain/models/app/tables/condition-operators'
import { PageCapabilitySchema } from '../requires'

/**
 * The same predicate over a declared `page.query` property instead of a record
 * field.
 *
 * `name` rather than `field`, because the two address different things and a
 * reader seeing `field` would look for a record: this names a property of
 * `page.query`, whose value is read from the URL and CLAMPED to that property's
 * `enum` before any predicate runs.
 *
 * The OPERATORS are shared verbatim, for the reason {@link FieldConditionSchema}
 * gives for reusing them: one matcher, so a `visibility.query` and a
 * `visibility.record` written the same way cannot come to mean different things.
 * What the shared vocabulary does NOT bound is which of them make sense over a
 * closed set of strings — `gt` / `lt` / `gte` / `lte` compare numerically and a
 * declared `enum` holds strings, so a page-level rule refuses those four rather
 * than leaving them to match nothing forever.
 *
 * @example
 * ```yaml
 * visibility: { query: { name: mark, eq: example } }
 * visibility: { query: { name: period, in: [7d, 30d] } }
 * ```
 */
export const QueryConditionSchema = Schema.Struct({
  /** Declared `page.query` property whose resolved value the predicate is matched against */
  name: Schema.String.pipe(
    Schema.annotate({
      description:
        'Declared page.query property whose resolved value the visibility predicate is matched against',
      examples: ['mark', 'period'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  ...ConditionOperatorsSchema.fields,
}).annotate({
  title: 'Query Condition',
  description:
    'Predicate over a declared page.query property: the target renders only when the resolved URL value satisfies the operator(s). Reuses the shared condition vocabulary; omit to render for every value.',
})

/** @public */
export type QueryCondition = Schema.Schema.Type<typeof QueryConditionSchema>

/**
 * Powers a component may require of the CALLER — the authenticated person
 * asking for the page — as opposed to `page.requires`, which asks what the app
 * being served DECLARES.
 *
 * ─── WHY THIS IS NOT A ROLE LIST ───────────────────────────────────────────
 *
 * `visibility.roles` already gates on a role NAME, and it is the wrong
 * instrument twice over. It only CSS-hides (see the two strategies below), and
 * a name is not a power: whether `operator` may change another user's role
 * depends on `app.auth.roles[]` — the level it declares, whether a higher one
 * exists, whether the app renamed the built-ins — which is a computation over
 * the whole auth config, not a string comparison. Enumerating the names that
 * happen to satisfy it was measured on a partner-shaped app to share ZERO
 * members with the built-ins, so a hardcoded role list is not a degradation, it
 * is wrong.
 *
 * ─── WHY THE SET IS CLOSED ─────────────────────────────────────────────────
 *
 * Same argument as `PAGE_CAPABILITIES`: an open string is a config-time
 * expression language over a session, and a typo would be a permanently unmet
 * requirement with nothing anywhere saying why. A closed literal set makes it a
 * decode error naming every accepted value.
 *
 * Entry criterion, and it is what keeps the set small: a capability must be
 * decidable from the (session, app) pair by ONE pure predicate with no I/O. A
 * power needing a database read — "may edit THIS record" — would make a
 * component appear and disappear between two renders of the same page, which is
 * worse than one that is honestly absent. Row-level scoping is deliberately out
 * of reach for exactly that reason; page render has no seam for the round-trip
 * it would need.
 *
 * | Capability            | Predicate                                                                  |
 * | --------------------- | -------------------------------------------------------------------------- |
 * | `admin-console`       | `isAdminTier(session.role, app)` — may reach the operator console at all    |
 * | `administer-accounts` | `isAdminEquivalent(session.role, app)` — may create, ban and re-role users  |
 *
 * The two are genuinely different, which is why both are here: an
 * `admin-viewer` satisfies the first and not the second, reaches the console,
 * and is 404ed by the admin-route middleware on every account WRITE. A surface
 * painting Change-role for them would be painting a control the backend
 * refuses.
 *
 * @see src/domain/models/app/auth/roles/index.ts — `isAdminTier`, `isAdminEquivalent`
 * @see src/domain/models/app/pages/requires.ts — the app-side sibling
 */
export const CALLER_CAPABILITIES = ['admin-console', 'administer-accounts'] as const

/** One caller capability from the closed set. */
export const CallerCapabilitySchema = Schema.Literals([...CALLER_CAPABILITIES]).annotate({
  identifier: 'CallerCapability',
  title: 'Caller Capability',
  description: 'A power the requesting session must hold for the component to be rendered at all',
})

/** @public */
export type CallerCapability = Schema.Schema.Type<typeof CallerCapabilitySchema>

/**
 * Capabilities an app can DECLARE and still be UNABLE TO RUN on the deployment
 * serving it — the third subject, after the caller and the config.
 *
 * ─── WHY `declares` IS NOT ENOUGH FOR THIS SHAPE ───────────────────────────
 *
 * `declares` asks what the app DECLARES, and its purity is load-bearing: it is
 * what lets the gate run inside a synchronous render pass. It is also not
 * enough for one shape. An app declaring three agents on a host where
 * `AI_PROVIDER` is unset has declared AI and cannot run it, so
 * `declares: 'agents'` renders a composer whose only possible outcome is a
 * panel saying it is unavailable.
 *
 * The engine already draws this line. `collectAiProviderPhases` opens with
 * `if (!appRequiresAi(app) || isAiProviderConfigured(process.env)) return []` —
 * the "inert vs active" signal of [internal ref], and the source of the `AI disabled`
 * startup warning. This key surfaces that conjunction to config; it does not
 * invent one.
 *
 * | Capability | Predicate                                              |
 * | ---------- | ------------------------------------------------------ |
 * | `ai`       | `appRequiresAi(hostApp) && isAiProviderConfigured(env)` |
 *
 * ─── A CONJUNCTION, NOT AN ENV READ ────────────────────────────────────────
 *
 * An app declaring no AI surface at all gets the `unlessRuntime` half even on a
 * host with `AI_PROVIDER` set — there is nothing to run, and a composer bound
 * to no agent is as useless as one bound to an unreachable provider. So this
 * SUBSUMES `declares: 'agents'` for the shape rather than composing with it:
 * an author writes one key. `appRequiresAi` is in fact broader than
 * `declares: 'agents'` — it is also true for an `ai-*` compute field, an `ai`
 * automation action, or an `ai-chat` component anywhere in the tree — which is
 * the right breadth for "is there anything here that needs a model".
 *
 * ─── WHY A CLOSED SET AND NOT A BOOLEAN ────────────────────────────────────
 *
 * Same argument {@link CALLER_CAPABILITIES} makes: an open string is a
 * permanently unmet requirement with nothing anywhere saying why. A boolean
 * (`aiReady: false`) was refused twice over — it reads as a switch rather than
 * a predicate, and it does not generalise, since `appUsesStorage` and
 * `appRequiresEmail` already ship as the app halves of two further conjunctions
 * of exactly this shape.
 *
 * THE SET SHIPS WITH EXACTLY ONE MEMBER. `storage` and `email` are the reason
 * the set exists, not members of it: a member with no call site is the
 * inert-config class this schema already refuses in `unlessCapability`'s
 * docstring.
 *
 * ─── WHERE THE ENVIRONMENT ENTERS, AND WHERE IT MUST NOT ───────────────────
 *
 * The env half is resolved ONCE PER REQUEST at the filter-pipeline entry
 * (`applyPageComponentFilters`) and travels into the gate as a resolved list —
 * the same shape and the same reason as `grantedCapabilities`. It is
 * deliberately NOT a `page.requires` capability: `prunePagesByRequirements`
 * DROPS an unmet page, so an env-dependent registration would make a page
 * appear and disappear with an operator's `.env`, which is a routing table that
 * changes without a config change.
 *
 * @see src/presentation/render/resolve/runtime-capability-resolver.ts — the resolver
 * @see src/domain/models/app/requires-ai.ts — the app half
 * @see src/domain/models/process-env/ai/ai-providers.ts — the env half
 */
export const RUNTIME_CAPABILITIES = ['ai'] as const

/** One runtime capability from the closed set. */
export const RuntimeCapabilitySchema = Schema.Literals([...RUNTIME_CAPABILITIES]).annotate({
  identifier: 'RuntimeCapability',
  title: 'Runtime Capability',
  // POLARITY-NEUTRAL, for the reason `PageCapabilitySchema` states: this one
  // node serves both `runtime` and `unlessRuntime`, and it carries an
  // `identifier`, so a use-site annotation would fork its `$def`. The gate's
  // direction belongs to the key name; this says what the value NAMES.
  description:
    'A capability the host app both declares and can actually RUN on this deployment — declared in its config and supported by the environment the process is in',
})

/** @public */
export type RuntimeCapability = Schema.Schema.Type<typeof RuntimeCapabilitySchema>

/**
 * Visibility Schema
 *
 * Controls conditional visibility of components based on authentication state,
 * user roles, or field-based conditions. Components with visibility constraints
 * may be SSR-excluded (condition) or CSS-hidden (when/roles) when conditions
 * are not met.
 *
 * - `when`: Show only for authenticated or unauthenticated users
 * - `roles`: Show only for users with specific roles
 * - `condition`: Show based on a field value comparison (e.g., user plan or role)
 * - `record`: Show only on records whose named field satisfies a predicate —
 *   the PER-ROW gate, evaluated against the bound record rather than the session
 * - `query`: Show only while a declared `page.query` property resolves to a
 *   matching value — the URL-STATE gate, which is what lets two tabs under one
 *   path show two different bodies rather than both at once
 *
 * When both `when` and `roles` are specified, both conditions must be met
 * (AND logic).
 *
 * `condition` AND `record` LOOK ALIKE AND ASK DIFFERENT QUESTIONS. `condition`
 * resolves `$user.*` against the SESSION, once per request, before any row
 * exists — so inside a row template it is the same answer on every row.
 * `record` resolves a field of the BOUND RECORD, once per row, so a link can
 * appear on the two rows that need it and nowhere else. They compose: a
 * component may carry both, and both must pass.
 *
 * @example
 * ```yaml
 * # Show only to logged-in users
 * visibility:
 *   when: authenticated
 *
 * # Show only to guests (e.g., login CTA)
 * visibility:
 *   when: unauthenticated
 *
 * # Show only to admins
 * visibility:
 *   when: authenticated
 *   roles: ['admin']
 *
 * # Show to admins and editors
 * visibility:
 *   roles: ['admin', 'editor']
 *
 * # Show only to premium users (SSR-excluded when condition doesn't match)
 * visibility:
 *   condition:
 *     field: $user.plan
 *     operator: eq
 *     value: premium
 *
 * # Show to non-premium users
 * visibility:
 *   condition:
 *     field: $user.plan
 *     operator: neq
 *     value: premium
 *
 * # Inside a list/gallery/kanban row template: show the "Declare" link only on
 * # rows that have not been declared yet
 * visibility:
 *   record:
 *     field: declared
 *     eq: false
 *
 * # Same gate, set membership
 * visibility:
 *   record:
 *     field: status
 *     in: [expiring, expired]
 * ```
 */
export const VisibilitySchema = Schema.Struct({
  /** Authentication state condition */
  when: Schema.optional(
    Schema.Literals(['authenticated', 'unauthenticated']).annotate({
      description: "Show component only when user is 'authenticated' or 'unauthenticated'",
    })
  ),
  /** Role-based visibility filter */
  roles: Schema.optional(
    Schema.Array(
      Schema.String.annotate({ description: 'One role name that may see the component' })
    ).pipe(
      Schema.annotate({
        title: 'Visibility Roles',
        description: 'Show component only to users with one of these roles',
        examples: [['admin'], ['admin', 'editor']],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Power the requesting session must hold — SSR-EXCLUDED when it does not.
   *
   * ─── WHY IT SITS BESIDE `condition` RATHER THAN INSIDE IT ──────────────────
   *
   * `condition` is a `{ field, operator, value }` STRUCT, not a union, so
   * admitting a capability there would mean re-shaping a node the docs property
   * walker addresses by the identifier on its outermost node — the exact
   * re-keying hazard `page-binding-validation.ts` records. It would also need a
   * fake `field: '$caller.capability'` string, reintroducing the open-string
   * typo class the closed set above exists to prevent.
   *
   * As a sibling it composes with `when` and `roles` by AND, exactly as those
   * two already compose with each other.
   *
   * ─── EXCLUSION, NOT DISABLING (S1) ─────────────────────────────────────────
   *
   * An unmet capability removes the component from the SSR output entirely —
   * it never reaches the HTML. It shares that with `condition` and NOT with
   * `when` / `roles`, which render the component and inject `display: none`;
   * a CSS-hidden action column would ship every row action's endpoint to a
   * caller forbidden to call it, which is a disclosure, not a style. It is also
   * why an unmet capability renders NOTHING rather than a disabled control:
   * a greyed-out Change-role button advertises a power the backend will 404.
   *
   * Anonymous callers hold no capability, so a component gated on one is absent
   * for them without any `when: authenticated` beside it.
   *
   * @example
   * ```yaml
   * # An action column only an account administrator ever receives
   * - type: table
   *   visibility:
   *     capability: administer-accounts
   * ```
   */
  capability: Schema.optional(CallerCapabilitySchema),
  /**
   * Capability the HOST APP must declare — SSR-EXCLUDED when it does not.
   *
   * ─── THE OTHER SUBJECT ─────────────────────────────────────────────────────
   *
   * `capability` above asks what the CALLER may do. This asks what the app being
   * SERVED declares — the same question `page.requires` asks, one level down.
   * `PageCapabilitySchema` is reused verbatim rather than copied: one closed set,
   * one predicate table (`domain/models/app/pages/page-requires.ts`), so the two
   * levels can never drift into disagreeing about what "declares automations"
   * means.
   *
   * ─── WHY A COMPONENT-LEVEL COPY OF `page.requires` IS NOT REDUNDANT ────────
   *
   * `page.requires` is all-or-nothing: an unmet page is not registered and 404s.
   * That is right for a page that would be meaningless — an API-keys console on
   * an instance with no `auth.apiKeys`. It is wrong for a page that must still
   * be reachable and say something honest: an Automations directory on an app
   * declaring none is not a 404, it is a page with an empty state. Its own
   * docstring already names this escape hatch — "a page needing either of two
   * capabilities is two pages, or one page whose components carry their own
   * `visibility`" — and this is that key.
   *
   * ─── WHAT IT IS FOR: THE EMBEDDED CONSOLE ──────────────────────────────────
   *
   * Same argument as `page.requires`. In a standalone app the author already
   * knows what they declared, so this is close to a comment. In an EMBEDDED app
   * — a console mounted into an operator's app — the host's config is a fact the
   * embedded config cannot otherwise reach, and alternating a body on it is the
   * only way one authored page serves every operator.
   *
   * ─── SINGLE VALUE, NOT AN ARRAY ────────────────────────────────────────────
   *
   * `page.requires` is an array because a page may need several capabilities at
   * once. Here the neighbours in this same struct (`when`, `capability`) are each
   * one value, and ANDing several is already expressible by nesting containers.
   * No call site has wanted more than one.
   *
   * @example
   * ```yaml
   * # The run history, only on an app that declares automations
   * - type: table
   *   visibility:
   *     declares: automations
   * ```
   */
  declares: Schema.optional(PageCapabilitySchema),
  /**
   * The negation of {@link declares}: rendered ONLY when the host app does NOT
   * declare the named capability — the empty-state half of an alternating body.
   *
   * ─── WHY A SIBLING KEY RATHER THAN `declares: { not: … }` ──────────────────
   *
   * A union at `declares`' value position would re-shape a node the docs
   * property walker addresses by the identifier on its OUTERMOST node — the
   * re-keying hazard `page-binding-validation.ts` records for every rule it
   * holds, and the same reason `capability` sits beside `condition` rather than
   * inside it. A flat sibling changes no existing node.
   *
   * ─── WHY THIS POLARITY EXISTS AND `capability`'s DOES NOT ──────────────────
   *
   * An alternating body needs BOTH halves in one page: the catalog when
   * automations are declared, the empty state when they are not. There is no
   * such else-branch for a caller capability — a caller who lacks a power is
   * shown nothing, not something else — and the affordance that motivated one
   * (an action column withheld from a non-administrator) is now gated on the
   * COLUMN. A negation with no call site is the inert-config class this schema
   * refuses, so `unlessCapability` is deliberately NOT shipped.
   *
   * Declaring `declares` and `unlessDeclares` for the SAME capability on one
   * component is refused at decode (`collectPageBindingViolations`): it can
   * never render, which is the opposite of what its author wrote.
   *
   * @example
   * ```yaml
   * # The honest empty state, only on an app that declares none
   * - type: empty-state
   *   visibility:
   *     unlessDeclares: automations
   * ```
   */
  unlessDeclares: Schema.optional(PageCapabilitySchema),
  /**
   * Capability the host app must both DECLARE and be able to RUN here —
   * SSR-EXCLUDED when either half fails.
   *
   * ─── THE THIRD SUBJECT ─────────────────────────────────────────────────────
   *
   * `capability` asks what the CALLER may do. `declares` asks what the app being
   * SERVED declares. This asks whether that declaration can actually run on THIS
   * deployment: `appRequiresAi(hostApp) && isAiProviderConfigured(env)`.
   *
   * It is not a rephrasing of `declares`. On a host declaring an agent with no
   * `AI_PROVIDER`, `declares: 'agents'` renders and `runtime: 'ai'` does not —
   * and if the two ever agree, this key is a synonym and should be deleted
   * rather than documented.
   *
   * ─── WHAT THE EXISTING GRACEFUL DEGRADATION CANNOT DO ──────────────────────
   *
   * The shipped `ai-chat` renderer already degrades honestly: with no provider
   * it drops the island and draws a `role="status"` line saying so. That is a
   * component telling the truth about ITSELF, and it is correct. It cannot GIVE
   * WAY to a different component. The alternative to a composer is not a
   * disabled composer — it is the search trigger, a different control with a
   * different label, keyboard affordance and endpoint. No amount of degradation
   * inside `ai-chat` produces a `command-palette`.
   *
   * ─── ON A MOUNT THE APP HALF READS `hostApp` ───────────────────────────────
   *
   * A mounted console asking its own preset whether the operator declares AI
   * would answer about the console. The env half is process-wide and therefore
   * identical either way.
   *
   * @example
   * ```yaml
   * # The assistant composer, only where AI both is declared and can run
   * - type: ai-chat
   *   props: { agent: assistant }
   *   visibility:
   *     runtime: ai
   * ```
   */
  runtime: Schema.optional(RuntimeCapabilitySchema),
  /**
   * The negation of {@link runtime}: rendered ONLY when the named capability
   * CANNOT run here — the honest-alternative half of an alternating body.
   *
   * Both polarities exist for the reason {@link unlessDeclares} gives and
   * `unlessCapability` does not: an alternating body needs both halves in one
   * page — the composer where AI runs, the search where it does not — and both
   * halves are authored the moment this ships.
   *
   * Naming the SAME capability in both halves is refused at decode
   * (`collectPageBindingViolations`): AI either runs here or it does not, so the
   * component renders on no instance at all — the opposite of what its author
   * wrote, and invisible at runtime.
   *
   * @example
   * ```yaml
   * # The search hero, everywhere else
   * - type: command-palette
   *   visibility:
   *     unlessRuntime: ai
   * ```
   */
  unlessRuntime: Schema.optional(RuntimeCapabilitySchema),
  /** Field-based condition (SSR-excluded when condition doesn't match) */
  condition: Schema.optional(
    Schema.Struct({
      /** Field reference (e.g., $user.plan, $user.role) */
      field: Schema.String.annotate({
        description: 'Field reference to evaluate (e.g., $user.plan)',
      }),
      /** Comparison operator */
      operator: Schema.Literals(['eq', 'neq']).annotate({
        description: 'Comparison operator: eq (equals) or neq (not equals)',
      }),
      /** Value to compare against */
      value: Schema.String.annotate({
        description: 'Value to compare the field against',
      }),
    }).annotate({
      title: 'Visibility Condition',
      description: 'Field-based condition for SSR-excluded visibility',
    })
  ),
  /**
   * PER-ROW visibility: the component renders only on records whose named field
   * satisfies the predicate.
   *
   * Evaluated at ROW-EXPANSION time, server-side, against the record the row was
   * built from — the one moment the record exists and the component template has
   * not yet been rendered. A row that fails the predicate has the element
   * OMITTED from its HTML, not hidden with CSS: an unmet `visibility.record`
   * must not leave a link a reader can find in the source.
   *
   * It reuses `FieldConditionSchema` — the vocabulary a `table` action
   * item's `visibleWhen` and a `button` field's `visibleWhen` already spend —
   * rather than inventing a fourth spelling of "show this on some records and
   * not others". Same operators, same matcher (`satisfiesFieldCondition`), so
   * the three cannot drift.
   *
   * REFUSED AT DECODE outside a row context: a component with no record-binding
   * ancestor never has a record to test, so the predicate would be inert. That
   * rule lives in `collectPageBindingViolations` — it needs the component's
   * ANCESTRY, which a field schema cannot see.
   */
  record: Schema.optional(
    FieldConditionSchema.annotate({
      title: 'Record Visibility',
      description:
        'Per-row gate: render only on records whose `field` value satisfies the operator(s). Evaluated server-side at row expansion; a failing row omits the element entirely. Requires a record-binding ancestor.',
    })
  ),

  /**
   * URL-STATE visibility: the component renders only when a declared
   * `page.query` property currently resolves to a permitted value.
   *
   * ─── THE ASYMMETRY THIS CLOSES ─────────────────────────────────────────────
   *
   * A page can already ROUTE on the query string — `link.activeWhen` reads
   * `$query.<name>` to mark the current chip — and it can already SUBSTITUTE the
   * value into any string. What it cannot do is decide whether a block EXISTS
   * for the current value. So a page can draw two tabs, mark the right one, and
   * then has no way to show two different bodies under them: every body renders
   * at once, and the tabs mark a distinction the page does not make.
   *
   * The neighbouring predicates each read a different world and none reads this
   * one: `condition` reads `$user.*`, `record` reads the bound row, `capability`
   * and `declares` read the session and the host config. The URL's own state was
   * the gap.
   *
   * ─── EXCLUDED, AND RECURSIVELY ─────────────────────────────────────────────
   *
   * SSR-exclusion like `record` and `condition`, never a CSS hide: a body the
   * reader did not select must not be in the source, or an "only one of these is
   * shown" claim is false to anything that reads HTML — including the reader's
   * own find-in-page.
   *
   * Unlike `condition`, which is deliberately flat and gates top-level
   * components only, this gate RECURSES into `children`, on the reach
   * `applyCallerCapabilityGate` already has. A tabbed body is a block INSIDE the
   * panel that frames it, and a predicate that only reached the outermost
   * component could not express the one case it exists for.
   *
   * ─── WHY THE VALUES ARE CHECKED AT DECODE ──────────────────────────────────
   *
   * `page.query` CLAMPS: a URL value outside the declared `enum` resolves to
   * `default` and the page still answers 200. So a value here that is not a
   * member of that `enum` names a state the page can never be in — the block is
   * dead, permanently, and renders nowhere with nothing to see. That, the
   * undeclared property name, and the four numeric operators a closed set of
   * strings can never satisfy are all refused by `collectPageBindingViolations`,
   * which can see `page.query` where this field schema cannot.
   *
   * @example
   * ```yaml
   * query:
   *   mark: { default: config, enum: [config, example] }
   * components:
   *   - type: container
   *     visibility: { query: { name: mark, eq: example } }
   *     children: [...]
   * ```
   */
  query: Schema.optional(
    QueryConditionSchema.annotate({
      title: 'Query Visibility',
      description:
        'URL-state gate: render only when the named `page.query` property resolves to a value satisfying the operator(s). Evaluated server-side; a failing gate omits the component and its subtree entirely.',
    })
  ),
}).annotate({
  title: 'Visibility',
  description:
    'Conditional component visibility based on authentication state, user roles, a session field, or — inside a row template — the bound record',
})

/** @public */
export type Visibility = Schema.Schema.Type<typeof VisibilitySchema>
