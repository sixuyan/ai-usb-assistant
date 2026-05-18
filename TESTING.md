# TESTING.md — AI USB Assistant 测试指南

> Phase 1 验证范围：目录结构、启动链路、Config Center、健康诊断。
> 以下测试假设你有一个格式化为 NTFS/exFAT 的 U 盘。

---

## 测试环境准备

```
需求:
  - Windows 10/11 x64
  - U 盘 (NTFS 格式，4GB+ 空间)
  - 网络连接 (下载依赖 + 使用 AI)
  - PowerShell 5.1+

U 盘盘符假设: E:\
请将所有 E:\ 替换为你的实际盘符。
```

---

## 测试 1：目录结构完整性

**目的：** 验证四层目录结构是否正确创建。

**步骤：**
```powershell
# 1. 查看目录结构
cmd /c "tree E:\ /F /A | more"

# 2. 验证关键目录存在
$dirs = @(
    "E:\system\runtime", "E:\system\core", "E:\system\skills",
    "E:\system\scripts", "E:\system\config-center",
    "E:\user\config", "E:\user\skills", "E:\user\memory",
    "E:\user\workspace", "E:\user\backups", "E:\user\logs",
    "E:\data", "E:\cache"
)
foreach ($d in $dirs) {
    $exists = Test-Path $d
    Write-Host ("{0,-40} {1}" -f $d, $(if ($exists) { "[OK]" } else { "[MISSING]" }))
}
```

**预期结果：**
```
E:\system\runtime                        [OK]
E:\system\core                           [OK]
E:\system\scripts                        [OK]
... (all directories present)
```

> **已知限制：** `system/runtime/`, `system/core/node_modules/`, `data/`, `cache/` 在 git clone 后为空。
> 运行 setup.ps1 后会填充 runtime/ 和 core/node_modules/。
> 运行 START.bat 后会填充 data/ 和 cache/。

---

## 测试 2：运行 setup.ps1（首次安装依赖）

**目的：** 验证 Node.js 和 OpenClaw 下载安装是否正常。

**前提：** U 盘上还没有 `system/runtime/node-win-x64/node.exe` 和 `system/core/node_modules/`。

**步骤：**
```powershell
# 以管理员身份运行 PowerShell（下载大文件需要稳定网络）
cd E:\
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\system\scripts\setup.ps1"
```

**预期输出：**
```
  ╔══════════════════════════════════════╗
  ║   AI USB Assistant - Setup          ║
  ╚══════════════════════════════════════╝

  [i]  Step 1/4: Node.js Runtime
  [i]  Downloading Node.js v22.12.0 (win-x64)...
  [OK] Node.js v22.12.0 installed successfully
  [i]  Step 2/4: OpenClaw Core
  [i]  Installing OpenClaw (this may take a few minutes)...
  [OK] OpenClaw installed successfully
  [i]  Step 3/4: Skills
  ...
  [i]  Step 4/4: Generating manifest...
  ...
  ═══════════════════════════════════════
   Setup complete!
```

**验证：**
```powershell
# 检查 node.exe
& "E:\system\runtime\node-win-x64\node.exe" --version
# 预期输出: v22.12.0

# 检查 openclaw
Test-Path "E:\system\core\node_modules\openclaw\openclaw.mjs"
# 预期输出: True
```

