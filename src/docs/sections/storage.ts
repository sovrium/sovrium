/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BucketPermissionsSchema, BucketSchema } from '@/domain/models/app/buckets'
import attachmentStorageBody from '@/domain/models/app/buckets/attachment-storage.docs.md' with { type: 'file' }
import bucketsBackendsBody from '@/domain/models/app/buckets/buckets-backends.docs.md' with { type: 'file' }
import bucketsOverviewBody from '@/domain/models/app/buckets/buckets-overview.docs.md' with { type: 'file' }
import bucketsPermissionsBody from '@/domain/models/app/buckets/buckets-permissions.docs.md' with { type: 'file' }
import fileLifecycleBody from '@/domain/models/app/buckets/file-lifecycle.docs.md' with { type: 'file' }
import fileOperationsBody from '@/domain/models/app/buckets/file-operations.docs.md' with { type: 'file' }
import fileSecurityBody from '@/domain/models/app/buckets/file-security.docs.md' with { type: 'file' }
import imageFormatsBody from '@/domain/models/app/buckets/image-formats.docs.md' with { type: 'file' }
import imagePresetsCachingBody from '@/domain/models/app/buckets/image-presets-caching.docs.md' with { type: 'file' }
import imageTransformsBody from '@/domain/models/app/buckets/image-transforms.docs.md' with { type: 'file' }
import signedUrlsDownloadBody from '@/domain/models/app/buckets/signed-urls-download.docs.md' with { type: 'file' }
import signedUrlsUploadBody from '@/domain/models/app/buckets/signed-urls-upload.docs.md' with { type: 'file' }
import signedUrlsBody from '@/domain/models/app/buckets/signed-urls.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const buckets = defineSection({
  slug: 'buckets',
  title: 'Buckets',
  order: 8000,
  tab: 'buckets',
  articles: [
    defineArticle({
      slug: 'buckets-overview',
      title: 'Buckets Overview',
      description:
        'Named storage containers for file uploads — the properties each bucket declares, public versus private visibility, and how several buckets coexist in one app.',
      keywords: [
        'sovrium',
        'buckets',
        'storage',
        'file uploads',
        'maxFileSize',
        'allowedMimeTypes',
        'public bucket',
        'default bucket',
      ],
      order: 8000,
      sidebarLabel: 'Buckets Overview',
      body: bucketsOverviewBody,
      documents: [BucketSchema],
      stories: ['US-BUCKETS-CONFIGURATION-SCHEMA-LIFECYCLE'],
    }),
    defineArticle({
      slug: 'buckets-backends',
      title: 'Storage Backends',
      description:
        'The three places Sovrium can put uploaded bytes — local filesystem, S3-compatible object storage, and PostgreSQL bytea — and the rule that picks one at boot.',
      keywords: [
        'sovrium',
        'storage backend',
        'STORAGE_PROVIDER',
        'S3',
        'MinIO',
        'bytea',
        'local filesystem',
        'STORAGE_S3_ENDPOINT',
        'STORAGE_LOCAL_DIRECTORY',
      ],
      order: 8010,
      sidebarLabel: 'Storage Backends',
      body: bucketsBackendsBody,
      documents: [],
      stories: ['US-BUCKETS-ADVANCED', 'US-BUCKETS-CONFIGURATION-PROVIDERS'],
    }),
    defineArticle({
      slug: 'buckets-permissions',
      title: 'Bucket Permissions',
      description:
        'The five per-operation access rules a bucket can declare — upload, download, sign, signUpload, delete — what each one gates, and what an omitted entry falls back to.',
      keywords: [
        'sovrium',
        'bucket permissions',
        'upload',
        'download',
        'sign',
        'signUpload',
        'delete',
        'RBAC',
        'PermissionValue',
        'authenticated',
      ],
      order: 8020,
      sidebarLabel: 'Bucket Permissions',
      body: bucketsPermissionsBody,
      documents: [BucketPermissionsSchema],
      stories: ['US-BUCKETS-CORE-OPERATIONS-004'],
    }),
  ],
})

