import { PROJECT_ADVANCES } from '../../data/projectAdvances.js';
import AdminBanner from './AdminBanner.jsx';
import AdminCard from './AdminCard.jsx';
import { adminBadgeOutline, adminCardInner, adminMuted } from './adminTheme.js';
import { Badge } from '@/components/ui/badge.jsx';

export default function AdminAdvancesSection() {
  return (
    <AdminCard
      header={
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-100">Avances del proyecto</h3>
          <Badge variant="outline" className={adminBadgeOutline}>
            README sincronizado
          </Badge>
          <p className={`w-full ${adminMuted}`}>
            Funcionalidades implementadas en Mundial 2026 Predicciones (junio 2026).
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {PROJECT_ADVANCES.map((section) => (
          <article key={section.id} className={adminCardInner}>
            <AdminBanner src={section.image} />
            <div className="flex flex-col gap-2 p-4">
              <h4 className="font-medium text-slate-100">{section.title}</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </AdminCard>
  );
}
