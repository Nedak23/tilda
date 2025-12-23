// Shared file type constants and utilities

export const SUPPORTED_FILE_EXTENSIONS = /\.(txt|md|markdown|pdf|png|jpg|jpeg|gif|webp)$/i
export const SUPPORTED_MIME_TYPES = /^(text\/|image\/|application\/pdf)/

// File input accept attribute value
export const FILE_INPUT_ACCEPT = '.txt,.md,.markdown,.pdf,.png,.jpg,.jpeg,.gif,.webp,text/*,image/*,application/pdf'

/**
 * Check if a file is supported based on its MIME type or extension
 */
export function isFileSupported(file: File): boolean {
  return SUPPORTED_MIME_TYPES.test(file.type) || SUPPORTED_FILE_EXTENSIONS.test(file.name)
}

/**
 * Check if a file should be read as text (vs binary/base64)
 */
export function isTextFile(file: File): boolean {
  const mimeType = file.type || 'text/plain'
  return mimeType.startsWith('text/') || /\.(txt|md|markdown)$/i.test(file.name)
}

/**
 * Read a file and return its content as a string.
 * Text files are read as text, binary files (images, PDFs) are read as base64 data URLs.
 */
export async function readFileContent(file: File): Promise<string> {
  if (isTextFile(file)) {
    return file.text()
  }

  // Read binary files as base64 data URL
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Get the MIME type for a file, defaulting to text/plain if not specified
 */
export function getFileMimeType(file: File): string {
  return file.type || 'text/plain'
}
