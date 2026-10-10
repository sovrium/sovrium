/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { literalOrWholeTemplate } from './instance-slug'

/**
 * A Sovrium release number: `<major>.<minor>.<patch>` and nothing else. A
 * pre-release or a moving name such as `latest` is not a runtime the host
 * installs, and the version names a directory of the engine store.
 */
export const INSTANCE_ENGINE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/

/** The version of one engine, literal or one whole template. */
export const InstanceEngineVersionSchema = literalOrWholeTemplate(
  INSTANCE_ENGINE_VERSION_PATTERN,
  'a release number <major>.<minor>.<patch>',
  'A Sovrium release number, <major>.<minor>.<patch> (no pre-release, no "latest"), or one whole {{template}} resolving to one. It names the directory <SOVRIUM_ENGINES_DIR>/<version>/ of the engine store'
)

/**
 * Instance Engine Install Action (type: instance, operator: engineInstall)
 *
 * Installs one Sovrium release into the engine store,
 * `<SOVRIUM_ENGINES_DIR>/<version>/sovrium` (mode 0555), so a release of a
 * supervised app can run on it. In order, stopping at the first failure with
 * nothing installed:
 *
 * 1. downloads `sovrium-<version>-<os>-<arch>.tar.gz`, its `.sha256` and its
 *    `.tar.gz.sig` from the GitHub release, over HTTPS and with a timeout;
 * 2. checks the archive against the published sha256;
 * 3. checks the detached Ed25519 signature against the release keys the
 *    running binary embeds — the check `sovrium update` runs;
 * 4. checks that the unpacked binary's `--version` prints `version`;
 * 5. renames the version's directory into place, under a per-version lock.
 *
 * A version already in the store is a no-op (`installed: false`).
 */
export const InstanceEngineInstallActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('engineInstall').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    version: InstanceEngineVersionSchema,
  }).annotate({
    description: 'The Sovrium release to install into the engine store.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceEngineInstallAction',
    title: 'Instance Engine Install Action',
    description:
      'Download a Sovrium release, verify its checksum, its release signature and its version, and install it into the engine store',
  })
)

/** @public */
export type InstanceEngineInstallAction = Schema.Schema.Type<
  typeof InstanceEngineInstallActionSchema
>
