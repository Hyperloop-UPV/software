import { socketService } from "@workspace/core";
import { useEffect } from "react";

const useErrorSubscription = (callback: (err: Error) => void) => {
  useEffect(() => {
    const sub = socketService.onError((err) => callback(err));

    return () => sub.unsubscribe();
  }, [callback]);
};

export default useErrorSubscription;
