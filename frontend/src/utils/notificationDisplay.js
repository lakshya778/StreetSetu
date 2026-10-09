export function notificationCopy(notification, t, language = 'en') {
  const metadata = notification.metadata || {};
  if (metadata.eventType === 'monthly_gamification_winner' && metadata.month) {
    const [year, month] = metadata.month.split('-').map(Number);
    const monthLabel = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    const key = metadata.rank === 1 ? 'gamification.monthlyWinnerNotice' : 'gamification.monthlyTopThreeNotice';
    return {
      title: t(`${key}Title`),
      message: t(`${key}Message`, { month: monthLabel, rank: metadata.rank, points: metadata.points })
    };
  }
  if (metadata.eventType === 'weekly_streak_reminder') {
    return {
      title: t('gamification.streakReminderNoticeTitle'),
      message: t('gamification.streakReminderNoticeMessage')
    };
  }
  return { title: notification.title, message: notification.message };
}
