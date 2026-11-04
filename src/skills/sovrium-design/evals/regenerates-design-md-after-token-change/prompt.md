---
name: regenerates-design-md-after-token-change
max_turns: 25
---

My Sovrium app's design agent reads DESIGN.md at the project root. I just changed the brand colour in config/design.yaml from #1f4e79 to #0f766e:

```yaml
colors:
  primary: '#0f766e'
  signature: '#6b7f5e'
```

The top of DESIGN.md still says the old colour, and I added a short roles list inside its Colors section that I want to keep:

```markdown
---
name: 'harbour-studio'
description: "A small design studio's client portal."
colors:
  primary: '#1f4e79'
  signature: '#6b7f5e'
---

<!-- sovrium:generated design-md. Regenerate with sovrium design-system --format design-md --output DESIGN.md. Write by hand only inside the sovrium:narrative blocks. -->

## Colors

<!-- sovrium:narrative:begin section="colors" -->

### Roles

- **Signature** marks one accent per viewport, never a fill.

<!-- sovrium:narrative:end -->
```

Update DESIGN.md so the agent sees the new colour. Tell me the exact commands.
