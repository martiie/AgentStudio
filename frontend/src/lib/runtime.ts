const devPorts = new Set(['5173', '4173'])
const backendPort = import.meta.env.VITE_BACKEND_PORT ?? '5298'

function getApiRoot() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  if (typeof window === 'undefined') {
    return `http://localhost:${backendPort}/api`
  }

  if (devPorts.has(window.location.port)) {
    return `http://${window.location.hostname}:${backendPort}/api`
  }

  return `${window.location.origin}/api`
}

export const API_ROOT = getApiRoot()
export const TERMINAL_HUB_URL = API_ROOT.replace(/\/api$/, '/hubs/terminal')
