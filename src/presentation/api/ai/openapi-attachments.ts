/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  chatAttachmentUploadQuerySchema,
  chatAttachmentUploadResponseSchema,
} from '@/domain/models/api/ai/chat'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonResponse,
  effectParameters,
  effectSchema,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const attachmentIdParam = Schema.Struct({
  attachmentId: Schema.String.annotate({ description: 'Attachment identifier' }),
})

/** Chat attachment route group. */
export const aiChatAttachmentGroup: StaticGroupSpec = {
  tag: 'AI',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/ai/chat/attachments',
      summary: 'Attach a file to a chat',
      description:
        'Stores a file in the bucket the chat names in its `attachments` block. The type is read from the file content, not from its name or declared type.',
      operationIdBase: 'postAiChatAttachment',
      parameters: effectParameters(chatAttachmentUploadQuerySchema, 'query'),
      request: {
        body: {
          content: {
            'multipart/form-data': {
              schema: effectSchema(
                Schema.Struct({
                  file: Schema.String.annotate({ description: 'The file to attach' }),
                })
              ),
            },
          },
        },
      },
      responses: {
        201: effectJsonResponse(chatAttachmentUploadResponseSchema, 'The stored file'),
        400: errorResponse('No file in the "file" field'),
        404: errorResponse('Not signed in, or no chat with that id takes attachments'),
        413: errorResponse('The file is larger than the chat accepts'),
        415: errorResponse('The file content is not a type the chat accepts'),
        429: errorResponse('Rate limit exceeded'),
        507: errorResponse('Storage quota exceeded'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/ai/chat/attachments/{attachmentId}',
      summary: 'Read a chat attachment',
      description: 'Returns the file to the person who uploaded it. Anyone else gets 404.',
      operationIdBase: 'getAiChatAttachment',
      parameters: effectParameters(attachmentIdParam, 'path'),
      responses: {
        200: {
          content: { 'application/octet-stream': { schema: effectSchema(Schema.String) } },
          description: 'File contents',
        },
        404: errorResponse('No attachment by that id belongs to the caller'),
      },
    },
  ],
}
