import { useState, useRef, useMemo, useCallback } from 'react'
import { FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import { ConfirmDialog } from './ConfirmDialog'
import type { FileTreeItem } from '../types'

interface ContextFileTreeProps {
  documents: FileTreeItem[]
  onUpload?: (file: File) => void
  onUploadDirectory?: () => void
  onDelete: (id: string) => void
  title?: string
}

interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  children: TreeNode[]
  document?: FileTreeItem
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(filename: string, mimeType: string) {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (mimeType.includes('image')) {
    return (
      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    )
  }

  if (ext === 'md' || ext === 'markdown') {
    return (
      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  }

  if (ext === 'pdf') {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  }

  // Default document icon
  return (
    <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function buildTree(documents: FileTreeItem[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const doc of documents) {
    if (!doc.relativePath) {
      // No relative path — goes at root level
      root.push({
        name: doc.filename,
        path: doc.filename,
        isFolder: false,
        children: [],
        document: doc
      })
      continue
    }

    const parts = doc.relativePath.split('/')
    let current = root

    // Build folder nodes for each directory segment
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]
      const folderPath = parts.slice(0, i + 1).join('/')
      let folder = current.find(n => n.isFolder && n.name === folderName)
      if (!folder) {
        folder = { name: folderName, path: folderPath, isFolder: true, children: [] }
        current.push(folder)
      }
      current = folder.children
    }

    // Add the file node
    current.push({
      name: doc.filename,
      path: doc.relativePath,
      isFolder: false,
      children: [],
      document: doc
    })
  }

  // Sort: folders first, then files, alphabetically
  function sortTree(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) {
      if (node.isFolder) sortTree(node.children)
    }
  }

  sortTree(root)
  return root
}

function collectDocumentIds(node: TreeNode): string[] {
  if (!node.isFolder && node.document) return [node.document.id]
  return node.children.flatMap(collectDocumentIds)
}

function FolderNode({ node, onDelete, onRequestConfirm, depth }: { node: TreeNode; onDelete: (id: string) => void; onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void; depth: number }) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleDeleteFolder = (e: React.MouseEvent) => {
    e.stopPropagation()
    const ids = collectDocumentIds(node)
    const count = ids.length
    onRequestConfirm(
      'Delete folder',
      `Delete "${node.name}" and ${count} file${count !== 1 ? 's' : ''} inside it?`,
      () => {
        for (const id of ids) {
          onDelete(id)
        }
      }
    )
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-surface-tertiary/50 rounded text-sm text-text-secondary transition-colors group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <svg
            className={`w-3 h-3 text-text-tertiary transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            {isExpanded ? (
              <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
            ) : (
              <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
            )}
          </svg>
          <span className="truncate">{node.name}</span>
        </button>
        <button
          onClick={handleDeleteFolder}
          className="p-1 text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          title="Delete folder"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {isExpanded && (
        <div>
          {node.children.map(child =>
            child.isFolder ? (
              <FolderNode key={child.path} node={child} onDelete={onDelete} onRequestConfirm={onRequestConfirm} depth={depth + 1} />
            ) : (
              <FileNode key={child.document?.id ?? child.path} node={child} onDelete={onDelete} onRequestConfirm={onRequestConfirm} depth={depth + 1} />
            )
          )}
        </div>
      )}
    </div>
  )
}

function FileNode({ node, onDelete, onRequestConfirm, depth }: { node: TreeNode; onDelete: (id: string) => void; onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void; depth: number }) {
  if (!node.document) return null

  const handleDelete = () => {
    onRequestConfirm(
      'Delete file',
      `Delete "${node.name}"?`,
      () => onDelete(node.document!.id)
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 hover:bg-surface-tertiary/50 rounded group"
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      {getFileIcon(node.name, node.document.mimeType)}
      <span className="flex-1 text-sm text-text truncate">{node.name}</span>
      {node.document.fileSize !== undefined && (
        <span className="text-xs text-text-secondary">{formatFileSize(node.document.fileSize)}</span>
      )}
      <button
        onClick={handleDelete}
        className="p-1 text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete document"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ContextFileTree({ documents, onUpload, onUploadDirectory, onDelete, title = 'Documents' }: ContextFileTreeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const tree = useMemo(() => buildTree(documents), [documents])

  const [confirmState, setConfirmState] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const handleRequestConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ title, message, onConfirm })
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onUpload) return
    const files = e.target.files
    if (files && files.length > 0) {
      for (const file of files) {
        onUpload(file)
      }
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {onUpload && (
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text hover:bg-surface-tertiary rounded transition-colors"
              title="Add documents"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
            {showAddMenu && (
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
                {onUploadDirectory && (
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
                )}
              </div>
            )}
          </div>
        )}
        {onUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_INPUT_ACCEPT}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        )}
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-text-secondary/70 italic py-2">
          No documents uploaded. Documents will be included as context for AI chat on tasks in this context.
        </p>
      ) : (
        <div className="space-y-0.5">
          {tree.map(node =>
            node.isFolder ? (
              <FolderNode key={node.path} node={node} onDelete={onDelete} onRequestConfirm={handleRequestConfirm} depth={0} />
            ) : (
              <FileNode key={node.document?.id ?? node.path} node={node} onDelete={onDelete} onRequestConfirm={handleRequestConfirm} depth={0} />
            )
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        onConfirm={() => {
          confirmState?.onConfirm()
          setConfirmState(null)
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
