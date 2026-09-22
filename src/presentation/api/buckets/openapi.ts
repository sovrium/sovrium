/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonResponse,
  effectParameters,
  effectSchema,
} from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec } from '../openapi/route-spec'

/**
 * File-storage bucket routes — resource-scoped to `app.buckets`. Each
 * configured bucket expands into a concrete copy of every route below, tagged
 * `Bucket: <name>`. The `{filename}` segment is a storage key, not a resource.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const filenameParam = Schema.Struct({
  filename: Schema.String.annotate({ description: 'Storage object key' }),
})

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/buckets/{bucketName}/files/{filename}',
    summary: 'Download a file',
    description: 'Streams the raw file contents from the bucket as an attachment.',
    operationIdBase: 'downloadBucketFile',

    parameters: effectParameters(filenameParam, 'path'),
    responses: {
      200: {
        content: { 'application/octet-stream': { schema: effectSchema(Schema.String) } },
        description: 'File contents',
      },
      400: errorResponse('Missing filename'),
      401: errorResponse('Unauthorized (private bucket)'),
      404: errorResponse('Bucket or file not found'),
      500: errorResponse('Download failed'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/buckets/{bucketName}/files',
    summary: 'Upload a file',
    description: 'Uploads a file to the bucket via multipart form data.',
    operationIdBase: 'uploadBucketFile',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: effectSchema(
              Schema.Struct({
                file: Schema.String.annotate({ description: 'The file to upload' }),
              })
            ),
          },
        },
      },
    },
    responses: {
      201: effectJsonResponse(
        Schema.Struct({
          success: Schema.Literal(true),
          key: Schema.String.annotate({ description: 'Stored object key' }),
          size: Schema.Finite.annotate({ description: 'Stored byte count' }),
          mimeType: Schema.String,
          filename: Schema.String.annotate({ description: 'Original filename' }),
        }),
        'File uploaded'
      ),
      400: errorResponse('No file, invalid filename, or disallowed MIME type'),
      401: errorResponse('Unauthorized (private bucket)'),
      404: errorResponse('Bucket not found'),
      413: errorResponse('File exceeds the size limit'),
      500: errorResponse('Upload failed'),
      507: errorResponse('Storage quota exceeded'),
    },
  },
  {
    method: 'delete',
    pathTemplate: '/api/buckets/{bucketName}/files/{filename}',
    summary: 'Delete a file',
    description: 'Removes a file from the bucket.',
    operationIdBase: 'deleteBucketFile',

    parameters: effectParameters(filenameParam, 'path'),
    responses: {
      204: { description: 'File deleted (no content)' },
      400: errorResponse('Missing filename'),
      401: errorResponse('Unauthorized (private bucket)'),
      404: errorResponse('Bucket or file not found'),
      500: errorResponse('Delete failed'),
    },
  },
]

/** Bucket route group — resource-scoped to the configured buckets. */
export const bucketGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Bucket',
  genericTag: 'Buckets',
  genericTagDescription: 'File-storage bucket endpoints',
  collection: (app) => app.buckets ?? [],
  resourcePlaceholder: '{bucketName}',
  genericPlaceholder: '{bucketName}',
  genericParamName: 'bucketName',
  routes,
}
