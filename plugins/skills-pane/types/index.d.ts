export type SkillRow = { name: string; source: string; description: string }

declare module 'claude-code' {
  interface PluginState {
    'skills-pane': { skills: Shaped<SkillRow[]>; filter: string; offset: number; palette: string }
  }
}
