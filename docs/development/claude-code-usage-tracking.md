# Claude Code Max Subscription Usage Tracking

## Overview

This guide explains how to track Claude Code usage for your Max subscription without requiring OAuth API access with `user:profile` scope.

**Key Advantage**: Works with `user:inference` scope (the default CI token scope) by parsing Claude Code CLI output from GitHub Actions logs instead of calling the OAuth usage API.

## Why This Approach?

### The Problem

- Claude Code OAuth usage API (`https://api.anthropic.com/api/oauth/usage`) requires `user:profile` scope
- CI tokens generated with `claude setup-token` only get `user:inference` scope
- This is intentional - CI tokens are restricted for security

### The Solution

- Claude Code CLI outputs token usage in its logs: `"Usage: 1,234 input tokens, 567 output tokens"`
- GitHub Actions captures these logs automatically
- We parse logs to track usage WITHOUT needing the OAuth API
- Works with `user:inference` scope (no API call needed)
- **Blocking checks** can prevent expensive operations before they run

## Blocking Behavior (Fail-Closed)

### Overview

TDD automation workflows implement **fail-closed blocking** based on historical cost data:

| Threshold        | Value  | Description                                  |
| ---------------- | ------ | -------------------------------------------- |
| **Daily Limit**  | $15.00 | 15% of estimated ~$100/week Max subscription |
| **Weekly Limit** | $90.00 | 90% of weekly allocation (10% buffer)        |

### When Blocking Occurs

The system blocks Claude Code execution when:

1. **Daily cost exceeds $15.00**: Too many runs in the last 24 hours
2. **Weekly cost exceeds $90.00**: Approaching weekly subscription limit
3. **Data unavailable**: Cannot verify usage (fail-closed for safety)

### Workflows with Blocking

| Workflow           | Blocking Behavior            |
| ------------------ | ---------------------------- |
| `tdd-dispatch.yml` | Blocks queue processing      |
| `tdd-execute.yml`  | Blocks Claude Code execution |
| `tdd-refactor.yml` | Skips scheduled refactor     |

### CI Integration

Use the `--check` flag for CI blocking mode:

```bash
# Returns exit code 0 if within limits, exit code 1 if exceeded or data unavailable
bun run scripts/tdd-automation/check-claude-code-usage.ts --check
```

The script sets GitHub Actions outputs:

- `can_proceed`: `true` or `false`
- `daily_cost`: Dollar amount (e.g., `$12.34`)
- `weekly_cost`: Dollar amount (e.g., `$78.90`)
- `reason`: `within_limits`, `daily_exceeded`, `weekly_exceeded`, or `data_unavailable`

### Environment Variables

Configure limits via environment variables:

```bash
# In GitHub Actions workflow
env:
  TDD_DAILY_COST_LIMIT: '15.00'   # Default: $15.00
  TDD_WEEKLY_COST_LIMIT: '90.00'  # Default: $90.00
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Example Workflow Step

```yaml
- name: Check usage limits (blocking)
  id: usage
  run: |
    if bun run scripts/tdd-automation/check-claude-code-usage.ts --check; then
      echo "can_proceed=true" >> $GITHUB_OUTPUT
    else
      echo "can_proceed=false" >> $GITHUB_OUTPUT
    fi
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TDD_DAILY_COST_LIMIT: '15.00'
    TDD_WEEKLY_COST_LIMIT: '90.00'

- name: Run Claude Code
  if: steps.usage.outputs.can_proceed == 'true'
  # ... Claude Code execution
```

## Setup

### 1. Set GitHub Token

The usage analyzer uses Octokit to fetch workflow data via the GitHub API:

```bash
# Set token as environment variable (GH_TOKEN or GITHUB_TOKEN)
export GH_TOKEN=ghp_your_token_here

# Generate a token at: https://github.com/settings/tokens
# Required scopes: repo (for accessing workflow runs and logs)
```

### 2. Run Usage Analysis

```bash
# Analyze last 7 days (default)
bun run tdd:usage

# Analyze last 7 days (explicit)
bun run tdd:usage:7d

# Analyze last 30 days
bun run tdd:usage:30d

# Run script directly with options
bun run scripts/tdd-automation/check-claude-code-usage.ts --days 14
```

### 3. Available Options

```bash
# Show help
bun run scripts/tdd-automation/check-claude-code-usage.ts --help

# Options:
#   --check        CI blocking mode - exit 1 if limits exceeded
#   --days N       Number of days to analyze (default: 7, max: 90)
#   --warn N       Warn if projected usage exceeds N% (default: 80)
#   --json         Output as JSON (useful for scripting)
#   --help, -h     Show help message
```

## Usage Report

The analyzer outputs a comprehensive report:

```
===================================================
  CLAUDE CODE USAGE REPORT (TDD Automation)
===================================================

