import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import Complaint, { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES } from '../src/models/Complaint.js';
import Drive from '../src/models/Drive.js';
import User from '../src/models/User.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const DEMO_PREFIX = '[StreetSetu demo]';
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || 'ChangeMe-Demo-2026!';
const PASSWORD_HASH_ROUNDS = 12;
const DEMO_TITLE_PATTERN = '^\\[StreetSetu demo\\]';

const userSeeds = [
  { key: 'admin', name: 'StreetSetu Demo Admin', email: 'admin@streetsetu.demo', role: 'admin', area: 'Connaught Place' },
  { key: 'citizen1', name: 'Aarav Sharma', email: 'citizen1@streetsetu.demo', role: 'citizen', area: 'Lajpat Nagar' },
  { key: 'citizen2', name: 'Meera Verma', email: 'citizen2@streetsetu.demo', role: 'citizen', area: 'Sector 62, Noida' }
];

const complaintSeeds = [
  { suffix: 'Market road pothole', category: 'roads', priority: 'high', status: 'submitted', area: 'Lajpat Nagar', city: 'Delhi', lat: 28.5672, lng: 77.2431, ageDays: 1 },
  { suffix: 'Street light out near park', category: 'street_lighting', priority: 'medium', status: 'under_review', area: 'Greater Kailash II', city: 'Delhi', lat: 28.5355, lng: 77.2433, ageDays: 2 },
  { suffix: 'Overflowing community bins', category: 'waste_management', priority: 'high', status: 'assigned', area: 'Sector 18', city: 'Noida', lat: 28.5708, lng: 77.3261, ageDays: 3 },
  { suffix: 'Water leak on residential lane', category: 'water_supply', priority: 'medium', status: 'in_progress', area: 'Dwarka Sector 10', city: 'Delhi', lat: 28.5814, lng: 77.0585, ageDays: 4 },
  { suffix: 'Blocked storm drain', category: 'drainage', priority: 'low', status: 'needs_review', area: 'Indirapuram', city: 'Ghaziabad', lat: 28.6421, lng: 77.3702, ageDays: 5 },
  { suffix: 'Park entrance litter cleanup', category: 'sanitation', priority: 'low', status: 'resolved', area: 'Rohini Sector 9', city: 'Delhi', lat: 28.7142, lng: 77.1167, ageDays: 8 },
  { suffix: 'Damaged footpath by school', category: 'roads', priority: 'medium', status: 'closed', area: 'Vasant Kunj', city: 'Delhi', lat: 28.5245, lng: 77.1588, ageDays: 12 },
  { suffix: 'Unsafe open electrical junction', category: 'public_safety', priority: 'critical', status: 'rejected', area: 'Sector 15', city: 'Gurugram', lat: 28.4595, lng: 77.0266, ageDays: 6 },
  { suffix: 'Missed waste collection at market', category: 'waste_management', priority: 'high', status: 'submitted', area: 'Karol Bagh', city: 'Delhi', lat: 28.6519, lng: 77.1909, ageDays: 7, overdue: true, escalationLevel: 1, isAnonymous: true },
  { suffix: 'Broken public park tap', category: 'water_supply', priority: 'medium', status: 'in_progress', area: 'Sector 50', city: 'Noida', lat: 28.5706, lng: 77.3672, ageDays: 10, overdue: true, escalationLevel: 2, isAnonymous: true }
];

const driveSeeds = [
  {
    title: `${DEMO_PREFIX} Sunday park clean-up`,
    description: 'Collect litter, separate recyclables, and tidy the walking paths with nearby residents.',
    locationText: 'Lodhi Garden, New Delhi',
    lat: 28.5931,
    lng: 77.2197,
    daysFromNow: 3
  },
  {
    title: `${DEMO_PREFIX} Noida Sector 18 recycling drive`,
    description: 'Bring clean paper, bottles, and small e-waste for a neighbourhood sorting and collection session.',
    locationText: 'Sector 18 Market, Noida',
    lat: 28.5708,
    lng: 77.3261,
    daysFromNow: 6
  }
];

function daysFromNow(days, now) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function makeStatusHistory({ status, creatorId, adminId, now, overdue, escalationLevel, escalatedAt }) {
  const history = [
    { eventType: 'created', status: 'submitted', changedBy: creatorId, note: 'Demo complaint created', changedAt: now }
  ];
  if (status !== 'submitted') {
    history.push({
      eventType: 'status_changed',
      status,
      previousStatus: 'submitted',
      changedBy: adminId,
      note: `Demo status: ${status}`,
      changedAt: new Date(now.getTime() + 60 * 60 * 1000)
    });
  }
  if (overdue) {
    history.push({
      eventType: 'sla_escalated',
      status,
      note: `Demo SLA escalation level ${escalationLevel}`,
      changedAt: escalatedAt
    });
  }
  return history;
}

