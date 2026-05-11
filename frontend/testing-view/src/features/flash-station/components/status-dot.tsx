import { Circle } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { BoardState } from "../types"

/**
 * Tiny coloured dot shown next to a board name.
 *
 * Green = board is online and ready to flash.
 * Grey  = board is offline (cable unplugged, power down, etc.).
 */
export function StatusDot({ state }: { state: BoardState }) {
  const className = state === "connected" ? "text-green-600" : "text-slate-400"

  return <Circle className={cn("size-3 fill-current", className)} />
}
