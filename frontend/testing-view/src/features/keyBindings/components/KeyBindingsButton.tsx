import { Button } from "@workspace/ui";
import { Keyboard } from "@workspace/ui/icons";
import { useState } from "react";
import { KeyBindingsDialog } from "./KeyBindingsDialog";

interface KeyBindingsButtonProps {
  disabled?: boolean;
}

export const KeyBindingsButton = ({
  disabled = false,
}: KeyBindingsButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="gap-2"
      >
        <Keyboard className="h-4 w-4" />
        Key Bindings
      </Button>
      <KeyBindingsDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
};
