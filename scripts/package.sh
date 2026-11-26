#!/usr/bin/env bash
# Builds the distributable ZIP, including only the files Chrome actually loads.
# Development files (tests, lint config, lockfile, CI) stay out of the package.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
out="dist/tab-by-host-$version.zip"

node scripts/check-manifest.js
rm -rf dist && mkdir -p dist

zip -q -r "$out" \
  manifest.json background.js core.js engine.js i18n.js \
  options.html options.js popup.html popup.js styles.css \
  icons _locales LICENSE PRIVACY.md \
  -x '*.DS_Store'

echo "$out"
unzip -l "$out" | tail -n 1
