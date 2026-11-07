import "server-only";
import { timezone } from "@/config/bells";
import { fromZoned, zonedParts } from "./time";
import { statusGroupOf, type Course, type NewTask, type Snapshot, type Task, type TaskPatch, type TaskType, type Priority } from "./types";

// Fixture data for demo mode (DIAL_DEMO=1). Dates are generated relative to
// "now" so every state (overdue, today, later, done this week) is always
// represented. Covers the stress cases from the spec: a very long title, a
// class with no colour, a class with zero tasks, and an all-done class.

const COURSES: Course[] = [
  { id: "c-precalc", name: "Pre-Calc", instructor: "Ms. Ruiz", color: "Tangerine", portalUrl: null, url: "#" },
  { id: "c-chinese", name: "AP Chinese", instructor: "Wang Laoshi", color: "Tomato", portalUrl: null, url: "#" },
  { id: "c-whap", name: "AP World History (WHAP)", instructor: "Mr. Okafor", color: "Banana", portalUrl: null, url: "#" },
  { id: "c-chem", name: "Chemistry", instructor: "Dr. Patel", color: "Sage", portalUrl: null, url: "#" },
  { id: "c-physics", name: "AP Physics 1", instructor: "Mr. Lindqvist", color: "Peacock", portalUrl: null, url: "#" },
  { id: "c-cs", name: "Computer Science 1A", instructor: "Mrs. Haddad", color: "Grape", portalUrl: null, url: "#" },
  { id: "c-debate", name: "Debate", instructor: "Coach Bell", color: null, portalUrl: null, url: "#" },
];

type Seed = {
  course: string;
  title: string;
  dueDays: number | null; // relative to today
  dueTime?: string; // "HH:MM" for a datetime due
  type?: TaskType;
  minutes?: number;
  priority?: Priority;
  status?: string;
  scheduled?: boolean;
};

const SEEDS: Seed[] = [
  { course: "c-precalc", title: "Worksheet 2.4", dueDays: 1, type: "Homework", minutes: 30, priority: "Medium", scheduled: true },
  { course: "c-precalc", title: "Unit 3 test", dueDays: 4, type: "Test / Quiz", minutes: 60, priority: "High", scheduled: true },
  { course: "c-precalc", title: "Khan Academy: inverse functions practice set", dueDays: 0, dueTime: "23:59", type: "Homework", minutes: 20 },
  { course: "c-precalc", title: "Correct last week's quiz", dueDays: -1, type: "Other", minutes: 15, status: "In progress" },
  { course: "c-precalc", title: "Read 3.1 notes", dueDays: 9, type: "Reading", minutes: 25, priority: "Low" },
  { course: "c-precalc", title: "Worksheet 2.3", dueDays: -2, type: "Homework", minutes: 30, status: "Submitted" },
  { course: "c-precalc", title: "Desmos activity", dueDays: -3, type: "Homework", minutes: 20, status: "Submitted" },
  { course: "c-chinese", title: "Lesson 7 vocab quiz", dueDays: 2, type: "Test / Quiz", minutes: 30, priority: "High" },
  {
    course: "c-chinese",
    title: "Write a 300-character reflection on the cultural presentation, including three new grammar patterns from lesson 6 and a comparison with last year's festival",
    dueDays: 3,
    type: "Project",
    minutes: 90,
    status: "Need to Submit",
  },
  { course: "c-whap", title: "DBQ outline: Columbian Exchange", dueDays: 1, type: "Project", minutes: 45, priority: "High", scheduled: true },
  { course: "c-whap", title: "AMSCO ch. 5 reading", dueDays: 2, type: "Reading", minutes: 40 },
  { course: "c-whap", title: "Unit 4 SAQ practice", dueDays: 6, type: "Study", minutes: 30 },
  { course: "c-chem", title: "Stoichiometry lab report", dueDays: -1, type: "Project", minutes: 60, status: "Submitted" },
  { course: "c-chem", title: "Mole conversion worksheet", dueDays: -2, type: "Homework", minutes: 25, status: "Mark received" },
  { course: "c-physics", title: "Problem set 6: projectile motion", dueDays: 0, dueTime: "15:30", type: "Homework", minutes: 50, priority: "High" },
  { course: "c-physics", title: "Lab: free-fall data analysis", dueDays: 5, type: "Project", minutes: 45 },
  { course: "c-physics", title: "Unit 2 FRQ review", dueDays: 8, type: "Study", minutes: 40 },
  { course: "c-physics", title: "Problem set 5", dueDays: -3, type: "Homework", minutes: 45, status: "Submitted" },
  { course: "c-cs", title: "Lab 4: loops", dueDays: 2, type: "Homework", minutes: 60, scheduled: true },
  { course: "c-cs", title: "Quiz: arrays", dueDays: 7, type: "Test / Quiz", minutes: 20 },
];

