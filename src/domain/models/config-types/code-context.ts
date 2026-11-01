/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sandbox context of a `code` action: `CodeContext` and the action surface
 * it carries, derived from the automation action schemas. Part of the public
 * `sovrium` type surface, re-exported by `src/index.ts`.
 */

import type { Action as AutomationActionUnion } from '@/domain/models/app/automations/actions'

/**
 * The action families callable from a `code` action body, DERIVED from the
 * automation action schemas rather than restated by hand.
 *
 * WHY DERIVED, AND WHY CLOSED
 * ---------------------------
 * `actions` is not an open index signature such as:
 *
 *   { ref: … } & Record<string, Record<string, (props?: Record<string, unknown>) => Promise<any>>>
 *
 * Two things would be wrong with it. `sovrium types` emits a `tsconfig.json`
 * setting `noUncheckedIndexedAccess: true`, and under that flag every
 * index-signature access gains `| undefined` — so the call the docs give,
 * `context.actions.http.request({…})`, would produce TS18048 + TS2722 against
 * the very tsconfig the same command wrote. And an open signature accepts
 * `context.actions.record.lst({})` — a typo for `list` — which then fails at
 * runtime with nothing having warned.
 *
 * A closed surface fixes both at once, and deriving it means the closed surface cannot
 * fall behind the schema the way a hand-written list would.
 *
 * `ref` is deliberately NOT part of this map: it is a reserved method on
 * `actions`, not a family, and `Exclude<…, 'ref'>` keeps the `ref` action type
 * (a declaration-time indirection, expanded before dispatch) out of the surface.
 *
 * WHAT THESE TYPES DO NOT PROMISE
 * -------------------------------
 * Most props are NOT validated against these schemas at runtime, so a wrong
 * prop is caught in the editor and nowhere else; treat these as authoring aids,
 * not as a runtime contract. The families whose handler is registered behind
 * `decodedHandler` (`action-handlers/decoded-handler.ts`) are the exception:
 * their props are decoded where the action is dispatched, and a call outside
 * the schema rejects naming the setting.
 *
 * TWO MEMBERS ARE TYPED BUT DO NOT WORK FROM A CODE BODY
 * ------------------------------------------------------
 * The surface describes what DISPATCH accepts, which is every registered
 * handler. Two of them are inert in this position, for one shared reason: the
 * dispatcher in `run/action-invokers.ts` hands a script only an action's
 * `output`, and these two act through the rest of the outcome.
 *
 *   - `filter.continue`   Silent no-op. Returns `{status:'filtered'}`, which the
 *                         dispatcher does not treat as failure, so it resolves
 *                         `undefined` and the halt never propagates.
 *   - `flow.stop`         Inert. Its effect rides in `responseOverride` /
 *                         `returnData`, both discarded by the dispatcher.
 *
 * They are NOT excluded from the type. Excluding them would mean a hand-kept
 * deny-list that silently goes stale the day one is fixed, and nothing can
 * mechanically prove "still broken". These are runtime defects; the fix belongs
 * in the sandbox context, not in a type that hides them.
 */
type ActionFamily = Exclude<AutomationActionUnion['type'], 'ref'>

type ActionMemberOf<T extends ActionFamily> = Extract<AutomationActionUnion, { readonly type: T }>

/**
 * `A` is a naked defaulted parameter so the conditional DISTRIBUTES over the
 * union — that is what collects every member's operator into one union, and what
 * flattens a member whose `operator` is itself a union (`http` declares one
 * schema member with `"post" | "put" | "patch"`, since the three share a shape).
 */
type ActionOperatorOf<T extends ActionFamily, A = ActionMemberOf<T>> = A extends {
  readonly operator: infer O
}
  ? O
  : never

/**
 * Reverse assignability on purpose: `O extends Op`, never
 * `Extract<…, { operator: O }>`. Extract fails on the merged `http` member
 * because `"post" | "put" | "patch"` is not assignable to `"post"`, which would
 * silently drop props for three real operators.
 */
type ActionPropsOf<T extends ActionFamily, O extends string, A = ActionMemberOf<T>> = A extends {
  readonly operator: infer Op
  readonly props: infer P
}
  ? O extends Op
    ? P
    : never
  : never

/**
 * `{} extends P` holds exactly when every prop of `P` is optional, so the
 * argument is optional for those operators (`context.actions.date.now()`) and
 * required for the rest (`context.actions.http.request()` is an error).
 */
