import { PROJECT_ADVANCES } from '../../data/projectAdvances.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function AdminAdvancesSection() {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Avances del proyecto</CardTitle>
          <Badge variant="outline" className="border-amber-500/40 text-amber-200">
            README sincronizado
          </Badge>
        </div>
        <p className="text-sm text-slate-400">
          Funcionalidades implementadas en Mundial 2026 Predicciones (junio 2026).
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {PROJECT_ADVANCES.map((section) => (
          <article
            key={section.id}
            className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60"
          >
            <img
              src={section.image}
              alt=""
              className="h-36 w-full object-cover object-center sm:h-44"
              loading="lazy"
            />
            <div className="flex flex-col gap-2 p-4">
              <h3 className="font-medium text-slate-100">{section.title}</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
