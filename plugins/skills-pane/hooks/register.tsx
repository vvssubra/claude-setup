import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SkillRow, Theme } from '../types'

const PANE = 'skills-pane'
const skills = atom({ plugin: 'skills-pane', key: 'skills' } as const, [] as SkillRow[], {
  shape: 'skills-2',
})
const filter = atom({ plugin: 'skills-pane', key: 'filter' } as const, '')
const offset = atom({ plugin: 'skills-pane', key: 'offset' } as const, 0)
const theme = atom({ plugin: 'skills-pane', key: 'theme' } as const, { value: '', options: [] } as Theme)

// Claude Code's own theme row in /config: its current value and the names it may take.
async function loadTheme($: EngineInterface): Promise<void> {
  const row = (await $.config.list()).find(r => r.key === 'theme')
  await update($, theme, () => ({ value: String(row?.value ?? ''), options: [...(row?.options ?? [])] }))
}

async function cycleTheme($: EngineInterface): Promise<void> {
  const t = await read($, theme)
  if (!t.options.length) return
  const next = t.options[(t.options.indexOf(t.value) + 1) % t.options.length] ?? t.options[0]
  if (next === undefined) return
  const set = await $.config.set({ key: 'theme', value: next })
  if ('deny' in set) $.ui.toast(`theme: ${set.deny}`)
  await loadTheme($)
}

type Line = { kind: 'head'; source: string; count: number } | { kind: 'item'; skill: SkillRow }

async function load($: EngineInterface): Promise<void> {
  // $.command.list() names every slash command, skills included; the engine's own are left out.
  const rows: SkillRow[] = (await $.command.list())
    .filter(c => c.source !== 'builtin')
    .map(c => ({ name: c.name, source: c.plugin ?? c.source, description: c.description ?? '' }))  // a few commands list none at run time
  rows.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
  await update($, skills, () => rows)
}

// One header line per source, then its skills; the list arrives sorted by source.
function toLines(list: SkillRow[]): Line[] {
  const lines: Line[] = []
  let head: Extract<Line, { kind: 'head' }> | undefined
  for (const skill of list) {
    if (head?.source !== skill.source) {
      head = { kind: 'head', source: skill.source, count: 0 }
      lines.push(head)
    }
    head.count += 1
    lines.push({ kind: 'item', skill })
  }
  return lines
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'skills-pane', description: 'Show every skill in a pane; click one to run it' })
    await load($)
    await loadTheme($)
    void $.ui.open({ id: PANE, title: 'Skills', columns: 120 }) // asks the widest dock the surface allows, 45% of the window
    return next(e)
  })

  on('command.run', { command: 'skills-pane' }, async $ => {
    await load($)
    await loadTheme($)
    const opened = await $.ui.open({ id: PANE, title: 'Skills', columns: 120 }) // asks the widest dock the surface allows, 45% of the window
    const n = (await read($, skills)).length
    return { text: opened.isPlaced ? `Skills pane opened, ${n} skills.` : `Skills pane not placed: ${opened.reason}` }
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await update($, offset, n => Math.max(0, (n ?? 0) + e.by))
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface === 'mobile') return next(e)
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const all = await read($, skills)
    const q = await read($, filter)
    const needle = q.toLowerCase()
    const list = needle
      ? all.filter(s => s.name.includes(needle) || s.source.includes(needle) || s.description.toLowerCase().includes(needle))
      : all
    const lines = toLines(list)
    const width = e.props.bodyColumns
    // A window of rows on every surface: the desktop left a tree of 400+ rows blank on its first draw.
    const room = Math.max(1, (e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 24) - 5)
    const from = Math.min(await read($, offset), Math.max(0, lines.length - room))
    const shown = lines.slice(from, from + room)
    const page = (by: number) => void update($, offset, n => Math.max(0, Math.min(lines.length - room, (n ?? 0) + by)))

    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between" paddingX={1}>
          <Text bold color="cyan">
            ⚡ Skills
          </Text>
          <Box gap={1}>
            <Text dimColor>
              {list.length}/{all.length}
            </Text>
            <Button key="theme" plain onPress={() => void cycleTheme($)}>
              🎨 {(await read($, theme)).value || 'theme'}
            </Button>
          </Box>
        </Box>
        <Box paddingX={1}>
          <Input
            key="filter"
            label="🔎"
            placeholder="type to filter"
            value={q}
            onInput={v => void update($, filter, () => v).then(() => update($, offset, () => 0))}
            onSubmit={v => void update($, filter, () => v).then(() => update($, offset, () => 0))}
          />
        </Box>
        {list.length === 0 && (
          <Text dimColor>  nothing matches</Text>
        )}
        {shown.map(line =>
          line.kind === 'head' ? (
            <Box marginTop={1} paddingX={1}>
              <Text bold color="yellow">
                ▸ {line.source}
              </Text>
              <Text dimColor> {line.count}</Text>
            </Box>
          ) : (
            <Box paddingX={1}>
              <Button key={line.skill.name} plain onPress={() => void $.prompt.submit({ text: '/' + line.skill.name })}>
                <Text color="green">/{line.skill.name}</Text>
                <Text dimColor> {line.skill.description.slice(0, Math.max(0, width - line.skill.name.length - 6))}</Text>
              </Button>
            </Box>
          ),
        )}
        {lines.length > room && (
          <Box paddingX={1} gap={1}>
            <Button key="prev" plain onPress={() => page(-room)}>▴ prev</Button>
            <Text dimColor>
              {from + 1}–{Math.min(lines.length, from + room)} of {lines.length}
            </Text>
            <Button key="next" plain onPress={() => page(room)}>▾ next</Button>
          </Box>
        )}
      </Box>
    )
  })
}
