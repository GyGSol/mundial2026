/**
 * Envía un mail único a cada clasificado a Copa Fubols.
 *
 * Dry-run (default): npm run email:fubols-cup-qualification -w backend
 * Envío real:        CONFIRM_SEND=1 npm run email:fubols-cup-qualification -w backend
 * Prod:              heroku run "CONFIRM_SEND=1 npm run email:fubols-cup-qualification -w backend" -a mundial2026-pred
 */
import { connectDb } from '../config/db.js';
import { sendFubolsCupQualificationEmails } from '../services/fubolsCupQualificationEmailService.js';

async function main() {
  const dryRun = process.env.CONFIRM_SEND !== '1';

  await connectDb();

  if (dryRun) {
    console.log('Modo dry-run (sin envío). Usá CONFIRM_SEND=1 para mandar los mails.\n');
  } else {
    console.log('CONFIRM_SEND=1 — enviando mails de clasificación Copa Fubols...\n');
  }

  const result = await sendFubolsCupQualificationEmails({ dryRun });

  if (dryRun) {
    console.log(`Destinatarios: ${result.recipientCount}`);
    for (const row of result.recipients) {
      console.log(`  - ${row.email} (${row.groupName}) → ${row.cupUrl}`);
    }
    console.log('\nPara enviar: CONFIRM_SEND=1 npm run email:fubols-cup-qualification -w backend');
    process.exit(0);
    return;
  }

  console.log(
    `\nListo: ${result.sent} enviados, ${result.skipped} omitidos, ${result.errors.length} errores (de ${result.recipientCount} candidatos).`
  );
  if (result.errors.length) {
    for (const err of result.errors) {
      console.error(`  ${err.email}: ${err.message}`);
    }
  }
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
