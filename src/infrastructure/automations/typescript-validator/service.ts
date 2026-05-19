/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'
import type { TSValidationError } from './errors'

export class TypeScriptValidator extends Context.Tag('TypeScriptValidator')<
  TypeScriptValidator,
  {
    readonly validateAll: (app: unknown) => Effect.Effect<void, TSValidationError>
  }
>() {}
