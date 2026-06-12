import { cn } from '@/lib/utils';

export default function AdminStatCard({ label, value, hint, className }) {
  return (
    <div className={cn('admin-stat p-4 pt-5', className)}>
      <p className="admin-stat__label">{label}</p>
      <p className="admin-stat__value">{value}</p>
      {hint ? <p className="admin-stat__hint">{hint}</p> : null}
    </div>
  );
}
