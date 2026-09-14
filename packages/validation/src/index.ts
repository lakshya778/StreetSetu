export const isValidIssueTitle = (title: string) => title.trim().length >= 5;

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
