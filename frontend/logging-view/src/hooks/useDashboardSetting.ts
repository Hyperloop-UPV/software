import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useStore } from "../store/store";
import type { DashboardSettings, NormalDashboard } from "../types/normal";

export function useDashboardSetting<K extends keyof DashboardSettings>(
  dashboard: NormalDashboard,
  key: K,
): [DashboardSettings[K], Dispatch<SetStateAction<DashboardSettings[K]>>] {
  const update = useStore((state) => state.updateNormalDashboardSettings);
  const id = dashboard.id;
  const setValue = useCallback(
    (next: SetStateAction<DashboardSettings[K]>) => {
      update(id, (settings) => {
        const value =
          typeof next === "function"
            ? (next as (current: DashboardSettings[K]) => DashboardSettings[K])(
                settings[key],
              )
            : next;
        return value === settings[key]
          ? settings
          : { ...settings, [key]: value };
      });
    },
    [id, key, update],
  );
  return [dashboard.settings[key], setValue];
}
