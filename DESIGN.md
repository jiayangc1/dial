# Dial — design spec

Dial is opened dozens of times a day, for a few seconds at a time, often one-handed in a hallway. Every decision below serves that: **open → right class → typing**, in under two seconds.

## 1. Layout

> **Revision:** the original 3D class wheel was replaced by an entry box with a class dropdown. Picking a class is now one tap on a clear list instead of a spin, and the screen leads with the thing you open Dial to do: add a task.

### Phone (390 × 844, the primary target)

```
┌──────────────────────────────┐  safe-area top
│ ◐  Pre-Calc 22:14 left   ⌕ ◯ │  header, 56px. Countdown digits roll (Geist Mono)
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔░░░░░░░░░░░░│  2px period progress bar, accent; pulses in the last 5 min
│ ┌──────────────────────────┐ │
│ │ ● Pre-Calc ▾        Now  │ │  class dropdown, pre-filled with the class you're in now
│ │──────────────────────────│ │
│ │ [Fri ×] [30m ×] [Quiz ×] │ │  parsed chips, accent, pop in as you type
│ │ ws 2.4 fri 30m quiz   (↑)│ │  quick-add input, 52px
│ └──────────────────────────┘ │
│ DUE SOON · 3                 │  section label, 12 / gray-900, uppercase, +0.04em
│ ○ Worksheet 2.4  Fri · 30m 📅│  task rows, 56px min, 14 body
│ LATER · 2                    │
│ ○ …                          │
│ › Done this week · 4         │
└──────────────────────────────┘
```

