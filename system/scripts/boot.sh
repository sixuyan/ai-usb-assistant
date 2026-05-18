#!/bin/bash
# =========================================================================
# boot.sh - AI USB Assistant Core Boot Logic (macOS)
# =========================================================================
# Two-Layer Architecture:
#   System Layer (system/)  - Immutable, updated atomically
#   User Layer   (user/)    - Persistent, never touched by updates
# =========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYSTEM_DIR="$(dirname "$SCRIPT_DIR")"
USB_ROOT="$(dirname "$SYSTEM_DIR")"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    NODE_ARCH="node-mac-arm64"
elif [ "$ARCH" = "x86_64" ]; then
    NODE_ARCH="node-mac-x64"
else
    echo "  Unsupported architecture: $ARCH"
    exit 1
fi

NODE_DIR="$SYSTEM_DIR/runtime/$NODE_ARCH"
NODE_BIN="$NODE_DIR/bin/node"
NPM_BIN="$NODE_DIR/bin/npm"
CORE_DIR="$SYSTEM_DIR/core"
OPENCLAW_MJS="$CORE_DIR/node_modules/openclaw/openclaw.mjs"

MANIFEST_FILE="$SYSTEM_DIR/manifest.json"
VERSION_FILE="$SYSTEM_DIR/VERSION"
CONFIG_FILE="$USB_ROOT/user/config/openclaw.json"

DATA_DIR="$USB_ROOT/data"
CACHE_DIR="$USB_ROOT/cache"
SYSTEM_NEW="$USB_ROOT/system_new"
SYSTEM_OLD="$USB_ROOT/system_old"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; NC='\033[0m'

# ---- Check-only mode ----
if [ "${1:-}" = "--check-only" ]; then
    echo "Checking system integrity..."
    if [ ! -f "$NODE_BIN" ]; then
        echo "  [X] Node.js runtime not found: $NODE_BIN"
        exit 1
    fi
    if [ ! -f "$OPENCLAW_MJS" ]; then
        echo "  [X] OpenClaw not found: $OPENCLAW_MJS"
        exit 1
    fi
    echo "  [OK] System integrity verified"
    exit 0
fi

# ---- Atomic Update Check ----
if [ -d "$SYSTEM_NEW" ]; then
    echo ""
    echo -e "  ${CYAN}Pending system update detected. Activating...${NC}"

    # Verify new system
    if [ ! -f "$SYSTEM_NEW/scripts/boot.sh" ]; then
        echo -e "  ${YELLOW}system_new/ missing boot.sh - cleaning up${NC}"
        rm -rf "$SYSTEM_NEW"
    else
        # Backup current
        [ -d "$SYSTEM_OLD" ] && rm -rf "$SYSTEM_OLD"
        mv "$SYSTEM_DIR" "$SYSTEM_OLD"

        # Activate new
        mv "$SYSTEM_NEW" "$SYSTEM_DIR"
        NEW_VERSION=$(cat "$SYSTEM_DIR/VERSION" 2>/dev/null || echo "unknown")
        echo -e "  ${GREEN}[OK] System updated to $NEW_VERSION${NC}"

        # Verify
        if "$SYSTEM_DIR/scripts/boot.sh" --check-only; then
            echo -e "  ${GREEN}[OK] New system verified - cleaning old backup${NC}"
            rm -rf "$SYSTEM_OLD"
        else
            echo -e "  ${RED}[X] New system failed verification - rolling back${NC}"
            mv "$SYSTEM_DIR" "$USB_ROOT/system_broken"
            mv "$SYSTEM_OLD" "$SYSTEM_DIR"
            echo -e "  ${YELLOW}[!] Rolled back to previous version${NC}"
        fi

        # Re-source variables after swap
        NODE_BIN="$SYSTEM_DIR/runtime/$NODE_ARCH/bin/node"
        NPM_BIN="$SYSTEM_DIR/runtime/$NODE_ARCH/bin/npm"
        OPENCLAW_MJS="$CORE_DIR/node_modules/openclaw/openclaw.mjs"
    fi
fi

# ---- Banner ----
echo ""
echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     AI USB Assistant                ║"
echo "  ║     Portable AI Agent (macOS)       ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ---- Check Runtime ----
if [ ! -f "$NODE_BIN" ]; then
    echo -e "  ${RED}[X] Node.js runtime not found${NC}"
    echo "  Please run: bash system/scripts/setup.sh"
    exit 1
fi

NODE_VER=$("$NODE_BIN" --version)
echo -e "  Node.js: ${GREEN}${NODE_VER}${NC} (${ARCH})"
echo ""

# ---- Create Directories ----
mkdir -p "$USER_DIR/config" "$USER_DIR/skills" "$USER_DIR/memory"
mkdir -p "$USER_DIR/identity" "$USER_DIR/workspace" "$USER_DIR/devices"
mkdir -p "$USER_DIR/browser" "$USER_DIR/backups" "$USER_DIR/logs"
mkdir -p "$DATA_DIR/.openclaw" "$DATA_DIR/memory" "$DATA_DIR/workspace" "$DATA_DIR/skills"
mkdir -p "$CACHE_DIR/temp" "$CACHE_DIR/npm" "$CACHE_DIR/home"

