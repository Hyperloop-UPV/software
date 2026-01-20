import { useEffect } from "react";

const useConfirmClose = (shouldLock: boolean) => {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldLock) {
        event.preventDefault();
        event.returnValue = "true";
        return "true";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldLock]);
};

export default useConfirmClose;
