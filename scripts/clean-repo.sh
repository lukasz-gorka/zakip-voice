#!/bin/bash
set -e

echo "=== CLEAN REPO: Reset git history ==="
echo ""

# 1. Delete remote branches (except main)
echo "--- Deleting remote branches ---"
for branch in \
  claude/add-license-documentation-61xMk \
  claude/add-toggleable-sidebar-VpFK9 \
  claude/enhance-leader-webview-THIbx \
  claude/fix-autopaste-permissions-2ILB4 \
  claude/local-whisper-models-01KsEcBpz9r7Mc1ioiW277YE
do
  echo "Deleting branch: $branch"
  git push origin --delete "$branch" || true
done

# 2. Delete all remote tags
echo ""
echo "--- Deleting remote tags ---"
git tag -l | xargs -I {} sh -c 'echo "Deleting tag: {}" && git push origin --delete "{}"' || true

# 3. Delete all local tags
echo ""
echo "--- Deleting local tags ---"
git tag -l | xargs git tag -d || true

# 4. Reset git history
echo ""
echo "--- Resetting git history ---"
rm -rf .git
git init
git add -A
git commit -m "Initial release v0.9.8"
git remote add origin git@github.com:lukasz-gorka/zakip-voice.git
git branch -M main
git push --force -u origin main

echo ""
echo "=== Done! Clean repo with single commit ==="
