export type PageKey =
  | 'dashboard'
  | 'agents'
  | 'skills'
  | 'builder'
  | 'profiles'
  | 'terminal'
  | 'export'
  | 'settings'

export type Agent = {
  id: string
  name: string
  role: string
  description: string
  modelPreference: string
  toolsAllowed: string[]
  instructions: string
  tags: string[]
  isTemplate: boolean
  createdAt: string
  updatedAt: string
}

export type Skill = {
  id: string
  name: string
  purpose: string
  triggerCondition: string
  steps: string[]
  examples: string[]
  isTemplate: boolean
  createdAt: string
  updatedAt: string
}

export type ProjectProfile = {
  id: string
  projectName: string
  projectPath: string
  techStack: string
  codingRules: string
  folderStructure: string
  importantCommands: string
  createdAt: string
  updatedAt: string
}

export type RoutingRule = {
  id: string
  name: string
  condition: string
  agentId: string | null
  priority: number
  isEnabled: boolean
  agent?: Agent | null
}

export type GeneratedFile = {
  fileName: string
  relativePath: string
  content: string
  fileType: string
}

export type AppData = {
  agents: Agent[]
  skills: Skill[]
  profiles: ProjectProfile[]
  routingRules: RoutingRule[]
  generatedFiles: GeneratedFile[]
}
