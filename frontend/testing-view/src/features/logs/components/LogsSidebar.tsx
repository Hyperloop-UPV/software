import { Badge, Separator } from "@workspace/ui";

interface LogSidebarProps {
  archives: any[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export const LogsSidebar = ({
  archives,
  selectedId,
  onSelect,
}: LogSidebarProps) => (
  <aside className="flex w-80 flex-col border-r shadow-sm">
    <header className="flex items-center justify-between p-5">
      <h1 className="text-xl font-semibold">Archives</h1>
    </header>
    <Separator />

    <nav className="flex-1 overflow-y-auto">
      {archives.length === 0 ? (
        <div className="p-8 text-center text-xs font-medium italic">
          No archives found
        </div>
      ) : (
        <ul>
          {archives.map((archive) => (
            <li
              key={archive.id}
              onClick={() => onSelect(archive.id)}
              className={`cursor-pointer p-4 transition-all ${
                selectedId === archive.id
                  ? "bg-primary/20"
                  : "hover:bg-accent-50"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="truncate text-sm font-semibold">
                  {archive.filename}
                </span>
                <div className="flex items-center gap-2 text-[10px] font-medium">
                  <span>{archive.size_bytes.toLocaleString()} bytes</span>
                  <span>•</span>
                  <Badge className="h-3.5 px-1 py-0 text-[8px] font-bold uppercase">
                    {archive.content_type.split("/")[1]}
                  </Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </nav>
  </aside>
);
