// Last opened session folders, newest first. Persisted (plain data only) so
// the empty state can offer them on the next launch. Only sessions opened
// through the Electron folder dialog have a path, so only those are recorded.
import type { StateCreator } from "zustand";
import type { Store } from "../store";

const MAX_RECENT_SESSIONS = 10;

export interface RecentSession {
  path: string;
  folderName: string;
  openedAt: number;
  boards?: number;
  series?: number;
}

export interface RecentSessionsSlice {
  recentSessions: RecentSession[];
  rememberRecentSession: (entry: RecentSession) => void;
  forgetRecentSession: (path: string) => void;
}

export const createRecentSessionsSlice: StateCreator<
  Store,
  [],
  [],
  RecentSessionsSlice
> = (set) => ({
  recentSessions: [],
  rememberRecentSession: (entry) =>
    set((state) => ({
      recentSessions: [
        entry,
        ...state.recentSessions.filter((item) => item.path !== entry.path),
      ].slice(0, MAX_RECENT_SESSIONS),
    })),
  forgetRecentSession: (path) =>
    set((state) => ({
      recentSessions: state.recentSessions.filter(
        (item) => item.path !== path,
      ),
    })),
});
