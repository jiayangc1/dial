// Property names in the user's existing Notion databases. Dial never changes
// the schema; these are the only names it reads or writes.

export const A = {
  title: "Assignment Title",
  course: "Course",
  due: "Due Date",
  status: "Status",
  type: "Type",
  minutes: "Est. Minutes",
  priority: "Priority",
  scheduledFor: "Scheduled For", // bot-owned: read only
  calendarEvent: "Calendar Event", // bot-owned: read only
  source: "Source",
} as const;

export const C = {
  title: "Course Name",
  enrolled: "Currently enrolled",
  color: "Calendar Color",
  instructor: "Instructor",
  portal: "Portal Link",
} as const;

/** Properties Dial must never write. Enforced in the write path. */
export const BOT_OWNED = new Set<string>([A.scheduledFor, A.calendarEvent]);
