---
type: llm
weight: 2
criteria: |
  The answer (1) regenerates DESIGN.md with `sovrium design-system <config> --format design-md --output DESIGN.md` instead of editing the colour in the front matter by hand, (2) says the roles list survives because it sits inside the Colors narrative block, (3) does not edit `.impeccable/design.json` by hand, since the same command rewrites it, (4) leaves the surface briefs and PRODUCT.md as they are, since an export never replaces them, and (5) suggests running the command again whenever the design key changes, for example in a pre-commit hook or CI.
---

The answer (1) regenerates DESIGN.md with `sovrium design-system <config> --format design-md --output DESIGN.md` instead of editing the colour in the front matter by hand, (2) says the roles list survives because it sits inside the Colors narrative block, (3) does not edit `.impeccable/design.json` by hand, since the same command rewrites it, (4) leaves the surface briefs and PRODUCT.md as they are, since an export never replaces them, and (5) suggests running the command again whenever the design key changes, for example in a pre-commit hook or CI.