**常见问题：**
| 症状 | 原因 | 解决 |
|------|------|------|
| `Invoke-WebRequest` 超时 | npmmirror 不可达 | 重试，或手动下载 Node.js zip 解压到 `system\runtime\node-win-x64\` |
| `npm install` 失败 | npm 缓存问题 | 删除 `cache\npm\` 后重试 |
| 杀毒软件拦截 | node.exe 被误报 | 添加白名单 |

---

## 测试 3：运行 START.bat

**目的：** 验证完整启动链路。

**步骤：**
```
1. 打开 U 盘根目录
2. 双击 START.bat
3. 观察命令行窗口输出
```

**预期输出（首次启动）：**
```
  ╔══════════════════════════════════════╗
  ║     AI USB Assistant                ║
  ╚══════════════════════════════════════╝

  [i]  Checking environment...
  [OK] Node.js v22.12.0
  [i]  Preparing directories...
  [i]  Setting up data bridge...
  [OK] Bridge: E:\data\.openclaw -> E:\user\config
  [OK] Bridge: E:\data\memory -> E:\user\memory
  [OK] Bridge: E:\data\workspace -> E:\user\workspace
  [i]  Merging skills...
  [OK] Skills ready (N skills)
  [i]  Configuring portable environment...
  [OK] Environment configured (all writes to U-disk)
  [i]  First run detected - creating default config...
  [OK] Default config created at user/config/openclaw.json
  [i]  Finding available port...
  [OK] Using port: 18789
  [i]  Starting Config Center...
  [OK] Config Center started on port 18788
  [i]  Starting AI Gateway on port 18789...
  [i]  Waiting for gateway to start...
  [i]  Opening Dashboard and Config Center...

  ═══════════════════════════════════════
   AI Assistant is running!
   Dashboard:     http://127.0.0.1:18789/#token=uclaw
   Config Center: http://127.0.0.1:18788/
   All data stored on U-disk: E:\
   Close this window to stop the assistant.
  ═══════════════════════════════════════
```

**预期行为：**
- 浏览器自动打开两个标签页（Dashboard + Config Center 配置向导）
- 命令行窗口保持打开（按 Ctrl+C 或关闭窗口停止）

---

## 测试 4：验证 OpenClaw Gateway 启动成功

**目的：** 确认 AI 网关服务正常响应。

**步骤：**
```powershell
# 1. 确认端口在监听
netstat -ano | findstr ":18789"

# 2. HTTP 健康检查
curl http://127.0.0.1:18789/ -UseBasicParsing -TimeoutSec 5

# 3. 检查进程
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime
```

**预期结果：**
```
# netstat: 显示 127.0.0.1:18789 状态 LISTENING
# curl: 返回 HTTP 200 (HTML 页面)
# Get-Process: 至少 2 个 node.exe 进程 (gateway + config-center)
```

**常见问题：**
| 症状 | 原因 | 解决 |
|------|------|------|
| `[X] Node.js runtime not found` | setup.ps1 未运行 | 运行 `system\scripts\setup.ps1` |
| `[X] No available port` | 18789-18799 全部被占用 | 关闭占用端口的程序后重试 |
| Gateway 启动但浏览器打不开 | 浏览器安全策略 | 手动打开 http://127.0.0.1:18789/ |
| 杀毒软件/防火墙阻止 | Windows Defender 防火墙 | 允许 node.exe 访问本地网络 |

---

## 测试 5：验证 Config Center 可访问

**目的：** 确认配置页面可以打开和交互。

**步骤：**
```
1. 浏览器打开 http://127.0.0.1:18788/
2. 确认看到 "AI 助手 - 配置中心" 页面
3. 点击 "MiniMax" 模型卡片 → 应该高亮显示
4. 点击 "下一步" → 应该进入 API Key 输入页
5. 输入测试 API Key → 点击 "下一步"
6. 确认看到配置预览 JSON
7. 点击 "保存配置"
8. 确认显示 "配置已保存到 U 盘用户层"
```

**验证保存结果：**
```powershell
# 检查配置文件
Get-Content "E:\user\config\openclaw.json" | ConvertFrom-Json | Format-List
# 预期: 显示包含 models.providers 的完整配置

