// Shapes shared by server and client. No Notion SDK types leak past lib/notion.

export const STATUS = {
  todo: ["Not started"],
  in_progress: ["In progress", "Need to Submit"],
  complete: ["Submitted", "Mark received", "Overdue"],
} as const;

export type StatusGroup = keyof typeof STATUS;
export type Status = (typeof STATUS)[StatusGroup][number];

export const TASK_TYPES = ["Homework", "Test / Quiz", "Project", "Reading", "Study", "Other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const PRIORITIES = ["Low", "Medium", "High"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type NotionDate = { start: string; end: string | null } | null;

export type Course = {
  id: string;
  name: string;
  instructor: string | null;
  /** Calendar colour name ("Tangerine"), or null for neutral gray. */
  color: string | null;
  portalUrl: string | null;
  url: string;
};

export type Task = {
  id: string;
  url: string;
  title: string;
  courseIds: string[];
  due: NotionDate;
  status: string;
  statusGroup: StatusGroup;
  type: TaskType | null;
  minutes: number | null;
  priority: Priority | null;
  /** Read-only: owned by the scheduling bot. */
  scheduledFor: NotionDate;
  /** Read-only: owned by the scheduling bot. */
  calendarEvent: string | null;
  source: string | null;
  lastEdited: string;
};

export type Snapshot = {
  user: { name: string | null; image: string | null; workspace: string | null };
  courses: Course[];
  tasks: Task[];
  fetchedAt: string;
  demo: boolean;
};

export function statusGroupOf(status: string | null | undefined): StatusGroup {
  if (!status) return "todo";
  for (const g of Object.keys(STATUS) as StatusGroup[]) {
    if ((STATUS[g] as readonly string[]).includes(status)) return g;
  }
  return "todo";
}
