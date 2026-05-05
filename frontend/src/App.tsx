import { useEffect, useMemo, useState } from 'react'
import { api } from './lib/api'
import { EmptyState } from './components/EmptyState'
import { FormCard } from './components/FormCard'
import { MarkdownPreview } from './components/MarkdownPreview'
import { Sidebar } from './components/Sidebar'
import { ProjectTerminal } from './components/ProjectTerminal'
import type { Agent, AppLanguage, AppTheme, DetectedWorkspaceItem, GeneratedFile, PageKey, ProjectProfile, RoutingRule, Skill, WorkspaceScanResult } from './types'

const defaultAgent: Agent = {
  id: '',
  name: '',
  role: '',
  description: '',
  modelPreference: 'claude-3-7-sonnet',
  toolsAllowed: [],
  instructions: '',
  tags: [],
  isTemplate: false,
  createdAt: '',
  updatedAt: '',
}

const defaultSkill: Skill = {
  id: '',
  name: '',
  purpose: '',
  triggerCondition: '',
  steps: [],
  examples: [],
  isTemplate: false,
  createdAt: '',
  updatedAt: '',
}

const defaultProfile: ProjectProfile = {
  id: '',
  projectName: '',
  projectPath: '',
  techStack: '',
  codingRules: '',
  folderStructure: '',
  importantCommands: '',
  createdAt: '',
  updatedAt: '',
}

const defaultRule: RoutingRule = {
  id: '',
  name: '',
  condition: '',
  agentId: null,
  priority: 1,
  isEnabled: true,
}

function toMultiline(values: string[]) {
  return values.join('\n')
}

