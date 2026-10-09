import 'dotenv/config';
import mongoose from 'mongoose';
import { rebuildGamificationData } from '../src/services/gamificationService.js';

try {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streetsetu');
  const result = await rebuildGamificationData();
  console.info('Gamification backfill completed', result);
} catch (error) {
  console.error('Gamification backfill failed:', error.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
