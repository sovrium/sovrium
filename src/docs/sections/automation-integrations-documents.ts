/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DocumentActionSchema } from '@/domain/models/app/automations/actions/document'
import automationDocumentActionsBody from '@/domain/models/app/automations/actions/document-actions.docs.md' with { type: 'file' }
import { PdfActionSchema } from '@/domain/models/app/automations/actions/pdf'
import automationPdfActionsBody from '@/domain/models/app/automations/actions/pdf-actions.docs.md' with { type: 'file' }
import { defineArticle } from './define'
import type { DocArticle } from './define'

/**
 * The document-producing actions, as articles of the Integrations section.
 *
 * Generating documents and working on existing PDFs live in their own module
 * rather than in `automation-integrations.ts` because that file is at its
 * line ceiling. They stay part of Integrations, in their published order,
 * and the section assembles them by spread.
 */
export const documentActionArticles: readonly DocArticle[] = [
  defineArticle({
    slug: 'automation-document-actions',
    title: 'Document Actions',
    description:
      'Generate PDFs, images and Word documents from templates filled with run data, and workbooks from rows, into temporary storage or a record attachment.',
    keywords: [
      'sovrium',
      'automation document action',
      'generatePdf',
      'html to pdf',
      'generateImage',
      'svg to png',
      'generateDocx',
      'word template',
      'generateXlsx',
      'xlsx',
      'document template',
      'attachTo',
      'ifExists',
    ],
    order: 5414,
    sidebarLabel: 'Document Actions',
    body: automationDocumentActionsBody,
    documents: [DocumentActionSchema],
    stories: [
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-CONVERT',
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-GENERATE-DOCX',
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-GENERATE-IMAGE',
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-GENERATE-PDF',
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-GENERATE-XLSX',
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-OUTPUT',
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-SOCIAL-CARD',
      'US-AUTOMATIONS-ACTIONS-DOCUMENT-XLSX-TEMPLATE',
    ],
  }),
  defineArticle({
    slug: 'automation-pdf-actions',
    title: 'PDF Actions',
    description:
      'Merge, split and rearrange PDFs you already have, mark them with a watermark, a stamp or page numbers, fill their forms, read what they hold, or make one from pictures — all with no external engine.',
    keywords: [
      'sovrium',
      'automation pdf action',
      'merge pdf',
      'split pdf',
      'page ranges',
      'watermark pdf',
      'page numbers',
      'fill pdf form',
      'images to pdf',
      'pdf/merge',
    ],
    order: 5416,
    sidebarLabel: 'PDF Actions',
    body: automationPdfActionsBody,
    documents: [PdfActionSchema],
    stories: [
      'US-AUTOMATIONS-ACTIONS-PDF-MERGE',
      'US-AUTOMATIONS-ACTIONS-PDF-SPLIT',
      'US-AUTOMATIONS-ACTIONS-PDF-PAGES',
      'US-AUTOMATIONS-ACTIONS-PDF-WATERMARK',
      'US-AUTOMATIONS-ACTIONS-PDF-STAMP',
      'US-AUTOMATIONS-ACTIONS-PDF-FILL-FORM',
      'US-AUTOMATIONS-ACTIONS-PDF-INSPECT',
      'US-AUTOMATIONS-ACTIONS-PDF-FROM-IMAGES',
    ],
  }),
]