export const files = defineSection({
  slug: 'files',
  title: 'Files',
  order: 8200,
  tab: 'buckets',
  articles: [
    defineArticle({
      slug: 'file-operations',
      title: 'File Operations',
      description:
        'The three endpoints every bucket exposes — upload a file, download it back, delete it — with the exact status code each outcome produces.',
      keywords: [
        'sovrium',
        'file operations',
        'upload',
        'download',
        'delete',
        'REST API',
        'multipart',
        'storage key',
        '413',
        '507',
      ],
      order: 8200,
      sidebarLabel: 'File Operations',
      body: fileOperationsBody,
      documents: [],
      stories: [
        'US-BUCKETS-CORE-OPERATIONS-001',
        'US-BUCKETS-CORE-OPERATIONS-003',
        'US-BUCKETS-CORE-OPERATIONS-005',
      ],
    }),
    defineArticle({
      slug: 'file-lifecycle',
      title: 'File Lifecycle & Quotas',
      description:
        'How long a stored file lives — its fate when the owning record is deleted, the per-file and total-storage caps, and the admin usage endpoint.',
      keywords: [
        'sovrium',
        'file lifecycle',
        'soft delete',
        'purge',
        'STORAGE_MAX_FILE_SIZE',
        'STORAGE_MAX_TOTAL_SIZE',
        'storage quota',
        'STORAGE_TEMP_CLEANUP_AFTER',
      ],
      order: 8210,
      sidebarLabel: 'Lifecycle & Quotas',
      body: fileLifecycleBody,
      documents: [],
      stories: ['US-BUCKETS-CORE-OPERATIONS-002'],
    }),
    defineArticle({
      slug: 'file-security',
      title: 'Upload Security',
      description:
        'What Sovrium validates server-side before storing a byte — filename rules, MIME allow-lists, size caps — and the headers every served file carries.',
      keywords: [
        'sovrium',
        'upload security',
        'path traversal',
        'null byte',
        'MIME allow-list',
        'allowedMimeTypes',
        'nosniff',
        'content-security-policy',
        'SVG XSS',
      ],
      order: 8220,
      sidebarLabel: 'Upload Security',
      body: fileSecurityBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'attachment-storage',
      title: 'Attachment Fields & Storage',
      description:
        "How a table's attachment field resolves to a bucket object — which bucket it writes to, what the column stores, and what the record API hands back.",
      keywords: [
        'sovrium',
        'attachment field',
        'single-attachment',
        'multiple-attachments',
        'bucket',
        'storage key',
        'signedUrl',
        'storeMetadata',
      ],
      order: 8230,
      sidebarLabel: 'Attachment Fields & Storage',
      body: attachmentStorageBody,
      documents: [],
      stories: [],
    }),
  ],
})

