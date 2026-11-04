/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A submission's files, in order: its signature answers authored first (the
 * drawing taken out of the body and stored as evidence), then every other
 * multipart file uploaded to its attachment field. A refused signature stops
 * the submission before any attachment is stored.
 */

import { Effect } from 'effect'
import { captureFormSignatures } from '@/application/use-cases/signatures/capture-form-signatures'
import { transformMultipartFiles } from './file-upload-handler'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

export const signThenUploadAnswers = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>,
  submitter?: { readonly userId: string }
) =>
  Effect.flatMap(captureFormSignatures(app, form, body, submitter), (signed) =>
    transformMultipartFiles(app, form, signed, submitter)
  )
