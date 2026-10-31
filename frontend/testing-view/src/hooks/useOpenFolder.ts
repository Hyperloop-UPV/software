import { logger } from "@hyperloop-upv/frontend-kit/core";

export const useOpenFolder = () => {
  const openFolder = (path?: string) => {
    if (!window.electronAPI) {
      logger.testingView.warn("electronAPI is not available");
      return;
    }
    window.electronAPI.openFolder(path ?? ".");
  };

  return { openFolder };
};
