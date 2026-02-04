import Store from 'electron-store'
import { app } from 'electron'
import path from 'path'
import type { Settings, ModelType } from '../src/types'

// Valid model values for validation
const VALID_MODELS: ModelType[] = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-5-20251101'
]

interface StoreSchema {
  apiKey: string
  model: ModelType
  tildaDirectory: string
}

// Default tilda directory in user's home
function getDefaultTildaDirectory(): string {
  return path.join(app.getPath('home'), 'tilda')
}

const store = new Store<StoreSchema>({
  defaults: {
    apiKey: '',
    model: 'claude-sonnet-4-5-20250929',
    tildaDirectory: ''  // Empty means use default
  }
})

export function getSettings(): Settings {
  return {
    apiKey: store.get('apiKey'),
    model: store.get('model'),
    tildaDirectory: getTildaDirectory()
  }
}

export function validateSettings(settings: unknown): settings is Settings {
  if (typeof settings !== 'object' || settings === null) {
    return false
  }
  const s = settings as Record<string, unknown>
  if (typeof s.apiKey !== 'string') {
    return false
  }
  if (typeof s.model !== 'string' || !VALID_MODELS.includes(s.model as ModelType)) {
    return false
  }
  if (s.tildaDirectory !== undefined && typeof s.tildaDirectory !== 'string') {
    return false
  }
  return true
}

export function saveSettings(settings: Settings): void {
  if (!validateSettings(settings)) {
    throw new Error('Invalid settings: apiKey must be a string and model must be a valid model type')
  }
  store.set('apiKey', settings.apiKey)
  store.set('model', settings.model)
  if (settings.tildaDirectory !== undefined) {
    store.set('tildaDirectory', settings.tildaDirectory)
  }
}

export function getApiKey(): string {
  return store.get('apiKey')
}

export function getModel(): ModelType {
  return store.get('model')
}

export function getTildaDirectory(): string {
  const configured = store.get('tildaDirectory')
  return configured || getDefaultTildaDirectory()
}

export function setTildaDirectory(dir: string): void {
  store.set('tildaDirectory', dir)
}