# 确认配置文件不在 system/ 目录（二层隔离）
Test-Path "E:\system\openclaw.json"
# 预期输出: False (config lives in user/ not system/)
```

**常见问题：**
| 症状 | 原因 | 解决 |
|------|------|------|
| 页面打不开 (404) | Config Center 未启动 | 检查 boot.ps1 输出中是否有 "Config Center started" |
| 页面打开但无法保存 | `user/config/` 目录无写权限 | 检查 U 盘是否有写保护开关 |
| 配置 JSON 格式错误 | Config.html JS 生成有误 | 检查浏览器控制台错误 |

---

## 测试 6：运行 doctor.ps1（健康诊断）

**目的：** 验证 7 项健康检查全部通过。

**步骤：**
```powershell
cd E:\
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\system\scripts\doctor.ps1"
```

**预期输出（全绿）：**
```
  ╔══════════════════════════════════════╗
  ║   AI USB Assistant - Health Check   ║
  ╚══════════════════════════════════════╝

  1. USB Drive Space
  --------------------------------------------------
  [OK] USB space: 12345 MB free / 32000 MB total

  2. System Layer (system/)
  --------------------------------------------------
  [OK] Node.js: v22.12.0
  [OK] OpenClaw core: installed
  [OK] Manifest: 156 files (142 required, 142 verified) - all OK
  [OK] System version: 2026.5.18-alpha.1

  3. User Layer (user/)
  --------------------------------------------------
  [OK] user/config/ exists
  [OK] Config: models configured (minimax)

  4. Data Bridge (data/)
  --------------------------------------------------
  [OK] Bridge: data/.openclaw -> user/config
  [OK] Bridge: data/memory -> user/memory
  [OK] Bridge: data/workspace -> user/workspace

  5. Backups
  --------------------------------------------------
  [OK] Backups: 1 snapshot(s), latest: 2026-05-19_12-30

  6. Port Availability
  --------------------------------------------------
  [OK] Port 18789 is available

  7. Zero-Host-Footprint
  --------------------------------------------------
  [OK] No traces on host machine

  ═══════════════════════════════════════
   ALL OK - System is healthy
  ═══════════════════════════════════════
```

**预期输出（有警告）：**
```
  [X] 2 file(s) corrupted or tampered:
    - system/runtime/node-win-x64/node.exe
    - system/core/node_modules/openclaw/openclaw.mjs
  [X]  Run UPDATE.bat --Force to repair
  ...
  FAILED: 2 error(s), 1 warning(s)
```

> 运行 `cmd /c "E:\UPDATE.bat --Force"` 可以强制重新下载所有系统文件修复。

---

## 测试 7：二层隔离验证（核心架构测试）

**目的：** 验证系统层重置不影响用户数据。

**步骤：**
```powershell
# 1. 备份 user/config/ 做对比
Copy-Item "E:\user" "C:\Temp\user_backup" -Recurse

# 2. 运行系统重置（保留用户数据）
PowerShell -File "E:\system\scripts\reset-system.ps1" -Force

# 3. 验证 system/ 已删除
Test-Path "E:\system"
# 预期输出: False (或其他路径如果 system/ 已被删除)

# 4. 验证 user/ 完整保留
# 对比 user/ 和备份
```

**预期结果：**
- system/ 被清空（需要运行 setup.ps1 重新安装）
- user/ 目录和所有数据完整无损
- data/ 桥接目录被清空（启动时自动重建）

---

## 已知限制（Phase 1）

以下功能在 Phase 1 中尚未完成，将在后续 Phase 中实现：

| 功能 | 状态 | 计划 |
|------|------|------|
| 实际 OSS 更新服务器 | ❌ 未部署 | Phase 2 — 阿里云 OSS 配置后可用 |
| UPDATE.bat 连接到远程服务器 | ❌ 服务器未搭建 | Phase 2 — manifest URL 指向 `ai-usb-updates.oss-cn-hangzhou.aliyuncs.com` |
| macOS 支持 | ⚠️ 脚本已写未测试 | Phase 3 — 需要在 Mac 真机上测试 |
| 功能菜单 (menu.bat) | ❌ 未实现 | Phase 3 |
| 内置技能包 (skills-cn) | ⚠️ 需手动复制 | Phase 4 — 从 U-Claw 迁移 |
| 龙虾全包技能迁移 | ❌ 未实现 | Phase 4 |
| Electron 桌面应用 | ❌ 未实现 | Phase 3 (低优先级) |
| CI/CD 自动发布 | ❌ 未配置 | Phase 2 — 需要 GitHub Actions + OSS |
| `system/skills/` 为空 | ⚠️ 仅有示例技能 | Phase 4 — 将填充 20-30 个技能 |
| FAT32 U 盘支持 | ⚠️ junction 会回退到 copy | 推荐使用 NTFS/exFAT |

### 当前可测试的功能

```
✅ 目录结构创建
✅ setup.ps1 依赖下载
✅ START.bat 启动链路
✅ OpenClaw Gateway 启动
✅ Config Center 网页配置
✅ doctor.ps1 健康诊断
✅ backup.ps1 备份
✅ reset-system.ps1 系统重置
✅ 二层隔离 (system/ vs user/)
✅ 增量更新客户端 (update.ps1) — 本地逻辑已完整
❌ 增量更新实际下载 — 依赖 OSS 服务器
```

---

## 快速验证脚本（一键运行）

将以下内容保存为 `E:\test-all.ps1` 并运行：

```powershell
# test-all.ps1 — AI USB Assistant 快速验证
$USB = "E:\"
$errors = 0

