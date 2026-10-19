/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sentence the model — and, on a chat turn, the person reading it — is
 * handed for an agent action that ran and did not succeed.
 *
 * It names the action and its table, and at most the column the database
 * refused. It never carries the reason the action gave, which on a record
 * write is the database's own sentence and can quote the value it refused.
 * A value refused because it is already taken names no column: that reads
 * word for word like any refusal the database cannot pin on a column, so the
 * sentence never says whether a value exists in a row the reader may not see.
 *
 * A request an action sent that did not succeed says how, in words that hold
 * no value: the HTTP status the server answered with, or that it timed out,
 * that its host could not be resolved, that the connection or the certificate
 * failed, or that the address is not one the server may reach. Never the
 * body the server answered with, nor the error text of the network.
 *
 * An action the engine declined before running it, for a reason it wrote
 * itself (an action this surface does not offer), is handed that reason.
 *
 * The full reason stays with the operator: the run history of an automation
 * step, and the server log of every agent action.
 */

/** What a refused record write tells the agent path, besides its operator sentence. */
export interface RefusedWrite {
  /** The database refused a value because another row already holds it. */
  readonly unique: boolean
  /** The submitted column the database refused, when it can be told. */
  readonly column?: string | undefined
}

/** How a request an action sent did not succeed, holding no value. */
export type RequestFailure =
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'timeout' | 'dns' | 'connection' | 'tls' | 'blocked' }

/** What a failed action says of itself besides its operator sentence: nothing that holds a value. */
export interface ActionFailureFacts {
  /** Set when the action was a record write the database refused. */
  readonly refusedWrite?: RefusedWrite | undefined
  /** Set when the action sent a request that did not succeed. */
  readonly requestFailure?: RequestFailure | undefined
}

/** One failed agent action, as the agent path knows it. */
export interface AgentActionFailure extends ActionFailureFacts {
  /** The action called, e.g. `record.create`. */
  readonly action: string
  /** The table the call named, when it named one. */
  readonly table?: string | undefined
  /**
   * Why the action could not run here, when the engine said so in its own
   * words before running it — an action this surface does not offer. It names
   * the action and no value, so it is handed on as is.
   */
  readonly explanation?: string | undefined
}

/** The column a refusal may name: never one for a value already taken. */
const namedColumn = (refusedWrite: RefusedWrite | undefined): string | undefined =>
  refusedWrite === undefined || refusedWrite.unique ? undefined : refusedWrite.column

/** What each way a request fails is called, besides an HTTP status. */
const REQUEST_FAILURE_TEXT: Readonly<Record<Exclude<RequestFailure['kind'], 'http'>, string>> = {
  timeout: 'the request timed out',
  dns: 'the host name could not be resolved',
  connection: 'the connection to the server failed',
  tls: 'the certificate of the server is not trusted',
  blocked: 'the address is not one this server may reach',
}

/** An HTTP status, as only a status can read: a whole number from 100 to 599. */
const isHttpStatus = (status: number): boolean =>
  Number.isInteger(status) && status >= 100 && status <= 599

/** Why the action did not complete, when that can be said without a value. */
const reasonOf = (failure: AgentActionFailure): string | undefined => {
  const column = namedColumn(failure.refusedWrite)
  if (column !== undefined) return `the field "${column}" cannot hold the value given`
  const request = failure.requestFailure
  if (request === undefined) return undefined
  if (request.kind !== 'http') return REQUEST_FAILURE_TEXT[request.kind]
  return isHttpStatus(request.status)
    ? `the server answered with HTTP ${String(request.status)}`
    : undefined
}

/** The client-safe sentence for a failed agent action. */
export const agentActionFailureText = (failure: AgentActionFailure): string => {
  if (failure.explanation !== undefined) return `Error: ${failure.explanation}`
  const subject =
    failure.table === undefined
      ? `The action "${failure.action}"`
      : `The action "${failure.action}" on the table "${failure.table}"`
  const reason = reasonOf(failure)
  return reason === undefined
    ? `Error: ${subject} did not complete.`
    : `Error: ${subject} did not complete: ${reason}.`
}
