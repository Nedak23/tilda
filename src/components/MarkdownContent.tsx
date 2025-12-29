import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        components={{
        // Headings
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,

        // Paragraphs
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,

        // Bold and italic
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,

        // Lists
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="ml-1">{children}</li>,

        // Code
        code: ({ className, children }) => {
          const isInline = !className
          if (isInline) {
            return (
              <code className="bg-surface-tertiary px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            )
          }
          return (
            <code className="block bg-surface-tertiary p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="my-2">{children}</pre>,

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline"
          >
            {children}
          </a>
        ),

        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-text-tertiary pl-3 my-2 text-text-secondary italic">
            {children}
          </blockquote>
        ),

        // Horizontal rule
        hr: () => <hr className="border-border-light my-3" />,
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
