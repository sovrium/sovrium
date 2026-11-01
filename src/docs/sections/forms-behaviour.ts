/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  AntiSpamSchema,
  FormAccessSchema,
  FormAnalyticsSchema,
  FormAvailabilitySchema,
  FormDisplaySchema,
  FormEditAfterSubmitSchema,
  FormOnErrorSchema,
  FormOnSuccessSchema,
  FormSaveAndResumeSchema,
  FormStepSchema,
  GoToRuleSchema,
  RateLimitSchema,
  SuccessPageActionSchema,
} from '@/domain/models/app/forms'
import formAccessBody from '@/domain/models/app/forms/form-access.docs.md' with { type: 'file' }
import formAntiSpamBody from '@/domain/models/app/forms/form-anti-spam.docs.md' with { type: 'file' }
import formAvailabilityBody from '@/domain/models/app/forms/form-availability.docs.md' with { type: 'file' }
import formConditionalLogicBody from '@/domain/models/app/forms/form-conditional-logic.docs.md' with { type: 'file' }
import formDraftsAndEditsBody from '@/domain/models/app/forms/form-drafts-and-edits.docs.md' with { type: 'file' }
import formFileUploadsBody from '@/domain/models/app/forms/form-file-uploads.docs.md' with { type: 'file' }
import formMultiStepBody from '@/domain/models/app/forms/form-multi-step.docs.md' with { type: 'file' }
import formOnSuccessErrorBody from '@/domain/models/app/forms/form-on-success-error.docs.md' with { type: 'file' }
import formSubmissionsBody from '@/domain/models/app/forms/form-submissions.docs.md' with { type: 'file' }
import { VisibleWhenConditionSchema } from '@/domain/models/app/forms/visible-when'
import { defineArticle, defineSection } from './define'

/**
 * Form behaviour — the `form-logic` and `form-delivery` section manifests.
 *
 * Split from `./forms` (which keeps `forms` and `form-fields`) only to stay
 * under the file-size ceiling; `./registry` sorts every section by `order`,
 * so the published reading order does not depend on which file holds it.
 */
export const formLogic = defineSection({
  slug: 'form-logic',
  title: 'Form Logic',
  order: 4200,
  tab: 'forms',
  articles: [
    defineArticle({
      slug: 'form-conditional-logic',
      title: 'Form Conditional Logic',
      description:
        "Show or require form fields based on other fields' values with simple and compound AND/OR conditions.",
      keywords: [
        'sovrium',
        'forms',
        'conditional logic',
        'visibleWhen',
        'requiredWhen',
        'disabledWhen',
        'condition operator',
        'branching',
        'formRef',
      ],
      order: 4200,
      sidebarLabel: 'Conditional Logic',
      body: formConditionalLogicBody,
      documents: [VisibleWhenConditionSchema],
      stories: ['US-FORMS-CONDITIONAL-LOGIC'],
    }),
    defineArticle({
      slug: 'form-multi-step',
      title: 'Multi-Step Forms',
      description:
        'Multi-step and one-question form layouts — steps, navigation, branching, and per-form display overrides.',
      keywords: [
        'sovrium',
        'forms',
        'multi-step',
        'one-question',
        'steps',
        'branching',
        'goToWhen',
        'submitLabel',
        'display overrides',
      ],
      order: 4210,
      sidebarLabel: 'Multi-Step Forms',
      body: formMultiStepBody,
      documents: [FormStepSchema, GoToRuleSchema, FormDisplaySchema],
      stories: ['US-FORMS-DISPLAY', 'US-FORMS-MULTI-STEP', 'US-FORMS-ONE-QUESTION-AT-A-TIME'],
    }),
    defineArticle({
      slug: 'form-on-success-error',
      title: 'Form Success & Error Handling',
      description:
        'Decide what a submitter sees after the submission lands — a success page, a redirect, a reset, a toast — and what they see when it fails.',
      keywords: [
        'sovrium',
        'onSuccess',
        'onError',
        'success page',
        'form redirect',
        'form reset',
        'toast',
        'preserveFields',
        'submission template variables',
      ],
      order: 4230,
      sidebarLabel: 'Success & Error',
      body: formOnSuccessErrorBody,
      documents: [FormOnSuccessSchema, SuccessPageActionSchema, FormOnErrorSchema],
      stories: ['US-FORMS-ONSUCCESS-AND-ONERROR'],
    }),
  ],
})

