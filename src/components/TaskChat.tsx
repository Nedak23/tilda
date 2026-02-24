import { useState, useRef, useEffect, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { ChatMessage } from './ChatMessage'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import { logger } from '../utils/logger'
import { ContextFileTree } from './ContextFileTree'
import type { Task, Message, Attachment } from '../types'

interface TaskChatProps {
  task: Task
  onBack: () => void
}

export function TaskChat({ task, onBack }: TaskChatProps) {
  const {
    attachmentsByTask,
    pendingAttachmentsByTask,
    pendingResponses,
    chatsByTask,
    activeChatIdByTask,
    messagesByChat,
    sendChatMessage,
    retryChatMessage,
    editAndResendChatMessage,
    removeAttachment,
    addPendingAttachment,
    addPendingAttachmentFromData,
    removePendingAttachment,
    updateTask,
    createChat,
    deleteChat,
    setActiveChat,
    updateChatName,
    getContextForTask
  } = useTaskStore()

  const chats = chatsByTask[task.id] || []
  const activeChatId = activeChatIdByTask[task.id]
  const messages = activeChatId ? (messagesByChat[activeChatId] || []) : []
  const attachments = attachmentsByTask[task.id] || []
  const pendingAttachments = pendingAttachmentsByTask[task.id] || []
  const isPending = activeChatId ? pendingResponses.has(activeChatId) : false
  const context = getContextForTask(task.id)

  // Create a map of attachments by ID for quick lookup when rendering messages
  const attachmentsById = useMemo(() => {
    const map = new Map<string, Attachment>()
    for (const attachment of attachments) {
      map.set(attachment.id, attachment)
    }
    return map
  }, [attachments])

  // Helper to get attachments for a message
  const getMessageAttachments = (message: Message): Attachment[] => {
    if (!message.attachmentIds || message.attachmentIds.length === 0) return []
    return message.attachmentIds
      .map(id => attachmentsById.get(id))
      .filter((a): a is Attachment => a !== undefined)
  }

  const [input, setInput] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(task.name)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTabName, setEditingTabName] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || isPending || !activeChatId) return

    const message = input.trim()
    setInput('')
    await sendChatMessage(task.id, activeChatId, message)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    for (const file of files) {
      if (!isFileSupported(file)) {
        logger.warn(`Skipping unsupported file: ${file.name}`)
        continue
      }
      await addPendingAttachment(task.id, file)
    }

    e.target.value = ''
  }

  const handleDirectorySelect = async () => {
    const files = await window.api.dialog.selectDirectory()
    if (!files) return

    for (const file of files) {
      await addPendingAttachmentFromData(task.id, file)
    }
  }

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== task.name) {
      await updateTask(task.id, { name: editedName.trim() })
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave()
    } else if (e.key === 'Escape') {
      setEditedName(task.name)
      setIsEditingName(false)
    }
  }

  const handleTabNameSave = async (chatId: string) => {
    if (editingTabName.trim()) {
      await updateChatName(chatId, editingTabName.trim())
    }
    setEditingTabId(null)
  }

  const handleTabNameKeyDown = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === 'Enter') {
      handleTabNameSave(chatId)
    } else if (e.key === 'Escape') {
      setEditingTabId(null)
    }
  }

  const handleCreateChat = async () => {
    await createChat(task.id)
  }

  const handleDeleteChat = async (chatId: string) => {
    await deleteChat(chatId, task.id)
  }

  const hasDetails = !!(task.deadline || task.description || attachments.length > 0)

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border-light">
        {/* Top bar: Back + Task name + Context + Expand */}
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-text-secondary hover:text-text transition-colors titlebar-no-drag flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Task name (editable on click) */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                className="text-sm font-semibold text-text bg-transparent border-b border-accent-blue focus:outline-none flex-1 min-w-0"
                autoFocus
              />
            ) : (
              <span
                onClick={() => setIsEditingName(true)}
                className="text-sm font-semibold text-text cursor-pointer hover:text-accent-blue transition-colors truncate"
              >
                {task.name}
              </span>
            )}

            {/* Context name */}
            {context && (
              <>
                <span className="text-text-tertiary text-xs flex-shrink-0">&middot;</span>
                <span className="text-xs text-text-tertiary truncate flex-shrink-0">
                  {context.name}
                </span>
              </>
            )}
          </div>

          {/* Expand details chevron */}
          {hasDetails && (
            <button
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="p-1 text-text-tertiary hover:text-text-secondary transition-colors titlebar-no-drag flex-shrink-0"
              aria-label={isDetailsOpen ? 'Collapse details' : 'Expand details'}
            >
              <svg
                className={`w-4 h-4 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Collapsible details section */}
        {isDetailsOpen && (
          <div className="px-4 pb-3">
            {task.deadline && (
              <p className="text-sm text-text-secondary mt-1">
                Due {format(parseISO(task.deadline), 'MMMM d, yyyy')}
              </p>
            )}
            {task.description && (
              <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">
                {task.description}
              </p>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mt-3">
                <ContextFileTree
                  documents={attachments}
                  onDelete={(id) => removeAttachment(id, task.id)}
                  title="Attachments"
                />
              </div>
            )}
          </div>
        )}

        {/* Chat tab bar */}
        <div className="flex items-center px-2 border-t border-border-light">
          <div className="flex items-center flex-1 overflow-x-auto min-w-0">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={`
                  group flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer
                  border-b-2 transition-colors flex-shrink-0
                  ${chat.id === activeChatId
                    ? 'border-accent-blue text-text'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary'
                  }
                `}
                onClick={() => setActiveChat(task.id, chat.id)}
                onDoubleClick={() => {
                  setEditingTabId(chat.id)
                  setEditingTabName(chat.name)
                }}
              >
                {editingTabId === chat.id ? (
                  <input
                    type="text"
                    value={editingTabName}
                    onChange={e => setEditingTabName(e.target.value)}
                    onBlur={() => handleTabNameSave(chat.id)}
                    onKeyDown={e => handleTabNameKeyDown(e, chat.id)}
                    className="text-xs bg-transparent border-b border-accent-blue focus:outline-none w-16"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate max-w-[80px]">{chat.name}</span>
                )}

                {/* Close button (not on last remaining tab) */}
                {chats.length > 1 && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteChat(chat.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-text-tertiary hover:text-error transition-all"
                    aria-label="Close chat"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add chat button (hidden when 5 chats exist) */}
          {chats.length < 5 && (
            <button
              onClick={handleCreateChat}
              className="p-1 text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0 ml-1"
              title="New chat"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <p className="text-center text-sm">
              Start a conversation to work on this task
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isLastAgentMessage =
                message.sender === 'agent' &&
                index === messages.length - 1

              // Determine if a question in this message has been answered
              const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
              const isAnswered = message.sender === 'agent' && nextMessage?.sender === 'user'

              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  attachments={getMessageAttachments(message)}
                  isStreaming={isPending && isLastAgentMessage}
                  isAnswered={isAnswered}
                  nextMessageContent={nextMessage?.sender === 'user' ? nextMessage.content : undefined}
                  taskId={task.id}
                  onRetry={activeChatId ? (id) => retryChatMessage(task.id, activeChatId, id) : undefined}
                  onEdit={activeChatId ? (id, content) => editAndResendChatMessage(task.id, activeChatId, id, content) : undefined}
                  onSelectOption={activeChatId ? (option) => sendChatMessage(task.id, activeChatId, option) : undefined}
                />
              )
            })}
          </>
        )}

        {isPending && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex justify-start">
            <div className="bg-surface-tertiary px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="w-4 h-4 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Attachments */}
      {pendingAttachments.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2 border-t border-border-light pt-2">
          <div className="flex flex-wrap gap-1.5">
            {pendingAttachments.map(attachment => (
              <div
                key={attachment.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-surface-tertiary rounded text-xs text-text-secondary"
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="truncate max-w-[100px]">{attachment.filename}</span>
                <button
                  onClick={() => removePendingAttachment(attachment.id, task.id)}
                  className="text-text-tertiary hover:text-error transition-colors"
                  aria-label="Remove attachment"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className={`flex-shrink-0 p-3 ${pendingAttachments.length === 0 ? 'border-t border-border-light' : ''}`}>
        <div className="bg-[#1a1a1a] rounded-xl p-3">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            rows={1}
            className="w-full bg-transparent text-text text-sm resize-none focus:outline-none focus:ring-0 border-none min-h-[24px] max-h-[120px]"
            disabled={isPending}
          />

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-2">
            {/* Left side - action buttons */}
            <div className="flex items-center gap-1 relative">
              <button
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-1 text-text-tertiary hover:text-text-secondary rounded transition-colors"
                title="Attach"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {showAttachMenu && (
                <div className="absolute left-0 bottom-full mb-1 bg-surface-tertiary rounded-lg shadow-elevated p-1 z-20 w-36">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click()
                      setShowAttachMenu(false)
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
                      handleDirectorySelect()
                      setShowAttachMenu(false)
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
              <input
                ref={fileInputRef}
                type="file"
                accept={FILE_INPUT_ACCEPT}
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Right side - send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isPending}
              className="p-1.5 rounded-lg bg-surface-button text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-buttonHover transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
