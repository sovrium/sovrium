/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A resource Sovrium itself determined is absent.
 *
 * This is the counterpart to {@link DatabaseError}, and the split is the
 * whole point of this class. `DatabaseError` was a catch-all that meant
 * BOTH "the driver failed" and "the record isn't there"; because its name reads
 * as an auth/session concept, `isAuthorizationError` treated the driver half as
 * an authorization signal and answered 404 for infrastructure faults — telling
 * a caller a record they can plainly see does not exist, while handing the
 * operator a non-alerting 404 with the database on fire.
 *
 * Producing this tag is what lets a boundary answer 404 from a `_tag` instead
 * of from a substring match on prose. `sanitizeError`'s `case 'NotFoundError'`
 * already existed as a landing pad with no producer; this is its producer.
 *
 * Deliberately carries NO `cause`. An absent record is never a wrapped driver
 * failure — anything with a driver underneath it is a {@link DatabaseError}
 * and must stay an alertable 500. Keeping `cause` off this class means a 404
 * response can never carry SQL text (standing rule S4).
 *
 * @param recordId - the specific record that was absent, when the caller named
 *   one. Lets the batch-restore response identify it WITHOUT re-parsing the id
 *   back out of a formatted message.
 */
export class NotFoundError extends Error {
  readonly _tag = 'NotFoundError'
  readonly recordId?: string

  constructor(message: string, recordId?: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'NotFoundError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.recordId = recordId
  }
}
