import Store from 'electron-store'
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
}

const store = new Store<StoreSchema>({
  defaults: {
    apiKey: '',
    model: 'claude-sonnet-4-5-20250929'
  }
})

export function getSettings(): Settings {
  return {
    apiKey: store.get('apiKey'),
    model: store.get('model')
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
  return true
}

export function saveSettings(settings: Settings): void {
  if (!validateSettings(settings)) {
    throw new Error('Invalid settings: apiKey must be a string and model must be a valid model type')
  }
  store.set('apiKey', settings.apiKey)
  store.set('model', settings.model)
}

export function getApiKey(): string {
  return store.get('apiKey')
}

export function getModel(): ModelType {
  return store.get('model')
}
