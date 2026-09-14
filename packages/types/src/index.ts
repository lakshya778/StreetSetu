export type Role = 'citizen' | 'volunteer' | 'ward_officer' | 'department_owner' | 'admin' | 'system_admin';

export type IssueStatus = 'submitted' | 'reviewed' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'escalated';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  wardId: string;
  categoryId: string;
  createdBy: string;
}
