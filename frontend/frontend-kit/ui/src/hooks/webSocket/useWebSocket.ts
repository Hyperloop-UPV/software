import { logger, onTopic, post } from "@workspace/core";

export const useWebSocket = () => {
  // Subscribe
  onTopic("podData/update").subscribe((data) => logger.ui.log(data));

  // Send
  post("logger/enable", true);
};
