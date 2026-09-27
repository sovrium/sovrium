---
type: llm
weight: 2
criteria: |
  The agent inspects the rendered HTML or HTTP responses (curl or a browser snapshot) rather than only the config, checks that hreflang links are absolute and include x-default and the page itself, checks each language page's canonical points to itself, and notes that an unset BASE_URL can make hreflang relative.
---

The agent inspects the rendered HTML or HTTP responses (curl or a browser snapshot) rather than only the config, checks that hreflang links are absolute and include x-default and the page itself, checks each language page's canonical points to itself, and notes that an unset BASE_URL can make hreflang relative.
