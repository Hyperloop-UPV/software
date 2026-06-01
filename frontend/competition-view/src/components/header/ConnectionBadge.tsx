interface ConnectionBadgeProps {
  connected: boolean;
}

const ConnectionBadge = ({ connected }: ConnectionBadgeProps) => (
  <span
    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
      connected
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    }`}
  >
    <span
      className={`size-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
    />
    {connected ? "Connected" : "Disconnected"}
  </span>
);

export default ConnectionBadge;
