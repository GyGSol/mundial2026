import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import {
  AI_USER_DEFAULT_EMAIL,
  AI_USER_DISPLAY_NAME,
  AI_USER_LEGACY_EMAIL,
} from '../constants/aiUser.js';

/**
 * Migra el usuario IA: email dedicado + nombre @predictivemodeling.
 * Uso: node backend/src/scripts/migrateAiUserIdentity.js
 */
async function main() {
  await connectDb();

  const targetEmail = (env.aiUserEmail || AI_USER_DEFAULT_EMAIL).toLowerCase().trim();

  let user =
    (await User.findOne({ isAiUser: true })) ||
    (await User.findOne({ email: AI_USER_LEGACY_EMAIL })) ||
    (await User.findOne({ email: targetEmail }));

  if (!user) {
    console.error('No se encontró usuario IA (isAiUser ni emails conocidos).');
    process.exit(1);
  }

  const collision = await User.findOne({
    email: targetEmail,
    _id: { $ne: user._id },
  });
  if (collision) {
    console.error(`El email ${targetEmail} ya está en uso por otro usuario.`);
    process.exit(1);
  }

  const before = { email: user.email, name: user.name, isAiUser: user.isAiUser };

  user.email = targetEmail;
  user.name = AI_USER_DISPLAY_NAME;
  user.isAiUser = true;
  await user.save();

  console.log('Usuario IA actualizado:', {
    id: user._id.toString(),
    before,
    after: { email: user.email, name: user.name, isAiUser: user.isAiUser },
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
