/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'APP-ATTACH-UPLOAD-001: should validate file size limit on upload',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with attachment field limited to 5MB
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_documents',
          name: 'documents',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_file',
              name: 'file',
              type: 'single-attachment',
              config: {
                maxSize: 5242880, // 5MB in bytes
              },
            },
          ],
        },
      ],
    })

    // WHEN: uploading file larger than 5MB
    const largeFile = Buffer.alloc(6 * 1024 * 1024) // 6MB
    const response = await request.post('/api/tables/tbl_documents/records', {
      headers: { Authorization: 'Bearer valid_token' },
      multipart: {
        fields: JSON.stringify({ name: 'Large Doc' }),
        file: {
          name: 'large.pdf',
          mimeType: 'application/pdf',
          buffer: largeFile,
        },
      },
    })

    // THEN: request rejected with 413 Payload Too Large
    expect(response.status()).toBe(413)
    const body = await response.json()
    expect(body.error).toBe('Payload Too Large')
    expect(body.message).toMatch(/exceeds maximum allowed size/i)
  }
)

test.fixme(
  'APP-ATTACH-UPLOAD-002: should validate file type restrictions',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with attachment field restricted to images only
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_gallery',
          name: 'gallery',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            {
              id: 'fld_image',
              name: 'image',
              type: 'single-attachment',
              config: {
                allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
              },
            },
          ],
        },
      ],
    })

    // WHEN: uploading PDF file to image-only field
    const pdfFile = Buffer.from('%PDF-1.4 sample')
    const response = await request.post('/api/tables/tbl_gallery/records', {
      headers: { Authorization: 'Bearer valid_token' },
      multipart: {
        fields: JSON.stringify({ title: 'My Image' }),
        file: {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          buffer: pdfFile,
        },
      },
    })

    // THEN: request rejected with 415 Unsupported Media Type
    expect(response.status()).toBe(415)
    const body = await response.json()
    expect(body.error).toBe('Unsupported Media Type')
    expect(body.message).toMatch(/file type not allowed/i)
  }
)

test.fixme(
  'APP-ATTACH-UPLOAD-003: should scan uploaded files for malware',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with attachment field and malware scanning enabled
    await startServerWithSchema({
      name: 'test-app',
      security: {
        malwareScan: {
          enabled: true,
          provider: 'clamav',
        },
      },
      tables: [
        {
          id: 'tbl_uploads',
          name: 'uploads',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_file', name: 'file', type: 'single-attachment' },
          ],
        },
      ],
    })

    // WHEN: uploading file containing EICAR test signature
    const eicarSignature = Buffer.from(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    )
    const response = await request.post('/api/tables/tbl_uploads/records', {
      headers: { Authorization: 'Bearer valid_token' },
      multipart: {
        fields: JSON.stringify({ name: 'Test File' }),
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: eicarSignature,
        },
      },
    })

    // THEN: request rejected with 422 Unprocessable Entity
    expect(response.status()).toBe(422)
    const body = await response.json()
    expect(body.error).toBe('Unprocessable Entity')
    expect(body.message).toMatch(/malware detected/i)
  }
)

test.fixme(
  'APP-ATTACH-REGRESSION: attachment upload validation works correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, request }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_files',
          name: 'files',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_attachment',
              name: 'attachment',
              type: 'single-attachment',
              config: {
                maxSize: 10485760, // 10MB
                allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
              },
            },
          ],
        },
      ],
    })

    const validFile = Buffer.from('valid image data')
    const response = await request.post('/api/tables/tbl_files/records', {
      headers: { Authorization: 'Bearer valid_token' },
      multipart: {
        fields: JSON.stringify({ name: 'Valid Upload' }),
        file: {
          name: 'image.jpg',
          mimeType: 'image/jpeg',
          buffer: validFile,
        },
      },
    })

    expect(response.status()).toBe(201)
  }
)
