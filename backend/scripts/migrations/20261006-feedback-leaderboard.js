import 'dotenv/config';
import mongoose from 'mongoose';
import Assignment from '../../src/models/Assignment.js';
import Feedback from '../../src/models/Feedback.js';

try {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required to run this migration');
  await mongoose.connect(process.env.MONGO_URI);

  const backfill = await Assignment.updateMany(
    { responseStatus: { $exists: false } },
    [{ $set: {
      responseStatus: 'accepted',
      acceptedAt: { $ifNull: ['$acceptedAt', '$assignedAt'] },
      respondedAt: { $ifNull: ['$respondedAt', '$assignedAt'] }
    } }]
  );
  await Assignment.collection.createIndex({ responseStatus: 1 }, { name: 'responseStatus_1' });
  const feedbackCollectionExists = await mongoose.connection.db.listCollections({ name: 'feedback' }, { nameOnly: true }).hasNext();
  if (!feedbackCollectionExists) await Feedback.createCollection();
  await Feedback.createIndexes();
  console.info(`Feedback/leaderboard migration complete. Existing assignments marked accepted: ${backfill.modifiedCount}.`);
} catch (error) {
  console.error('Feedback/leaderboard migration failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
