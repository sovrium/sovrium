// `timeline` — records placed on a line rather than listed.
//
// Two shapes under one name, and `dataSource` is what chooses between them. With
// one, the component reads rows and places each on its own date; without one, it
// draws the entries written into it. The first is what a record page uses; the
// second is for a sequence that is not data — a changelog, a process, a set of
// steps nobody stores.
//
// The bound drawings below read the platform's three specimen rows, which carry
// a start and an end date and belong to nobody. That is what lets a bound
// timeline be drawn on a console that binds no table of yours.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../systemSources'
import type { PageComponent, TypePageBody } from './_shape'

/**
 * One marker, sitting ON the rail rather than beside it.
 *
 * The row draws the rail as its own left border and then pads its content away
 * from it, so a marker placed as the first child landed a clear 16px to the
 * right of the line — three dots floating in the margin of a rail they were
 * meant to be on. `-ml-5` pulls the 8px dot back across the 16px padding and
 * the last 4px besides, which centres it on the line.
 *
 * The tone matters as much as the position: the default was `bg-border`, the
 * same value the rail itself is drawn in, so every marker but the current one
 * disappeared into the line it sat next to.
 */
const dot = (tone: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: `${tone} mt-1 -ml-5 size-2 shrink-0 rounded-full` },
    children: [],
  }) as PageComponent

const entry = (when: string, what: string, tone = 'bg-foreground-muted'): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex gap-3 border-l pb-4 pl-4 last:pb-0' },
    children: [
      dot(tone),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-0.5' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground text-sm' },
            content: what,
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle text-[11px]' },
            content: when,
          },
        ],
      },
    ],
  }) as PageComponent

const BOUND = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '3' },
  },
}

/**
 * The same bound timeline every time, with one key changed.
 *
 * ─── THE GANTT KEYS LIVE IN `props`, AND THAT IS NOT A SHORTCUT ────────────
 *
 * `timeline` declares exactly one configuration key of its own — `dataSource` —
 * and its presence is what turns the authored list into the record-bound Gantt.
 * Everything the Gantt then needs is read from `props`: the two date fields, the
 * label, the grouping, the colour, the zoom, the today marker.
 *
 * There IS a typed schema for those keys beside the component, left over from
 * the merge that folded `data-timeline` into this type, and it is dead code —
 * nothing imports it and no author can write it at the top level. What is live
 * is `props`, and the config validator knows it: the field-name registry checks
 * `props.startField`, `props.endField`, `props.labelField`, `props.groupBy` and
 * `props.colorField` against the bound table's declared fields, so a typo in one
 * is still caught.
 */
const bound = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'timeline' as const,
    props: Object.fromEntries(
      Object.entries({
        id,
        className: 'w-full',
        startField: 'startsAt',
        endField: 'endsAt',
        labelField: 'name',
        ...extra,
        // An `undefined` here is not the same as an absent key: the props bag
        // is decoded as a record of real values and refuses one, so a drawing
        // that wants a key GONE has to remove it rather than blank it.
      }).filter(([, value]) => value !== undefined)
    ),
    dataSource: BOUND,
  }) as PageComponent

/** Two labelled ends and the tie between them. */
const dependency = (from: string, to: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex items-center gap-3' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'bg-background-subtle rounded px-3 py-1.5' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground text-[11px]' },
            content: from,
          },
        ],
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle' },
        content: '→',
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'bg-background-subtle rounded px-3 py-1.5' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground text-[11px]' },
            content: to,
          },
        ],
      },
    ],
  }) as PageComponent

/** A bar being moved, and the outline of where it was. */
const ghost = (label: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-72 flex-col gap-1' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'border-border rounded-md border border-dashed px-3 py-1.5' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle text-[11px]' },
            content: 'was here',
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'bg-background-subtle ml-8 rounded-md px-3 py-1.5 shadow-md' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground text-[11px]' },
            content: label,
          },
        ],
      },
    ],
  }) as PageComponent