function dueFor(now: Date, days: number | null, time?: string) {
  if (days === null) return null;
  const z = zonedParts(now, timezone);
  const d = new Date(Date.UTC(z.year, z.month - 1, z.day + days));
  const ymd = d.toISOString().slice(0, 10);
  if (!time) return { start: ymd, end: null };
  const [h, m] = time.split(":").map(Number);
  return { start: fromZoned(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, m, timezone).toISOString(), end: null };
}

function build(now: Date, scenario: string | null): Task[] {
  const seeds = [...SEEDS];
  if (scenario === "heavy") {
    for (let i = 0; i < 46; i++) {
      seeds.push({ course: "c-precalc", title: `Practice problem set ${i + 1}`, dueDays: (i % 14) + 1, type: "Homework", minutes: 10 + (i % 4) * 10 });
    }
  }
  return seeds.map((s, i): Task => {
    const status = s.status ?? "Not started";
    const group = ["Submitted", "Mark received", "Overdue"].includes(status) ? "complete" : status === "Not started" ? "todo" : "in_progress";
    const due = dueFor(now, s.dueDays, s.dueTime);
    return {
      id: `t-${i}`,
      url: "#",
      title: s.title,
      courseIds: [s.course],
      due,
      status,
      statusGroup: group,
      type: s.type ?? null,
      minutes: s.minutes ?? null,
      priority: s.priority ?? "Medium",
      scheduledFor: s.scheduled && due ? { start: dueFor(now, Math.max(0, (s.dueDays ?? 1) - 1), "19:00")!.start, end: null } : null,
      calendarEvent: s.scheduled ? "https://calendar.google.com/" : null,
      source: i % 4 === 0 ? "Canvas" : "Me",
      lastEdited: now.toISOString(),
    };
  });
}

// In-memory store per scenario, so demo writes persist until the server restarts.
const stores = new Map<string, { tasks: Task[]; trashed: Set<string> }>();
function store(scenario: string | null) {
  const key = scenario ?? "default";
  let st = stores.get(key);
  if (!st) {
    st = { tasks: scenario === "empty" ? [] : build(new Date(), scenario), trashed: new Set() };
    stores.set(key, st);
  }
  return st;
}

export function demoSnapshot(scenario: string | null = null, now = new Date()): Snapshot {
  const st = store(scenario);
  return {
    user: { name: "Demo student", image: null, workspace: "Demo workspace" },
    courses: COURSES,
    tasks: st.tasks.filter((t) => !st.trashed.has(t.id)),
    fetchedAt: now.toISOString(),
    demo: true,
  };
}

const latency = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 250));

function applyPatch(t: Task, patch: TaskPatch): Task {
  const next = { ...t, lastEdited: new Date().toISOString() };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.due !== undefined) next.due = patch.due;
  if (patch.status !== undefined) {
    next.status = patch.status;
    next.statusGroup = statusGroupOf(patch.status);
  }
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.minutes !== undefined) next.minutes = patch.minutes;
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.courseId !== undefined) next.courseIds = patch.courseId ? [patch.courseId] : [];
  return next;
}

/** Demo writes. A title containing "[fail]" fails, to exercise rollback. */
export const demoWrites = {
  async create(input: NewTask): Promise<Task> {
    await latency();
    if (input.title.includes("[fail]")) throw new Error("Demo failure (title contains [fail])");
    const task: Task = applyPatch(
      {
        id: `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        url: "#",
        title: "",
        courseIds: [],
        due: null,
        status: "Not started",
        statusGroup: "todo",
        type: null,
        minutes: null,
        priority: "Medium",
        scheduledFor: null,
        calendarEvent: null,
        source: "Me",
        lastEdited: "",
      },
      { ...input, priority: input.priority ?? "Medium" },
    );
    for (const st of stores.values()) st.tasks.push(task);
    if (!stores.size) store(null).tasks.push(task);
    return task;
  },
  async update(id: string, patch: TaskPatch): Promise<Task> {
    await latency();
    let out: Task | null = null;
    for (const st of stores.values()) {
      st.tasks = st.tasks.map((t) => (t.id === id ? (out = applyPatch(t, patch)) : t));
    }
    if (!out) throw new Error("Task not found");
    return out;
  },
  async trash(id: string, trash: boolean): Promise<void> {
    await latency();
    for (const st of stores.values()) {
      if (trash) st.trashed.add(id);
      else st.trashed.delete(id);
    }
  },
};
