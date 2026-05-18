#!/bin/bash
# =========================================================================
# setup.sh - AI USB Assistant: Download Dependencies (macOS)
# =========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYSTEM_DIR="$(dirname "$SCRIPT_DIR")"
USB_ROOT="$(dirname "$SYSTEM_DIR")"

NODE_VERSION="v22.12.0"
REGISTRY="https://registry.npmmirror.com"
NODE_MIRROR="https://npmmirror.com/mirrors/node"

CORE_DIR="$SYSTEM_DIR/core"
SKILLS_DIR="$SYSTEM_DIR/skills"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; NC='\033[0m'

echo ""
echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   AI USB Assistant - Setup (macOS)  ║"
echo "  ║   Downloading dependencies...       ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ---- Step 1: Detect architecture & download Node.js ----
echo -e "  ${CYAN}Step 1/4: Node.js Runtime${NC}"

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    NODE_ARCH="darwin-arm64"
    NODE_DIRNAME="node-mac-arm64"
elif [ "$ARCH" = "x86_64" ]; then
    NODE_ARCH="darwin-x64"
    NODE_DIRNAME="node-mac-x64"
else
    echo -e "  ${RED}[X] Unsupported architecture: $ARCH${NC}"
    exit 1
fi

NODE_DIR="$SYSTEM_DIR/runtime/$NODE_DIRNAME"

if [ -x "$NODE_DIR/bin/node" ]; then
    NODE_VER=$("$NODE_DIR/bin/node" --version)
    echo -e "  ${GREEN}[OK] Node.js $NODE_VER already present${NC}"
else
    NODE_ARCHIVE="node-${NODE_VERSION}-${NODE_ARCH}.tar.gz"
    NODE_URL="${NODE_MIRROR}/${NODE_VERSION}/${NODE_ARCHIVE}"

    echo -e "  Downloading Node.js ${NODE_VERSION} (${NODE_ARCH})..."
    echo -e "  Source: ${NODE_URL}"

    mkdir -p "$SYSTEM_DIR/runtime"
    cd "$SYSTEM_DIR/runtime"

    curl -fsSL "$NODE_URL" -o "$NODE_ARCHIVE"
    echo -e "  Extracting..."
    tar -xzf "$NODE_ARCHIVE"
    rm "$NODE_ARCHIVE"

    # Rename extracted directory
    EXTRACTED_DIR="node-${NODE_VERSION}-${NODE_ARCH}"
    if [ -d "$EXTRACTED_DIR" ]; then
        mv "$EXTRACTED_DIR" "$NODE_DIRNAME"
    fi

    if [ -x "$NODE_DIR/bin/node" ]; then
        NODE_VER=$("$NODE_DIR/bin/node" --version)
        echo -e "  ${GREEN}[OK] Node.js $NODE_VER installed${NC}"
    else
        echo -e "  ${RED}[X] Node.js extraction failed${NC}"
        exit 1
    fi
fi

# ---- Step 2: Setup OpenClaw Core ----
echo -e "  ${CYAN}Step 2/4: OpenClaw Core${NC}"

NODE_BIN="$NODE_DIR/bin/node"
NPM_BIN="$NODE_DIR/bin/npm"

mkdir -p "$CORE_DIR"

if [ ! -f "$CORE_DIR/package.json" ]; then
    cat > "$CORE_DIR/package.json" << 'PKGEOF'
{
  "name": "ai-usb-core",
  "version": "1.0.0",
  "private": true,
  "description": "AI USB Assistant - OpenClaw Core",
  "dependencies": {
    "openclaw": "latest"
  }
}
PKGEOF
    echo -e "  ${GREEN}[OK] package.json created${NC}"
fi

if [ ! -d "$CORE_DIR/node_modules" ]; then
    echo -e "  Installing OpenClaw (this may take a few minutes)..."
    cd "$CORE_DIR"
    "$NPM_BIN" install --registry="$REGISTRY" 2>&1

    if [ -f "$CORE_DIR/node_modules/openclaw/openclaw.mjs" ]; then
        echo -e "  ${GREEN}[OK] OpenClaw installed${NC}"
    else
        echo -e "  ${RED}[X] OpenClaw installation may have failed${NC}"
        exit 1
    fi
