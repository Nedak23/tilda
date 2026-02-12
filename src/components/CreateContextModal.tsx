import { useState, useRef, useEffect } from 'react'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import type { DirectoryFile } from '../types'

interface CreateContextModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, description?: string, files?: File[], directoryFiles?: DirectoryFile[]) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CreateContextModal({ isOpen, onClose, onCreate }: CreateContextModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingDirectoryFiles, setPendingDirectoryFiles] = useState<DirectoryFile[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // Close add menu when clicking outside
  useEffect(() => {
    if (!showAddMenu) return
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAddMenu])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(
        name.trim(),
        description.trim() || undefined,
        pendingFiles.length > 0 ? pendingFiles : undefined,
        pendingDirectoryFiles.length > 0 ? pendingDirectoryFiles : undefined
      )
      setName('')
      setDescription('')
      setPendingFiles([])
      setPendingDirectoryFiles([])
      onClose()
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setPendingFiles([])
    setPendingDirectoryFiles([])
    onClose()
  }

  const handleDirectorySelect = async () => {
    const files = await window.api.dialog.selectDirectory()
    if (files) {
      setPendingDirectoryFiles(prev => [...prev, ...files])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const supportedFiles = Array.from(files).filter(isFileSupported)
      setPendingFiles(prev => [...prev, ...supportedFiles])
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-secondary border border-border-light rounded-lg shadow-xl w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-light">
            <h2 className="text-lg font-semibold text-text">Create Context</h2>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="context-name" className="block text-sm font-medium text-text-secondary mb-1">
                Name
              </label>
              <input
                id="context-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Context name"
                autoFocus
                className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-border-selected focus:border-border-selected"
              />
            </div>

            <div>
              <label htmlFor="context-description" className="block text-sm font-medium text-text-secondary mb-1">
                Description (optional)
              </label>
              <textarea
                id="context-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this context for?"
                rows={3}
                className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-border-selected focus:border-border-selected resize-none"
              />
            </div>

            {/* Files section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-text-secondary">
                  Documents (optional)
                </label>
                <div className="relative" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text hover:bg-surface-tertiary rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                  {showAddMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-surface-tertiary rounded-lg shadow-elevated p-1 z-20 w-36">
                      <button
                        type="button"
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
                        type="button"
                        onClick={() => {
                          handleDirectorySelect()
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
              {pendingFiles.length === 0 && pendingDirectoryFiles.length === 0 ? (
                <p className="text-xs text-text-secondary/70 italic py-2">
                  No files selected. Files will be uploaded after the context is created.
                </p>
              ) : (
                <ul className="space-y-1">
                  {pendingFiles.map((file, index) => (
                    <li
                      key={`file-${index}`}
                      className="flex items-center gap-2 px-2 py-1.5 bg-surface-tertiary/50 rounded group"
                    >
                      <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="flex-1 text-sm text-text truncate">{file.name}</span>
                      <span className="text-xs text-text-secondary">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="p-1 text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove file"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                  {pendingDirectoryFiles.map((file, index) => (
                    <li
                      key={`dir-${index}`}
                      className="flex items-center gap-2 px-2 py-1.5 bg-surface-tertiary/50 rounded group"
                    >
                      <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="flex-1 text-sm text-text truncate" title={file.relativePath}>{file.relativePath}</span>
                      <span className="text-xs text-text-secondary">{formatFileSize(file.fileSize)}</span>
                      <button
                        type="button"
                        onClick={() => setPendingDirectoryFiles(prev => prev.filter((_, i) => i !== index))}
                        className="p-1 text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove file"
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
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border-light flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text rounded-md hover:bg-surface-tertiary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-text bg-surface-button border border-border rounded-md hover:bg-surface-buttonHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