Period: Last 7 days
Total runs: 38
Total tokens: 2,345,678
   Input:  1,234,567 (52.6%)
   Output: 1,111,111 (47.4%)
Total cost: $42.18
Average per run: 61,728 tokens ($1.11)

USAGE BREAKDOWN
   Today (last 24h):
     Runs: 6
     Cost: $7.23 / $15.00 (48.2% of daily limit)

   This week (last 7d):
     Runs: 38
     Cost: $42.18 / $90.00 (46.9% of weekly limit)

   Monthly projection:
     Cost: $180.77

Usage is within limits (48.2% of limit)

MODEL BREAKDOWN
   claude-sonnet-4-5-20250929: 35 runs
   claude-opus-4-5-20251101: 3 runs

TOP 5 RUNS BY TOKEN USAGE
   #1234    | Run #4521 |  145,234 tokens | $3.45
   #1235    | Run #4523 |  132,567 tokens | $3.01
   #1236    | Run #4525 |   98,234 tokens | $2.11
   #1237    | Run #4527 |   87,654 tokens | $1.89
   #1238    | Run #4529 |   76,543 tokens | $1.67

===================================================
```

## Understanding the Report

### Token Breakdown

- **Input Tokens**: Context provided to Claude (prompts, code, documentation)
- **Output Tokens**: Claude's responses (code, explanations)
- **Total Tokens**: Sum of input + output

### Cost Calculation

Costs are calculated using official Anthropic pricing:

| Model          | Input          | Output         |
| -------------- | -------------- | -------------- |
| **Sonnet 4.5** | $3/M tokens    | $15/M tokens   |
| **Opus 4.5**   | $15/M tokens   | $75/M tokens   |
| **Haiku 4**    | $0.25/M tokens | $1.25/M tokens |

### Usage Limits

The analyzer checks against estimated Claude Code Max limits:

- **Daily Target**: ~15% of weekly capacity
- **Weekly Target**: 90% of subscription (10% buffer for manual work)
- **Monthly Projection**: Based on 7-day rolling average

### Status Levels

- `ok`: Usage is within limits (<80% projected monthly)
- `warning`: High usage detected (80-100% projected monthly)
- `critical`: Projected usage exceeds estimated monthly limit (>100%)

## Top Consumers

The report shows the 5 runs with highest token usage. Use this to:

1. Identify expensive specs that need optimization
2. Spot patterns in high-cost operations
3. Find opportunities to reduce --max-budget-usd

## Automation (Optional)

### Daily Usage Check

Add to your shell profile for automatic daily checks:

```bash
# ~/.zshrc or ~/.bashrc
alias check-claude-usage="bun run tdd:usage"
```

### Weekly Report Email

Create a cron job to email weekly reports:

```bash
# Cron: Every Monday at 9 AM
0 9 * * 1 cd /path/to/sovrium && bun run tdd:usage | mail -s "Claude Code Weekly Usage" you@example.com
```

### GitHub Actions Integration

Run usage analysis after TDD automation completes:

```yaml
# .github/workflows/weekly-usage-report.yml
name: Weekly Usage Report

on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9 AM
  workflow_dispatch:

jobs:
  usage-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.3.5

      - name: Install dependencies
        run: bun install

      - name: Analyze Usage
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: bun run tdd:usage

      - name: Comment on Usage (if high)
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.name,
              title: 'High Claude Code Usage Detected',
              body: 'Weekly usage analysis shows critical usage levels. Please review the logs for details.',
              labels: ['tdd-automation', 'usage-alert']
            })
```

## How It Works

### 1. Log Parsing

Claude Code CLI outputs usage in this format:

```
Usage: 1,234 input tokens, 567 output tokens (model: claude-sonnet-4-5-20250929)
```

The parser extracts:

- Input token count (with comma formatting support)
- Output token count
- Model name (for pricing lookup)

### 2. Cost Calculation

```typescript
// Pseudo-code
cost = inputTokens * inputPrice + outputTokens * outputPrice

// Example (Sonnet 4.5)
cost = 1234 * ($3 / 1M) + 567 * ($15 / 1M)
cost = $0.003702 + $0.008505
cost = $0.012207
```

### 3. Projection

```typescript
// Daily average
dailyAvg = weeklyCost / 7

