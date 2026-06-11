import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function WelcomePage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/ranking" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">Mundial 2026</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Prode del Mundial 2026</h1>
          <p className="text-muted-foreground">
            Plataforma privada para jugadores registrados. Cargá pronósticos, competí en grupos con
            amigos y seguí el ranking en vivo.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>¿Quién puede entrar?</CardTitle>
            <CardDescription>
              Solo jugadores con cuenta. Si todavía no tenés una, registrate en un minuto.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg" className="w-full sm:w-auto sm:min-w-[9.5rem]">
              <Link to="/login">Ingresar</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[9.5rem]">
              <Link to="/register">Registrarse</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cómo funciona el juego</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                'Antes de cada partido cargás tu pronóstico (resultado y goles). Cierra 1 hora antes del kickoff.',
                'Sumás puntos por aciertos: resultado, goles por equipo, total de goles y bonus según las reglas.',
                'Creás o te unís a grupos de competencia (ligas con amigos, oficina, etc.).',
                'Cada grupo tiene su propio ranking; tus pronósticos valen para todos los grupos donde participás.',
              ]}
            />
          </CardContent>
        </Card>

        <InfoPanel title="Tu sesión de ingreso">
          <InfoList
            items={[
              'Al ingresar abrís una sesión de 2 horas para que no se cierre al poco tiempo de usar la app.',
              'Si pasan las 2 horas, volvé a ingresar con tu email y contraseña.',
              'Podés cerrar sesión manualmente desde el menú cuando termines de jugar.',
            ]}
          />
        </InfoPanel>

        <p className="text-center text-sm text-muted-foreground">
          ¿Te pasaron un enlace de invitación a un grupo? Abrilo desde el chat; te llevará a registrarte
          o ingresar y unirte automáticamente.
        </p>
      </main>
    </div>
  );
}
