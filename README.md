# AI USB Assistant - Portable AI Agent

> 插上 U 盘，双击即用。AI 助手随身携带，数据永不丢失。

## 特性

- **100% U 盘运行** — 不在电脑上留下任何痕迹
- **二层隔离架构** — 系统更新不覆盖你的配置和数据
- **增量更新** — 只下载变化的文件，节省流量和时间
- **自动回滚** — 更新失败自动恢复上一版本

## 目录结构

```
U盘根目录/
├── START.bat          ← 双击启动 (Windows)
├── START.command      ← 双击启动 (macOS)
├── UPDATE.bat         ← 检查更新
│
├── system/            ← 系统层 (可更新)
│   ├── runtime/       ← Node.js 运行时
│   ├── core/          ← OpenClaw AI 框架
│   ├── skills/        ← 内置技能
│   ├── scripts/       ← 启动/更新/诊断脚本
│   └── config-center/ ← 网页配置界面
│
├── user/              ← 用户层 (更新不影响这里!)
│   ├── config/        ← API密钥、模型配置
│   ├── skills/        ← 你自己装的技能
│   ├── memory/        ← AI 对话记忆
│   └── workspace/     ← 你的文件
│
├── data/              ← 运行时数据 (自动映射到 user/)
└── cache/             ← 临时文件 (可随时清空)
```

## 快速开始

### 1. 安装依赖 (仅首次)

```powershell
# Windows PowerShell
.\system\scripts\setup.ps1
```

```bash
# macOS Terminal
bash system/scripts/setup.sh
```

### 2. 配置 AI 模型

双击 `START.bat` 启动后，浏览器会自动打开配置页面 (http://127.0.0.1:18788/)。

支持的模型：
- MiniMax / DeepSeek / Kimi / 智谱GLM / 通义千问 / 豆包
- OpenAI / Anthropic Claude / Groq / 硅基流动
- 或任何兼容 OpenAI 接口的自定义服务

### 3. 开始使用

配置保存后，访问 http://127.0.0.1:18789/ 即可使用 AI 助手。

## 常用操作

| 操作 | 方法 |
|------|------|
| 启动 AI 助手 | 双击 `START.bat` |
| 配置模型 | 浏览器打开 http://127.0.0.1:18788/ |
| 检查更新 | 双击 `UPDATE.bat` |
| 系统诊断 | `PowerShell -File system/scripts/doctor.ps1` |
| 备份数据 | `PowerShell -File system/scripts/backup.ps1` |
| 重置系统 | `PowerShell -File system/scripts/reset-system.ps1` |

## 架构说明

### 二层隔离

```
system/  ← 系统层：AI框架 + 运行时 + 脚本
  ↑ 更新时替换           ↑ 不会影响
  ↓ 用户数据独立         ↓
user/    ← 用户层：配置 + 技能 + 记忆 + 文件
```

- **更新 system/ 时**：user/ 目录完全不受影响
- **系统损坏时**：删除 system/，重新 setup，用户数据完整保留
- **换 U 盘时**：只需复制 user/ 目录即可迁移所有个人数据

### 增量更新

1. 启动时自动检查 `system/manifest.json` vs 远程版本
2. 只下载有变化的文件（SHA256 对比）
3. 新系统放入 `system_new/`，下次启动时原子激活
4. 激活失败自动回滚到 `system_old/`

## 安全说明

- API Key 保存在 `user/config/openclaw.json`，不放在 U 盘根目录
- 所有数据仅在 U 盘本地，不上传到任何服务器
- 不在主机留下文件、注册表、缓存
- 退出时自动清理临时文件

## 系统要求

- **Windows**: Windows 10/11 x64
- **macOS**: macOS 12+ (Apple Silicon / Intel)
- **U 盘**: 4GB+ 可用空间 (NTFS/exFAT/APFS 格式)
- **网络**: 使用 AI 时需要联网
