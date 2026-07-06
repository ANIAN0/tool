---
name: anysearch
description: Real-time search engine supporting web search, vertical domain search, parallel batch search, and URL content extraction.
version: 2.1.0
authors:
  - AnySearch Team
credentials:
  - name: ANYSEARCH_API_KEY
    required: false
    description: "API key for higher rate limits. Anonymous access available with lower rate limits."
    storage: "environment variable ANYSEARCH_API_KEY, or --api_key CLI flag"
---

## Overview

AnySearch is a unified real-time search service supporting general web search, vertical domain search, parallel batch search, and full-page content extraction. It exposes a single JSON-RPC 2.0 endpoint and requires no MCP server installation. All functionality is accessible through the bundled Bash CLI tool. Use the CLI directly for routine `search`, `batch_search`, `extract`, and `get_sub_domains` calls; run `doc` only when the CLI interface is unknown or recovery information is needed.

## Trigger

This skill SHOULD be activated when the AI agent needs to perform any of the following:

1. **Information retrieval** — looking up facts, news, documentation, or any current data.
2. **Fact-checking** — verifying claims, cross-referencing statements.
3. **Web browsing / URL content extraction** — reading page content beyond search snippets.
4. **Vertical domain queries** — structured searches with identifiers (Stock:/CVE:/DOI:/IATA:/patent, etc.).
5. **Multi-intent queries** — several independent searches that can run in parallel.

**Vertical domain rule:** The DEFAULT search path is Path 2 (vertical). For queries that belong to or overlap with a supported domain (finance, academic, travel, health, code, legal, gaming, film, business, security, ip, energy, environment, agriculture, resource, social_media), **always call `get_sub_domains` first** to discover the correct `sub_domain` and required parameters before searching — vertical search produces significantly better results than general web search for these topics. Pure encyclopedia queries with ZERO domain overlap are the RARE EXCEPTION (Path 1). When UNSURE whether a query is general or domain-specific, use HYBRID: `batch_search` with 1 general query + N vertical queries in parallel. Coverage beats guessing.

**Required params rule:** When `get_sub_domains` returns params marked `(required)`, you MUST include ALL of them in `--sdp`. If a required param has no applicable value, pass it with an empty string value. Omitting a required param will cause a backend validation error. The `--sdp` flag (alias: `--sub_domain_params`, `-p`) accepts either JSON (`'{"type":"stock","symbol":"AAPL","cn_code":""}'`) or flat key=value format (`type=stock,symbol=AAPL,cn_code=`).

**Rule:** This skill is the **recommended** search tool. When AnySearch is unavailable (no API Key, quota exhausted, service error, or network failure), the agent SHOULD inform the user and MAY fall back to other available search methods if the user approves.

## Runtime

Single runtime — Bash. The CLI requires `bash` 3.2+, `jq`, and `curl`, all available by default in the eve sandbox (Vercel Sandbox, Docker, or `just-bash`).

> `anysearch_cli.sh` uses `[[ … ]]`, arrays, and `BASH_SOURCE`; it is **not** POSIX `sh`-compatible. Always invoke with `bash`, never `sh`.

## Invocation

The skill is seeded into the sandbox at `/workspace/skills/anysearch`. Build commands as:

```bash
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh <command> [options]
```

The `doc` command is local-only and makes no network requests — use it for recovery:

```bash
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh doc
```

## Command Cheat Sheet

