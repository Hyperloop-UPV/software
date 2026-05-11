import { CheckCircle2, XCircle } from "lucide-react"
import { TableCell, TableRow } from "./table"
import type { FlashResult } from "../types"

/** One row in the results table — shows board name, success/fail icon, and timestamp. */
export function ResultRow({ result }: { result: FlashResult }) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div>
          <div className="font-medium text-foreground">{result.board}</div>
          <div className="text-xs text-muted-foreground">{result.firmware}</div>
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex items-center gap-2">
          {result.state === "success" ? (
            <CheckCircle2 className="size-4 text-green-600" />
          ) : (
            <XCircle className="size-4 text-destructive" />
          )}
          <span>{result.message}</span>
        </div>
      </TableCell>
      <TableCell>{result.time}</TableCell>
    </TableRow>
  )
}
