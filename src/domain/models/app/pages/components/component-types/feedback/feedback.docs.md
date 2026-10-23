# Feedback Components

> Status and loading feedback — a determinate progress bar, circle or step rail, an indeterminate spinner, and shaped skeleton placeholders.

Three types say that something is happening. All accept the shared `props` bag plus the `visibility` and `responsive` modules.

```yaml
components:
  - type: progress
    progressValue: 60
    progressMax: 100
    showLabel: true
    size: sm
  - type: skeleton
    skeletonVariant: rectangular
    animate: true
```

## `progress`

A determinate indicator: how far along something is, as a bar, a circle or a named step rail. Reference: shadcn/ui Progress; the circle and the step rail are Sovrium's.

<!-- sovrium:options type:progress -->

Every key below is declared beside `type`, not inside `props` — the renderer reads them off the component and a spelling like `props.showLabel` is dropped in silence.

`progressVariant` chooses the shape. `circle` draws a ring with the percentage in the centre. `steps` draws a named step rail — the same rail a multi-step form draws — and takes its labels from `steps`, at least two of them, because one step is not a sequence.

**Under `progressVariant: steps`, `progressValue` changes meaning.** It is the 1-based current step rather than a percentage. A value of `2` on a four-step rail is the second step, not 2%.

`showLabel` displays the percentage; `size` picks a preset, so `sm` gives a thinner bar. The two keys `props` still owns are `label`, which names the bar for a screen reader, and `id`.

### A bar bound to records

A bar can count records instead of showing a written `progressValue`. It takes the binding a ratio KPI takes: a `dataSource`, and a `kpiAggregate` with `function: ratio` whose `numerator` and `denominator` each count the source's records matching their own filter, after the reader's read rules. `labelTemplate` replaces the bare percentage: `{numerator}`, `{denominator}` and `{percent}` are filled in. The bar reports the numerator as its value and the denominator as its maximum. A denominator of zero draws an empty bar and `0 of 0`, never an error. `progressValue` and `progressMax` are refused beside a `dataSource`, and a `kpiAggregate` other than `ratio` is refused, since a bar plots a share.

With `dataSource.mine` (see the data binding guide), a side can count only the records the reader has a row for, so each reader sees her own progress — here, the lessons of the course she has completed:

```yaml
- type: progress
  showLabel: true
  dataSource:
    table: lessons
    filter:
      - { field: course, operator: eq, value: $record.id }
    mine: { table: completions, link: lesson, user: member, as: done }
  kpiAggregate:
    function: ratio
    numerator: { filter: [{ field: done, operator: isNotEmpty }] }
    denominator: { filter: [{ field: id, operator: isNotEmpty }] }
  labelTemplate: '{numerator} of {denominator} completed'
```

## `spinner`

An indeterminate spinner for a short wait, where there is no progress to report. Reference: shadcn/ui Spinner.

`spinner` declares no options of its own — it is configured entirely through the open `props` bag. `props.size` picks a size preset, and `props.className` carries colour utilities. Anything else is passed through as an HTML attribute.

Reach for `skeleton` rather than `spinner` when you know the shape of what is loading: a placeholder that matches the eventual layout does not make the page jump when the content lands.

## `skeleton`

A shaped placeholder shown while content is fetching. Reference: shadcn/ui Skeleton.

<!-- sovrium:options type:skeleton -->

`skeletonVariant` picks the shape — `text`, `circular` or `rectangular` — and `skeletonWidth` and `skeletonHeight` take CSS lengths, so `200px` and `100%` are both valid. The pulse animation is on by default; `animate: false`, beside `type` rather than in `props`, turns it off — which is what a reader who has asked for reduced motion should get.
