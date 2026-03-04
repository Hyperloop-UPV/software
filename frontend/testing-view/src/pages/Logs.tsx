import { useState } from "react";
import { LogsContent } from "../features/logs/components/LogsContent";
import { LogsSidebar } from "../features/logs/components/LogsSidebar";
import { MOCK_ARCHIVES } from "../mocks/archives";

export const Logs = () => {
  // Track which archive is currently selected
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Find the selected archive object
  const selectedArchive = MOCK_ARCHIVES.find((a) => a.id === selectedId);

  return (
    <div className="flex h-full w-full">
      {/* Archives List Sidebar */}
      <LogsSidebar
        archives={MOCK_ARCHIVES}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Main Content Area */}
      <main className="flex h-full flex-1 flex-col items-center justify-center p-12 text-center">
        <LogsContent archive={selectedArchive} />
      </main>
    </div>
  );
};
