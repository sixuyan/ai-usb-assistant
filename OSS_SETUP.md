# OSS_SETUP.md — Alibaba Cloud OSS Configuration Guide

> 本文档指导你配置阿里云 OSS 以支持 AI USB Assistant 的增量更新系统。

---

## 架构概览

```
开发者机器                              阿里云 OSS                    用户 U 盘
─────────                              ─────────                    ─────────
release.ps1  ──upload──>  ai-usb-updates (bucket)                 UPDATE.bat
                           └─ releases/                    ──HTTP GET──>  update.ps1
                               ├─ stable/
                               │   ├─ manifest.json                   比较 manifest
                               │   └─ files/                          下载差异文件
                               │       └─ system/...                  → system_new/
                               └─ beta/
                                   └─ ...
                                           │
                                     CDN 加速 (optional)
                                     国内用户更快下载
```

---

## 第一步：创建 OSS Bucket

### 1.1 登录阿里云控制台

1. 打开 https://oss.console.aliyun.com/
2. 登录你的阿里云账号（需实名认证）

### 1.2 创建 Bucket

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Bucket 名称 | `ai-usb-updates` | 全局唯一，如果已被占用加后缀 |
| 地域 | `华东1（杭州）` | `oss-cn-hangzhou` |
| 存储类型 | 标准存储 | 频繁访问 |
| 读写权限 | **公共读** | 用户需要下载更新文件 |
| 版本控制 | 关闭 | 不需要 |
| 服务端加密 | 无 | 开源项目，无需加密 |

> ⚠️ **重要**：读写权限必须设为「公共读」，否则用户无法下载更新。

### 1.3 记录信息

创建完成后记录以下信息（填入下方的 TODO 占位符）：

```
OSS Endpoint:  oss-cn-hangzhou.aliyuncs.com
Bucket 名称:   ai-usb-updates
Bucket 域名:   ai-usb-updates.oss-cn-hangzhou.aliyuncs.com
```

---

## 第二步：创建 AccessKey

### 2.1 创建 RAM 用户（推荐）

1. 打开 https://ram.console.aliyun.com/users
2. 创建用户 → 选择「OpenAPI 调用访问」
3. 用户名：`ai-usb-release-bot`
4. 权限策略：添加 `AliyunOSSFullAccess`

### 2.2 获取 AccessKey

1. 创建完成后，保存 **AccessKey ID** 和 **AccessKey Secret**
2. ⚠️ Secret 只显示一次，务必保存好

### 2.3 配置环境变量

在你的开发机器上设置（PowerShell）：

```powershell
# TODO: 替换为真实值
$env:OSS_ACCESS_KEY_ID     = "LTAI5tXXXXXXXXXXXXXX"
$env:OSS_ACCESS_KEY_SECRET = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 持久化（写入用户环境变量）
[Environment]::SetEnvironmentVariable("OSS_ACCESS_KEY_ID", "LTAI5tXXXXXXXXXXXXXX", "User")
[Environment]::SetEnvironmentVariable("OSS_ACCESS_KEY_SECRET", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "User")
```

---

## 第三步：安装 ossutil（推荐）

### 3.1 下载

```powershell
# Windows (PowerShell)
Invoke-WebRequest -Uri "https://gosspublic.alicdn.com/ossutil/1.7.19/ossutil64.zip" -OutFile "$env:TEMP\ossutil.zip"
Expand-Archive "$env:TEMP\ossutil.zip" -DestinationPath "C:\tools\"
# 将 C:\tools\ 加入 PATH
```

### 3.2 配置

```bash
ossutil config
# 按提示输入：
#   endpoint: oss-cn-hangzhou.aliyuncs.com
#   accessKeyID: <你的 AccessKey ID>
#   accessKeySecret: <你的 AccessKey Secret>
#   stsToken: (留空)
```

### 3.3 验证

```bash
ossutil ls oss://ai-usb-updates/
# 应该无报错（bucket 可能为空）
```

---

## 第四步：创建 OSS 目录结构

```bash
# 使用 ossutil 创建目录
ossutil mkdir oss://ai-usb-updates/releases/
ossutil mkdir oss://ai-usb-updates/releases/stable/
ossutil mkdir oss://ai-usb-updates/releases/stable/files/
ossutil mkdir oss://ai-usb-updates/releases/beta/
ossutil mkdir oss://ai-usb-updates/releases/beta/files/
```

---

## 第五步：第一次发布

### 5.1 设置版本号

编辑 `system/VERSION`：

```
2026.5.19-alpha.2
```

### 5.2 运行发布

```powershell
cd C:\Users\sixuy\Desktop\ai-usb-assistant
.\system\scripts\release.ps1 -Channel stable
```

### 5.3 验证发布

```powershell
# 检查 manifest 是否可访问
Invoke-WebRequest -Uri "https://ai-usb-updates.oss-cn-hangzhou.aliyuncs.com/releases/stable/manifest.json" -UseBasicParsing
```

---

## 第六步：（可选）配置 CDN 加速

### 6.1 开通 CDN

1. 打开 OSS 控制台 → 选择 bucket → 数据处理 → CDN 加速
2. 添加 CDN 域名（如 `cdn.ai-usb.example.com`）
3. 配置 HTTPS 证书

### 6.2 更新代码中的 CDN URL

如果配置了 CDN，更新 `system/scripts/update.ps1` 中的 `$OSS_BASE`：

```powershell
# TODO: 替换为你的 CDN 域名
$OSS_BASE = "https://cdn.ai-usb.example.com"
```

### 6.3 缓存刷新

每次发布后手动刷新 CDN：

```bash
# 使用 aliyun CLI
aliyun cdn RefreshObjectCaches --ObjectPath https://cdn.ai-usb.example.com/releases/stable/manifest.json
```

---

## 费用预估

| 项目 | 单价 | 月估 |
|------|------|------|
| OSS 存储 | ~0.12 元/GB/月 | 300MB system = ~0.04 元/月 |
| OSS 外网流量 | 0.5 元/GB | 假设 100 用户/月 × 50MB = 5GB = ~2.5 元/月 |
| CDN 流量 | 0.2 元/GB | 同上 5GB = ~1 元/月 |
| **合计** | | **< 5 元/月**（小规模） |

---

## TODO 清单

在实际部署前，需要完成以下事项：

- [ ] `$env:OSS_ACCESS_KEY_ID` — 填入真实 AccessKey ID
- [ ] `$env:OSS_ACCESS_KEY_SECRET` — 填入真实 AccessKey Secret
- [ ] 确认 OSS Bucket `ai-usb-updates` 已创建且为公共读
- [ ] 安装并配置 ossutil
- [ ] 运行 `release.ps1` 完成首次发布
- [ ] 验证 `https://ai-usb-updates.oss-cn-hangzhou.aliyuncs.com/releases/stable/manifest.json` 可访问
- [ ] （可选）配置 CDN 加速域名
- [ ] （可选）配置 GitHub Actions 自动发布

---

## 代码中的 TODO 标记

以下文件中有 OSS 相关占位符，部署时需检查：

| 文件 | 占位符 | 说明 |
|------|--------|------|
| `system/scripts/release.ps1` | `$OssBucket`, `$OssEndpoint` | 默认值已配置，Bucket 名变化时更新 |
| `system/scripts/update.ps1` | `$OSS_BASE` | 默认值已配置，CDN 就绪后更新 |
| `system/scripts/release.ps1` | REST API upload (L116) | 当前仅支持 ossutil，待实现 |
| `system/scripts/release.ps1` | CDN refresh (L140) | 当前为手动步骤，待自动 |
