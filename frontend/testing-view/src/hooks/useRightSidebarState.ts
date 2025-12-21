import { useState } from "react";

export function useRightSidebarState() {
  const [isTabsVisible, setIsTabsVisible] = useState(true);
  const [isMessagesVisible, setIsMessagesVisible] = useState(true);
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [isSplit, setIsSplit] = useState(false);

  const bothVisible = isTabsVisible && isMessagesVisible;
  const noneVisible = !isTabsVisible && !isMessagesVisible;

  return {
    isTabsVisible,
    isMessagesVisible,
    isHorizontal,
    isSplit,
    bothVisible,
    noneVisible,
    toggleTabs: () => setIsTabsVisible((prev) => !prev),
    toggleMessages: () => setIsMessagesVisible((prev) => !prev),
    toggleLayout: () => setIsHorizontal((prev) => !prev),
    toggleSplit: () => setIsSplit((prev) => !prev),
  };
}
