import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AI_USER_DISPLAY_NAME } from '../constants/aiUser.js';

async function main() {
  await connectDb();

  const email = env.aiUserEmail;
  if (!email) {
    console.error('AI_USER_EMAIL no configurado');
    process.exit(1);
  }

  let user = await User.findOne({ isAiUser: true });
  if (!user) {
    user = await User.findOne({ email });
  }
  if (!user) {
    console.error(`Usuario no encontrado: ${email}`);
    process.exit(1);
  }

  const updates = { isAiUser: true, name: AI_USER_DISPLAY_NAME };
  if (user.email !== email) {
    updates.email = email;
  }

  await User.updateOne({ _id: user._id }, { $set: updates });

  console.log(`Usuario IA marcado: ${updates.email ?? user.email} (${user._id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
