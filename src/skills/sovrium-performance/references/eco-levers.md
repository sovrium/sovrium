# The eco levers

Sovrium is performance-first by default and frugal on request. The choices that are both smaller and faster — modern image encoding, the page cache, lazy islands — are built in with no switch. The choices that trade experience for footprint are the operator's, set in environment variables beside `DATABASE_URL` and `AI_PROVIDER`, and **never** in the app config: an app author cannot change the footprint posture for the people who use the app. Manual: `sovrium docs operations/ecoconception`, `sovrium docs configuration/env-vars-services`.

This file names each lever, the command that prints its accepted values and its default from the binary you run, and the class of decision it is. It quotes no default and no budget on purpose: read them from the binary, because they are what the binary does, and a remembered value is a guess.

## Contents

- [The levers](#the-levers)
- [Rules every lever follows](#rules-every-lever-follows)
- [Neighbouring operator variables](#neighbouring-operator-variables)
- [What is not a lever](#what-is-not-a-lever)

## The levers

| Variable                     | Class             | What it decides                                                                               | Read it with                                  |
| ---------------------------- | ----------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `ECO_MODE`                   | Posture           | The master posture; its strictest value also turns on the low-data default when that is unset | `sovrium docs env ECO_MODE`                   |
| `ECO_PAGE_CACHE`             | Rendering         | Whether anonymous page HTML is served from memory                                             | `sovrium docs env ECO_PAGE_CACHE`             |
| `ECO_PAGE_CACHE_MAX_MB`      | Memory            | The byte budget of that cache; least recently served pages are evicted past it                | `sovrium docs env ECO_PAGE_CACHE_MAX_MB`      |
| `ECO_INDEX_HEADER`           | Measurement       | Whether page responses carry the `X-Eco-Index` grade                                          | `sovrium docs env ECO_INDEX_HEADER`           |
| `ECO_LOW_DATA_DEFAULT`       | End-user fidelity | Whether visitors get lower-resolution variants, always or on their `Save-Data` hint           | `sovrium docs env ECO_LOW_DATA_DEFAULT`       |
| `ECO_DESIGN_LAYER`           | Design delivery   | Whether the design-token override layer is emitted, or inline defaults are used               | `sovrium docs env ECO_DESIGN_LAYER`           |
| `ECO_FORM_ANALYTICS`         | Data collection   | Whether form analytics events are recorded                                                    | `sovrium docs env ECO_FORM_ANALYTICS`         |
| `ECO_AI_PROVIDER_PRECEDENCE` | AI routing        | Whether AI calls prefer a local model, a cloud provider, or the local one only                | `sovrium docs env ECO_AI_PROVIDER_PRECEDENCE` |

How to use the table:

- **Before proposing a change**, print the lever and read its options, its default and the article that explains it. Propose the change to the operator with the measurement that motivates it.
- **The page cache levers** change what `X-Render-Cache` reports (`page-cache-and-rendering.md`); size the budget against the container's memory limit (`sovrium docs configuration/env-vars-hosting`).
- **Low-data mode** lowers fidelity and never blocks a feature: a chart or an editor still renders. [S10]
- **`ECO_DESIGN_LAYER`** touches how the app's `design` block reaches the page; weigh it with `sovrium-design` before turning the layer off, because the app's tokens ride in it.
- **`ECO_AI_PROVIDER_PRECEDENCE`** pairs with `AI_PROVIDER`; the health endpoint reports the precedence in force (`sovrium docs ai/ai-eco-routing`).

## Rules every lever follows

- **An unset variable keeps its documented default.** An instance that sets none boots exactly as it always did.
- **An unrecognised value refuses the boot**, naming the variable, the value and what it accepts — before the server binds a port, so a typo lands in the deploy log. Whitespace and letter case are forgiven.
- **One exception**: `ECO_AI_PROVIDER_PRECEDENCE` resolves an unrecognised value to its default silently, and matches case-sensitively. Confirm it on the health endpoint after a change.
- **Retired spellings stop the boot.** Old values of `ECO_MODE` are refused, not ignored; the ecoconception article gives the migration.

## Neighbouring operator variables

Not `ECO_*`, but the same class of decision — the operator's, in the environment:

| Variable                    | Decides                                                                            | Read it with                                 |
| --------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`              | SQLite (unset or `file:`) or PostgreSQL                                            | `sovrium docs env DATABASE_URL`              |
| `STORAGE_TRANSFORM_PRESETS` | Named image transforms pages request with `?preset=`                               | `sovrium docs env STORAGE_TRANSFORM_PRESETS` |
| `AI_PROVIDER`               | Which AI provider, if any, answers model calls                                     | `sovrium docs env AI_PROVIDER`               |
| `BASE_URL`                  | The public origin links are minted from, so pages need not read the request's host | `sovrium docs env BASE_URL`                  |

## What is not a lever

- **An `eco` key in the app config.** The schema has none and refuses one; the posture is never the app author's.
- **A per-instance image codec.** Transforms encode to WebP and no variable changes it; AVIF is refused with `400`.
- **A badge.** An "eco mode on" label with no measured figure is greenwashing. If the operator wants to show something, show the `X-Eco-Index` grade the server measured, and say what it grades: response bytes, nothing more. [S16]
- **A paid tier.** Every eco lever is free in self-hosted mode.
