import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/shadcn/card"

/**
 * Thin wrapper around the shadcn Card so every panel in the left column
 * shares the same rounded corners, border, and shadow.
 */
export function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}
