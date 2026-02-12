import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { WorkingFolderEntry } from '../types'

interface FileManagerSidebarProps {
  taskId: string
}

interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  children: TreeNode[]
  entry?: WorkingFolderEntry
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(filename: string, mimeType?: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mime = mimeType || ''

  if (mime.includes('image')) {
    return (
      <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    )
  }

  if (ext === 'md' || ext === 'markdown') {
    return (
      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  }

  if (ext === 'pdf') {
    return (
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  }

  return (
    <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function buildTree(entries: WorkingFolderEntry[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const entry of entries) {
    const parts = entry.relativePath.split('/')
    let current = root

    if (entry.isDirectory) {
      // Build folder nodes for each directory segment
      for (let i = 0; i < parts.length; i++) {
        const folderName = parts[i]
        const folderPath = parts.slice(0, i + 1).join('/')
        let folder = current.find(n => n.isFolder && n.name === folderName)
        if (!folder) {
          folder = { name: folderName, path: folderPath, isFolder: true, children: [], entry: i === parts.length - 1 ? entry : undefined }
          current.push(folder)
        }
        current = folder.children
      }
    } else {
      // Build folder nodes for parent directories
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

      // Add file node
      current.push({
        name: entry.name,
        path: entry.relativePath,
        isFolder: false,
        children: [],
        entry
      })
    }
  }

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

function FolderNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-surface-tertiary/50 rounded text-sm text-text-secondary transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
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
      {isExpanded && (
        <div>
          {node.children.map(child =>
            child.isFolder ? (
              <FolderNode key={child.path} node={child} depth={depth + 1} />
            ) : (
              <FileNode key={child.path} node={child} depth={depth + 1} />
            )
          )}
        </div>
      )}
    </div>
  )
}

function FileNode({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 hover:bg-surface-tertiary/50 rounded"
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      {getFileIcon(node.name, node.entry?.mimeType)}
      <span className="flex-1 text-sm text-text truncate">{node.name}</span>
      {node.entry?.size !== undefined && (
        <span className="text-xs text-text-secondary flex-shrink-0">{formatFileSize(node.entry.size)}</span>
      )}
    </div>
  )
}

export function FileManagerSidebar({ taskId }: FileManagerSidebarProps) {
  const [entries, setEntries] = useState<WorkingFolderEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      const result = await window.api.shell.listWorkingFolder(taskId)
      setEntries(result)
    } catch {
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    setIsLoading(true)
    fetchEntries()

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchEntries, 5000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchEntries])

  const tree = useMemo(() => buildTree(entries), [entries])

  const handleOpenInFinder = () => {
    window.api.shell.openWorkingFolder(taskId)
  }

  const handleRefresh = () => {
    fetchEntries()
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-light flex-shrink-0">
        <h2 className="text-sm font-medium text-text">Files</h2>
        <div className="flex items-center gap-1">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.015 4.356v4.992" />
            </svg>
          </button>
          {/* Open in Finder button */}
          <button
            onClick={handleOpenInFinder}
            className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
            title="Open in Finder"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="w-5 h-5 text-text-tertiary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-text-secondary/70 italic py-4 text-center">
            No files yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {tree.map(node =>
              node.isFolder ? (
                <FolderNode key={node.path} node={node} depth={0} />
              ) : (
                <FileNode key={node.path} node={node} depth={0} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
