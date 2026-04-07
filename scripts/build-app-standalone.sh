#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WEB_DIR="${ROOT_DIR}/apps/web"
ELECTRON_DIR="${ROOT_DIR}/apps/electron"

cd "${ROOT_DIR}"

echo "Running build..."
yarn run build

STANDALONE_SRC="${WEB_DIR}/.next/standalone"
STANDALONE_WEB_SRC="${STANDALONE_SRC}/apps/web"
OUT_DIR="${ROOT_DIR}/release/standalone"
OUT_WEB_DIR="${OUT_DIR}/apps/web"
OUT_WEB_NEXT_NODE_MODULES_DIR="${OUT_WEB_DIR}/.next/node_modules"

if [[ ! -d "${STANDALONE_SRC}" ]]; then
  echo "Error: standalone output not found: ${STANDALONE_SRC}" >&2
  exit 1
fi

if [[ ! -f "${STANDALONE_WEB_SRC}/server.js" ]]; then
  echo "Error: standalone server.js not found: ${STANDALONE_WEB_SRC}/server.js" >&2
  exit 1
fi

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_WEB_DIR}"

# 1) root node_modules
if [[ -d "${STANDALONE_SRC}/node_modules" ]]; then
  cp -a "${STANDALONE_SRC}/node_modules" "${OUT_DIR}/node_modules"
fi

# 2) apps/web required files
cp -f "${STANDALONE_WEB_SRC}/server.js" "${OUT_WEB_DIR}/server.js"
cp -f "${WEB_DIR}/package.json" "${OUT_WEB_DIR}/package.json"

# Optional .env files
if [[ -f "${STANDALONE_WEB_SRC}/.env" ]]; then
  cp -f "${STANDALONE_WEB_SRC}/.env" "${OUT_WEB_DIR}/.env"
fi
if [[ -f "${STANDALONE_WEB_SRC}/.env.local" ]]; then
  cp -f "${STANDALONE_WEB_SRC}/.env.local" "${OUT_WEB_DIR}/.env.local"
fi

# 3) apps/web/.next
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "${STANDALONE_WEB_SRC}/.next/" "${OUT_WEB_DIR}/.next/"
  if [[ -d "${WEB_DIR}/.next/static" ]]; then
    rsync -a --delete "${WEB_DIR}/.next/static/" "${OUT_WEB_DIR}/.next/static/"
  fi
else
  mkdir -p "${OUT_WEB_DIR}/.next"
  cp -R "${STANDALONE_WEB_SRC}/.next/." "${OUT_WEB_DIR}/.next/"
  if [[ -d "${WEB_DIR}/.next/static" ]]; then
    mkdir -p "${OUT_WEB_DIR}/.next/static"
    cp -R "${WEB_DIR}/.next/static/." "${OUT_WEB_DIR}/.next/static/"
  fi
fi

# 4) apps/web/public
if [[ -d "${WEB_DIR}/public" ]]; then
  cp -a "${WEB_DIR}/public" "${OUT_WEB_DIR}/public"
fi

# 5) apps/web/dist-scripts (if exists)
if [[ -d "${WEB_DIR}/dist-scripts" ]]; then
  cp -a "${WEB_DIR}/dist-scripts" "${OUT_WEB_DIR}/dist-scripts"
fi

BETTER_SQLITE3_DIR="${OUT_DIR}/node_modules/better-sqlite3"
if [[ -d "${BETTER_SQLITE3_DIR}" ]]; then
  ROOT_BETTER_SQLITE3_DIR="${ROOT_DIR}/node_modules/better-sqlite3"
  ELECTRON_VERSION="$(node -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const version=pkg.devDependencies?.electron || pkg.dependencies?.electron || ''; process.stdout.write(String(version).replace(/^[^0-9]*/, ''));" "${ELECTRON_DIR}/package.json")"
  TARGET_ARCH="${DORY_BUILD_ARCH:-}"
  PREBUILD_INSTALL_BIN="${ROOT_DIR}/node_modules/.bin/prebuild-install"

  # Next standalone keeps only runtime files for externals, but rebuilding the native
  # addon for Electron requires the package sources and binding.gyp from the full install.
  if [[ -d "${ROOT_BETTER_SQLITE3_DIR}" ]] && [[ ! -f "${BETTER_SQLITE3_DIR}/binding.gyp" ]]; then
    echo "Overlaying full better-sqlite3 package into standalone output..."
    rm -rf "${BETTER_SQLITE3_DIR}"
    cp -a "${ROOT_BETTER_SQLITE3_DIR}" "${BETTER_SQLITE3_DIR}"
  fi

  if [[ -n "${ELECTRON_VERSION}" ]]; then
    PREBUILD_ARGS=(
      --runtime=electron
      --target="${ELECTRON_VERSION}"
      --dist-url=https://electronjs.org/headers
      --verbose
    )
    REBUILD_ARGS=(
      better-sqlite3
      --build-from-source
      --runtime=electron
      --target="${ELECTRON_VERSION}"
      --dist-url=https://electronjs.org/headers
    )
    if [[ -n "${TARGET_ARCH}" ]]; then
      PREBUILD_ARGS+=(--arch="${TARGET_ARCH}")
      REBUILD_ARGS+=(--arch="${TARGET_ARCH}")
    fi

    echo "Resolving better-sqlite3 for Electron ${ELECTRON_VERSION}${TARGET_ARCH:+ (${TARGET_ARCH})}..."
    (
      cd "${BETTER_SQLITE3_DIR}"

      if [[ -x "${PREBUILD_INSTALL_BIN}" ]]; then
        echo "Trying prebuilt better-sqlite3 binary..."
        if "${PREBUILD_INSTALL_BIN}" "${PREBUILD_ARGS[@]}"; then
          echo "Using prebuilt better-sqlite3 binary."
          exit 0
        fi
      fi

      echo "No prebuilt better-sqlite3 binary available, falling back to rebuild..."
      cd "${OUT_DIR}"
      npm rebuild "${REBUILD_ARGS[@]}"
    )
  fi
fi

if [[ -d "${BETTER_SQLITE3_DIR}" ]] && [[ -d "${OUT_WEB_NEXT_NODE_MODULES_DIR}" ]]; then
  while IFS= read -r -d '' better_sqlite3_link; do
    if [[ -L "${better_sqlite3_link}" ]]; then
      echo "Materializing $(basename "${better_sqlite3_link}") in apps/web/.next/node_modules..."
      rm -f "${better_sqlite3_link}"
      cp -a "${BETTER_SQLITE3_DIR}" "${better_sqlite3_link}"
    fi
  done < <(find "${OUT_WEB_NEXT_NODE_MODULES_DIR}" -maxdepth 1 -type l -name 'better-sqlite3-*' -print0)
fi

echo "Output ready: ${OUT_DIR}"
echo "Included top-level entries:"
ls -1A "${OUT_DIR}"
echo "Included apps/web entries:"
ls -1A "${OUT_WEB_DIR}"
