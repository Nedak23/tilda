export const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL

export const logger = {
  log: (...args: unknown[]) => isDev && console.log('[Tilda]', ...args),
  warn: (...args: unknown[]) => isDev && console.warn('[Tilda]', ...args),
  error: (...args: unknown[]) => console.error('[Tilda Error]', ...args)
}
