# The AI Chat Component

> `ai-chat` — an embedded chat panel backed by one of the app's configured agents.

`ai-chat` is the only type in its category. It draws a chat panel wired to an agent the app declares, and accepts the shared `props` bag plus the `visibility` and `responsive` modules.

<!-- sovrium:options type:ai-chat -->

`agent` names an entry of `app.agents[]`; what the agent can do — its model, its tools, its memory, its approval rules — is configured there rather than here. `chatHeight` is the container height in pixels, `showHistory` loads the previous conversation on arrival, and `allowAttachments` lets a reader attach a file to a message.

```yaml
- type: ai-chat
  agent: support-assistant
  chatHeight: 480
  placeholder: 'Ask a question…'
  allowAttachments: true
```

## It degrades honestly where AI cannot run

An app may declare an agent on a deployment that has no AI provider configured. The renderer does not draw a broken composer in that case: it drops the island and renders a `role="status"` line saying that the assistant is unavailable here.

That is a component telling the truth about itself, and it is correct as far as it goes — but it cannot give way to a _different_ component. The alternative to a composer is not a disabled composer; it is usually a search trigger, which is a different control with a different label, keyboard affordance and endpoint.

The `visibility` module is what expresses that. `runtime: ai` renders the component only where AI is both declared by the app and able to run on this deployment, and `unlessRuntime: ai` renders its alternative everywhere else:

```yaml
- type: ai-chat
  agent: assistant
  visibility: { runtime: ai }
- type: command-palette
  visibility: { unlessRuntime: ai }
```

Naming the same capability in both halves on one component is refused when the config is decoded: AI either runs here or it does not, so the component would render on no instance at all — the opposite of what its author wrote, and invisible at runtime.
