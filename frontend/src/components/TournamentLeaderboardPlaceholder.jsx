import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { getTournamentLabel } from '../lib/tournamentTypes.js';

const STAT_HEADERS = ['PJ', 'PA', 'GL', 'GV', 'Gdif', 'GT', 'PB', 'Pts'];

export default function TournamentLeaderboardPlaceholder({
  tournamentType,
  isEnrolled,
  isAuthenticated,
}) {
  const tournamentLabel = getTournamentLabel(tournamentType);

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 px-1 sm:w-11">#</TableHead>
              <TableHead className="min-w-[5.5rem] px-1 sm:min-w-0 sm:px-2">Jugador</TableHead>
              {STAT_HEADERS.slice(0, -2).map((label) => (
                <TableHead key={label} className="px-1 text-center text-[10px] sm:px-2 sm:text-xs">
                  {label}
                </TableHead>
              ))}
              <TableHead className="px-1 text-center text-[10px] sm:px-2 sm:text-xs">PB</TableHead>
              <TableHead className="px-1 text-right text-[10px] sm:px-2 sm:text-xs">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={10} className="py-10 text-center">
                <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4">
                  {!isAuthenticated ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Iniciá sesión para ver el {tournamentLabel} de tu grupo.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/login">Ingresar</Link>
                      </Button>
                    </>
                  ) : !isEnrolled ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Todavía no estás inscripto en {tournamentLabel}. Inscribite desde Grupos para
                        participar cuando la tabla esté disponible.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/groups">Ir a Grupos</Link>
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Estás inscripto en {tournamentLabel}. La tabla de posiciones estará disponible
                      próximamente.
                    </p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
