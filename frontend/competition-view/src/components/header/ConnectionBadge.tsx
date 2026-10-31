import { Badge } from "@hyperloop-upv/frontend-kit/components";

interface ConnectionBadgeProps {
  /** Clear label identifying what this badge reports on, e.g. "Backend" or "VCU". */
  label: string;
  connected: boolean;
}

const ConnectionBadge = ({ label, connected }: ConnectionBadgeProps) => (
  <Badge
    variant="outline"
    className={`w-fit gap-1.5 px-2.5 py-1 text-sm whitespace-nowrap ${
      connected
        ? "border-green-500 text-green-600 dark:text-green-400"
        : "border-red-500 text-red-600 dark:text-red-400"
    }`}
  >
    <span
      className={`size-2 rounded-full ${
        connected ? "bg-green-500" : "bg-red-500"
      }`}
    />
    {label}
  </Badge>
);

export default ConnectionBadge;
