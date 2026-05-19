/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { type ResourceGroupSpec, type RouteSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const filenameParam = z.object({ filename: z.string().describe('Storage object key') })

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/buckets/{bucketName}/files/{filename}',
    summary: 'Download a file',
    description: 'Streams the raw file contents from the bucket as an attachment.',
    operationIdBase: 'downloadBucketFile',
    request: { params: filenameParam },
    responses: {
      200: {
        content: { 'application/octet-stream': { schema: z.string() } },
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
            schema: z.object({ file: z.string().describe('The file to upload') }),
          },
        },
      },
    },
    responses: {
      201: jsonResponse(
        z.object({
          success: z.literal(true),
          key: z.string().describe('Stored object key'),
          size: z.number().describe('Stored byte count'),
          mimeType: z.string(),
          filename: z.string().describe('Original filename'),
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
    request: { params: filenameParam },
    responses: {
      204: { description: 'File deleted (no content)' },
      400: errorResponse('Missing filename'),
      401: errorResponse('Unauthorized (private bucket)'),
      404: errorResponse('Bucket or file not found'),
      500: errorResponse('Delete failed'),
    },
  },
]

export const bucketGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Bucket',
  genericTag: 'buckets',
  genericTagDescription: 'File-storage bucket endpoints',
  collection: (app) => app.buckets ?? [],
  resourcePlaceholder: '{bucketName}',
  genericPlaceholder: '{bucketName}',
  genericParamName: 'bucketName',
  routes,
}
