export default function InfoPanel({ title, children, className = '' }) {
  return (
    <div
      className={`rounded-md border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground ${className}`}
    >
      {title ? <p className="mb-2 font-medium text-foreground">{title}</p> : null}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function InfoList({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
