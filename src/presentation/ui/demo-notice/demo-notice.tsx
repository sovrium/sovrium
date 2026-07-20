/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { getDemoNoticeDisplayConfig, type DemoNoticeDisplayConfig } from './demo-notice-config'
import { getDemoNoticeLabels, type DemoNoticeLabels } from './demo-notice-labels'

const DEMO_NOTICE_PREFILL_SCRIPT = `(function () {
  function findAuthForm() {
    var forms = document.querySelectorAll('form[data-action-type="auth"]');
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].querySelector('input[name="email"]') && forms[i].querySelector('input[name="password"]')) {
        return forms[i];
      }
    }
    return null;
  }
  if (!findAuthForm()) return;
  var btn = document.querySelector('[data-testid="demo-notice-prefill"]');
  if (!btn) return;
  btn.hidden = false;
  btn.addEventListener('click', function () {
    var form = findAuthForm();
    if (!form) return;
    var email = form.querySelector('input[name="email"]');
    var password = form.querySelector('input[name="password"]');
    function fill(input, value) {
      if (!input) return;
      input.value = value || '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    fill(email, btn.getAttribute('data-demo-email'));
    fill(password, btn.getAttribute('data-demo-password'));
    var submit = form.querySelector('button[type="submit"]');
    if (submit) submit.focus();
    else if (email) email.focus();
  });
})();`

function DemoNoticeSummary({ label }: { readonly label: string }): Readonly<ReactElement> {
  return (
    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 [&::-webkit-details-marker]:hidden">
      {label}
      {}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="h-3 w-3 transition-transform duration-150 group-open:rotate-180"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {}
        <path d="M3 7.5 6 4.5 9 7.5" />
      </svg>
    </summary>
  )
}

function DemoNoticeCredentials({
  credentials,
  labels,
}: {
  readonly credentials: NonNullable<DemoNoticeDisplayConfig['credentials']>
  readonly labels: DemoNoticeLabels
}): Readonly<ReactElement> {
  return (
    <div
      data-testid="demo-notice-credentials"
      className="mt-2"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span>{labels.credentialsLabel}</span>
        {}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
          {credentials.email}
        </code>
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
          {credentials.password}
        </code>
      </div>
      {}
      <button
        type="button"
        hidden
        data-testid="demo-notice-prefill"
        data-demo-email={credentials.email}
        data-demo-password={credentials.password}
        className="mt-1.5 rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        {labels.prefill}
      </button>
    </div>
  )
}

function DemoNoticePanel({
  config,
  labels,
}: {
  readonly config: DemoNoticeDisplayConfig
  readonly labels: DemoNoticeLabels
}): Readonly<ReactElement> {
  return (
    <div className="mb-2 hidden w-72 max-w-full rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600 shadow-sm group-open:block dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      {}
      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
        {labels.title(config.name)}
      </p>
      <p className="mt-1 text-xs leading-relaxed">{labels.body}</p>
      {config.credentials && (
        <DemoNoticeCredentials
          credentials={config.credentials}
          labels={labels}
        />
      )}
      {}
      {config.url && (
        <a
          href={config.url}
          target="_blank"
          rel="noopener"
          data-testid="demo-notice-cta"
          className="mt-1 -mb-1 inline-block py-1 font-medium text-neutral-600 underline underline-offset-2 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          {labels.cta}
        </a>
      )}
    </div>
  )
}

export function DemoNotice({
  lang,
}: {
  readonly lang?: string
}): Readonly<ReactElement> | null {
  const config = getDemoNoticeDisplayConfig()
  if (!config) return null

  const labels = getDemoNoticeLabels(lang)

  return (
    <>
      <details
        data-testid="demo-notice"
        open={true}
        className="group fixed bottom-3 left-3 z-40 flex w-fit max-w-[calc(100vw-1.5rem)] flex-col-reverse items-start print:hidden"
      >
        {}
        <DemoNoticeSummary label={labels.summary} />
        <DemoNoticePanel
          config={config}
          labels={labels}
        />
      </details>
      {}
      {config.credentials && (
        <script
          dangerouslySetInnerHTML={{ __html: DEMO_NOTICE_PREFILL_SCRIPT }}
        />
      )}
    </>
  )
}
