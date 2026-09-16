/**
 * Minimal versioned localStorage helper. The version is baked into the key
 * so a future schema change can migrate (or simply not collide with) old
 * data; a real migration path lands in Phase 5 once there's an actual
 * progress schema to migrate.
 */

const STORAGE_VERSION = 1
const STORAGE_PREFIX = 'fretcards'

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}:v${STORAGE_VERSION}:${key}`
}

export function loadValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    // localStorage unavailable (private mode, quota, disabled) or corrupt JSON: degrade to the fallback.
    return fallback
  }
}

export function saveValue<T>(key: string, value: T): void {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value))
  } catch {
    // Ignore write failures (private mode, quota exceeded); the feature just won't persist.
  }
}
