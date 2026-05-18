# AI USB Assistant - Skill Catalog

> 25 pre-installed skills. Zero external API dependencies. Ready out of the box.
> Total size: ~149 KB. All skills stored in `user/skills/` (survives system updates).

---

## China-Localized (10)

| Skill | Description |
|-------|-------------|
| `bilibili-helper` | Bilibili video title, tag, and cover optimization |
| `china-search` | Baidu / Sogou / Bing China web search via curl |
| `china-translate` | Professional Chinese-English translation with glossary |
| `china-weather` | China city weather queries via wttr.in |
| `deepseek-helper` | DeepSeek API guide and model comparison |
| `douyin-script` | Douyin / Kuaishou short video script writing |
| `wechat-article` | WeChat Official Account article writing and formatting |
| `weibo-poster` | Weibo content creation (140-char optimization) |
| `xiaohongshu-writer` | Xiaohongshu (RED) note writing with emoji strategy |
| `zhihu-writer` | Zhihu answer/article writing (professional tone) |

## Daily Assistant (6)

| Skill | Description |
|-------|-------------|
| `weather` | Global weather and forecasts via wttr.in / Open-Meteo |
| `reminder` | Timed reminders, deadline notifications, recurring alerts |
| `daily-briefing` | Daily news summary, express delivery tracking |
| `recipe-finder` | Recipe recommendations based on available ingredients |
| `travel-planner` | Trip planning, packing checklists, itinerary scheduling |
| `habit-tracker` | Habit打卡, health tracking, daily check-in logging |

## Developer Tools (5)

| Skill | Description |
|-------|-------------|
| `coding-agent` | Delegate coding tasks to Codex / Claude Code agents |
| `skill-creator` | Create, edit, review, and audit Agent Skills |
| `clawhub` | Search, install, update skills from clawhub.com marketplace |
| `session-logs` | Search and analyze conversation session logs |
| `model-usage` | Model usage and cost statistics |

## Utilities (4)

| Skill | Description |
|-------|-------------|
| `summarize` | Summarize URLs, podcasts, and local file content |
| `nano-pdf` | Edit PDFs with natural language instructions |
| `video-frames` | Extract frames or clips from videos (requires ffmpeg) |
| `openai-whisper` | Local speech-to-text via Whisper CLI (offline, no API key) |

---

## Add Your Own Skills

1. Create a folder under `user/skills/your-skill-name/`
2. Add a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: your-skill-name
description: What this skill does
---
# Your Skill

Instructions for the AI...
```

3. Restart the AI Assistant. The skill will be auto-discovered.

## Protected System Skills

Some system skills are marked `protected: true` in their SKILL.md frontmatter.
User skills with the same name will NOT override protected system skills.
This prevents security fixes in system skills from being bypassed.

## Skill File Structure

```
user/skills/
  bilibili-helper/
    SKILL.md          <- Required: skill definition
    references/       <- Optional: reference docs
    scripts/          <- Optional: helper scripts
```
