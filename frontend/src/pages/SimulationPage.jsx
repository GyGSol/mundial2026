import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';

export default function SimulationPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Simulación</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            La simulación del torneo está disponible solo en el panel de administración, con
            credenciales separadas del login de jugadores.
          </p>
          <Button asChild variant="outline">
            <Link to="/admin/login">Ir al panel admin</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