export type CodeContextActions = {
  readonly [T in ActionFamily]: {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends P` is the all-props-optional test; Record<never, never> does not behave the same here
    readonly [O in ActionOperatorOf<T> & string]: {} extends ActionPropsOf<T, O>
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handler return shapes are per-operator and not modelled in the schema
        (props?: ActionPropsOf<T, O>) => Promise<any>
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same
        (props: ActionPropsOf<T, O>) => Promise<any>
  }
}

// `CodeContext` is an INTERFACE and must stay one. `build-types.ts` cannot extract it
// structurally: its loop only resolves `SymbolFlags.TypeAlias`, so `typeToString` on an
// interface prints the interface NAME and would emit `export type CodeContext =
// CodeContext` (TS2456). Declaring it as a type alias to force extraction is worse —
// `typeToString` emits no comments at all, which would strip the `log` warning below
// from every user's generated `sovrium.d.ts`. The emitter therefore hand-writes this
// text (see its `lines.push` block); `[internal ref]`
// keeps the copies honest.
//
// That check slices from the FIRST occurrence of the declaration keyword+name pair
// below, so no comment in this file may spell that pair literally — the slice would
// start in the comment and parse zero properties. This paragraph is deliberately
// worded around it; the first draft was not, and failed exactly that way.

/**
 * CodeContext - typed context object passed to every runTypescript code action.
 *
 * Operators MUST annotate their execute() parameter as CodeContext:
 *   async function execute(context: CodeContext) { ... }
 *
 * The TypeScriptValidator rejects any code action whose execute() declares a
 * first parameter without this annotation, so type errors on context.<key>
 * accesses surface at server startup instead of failing silently at request
 * time.
 *
 * Five properties: `inputData`, `actions`, `env`, `log`, `run`. The
 * trigger payload and prior step outputs are NOT exposed directly — every
 * value the code needs must be declared explicitly via the action's
 * `inputData` prop using `{{trigger.data.X}}` / `{{steps.Y.Z}}` template
 * references, resolved before the sandbox sees the data. This makes a
 * code action a pure function of its declared inputs.
 *
 * `actions` references reusable action templates declared at the schema
 * root (`app.actions[]`), NOT sibling steps in the same automation.
 * `context.actions.<templateName>(input)` invokes the named template,
 * substituting its `$vars` with the caller-supplied `input` shallow-
 * merged on top of declared variable defaults.
 *
 * `inputData` and the `actions` return type use `any` (not `unknown`):
 * they hold dynamic JSON / action-output shapes, and `unknown` would
 * force narrowing on every property access. `log` is strictly typed so
 * `context.log.debug()` (or any unknown method) fails type-checking at
 * startup.
 */
export interface CodeContext {
  /** Template-resolved key-value pairs declared in the action's inputData prop */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape, see interface JSDoc
  readonly inputData: Record<string, any>
  /**
   * Two-shape callable surface:
   * - `actions.ref('<templateName>', vars)` — invoke a template declared at app.actions[]
   * - `actions.<actionType>.<operator>(props)` — invoke a native action type directly (no template required)
   *
   * The reserved method `ref` disambiguates templates from native types;
   * a template named `ref` is rejected at schema validation.
   */
  readonly actions: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, functional/prefer-immutable-types -- dynamic return shape (templates return arbitrary handler output). No Readonly<> here: this interface is a hand-maintained MIRROR of the CodeContext text emitted by scripts/build/build-types.ts (and of CODE_CONTEXT_PRELUDE in src/infrastructure/automations/typescript-validator/layer.ts).
    readonly ref: (templateName: string, vars?: Record<string, unknown>) => Promise<any>
  } & CodeContextActions
  /** Environment variables (values redacted in logs when length >= 8) */
  readonly env: Record<string, string>
  /**
   * Structured logging — info/warn/error.
   *
   * NOT YET WIRED: all three methods currently DISCARD their arguments. The
   * sandbox is handed a no-op implementation, so `context.log.info(…)` emits
   * nothing — not to stdout, not to run history, not to the error tracker.
   * The surface is typed and stable so code actions can call it today and
   * start producing output when a real sink lands, without a rewrite; until
   * then, anything a code action must actually surface belongs in its return
   * value (which is persisted as the step output) or in a thrown error.
   */
  readonly log: {
    readonly info: (...args: ReadonlyArray<unknown>) => void
    readonly warn: (...args: ReadonlyArray<unknown>) => void
    readonly error: (...args: ReadonlyArray<unknown>) => void
  }
  /**
   * Run-scoped metadata. `attempt` is the 1-indexed retry attempt number —
   * 1 on the initial dispatch, 2 on the first retry, etc. Used by code
   * actions that want to short-circuit retry on a recoverable transient:
   * `if (context.run.attempt === 1) throw …`.
   */
  readonly run: {
    readonly attempt: number
  }
}
