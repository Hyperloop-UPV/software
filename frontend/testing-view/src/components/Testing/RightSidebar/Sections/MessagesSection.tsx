import { Button } from "@workspace/ui";
import { MessagesList } from "./MessagesList";

const MessagesSection = () => (
  <div className="flex h-full flex-1 flex-col">
    <div className="flex items-center justify-between border-b p-2">
      <span className="text-foreground px-2 text-sm font-semibold">
        Messages
      </span>
      <Button variant="secondary" size="sm" className="h-6 text-xs">
        Clear
      </Button>
    </div>
    <div className="flex-1 overflow-y-auto">
      <MessagesList />
    </div>
  </div>
);

export default MessagesSection;
