---
type: llm
weight: 2
criteria: |
  The answer (1) treats the proposal as input and writes a `/pricing` page entry in the config built from existing Sovrium components (text, card or container, link or button), with no HTML, CSS or stylesheet file and no `<style>` block, (2) does not paste the proposal's literal colours, gradient, radius or shadow into the page, but uses the app's tokens and either drops the purple or points to the `sovrium-design` skill to add it to the `design` key as a token, (3) keeps the copy (both plans, both prices, the call to action), and (4) validates the config with `sovrium validate` afterwards.
---

The answer (1) treats the proposal as input and writes a `/pricing` page entry in the config built from existing Sovrium components (text, card or container, link or button), with no HTML, CSS or stylesheet file and no `<style>` block, (2) does not paste the proposal's literal colours, gradient, radius or shadow into the page, but uses the app's tokens and either drops the purple or points to the `sovrium-design` skill to add it to the `design` key as a token, (3) keeps the copy (both plans, both prices, the call to action), and (4) validates the config with `sovrium validate` afterwards.
