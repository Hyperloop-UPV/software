import { logger, observe, onTopic, post } from "@workspace/core";
import { subscribe } from "diagnostics_channel";

export const useWebSocket = () => {
  post("podData/update", { subscribe: true });

  // Subscribe
  onTopic("podData/update").subscribe((data) =>
    logger.ui.log("Proccesing podData/update", data),
  );

  // Send
  post("logger/enable", false);
};
