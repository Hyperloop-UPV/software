// Small presentational pieces shared by the v2 list tabs (Boards, Measurements,
// Packets, Sockets).
import { Input } from "@workspace/ui/components";
import { ChevronDown, ChevronUp, Search } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";

export type SortDir = "asc" | "desc";

export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-foreground rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function ResultCount({ n, total }: { n: number; total: number }) {
  return (
    <span className="text-muted-foreground shrink-0 text-[11px]">
      {n === total ? total : `${n} / ${total}`}
    </span>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="relative flex-1">
      <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pl-8 pr-8 text-xs shadow-none focus-visible:ring-0"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 text-xs"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function SortableHeader<K extends string>({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  col: K;
  sortKey: K;
  sortDir: SortDir;
  onSort: (col: K) => void;
}) {
  const active = sortKey === col;
  return (
    <th className="bg-background pb-2 pr-3 text-left">
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
        ) : (
          <ChevronDown className="size-3 opacity-0 group-hover:opacity-40" />
        )}
      </button>
    </th>
  );
}

export function BoardChip({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground opacity-50 hover:opacity-80",
      )}
    >
      {name}
    </button>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-sm">
      <Search className="mb-2 size-8 opacity-20" />
      {text}
    </div>
  );
}
