import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'skills-pane',
  component: 'Pane',
  requestId: 'skills-pane',
  props: { title: 'Skills', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('the pane lists a skill row on desktop and terminal', async ($, on) => {
  on('command.register', () => ({ value: { command: 'skills-pane' } }))
  on('command.list', () => ({ value: [
    { name: 'commit', description: 'Commit changes', source: 'user' },
    { name: 'help', description: 'd', source: 'builtin' },
    { name: 'caveman', description: 'd', source: 'plugin', plugin: 'caveman' },
    { name: 'bare', source: 'user' } as { name: string; description: string; source: 'user' },
  ] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^3\/3$/ }))?.text).toBe('3/3')
    expect(await ui.find({ type: 'Text', text: /caveman/ })).toBeTruthy()
    expect(await ui.find({ type: 'Button', key: 'caveman' })).toBeTruthy()
    const was = (await ui.find({ key: 'palette' }))?.text ?? ''
    await ui.press({ key: 'palette' })
    const now = (await ui.find({ key: 'palette' }))?.text ?? ''
    expect(now.startsWith('🎨 ')).toBe(true)
    expect(now === was).toBe(false)
    await ui.unmount()
  }
})
