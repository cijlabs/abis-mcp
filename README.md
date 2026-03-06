# ABIS MCP

Model Context Protocol server for ABIS — the deterministic AI behavioral drift monitoring platform by CIJ Labs.

Gives any Claude instance (Claude Code, Claude Desktop) native access to live drift scores, 9-score behavioral scorecards, benchmark runners, and report generation — backed by Patent GB2521226.7.

## Tools

| Tool | Description |
|------|-------------|
| `abis_get_health` | Check all 8 organ status |
| `abis_get_drift_scores` | Live drift scores for all 8 models |
| `abis_get_scorecard` | Full 9-score behavioral scorecard per model |
| `abis_run_benchmark` | Run single or full benchmark |
| `abis_generate_report` | Generate NLG report (5 types) |
| `abis_get_benchmark_history` | Historical drift trajectory per model |

## Setup

```bash
npm install
cp .env.example .env
# Fill in your ABIS_ADMIN_KEY in .env
node index.js
```

## Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "abis": {
      "command": "node",
      "args": ["C:\\cijlabs\\abis-mcp\\index.js"],
      "env": {
        "ABIS_ADMIN_KEY": "your_key_here"
      }
    }
  }
}
```

Claude Desktop config location:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

## Connect to Claude Code

In your Claude Code project settings, add this MCP server pointing to the local `index.js`.

## Example Prompts (once connected)

- "What's the current drift score for GPT-4o?"
- "Are all 8 ABIS organs healthy?"
- "Show me Claude Opus's full 9-score scorecard"
- "Run a quick benchmark on deepseek-v3.2 with the prompt: explain recursion"
- "Generate an EU AI Act compliance report"
- "Has GPT-4o drifted more than 20% in the last month?"
- "Give me an investor brief on ABIS drift findings"
