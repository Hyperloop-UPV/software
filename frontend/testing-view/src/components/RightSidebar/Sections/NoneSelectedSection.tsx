export const NoneSelectedSection = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="text-muted-foreground flex flex-col items-center gap-2">
        <p className="text-lg font-medium">No sections selected</p>
        <p className="text-sm">
          Use the toggle buttons above to show Commands / Packets or Messages
        </p>
      </div>
    </div>
  );
};
