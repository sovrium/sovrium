/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `stepper` — one task, split into ordered steps.
//
// Every drawing is the real component, and every one is LIVE: press Continue
// and the rail marks the step complete, moves the current marker and keeps the
// step in the address. That is how the complete state is shown — the schema has
// no key that opens a stepper part-way through, so a resting drawing of a
// finished step would be a picture the component cannot produce from config.
//
// ─── EACH DRAWING OWNS ITS STEP IDS ────────────────────────────────────────
//
// The current step lives in the address as `?step=<id>`, and every stepper on a
// page reads the same address. Each one only answers to ids of its own, so the
// ids are prefixed per drawing: moving one specimen leaves the others where
// they were.
//
// No drawing declares `onFinish`. The last button is drawn and runs nothing,
// which keeps the page free of a write path.

import type { PageComponent, TypePageBody } from './body-shape'

const body = (content: string) => ({
  type: 'text' as const,
  element: 'p',
  props: { className: 'text-foreground-subtle text-sm' },
  content,
})

interface Step {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly optional?: boolean
}

/** One stepper over the three steps of a project setup, ids prefixed by `key`. */
const projectSetup = (
  key: string,
  extra: Readonly<Record<string, unknown>>,
  optionalAt?: number
): PageComponent => {
  const steps: readonly Step[] = [
    { id: `${key}-details`, label: 'Details', description: 'Who the project is for' },
    { id: `${key}-billing`, label: 'Billing', description: 'Can wait' },
    { id: `${key}-review`, label: 'Review' },
  ]
  return {
    type: 'stepper',
    props: { id: `design-system-stepper-${key}`, className: 'w-full' },
    steps: steps.map((step, index) => (index === optionalAt ? { ...step, optional: true } : step)),
    finishLabel: 'Create project',
    children: [
      body('Name the project and its client.'),
      body('Add a billing contact, or skip and add one later.'),
      body('Check the details before the project is created.'),
    ],
    ...extra,
  } as PageComponent
}

const stepper: TypePageBody = {
  drawings: [
    // The resting form: step one current, the rest still to do. Continue moves
    // on, and the step just left is drawn complete.
    { label: 'current', children: [projectSetup('current', {})] },
    // The FIRST step optional, so the Skip it earns is visible at rest rather
    // than one Continue away.
    { label: 'optional', children: [projectSetup('optional', {}, 0)] },
  ],
  options: [
    {
      id: 'orientation',
      title: 'Orientation',
      configKey: 'stepper.orientation',
      drawings: [
        {
          label: 'orientation: horizontal',
          children: [projectSetup('horizontal', { orientation: 'horizontal' })],
        },
        {
          label: 'orientation: vertical',
          children: [projectSetup('vertical', { orientation: 'vertical' })],
        },
      ],
    },
    {
      id: 'linear',
      title: 'Linear',
      configKey: 'stepper.linear',
      drawings: [
        // `linear: false` turns each rail entry into a button, so the reader can
        // jump to any step rather than walk them in order.
        { label: 'linear: false', children: [projectSetup('free', { linear: false })] },
      ],
    },
  ],
}

export default stepper
