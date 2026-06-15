import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { alignMatchesFromFifaCalendar } from '../services/fifaFixtureAlignmentService.js';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await alignMatchesFromFifaCalendar();
  console.log('FIFA fixture alignment:', result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
