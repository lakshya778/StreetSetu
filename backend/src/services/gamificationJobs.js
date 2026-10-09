import cron from 'node-cron';
import { closeMonth, monthlyGamificationInternals } from './monthlyGamificationService.js';
import { sendWeeklyStreakReminders } from './streakReminderService.js';

export function startGamificationJobs() {
  const monthlySchedule = process.env.MONTHLY_CLOSE_CRON || '5 0 1 * *';
  const weeklySchedule = process.env.STREAK_REMINDER_CRON || '0 9 * * 1';
  const monthlyTimezone = 'Asia/Kolkata';
  const weeklyTimezone = 'Asia/Kolkata';
  for (const [name, schedule] of [['MONTHLY_CLOSE_CRON', monthlySchedule], ['STREAK_REMINDER_CRON', weeklySchedule]]) {
    if (!cron.validate(schedule)) throw new Error(`Invalid ${name} schedule: ${schedule}`);
  }

  const monthlyTask = cron.schedule(monthlySchedule, () => {
    const month = monthlyGamificationInternals.previousMonthInTimezone(new Date(), monthlyTimezone);
    closeMonth(month).catch((error) => {
      console.error('[gamification] Scheduled monthly close failed', { month, message: error.message, stack: error.stack });
    });
  }, { timezone: monthlyTimezone });
  const weeklyTask = cron.schedule(weeklySchedule, () => {
    sendWeeklyStreakReminders().catch((error) => {
      console.error('[gamification] Scheduled streak reminders failed', { message: error.message, stack: error.stack });
    });
  }, { timezone: weeklyTimezone });

  console.info(`[gamification] Monthly close scheduled: ${monthlySchedule} (${monthlyTimezone})`);
  console.info(`[gamification] Weekly streak reminders scheduled: ${weeklySchedule} (${weeklyTimezone})`);
  return { stop: () => { monthlyTask.stop(); weeklyTask.stop(); } };
}
