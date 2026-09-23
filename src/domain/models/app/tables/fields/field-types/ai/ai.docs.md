# AI Fields

> The seven AI field types — ai-generate, ai-summary, ai-categorize, ai-extract, ai-sentiment, ai-tag and ai-translate — that compute a value from other fields with a language model.

Seven field types compute their value with a language model from one or more `sourceFields`. All of them also accept the base field properties every field type shares.

| Type            | Produces                                                  |
| --------------- | --------------------------------------------------------- |
| `ai-generate`   | Free-form generated text from a prompt template.          |
| `ai-summary`    | A summary of the source fields.                           |
| `ai-categorize` | A single category chosen from a predefined list.          |
| `ai-extract`    | Structured data matching a JSON Schema.                   |
| `ai-sentiment`  | Sentiment analysis of the source text.                    |
| `ai-tag`        | Multiple tags chosen from an allow-list.                  |
| `ai-translate`  | A translation of one source field into a target language. |

Every one of them needs an AI provider configured. With none, the fields decode and the app boots — they simply never refine, which is the state the status below calls out.

## How a value resolves, and how to tell

An AI field resolves in two tiers. A deterministic value is computed locally and stored straight away, so the record is never left blank; a background refinement then replaces it with the model's answer.

**When the refinement never lands, the locally computed value stays.** It is plausible, well-formed content that reads exactly like a model result — so on its own, a value gives no clue which tier produced it. That is why every AI value carries a refinement status, and why a grid and a record drawer mark the two states that are not settled.

This is the property to hold on to before wiring an AI field into anything that decides something: the presence of a value is not evidence that a model produced it.

## `ai-generate`

Free-form text from a prompt template, where `{{fieldName}}` interpolates a source field.

<!-- sovrium:options AiGenerateFieldSchema -->

```yaml
- id: 1
  name: product_blurb
  type: ai-generate
  sourceFields: [name, features]
  prompt: 'Write a two-sentence blurb for {{name}}, highlighting {{features}}.'
  temperature: 0.4
```

## `ai-summary`

A summary of the source fields.

<!-- sovrium:options AiSummaryFieldSchema -->

```yaml
- { id: 2, name: summary, type: ai-summary, sourceFields: [transcript] }
```

## `ai-categorize`

One category from a predefined list. The list is enforced, so the field cannot invent a category outside it.

<!-- sovrium:options AiCategorizeFieldSchema -->

```yaml
- id: 3
  name: ticket_category
  type: ai-categorize
  sourceFields: [subject, body]
  categories: [billing, bug, feature-request, other]
```

## `ai-extract`

Structured data matching a JSON Schema, for pulling fields out of unstructured text.

<!-- sovrium:options AiExtractFieldSchema -->

```yaml
- id: 4
  name: invoice_data
  type: ai-extract
  sourceFields: [raw_text]
  schema: { type: object, properties: { total: { type: number } } }
```

## `ai-sentiment`

Sentiment of the source text.

<!-- sovrium:options AiSentimentFieldSchema -->

```yaml
- { id: 5, name: mood, type: ai-sentiment, sourceFields: [review] }
```

## `ai-tag`

Several tags from an allow-list — the multi-valued counterpart of `ai-categorize`.

<!-- sovrium:options AiTagFieldSchema -->

```yaml
- id: 6
  name: topics
  type: ai-tag
  sourceFields: [body]
  tags: [pricing, onboarding, performance, security]
```

## `ai-translate`

A translation of **exactly one** source field into a target language. The single-source rule is a property of the type rather than a limitation: concatenating two fields before translating produces a sentence that existed in no language.

<!-- sovrium:options AiTranslateFieldSchema -->

```yaml
- {
    id: 7,
    name: description_fr,
    type: ai-translate,
    sourceFields: [description],
    targetLanguage: fr,
  }
```
