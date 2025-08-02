#!/bin/bash

# Vercel ignoreCommand logic for docs deployment:
# Exit 0 = PROCEED with build
# Exit 1 = SKIP/IGNORE the build

echo "🔍 Checking for changes in docs/ or package.json..."
echo "📍 Current branch: $(git branch --show-current)"

# Check if this is the initial commit
if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "📦 Initial commit detected, proceeding with build..."
  exit 0
fi

# Check for changes in docs/ directory OR package.json
if git diff --quiet HEAD^ HEAD -- docs/ package.json; then
  echo "⏭️  No changes in docs/ or package.json, SKIPPING build"
  exit 1
else
  echo "✅ Changes detected in docs/ or package.json, PROCEEDING with build..."
  exit 0
fi 