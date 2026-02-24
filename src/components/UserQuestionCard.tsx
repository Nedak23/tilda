import { useState } from 'react'

interface UserQuestionCardProps {
  question: string
  options: string[]
  taskId: string
  isAnswered: boolean
  selectedAnswer?: string
  isStreaming: boolean
  onSelectOption: (option: string) => void
}

export function UserQuestionCard({
  question,
  options,
  isAnswered,
  selectedAnswer,
  isStreaming,
  onSelectOption
}: UserQuestionCardProps) {
  const [freeText, setFreeText] = useState('')

  const disabled = isAnswered || isStreaming

  const handleFreeTextSubmit = () => {
    if (freeText.trim() && !disabled) {
      onSelectOption(freeText.trim())
      setFreeText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFreeTextSubmit()
    }
  }

  return (
    <div className="mt-3 border border-border-light rounded-xl p-4 bg-surface-secondary">
      <p className="text-sm font-medium text-text mb-3">{question}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map((option, index) => {
          const isSelected = isAnswered && selectedAnswer === option
          return (
            <button
              key={index}
              onClick={() => !disabled && onSelectOption(option)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isSelected
                  ? 'bg-accent-blue text-white'
                  : disabled
                    ? 'bg-surface-tertiary text-text-tertiary cursor-not-allowed'
                    : 'bg-surface-tertiary text-text hover:bg-surface-button hover:text-white'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
      {!isAnswered && (
        <div className="flex gap-2">
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Or type a custom answer..."
            disabled={disabled}
            className="flex-1 bg-surface text-text text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-blue disabled:opacity-50"
          />
          <button
            onClick={handleFreeTextSubmit}
            disabled={!freeText.trim() || disabled}
            className="px-3 py-1.5 rounded-lg bg-surface-button text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-buttonHover transition-colors"
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}

// Parse :::question blocks from message content
export function parseQuestionBlock(content: string): {
  beforeQuestion: string
  question: string
  options: string[]
  afterQuestion: string
} | null {
  const questionRegex = /:::question\s*\n([\s\S]*?):::endquestion/
  const match = content.match(questionRegex)
  if (!match) return null

  const beforeQuestion = content.slice(0, match.index).trim()
  const afterQuestion = content.slice(match.index! + match[0].length).trim()
  const blockContent = match[1]

  const lines = blockContent.split('\n').map(l => l.trim()).filter(Boolean)
  const options: string[] = []
  const questionLines: string[] = []

  for (const line of lines) {
    if (line.startsWith(':::option ')) {
      options.push(line.slice(':::option '.length).trim())
    } else {
      questionLines.push(line)
    }
  }

  const question = questionLines.join(' ')
  if (!question || options.length === 0) return null

  return { beforeQuestion, question, options, afterQuestion }
}
