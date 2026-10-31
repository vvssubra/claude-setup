export type SkillRow = { name: string; source: string; description: string }
export type Theme = { value: string; options: string[] }

declare module 'claude-code' {
  interface PluginState {
    'skills-pane': { skills: Shaped<SkillRow[]>; filter: string; offset: number; theme: Theme }
  }
}