// Monthly projection
monthlyProjection = dailyAvg * 30
```

## Limitations

### 1. Historical Data (Not Real-Time)

- Tracks past usage with ~minute lag (logs must be available)
- **Blocking is based on historical costs**, not current API utilization windows
- Provides effective circuit breaker, but not real-time rate limiting

### 2. Workflow Log Retention

- GitHub Actions logs are retained for 90 days
- Usage data older than 90 days is not available

### 3. Approximate Limits

- Claude Code Max subscription limits are estimates
- Actual limits may vary based on subscription tier
- Use as a guideline, not hard limits

### 4. No Cache Tracking

- Current implementation doesn't track prompt caching
- Cached tokens are not included in cost calculations
- Future enhancement opportunity

## Optimization Tips

### 1. Reduce Token Usage

- **Shorter prompts**: Be concise in spec descriptions
- **Targeted context**: Only include relevant code in context
- **Incremental specs**: Break large features into smaller specs

### 2. Model Selection

- **Use Haiku for simple tasks**: 12x cheaper than Sonnet
- **Reserve Opus for complex problems**: Only when Sonnet fails
- **Default to Sonnet**: Best balance of cost and capability

### 3. Budget Limits

```yaml
# .github/workflows/tdd-execute.yml
- name: Run Claude Code
  run: |
    claude code run \
      --model claude-sonnet-4-5-20250929 \
      --max-budget-usd 5.00 \  # Lower for simple specs
      --issue ${{ github.event.issue.number }}
```

### 4. Retry Strategy

- **Limit retries**: Max 3 attempts per spec
- **Classify failures**: Don't retry infrastructure issues
- **Manual fallback**: Mark complex specs for manual implementation

## Comparison with OAuth API Approach

| Aspect             | Log-Based (This Approach)    | OAuth API (`user:profile` scope) |
| ------------------ | ---------------------------- | -------------------------------- |
| **Scope Required** | `user:inference`             | `user:profile`                   |
| **Data Source**    | GitHub Actions logs          | Anthropic usage API              |
| **Real-Time**      | No (historical, ~minute lag) | Yes (5-hour + 7-day windows)     |
| **Accuracy**       | Per-run exact tokens         | Aggregated utilization %         |
| **Limits**         | Token counts + dollar costs  | Utilization percentages          |
| **CI/CD Friendly** | Yes (works with CI tokens)   | No (requires broader scope)      |
| **Setup**          | GitHub CLI auth only         | OAuth token management           |
| **Blocking**       | Cost-based (fail-closed)     | Utilization-based                |

## Troubleshooting

### "Bad credentials" Error

**Problem**: GitHub CLI not authenticated

**Solution**:

```bash
gh auth login
# OR
export GH_TOKEN=ghp_your_token_here
# OR
export GITHUB_TOKEN=ghp_your_token_here
```

### "No workflow runs found"

**Problem**: No TDD automation runs in the specified period

**Solutions**:

1. Increase days: `bun run scripts/tdd-automation/check-claude-code-usage.ts --days 30`
2. Check workflow name matches: `tdd-execute.yml`
3. Verify runs exist: `gh run list --workflow=tdd-execute.yml`

### "No usage data found in logs"

**Problem**: Claude Code output format changed or logs unavailable

**Solutions**:

1. Check a recent run manually: `gh run view <run-number> --log`
2. Verify Claude Code outputs usage: Look for "Usage: N input tokens, M output tokens"
3. Update parser regex in `usage-calculator.ts` if format changed

### Costs seem too high/low

**Problem**: Pricing rates may be outdated

**Solution**: Update `MODEL_PRICING` in `scripts/tdd-automation/services/usage-calculator.ts`:

```typescript
export const MODEL_PRICING = {
  'claude-sonnet-4-5-20250929': {
    input: 3.0 / 1_000_000, // Check anthropic.com/pricing
    output: 15.0 / 1_000_000,
  },
  // ... other models
}
```

## Future Enhancements

Potential improvements to the usage tracking system:

1. **Persistent Storage**: Store usage data in database for long-term trends
2. **Slack/Discord Alerts**: Send notifications when approaching limits
3. **Cost Budgets per Spec**: Set per-spec cost limits automatically
4. **Cache Tracking**: Include prompt caching in cost calculations
5. **Grafana Dashboard**: Visualize usage trends over time
6. **Anomaly Detection**: Alert on unusual spikes in token usage

## Related Documentation

- [TDD Automation Pipeline](./tdd-automation-pipeline.md) - Complete TDD workflow documentation
- [TDD Error Handling](./tdd-error-handling.md) - Error classification and retry logic
- [Usage Calculator Source](../../scripts/tdd-automation/services/usage-calculator.ts) - Implementation details
- [Anthropic Pricing](https://www.anthropic.com/pricing) - Official pricing information

## Summary

The log-based usage tracking system provides:

- **Works with restricted CI tokens** (user:inference scope)
- **Accurate per-run token counts and costs**
- **No dependency on OAuth API availability**
- **Simple setup** (just GitHub CLI authentication)
- **Comprehensive reporting** (totals, breakdowns, top consumers)
- **Actionable insights** (optimization recommendations)
- **Fail-closed blocking** (prevents runaway costs in CI)

Use it to:

- Monitor Claude Code usage trends
- Identify expensive specs for optimization
- Ensure sustainable TDD automation consumption
- Make informed decisions about model selection and budgets
- **Block expensive operations** when approaching usage limits
