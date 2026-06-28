import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

const rules = [
  { label: 'Resultado ganador (incluye empate)', points: '+3' },
  { label: 'Goles local exactos', points: '+1' },
  { label: 'Goles visitante exactos', points: '+1' },
  { label: 'Total de goles (volumen)', points: '+1' },
  { label: 'Punto bonus / consuelo (PB)', points: '+1' },
];

const gameRules = [
  'Las predicciones cierran 1 hora antes del comienzo de cada partido.',
  'Después del cierre no se puede agregar ni editar.',
  'Si no cargaste tu resultado antes del cierre, se registrará automáticamente un 0-0.',
  'Los partidos con predicción cargada se destacan en amarillo suave en el panel.',
  'Cada jugador compite dentro de un grupo creado previamente; los rankings son independientes por grupo.',
  'Punto consuelo (PB): si no sumás puntos en 3 partidos consecutivos, recibís +1 PB al finalizar el tercero. El contador se reinicia y podés volver a ganarlo.',
];

const knockoutRules = [
  'En fase eliminatoria (octavos en adelante), la predicción es el marcador tras el alargue (90 minutos + prórroga si la hay).',
  'Podés predecir empate: es válido si el partido termina empatado tras el alargue.',
  'Los goles de la tanda de penales no cuentan para puntuar ni para el marcador de comparación.',
  'En la app, el marcador en vivo muestra el resultado de juego y, si hubo tanda, los penales por separado.',
];

const tiebreakerRules = [
  'Puntos totales',
  'PA (aciertos de resultado)',
  'GL + GV (goles exactos local y visitante)',
  'GT (goles totales exactos)',
  'PB (puntos bonus; en empate, menos PB = mejor posición)',
  'Gdif: error combinado (GLdif × GVdif) / 2; .000 = sin error, 1.000 = peor caso; menor es mejor',
  'En empate de Gdif: menor error local promedio, luego visitante',
];

export default function RulesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reglas de puntuación</h1>
        <p className="text-sm text-muted-foreground">Máximo 6 puntos por partido.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de juego</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
            {gameRules.map((rule) => (
              <li key={rule} className="border-b border-border pb-3 last:border-0 last:pb-0">
                {rule}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sistema de puntos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {rules.map((rule) => (
              <li
                key={rule.label}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <span>{rule.label}</span>
                <span className="font-semibold">{rule.points}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fase eliminatoria (alargue y penales)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
            {knockoutRules.map((rule) => (
              <li key={rule} className="border-b border-border pb-3 last:border-0 last:pb-0">
                {rule}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desempate en la tabla de posiciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Con igualdad de puntos totales, el orden se define así:
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
            {tiebreakerRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejemplo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Si predecís <strong className="text-foreground">2-2</strong> y el resultado es{' '}
          <strong className="text-foreground">4-0</strong>, acertás el volumen total de goles (4)
          y sumás <strong className="text-foreground">+1 punto</strong>.
        </CardContent>
      </Card>
    </div>
  );
}