- The dropdown lists every enrolled class in bell order: colour dot, name, teacher, open count, a **Now**/**Next** marker on the current class, and a check on the selected one. Arrow keys, Home/End, Enter, Esc and type-ahead all work.
- When you've picked a different class, a quiet "Now: Chemistry" link sits on the right of the dropdown row and takes you back.
- Before and after school, on weekends and on days off, the **Tonight** list (everything due in 48 hours) sits under the entry box, followed by the selected class.
- The task list container never moves when the class changes; its contents cross-fade (old rows slide 12px out toward the direction of travel, new rows stagger in at 30ms each).

### Desktop (1440)

Same single column at `max-width: 640px`, centred. The input is auto-focused. Keyboard hints (`N`, `←` `→`, `.`, `⌘K`) sit in the footer at 12px.

### Command menu (⌘K)

One box for everything, opened with `⌘K` / `Ctrl+K` from anywhere (including mid-typing in the add bar), `/` when not typing, or the search field in the header (an icon on phones).

- Empty: **Actions** (new task in the selected class, jump to now), **Upcoming** (next 6 open tasks), **Classes**, **Account**.
- Typing: **Tasks** (word-start matches first, completed last), **Classes**, then "Add “…” to <class>", which drops the text into the add bar so the parser still runs.
- `↑` `↓` (or `Ctrl+N` / `Ctrl+P`) move, `↵` opens, `⌘↵` completes the highlighted task, `Esc` clears the query, then closes.
- Panel sits at 14vh on desktop, top of the screen on phones (clear of the keyboard), with a "Cancel" button in place of the `Esc` hint.

### Controls

No native form widgets in the app. Dates use a themed calendar popover (arrow keys, PageUp/PageDown, Home/End), times a 15-minute list with hour type-ahead, minutes a −/+ stepper, and every `title` tooltip is a themed `Tooltip`. Segmented controls slide a single thumb by transform.

## 2. Type scale (Geist Sans / Geist Mono)

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 48 / 52 | 600 | −0.02em | wheel centre card, desktop |
| `title` | 32 / 36 | 600 | −0.02em | wheel centre card, phone; onboarding headline |
| `heading` | 20 / 28 | 600 | −0.01em | sheet titles, empty states |
| `lead` | 16 / 24 | 400 | 0 | landing tagline, input text |
| `body` | 14 / 20 | 400 | 0 | task titles, buttons |
| `small` | 13 / 18 | 400 | 0 | metadata, chips |
| `label` | 12 / 16 | 500 | +0.04em | section labels (uppercase), kbd |

Times, counts and countdowns always use Geist Mono with `tabular-nums`, so digits never shift.

## 3. Colour

Geist gray scale, defined as CSS variables and redefined for light mode. **Dark mode is designed first.**

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0a0a0a` | `#ffffff` | page |
| `bg-2` | `#000000` | `#fafafa` | recessed areas |
| `gray-100` | `#1a1a1a` | `#f2f2f2` | hover |
| `gray-200` | `#1f1f1f` | `#ebebeb` | surfaces (cards) |
| `gray-300` | `#292929` | `#e6e6e6` | pressed |
| `gray-900` | `#a1a1a1` | `#666666` | secondary text (AA on bg) |
| `gray-1000` | `#ededed` | `#171717` | primary text |
| `hairline` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` | 1px borders |
| `red` | `#ff6166` | `#d8001b` | overdue only |

**Accent** is the current class's Google Calendar colour, set as `--accent` on the app root and tuned per theme so it passes 3:1 against the background as a UI colour. A matching `--on-accent` (black or white) keeps the checkmark readable. The accent appears in a few deliberate places: the class dot in the dropdown, the period progress bar, checkbox fill, swipe-to-complete fill, parsed chips, and the entry box's focus ring. A class with no colour gets neutral gray. The brand's Signal orange (`#FF5A1F`) is only used in the logo's "now" hole and on the signed-out screen.

## 4. Surfaces and depth

- Radius: 8px cards and rows, 12px sheets and the add bar, full for pills and the FAB.
- 4px spacing grid. Page gutter 16px on phone, 24px on desktop.
- No drop shadows. Depth comes from layering `bg` → `gray-200` surfaces, a 1px hairline border, and a 1px inner top highlight (`inset 0 1px 0 rgba(255,255,255,.04)` in dark).
- Sheets and the add bar use `backdrop-filter: blur(20px) saturate(180%)` over a 72% opaque background.

## 5. Motion

| What | How |
|---|---|
| UI elements | spring `{ stiffness: 400, damping: 32, mass: 0.8 }` |
| Dropdown | scale 0.98 → 1 from the top-left with the UI spring; closes in 120ms |
| Fades | 150–250ms, `cubic-bezier(.2,.8,.2,1)` — never linear |
| Properties | `transform` and `opacity` only. The accent tint cross-fades by animating opacity of two stacked gradients |
| Class change | old list −12px toward swipe + fade 150ms; new list from +12px, 30ms stagger per row |
| Press | every control scales to 0.97 on press |
| Reduced motion | keep fades, drop springs, particles, confetti, stagger |

## 6. States

Each state has a designed screen, not a fallback:

| State | Treatment |
|---|---|
| Signed out | centred lockup, tagline, one button. Background: a very slow rotating ring of dots (static under reduced motion) |
| Onboarding | 3 steps with dot indicator: connected ✓ → pick tracker page → confirm bell schedule |
| Loading (cold) | skeletons with the exact final geometry (header, wheel card, 4 rows), 1.6s shimmer, cross-fade out |
| Loading (warm) | paints from `localStorage` cache instantly, fresh data merges silently |
| Empty class | small line illustration (an open ring), "Nothing here yet", and an "Add the first task" button |
| All done | "Nothing due in Chemistry 🎉" + one-time confetti in the accent |
| Offline | header badge "Offline · 2 will sync", writes queue |
| Notion error | inline banner with Retry; data stays visible |
| Expired login | back to the landing page with a notice: "Your Notion session expired" |
| Now states | in class (countdown), passing ("Next up · 3 min"), before/after school and weekend ("Tonight") |
| Stress | 50 tasks (virtualised scroll not needed at that size), 2-line clamp on long titles, no-colour class in neutral |

## 7. Accessibility

- WCAG AA text contrast in both themes (checked token by token above).
- 44px minimum touch targets; rows are 56px.
- Focus rings: 2px accent ring, 2px offset, shown on `:focus-visible` only.
- The class dropdown is a `listbox` with `aria-activedescendant`, arrow keys, Home/End, Enter, Esc and type-ahead.
