import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/shadcn/card";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

/**
 * Wrapper that gives every left-column panel the same rounded corners,
 * border, and shadow — keeps JSX in the view lean.
 */
export function SectionCard({ title, children }: Props) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
