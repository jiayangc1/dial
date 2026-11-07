"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "./sheet";
import { accentStyle } from "@/lib/colors";
import { dueLabel } from "@/lib/format";
import { compareTasks } from "@/lib/tasks";
import type { ClientTask } from "@/lib/client/task-store";
import type { Course } from "@/lib/types";

export function SearchSheet({
  open,
  onClose,
  tasks,
  courses,
  now,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  tasks: ClientTask[];
  courses: Map<string, Course>;
  now: Date;
  onPick: (t: ClientTask) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = tasks.filter((t) => t.courseIds.some((id) => courses.has(id)));
    const hits = needle
      ? list.filter((t) => t.title.toLowerCase().includes(needle) || courses.get(t.courseIds[0])?.name.toLowerCase().includes(needle))
      : list.filter((t) => t.statusGroup !== "complete");
    return hits.sort((a, b) => Number(a.statusGroup === "complete") - Number(b.statusGroup === "complete") || compareTasks(a, b)).slice(0, 30);
  }, [q, tasks, courses]);

  const pick = (t: ClientTask) => {
    setQ("");
    onPick(t);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Search tasks" initialFocus="#search-input">
      <div className="pt-1">
        <div className="flex h-12 items-center gap-2 rounded-card border border-hairline bg-gray-100 px-3 focus-within:border-hairline-strong">
          <Search size={16} strokeWidth={1.5} className="text-gray-900" aria-hidden="true" />
          <input
            id="search-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                pick(results[active]);
              }
            }}
            placeholder="Search tasks and classes"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].key}` : undefined}
            autoComplete="off"
            className="h-full flex-1 bg-transparent text-lead text-gray-1000 outline-none placeholder:text-gray-900 md:text-body"
          />
        </div>
        <ul id="search-results" role="listbox" className="mt-2 min-h-[240px]">
          {results.length === 0 && <li className="px-3 py-6 text-center text-body text-gray-900">No tasks match &ldquo;{q}&rdquo;.</li>}
          {results.map((t, i) => {
            const c = courses.get(t.courseIds[0]);
            const due = dueLabel(t.due, now);
            return (
              <li key={t.key} id={`sr-${t.key}`} role="option" aria-selected={i === active} style={accentStyle(c?.color)}>
                <button
                  onClick={() => pick(t)}
                  onMouseEnter={() => setActive(i)}
                  className={`pressable flex min-h-12 w-full items-center gap-3 rounded-card px-3 text-left ${i === active ? "bg-gray-100" : ""}`}
                >
                  <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span className={`min-w-0 flex-1 truncate text-body ${t.statusGroup === "complete" ? "text-gray-900 line-through" : "text-gray-1000"}`}>{t.title}</span>
                  <span className="shrink-0 text-small text-gray-900">{c?.name}</span>
                  {due && <span className={`w-16 shrink-0 text-right text-small ${due.overdue && t.statusGroup !== "complete" ? "text-red" : "text-gray-900"}`}>{due.text}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