function fromMultiline(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeDirectoryPath(value: string) {
  return value.trim().replace(/[\\/]+$/, '').toLowerCase()
}

type LibrarySection = 'agents' | 'skills'
type InspectorView = 'edit' | 'preview'
type WorkspaceSection = 'scan' | 'context' | 'generate' | 'ship'

function buildAgentMarkdown(agent: Agent) {
  return `# ${agent.name || 'New Agent'}

**Role:** ${agent.role || 'Agent role'}

## Description
${agent.description || 'Explain what this agent should own.'}

## Model Preference
${agent.modelPreference || 'claude-3-7-sonnet'}

## Allowed Tools
${agent.toolsAllowed.length ? agent.toolsAllowed.map((tool) => `- ${tool}`).join('\n') : '- edit-files'}

## Instructions
${agent.instructions || 'Add the behavior, guardrails, and goals for this agent.'}

## Tags
${agent.tags.join(', ') || 'frontend, backend, review'}`
}

function buildSkillMarkdown(skill: Skill) {
  return `# ${skill.name || 'New Skill'}

## Purpose
${skill.purpose || 'Describe what this skill helps Claude do well.'}

## Trigger Condition
${skill.triggerCondition || 'Use when...'}

## Steps
${skill.steps.length ? skill.steps.map((step) => `- ${step}`).join('\n') : '- Step one\n- Step two'}

## Examples
${skill.examples.length ? skill.examples.map((example) => `- ${example}`).join('\n') : '- Example usage'}`
}

function buildClaudePreview(profile: ProjectProfile | undefined, agents: Agent[], skills: Skill[], rules: RoutingRule[]) {
  return `# CLAUDE.md

## Project Context
**Project:** ${profile?.projectName || 'Select a project profile'}
**Tech Stack:** ${profile?.techStack || 'Add your stack'}

### Coding Rules
${profile?.codingRules || '- Keep code clean\n- Prefer simple names'}

### Folder Structure
${profile?.folderStructure || '/frontend\n/backend\n/.claude'}

### Important Commands
${profile?.importantCommands || 'npm run dev\ndotnet run'}

## Active Agents
${agents.length ? agents.map((agent) => `- **${agent.name}**: ${agent.role}`).join('\n') : '- Choose one or more agents'}

## Active Skills
${skills.length ? skills.map((skill) => `- **${skill.name}**: ${skill.triggerCondition}`).join('\n') : '- Choose one or more skills'}

## Routing Rules
${rules.length ? rules.map((rule) => `${rule.priority}. If ${rule.condition} -> use ${rule.agent?.name ?? 'selected agent'}`).join('\n') : '1. If task is frontend -> use frontend agent'}`
}

function createAgentDraftFromWorkspace(item: DetectedWorkspaceItem): Agent {
  return {
    ...defaultAgent,
    name: item.suggestedName,
    role: item.role?.trim() || 'Project Specialist',
    description: item.description?.trim() || `Imported from ${item.relativePath}.`,
    modelPreference: item.modelPreference?.trim() || 'claude-3-7-sonnet',
    toolsAllowed: item.toolsAllowed.length > 0 ? item.toolsAllowed : ['edit-files', 'run-tests'],
    instructions: item.instructions?.trim() || `Use the context from ${item.fileName} as the starting point for this agent.`,
    tags: item.tags.length > 0 ? item.tags : ['workspace-import'],
  }
}

function createSkillDraftFromWorkspace(item: DetectedWorkspaceItem): Skill {
  return {
    ...defaultSkill,
    name: item.suggestedName,
    purpose: item.purpose?.trim() || `Imported from ${item.relativePath}.`,
    triggerCondition: item.triggerCondition?.trim() || `Use when the workflow matches ${item.suggestedName}.`,
    steps: item.steps.length > 0 ? item.steps : ['Review the imported markdown file', 'Adapt the steps to your current project', 'Save and reuse it'],
    examples: item.examples.length > 0 ? item.examples : [item.fileName],
  }
}

function renderSegmentButtons<T extends string>(
  current: T,
  setCurrent: (value: T) => void,
  items: Array<{ value: T; label: string }>,
) {
  return (
    <div className="segment-row">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={item.value === current ? 'segment-chip active' : 'segment-chip'}
          onClick={() => setCurrent(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

const translations = {
  en: {
    pages: [
      { key: 'dashboard', label: 'Playground', helper: 'Overview and quick wins' },
      { key: 'agents', label: 'Agents', helper: 'Create your helper crew' },
      { key: 'skills', label: 'Skills', helper: 'Capture reusable moves' },
      { key: 'profiles', label: 'Workspace', helper: 'Project context, routing, and export' },
      { key: 'terminal', label: 'Terminal', helper: 'Open PowerShell or cmd' },
    ] as Array<{ key: PageKey; label: string; helper: string }>,
    sidebar: {
      eyebrow: 'Tiny studio, big helpers',
      tipTitle: 'Friendly tip',
      tipText: 'Start with a template, tweak the voice, then trust the preview to tell you when things feel right.',
    },
    pageMeta: {
      dashboard: { title: 'Workspace Playground', description: 'Kick the tires, peek at templates, and get your setup moving without overthinking it.' },
      agents: { title: 'Agent Crew', description: 'Name your specialists, tune their vibe, and give each one a clear job to own.' },
      skills: { title: 'Skill Snacks', description: 'Save repeatable workflows so your agents can reuse the good stuff on demand.' },
      profiles: { title: 'Workspace Camp', description: 'Keep project context, routing, previews, and generated files together in one cozy place.' },
      terminal: { title: 'Project Terminal', description: 'Hop into PowerShell or cmd right from the app and poke around comfortably.' },
    } as Record<PageKey, { title: string; description: string }>,
    controls: {
      language: 'TH / EN',
      theme: 'Light / Dark',
      light: 'Light',
      dark: 'Dark',
      refresh: 'Freshen up',
      busyLoading: 'Loading workspace...',
      ready: 'Workspace ready.',
      offline: 'Could not reach the API yet. Start the backend and refresh to load live data.',
      copied: 'Copied to clipboard.',
    },
  },
  th: {
    pages: [
      { key: 'dashboard', label: 'ภาพรวม', helper: 'ดูภาพรวมและเริ่มงานไว ๆ' },
      { key: 'agents', label: 'เอเจนต์', helper: 'สร้างทีมตัวช่วยของคุณ' },
      { key: 'skills', label: 'สกิล', helper: 'เก็บ workflow ที่ใช้ซ้ำ' },
      { key: 'builder', label: 'ตัวประกอบ', helper: 'รวม context และ routing' },
      { key: 'profiles', label: 'โปรเจ็กต์', helper: 'เก็บ path และ stack notes' },
      { key: 'terminal', label: 'เทอร์มินัล', helper: 'เปิด PowerShell หรือ cmd' },
      { key: 'export', label: 'เอ็กซ์พอร์ต', helper: 'แพ็กไฟล์ที่ generate แล้ว' },
      { key: 'settings', label: 'ตั้งค่า', helper: 'environment และค่าเริ่มต้น' },
    ] as Array<{ key: PageKey; label: string; helper: string }>,
    sidebar: {
      eyebrow: 'สตูดิโอเล็ก ๆ กับตัวช่วยเก่ง ๆ',
      tipTitle: 'ทิปเล็ก ๆ',
      tipText: 'เริ่มจาก template ก่อน แล้วค่อยปรับน้ำเสียงกับรายละเอียดจน preview ดูใช่สำหรับคุณ',
    },
    pageMeta: {
      dashboard: { title: 'สนามเล่น Workspace', description: 'ดู template, เช็กของที่มี และเริ่มจัด workspace ได้แบบไม่ต้องคิดเยอะ' },
      agents: { title: 'ทีมเอเจนต์', description: 'ตั้งชื่อ ปรับบุคลิก และแบ่งหน้าที่ให้แต่ละตัวช่วยแบบชัด ๆ' },
      skills: { title: 'กล่องสกิล', description: 'เก็บ workflow ที่ใช้ซ้ำบ่อยไว้ให้หยิบกลับมาใช้ได้ง่าย' },
      builder: { title: 'ตัวประกอบ CLAUDE', description: 'รวม project context, agents และ rules เป็นไฟล์ setup เดียวแบบเรียบร้อย' },
      profiles: { title: 'มุมโปรเจ็กต์', description: 'เก็บ path, stack notes และ command สำคัญไว้ในที่เดียว' },
      terminal: { title: 'Project Terminal', description: 'เปิด PowerShell หรือ cmd จากในแอป แล้วสลับหน้าไปมาได้โดย session ไม่หาย' },
      export: { title: 'มุมเอ็กซ์พอร์ต', description: 'ดูไฟล์ที่ generate, คัดลอกสิ่งที่ต้องใช้ และแพ็กงานออกได้ง่าย ๆ' },
      settings: { title: 'ห้องควบคุม', description: 'รวม environment notes, path พื้นฐาน และค่าที่ใช้บ่อย' },
    } as Record<PageKey, { title: string; description: string }>,
    controls: {
      language: 'ไทย / EN',
      theme: 'สว่าง / มืด',
      light: 'สว่าง',
      dark: 'มืด',
      refresh: 'รีเฟรชข้อมูล',
      busyLoading: 'กำลังโหลด workspace...',
      ready: 'Workspace พร้อมใช้งานแล้ว',
      offline: 'ยังเชื่อม API ไม่ได้ ลองเปิด backend แล้วรีเฟรชอีกครั้ง',
      copied: 'คัดลอกเรียบร้อย',
    },
  },
}

function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [language, setLanguage] = useState<AppLanguage>(() => (localStorage.getItem('agentstudio-language') as AppLanguage) || 'en')
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem('agentstudio-theme') as AppTheme) || 'light')
  const [agents, setAgents] = useState<Agent[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [profiles, setProfiles] = useState<ProjectProfile[]>([])
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])

  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [selectedSkillId, setSelectedSkillId] = useState<string>('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [selectedRuleId, setSelectedRuleId] = useState<string>('')
  const [selectedGeneratedFile, setSelectedGeneratedFile] = useState<string>('')

  const [agentDraft, setAgentDraft] = useState<Agent>(defaultAgent)
  const [skillDraft, setSkillDraft] = useState<Skill>(defaultSkill)
  const [profileDraft, setProfileDraft] = useState<ProjectProfile>(defaultProfile)
  const [ruleDraft, setRuleDraft] = useState<RoutingRule>(defaultRule)
  const [builderSelection, setBuilderSelection] = useState<{
    projectProfileId: string | null
    agentIds: string[]
    skillIds: string[]
    routingRuleIds: string[]
  }>({ projectProfileId: null, agentIds: [], skillIds: [], routingRuleIds: [] })

  const copy = translations[language]
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(copy.controls.busyLoading)
  const [workspaceDirectory, setWorkspaceDirectory] = useState('')
  const [workspaceScan, setWorkspaceScan] = useState<WorkspaceScanResult | null>(null)
  const [librarySection, setLibrarySection] = useState<LibrarySection>('agents')
  const [libraryInspectorView, setLibraryInspectorView] = useState<InspectorView>('edit')
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('scan')
  const sidebarPages = copy.pages
    .filter((item) => item.key !== 'builder' && item.key !== 'export' && item.key !== 'settings' && item.key !== 'skills')
    .map((item) =>
      item.key === 'agents'
        ? {
            ...item,
            label: 'Library',
            helper: language === 'th' ? 'Agents และ skills ในหน้ารวม' : 'Agents and skills in one place',
          }
        : item,
    )

  useEffect(() => {
    localStorage.setItem('agentstudio-language', language)
    setMessage((current) => (current === translations.en.controls.busyLoading || current === translations.th.controls.busyLoading ? copy.controls.busyLoading : current))
  }, [language, copy.controls.busyLoading])

  useEffect(() => {
    localStorage.setItem('agentstudio-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  async function loadWorkspace(preferred?: {
    agentId?: string
    skillId?: string
    profileId?: string
    ruleId?: string
  }) {
    setBusy(true)
    try {
      const [agentData, skillData, profileData, routingData] = await Promise.all([
        api.getAgents(),
        api.getSkills(),
        api.getProfiles(),
        api.getRoutingRules(),
      ])

      setAgents(agentData)
      setSkills(skillData)
      setProfiles(profileData)
      setRoutingRules(routingData)
      const nextAgent = agentData.find((item) => item.id === preferred?.agentId) ?? agentData[0]
      const nextSkill = skillData.find((item) => item.id === preferred?.skillId) ?? skillData[0]
      const nextProfile = profileData.find((item) => item.id === preferred?.profileId) ?? profileData[0]
      const nextRule = routingData.find((item) => item.id === preferred?.ruleId) ?? routingData[0]

      setSelectedAgentId(nextAgent?.id ?? '')
      setSelectedSkillId(nextSkill?.id ?? '')
      setSelectedProfileId(nextProfile?.id ?? '')
      setSelectedRuleId(nextRule?.id ?? '')
      setAgentDraft(nextAgent ?? defaultAgent)
      setSkillDraft(nextSkill ?? defaultSkill)
      setProfileDraft(nextProfile ?? defaultProfile)
      setRuleDraft(nextRule ?? defaultRule)
      setBuilderSelection((current) => ({
        projectProfileId: current.projectProfileId ?? profileData[0]?.id ?? null,
        agentIds: current.agentIds,
        skillIds: current.skillIds,
        routingRuleIds: current.routingRuleIds.length > 0 ? current.routingRuleIds : routingData.map((item) => item.id),
      }))
      setMessage(copy.controls.ready)
    } catch {
      setMessage(copy.controls.offline)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void loadWorkspace()
  }, [])

  useEffect(() => {
    const selected = agents.find((item) => item.id === selectedAgentId)
    if (selected) {
      setAgentDraft(selected)
    }
  }, [agents, selectedAgentId])

  useEffect(() => {
    const selected = skills.find((item) => item.id === selectedSkillId)
    if (selected) {
      setSkillDraft(selected)
    }
  }, [skills, selectedSkillId])

  useEffect(() => {
    const selected = profiles.find((item) => item.id === selectedProfileId)
    if (selected) {
      setProfileDraft(selected)
      setWorkspaceDirectory(selected.projectPath)
    }
  }, [profiles, selectedProfileId])

  useEffect(() => {
    const selected = routingRules.find((item) => item.id === selectedRuleId)
    if (selected) {
      setRuleDraft(selected)
    }
  }, [routingRules, selectedRuleId])

  const selectedBuilderProfile = useMemo(
    () => profiles.find((item) => item.id === builderSelection.projectProfileId),
    [builderSelection.projectProfileId, profiles],
  )

  const currentWorkspaceAgentNames = useMemo(
    () => new Set((workspaceScan?.agents ?? []).map((item) => item.suggestedName.toLowerCase())),
    [workspaceScan],
  )

  const currentWorkspaceSkillNames = useMemo(
    () => new Set((workspaceScan?.skills ?? []).map((item) => item.suggestedName.toLowerCase())),
    [workspaceScan],
  )

  const currentWorkspaceAgents = useMemo(
    () => (workspaceScan ? agents.filter((item) => currentWorkspaceAgentNames.has(item.name.toLowerCase())) : []),
    [agents, currentWorkspaceAgentNames, workspaceScan],
  )

  const currentWorkspaceSkills = useMemo(
    () => (workspaceScan ? skills.filter((item) => currentWorkspaceSkillNames.has(item.name.toLowerCase())) : []),
    [currentWorkspaceSkillNames, skills, workspaceScan],
  )

  const templateAgents = useMemo(
    () => agents.filter((item) => item.isTemplate || !currentWorkspaceAgentNames.has(item.name.toLowerCase())),
    [agents, currentWorkspaceAgentNames],
  )

  useEffect(() => {
    if (!workspaceScan) {
      return
    }

    const allowedAgentIds = new Set(currentWorkspaceAgents.map((item) => item.id))
    const allowedSkillIds = new Set(currentWorkspaceSkills.map((item) => item.id))

    setBuilderSelection((current) => ({
      ...current,
      agentIds: current.agentIds.filter((id) => allowedAgentIds.has(id)),
      skillIds: current.skillIds.filter((id) => allowedSkillIds.has(id)),
    }))
  }, [currentWorkspaceAgents, currentWorkspaceSkills, workspaceScan])

  const selectedBuilderAgents = useMemo(
    () => currentWorkspaceAgents.filter((item) => builderSelection.agentIds.includes(item.id)),
    [builderSelection.agentIds, currentWorkspaceAgents],
  )

  const selectedBuilderSkills = useMemo(
    () => currentWorkspaceSkills.filter((item) => builderSelection.skillIds.includes(item.id)),
    [builderSelection.skillIds, currentWorkspaceSkills],
  )

  const selectedBuilderRules = useMemo(
    () => routingRules.filter((item) => builderSelection.routingRuleIds.includes(item.id)),
    [builderSelection.routingRuleIds, routingRules],
  )

  const builderPreview = useMemo(
    () => buildClaudePreview(selectedBuilderProfile, selectedBuilderAgents, selectedBuilderSkills, selectedBuilderRules),
    [selectedBuilderAgents, selectedBuilderProfile, selectedBuilderRules, selectedBuilderSkills],
  )

  const currentGeneratedFile = generatedFiles.find((file) => file.relativePath === selectedGeneratedFile) ?? generatedFiles[0]

  async function saveAgent() {
    const payload = {
      ...agentDraft,
      toolsAllowed: agentDraft.toolsAllowed,
      tags: agentDraft.tags,
    }

    if (agentDraft.id) {
      await api.updateAgent(agentDraft.id, payload)
      setMessage(`Updated ${agentDraft.name}.`)
      await loadWorkspace({ agentId: agentDraft.id })
    } else {
      const created = await api.createAgent(payload)
      setMessage(`Created ${created.name}.`)
      await loadWorkspace({ agentId: created.id })
    }
  }

  async function saveSkill() {
    if (skillDraft.id) {
      await api.updateSkill(skillDraft.id, skillDraft)
      setMessage(`Updated ${skillDraft.name}.`)
      await loadWorkspace({ skillId: skillDraft.id })
    } else {
      const created = await api.createSkill(skillDraft)
      setMessage(`Created ${created.name}.`)
      await loadWorkspace({ skillId: created.id })
    }
  }

  async function saveProfile() {
    if (profileDraft.id) {
      await api.updateProfile(profileDraft.id, profileDraft)
      setMessage(`Updated ${profileDraft.projectName}.`)
      await loadWorkspace({ profileId: profileDraft.id })
    } else {
      const created = await api.createProfile(profileDraft)
      setMessage(`Created ${created.projectName}.`)
      await loadWorkspace({ profileId: created.id })
    }
  }

  async function saveRule() {
    if (ruleDraft.id) {
      await api.updateRoutingRule(ruleDraft.id, ruleDraft)
      setMessage(`Updated ${ruleDraft.name}.`)
      await loadWorkspace({ ruleId: ruleDraft.id })
    } else {
      const created = await api.createRoutingRule(ruleDraft)
      setMessage(`Created ${created.name}.`)
      await loadWorkspace({ ruleId: created.id })
    }
  }

  async function generateFiles() {
    const files = await api.generateClaude({
      ...builderSelection,
      agentIds: builderSelection.agentIds.filter((id) => currentWorkspaceAgents.some((item) => item.id === id)),
      skillIds: builderSelection.skillIds.filter((id) => currentWorkspaceSkills.some((item) => item.id === id)),
    })
    setGeneratedFiles(files)
    setSelectedGeneratedFile(files[0]?.relativePath ?? '')
    setPage('profiles')
    setMessage('Generated CLAUDE.md and markdown files.')
  }

  async function exportFiles() {
    await api.exportFiles(generatedFiles)
    setMessage('Saved export batch to generated file history.')
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setMessage(copy.controls.copied)
  }

  async function ensureWorkspaceProfile() {
    if (!workspaceScan) {
      return null
    }

    const normalizedScanPath = normalizeDirectoryPath(workspaceScan.directoryPath)
    const existingProfile = profiles.find((profile) => normalizeDirectoryPath(profile.projectPath) === normalizedScanPath)

    if (existingProfile) {
      setSelectedProfileId(existingProfile.id)
      setProfileDraft(existingProfile)
      setWorkspaceDirectory(existingProfile.projectPath)
      return existingProfile
    }

    const created = await api.createProfile({
      projectName: workspaceScan.claude?.projectName?.trim() || workspaceScan.suggestedProjectName || profileDraft.projectName || 'Imported Project',
      projectPath: workspaceScan.directoryPath,
      techStack: workspaceScan.claude?.techStack?.trim() || workspaceScan.suggestedTechStack || profileDraft.techStack || '',
      codingRules: workspaceScan.claude?.codingRules?.trim() || profileDraft.codingRules || '',
      folderStructure: workspaceScan.claude?.folderStructure?.trim() || workspaceScan.suggestedFolderStructure || profileDraft.folderStructure || '',
      importantCommands: workspaceScan.claude?.importantCommands?.trim() || workspaceScan.suggestedImportantCommands || profileDraft.importantCommands || '',
    })

    setProfiles((current) => [...current, created].sort((left, right) => left.projectName.localeCompare(right.projectName)))
    setSelectedProfileId(created.id)
    setProfileDraft(created)
    setWorkspaceDirectory(created.projectPath)

    return created
  }

  async function importAllWorkspaceItems() {
    if (!workspaceScan) {
      return
    }

    setBusy(true)
    try {
      const ensuredProfile = await ensureWorkspaceProfile()
      const existingAgentNames = new Set(agents.map((agent) => agent.name.toLowerCase()))
      const existingSkillNames = new Set(skills.map((skill) => skill.name.toLowerCase()))

      for (const item of workspaceScan.agents) {
        if (!existingAgentNames.has(item.suggestedName.toLowerCase())) {
          const created = await api.createAgent(createAgentDraftFromWorkspace(item))
          existingAgentNames.add(created.name.toLowerCase())
        }
      }

      for (const item of workspaceScan.skills) {
        if (!existingSkillNames.has(item.suggestedName.toLowerCase())) {
          const created = await api.createSkill(createSkillDraftFromWorkspace(item))
          existingSkillNames.add(created.name.toLowerCase())
        }
      }

      await loadWorkspace({ profileId: ensuredProfile?.id })
      setMessage(language === 'th' ? 'นำเข้า agents และ skills จาก workspace เรียบร้อยแล้ว' : 'Imported agents and skills from the workspace.')
    } finally {
      setBusy(false)
    }
  }

  async function applyClaudeFlow() {
    if (!workspaceScan?.claude) {
      return
    }

    const ensuredProfile = await ensureWorkspaceProfile()
    const claude = workspaceScan.claude
    const latestAgents = await api.getAgents()
    const latestSkills = await api.getSkills()
    const latestRules = await api.getRoutingRules()

    const selectedAgentIds = latestAgents
      .filter((agent) => claude.activeAgentNames.some((name) => name.toLowerCase() === agent.name.toLowerCase()))
      .map((agent) => agent.id)

    const selectedSkillIds = latestSkills
      .filter((skill) => claude.activeSkillNames.some((name) => name.toLowerCase() === skill.name.toLowerCase()))
      .map((skill) => skill.id)

    const existingRuleNames = new Set(latestRules.map((rule) => rule.name.toLowerCase()))
    const createdRuleIds: string[] = []

    for (const rule of claude.routingRules) {
      const targetAgent = latestAgents.find((agent) => agent.name.toLowerCase() === rule.targetAgentName.toLowerCase())
      const ruleName = `Imported: ${rule.condition}`
      if (existingRuleNames.has(ruleName.toLowerCase())) {
        continue
      }

      const created = await api.createRoutingRule({
        name: ruleName,
        condition: rule.condition,
        agentId: targetAgent?.id ?? null,
        priority: rule.priority,
        isEnabled: true,
      })
      existingRuleNames.add(created.name.toLowerCase())
      createdRuleIds.push(created.id)
    }

    const refreshedRules = createdRuleIds.length > 0 ? await api.getRoutingRules() : latestRules
    const importedRuleIds = refreshedRules
      .filter((rule) =>
        claude.routingRules.some((item) => item.condition.toLowerCase() === rule.condition.toLowerCase()))
      .map((rule) => rule.id)

    setBuilderSelection((current) => ({
      ...current,
      projectProfileId: ensuredProfile?.id ?? current.projectProfileId,
      agentIds: selectedAgentIds.filter((id) => latestAgents.some((item) => item.id === id && currentWorkspaceAgentNames.has(item.name.toLowerCase()))),
      skillIds: selectedSkillIds.filter((id) => latestSkills.some((item) => item.id === id && currentWorkspaceSkillNames.has(item.name.toLowerCase()))),
      routingRuleIds: importedRuleIds,
    }))

    setProfileDraft((current) => ({
      ...current,
      projectName: claude.projectName || current.projectName,
      techStack: claude.techStack || current.techStack,
      codingRules: claude.codingRules || current.codingRules,
      folderStructure: claude.folderStructure || current.folderStructure,
      importantCommands: claude.importantCommands || current.importantCommands,
    }))

    setPage('profiles')
    setMessage(language === 'th' ? 'ตั้งค่า builder จาก CLAUDE.md ให้แล้ว' : 'Applied builder flow from CLAUDE.md.')
  }

  async function scanWorkspace() {
    const nextDirectory = workspaceDirectory.trim() || profileDraft.projectPath.trim()
    if (!nextDirectory) {
      setMessage(language === 'th' ? 'กรุณาระบุโฟลเดอร์โปรเจ็กต์ก่อนสแกน' : 'Please choose a project directory before scanning.')
      return
    }

    setBusy(true)
    try {
      const result = await api.scanWorkspace(nextDirectory)
      setWorkspaceScan(result)
      setWorkspaceDirectory(result.directoryPath)
      setProfileDraft((current) => ({
        ...current,
        projectPath: result.directoryPath,
        projectName: current.projectName || result.suggestedProjectName,
        techStack: current.techStack || result.suggestedTechStack,
        folderStructure: current.folderStructure || result.suggestedFolderStructure,
        importantCommands: current.importantCommands || result.suggestedImportantCommands,
      }))
      setMessage(language === 'th' ? 'สแกน workspace เรียบร้อยแล้ว' : 'Workspace scan finished.')
    } catch {
      setMessage(language === 'th' ? 'สแกนโฟลเดอร์ไม่สำเร็จ ลองเช็ก path อีกครั้ง' : 'Could not scan that directory. Double-check the path and try again.')
    } finally {
      setBusy(false)
    }
  }

  function applyWorkspaceScanToProfile() {
    if (!workspaceScan) {
      return
    }

    setProfileDraft((current) => ({
      ...current,
      projectName: workspaceScan.suggestedProjectName,
      projectPath: workspaceScan.directoryPath,
      techStack: workspaceScan.suggestedTechStack,
      folderStructure: workspaceScan.suggestedFolderStructure,
      importantCommands: workspaceScan.suggestedImportantCommands,
    }))
    setMessage(language === 'th' ? 'เติมข้อมูลโปรเจ็กต์จากโฟลเดอร์ให้แล้ว' : 'Pulled project details from the scanned directory.')
  }

  function openAgentFromWorkspace(item: DetectedWorkspaceItem) {
    const existing = agents.find((agent) => agent.name.toLowerCase() === item.suggestedName.toLowerCase())
    if (existing) {
      setSelectedAgentId(existing.id)
      setPage('agents')
      setMessage(language === 'th' ? `เปิด agent ที่มีอยู่แล้ว: ${existing.name}` : `Opened existing agent: ${existing.name}`)
      return
    }

    setSelectedAgentId('')
    setAgentDraft(createAgentDraftFromWorkspace(item))
    setPage('agents')
    setMessage(language === 'th' ? `สร้าง draft agent จากไฟล์ ${item.fileName} แล้ว` : `Prepared a new agent draft from ${item.fileName}.`)
  }

  function openSkillFromWorkspace(item: DetectedWorkspaceItem) {
    const existing = skills.find((skill) => skill.name.toLowerCase() === item.suggestedName.toLowerCase())
    if (existing) {
      setSelectedSkillId(existing.id)
      setPage('agents')
      setMessage(language === 'th' ? `เปิด skill ที่มีอยู่แล้ว: ${existing.name}` : `Opened existing skill: ${existing.name}`)
      return
    }

    setSelectedSkillId('')
    setSkillDraft(createSkillDraftFromWorkspace(item))
    setPage('agents')
    setMessage(language === 'th' ? `สร้าง draft skill จากไฟล์ ${item.fileName} แล้ว` : `Prepared a new skill draft from ${item.fileName}.`)
  }

  function toggleSelection(key: 'agentIds' | 'skillIds' | 'routingRuleIds', id: string) {
    setBuilderSelection((current) => {
      const exists = current[key].includes(id)
      return {
        ...current,
        [key]: exists ? current[key].filter((value) => value !== id) : [...current[key], id],
      }
    })
  }

  function renderDashboard() {
    return (
      <div className="page-grid">
        <section className="hero-panel compact-hero">
          <div className="hero-copy-stack">
            <div className="hero-badge">Current workspace</div>
            <p className="hero-copy">
              Scan the project folder first, then continue with the helpers and CLAUDE flow that belong to that directory only.
            </p>
          </div>
          <div className="hero-sidekick compact-sidekick">
            <div className="hero-sidekick-card">
              <span className="mini-label">Current snapshot</span>
              <strong>{profiles.length > 0 ? 'Your workspace is ready for another round.' : 'Let’s set up your first project nook.'}</strong>
              <p>{workspaceScan ? `${currentWorkspaceAgents.length} agents, ${currentWorkspaceSkills.length} skills in this directory` : 'Pick a folder and scan it to see the active workspace summary.'}</p>
            </div>
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={() => void scanWorkspace()}>
                Scan current dir
              </button>
              <button type="button" className="secondary-button" onClick={() => setPage('profiles')}>
                Open workspace
              </button>
            </div>
          </div>
        </section>

        <FormCard
          title={language === 'th' ? 'Current Directory Agents' : 'Current Directory Agents'}
          description={
            language === 'th'
              ? 'กำหนดโฟลเดอร์โปรเจ็กต์ สแกนชื่อไฟล์ แล้วเปิด draft ของ agent หรือ skill ได้ทันที'
              : 'Choose the current project directory, then open any sub-agent found in that folder to edit it right away.'
          }
        >
          <div className="workspace-flow-grid">
            <label className="full-width">
              {language === 'th' ? 'Project directory' : 'Project directory'}
              <input
                value={workspaceDirectory}
                onChange={(event) => setWorkspaceDirectory(event.target.value)}
                placeholder={language === 'th' ? 'D:\\Projects\\my-app' : 'D:\\Projects\\my-app'}
              />
            </label>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={() => void scanWorkspace()}>
                {language === 'th' ? 'สแกนโฟลเดอร์' : 'Scan directory'}
              </button>
              <button type="button" className="secondary-button" onClick={applyWorkspaceScanToProfile} disabled={!workspaceScan}>
                {language === 'th' ? 'เติมข้อมูลโปรเจ็กต์' : 'Fill project details'}
              </button>
              <button type="button" className="secondary-button" onClick={() => void importAllWorkspaceItems()} disabled={!workspaceScan}>
                {language === 'th' ? 'นำเข้าทั้งหมด' : 'Import all'}
              </button>
              <button type="button" className="secondary-button" onClick={() => void applyClaudeFlow()} disabled={!workspaceScan?.claude}>
                {language === 'th' ? 'ใช้ flow จาก CLAUDE.md' : 'Apply CLAUDE flow'}
              </button>
            </div>
            {workspaceScan ? (
              <div className="workspace-results">
                <div className="workspace-summary-card">
                  <strong>{workspaceScan.suggestedProjectName}</strong>
                  <p>{workspaceScan.directoryPath}</p>
                  <small>{workspaceScan.suggestedTechStack || (language === 'th' ? 'ยังไม่เจอ stack ชัดเจน' : 'No clear stack detected yet.')}</small>
                </div>
                <div className="workspace-pill-row">
                  {workspaceScan.agents.map((item) => (
                    <button key={item.fullPath} type="button" className="workspace-pill" onClick={() => openAgentFromWorkspace(item)}>
                      {language === 'th' ? `Agent: ${item.suggestedName}` : `Agent: ${item.suggestedName}`}
                    </button>
                  ))}
                  {workspaceScan.skills.map((item) => (
                    <button key={item.fullPath} type="button" className="workspace-pill mint" onClick={() => openSkillFromWorkspace(item)}>
                      {language === 'th' ? `Skill: ${item.suggestedName}` : `Skill: ${item.suggestedName}`}
                    </button>
                  ))}
                </div>
                {workspaceScan.notes.length > 0 ? (
                  <div className="workspace-note-list">
                    {workspaceScan.notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                ) : null}
                {workspaceScan.claude ? (
                  <div className="workspace-summary-card claude-card">
                    <strong>{language === 'th' ? 'เจอไฟล์ CLAUDE.md' : 'CLAUDE.md detected'}</strong>
                    <p>{workspaceScan.claude.relativePath}</p>
                    <small>
                      {workspaceScan.claude.activeAgentNames.length} agents, {workspaceScan.claude.activeSkillNames.length} skills, {workspaceScan.claude.routingRules.length} rules
                    </small>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </FormCard>

      </div>
    )
  }

  function renderAgents() {
    const isAgentMode = librarySection === 'agents'
    const activeList = isAgentMode ? currentWorkspaceAgents : currentWorkspaceSkills
    const activeTitle = isAgentMode ? 'Agent Library' : 'Skill Library'
    const activeDescription = isAgentMode
      ? 'Only helpers found in the current directory are shown here.'
      : 'Only skills found in the current directory are shown here.'

    return (
      <div className="page-grid">
        <section className="step-strip">
          <article className="step-card">
            <span className="step-number">1</span>
            <div>
              <strong>Pick your helpers</strong>
              <p>Keep agents and skills side by side so editing feels less scattered.</p>
            </div>
          </article>
          <article className="step-card">
            <span className="step-number">2</span>
            <div>
              <strong>Tune the voice</strong>
              <p>Adjust role, trigger, and instructions until each helper sounds right.</p>
            </div>
          </article>
        </section>

        {renderSegmentButtons(librarySection, setLibrarySection, [
          { value: 'agents', label: 'Agents' },
          { value: 'skills', label: 'Skills' },
        ])}

        <div className="two-column">
          <FormCard title={activeTitle} description={activeDescription}>
            <div className="list-toolbar">
              <button
                type="button"
                className="primary-button"
                onClick={() => (isAgentMode ? setAgentDraft(defaultAgent) : setSkillDraft(defaultSkill))}
              >
                {isAgentMode ? 'New agent' : 'New skill'}
              </button>
            </div>
            <div className="list-stack">
              {activeList.length === 0 ? (
                <EmptyState
                  title={workspaceScan ? (isAgentMode ? 'No agents in this directory' : 'No skills in this directory') : 'Scan a directory first'}
                  message={workspaceScan
                    ? isAgentMode
                      ? 'Only agents found in the current directory show up here.'
                      : 'Only skills found in the current directory show up here.'
                    : 'Choose and scan the current project directory before opening the active library.'}
                />
              ) : isAgentMode ? (
                currentWorkspaceAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={selectedAgentId === agent.id ? 'list-card active' : 'list-card'}
                    onClick={() => {
                      setSelectedAgentId(agent.id)
                      setLibraryInspectorView('edit')
                    }}
                  >
                    <div>
                      <strong>{agent.name}</strong>
                      <p>{agent.role}</p>
                    </div>
                    <span className="chip">{agent.isTemplate ? 'Template' : 'Custom'}</span>
                  </button>
                ))
              ) : (
                currentWorkspaceSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className={selectedSkillId === skill.id ? 'list-card active' : 'list-card'}
                    onClick={() => {
                      setSelectedSkillId(skill.id)
                      setLibraryInspectorView('edit')
                    }}
                  >
                    <div>
                      <strong>{skill.name}</strong>
                      <p>{skill.triggerCondition}</p>
                    </div>
                    <span className="chip">{skill.isTemplate ? 'Template' : 'Custom'}</span>
                  </button>
                ))
              )}
            </div>
          </FormCard>

          <div className="stack">
            {renderSegmentButtons(libraryInspectorView, setLibraryInspectorView, [
              { value: 'edit', label: 'Edit' },
              { value: 'preview', label: 'Preview' },
            ])}

            {isAgentMode ? (
              libraryInspectorView === 'edit' ? (
                <FormCard title="Agent Editor" description="Keep the language simple, warm, and specific so Claude knows exactly how to pitch in.">
                  <div className="form-grid">
                    <label>
                      Name
                      <input value={agentDraft.name} onChange={(event) => setAgentDraft({ ...agentDraft, name: event.target.value })} placeholder="Backend API Agent" />
                    </label>
                    <label>
                      Role
                      <input value={agentDraft.role} onChange={(event) => setAgentDraft({ ...agentDraft, role: event.target.value })} placeholder="Backend Engineer" />
                    </label>
                    <label className="full-width">
                      Description
                      <textarea value={agentDraft.description} onChange={(event) => setAgentDraft({ ...agentDraft, description: event.target.value })} placeholder="What is this agent responsible for?" rows={4} />
                    </label>
                    <label>
                      Model preference
                      <input value={agentDraft.modelPreference} onChange={(event) => setAgentDraft({ ...agentDraft, modelPreference: event.target.value })} placeholder="claude-3-7-sonnet" />
                    </label>
                    <label>
                      Tags
                      <input value={toMultiline(agentDraft.tags)} onChange={(event) => setAgentDraft({ ...agentDraft, tags: fromMultiline(event.target.value) })} placeholder="frontend&#10;review&#10;dotnet" />
                    </label>
                    <label className="full-width">
                      Allowed tools
                      <textarea value={toMultiline(agentDraft.toolsAllowed)} onChange={(event) => setAgentDraft({ ...agentDraft, toolsAllowed: fromMultiline(event.target.value) })} placeholder="edit-files&#10;run-tests&#10;browser-inspect" rows={4} />
                    </label>
                    <label className="full-width">
                      Instructions
                      <textarea value={agentDraft.instructions} onChange={(event) => setAgentDraft({ ...agentDraft, instructions: event.target.value })} placeholder="Describe the tone, priorities, and guardrails for this agent." rows={8} />
                    </label>
                  </div>
                  <div className="button-row">
                    <button type="button" className="primary-button" onClick={() => void saveAgent()}>
                      Save agent
                    </button>
                    {agentDraft.id ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void api.deleteAgent(agentDraft.id).then(() => loadWorkspace())}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </FormCard>
              ) : (
                <MarkdownPreview
                  title="Agent Markdown"
                  markdown={buildAgentMarkdown(agentDraft)}
                  path={`/.claude/agents/${(agentDraft.name || 'agent').toLowerCase().replaceAll(' ', '-')}.md`}
                />
              )
            ) : libraryInspectorView === 'edit' ? (
              <FormCard title="Skill Editor" description="Use clear triggers and step-by-step notes so the skill feels effortless to follow.">
                <div className="form-grid">
                  <label>
                    Name
                    <input value={skillDraft.name} onChange={(event) => setSkillDraft({ ...skillDraft, name: event.target.value })} placeholder="Debug API" />
                  </label>
                  <label>
                    Trigger condition
                    <input value={skillDraft.triggerCondition} onChange={(event) => setSkillDraft({ ...skillDraft, triggerCondition: event.target.value })} placeholder="Use when an endpoint returns an error." />
                  </label>
                  <label className="full-width">
                    Purpose
                    <textarea value={skillDraft.purpose} onChange={(event) => setSkillDraft({ ...skillDraft, purpose: event.target.value })} placeholder="Describe the goal of this skill." rows={4} />
                  </label>
                  <label className="full-width">
                    Steps
                    <textarea value={toMultiline(skillDraft.steps)} onChange={(event) => setSkillDraft({ ...skillDraft, steps: fromMultiline(event.target.value) })} placeholder="Check logs&#10;Reproduce request&#10;Inspect mapping" rows={5} />
                  </label>
                  <label className="full-width">
                    Examples
                    <textarea value={toMultiline(skillDraft.examples)} onChange={(event) => setSkillDraft({ ...skillDraft, examples: fromMultiline(event.target.value) })} placeholder="500 error on agent create&#10;Unexpected null in profile loader" rows={4} />
                  </label>
                </div>
                <div className="button-row">
                  <button type="button" className="primary-button" onClick={() => void saveSkill()}>
                    Save skill
                  </button>
                  {skillDraft.id ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void api.deleteSkill(skillDraft.id).then(() => loadWorkspace())}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </FormCard>
            ) : (
              <MarkdownPreview
                title="Skill Markdown"
                markdown={buildSkillMarkdown(skillDraft)}
                path={`/.claude/skills/${(skillDraft.name || 'skill').toLowerCase().replaceAll(' ', '-')}.md`}
              />
            )}
          </div>
        </div>

        {templateAgents.length > 0 ? (
          <FormCard title="Outside Current Directory" description="Templates and helpers that are not part of the scanned directory stay here, separate from the active workspace.">
            <div className="template-grid">
              {templateAgents.map((template) => (
                <article key={template.id} className="template-card">
                  <strong>{template.name}</strong>
                  <p>{template.description}</p>
                  <button
                    type="button"
                    className="inline-button"
                    onClick={() => {
                      setLibrarySection('agents')
                      setLibraryInspectorView('edit')
                      setSelectedAgentId(template.id)
                    }}
                  >
                    Try this one
                  </button>
                </article>
              ))}
            </div>
          </FormCard>
        ) : null}
      </div>
    )
  }

  function renderProfiles() {
    return (
      <div className="page-grid">
        <section className="step-strip">
          <article className="step-card">
            <span className="step-number">1</span>
            <div>
              <strong>Scan and collect</strong>
              <p>Pull in the project path, file hints, and CLAUDE flow from the workspace.</p>
            </div>
          </article>
          <article className="step-card">
            <span className="step-number">2</span>
            <div>
              <strong>Tune the context</strong>
              <p>Adjust profile details, helper picks, and routing rules in one pass.</p>
            </div>
          </article>
          <article className="step-card">
            <span className="step-number">3</span>
            <div>
              <strong>Generate and export</strong>
              <p>Preview the pack, copy the files you need, then export when it feels right.</p>
            </div>
          </article>
        </section>

        {renderSegmentButtons(workspaceSection, setWorkspaceSection, [
          { value: 'scan', label: 'Scan' },
          { value: 'context', label: 'Context' },
          { value: 'generate', label: 'Generate' },
          { value: 'ship', label: 'Ship' },
        ])}

        {workspaceSection === 'scan' ? (
        <div className="two-column">
          <FormCard title="Workspace Flow" description="Point to the project, scan the directory, and pull in helpers from the files you already have.">
            <div className="workspace-flow-grid">
              <label className="full-width">
                {language === 'th' ? 'Project directory' : 'Project directory'}
                <input
                  value={workspaceDirectory}
                  onChange={(event) => setWorkspaceDirectory(event.target.value)}
                  placeholder={language === 'th' ? 'D:\\Projects\\my-app' : 'D:\\Projects\\my-app'}
                />
              </label>
              <div className="button-row">
                <button type="button" className="primary-button" onClick={() => void scanWorkspace()}>
                  {language === 'th' ? 'à¸ªà¹à¸à¸™à¹‚à¸Ÿà¸¥à¹€à¸”à¸­à¸£à¹Œ' : 'Scan directory'}
                </button>
                <button type="button" className="secondary-button" onClick={applyWorkspaceScanToProfile} disabled={!workspaceScan}>
                  {language === 'th' ? 'à¹€à¸•à¸´à¸¡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹‚à¸›à¸£à¹€à¸ˆà¹‡à¸à¸•à¹Œ' : 'Fill project details'}
                </button>
                <button type="button" className="secondary-button" onClick={() => void importAllWorkspaceItems()} disabled={!workspaceScan}>
                  {language === 'th' ? 'à¸™à¸³à¹€à¸‚à¹‰à¸²à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”' : 'Import all'}
                </button>
                <button type="button" className="secondary-button" onClick={() => void applyClaudeFlow()} disabled={!workspaceScan?.claude}>
                  {language === 'th' ? 'à¹ƒà¸Šà¹‰ flow à¸ˆà¸²à¸ CLAUDE.md' : 'Apply CLAUDE flow'}
                </button>
              </div>
            </div>
          </FormCard>

          {workspaceScan ? (
            <div className="stack">
              <div className="workspace-results">
                <div className="workspace-summary-card">
                  <strong>{workspaceScan.suggestedProjectName}</strong>
                  <p>{workspaceScan.directoryPath}</p>
                  <small>{workspaceScan.suggestedTechStack || (language === 'th' ? 'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸ˆà¸­ stack à¸Šà¸±à¸”à¹€à¸ˆà¸™' : 'No clear stack detected yet.')}</small>
                </div>
                {workspaceScan.agents.length > 0 ? (
                  <div className="list-stack">
                    {workspaceScan.agents.map((item) => (
                      <button
                        key={item.fullPath}
                        type="button"
                        className="list-card"
                        onClick={() => openAgentFromWorkspace(item)}
                      >
                        <div>
                          <strong>{item.suggestedName}</strong>
                          <p>{item.relativePath}</p>
                        </div>
                        <span className="chip">Sub-agent</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={language === 'th' ? 'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸ˆà¸­ sub-agent à¹ƒà¸™ dir à¸™à¸µà¹‰' : 'No sub-agents found in this directory'}
                    message={language === 'th' ? 'à¸¥à¸­à¸‡à¸ªà¹à¸à¸™ dir à¸—à¸µà¹ˆà¸¡à¸µà¹„à¸Ÿà¸¥à¹Œ agent markdown à¸«à¸£à¸·à¸­à¹€à¸£à¸´à¹ˆà¸¡à¸ªà¸£à¹‰à¸²à¸‡ agent à¹ƒà¸«à¸¡à¹ˆà¸ˆà¸²à¸ Library' : 'Scan a directory with agent markdown files, or create a new agent from the Library.'}
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="No scan yet" message="Start with a project directory and the workspace summary will land here." />
          )}
        </div>
        ) : null}

        {workspaceSection === 'context' ? (
        <div className="two-column">
        <FormCard title="Project Profiles" description="Save stack details once, then reuse them whenever you spin up a fresh setup file.">
          <div className="list-toolbar">
            <button type="button" className="primary-button" onClick={() => setProfileDraft(defaultProfile)}>
              New profile
            </button>
          </div>
          <div className="list-stack">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={selectedProfileId === profile.id ? 'list-card active' : 'list-card'}
                onClick={() => setSelectedProfileId(profile.id)}
              >
                <div>
                  <strong>{profile.projectName}</strong>
                  <p>{profile.techStack}</p>
                </div>
              </button>
            ))}
          </div>
        </FormCard>

        <FormCard title="Profile Editor" description="This becomes the cozy project context section inside `CLAUDE.md`.">
          <div className="form-grid">
            <label>
              Project name
              <input value={profileDraft.projectName} onChange={(event) => setProfileDraft({ ...profileDraft, projectName: event.target.value })} placeholder="AI Review Station" />
            </label>
            <label>
              Tech stack
              <input value={profileDraft.techStack} onChange={(event) => setProfileDraft({ ...profileDraft, techStack: event.target.value })} placeholder="React + TypeScript, ASP.NET Core, Python ML" />
            </label>
            <label className="full-width">
              Project path
              <input value={profileDraft.projectPath} onChange={(event) => setProfileDraft({ ...profileDraft, projectPath: event.target.value })} placeholder="D:\\Projects\\my-app" />
            </label>
            <div className="full-width button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setWorkspaceDirectory(profileDraft.projectPath)
                  void scanWorkspace()
                }}
                disabled={!profileDraft.projectPath.trim()}
              >
                {language === 'th' ? 'สแกนจาก Project path นี้' : 'Scan this project path'}
              </button>
              <button type="button" className="secondary-button" onClick={applyWorkspaceScanToProfile} disabled={!workspaceScan}>
                {language === 'th' ? 'ดึงข้อมูลจากผลสแกนล่าสุด' : 'Use latest scan details'}
              </button>
            </div>
            <label className="full-width">
              Coding rules
              <textarea value={profileDraft.codingRules} onChange={(event) => setProfileDraft({ ...profileDraft, codingRules: event.target.value })} placeholder="- Prefer simple names&#10;- Keep components small" rows={6} />
            </label>
            <label className="full-width">
              Folder structure
              <textarea value={profileDraft.folderStructure} onChange={(event) => setProfileDraft({ ...profileDraft, folderStructure: event.target.value })} placeholder="/frontend&#10;/backend&#10;/.claude" rows={5} />
            </label>
            <label className="full-width">
              Important commands
              <textarea value={profileDraft.importantCommands} onChange={(event) => setProfileDraft({ ...profileDraft, importantCommands: event.target.value })} placeholder="npm run dev&#10;dotnet run&#10;python app.py" rows={5} />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={() => void saveProfile()}>
              Save profile
            </button>
            {profileDraft.id ? (
              <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void api.deleteProfile(profileDraft.id).then(() => loadWorkspace())}
                >
                  Delete
                </button>
            ) : null}
          </div>
        </FormCard>
        </div>
        ) : null}

        {workspaceSection === 'generate' ? (
        <div className="two-column">
          <FormCard title="Build Pack" description="Pick the project context, helpers, and rules here, then generate the files without jumping to another page.">
            <div className="builder-section">
              <label>
                Project profile
                <select
                  value={builderSelection.projectProfileId ?? ''}
                  onChange={(event) =>
                    setBuilderSelection({
                      ...builderSelection,
                      projectProfileId: event.target.value || null,
                    })
                  }
                >
                  <option value="">No profile selected</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.projectName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="selection-grid">
              <div>
                <h3>Agents</h3>
                {currentWorkspaceAgents.map((agent) => (
                  <label key={agent.id} className="checkbox-card">
                    <input type="checkbox" checked={builderSelection.agentIds.includes(agent.id)} onChange={() => toggleSelection('agentIds', agent.id)} />
                    <span>
                      <strong>{agent.name}</strong>
                      <small>{agent.role}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div>
                <h3>Skills</h3>
                {currentWorkspaceSkills.map((skill) => (
                  <label key={skill.id} className="checkbox-card">
                    <input type="checkbox" checked={builderSelection.skillIds.includes(skill.id)} onChange={() => toggleSelection('skillIds', skill.id)} />
                    <span>
                      <strong>{skill.name}</strong>
                      <small>{skill.triggerCondition}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div>
                <h3>Routing rules</h3>
                {routingRules.map((rule) => (
                  <label key={rule.id} className="checkbox-card">
                    <input type="checkbox" checked={builderSelection.routingRuleIds.includes(rule.id)} onChange={() => toggleSelection('routingRuleIds', rule.id)} />
                    <span>
                      <strong>{rule.name}</strong>
                      <small>{rule.condition}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="button-row">
              <button type="button" className="primary-button" onClick={() => void generateFiles()}>
                Cook the files
              </button>
            </div>
          </FormCard>

          <MarkdownPreview title="Main Context Preview" markdown={builderPreview} path="/CLAUDE.md" />
        </div>
        ) : null}

        {workspaceSection === 'ship' ? (
        <div className="two-column">
          <div className="stack">
            <FormCard title="Routing Rules" description="Define lightweight routing logic so common tasks get nudged to the right helper.">
              <div className="list-toolbar">
                <button type="button" className="primary-button" onClick={() => setRuleDraft(defaultRule)}>
                  New rule
                </button>
              </div>
              <div className="list-stack">
                {routingRules.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    className={selectedRuleId === rule.id ? 'list-card active' : 'list-card'}
                    onClick={() => setSelectedRuleId(rule.id)}
                  >
                    <div>
                      <strong>{rule.name}</strong>
                      <p>{rule.condition}</p>
                    </div>
                  </button>
                ))}
              </div>
            </FormCard>

            <FormCard title="Generated Files" description="Preview, copy, or export the latest pack from the same workspace page.">
              <div className="list-toolbar">
                <button type="button" className="primary-button" onClick={() => void exportFiles()} disabled={generatedFiles.length === 0}>
                  Pack export batch
                </button>
              </div>
              <div className="list-stack">
                {generatedFiles.length === 0 ? (
                  <EmptyState title="Nothing generated yet" message="Build a fresh pack and the files will show up here." />
                ) : (
                  generatedFiles.map((file) => (
                    <button
                      key={file.relativePath}
                      type="button"
                      className={selectedGeneratedFile === file.relativePath ? 'list-card active' : 'list-card'}
                      onClick={() => setSelectedGeneratedFile(file.relativePath)}
                    >
                      <div>
                        <strong>{file.fileName}</strong>
                        <p>{file.relativePath}</p>
                      </div>
                      <span className="chip path-chip">{file.fileType}</span>
                    </button>
                  ))
                )}
              </div>
            </FormCard>
          </div>

          <div className="stack">
            <FormCard title="Rule Editor" description="Example: if the task smells like frontend work, send it to your frontend agent.">
              <div className="form-grid">
                <label>
                  Rule name
                  <input value={ruleDraft.name} onChange={(event) => setRuleDraft({ ...ruleDraft, name: event.target.value })} placeholder="Frontend Tasks" />
                </label>
                <label>
                  Priority
                  <input type="number" value={ruleDraft.priority} onChange={(event) => setRuleDraft({ ...ruleDraft, priority: Number(event.target.value) })} />
                </label>
                <label className="full-width">
                  Condition
                  <textarea value={ruleDraft.condition} onChange={(event) => setRuleDraft({ ...ruleDraft, condition: event.target.value })} placeholder="task is frontend" rows={4} />
                </label>
                <label>
                  Route to agent
                  <select value={ruleDraft.agentId ?? ''} onChange={(event) => setRuleDraft({ ...ruleDraft, agentId: event.target.value || null })}>
                    <option value="">No agent selected</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="toggle-field">
                  <input type="checkbox" checked={ruleDraft.isEnabled} onChange={(event) => setRuleDraft({ ...ruleDraft, isEnabled: event.target.checked })} />
                  Enable this rule
                </label>
              </div>
              <div className="button-row">
                <button type="button" className="primary-button" onClick={() => void saveRule()}>
                  Save rule
                </button>
                {ruleDraft.id ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void api.deleteRoutingRule(ruleDraft.id).then(() => loadWorkspace())}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </FormCard>

            {currentGeneratedFile ? (
              <div className="stack">
                <MarkdownPreview title={currentGeneratedFile.fileName} markdown={currentGeneratedFile.content} path={currentGeneratedFile.relativePath} />
                <div className="panel">
                  <div className="button-row">
                    <button type="button" className="primary-button" onClick={() => void copyToClipboard(currentGeneratedFile.content)}>
                      Copy file content
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void copyToClipboard(currentGeneratedFile.relativePath)}>
                      Copy target path
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="Preview will appear here" message="Generate files first and the export-ready markdown will pop in here." />
            )}
          </div>
        </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentPage={page}
        onSelect={setPage}
        pages={sidebarPages}
        eyebrow={copy.sidebar.eyebrow}
        tipTitle={copy.sidebar.tipTitle}
        tipText={copy.sidebar.tipText}
      />

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="topbar-badge">Agent Studio</span>
            <h2>{copy.pageMeta[page].title}</h2>
            <p className="topbar-description">{copy.pageMeta[page].description}</p>
          </div>
          <div className="topbar-actions">
            <div className="toolbar-toggle-group">
              <button
                type="button"
                className={language === 'th' ? 'toggle-chip active' : 'toggle-chip'}
                onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
              >
                {copy.controls.language}
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'toggle-chip active' : 'toggle-chip'}
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              >
                {theme === 'light' ? copy.controls.dark : copy.controls.light}
              </button>
            </div>
            <span className={busy ? 'status-pill busy' : 'status-pill'}>{message}</span>
            <button type="button" className="secondary-button" onClick={() => void loadWorkspace()}>
              {copy.controls.refresh}
            </button>
          </div>
        </header>

        <div className={page === 'terminal' ? 'persistent-page visible' : 'persistent-page hidden'}>
          <ProjectTerminal
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
            onStatusMessage={setMessage}
            language={language}
            visible={page === 'terminal'}
          />
        </div>

        {page === 'dashboard' && renderDashboard()}
        {page === 'agents' && renderAgents()}
        {page === 'profiles' && renderProfiles()}
      </main>
    </div>
  )
}

export default App