const timeline: TypePageBody = {
  drawings: [
    {
      label: 'authored events',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col' },
          children: [
            entry('14 Oct, 09:12', 'Deal moved to Proposal', 'bg-foreground'),
            entry('12 Oct, 16:40', 'Quote sent to Menuiserie Roux'),
            entry('09 Oct, 11:03', 'Deal created'),
          ],
        },
      ],
    },
    {
      label: 'vertical',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col' },
          children: [
            entry('02:14', 'Run finished', 'bg-foreground'),
            entry('02:14', 'Sent 3 emails'),
            entry('02:13', 'Run started'),
          ],
        },
      ],
    },
    {
      label: 'horizontal',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full items-start gap-6' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'border-border flex flex-1 flex-col gap-1 border-t pt-2' },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground text-sm' },
                  content: 'Created',
                },
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: '09 Oct',
                },
              ],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'border-border flex flex-1 flex-col gap-1 border-t pt-2' },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground text-sm' },
                  content: 'Quoted',
                },
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: '12 Oct',
                },
              ],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'border-foreground flex flex-1 flex-col gap-1 border-t-2 pt-2' },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground text-sm font-medium' },
                  content: 'Proposal',
                },
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: '14 Oct',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'range',
      title: 'Range',
      configKey: 'timeline.startField | endField',
      drawings: [
        {
          label: 'startField + endField',
          children: [bound('tl-range-both')],
        },
        {
          label: 'startField only',
          children: [bound('tl-range-start', { endField: undefined })],
        },
      ],
    },
    {
      id: 'label',
      title: 'Label',
      configKey: 'timeline.labelField',
      drawings: [
        { label: "labelField: 'name'", children: [bound('tl-label-name')] },
        {
          label: "labelField: 'role'",
          children: [bound('tl-label-role', { labelField: 'role' })],
        },
      ],
    },
    {
      id: 'swimlanes',
      title: 'Swimlanes',
      configKey: 'timeline.groupBy',
      drawings: [
        {
          label: "groupBy: 'status'",
          children: [bound('tl-lanes-status', { groupBy: 'status' })],
        },
      ],
    },
    {
      id: 'colour',
      title: 'Colour',
      configKey: 'timeline.colorField',
      drawings: [
        {
          label: "colorField: 'priority'",
          children: [bound('tl-colour', { colorField: 'priority' })],
        },
      ],
    },
    {
      id: 'zoom',
      title: 'Zoom',
      configKey: 'props.defaultZoom',
      drawings: [
        {
          label: "defaultZoom: 'week'",
          children: [bound('tl-zoom-week', { defaultZoom: 'week' })],
        },
      ],
    },
    {
      id: 'today',
      title: 'Today',
      configKey: 'timeline.showToday',
      drawings: [
        {
          label: 'showToday: true',
          children: [bound('tl-today-on', { showToday: true })],
        },
        {
          label: 'showToday: false',
          children: [bound('tl-today-off', { showToday: false })],
        },
      ],
    },
    {
      id: 'dependencies',
      title: 'Dependencies',
      configKey: 'timeline.showDependencies | dependencyField',
      drawings: [
        {
          label: "type: 'FS' — finish to start",
          children: [dependency('A ends', 'B starts')],
        },
        {
          label: "type: 'SS' — start to start",
          children: [dependency('A starts', 'B starts')],
        },
        {
          label: "type: 'FF' — finish to finish",
          children: [dependency('A ends', 'B ends')],
        },
        {
          label: "type: 'SF' — start to finish",
          children: [dependency('A starts', 'B ends')],
        },
      ],
    },
    {
      id: 'editing',
      title: 'Editing',
      configKey: 'timeline.draggable | resizable',
      drawings: [
        {
          label: 'draggable: true · resizable: true',
          children: [bound('tl-edit', { draggable: true, resizable: true })],
        },
        {
          label: 'dragging',
          children: [ghost('Ada Lovelace')],
        },
      ],
    },
  ],
}

export default timeline
