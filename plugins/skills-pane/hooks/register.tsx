import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SkillRow } from '../types'

const PANE = 'skills-pane'
const skills = atom({ plugin: 'skills-pane', key: 'skills' } as const, [] as SkillRow[], {
  shape: 'skills-2',
})
const filter = atom({ plugin: 'skills-pane', key: 'filter' } as const, '')
const offset = atom({ plugin: 'skills-pane', key: 'offset' } as const, 0)
// UI colour: an accent laid over prompts, replies, tool rows and the spinner; 'off' leaves the engine's own.
const PALETTES: Record<string, { accent: string; dim: string }> = {
  off: { accent: '', dim: '' },
  coral: { accent: '#e8603c', dim: '#a8472e' },
  ocean: { accent: '#3fa7d6', dim: '#2a6f8f' },
  forest: { accent: '#5cb85c', dim: '#3d7a3d' },
  violet: { accent: '#a479e6', dim: '#6c4fa0' },
  amber: { accent: '#f0a33a', dim: '#9c6a26' },
}
const palette = atom({ plugin: 'skills-pane', key: 'palette' } as const, 'off')

async function cyclePalette($: EngineInterface): Promise<void> {
  const names = Object.keys(PALETTES)
  await update($, palette, cur => names[(names.indexOf(cur ?? 'off') + 1) % names.length] ?? 'off')
  await $.store.set('palette', await read($, palette))
  $.ui.invalidate('ui.render')
}

async function accentOf($: EngineInterface): Promise<{ accent: string; dim: string } | null> {
  const name = await read($, palette)
  return name === 'off' ? null : (PALETTES[name] ?? null)
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
    const kept = await $.store.get('palette')
    if (typeof kept === 'string' && kept in PALETTES) await update($, palette, () => kept)
    void $.ui.open({ id: PANE, title: 'Skills', columns: 120 }) // asks the widest dock the surface allows, 45% of the window
    return next(e)
  })

  on('command.run', { command: 'skills-pane' }, async $ => {
    await load($)
    const opened = await $.ui.open({ id: PANE, title: 'Skills', columns: 120 }) // asks the widest dock the surface allows, 45% of the window
    const n = (await read($, skills)).length
    return { text: opened.isPlaced ? `Skills pane opened, ${n} skills.` : `Skills pane not placed: ${opened.reason}` }
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await update($, offset, n => Math.max(0, (n ?? 0) + e.by))
    return {}
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const c = await accentOf($)
    if (!c) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    if (e.props.origin.kind !== 'composer') {
      const original = await next(e)
      return original ? <Box flexDirection="row"><Text color={c.dim}>▎</Text>{original}</Box> : original
    }
    return (
      <Box flexDirection="row">
        <Text color={c.accent} bold>▌ ❯ </Text>
        <Text color={c.accent} wrap="wrap">{e.props.text}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const c = await accentOf($)
    const original = await next(e)
    if (!c || !original) return original
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        <Box width={1} flexShrink={0} backgroundColor={e.props.isFirstOfReply ? c.accent : c.dim} />
        <Box flexDirection="column" flexGrow={1} flexShrink={1} paddingLeft={1}>{original}</Box>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const c = await accentOf($)
    const original = await next(e)
    if (!c || !original) return original
    const { Box, Text } = $.ui.resolve(e)
    return <Box flexDirection="row"><Text color={c.dim}>▎</Text>{original}</Box>
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const c = await accentOf($)
    const original = await next(e)
    if (!c || !original) return original
    const { Box, Text } = $.ui.resolve(e)
    return <Box flexDirection="row"><Text color={c.accent}>◆ </Text>{original}</Box>
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
            <Button key="palette" plain onPress={() => void cyclePalette($)}>
              🎨 {await read($, palette)}
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
