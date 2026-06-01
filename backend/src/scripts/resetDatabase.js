import { connectDb } from '../config/db.js';
import { resetSimulation } from '../services/simulationService.js';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { SyncMeta } from '../models/SyncMeta.js';
import { SimulationState } from '../models/SimulationState.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';

const COLLECTIONS = [
  { label: 'predictions', model: Prediction },
  { label: 'simulationstates', model: SimulationState },
  { label: 'matches', model: Match },
  { label: 'users', model: User },
  { label: 'competitiongroups', model: CompetitionGroup },
  { label: 'teams', model: Team },
  { label: 'groups', model: Group },
  { label: 'stadiums', model: Stadium },
  { label: 'syncmetas', model: SyncMeta },
];

async function main() {
  await connectDb();

  try {
    await resetSimulation();
    console.log('Simulación activa eliminada.');
  } catch {
    // No había simulación activa.
  }

  for (const { label, model } of COLLECTIONS) {
    const { deletedCount } = await model.deleteMany({});
    console.log(`${label}: ${deletedCount} documento(s) eliminado(s)`);
  }

  console.log('Base de datos vacía. Ejecutá `npm run sync` para cargar datos oficiales.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
