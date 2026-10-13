#!/bin/bash
set -euo pipefail
recordly_project_root="$(cd "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22 or newer, then run this file again."
  exit 1
fi
exec node "$recordly_project_root/scripts/build-gabriel-mac.mjs"