export const fileAccess = defineSection({
  slug: 'file-access',
  title: 'File Access',
  order: 8400,
  tab: 'buckets',
  articles: [
    defineArticle({
      slug: 'signed-urls',
      title: 'Signed URLs',
      description:
        'Why private files need a token instead of a session, how Sovrium mints one, and the four endpoints that make up the signing surface.',
      keywords: [
        'sovrium',
        'signed URLs',
        'presigned URLs',
        'HMAC-SHA256',
        'AUTH_SECRET',
        'STORAGE_PUBLIC_PATHS',
        'STORAGE_DEFAULT_ACCESS',
        'private files',
      ],
      order: 8400,
      sidebarLabel: 'Signed URLs',
      body: signedUrlsBody,
      documents: [],
      stories: [
        'US-BUCKETS-SIGNED-URLS-005',
        'US-BUCKETS-SIGNED-URLS-006',
        'US-BUCKETS-SIGNED-URLS-007',
        'US-BUCKETS-SIGNED-URLS-008',
        'US-BUCKETS-SIGNED-URLS-SVG-XSS',
      ],
    }),
    defineArticle({
      slug: 'signed-urls-download',
      title: 'Download URLs',
      description:
        'Mint a time-limited read token for one private file — the request body, the expiry window, and what happens at every failure point.',
      keywords: [
        'sovrium',
        'signed download URL',
        'expiresIn',
        'expiresAt',
        'token expiry',
        'private file download',
        'HMAC token',
      ],
      order: 8410,
      sidebarLabel: 'Download URLs',
      body: signedUrlsDownloadBody,
      documents: [],
      stories: ['US-BUCKETS-SIGNED-URLS-001', 'US-BUCKETS-SIGNED-URLS-002'],
    }),
    defineArticle({
      slug: 'signed-urls-upload',
      title: 'Upload & Batch Signing',
      description:
        'Let a browser PUT straight into storage with a constraint-bound write token, and mint up to 100 URLs in a single request.',
      keywords: [
        'sovrium',
        'signed upload URL',
        'direct upload',
        'PUT',
        'contentType',
        'maxSize',
        'batch signing',
        'sign/batch',
      ],
      order: 8420,
      sidebarLabel: 'Upload & Batch Signing',
      body: signedUrlsUploadBody,
      documents: [],
      stories: ['US-BUCKETS-SIGNED-URLS-003', 'US-BUCKETS-SIGNED-URLS-004'],
    }),
  ],
})

export const images = defineSection({
  slug: 'images',
  title: 'Images',
  order: 8600,
  tab: 'buckets',
  articles: [
    defineArticle({
      slug: 'image-transforms',
      title: 'Image Resize & Fit',
      description:
        'Resize a stored image from its URL — width, height, and the two fit modes that decide how a requested box and the source aspect ratio are reconciled.',
      keywords: [
        'sovrium',
        'image transform',
        'resize',
        'width',
        'height',
        'fit',
        'inside',
        'fill',
        'aspect ratio',
      ],
      order: 8600,
      sidebarLabel: 'Resize & Fit',
      body: imageTransformsBody,
      documents: [],
      stories: ['US-BUCKETS-IMAGE-TRANSFORMS-001', 'US-BUCKETS-IMAGE-TRANSFORMS-004'],
    }),
    defineArticle({
      slug: 'image-formats',
      title: 'Image Format & Quality',
      description:
        'Transcode a stored image on the way out — explicit formats, Accept-header negotiation, the origin opt-out, and the compression quality knob.',
      keywords: [
        'sovrium',
        'image format',
        'WebP',
        'JPEG',
        'PNG',
        'format negotiation',
        'Accept header',
        'quality',
        'image transcoding',
      ],
      order: 8610,
      sidebarLabel: 'Format & Quality',
      body: imageFormatsBody,
      documents: [],
      stories: ['US-BUCKETS-IMAGE-TRANSFORMS-002', 'US-BUCKETS-IMAGE-TRANSFORMS-003'],
    }),
    defineArticle({
      slug: 'image-presets-caching',
      title: 'Image Presets & Caching',
      description:
        'Name a transform once and request it by name, and understand the LRU cache, ETag revalidation, and the guarantee that originals are never rewritten.',
      keywords: [
        'sovrium',
        'transform presets',
        'STORAGE_TRANSFORM_PRESETS',
        'thumbnail',
        'cache',
        'ETag',
        'LRU',
        'STORAGE_TRANSFORM_CACHE_MAX_SIZE',
        'immutable',
      ],
      order: 8620,
      sidebarLabel: 'Presets & Caching',
      body: imagePresetsCachingBody,
      documents: [],
      stories: [
        'US-BUCKETS-IMAGE-TRANSFORMS-005',
        'US-BUCKETS-IMAGE-TRANSFORMS-006',
        'US-BUCKETS-IMAGE-TRANSFORMS-007',
      ],
    }),
  ],
})
