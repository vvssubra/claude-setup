#!/usr/bin/env bash
# Installs the whole Claude Code mod setup on a new machine. Needs Claude Code 2.1.287+ and git.
set -euo pipefail

echo "== Anthropic sample mods (local clone; keep the folder, the marketplace points at it)"
if [ ! -d "$HOME/.claude/claude-code-playground" ]; then
  git clone --depth 1 https://github.com/anthropics/claude-code-playground.git "$HOME/.claude/claude-code-playground"
fi
claude plugin marketplace add "$HOME/.claude/claude-code-playground/claude-code/mods" || true
for m in blast-radius replay-theater token-weather; do
  claude plugin install "$m@claude-code-playground-mods" --scope user
done

echo "== Community mods"
claude plugin marketplace add promptadvisers/claude-mods-starter-kit || true
claude plugin install coral-skin@claude-mods-kit --scope user
claude plugin install model-router@claude-mods-kit --scope user

claude plugin marketplace add data-goblin/claude-code-filetree || true
claude plugin install filetree@claude-code-filetree --scope user

echo "== skills-pane (this repo)"
claude plugin marketplace add vvssubra/claude-setup || true
claude plugin install skills-pane@vvs-claude-setup --scope user

echo "Done. Start a new Claude Code session, or run /reload-plugins in an open one."
