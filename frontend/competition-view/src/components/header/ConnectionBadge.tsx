import { Badge } from "@workspace/ui/components";

interface ConnectionBadgeProps {
  connected: boolean;
}

const ConnectionBadge = ({ connected }: ConnectionBadgeProps) => (
  <Badge
    variant="outline"
    className={`gap-1.5 ${
      connected
        ? "border-green-500 text-green-600 dark:text-green-400"
        : "border-red-500 text-red-600 dark:text-red-400"
    }`}
  >
    <span
      className={`size-1.5 rounded-full ${
        connected ? "bg-green-500" : "bg-red-500"
      }`}
    />
    {connected ? "Connected" : "Disconnected"}
  </Badge>
);

export default ConnectionBadge;
