import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-violet-500/40 pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full min-w-[12rem] border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/60">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 align-top text-foreground">{children}</td>,
  hr: () => <hr className="my-3 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) => {
    const text = String(children).replace(/\n$/, '');
    const isBlock = Boolean(className) || text.includes('\n');
    if (isBlock) {
      return (
        <pre className="mb-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs last:mb-0">
          <code className={className} {...props}>
            {text}
          </code>
        </pre>
      );
    }
    return (
      <code
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export default function MarkdownContent({ children, className }) {
  const text = String(children ?? '').trim();
  if (!text) return null;

  return (
    <div className={cn('text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </Markdown>
    </div>
  );
}