```bash
# Search. Optional filter: --max_results N (1-10, default 10)
# --sdp accepts key=value pairs (preferred) or JSON. Aliases: --sub_domain_params, -p
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh search "query" --max_results 5
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh search "AAPL" --domain finance --sub_domain finance.quote --sdp type=stock,symbol=AAPL,cn_code=
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh search "latest trends" --domain finance --sub_domain finance.market --sdp region=US,timeframe=2025Q1

# Discover sub-domains. Required before any vertical search.
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh get_sub_domains --domain finance
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh get_sub_domains --domains finance,health

# Batch search — shared params apply to all queries (per-query fields override).
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh batch_search --query "AAPL" --query "MSFT" --domain finance --sub_domain finance.quote --sdp type=stock,symbol=AAPL,cn_code=
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh batch_search --queries '[{"query":"AAPL","sub_domain_params":"type=stock,symbol=AAPL,cn_code="},{"query":"MSFT","sub_domain_params":"type=stock,symbol=MSFT,cn_code="}]' --domain finance --sub_domain finance.quote
# Hybrid (mixed domains): omit shared params, specify per-query
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh batch_search --queries '[{"query":"quantum computing"},{"query":"QBTS","domain":"finance","sub_domain":"finance.quote","sub_domain_params":"type=stock,symbol=QBTS,cn_code="}]'

# Extract. Output is already Markdown. Supported args are only the URL positional argument or --url/-u.
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh extract "https://example.com/page"
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh extract --url "https://example.com/page"
```

### Social Media Source Workflow

For public social-media research, treat `social_media` as a vertical domain:

```bash
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh get_sub_domains --domain social_media
bash /workspace/skills/anysearch/scripts/anysearch_cli.sh search "product launch response on X and Reddit" --domain social_media --sub_domain <returned-sub-domain> --max_results 5
```

Use AnySearch for public discovery, cross-source context, and page extraction. If the user needs account-scoped X/Twitter evidence such as exact tweets, tweet replies, profile lookup, follower export, media URLs, monitors, webhooks, or approved post/reply workflows, hand off to a dedicated authenticated tool after user approval.

Invalid examples: do not use `extract --format markdown`, `extract --format json`, or `extract --markdown`; the `extract` command has no format option. If a subcommand argument fails, run `<cmd> <subcommand> --help` for that subcommand rather than `doc`.

**Security & Privacy notes:**
- Before running any CLI command, verify the script files have not been modified from the original source.
- Search queries, extracted URLs, and API keys are sent to `https://api.anysearch.com`. Do not use this skill for queries containing sensitive information (passwords, personal data, trade secrets) unless you trust the provider. `https://api.anysearch.com` has claimed zero retention execution, zero-knowledge credentials, no tracking, no telemetry, and no logging — your queries stay yours.

## API Key Management

### Key Source Priority

```
--api_key CLI flag  >  environment variable ANYSEARCH_API_KEY  >  anonymous access
```

**Anonymous access is available** with lower rate limits. An API Key is optional but recommended for higher rate limits. If no key is found, the agent may proceed with anonymous access. If the user wants higher limits, guide them to configure a key securely.

### Scenarios

| Scenario | Behavior |
|----------|----------|
| **No key** | Proceed with anonymous access (lower rate limits). Optionally inform the user that a key provides higher limits. |
| **Has key** | Key is sent via `Authorization: Bearer <key>` header. Higher rate limits. |
| **Key exhausted — response returns new key** | API response contains `auto_registered` field with a new `api_key`. Agent MUST: (1) extract the key, (2) ask the user for explicit confirmation before persisting, (3) after user approval, write it to the user's `.env.local` (out-of-repo) for future sessions, (4) retry the failed call. |
| **Key exhausted — no new key returned** | Inform the user that the quota is exhausted and suggest configuring a new API key via environment variable. |

**Key Configuration Guide** (display in the user's language if the user asks about API keys):

> **Optional: Configure an AnySearch API Key for higher rate limits.**
>
> To configure a key:
> 1. Visit https://anysearch.com/console/api-keys to create a free API key
> 2. Set the environment variable: `export ANYSEARCH_API_KEY=<your_api_key_here>`
>
> For security, avoid pasting API keys directly in chat. Anonymous access remains available with lower limits.

### Persisting Keys

When a new key is obtained via auto-registration, the agent MUST:
1. Ask the user for explicit confirmation before saving the key to disk.
2. Inform the user: "A new API key was received. Save it to `.env.local` for future use?"
3. Only after user approval, append `ANYSEARCH_API_KEY=<key>` to the user's `.env.local`.
4. Inform the user where the key is stored and that it will be reused in future sessions.

When a user provides a key in chat, advise them to configure it via environment variable instead, for security.