# ---- Data Bridge (Symlinks) ----
echo -e "  ${CYAN}Setting up data bridge...${NC}"

link_if_needed() {
    local link="$1" target="$2"
    if [ -L "$link" ]; then
        rm "$link"
    elif [ -d "$link" ]; then
        rm -rf "$link"
    fi
    ln -s "$target" "$link" 2>/dev/null && echo -e "  ${GREEN}[OK] Linked: $link -> $target${NC}" || true
}

link_if_needed "$DATA_DIR/.openclaw" "$USER_DIR/config"
link_if_needed "$DATA_DIR/memory"     "$USER_DIR/memory"
link_if_needed "$DATA_DIR/workspace"  "$USER_DIR/workspace"

# Skills merge
rm -rf "$DATA_DIR/skills"/*
[ -d "$SYSTEM_DIR/skills" ] && cp -R "$SYSTEM_DIR/skills/"* "$DATA_DIR/skills/" 2>/dev/null || true
[ -d "$USER_DIR/skills" ]   && cp -R "$USER_DIR/skills/"*   "$DATA_DIR/skills/" 2>/dev/null || true
SKILL_COUNT=$(ls -1 "$DATA_DIR/skills" 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${GREEN}[OK] Skills ready ($SKILL_COUNT skills)${NC}"

# ---- Set Environment Variables ----
export OPENCLAW_HOME="$DATA_DIR"
export OPENCLAW_STATE_DIR="$DATA_DIR/.openclaw"
export OPENCLAW_CONFIG_PATH="$CONFIG_FILE"
export OPENCLAW_SKILLS_PATH="$DATA_DIR/skills"
export TMPDIR="$CACHE_DIR/temp"
export NPM_CONFIG_CACHE="$CACHE_DIR/npm"
export HOME="$CACHE_DIR/home"

export PATH="$NODE_DIR/bin:$PATH"

# ---- Remove macOS Quarantine ----
if xattr -l "$NODE_BIN" 2>/dev/null | grep -q "com.apple.quarantine"; then
    xattr -rd com.apple.quarantine "$USB_ROOT" 2>/dev/null || true
fi

# ---- First Run: Default Config ----
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "  ${YELLOW}First run - creating default config...${NC}"
    cat > "$CONFIG_FILE" << 'CFGEOF'
{
  "gateway": {
    "mode": "local",
    "auth": { "token": "uclaw" }
  }
}
CFGEOF
    echo -e "  ${GREEN}[OK] Default config created${NC}"
fi

# ---- Check Dependencies ----
if [ ! -d "$CORE_DIR/node_modules" ]; then
    echo -e "  ${YELLOW}Installing dependencies (China mirror)...${NC}"
    cd "$CORE_DIR"
    "$NPM_BIN" install --registry=https://registry.npmmirror.com 2>&1
    echo -e "  ${GREEN}[OK] Dependencies installed${NC}"
    echo ""
fi

# ---- Find Available Port ----
PORT=18789
while lsof -i :$PORT >/dev/null 2>&1; do
    PORT=$((PORT + 1))
    if [ $PORT -gt 18799 ]; then
        echo -e "  ${RED}[X] No available port (18789-18799)${NC}"
        exit 1
    fi
done
echo -e "  ${CYAN}Using port: $PORT${NC}"

# ---- Start Config Center ----
CONFIG_SERVER="$SYSTEM_DIR/config-center/server.js"
if [ -f "$CONFIG_SERVER" ]; then
    "$NODE_BIN" "$CONFIG_SERVER" &
    CONFIG_PID=$!
    sleep 1
    echo -e "  ${GREEN}[OK] Config Center started on port 18788${NC}"
fi

# ---- Start Gateway ----
echo -e "  ${CYAN}Starting AI Gateway on port $PORT...${NC}"
echo ""

cd "$CORE_DIR"
"$NODE_BIN" "$OPENCLAW_MJS" gateway run --allow-unconfigured --force --port $PORT &
GW_PID=$!

# ---- Wait for Ready, Open Browser ----
for i in $(seq 1 30); do
    sleep 0.5
    if curl -s -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
        open "http://127.0.0.1:$PORT/#token=uclaw" 2>/dev/null || true

        # Also open Config Center on first run
        if [ ! -f "$CONFIG_FILE" ] || [ $(wc -c < "$CONFIG_FILE") -lt 100 ]; then
            open "http://127.0.0.1:18788/" 2>/dev/null || true
        fi
        break
    fi
done

echo -e "  ${GREEN}════════════════════════════════${NC}"
echo -e "  ${GREEN} AI Assistant is running!${NC}"
echo -e "  ${GREEN}   Dashboard:     http://127.0.0.1:$PORT/#token=uclaw${NC}"
echo -e "  ${GREEN}   Config Center: http://127.0.0.1:18788/${NC}"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop${NC}"
echo -e "  ${GREEN}════════════════════════════════${NC}"
echo ""

# ---- Cleanup ----
cleanup() {
    kill $GW_PID 2>/dev/null || true
    kill ${CONFIG_PID:-} 2>/dev/null || true
    rm -rf "$CACHE_DIR/temp"/*
    echo ""
    echo -e "  AI Assistant stopped. Safe to remove U-disk."
    exit 0
}
trap cleanup INT TERM

wait $GW_PID
