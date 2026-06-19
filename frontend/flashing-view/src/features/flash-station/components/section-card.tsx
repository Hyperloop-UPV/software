import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function SectionCard({ title, children, action }: Props) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-sm gap-2">
      <CardHeader className="pb-0 grid-rows-1">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
