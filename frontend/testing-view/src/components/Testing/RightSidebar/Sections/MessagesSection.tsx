import { Button } from "@workspace/ui";
import { Trash2 } from "@workspace/ui/icons";
import { useStore } from "../../../../store/store";
import { MessagesList } from "./MessagesList";

const MessagesSection = () => {
  const messages = useStore((s) => s.messages);
  const clearMessages = useStore((s) => s.clearMessages);

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-foreground px-2 text-sm font-semibold">
            Messages
          </span>
          <span className="bg-primary/10 text-primary h-5.5 w-5.5 flex items-center justify-center rounded-full text-xs font-bold">
            {messages.length}
          </span>
        </div>
        {/* List Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-6 w-6"
            onClick={clearMessages}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MessagesList />
      </div>
    </div>
  );
};

export default MessagesSection;
