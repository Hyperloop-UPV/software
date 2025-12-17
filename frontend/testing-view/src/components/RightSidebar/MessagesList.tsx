import { MOCK_MESSAGES } from "../../mocks/messages";

export const MessagesList = () => {
  return (
    <div className="shrink-0 border-t">
      <div className="space-y-3 p-4">
        <div className="space-y-2">
          {MOCK_MESSAGES.map((msg) => (
            <div
              key={msg.id}
              // TODO: change this to something good
              className={`rounded border p-2 text-sm ${
                msg.level === "info"
                  ? "border-blue-500/20 bg-blue-500/5"
                  : msg.level === "warn"
                    ? "border-yellow-500/20 bg-yellow-500/5"
                    : msg.level === "error"
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-green-500/20 bg-green-500/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  // TODO: change this to something good
                  className={`font-semibold ${
                    msg.level === "info"
                      ? "text-blue-500"
                      : msg.level === "warn"
                        ? "text-yellow-500"
                        : msg.level === "error"
                          ? "text-red-500"
                          : "text-green-500"
                  }`}
                >
                  {msg.level.toUpperCase()}
                </span>
                <span className="text-muted-foreground text-xs">
                  {msg.timestamp}
                </span>
              </div>
              <div className="mt-1 text-xs">{msg.message}</div>
              {msg.details && (
                <div className="text-muted-foreground mt-1 text-xs">
                  {msg.details}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
