/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The links write surface, for every caller that mutates a link.
 *
 * Import the programs from here rather than reaching into the modules: the
 * split between guards, campaign-parameter mapping and the programs themselves
 * is an internal arrangement, and a caller that depends on it is a caller that
 * breaks when it changes.
 */

export { configSlugs, declaredLink } from './config-slugs'
export {
  LinkMutationConflictError,
  LinkValueRejectedError,
  type LinkMutationConflictCode,
} from './errors'
export {
  createLink,
  deleteLink,
  updateLink,
  type CreateLinkCommand,
  type DeleteLinkResult,
  type UpdateLinkCommand,
} from './mutate-link'
export {
  mergeUtmPatch,
  utmPatchFromFlat,
  utmRecordFromFlat,
  UTM_FIELDS,
  type LinkUtmPatch,
  type UtmKey,
} from './utm'
