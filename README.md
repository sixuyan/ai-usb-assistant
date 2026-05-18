# AI USB Assistant

> Insert USB drive. Double-click. AI assistant ready.
> 插入 U 盘，双击即用。AI 助手随身携带。

---

## Quick Start

1. **Insert the USB drive** into any Windows 10/11 computer
2. **Double-click `START.bat`** (or `menu.bat` for the menu)
3. **Open your browser** to http://127.0.0.1:18788/ to configure your AI model
4. **Start chatting** at http://127.0.0.1:18789/

That's it. Nothing is installed on the computer. All data stays on the USB drive.

---

## Main Features

| Feature | How to Use |
|---------|------------|
| **AI Chat** | Dashboard at http://127.0.0.1:18789/ |
| **Configure Model** | http://127.0.0.1:18788/ — supports MiniMax, DeepSeek, Kimi, OpenAI, Claude, and more |
| **Check for Updates** | Double-click `UPDATE.bat` |
| **Backup Data** | Double-click `menu.bat` → select "Backup" |
| **System Diagnostic** | `menu.bat` → select "Diagnostic" |

---

## What's on the USB Drive

```
USB Drive Root/
  START.bat          ← Double-click to start
  menu.bat           ← Interactive menu (10 options)
  UPDATE.bat         ← Check and install updates

  system/            ← System files (auto-updated)
  user/              ← YOUR data (never touched by updates)
    config/          ← API keys, model settings
    skills/          ← AI skills (25 pre-installed)
    memory/          ← Chat history
    backups/         ← Data backups
  cache/             ← Temporary files (safe to delete)
```

---

## Supported AI Models

| Provider | Model | Notes |
|----------|-------|-------|
| MiniMax | minimax-text-01 | Chinese-optimized |
| DeepSeek | deepseek-chat | Great value |
| Kimi | moonshot-v1-8k | Long context |
| Zhipu GLM | glm-4-plus | Strong all-round |
| Qwen | qwen-turbo | Free tier |
| Doubao | doubao-pro-32k | Budget-friendly |
| OpenAI | gpt-4o | Industry standard |
| Claude | claude-sonnet-4 | Safe & reliable |
| Custom | any OpenAI-compatible | Bring your own endpoint |

---

## FAQ

**Q: Port already in use?**
A: The assistant automatically finds an available port (18789-18799). No configuration needed.

**Q: Does this leave anything on my computer?**
A: No. All files, cache, and config stay on the USB drive. Run `menu.bat → Diagnostic` to verify.

**Q: Will updating delete my config?**
A: No. Updates only touch `system/`. Your `user/` folder (config, memory, skills) is never touched.

**Q: Can I add my own AI skills?**
A: Yes. Copy any skill folder into `user/skills/` and restart. See `SKILLS.md` for details.

**Q: USB drive formatted as FAT32?**
A: Works, but NTFS or exFAT is recommended for better performance.

**Q: No internet connection?**
A: AI chat requires internet. The update check will simply report "unreachable" — no errors.

---

## Updating

1. Double-click `UPDATE.bat`
2. If an update is available, files are downloaded automatically
3. Restart the assistant (close the window, double-click `START.bat` again)
4. Your data is **never** affected by updates

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Node.js not found" | Run `system\scripts\setup.ps1` in PowerShell |
| Config Center won't open | Make sure the assistant is running first |
| Browser shows "Connection refused" | Wait 10 seconds for the gateway to start, then refresh |
| Slow startup | First run installs dependencies (~1-2 minutes); subsequent starts are fast |

---

## System Requirements

- **Windows 10/11** (64-bit)
- USB 3.0 drive with 4GB+ free space (NTFS or exFAT recommended)
- Internet connection for AI chat
- No admin rights needed

---

## 25 Pre-installed Skills

`weather` `reminder` `daily-briefing` `recipe-finder` `travel-planner` `habit-tracker` `coding-agent` `skill-creator` `clawhub` `session-logs` `model-usage` `summarize` `nano-pdf` `video-frames` `openai-whisper` `bilibili-helper` `china-search` `china-translate` `china-weather` `deepseek-helper` `douyin-script` `wechat-article` `weibo-poster` `xiaohongshu-writer` `zhihu-writer`

See `SKILLS.md` for the full catalog.
