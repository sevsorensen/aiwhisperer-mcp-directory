# Claude MCP Connector Directory

A curated, trust-first directory of Model Context Protocol (MCP) connectors for Claude AI — vetted for business leaders and their teams.

**Published by** [AIWhisperer.org](https://aiwhisperer.org) | [ePraxis LLC](https://epraxis.com)
**Curated by** Severin Sorensen, Author, *The AI Whisperer* Series

## What This Is

A self-contained HTML directory of 66 editorially curated MCP connectors across 14 categories, with trust scoring, metadata, and one-click install commands. Designed to integrate with the AIWhisperer.org site under Tools.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The directory page — self-contained, no external dependencies except Google Fonts |
| `update-mcp-directory.js` | Weekly auto-updater script that refreshes versions, stars, and download counts |

## Auto-Updater

The updater queries npm and GitHub APIs to keep connector metadata current.

```bash
# Preview changes (dry run)
node update-mcp-directory.js

# Apply changes
node update-mcp-directory.js --apply

# With GitHub token for higher rate limits
GITHUB_TOKEN=ghp_xxx node update-mcp-directory.js --apply
```

**Schedule (cron):** `0 6 * * 1` — Runs Monday at 6:00 AM local time.

## Trust Methodology

Each connector is scored on six factors: provenance, GitHub stars, npm downloads, maintenance recency, documentation quality, and Smithery usage. Three trust tiers:

- **Official** — Maintained by Anthropic
- **Partner** — Built by the named company
- **Vetted Community** — Clear provenance and active maintenance

## Legal

This directory is a free community resource. No financial interest in or compensation from any listed company. See the full disclaimer in the directory page.

© Copyright Severin Sorensen. All rights reserved.
Published by AIWhisperer.org under license with ePraxis LLC.# Claude MCP Connector Directory
