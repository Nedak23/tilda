import { useRef } from 'react'
import type { ContextDocument } from '../types'

interface ContextDocumentListProps {
  documents: ContextDocument[]
  onUpload: (file: File) => void
  onDelete: (id: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('text/')) return '📄'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('json')) return '📋'
  if (mimeType.includes('image')) return '🖼️'
  return '📎'
}

export function ContextDocumentList({ documents, onUpload, onDelete }: ContextDocumentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
      // Reset input so the same file can be selected again
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">Documents</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text hover:bg-surface-tertiary rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-text-secondary/70 italic py-2">
          No documents uploaded. Documents will be included as context for AI chat on tasks in this context.
        </p>
      ) : (
        <ul className="space-y-1">
          {documents.map(doc => (
            <li
              key={doc.id}
              className="flex items-center gap-2 px-2 py-1.5 bg-surface-tertiary/50 rounded group"
            >
              <span className="text-sm">{getFileIcon(doc.mimeType)}</span>
              <span className="flex-1 text-sm text-text truncate">{doc.filename}</span>
              <span className="text-xs text-text-secondary">{formatFileSize(doc.fileSize)}</span>
              <button
                onClick={() => onDelete(doc.id)}
                className="p-1 text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete document"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
