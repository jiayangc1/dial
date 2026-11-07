import * as bells from "@/config/bells";
import type { BellConfig } from "./now";

/** The user's config/bells.ts, typed for the now-logic. */
export const bellConfig: BellConfig = {
  timezone: bells.timezone,
  schoolEnds: bells.schoolEnds,
  schedules: bells.schedules,
  dayType: bells.dayType,
  overrides: bells.overrides,
};
