# claude-setup

My Claude Code mod setup, installable on any machine in one go. Mods need Claude Code 2.1.287 or newer.

## Install everything

```bash
git clone https://github.com/vvssubra/claude-setup.git
bash claude-setup/install.sh
```

The script adds three marketplaces and installs seven mods at user scope:

| Mod | From | What it does |
| --- | --- | --- |
| blast-radius | Anthropic samples | Holds risky shell commands and shows what they would change |
| replay-theater | Anthropic samples | `/replay` steps through the last turn's file edits |
| token-weather | Anthropic samples | Context window forecast above the prompt |
| coral-skin | promptadvisers/claude-mods-starter-kit | Coral, ink and cream reskin, `/skin` |
| model-router | promptadvisers/claude-mods-starter-kit | `/router` sends subagents to Sonnet or Haiku |
| filetree | data-goblin/claude-code-filetree | IDE-style file tree pane, `/filetree` |
| skills-pane | this repo | Pane of every skill, click to run, UI colour button |

The Anthropic samples have no GitHub marketplace, so the script clones their repo to `~/.claude/claude-code-playground` and points a marketplace at that folder. Keep the folder.

## Install only skills-pane

At the prompt of a terminal session:

```
/plugin install skills-pane --marketplace vvssubra/claude-setup
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```bash
claude plugin install skills-pane --marketplace vvssubra/claude-setup
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `vvssubra/claude-setup`, then Add plugin.

## skills-pane

- Opens a docked pane at session start; `/skills-pane` reopens it.
- Filter box searches name, source and description.
- Skills grouped by source (plugin name or `user`); click a row to run it as `/name`.
- `▴ prev` / `▾ next` page through the list.
- `🎨 <palette>` in the header cycles a UI colour (off, coral, ocean, forest, violet, amber) laid over your prompts, Claude's replies, tool rows and the spinner. Remembered across sessions.

Built with Claude Code's plugin-authoring skill. Source in `plugins/skills-pane/`; `claude plugin validate plugins/skills-pane` and `claude plugin test plugins/skills-pane` check it.
