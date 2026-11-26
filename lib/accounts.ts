/** Shapes shared by the account/admin API and the UI. */

export const ROLES = ["user", "superadmin"] as const;
export type Role = (typeof ROLES)[number];

export interface AccountView {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface QuizSummary {
  id: string;
  title: string;
  coverImageUrl: string | null;
  questionCount: number;
  updatedAt: string;
  ownerEmail: string | null;
  /** Whether the signed-in account owns it (a superadmin also sees others' quizzes). */
  mine: boolean;
}

export const PASSWORD_MIN_LENGTH = 6;
