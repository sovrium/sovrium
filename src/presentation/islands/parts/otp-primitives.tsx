/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui input-otp (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The one-time-code entry shadcn's `input-otp` is: input-otp's single real
 * `<input>` (it keeps the value, the autofill hint and the keyboard) drawn as
 * one box per character ([internal ref] D3). Departures: no `cn` (classes are joined)
 * and the separator's icon is inline SVG.
 */

import { OTPInput, OTPInputContext } from 'input-otp'
import { useContext, type ComponentProps, type ReactElement } from 'react'

const join = (...classes: ReadonlyArray<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ')

/** The control: one real input under the boxes. */
export function InputOTP({
  className,
  containerClassName,
  ...props
}: ComponentProps<typeof OTPInput> & { readonly containerClassName?: string }): ReactElement {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={join('flex items-center has-disabled:opacity-50', containerClassName)}
      spellCheck={false}
      className={join('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
}

/** A run of boxes drawn as one joined field. */
export function InputOTPGroup({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return (
    <div
      data-slot="input-otp-group"
      className={join(
        'has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 flex items-center rounded-lg has-aria-invalid:ring-3',
        className
      )}
      {...props}
    />
  )
}

const SLOT = [
  'relative flex size-8 items-center justify-center border-y border-r border-input text-sm transition-all outline-none',
  'first:rounded-l-lg first:border-l last:rounded-r-lg aria-invalid:border-destructive',
  'data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50',
  'data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20',
  'dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40',
].join(' ')

/** One box: the character typed at `index`, and the caret when it is next. */
export function InputOTPSlot({
  index,
  className,
  ...props
}: ComponentProps<'div'> & { readonly index: number }): ReactElement {
  const slot = useContext(OTPInputContext)?.slots[index]
  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot?.isActive}
      className={join(SLOT, className)}
      {...props}
    >
      {slot?.char}
      {slot?.hasFakeCaret === true && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  )
}

/** A rule between two groups of boxes. */
export function InputOTPSeparator(props: ComponentProps<'div'>): ReactElement {
  return (
    <div
      data-slot="input-otp-separator"
      className="flex items-center [&_svg:not([class*='size-'])]:size-4"
      role="separator"
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
      </svg>
    </div>
  )
}