async function upsertUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_HASH_ROUNDS);
  const users = {};
  for (const seed of userSeeds) {
    const user = await User.findOneAndUpdate(
      { email: seed.email },
      {
        $set: {
          name: seed.name,
          email: seed.email,
          role: seed.role,
          area: seed.area,
          city: seed.key === 'citizen2' ? 'Noida' : 'Delhi',
          passwordHash,
          isActive: true
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    users[seed.key] = user;
  }
  return users;
}

async function seedComplaints(users, now) {
  for (const [index, seed] of complaintSeeds.entries()) {
    if (!COMPLAINT_CATEGORIES.includes(seed.category) || !COMPLAINT_STATUSES.includes(seed.status)) {
      throw new Error(`Invalid demo complaint seed: ${seed.suffix}`);
    }
    const creator = index % 2 === 0 ? users.citizen1 : users.citizen2;
    const createdAt = daysFromNow(-seed.ageDays, now);
    const escalationLevel = seed.escalationLevel || 0;
    const slaDeadline = seed.overdue ? daysFromNow(-seed.ageDays + 1, now) : daysFromNow(2, now);
    const escalatedAt = seed.overdue ? daysFromNow(-seed.ageDays + 2, now) : undefined;
    const complaint = {
      title: `${DEMO_PREFIX} ${seed.suffix}`,
      description: `Demo report for ${seed.suffix.toLowerCase()} in ${seed.area}, ${seed.city}. This seeded example is for demonstrating the complaint workflow.`,
      category: seed.category,
      priority: seed.priority,
      status: seed.status,
      isAnonymous: Boolean(seed.isAnonymous),
      slaDeadline,
      escalationLevel,
      isOverdue: Boolean(seed.overdue),
      ...(seed.overdue ? { overdueSince: slaDeadline, escalatedAt } : {}),
      ...(['resolved', 'closed'].includes(seed.status) ? { resolvedAt: createdAt } : {}),
      location: { type: 'Point', coordinates: [seed.lng, seed.lat] },
      longitude: seed.lng,
      latitude: seed.lat,
      address: `${seed.area}, ${seed.city}`,
      area: seed.area,
      city: seed.city,
      createdBy: creator._id,
      statusHistory: makeStatusHistory({
        status: seed.status,
        creatorId: creator._id,
        adminId: users.admin._id,
        now: createdAt,
        overdue: Boolean(seed.overdue),
        escalationLevel,
        escalatedAt
      }),
      createdAt,
      updatedAt: now
    };

    await Complaint.findOneAndUpdate(
      { title: complaint.title, createdBy: creator._id },
      { $set: complaint },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
}

async function seedDrives(users, now) {
  for (const [index, seed] of driveSeeds.entries()) {
    await Drive.findOneAndUpdate(
      { title: seed.title, createdBy: users.admin._id },
      {
        $set: {
          title: seed.title,
          description: seed.description,
          locationText: seed.locationText,
          lat: seed.lat,
          lng: seed.lng,
          date: daysFromNow(seed.daysFromNow, now),
          createdBy: users.admin._id,
          participants: [users.admin._id, index === 0 ? users.citizen1._id : users.citizen2._id],
          status: 'upcoming'
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
}

async function resetDemoData() {
  const demoEmails = userSeeds.map(({ email }) => email);
  const demoUsers = await User.find({ email: { $in: demoEmails } }).select('_id').lean();
  const demoUserIds = demoUsers.map(({ _id }) => _id);
  if (demoUserIds.length) {
    await Complaint.deleteMany({ title: { $regex: DEMO_TITLE_PATTERN }, createdBy: { $in: demoUserIds } });
    await Drive.deleteMany({ title: { $regex: DEMO_TITLE_PATTERN }, createdBy: { $in: demoUserIds } });
    await User.deleteMany({ _id: { $in: demoUserIds } });
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streetsetu');
  if (process.argv.includes('--reset')) {
    await resetDemoData();
    console.log('Removed previously seeded StreetSetu demo records.');
  }

  const now = new Date();
  const users = await upsertUsers();
  await seedComplaints(users, now);
  await seedDrives(users, now);

  console.log('StreetSetu demo data is ready (1 admin, 2 citizens, 10 complaints, 2 volunteer drives).');
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  for (const seed of userSeeds) console.log(`${seed.role}: ${seed.email}`);
  console.log('Use --reset to remove only records/accounts managed by this demo seed.');
}

main()
  .catch((error) => {
    console.error('Failed to seed StreetSetu demo data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
