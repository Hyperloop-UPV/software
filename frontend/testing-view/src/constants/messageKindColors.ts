import type { Message } from "../types/data/message";

export const MESSAGE_KIND_COLORS: Record<Message["kind"], string> = {
    info: "border-blue-500 hover:bg-blue-500/5",
    warning: "border-yellow-500 hover:bg-yellow-500/5",
    fault: "border-red-500 hover:bg-red-500/5",
    ok: "border-green-500 hover:bg-green-500/5",
  };