Write-Host "=== AI USB Assistant Quick Test ===" -ForegroundColor Cyan

# Test 1: Directories
Write-Host "`n1. Directory structure..." -ForegroundColor Yellow
$dirs = @("system\runtime", "system\core", "system\scripts", "system\config-center",
          "user\config", "user\skills", "user\memory", "user\backups", "data", "cache")
foreach ($d in $dirs) {
    $p = Join-Path $USB $d
    if (Test-Path $p) { Write-Host "  [OK] $d" -ForegroundColor Green }
    else { Write-Host "  [MISS] $d" -ForegroundColor Red; $errors++ }
}

# Test 2: Node.js
Write-Host "`n2. Node.js runtime..." -ForegroundColor Yellow
$node = Join-Path $USB "system\runtime\node-win-x64\node.exe"
if (Test-Path $node) {
    $ver = & $node --version 2>&1
    Write-Host "  [OK] $ver" -ForegroundColor Green
} else { Write-Host "  [MISS] Run setup.ps1 first" -ForegroundColor Red; $errors++ }

# Test 3: OpenClaw
Write-Host "`n3. OpenClaw core..." -ForegroundColor Yellow
$oc = Join-Path $USB "system\core\node_modules\openclaw\openclaw.mjs"
if (Test-Path $oc) { Write-Host "  [OK] Found" -ForegroundColor Green }
else { Write-Host "  [MISS] Run setup.ps1 first" -ForegroundColor Red; $errors++ }

# Test 4: Scripts
Write-Host "`n4. Script files..." -ForegroundColor Yellow
$scripts = @("START.bat", "system\scripts\boot.ps1", "system\scripts\update.ps1",
             "system\scripts\doctor.ps1", "system\scripts\backup.ps1")
foreach ($s in $scripts) {
    $p = Join-Path $USB $s
    if (Test-Path $p) { Write-Host "  [OK] $s" -ForegroundColor Green }
    else { Write-Host "  [MISS] $s" -ForegroundColor Red; $errors++ }
}

# Test 5: Config Center
Write-Host "`n5. Config Center files..." -ForegroundColor Yellow
$cc = @("system\config-center\server.js", "system\config-center\Config.html")
foreach ($c in $cc) {
    $p = Join-Path $USB $c
    if (Test-Path $p) { Write-Host "  [OK] $c" -ForegroundColor Green }
    else { Write-Host "  [MISS] $c" -ForegroundColor Red; $errors++ }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
if ($errors -eq 0) {
    Write-Host " ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host " Run START.bat to launch." -ForegroundColor White
} else {
    Write-Host " $errors ISSUE(S) FOUND" -ForegroundColor Red
    Write-Host " Run setup.ps1 first if dependencies are missing." -ForegroundColor Yellow
}
```
