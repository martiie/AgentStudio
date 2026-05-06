import type { Agent, BrowseWorkspaceResult, GeneratedFile, ProjectProfile, RecentWorkspacesResult, RoutingRule, Skill, WorkspaceAvatarUploadResult, WorkspaceFileContent, WorkspaceFolderOpenResult, WorkspaceScanResult } from '../types'
import { API_ROOT } from './runtime'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Request failed: ${response.status}`

    try {
      const errorPayload = (await response.json()) as { message?: string }
      if (errorPayload?.message) {
        message = errorPayload.message
      }
    } catch {
      // Ignore parse errors and fall back to the status-based message.
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  browseWorkspace: () => request<BrowseWorkspaceResult | undefined>('/workspace/browse'),
  getRecentWorkspaces: () => request<RecentWorkspacesResult>('/workspace/recent'),
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
  scanWorkspace: (directoryPath: string) =>
    request<WorkspaceScanResult>('/workspace/scan', { method: 'POST', body: JSON.stringify({ directoryPath }) }),
  uploadStaffAvatar: (payload: { directoryPath: string; staffName: string; staffFolderName?: string; file: File }) => {
    const formData = new FormData()
    formData.append('directoryPath', payload.directoryPath)
    formData.append('staffName', payload.staffName)
    if (payload.staffFolderName) {
      formData.append('staffFolderName', payload.staffFolderName)
    }
    formData.append('file', payload.file)

    return request<WorkspaceAvatarUploadResult>('/workspace/staff-avatar', { method: 'POST', body: formData })
  },
  getWorkspaceFile: (directoryPath: string, relativePath: string) =>
    request<WorkspaceFileContent>(`/workspace/file?directoryPath=${encodeURIComponent(directoryPath)}&relativePath=${encodeURIComponent(relativePath)}`),
  saveWorkspaceFile: (payload: { directoryPath: string; relativePath: string; content: string }) =>
    request<WorkspaceFileContent>('/workspace/file', { method: 'POST', body: JSON.stringify(payload) }),
  openWorkspaceFolder: (payload: { directoryPath: string; relativePath: string; kind: 'agent' | 'skill' }) =>
    request<WorkspaceFolderOpenResult>('/workspace/open-folder', { method: 'POST', body: JSON.stringify(payload) }),
  workspaceAssetUrl: (directoryPath: string, relativePath: string) =>
    `${API_ROOT}/workspace/asset?directoryPath=${encodeURIComponent(directoryPath)}&relativePath=${encodeURIComponent(relativePath)}`,
  exportFiles: (files: GeneratedFile[]) =>
    request('/export', { method: 'POST', body: JSON.stringify({ files }) }),
}