fi

# ---- Step 3: Setup Skills ----
echo -e "  ${CYAN}Step 3/4: Skills${NC}"

mkdir -p "$SKILLS_DIR"

# Check if U-Claw portable/skills-cn exists nearby
UCLAW_SKILLS="$USB_ROOT/../uclaw/u-claw/portable/skills-cn"
if [ -d "$UCLAW_SKILLS" ]; then
    echo -e "  Found U-Claw skills"
    cp -R "$UCLAW_SKILLS/"* "$SKILLS_DIR/"
    SKILL_COUNT=$(ls -1 "$SKILLS_DIR" | wc -l | tr -d ' ')
    echo -e "  ${GREEN}[OK] Copied $SKILL_COUNT skills${NC}"
else
    echo -e "  ${YELLOW}[!] U-Claw skills-cn not found nearby${NC}"

    # Create sample skill
    mkdir -p "$SKILLS_DIR/system-info"
    cat > "$SKILLS_DIR/system-info/SKILL.md" << 'SKILLEOF'
---
name: system-info
description: Display system and version information
---
# System Info

This skill provides information about the AI USB Assistant system status.

## Usage

Ask: "What version am I running?" or "Show system status"
SKILLEOF
    echo -e "  ${GREEN}[OK] Created sample skill${NC}"
fi

# ---- Step 4: Generate Manifest ----
echo -e "  ${CYAN}Step 4/4: Generating manifest${NC}"

# Simple manifest generation (bash version)
MANIFEST_FILE="$SYSTEM_DIR/manifest.json"

generate_manifest() {
    local dir="$1"
    echo "{"
    echo "  \"product\": \"ai-usb-assistant\","
    echo "  \"version\": \"$(cat "$SYSTEM_DIR/VERSION" 2>/dev/null || echo '0.0.0')\","
    echo "  \"channel\": \"alpha\","
    echo "  \"minUserLayerVersion\": 1,"
    echo "  \"compatibility\": {"
    echo "    \"openclaw\": \">=2026.3.0\","
    echo "    \"node\": \">=22.12.0\""
    echo "  },"
    echo "  \"files\": {"

    local first=true
    while IFS= read -r -d '' file; do
        local rel="${file#$USB_ROOT/}"
        # Skip cache, data, user directories
        [[ "$rel" == cache/* ]] && continue
        [[ "$rel" == data/* ]] && continue
        [[ "$rel" == user/* ]] && continue
        [[ "$rel" == system_new/* ]] && continue
        [[ "$rel" == system_old/* ]] && continue

        local hash=$(shasum -a 256 "$file" 2>/dev/null | cut -d' ' -f1)
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
        local required="true"
        [[ "$rel" == system/skills/* ]] && required="false"

        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        printf '    "%s": {"sha256": "%s", "size": %s, "required": %s}' "$rel" "$hash" "$size" "$required"
    done < <(find "$SYSTEM_DIR" -type f -print0)

    echo ""
    echo "  },"
    echo "  \"removedFiles\": [],"
    echo "  \"releaseNotes\": \"Setup generated manifest\","
    echo "  \"publishedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"updateType\": \"initial\""
    echo "}"
}

generate_manifest > "$MANIFEST_FILE"
echo -e "  ${GREEN}[OK] Manifest generated${NC}"

# ---- Done ----
echo ""
echo -e "  ${GREEN}════════════════════════════════${NC}"
echo -e "  ${GREEN} Setup complete!${NC}"
echo ""
echo -e "  ${CYAN}To start the AI Assistant:${NC}"
echo -e "    Double-click START.command"
echo ""
echo -e "  USB Root: $USB_ROOT"
echo -e "  ${GREEN}════════════════════════════════${NC}"
echo ""
