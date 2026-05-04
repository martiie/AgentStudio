import { useEffect, useMemo, useState } from 'react'
import { api } from './lib/api'
import { EmptyState } from './components/EmptyState'
import { FormCard } from './components/FormCard'
import { MarkdownPreview } from './components/MarkdownPreview'
import { Sidebar } from './components/Sidebar'
import { ClaudeTerminal } from './components/ClaudeTerminal'
import type { Agent, GeneratedFile, PageKey, ProjectProfile, RoutingRule, Skill } from './types'

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

function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
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

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Loading workspace...')

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
      setBuilderSelection({
        projectProfileId: profileData[0]?.id ?? null,
        agentIds: agentData.filter((item) => item.isTemplate).slice(0, 3).map((item) => item.id),
        skillIds: skillData.slice(0, 2).map((item) => item.id),
        routingRuleIds: routingData.map((item) => item.id),
      })
      setMessage('Workspace ready.')
    } catch {
      setMessage('Could not reach the API yet. Start the backend and refresh to load live data.')
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

  const selectedBuilderAgents = useMemo(
    () => agents.filter((item) => builderSelection.agentIds.includes(item.id)),
    [agents, builderSelection.agentIds],
  )

  const selectedBuilderSkills = useMemo(
    () => skills.filter((item) => builderSelection.skillIds.includes(item.id)),
    [builderSelection.skillIds, skills],
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
    const files = await api.generateClaude(builderSelection)
    setGeneratedFiles(files)
    setSelectedGeneratedFile(files[0]?.relativePath ?? '')
    setPage('export')
    setMessage('Generated CLAUDE.md and markdown files.')
  }

  async function exportFiles() {
    await api.exportFiles(generatedFiles)
    setMessage('Saved export batch to generated file history.')
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setMessage('Copied to clipboard.')
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
    const templateAgents = agents.filter((agent) => agent.isTemplate)
    return (
      <div className="page-grid">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Notion for AI agents</p>
            <h2>Design your Claude Code workspace without hand-editing a pile of markdown files.</h2>
            <p className="hero-copy">
              Create agents, package reusable skills, define routing rules, and preview every generated file before
              you export it.
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => setPage('agents')}>
              Create first agent
            </button>
            <button type="button" className="secondary-button" onClick={() => setPage('builder')}>
              Open CLAUDE Builder
            </button>
          </div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <span>Agents</span>
            <strong>{agents.length}</strong>
            <small>Templates and custom roles</small>
          </article>
          <article className="stat-card">
            <span>Skills</span>
            <strong>{skills.length}</strong>
            <small>Reusable workflows</small>
          </article>
          <article className="stat-card">
            <span>Profiles</span>
            <strong>{profiles.length}</strong>
            <small>Project-specific context</small>
          </article>
          <article className="stat-card">
            <span>Exports</span>
            <strong>{generatedFiles.length}</strong>
            <small>Files generated this session</small>
          </article>
        </section>

        <div className="two-column">
          <FormCard title="Starter Templates" description="Use these to move fast, then tailor the instructions to your team.">
            <div className="template-grid">
              {templateAgents.map((template) => (
                <article key={template.id} className="template-card">
                  <strong>{template.name}</strong>
                  <p>{template.description}</p>
                  <button
                    type="button"
                    className="inline-button"
                    onClick={() => {
                      setPage('agents')
                      setSelectedAgentId(template.id)
                    }}
                  >
                    Open template
                  </button>
                </article>
              ))}
            </div>
          </FormCard>

          <MarkdownPreview title="CLAUDE.md Preview" markdown={builderPreview} path="/CLAUDE.md" />
        </div>
      </div>
    )
  }

  function renderAgents() {
    return (
      <div className="two-column">
        <FormCard title="Agent Library" description="Pick a starter template or create a custom specialist for your workflow.">
          <div className="list-toolbar">
            <button type="button" className="primary-button" onClick={() => setAgentDraft(defaultAgent)}>
              New agent
            </button>
          </div>
          <div className="list-stack">
            {agents.length === 0 ? (
              <EmptyState title="No agents yet" message="Create your first agent to start building your workspace." />
            ) : (
              agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className={selectedAgentId === agent.id ? 'list-card active' : 'list-card'}
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <div>
                    <strong>{agent.name}</strong>
                    <p>{agent.role}</p>
                  </div>
                  <span className="chip">{agent.isTemplate ? 'Template' : 'Custom'}</span>
                </button>
              ))
            )}
          </div>
        </FormCard>

        <div className="stack">
          <FormCard title="Agent Editor" description="Keep the language simple and specific so Claude knows exactly how to help.">
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

          <MarkdownPreview
            title="Agent Markdown"
            markdown={buildAgentMarkdown(agentDraft)}
            path={`/.claude/agents/${(agentDraft.name || 'agent').toLowerCase().replaceAll(' ', '-')}.md`}
          />
        </div>
      </div>
    )
  }

  function renderSkills() {
    return (
      <div className="two-column">
        <FormCard title="Skill Library" description="Capture repeatable workflows so Claude can reuse them consistently.">
          <div className="list-toolbar">
            <button type="button" className="primary-button" onClick={() => setSkillDraft(defaultSkill)}>
              New skill
            </button>
          </div>
          <div className="list-stack">
            {skills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                className={selectedSkillId === skill.id ? 'list-card active' : 'list-card'}
                onClick={() => setSelectedSkillId(skill.id)}
              >
                <div>
                  <strong>{skill.name}</strong>
                  <p>{skill.triggerCondition}</p>
                </div>
                <span className="chip">{skill.isTemplate ? 'Template' : 'Custom'}</span>
              </button>
            ))}
          </div>
        </FormCard>

        <div className="stack">
          <FormCard title="Skill Editor" description="Use clear triggers and steps so the skill is easy to follow.">
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

          <MarkdownPreview
            title="Skill Markdown"
            markdown={buildSkillMarkdown(skillDraft)}
            path={`/.claude/skills/${(skillDraft.name || 'skill').toLowerCase().replaceAll(' ', '-')}.md`}
          />
        </div>
      </div>
    )
  }

  function renderBuilder() {
    return (
      <div className="two-column">
        <FormCard title="CLAUDE.md Builder" description="Choose the project context, active agents, skills, and routing rules to assemble your main file.">
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
              {agents.map((agent) => (
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
              {skills.map((skill) => (
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
              Generate files
            </button>
          </div>
        </FormCard>

        <MarkdownPreview title="Main Context Preview" markdown={builderPreview} path="/CLAUDE.md" />
      </div>
    )
  }

  function renderProfiles() {
    return (
      <div className="two-column">
        <FormCard title="Project Profiles" description="Save stack details once, then reuse them every time you generate CLAUDE.md.">
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

        <FormCard title="Profile Editor" description="This becomes the project context section inside CLAUDE.md.">
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
    )
  }

  function renderExportCenter() {
    return (
      <div className="two-column">
        <FormCard title="Generated Files" description="Each file is ready to copy, preview, or send to the export endpoint.">
          <div className="list-toolbar">
            <button type="button" className="primary-button" onClick={() => void exportFiles()} disabled={generatedFiles.length === 0}>
              Save export batch
            </button>
          </div>
          <div className="list-stack">
            {generatedFiles.length === 0 ? (
              <EmptyState title="Nothing generated yet" message="Use the CLAUDE Builder to generate the files for this project." />
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
          <EmptyState title="Preview will appear here" message="Generate files first to see the export-ready markdown." />
        )}
      </div>
    )
  }

  function renderTerminal() {
    return (
      <ClaudeTerminal
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onSelectProfile={setSelectedProfileId}
        onStatusMessage={setMessage}
      />
    )
  }

  function renderSettings() {
    return (
      <div className="page-grid">
        <section className="settings-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>API connection</h2>
                <p>Default frontend target</p>
              </div>
            </div>
            <code>{import.meta.env.VITE_API_URL ?? 'http://localhost:5298/api'}</code>
          </article>
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Generated output</h2>
                <p>Default paths</p>
              </div>
            </div>
            <ul className="path-list">
              <li>/CLAUDE.md</li>
              <li>/.claude/agents/*.md</li>
              <li>/.claude/skills/*.md</li>
            </ul>
          </article>
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Best practice</h2>
                <p>Keep instructions readable</p>
              </div>
            </div>
            <p className="muted-copy">
              Short paragraphs and flat bullet lists are easier for humans to edit and easier for Claude Code to follow.
            </p>
          </article>
        </section>

        <div className="two-column">
          <FormCard title="Routing Rules" description="Define lightweight routing logic for common task types.">
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

          <FormCard title="Rule Editor" description="Example: If task is frontend, use the frontend agent.">
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
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar currentPage={page} onSelect={setPage} />

      <main className="main-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Claude Code file manager</p>
            <h2>
              {page === 'builder'
                ? 'Router / CLAUDE.md Builder'
                : page === 'terminal'
                  ? 'Claude Terminal'
                  : page.charAt(0).toUpperCase() + page.slice(1)}
            </h2>
          </div>
          <div className="topbar-actions">
            <span className={busy ? 'status-pill busy' : 'status-pill'}>{message}</span>
            <button type="button" className="secondary-button" onClick={() => void loadWorkspace()}>
              Refresh
            </button>
          </div>
        </header>

        {page === 'dashboard' && renderDashboard()}
        {page === 'agents' && renderAgents()}
        {page === 'skills' && renderSkills()}
        {page === 'builder' && renderBuilder()}
        {page === 'profiles' && renderProfiles()}
        {page === 'terminal' && renderTerminal()}
        {page === 'export' && renderExportCenter()}
        {page === 'settings' && renderSettings()}
      </main>
    </div>
  )
}

export default App
