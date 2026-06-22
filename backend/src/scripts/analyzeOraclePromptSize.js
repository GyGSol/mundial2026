/**
 * Analiza tamaño del contexto Oracle por bloque y perfil.
 *
 * Uso:
 *   node src/scripts/analyzeOraclePromptSize.js --match 42
 *   node src/scripts/analyzeOraclePromptSize.js --match 42 --profile replay
 */
import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { Match } from '../models/Match.js';
import { buildAiCompetitorPredictionContext, getAiUser } from '../services/aiPredictionService.js';
import {
  analyzeContextBlocks,
  estimatePromptTokens,
  ORACLE_CONTEXT_PROFILES,
  prepareOracleContextPayload,
} from '../services/oraclePromptContextService.js';
import { buildOraclePromptFromFrozenContext } from '../services/predictiveModelingService.js';

function parseArgs(argv) {
  let matchExternalId = null;
  let profile = 'live';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--match' && argv[i + 1]) matchExternalId = String(argv[++i]);
    if (argv[i] === '--profile' && argv[i + 1]) profile = String(argv[++i]);
  }
  return { matchExternalId, profile };
}

async function main() {
  const { matchExternalId, profile } = parseArgs(process.argv.slice(2));
  if (!matchExternalId) {
    console.error(
      'Uso: node src/scripts/analyzeOraclePromptSize.js --match <externalId> [--profile live|replay|learning]'
    );
    process.exit(1);
  }
  if (!ORACLE_CONTEXT_PROFILES.includes(profile)) {
    console.error(`Perfil inválido: ${profile}. Opciones: ${ORACLE_CONTEXT_PROFILES.join(', ')}`);
    process.exit(1);
  }

  await connectDb();
  const aiUser = await getAiUser();
  if (!aiUser) {
    console.error('Usuario IA no encontrado');
    process.exit(1);
  }

  const match = await Match.findOne({ externalId: String(matchExternalId) }).lean();
  if (!match) {
    console.error(`Partido FIFA #${matchExternalId} no encontrado`);
    process.exit(1);
  }

  const context = await buildAiCompetitorPredictionContext(match, aiUser._id);
  const analysis = analyzeContextBlocks(context, profile);
  const frozen = prepareOracleContextPayload(context, profile);
  const fullPrompt = buildOraclePromptFromFrozenContext(frozen, { profile });

  console.log(`\nFIFA #${matchExternalId} — perfil: ${profile}`);
  console.log('Bloques:');
  for (const row of analysis.blocks) {
    console.log(
      `  ${row.block.padEnd(28)} ${String(row.chars).padStart(7)} chars  ~${row.tokensEst} tokens`
    );
  }
  console.log(`\nContexto JSON: ${analysis.totalChars} chars (~${analysis.totalTokensEst} tokens)`);
  console.log(`Prompt completo: ${fullPrompt.length} chars (~${estimatePromptTokens(fullPrompt)} tokens)`);
  console.log(`Cuota env TPM/RPM: ${env.cerebrasMaxTpm} / ${env.cerebrasMaxRpm}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
