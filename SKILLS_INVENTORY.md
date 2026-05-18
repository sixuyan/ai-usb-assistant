# Phase 4: 技能盘点报告

## 来源

| 来源 | 技能数 | 路径 |
|------|--------|------|
| OpenClaw 官方 | 57 | `D:/nodejs/node_modules/openclaw/skills/` |
| U-Claw skills-cn | 10 | `C:/Users/sixuy/Desktop/uclaw/u-claw/portable/skills-cn/` |
| **合计** | **67** | |

---

## 排除清单（不适合 U 盘场景）

### macOS 限定（22 个）
| 技能 | 原因 |
|------|------|
| apple-notes, apple-reminders, bear-notes, things-mac | macOS only (darwin) |
| bluebubbles, imsg | iMessage + macOS |
| peekaboo | macOS UI automation |
| tmux | Unix terminal |

### 需要外部硬件（6 个）
| 技能 | 原因 |
|------|------|
| blucli | BluOS 音响 |
| camsnap | RTSP 摄像头 |
| eightctl | Eight Sleep 床垫 |
| openhue | Philips Hue 灯 |
| sonoscli | Sonos 音响 |
| songsee | 音频可视化专用 |

### 需要 API 密钥/账号绑定（18 个）
| 技能 | 依赖 |
|------|------|
| 1password | op CLI + 1Password 账号 |
| discord | Discord bot token |
| gemini | Google Gemini API key |
| gh-issues, github | GitHub token (gh auth) |
| gog | Google Workspace OAuth |
| goplaces | Google Places API key |
| himalaya | IMAP/SMTP 邮箱密码 |
| mail-summary | 邮箱密码 |
| notion | Notion API key |
| openai-whisper-api | OpenAI API key |
| sag | ElevenLabs API key |
| slack | Slack bot token |
| spotify-player | Spotify 账号 |
| trello | Trello API key |
| wacli | WhatsApp 账号 |
| xurl | X/Twitter API key |
| ordercli | Foodora 账号 |

---

## 推荐清单（25 个精选技能）

### 类别 A：中国本地化（10 个）— 从 U-Claw 继承
| # | 技能 | 功能 | API 依赖 |
|---|------|------|----------|
| 1 | bilibili-helper | B站视频标题/封面/标签优化 | 无 |
| 2 | china-search | 百度/搜狗/Bing 中国搜索 | 无 |
| 3 | china-translate | 中英专业翻译（含术语表） | 无 |
| 4 | china-weather | 中国城市天气（wttr.in） | 无 |
| 5 | deepseek-helper | DeepSeek API 指南 | 无 |
| 6 | douyin-script | 抖音/快手短视频脚本 | 无 |
| 7 | wechat-article | 微信公众号文章排版 | 无 |
| 8 | weibo-poster | 微博内容创作（140字） | 无 |
| 9 | xiaohongshu-writer | 小红书笔记写作 | 无 |
| 10 | zhihu-writer | 知乎回答/文章写作 | 无 |

### 类别 B：日常助手（6 个）— 中国用户高频
| # | 技能 | 功能 | API 依赖 |
|---|------|------|----------|
| 11 | weather | 全球天气（wttr.in/Open-Meteo） | 无 |
| 12 | reminder | 定时提醒/到期通知 | 无 |
| 13 | daily-briefing | 每日简报/新闻摘要/快递查询 | 无 |
| 14 | recipe-finder | 食谱推荐/食材匹配 | 无 |
| 15 | travel-planner | 旅行规划/行李清单 | 无 |
| 16 | habit-tracker | 习惯打卡/健康追踪 | 无 |

### 类别 C：开发工具（5 个）— 技术人员
| # | 技能 | 功能 | API 依赖 |
|---|------|------|----------|
| 17 | coding-agent | 编程任务委托（Codex/Claude Code） | 无 |
| 18 | skill-creator | 创建/编辑/审查 Agent Skills | 无 |
| 19 | clawhub | 技能市场（搜索/安装/发布） | 无 |
| 20 | session-logs | 搜索分析对话日志 | 无 |
| 21 | model-usage | 模型用量/费用统计 | 无 |

### 类别 D：实用工具（4 个）— 通用
| # | 技能 | 功能 | API 依赖 |
|---|------|------|----------|
| 22 | summarize | 总结 URL/播客/文件内容 | 无 |
| 23 | nano-pdf | 自然语言编辑 PDF | 无 |
| 24 | video-frames | 视频帧提取/剪辑 | ffmpeg |
| 25 | openai-whisper | 本地语音转文字（离线） | 无 |

---

## 暂不包含（可后续按需添加）

| 技能 | 原因 |
|------|------|
| blogwatcher | RSS 监控，小众需求 |
| canvas | 描述为空，功能不明确 |
| gifgrep | GIF 搜索，低频 |
| healthcheck | 安全审计，开发者向 |
| mcporter | MCP 服务器管理，高级功能 |
| node-connect | 连接诊断，调试用 |
| obsidian | Obsidian 用户专属 |
| oracle | 提示词最佳实践，元技能 |
| sherpa-onnx-tts | 本地 TTS 需下载模型文件 (~50MB) |
| voice-call | 需 OpenClaw voice-call 插件 |
| discord, slack | 需 bot token 配置 |
| github, gh-issues | 需 gh auth 配置 |

---

## 迁移影响评估

| 项目 | 数值 |
|------|------|
| 迁移技能数 | 25 |
| 全部为纯 Markdown (SKILL.md) | 无二进制 |
| 总文件大小估算 | < 2 MB |
| 需要外部 API key 的技能 | 0（全部无外部依赖） |
| 需要 CLI 工具的技能 | 1（video-frames 需 ffmpeg） |

---

**请确认以上清单，我将开始复制技能文件到 `user/skills/`。**
