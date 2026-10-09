import User from '../models/User.js';
import { createSystemInAppNotification } from './notificationService.js';

function isoWeek(date) {
  const localDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = new Date(Date.UTC(
    Number(localDate.find((part) => part.type === 'year').value),
    Number(localDate.find((part) => part.type === 'month').value) - 1,
    Number(localDate.find((part) => part.type === 'day').value)
  ));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function previousWeek(week) {
  const [year, weekNumber] = week.split('-W').map(Number);
  const monday = new Date(Date.UTC(year, 0, 4 + ((weekNumber - 1) * 7)));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 7);
  return isoWeek(monday);
}

export async function sendWeeklyStreakReminders(now = new Date()) {
  const week = isoWeek(now);
  const atRisk = User.find({
    isActive: true,
    streakWeeks: { $gt: 0 },
    lastReportWeek: previousWeek(week)
  }).select('_id').lean();
  let sent = 0;
  for await (const user of atRisk) {
    try {
      const notification = await createSystemInAppNotification({
        recipientId: user._id,
        title: 'Keep your community streak going',
        message: 'You have not submitted a report this week. Share a civic issue to continue your weekly streak.',
        metadata: { eventType: 'weekly_streak_reminder', week },
        dedupeKey: `streak-reminder:${week}:${user._id}`
      });
      if (notification) sent += 1;
    } catch (error) {
      console.error('[gamification] Weekly streak reminder failed', {
        userId: String(user._id),
        week,
        message: error.message
      });
    }
  }
  return { week, reminded: sent };
}

export const streakReminderInternals = { isoWeek, previousWeek };
