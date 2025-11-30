import gradio as gr

DESCRIPTION = """
# 🔗 Nexus

**Run MCP servers locally. Complete privacy. Sub-100ms latency.**

Nexus runs fully on your machine—nothing ever leaves your device. Get sub-100ms latency (vs cloud's 5-10 seconds) and 92.9% lower token usage through intelligent tool filtering.

## ✨ Features

- 🔒 **100% Local** - Docker-based, your data & tokens never leave your machine
- 🛡️ **Edison Security** - Prevents prompt injection & data exfiltration automatically
- ⚡ **Fast** - Sub-100ms latency (58.8x faster than cloud MCP routing)
- 💰 **Token Efficient** - 92.9% lower token usage (650 tokens saved per operation)
- 🔍 **Transparent** - Full logs of every tool call and response
- 🎯 **Simple Setup** - One command install, works with Cursor out of the box

## 🚀 Quick Install

**Mac/Linux:**
```bash
curl -sL https://raw.githubusercontent.com/vgardrinier/mcp-hackathon-nexus/master/install.sh | bash
```

**Windows:**
```powershell
irm https://raw.githubusercontent.com/vgardrinier/mcp-hackathon-nexus/master/install.ps1 | iex
```

## 🛡️ Edison Security

Nexus includes the **Edison** security layer to protect against:

| Threat | Protection |
|--------|------------|
| Prompt Injection | Blocks malicious instructions in GitHub issues, Notion pages, web content |
| Data Exfiltration | Prevents the "lethal trifecta" (read untrusted → access private → send external) |
| Secret Leakage | Auto-classifies servers as untrusted/private/secret |

### How It Works

Edison tracks three risk flags per conversation:
- `UNTRUSTED_CONTENT` - Read from GitHub, Notion, web (⚠️ flagged)
- `PRIVATE_DATA` - Read from Supabase, Linear, databases (🔒 flagged)  
- `EXTERNAL_COMM` - Write/send to external services (📤 flagged)

**Normal operations allowed:**
- ✅ "List my GitHub PRs" (single flag)
- ✅ "Query my Supabase database" (single flag)

**Dangerous patterns blocked:**
- 🚨 "Read GitHub issue, get Supabase data, post to Slack" → BLOCKED

## 📊 Architecture

```
Cursor → http://localhost:3001/mcp → Nexus Proxy → GitHub/Linear/etc MCP Servers
                                          ↓
                                    Edison Security
                                    (prompt injection check)
```

## 🎬 Demo Video

**[▶️ Watch the 3-minute demo on Loom](https://www.loom.com/share/5c444c739f9f4a61a752c357ea8334d6)**

## 🔗 Links

- **GitHub**: [vgardrinier/mcp-hackathon-nexus](https://github.com/vgardrinier/mcp-hackathon-nexus)
- **Demo Video**: [Watch on Loom](https://www.loom.com/share/5c444c739f9f4a61a752c357ea8334d6)

---

*Built for the MCP 1st Birthday Hackathon 🎂*
"""

demo = gr.Blocks(title="Nexus - Enterprise MCP Security")

with demo:
    gr.Markdown(DESCRIPTION)

if __name__ == "__main__":
    demo.launch()

