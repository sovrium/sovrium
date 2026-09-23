# Run Sovrium AI locally with Ollama

> Power Sovrium's AI fields and agents with a local Ollama model — private, free, and the sovereignty-first default, set with two environment variables.

You want Sovrium's AI features — AI fields, agents, retrieval — to run on a model you host yourself, with no data leaving your server and no per-token bill.

## Point Sovrium at Ollama

Install and start Ollama, pull a model, then set the provider:

```bash
ollama pull llama3.1
export AI_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
sovrium start app.yaml
```

Local-first is the default posture — Sovrium routes AI calls through Ollama with no API key. Swap `AI_PROVIDER` to a cloud provider later without touching your config.

## Verify

Trigger any AI field or agent in your app; the request is served by your local model. With no provider configured, AI features boot inert rather than failing, and the startup banner says so.

## Next

- **AI Overview** — the AI fields, agents and retrieval that use this provider.
- **AI Providers** — the full provider precedence and cloud options.
- **AI Eco Routing** — the local-first routing that keeps inference on your hardware.
