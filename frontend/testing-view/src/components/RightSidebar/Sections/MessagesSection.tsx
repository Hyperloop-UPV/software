import { Button } from "@workspace/ui";
import { MessagesList } from "../MessagesList";
import { ChevronUp } from "@workspace/ui/icons";

const MessagesSection = ({ onCollapse }: { onCollapse: () => void }) => (
  <div className="flex h-full flex-1 flex-col">
    <div className="flex items-center justify-between border-b p-2">
      <div className="flex items-center justify-center">
        <Button onClick={onCollapse} variant="ghost" size="sm">
          <ChevronUp className="text-foreground h-4 w-4" />
        </Button>
        <span className="text-foreground text-sm font-semibold">Messages</span>
      </div>
      <Button variant="ghost" size="sm" className="h-6 text-xs">
        Clear
      </Button>
    </div>
    <div className="flex-1 overflow-y-auto">
      <MessagesList />
    </div>
  </div>
);

export default MessagesSection;
