const isDev = import.meta.env.DEV

export const logger = {
  log: (...args: unknown[]) => isDev && console.log('[Tilda]', ...args),
  warn: (...args: unknown[]) => isDev && console.warn('[Tilda]', ...args),
  error: (...args: unknown[]) => console.error('[Tilda Error]', ...args)
}
