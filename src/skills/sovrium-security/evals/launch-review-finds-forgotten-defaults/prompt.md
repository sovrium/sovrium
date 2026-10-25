---
name: launch-review-finds-forgotten-defaults
max_turns: 25
---

Review ~/apps/portal before we launch it on https://portal.example.com. Here is what matters, from app.yaml and .env:

```yaml
name: portal
auth:
  strategies:
    - type: emailAndPassword
tables:
  - id: 1
    name: contracts
    fields:
      - { id: 1, name: title, type: single-line-text }
    permissions:
      read: authenticated
      create: authenticated
buckets:
  - name: contract-files
agents:
  - name: assistant
    role: admin
    systemPrompt: You answer partners' questions about their contracts.
    tools:
      tables: [contracts]
      actions: [record.list]
pages:
  - name: assistant
    path: /assistant
    components:
      - { type: ai-chat, agent: assistant }
```

```text
BASE_URL=http://localhost:3000
SOVRIUM_DEV_MODE=on
AI_PROVIDER=anthropic
AI_API_KEY=(the live key, set)
```

Partners are invited by us; nobody else should get in. What do you find, in what order?