export const formDelivery = defineSection({
  slug: 'form-delivery',
  title: 'Form Delivery',
  order: 4400,
  tab: 'forms',
  articles: [
    defineArticle({
      slug: 'form-submissions',
      title: 'Form Submissions',
      description:
        'How form submissions are stored — the dual-write form_submissions ledger, lifecycle status, and success/error handling.',
      keywords: [
        'sovrium',
        'form submissions',
        'form_submissions ledger',
        'storeSubmission',
        'dual-write',
        'onSuccess',
        'onError',
        'submission status',
      ],
      order: 4400,
      sidebarLabel: 'Submissions',
      body: formSubmissionsBody,
      documents: [],
      stories: ['US-FORMS-SUBMISSION-FIRES-RECORD-AUTOMATIONS', 'US-FORMS-SUBMISSION-STORAGE'],
    }),
    defineArticle({
      slug: 'form-file-uploads',
      title: 'Form File Uploads',
      description:
        'Attachment form fields backed by buckets — file pickers, drag-and-drop, accept filters, size limits, and the file metadata shape.',
      keywords: [
        'sovrium',
        'forms',
        'file uploads',
        'attachment',
        'single-attachment',
        'multiple-attachments',
        'buckets',
        'dropZone',
        'maxFileSize',
        'accept',
      ],
      order: 4410,
      sidebarLabel: 'File Uploads',
      body: formFileUploadsBody,
      documents: [],
      stories: ['US-FORMS-FILE-UPLOADS'],
    }),
    defineArticle({
      slug: 'form-access',
      title: 'Form Access Control',
      description:
        'Decide who may open and submit a form — everyone, any signed-in user, or named roles and groups — with the shared permission model.',
      keywords: [
        'sovrium',
        'form access',
        'access control',
        'require',
        'authenticated',
        'roles',
        'groups',
        'anti-enumeration',
        '401',
        '404',
        'redirectTo',
      ],
      order: 4420,
      sidebarLabel: 'Access Control',
      body: formAccessBody,
      documents: [FormAccessSchema],
      stories: ['US-FORMS-ACCESS-CONTROL'],
    }),
    defineArticle({
      slug: 'form-availability',
      title: 'Form Availability',
      description:
        'Open and close a form on a schedule, cap the number of submissions it accepts, and control what visitors see once it is closed.',
      keywords: [
        'sovrium',
        'form availability',
        'opensAt',
        'closesAt',
        'maxSubmissions',
        'submission cap',
        'closed form',
        'registration window',
        'closedPage',
      ],
      order: 4430,
      sidebarLabel: 'Availability',
      body: formAvailabilityBody,
      documents: [FormAvailabilitySchema],
      stories: ['US-FORMS-AVAILABILITY'],
    }),
    defineArticle({
      slug: 'form-anti-spam',
      title: 'Anti-Spam, Attribution & Analytics',
      description:
        "A form's submission hygiene: the antiSpam honeypot and rate limits, the per-form analytics opt-out, and how a submission is attributed.",
      keywords: [
        'sovrium',
        'form anti-spam',
        'honeypot',
        'rate limit',
        'perIp',
        'perForm',
        'submitter attribution',
        'form analytics opt-out',
      ],
      order: 4440,
      sidebarLabel: 'Anti-Spam & Attribution',
      body: formAntiSpamBody,
      documents: [AntiSpamSchema, RateLimitSchema, FormAnalyticsSchema],
      stories: ['US-FORMS-ANALYTICS-AND-RESPONSES', 'US-FORMS-ANTI-SPAM'],
    }),
    defineArticle({
      slug: 'form-drafts-and-edits',
      title: 'Form Drafts & Edits',
      description:
        'Let a submitter save a long form and finish it later from a link sent by email, and correct a submission they already sent within a time window.',
      keywords: [
        'sovrium',
        'save and resume',
        'save and continue later',
        'form draft',
        'resume link',
        'edit after submit',
        'edit link',
        'saveAndResume',
        'editAfterSubmit',
      ],
      order: 4450,
      sidebarLabel: 'Drafts & Edits',
      body: formDraftsAndEditsBody,
      documents: [FormSaveAndResumeSchema, FormEditAfterSubmitSchema],
      stories: [],
    }),
  ],
})
