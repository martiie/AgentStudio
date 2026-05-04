import type { Agent, GeneratedFile, ProjectProfile, RoutingRule, Skill } from '../types'

const API_ROOT =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' &&
  (window.location.port === '5173' || window.location.port === '4173')
    ? 'http://localhost:5298/api'
    : `${window.location.origin}/api`)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  getAgents: () => request<Agent[]>('/agents'),
  createAgent: (payload: Partial<Agent>) =>
    request<Agent>('/agents', { method: 'POST', body: JSON.stringify(payload) }),
  updateAgent: (id: string, payload: Partial<Agent>) =>
    request<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAgent: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),

  getSkills: () => request<Skill[]>('/skills'),
  createSkill: (payload: Partial<Skill>) =>
    request<Skill>('/skills', { method: 'POST', body: JSON.stringify(payload) }),
  updateSkill: (id: string, payload: Partial<Skill>) =>
    request<Skill>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSkill: (id: string) => request<void>(`/skills/${id}`, { method: 'DELETE' }),

  getProfiles: () => request<ProjectProfile[]>('/project-profiles'),
  createProfile: (payload: Partial<ProjectProfile>) =>
    request<ProjectProfile>('/project-profiles', { method: 'POST', body: JSON.stringify(payload) }),
  updateProfile: (id: string, payload: Partial<ProjectProfile>) =>
    request<ProjectProfile>(`/project-profiles/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProfile: (id: string) => request<void>(`/project-profiles/${id}`, { method: 'DELETE' }),

  getRoutingRules: () => request<RoutingRule[]>('/routing-rules'),
  createRoutingRule: (payload: Partial<RoutingRule>) =>
    request<RoutingRule>('/routing-rules', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoutingRule: (id: string, payload: Partial<RoutingRule>) =>
    request<RoutingRule>(`/routing-rules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRoutingRule: (id: string) => request<void>(`/routing-rules/${id}`, { method: 'DELETE' }),

  generateClaude: (payload: {
    projectProfileId: string | null
    agentIds: string[]
    skillIds: string[]
    routingRuleIds: string[]
  }) => request<GeneratedFile[]>('/generate/claude-md', { method: 'POST', body: JSON.stringify(payload) }),
  exportFiles: (files: GeneratedFile[]) =>
    request('/export', { method: 'POST', body: JSON.stringify({ files }) }),
}
