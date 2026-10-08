import cron from 'node-cron';
import Complaint from '../models/Complaint.js';
import { notifyComplaintEscalated } from './notificationService.js';

const TERMINAL_STATUSES = ['resolved', 'closed', 'rejected'];
const ESCALATION_LEVELS = ['Ward Officer', 'Zonal Officer', 'Commissioner'];

function configuredMinutes(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function slaMinutesForPriority(priority) {
  if (priority === 'high' || priority === 'critical') return configuredMinutes('SLA_HIGH_MINUTES', 1440);
  if (priority === 'low') return configuredMinutes('SLA_LOW_MINUTES', 4320);
  return configuredMinutes('SLA_MEDIUM_MINUTES', 2880);
}

export function buildSlaDeadline(priority, createdAt = new Date()) {
  return new Date(createdAt.getTime() + slaMinutesForPriority(priority) * 60 * 1000);
}

export function escalationLevelName(level) {
  return ESCALATION_LEVELS[Math.max(0, Math.min(ESCALATION_LEVELS.length - 1, level - 1))] || 'Ward Officer';
}

export async function runSlaEscalation({ now = new Date(), notify = notifyComplaintEscalated } = {}) {
  const dueComplaints = await Complaint.find({
    status: { $nin: TERMINAL_STATUSES },
    slaDeadline: { $lte: now },
    escalationLevel: { $lt: ESCALATION_LEVELS.length }
  }).select('_id title status priority createdBy assignedTo assignedVolunteer slaDeadline escalationLevel').lean();

  const escalated = [];
  for (const complaint of dueComplaints) {
    const previousLevel = complaint.escalationLevel || 0;
    const nextLevel = previousLevel + 1;
    const levelName = escalationLevelName(nextLevel);
    const nextDeadline = new Date(now.getTime() + slaMinutesForPriority(complaint.priority) * 60 * 1000);
    const update = {
      $set: {
        escalationLevel: nextLevel,
        escalatedAt: now,
        isOverdue: true,
        slaDeadline: nextDeadline,
        ...(previousLevel === 0 ? { overdueSince: complaint.slaDeadline } : {})
      },
      $push: {
        statusHistory: {
          eventType: 'sla_escalated',
          status: complaint.status,
          note: `SLA escalation level ${nextLevel}: ${levelName}`,
          changedAt: now
        }
      }
    };
    const updated = await Complaint.findOneAndUpdate({
      _id: complaint._id,
      status: { $nin: TERMINAL_STATUSES },
      slaDeadline: { $lte: now },
      escalationLevel: previousLevel
    }, update, { new: true, runValidators: true }).lean();
    if (!updated) continue;

    escalated.push({ complaintId: updated._id, escalationLevel: nextLevel, levelName, slaDeadline: nextDeadline });
    try {
      await notify({ complaint: updated, levelName });
    } catch (error) {
      console.error('[SLA] Escalation notification failed', {
        complaintId: String(updated._id),
        escalationLevel: nextLevel,
        message: error.message
      });
    }
  }
  return { checked: dueComplaints.length, escalated: escalated.length, items: escalated };
}

export function startSlaEscalationJob() {
  const schedule = process.env.ESCALATION_CRON || '* * * * *';
  if (!cron.validate(schedule)) throw new Error(`Invalid ESCALATION_CRON schedule: ${schedule}`);
  const task = cron.schedule(schedule, () => {
    runSlaEscalation().catch((error) => {
      console.error('[SLA] Scheduled escalation run failed', { message: error.message, stack: error.stack });
    });
  });
  console.info(`[SLA] Escalation job scheduled: ${schedule}`);
  return task;
}

export async function listOverdueComplaints(now = new Date()) {
  const complaints = await Complaint.find({
    isOverdue: true,
    status: { $nin: TERMINAL_STATUSES }
  }).select('_id title category status isAnonymous escalationLevel overdueSince escalatedAt slaDeadline')
    .sort({ overdueSince: 1, escalatedAt: 1 }).lean();
  return complaints.map((complaint) => ({
    _id: complaint._id,
    title: complaint.title,
    category: complaint.category,
    status: complaint.status,
    isAnonymous: complaint.isAnonymous,
    reporter: { name: complaint.isAnonymous ? 'Anonymous' : 'Reporter' },
    escalationLevel: complaint.escalationLevel,
    escalationTarget: escalationLevelName(complaint.escalationLevel),
    overdueSince: complaint.overdueSince || complaint.slaDeadline,
    timeOverdueMs: Math.max(0, now.getTime() - new Date(complaint.overdueSince || complaint.slaDeadline).getTime())
  }));
}
