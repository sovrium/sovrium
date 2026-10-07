/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every operator-environment lever that must be refused before anything is
 * built — as ONE effect, so that "the same validators, in the same order" is a fact
 * rather than a sentence two files both happen to say.
 *
 * `createServer` and `createRenderApp` open identically, and they must: a
 * posture flag (`SOVRIUM_ALLOW_INSECURE`, `SOVRIUM_ALLOW_PRIVATE_OUTBOUND`) set
 * to anything but `1`, `true` or empty, a malformed `STORAGE_TRANSFORM_PRESETS`, `STORAGE_PUBLIC_PATHS` /
 * `STORAGE_DEFAULT_ACCESS`, `ECO_*` or `MAP_TILES_URL` value has to refuse the command at the
 * top rather than surfacing on whichever request or page first touches that
 * lever. Half a served site and half an emitted one are equally bad, and the
 * parsers cannot tell which caller they are running for.
 *
 * Copied, that invariant drifts in one direction only and silently: another
 * validator added to the boot path would leave `sovrium build` accepting a
 * value `sovrium start` refuses, with no failing test — nothing asserts that
 * the two lists match, and a list is exactly the kind of thing a reviewer reads
 * as "already there". One name is what removes the question.
 *
 * Order is preserved rather than merely inherited: `Effect.all` over an array
 * is sequential, so the first malformed variable is the one the operator is
 * told about, and an entry added to the end cannot change what the
 * existing ones report. The posture flags go FIRST: a value an operator meant
 * as "off" is the refusal most worth reading before any other.
 *
 * The error channel is DECLARED rather than inferred, and the tags are
 * named rather than widened to `Error`. Inference was the original choice — an
 * operator reads these failures, no caller catches them by tag, and both
 * callers already absorb them under their own `| Error` arm — but it does not
 * survive declaration emit: an inferred channel mentioning `EcoEnvError` and
 * `StoragePublicAccessEnvError`, which their modules did not export, is a name
 * the `.d.ts` cannot write, so `tsc -p tsconfig.build.json` refused the release
 * build (TS4023) while `bun run typecheck` stayed green. Of the two repairs
 * that error left open, exporting the two classes keeps each `_tag` in the type
 * where widening to `Error` would have erased it.
 */

import { Effect } from 'effect'
import { validateEcoEnv, type EcoEnvError } from '@/infrastructure/server/validate-eco-env'
import {
  validateMapTilesEnv,
  type MapTilesEnvError,
} from '@/infrastructure/server/validate-map-tiles-env'
import {
  validatePostureFlagEnv,
  type PostureFlagEnvError,
} from '@/infrastructure/server/validate-posture-flag-env'
import {
  validateStoragePublicAccessEnv,
  type StoragePublicAccessEnvError,
} from '@/infrastructure/server/validate-storage-public-access-env'
import { validateTransformPresetEnv } from '@/infrastructure/server/validate-transform-preset-env'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'

export const validateOperatorEnv: Effect.Effect<
  void,
  | PostureFlagEnvError
  | TransformPresetError
  | StoragePublicAccessEnvError
  | EcoEnvError
  | MapTilesEnvError
> = Effect.all([
  validatePostureFlagEnv,
  validateTransformPresetEnv,
  validateStoragePublicAccessEnv,
  validateEcoEnv,
  validateMapTilesEnv,
]).pipe(Effect.asVoid)
