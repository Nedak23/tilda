import { useState, useRef } from 'react'
import { FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import type { ContextDocument } from '../types'

interface ContextDocumentListProps {
  documents: ContextDocument[]
  onUpload: (file: File) => void
  onUploadDirectory?: () => void
  onDelete: (id: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.includes('image')) {
    return (
      <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    )
  }
  // Default document icon for text, pdf, json, and other files
  return (
    <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

export function ContextDocumentList({ documents, onUpload, onUploadDirectory, onDelete }: ContextDocumentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      for (const file of files) {
        onUpload(file)
      }
      // Reset input so the same files can be selected again
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">Documents</h3>
        <div className="relative">
          <button
            onClick={() => onUploadDirectory ? setShowAddMenu(!showAddMenu) : fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text hover:bg-surface-tertiary rounded transition-colors"
            title="Add documents"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
          {showAddMenu && onUploadDirectory && (
            <div className="absolute right-0 top-full mt-1 bg-surface-tertiary rounded-lg shadow-elevated p-1 z-20 w-36">
              <button
                onClick={() => {
                  fileInputRef.current?.click()
                  setShowAddMenu(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-surface rounded transition-colors"
              >
                <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Files
              </button>
              <button
                onClick={() => {
                  onUploadDirectory()
                  setShowAddMenu(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-surface rounded transition-colors"
              >
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                </svg>
                Folder
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          multiple
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
              <FileIcon mimeType={doc.mimeType} />
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
