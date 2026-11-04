/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The fields of a table that its signing flows own.
 *
 * A flow writes its signers' `signature` fields from its links, and its
 * `output` fields (the signed file, the proof file and the status) as the
 * request moves on. A client never writes any of them: a signer field is
 * signed through the flow only, and an output field holds what the engine
 * wrote, whatever the client's permissions.
 *
 * Loose shapes on purpose: this reads only the names a flow declares.
 */

interface LooseFlow {
  readonly name?: string
  readonly table: string
  readonly document?: { readonly field: string } | undefined
  readonly signers: readonly { readonly field: string }[]
  readonly output: {
    readonly signedFile: string
    readonly proofFile: string
    readonly status?: string | undefined
  }
}

const flowsOn = (flows: readonly LooseFlow[] | undefined, tableName: string) =>
  (flows ?? []).filter((flow) => flow.table === tableName)

/** The `signature` fields of `tableName` a flow signs through its links. */
export const flowSignerFieldsOf = (
  flows: readonly LooseFlow[] | undefined,
  tableName: string
): readonly string[] =>
  flowsOn(flows, tableName).flatMap((flow) => flow.signers.map((signer) => signer.field))

/** The fields of `tableName` only the engine writes as a flow's request moves on. */
export const flowOutputFieldsOf = (
  flows: readonly LooseFlow[] | undefined,
  tableName: string
): readonly string[] =>
  flowsOn(flows, tableName).flatMap(({ output }) =>
    output.status === undefined
      ? [output.signedFile, output.proofFile]
      : [output.signedFile, output.proofFile, output.status]
  )

/** The single-attachment fields of `tableName` a flow freezes as its document, each with its flows. */
export const flowDocumentFieldsOf = (
  flows: readonly LooseFlow[] | undefined,
  tableName: string
): ReadonlyMap<string, readonly string[]> =>
  flowsOn(flows, tableName).reduce((byField, flow) => {
    const field = flow.document?.field
    if (field === undefined || flow.name === undefined) return byField
    return new Map([...byField, [field, [...(byField.get(field) ?? []), flow.name]]])
  }, new Map<string, readonly string[]>())
