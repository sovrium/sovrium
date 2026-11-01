/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live `AutomationScheduler`: one semaphore per automation and one cancellation
 * registry, built with the server runtime and gone with it.
 *
 * The state is built by the layer, not held by the module: the domain runtime
 * builds this layer once per server, so the run loop and the cancel endpoint
 * read the same instance, while a second server booted in the same process
 * (the E2E harness does) starts with empty queues, as after a real restart.
 *
 * Every slot is taken with `Effect.acquireRelease` and an interruptible
 * acquire: a run interrupted while it waits never takes the slot at all, and a
 * run interrupted after it took one gives it back as its scope closes. The
 * early give-back a finished run makes is the same release, guarded to run
 * once, so the scope's own release then does nothing.
 */

import { Effect, HashMap, Layer, Option, Ref, Semaphore } from 'effect'
import { AutomationScheduler } from '@/application/ports/services/automation-scheduler'

/** An automation's semaphore and the limit it was last sized to. */
interface AdmissionGate {
  readonly semaphore: Semaphore.Semaphore
  readonly limit: number
}

/** One registration of a run: its identity, and whether a cancel flagged it. */
interface Registration {
  readonly token: symbol
  readonly cancelled: boolean
}

/** An effect that runs `effect` the first time it is run, and does nothing after. */
const once = (effect: Effect.Effect<unknown>): Effect.Effect<Effect.Effect<void>> =>
  Ref.make(false).pipe(
    Effect.map((done) =>
      Ref.getAndSet(done, true).pipe(
        Effect.flatMap((already) => (already ? Effect.void : Effect.asVoid(effect)))
      )
    )
  )

/** Admission: the automation's gate, created on first use and re-sized when its limit changed. */
const admissionOver = (
  gates: Ref.Ref<HashMap.HashMap<string, AdmissionGate>>,
  waiters: Ref.Ref<HashMap.HashMap<string, number>>
) => {
  const shift = (automationName: string, by: number) =>
    Ref.update(waiters, (current) =>
      HashMap.set(
        current,
        automationName,
        (Option.getOrUndefined(HashMap.get(current, automationName)) ?? 0) + by
      )
    )
  /** Count the run among the waiters while `take` waits, however the wait ends. */
  const countedWhileWaiting =
    (automationName: string) =>
    <A>(take: Effect.Effect<A>): Effect.Effect<A> =>
      shift(automationName, 1).pipe(
        Effect.andThen(take),
        Effect.ensuring(shift(automationName, -1))
      )

  const gateFor = (automationName: string, limit: number) =>
    Ref.modify(gates, (current) => {
      const existing = Option.getOrUndefined(HashMap.get(current, automationName))
      const gate = existing ?? { semaphore: Semaphore.makeUnsafe(limit), limit }
      const sized = gate.limit === limit ? gate : { semaphore: gate.semaphore, limit }
      return [
        { gate: sized, resized: gate.limit !== limit },
        sized === existing ? current : HashMap.set(current, automationName, sized),
      ] as const
    }).pipe(
      Effect.tap(({ gate, resized }) => (resized ? gate.semaphore.resize(limit) : Effect.void)),
      Effect.map(({ gate }) => gate.semaphore)
    )

  return (automationName: string, limit: number) =>
    Effect.gen(function* () {
      const semaphore = yield* gateFor(automationName, limit)
      return yield* Effect.acquireRelease(
        semaphore.take(1).pipe(
          countedWhileWaiting(automationName),
          Effect.flatMap(() => once(semaphore.release(1)))
        ),
        (release) => release,
        // A run interrupted while it waits must be able to stop waiting.
        { interruptible: true }
      )
    }).pipe(
      Effect.withSpan('automations.scheduler.admit', {
        attributes: { 'automation.name': automationName },
      })
    )
}

/** Cancellation: the registry of the runs a cancel can still reach. */
const cancellationsOver = (registrations: Ref.Ref<HashMap.HashMap<string, Registration>>) => {
  /** Drop the run's registration if it is still `token`'s. */
  const dropRegistration = (runId: string, token: symbol) =>
    Ref.update(registrations, (current) =>
      Option.getOrUndefined(HashMap.get(current, runId))?.token === token
        ? HashMap.remove(current, runId)
        : current
    )

  /** Register `runId` for the caller's scope; `ifAbsent` refuses a run already held. */
  const register = (runId: string, ifAbsent: boolean) =>
    Effect.acquireRelease(
      Ref.modify(registrations, (current) => {
        if (ifAbsent && HashMap.has(current, runId)) return [undefined, current] as const
        const token = Symbol(runId)
        return [token, HashMap.set(current, runId, { token, cancelled: false })] as const
      }),
      (token) => (token === undefined ? Effect.void : dropRegistration(runId, token))
    ).pipe(
      Effect.map((token) => (token === undefined ? undefined : dropRegistration(runId, token))),
      Effect.withSpan('automations.scheduler.register-cancellation', {
        attributes: { 'automation.run_id': runId, 'automation.if_absent': ifAbsent },
      })
    )

  const registerCancellation = (runId: string) =>
    register(runId, false).pipe(Effect.map((drop) => drop ?? Effect.void))

  const registerCancellationIfAbsent = (runId: string) => register(runId, true)

  const signalCancellation = (runId: string) =>
    Ref.modify(registrations, (current) => {
      const registration = Option.getOrUndefined(HashMap.get(current, runId))
      return registration === undefined
        ? ([false, current] as const)
        : ([true, HashMap.set(current, runId, { ...registration, cancelled: true })] as const)
    }).pipe(
      Effect.withSpan('automations.scheduler.signal-cancellation', {
        attributes: { 'automation.run_id': runId },
      })
    )

  const isCancelled = (runId: string) =>
    Ref.get(registrations).pipe(
      Effect.map(
        (current) => Option.getOrUndefined(HashMap.get(current, runId))?.cancelled === true
      ),
      Effect.withSpan('automations.scheduler.is-cancelled', {
        attributes: { 'automation.run_id': runId },
      })
    )

  return { registerCancellation, registerCancellationIfAbsent, signalCancellation, isCancelled }
}

const makeAutomationScheduler = Effect.gen(function* () {
  const gates = yield* Ref.make(HashMap.empty<string, AdmissionGate>())
  const waiters = yield* Ref.make(HashMap.empty<string, number>())
  const registrations = yield* Ref.make(HashMap.empty<string, Registration>())
  return AutomationScheduler.of({
    admit: admissionOver(gates, waiters),
    waiting: (automationName) =>
      Ref.get(waiters).pipe(
        Effect.map((current) => Option.getOrUndefined(HashMap.get(current, automationName)) ?? 0)
      ),
    ...cancellationsOver(registrations),
  })
}).pipe(Effect.withSpan('automations.scheduler.make'))

export const AutomationSchedulerLive = Layer.effect(AutomationScheduler, makeAutomationScheduler)
