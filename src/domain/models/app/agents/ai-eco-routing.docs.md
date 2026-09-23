# AI Eco Routing

> Routing inference local-first by default — the three precedence modes, how a route is resolved, and the one `ECO_*` variable that absorbs a typo instead of refusing the boot.

AI inference is one of the most resource-intensive operations a platform performs, so calls route **local-first**: when a local model is reachable it answers, and only when it is not does the call fall back to a configured cloud provider.

One operator variable controls it, never the app schema. Like every eco variable, its default is the eco-aligned setting: operators opt _out_, never in.

```bash
ECO_AI_PROVIDER_PRECEDENCE=local-first
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
```

## The three modes

| Value         | Behaviour                                                                           |
| ------------- | ----------------------------------------------------------------------------------- |
| `local-first` | The default. Prefer a reachable local model; fall back to cloud when it is not      |
| `cloud-first` | Use the cloud provider; use a local model only when no cloud provider is configured |
| `local-only`  | Local exclusively, with no cloud fallback at all                                    |

An unset, empty or **unrecognised** value resolves to `local-first`, and matching is case-sensitive, so a capitalised spelling is not recognised and falls back.

That makes this the exception among the eco variables: every other one refuses the boot rather than resolving a value it does not recognise. Because a typo here is absorbed rather than reported, confirm the precedence you meant is the one in force — the health endpoint reports it.

## How a route resolves

The resolver combines three inputs: the active precedence, whether a local endpoint is **configured**, and whether the runtime's reachability probe found it **usable**.

| Precedence    | Local usable | Cloud configured | Routes to |
| ------------- | ------------ | ---------------- | --------- |
| `local-first` | yes          | —                | local     |
| `local-first` | no           | yes              | cloud     |
| `local-first` | no           | no               | nothing   |
| `cloud-first` | —            | yes              | cloud     |
| `cloud-first` | yes          | no               | local     |
| `local-only`  | yes          | —                | local     |
| `local-only`  | no           | —                | nothing   |

### `local-only` refuses the boot, for an app that uses AI

The mode promises there is no cloud fallback, so an unreachable local model means an app declaring an AI surface can never serve one. Starting anyway would defer the failure to the first user who triggers it.

A configuration with **no** AI surface is unaffected and starts normally: a plain marketing site cannot be failed by a precedence it never consults, and one AI app and one static site should be able to share a host.

### Reachability is probed, not assumed

The runtime checks whether the configured local endpoint actually responds before routing to it. Under `local-first`, a local model that is **configured but unreachable** produces a fallback recorded with an operator-facing reason; one that was never configured falls back silently. The difference matters because only the first is a fault.

## Auditing the decision

The health endpoint reports the active routing under `ai`:

| Field              | Means                                                       |
| ------------------ | ----------------------------------------------------------- |
| `precedence`       | The active precedence value                                 |
| `resolvedProvider` | Where calls are actually routed, absent when AI is disabled |
| `ollamaReachable`  | Whether the local probe succeeded                           |
| `configured`       | The raw provider value                                      |
| `fallbackReason`   | Why the resolver fell back, present only on a fallback      |

That is what makes routing auditable: an operator can confirm whether a deployment is genuinely running on its local model, or quietly burning cloud tokens.

## Examples

```bash
ECO_AI_PROVIDER_PRECEDENCE=local-only
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL=llama3.1
```

```bash
ECO_AI_PROVIDER_PRECEDENCE=cloud-first
AI_PROVIDER=openai
OPENAI_API_KEY=...
AI_MODEL=gpt-4o
```
