import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

const AI_DISPLAY_NAME = 'Predictive Modeling (IA)';

async function main() {
  await connectDb();

  const email = env.aiUserEmail;
  if (!email) {
    console.error('AI_USER_EMAIL no configurado');
    process.exit(1);
  }

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`Usuario no encontrado: ${email}`);
    process.exit(1);
  }

  const updates = { isAiUser: true };
  if (!user.name?.includes('(IA)')) {
    updates.name = AI_DISPLAY_NAME;
  }

  await User.updateOne({ _id: user._id }, { $set: updates });

  console.log(`Usuario IA marcado: ${email} (${user._id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
