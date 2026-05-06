export type PageKey =
  | 'dashboard'
  | 'profile'
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

export type DetectedWorkspaceItem = {
  fileName: string
  fullPath: string
  relativePath: string
  suggestedName: string
  kind: 'agent' | 'skill'
  content: string
  role?: string | null
  description?: string | null
  modelPreference?: string | null
  toolsAllowed: string[]
  instructions?: string | null
  tags: string[]
  purpose?: string | null
  triggerCondition?: string | null
  steps: string[]
  examples: string[]
  avatarRelativePath?: string | null
}

export type WorkspaceScanResult = {
  directoryPath: string
  suggestedProjectName: string
  suggestedTechStack: string
  suggestedFolderStructure: string
  suggestedImportantCommands: string
  agents: DetectedWorkspaceItem[]
  skills: DetectedWorkspaceItem[]
  notes: string[]
  claude?: ParsedClaudeWorkspace | null
}

export type BrowseWorkspaceResult = {
  directoryPath: string
}

export type RecentWorkspace = {
  directoryPath: string
  name: string
  lastOpenedAt: string
}

export type RecentWorkspacesResult = {
  items: RecentWorkspace[]
}

export type WorkspaceAvatarUploadResult = {
  staffFolderName: string
  avatarRelativePath: string
}

export type WorkspaceFileContent = {
  relativePath: string
  content: string
  exists: boolean
}

export type WorkspaceFolderOpenResult = {
  folderPath: string
}

export type ParsedClaudeWorkspace = {
  relativePath: string
  projectName?: string | null
  techStack?: string | null
  codingRules?: string | null
  folderStructure?: string | null
  importantCommands?: string | null
  activeAgentNames: string[]
  activeSkillNames: string[]
  routingRules: ParsedClaudeRoutingRule[]
}

export type ParsedClaudeRoutingRule = {
  priority: number
  condition: string
  targetAgentName: string
}

export type TerminalMode = 'powershell' | 'cmd'
export type AppLanguage = 'en' | 'th'
export type AppTheme = 'light' | 'dark'

export type AppData = {
  agents: Agent[]
  skills: Skill[]
  profiles: ProjectProfile[]
  routingRules: RoutingRule[]
  generatedFiles: GeneratedFile[]
}
