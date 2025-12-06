import { useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenuItem,
  Button,
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  Input,
} from "@workspace/ui";
import { Plus } from "@workspace/ui/icons";
import { useTabStore } from "@workspace/ui/store";

export const AddTabPopover = () => {
  const { addTab, tabs } = useTabStore();
  const [isOpen, setIsOpen] = useState(false);
  const [tabId, setTabId] = useState("");
  const [tabName, setTabName] = useState("");
  const [tabDescription, setTabDescription] = useState("");
  const [idError, setIdError] = useState("");
  const [nameError, setNameError] = useState("");

  const validateId = (id: string) => {
    if (!id.trim()) {
      setIdError("ID is required");
      return false;
    }
    if (tabs.some((tab) => tab.id === id.trim())) {
      setIdError("ID already exists");
      return false;
    }
    setIdError("");
    return true;
  };

  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError("Name is required");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isIdValid = validateId(tabId);
    const isNameValid = validateName(tabName);

    if (!isIdValid || !isNameValid) {
      return;
    }

    const newTab = {
      id: tabId.trim(),
      name: tabName.trim(),
      description: tabDescription.trim() || "",
    };

    addTab(newTab);
    setTabId("");
    setTabName("");
    setTabDescription("");
    setIdError("");
    setNameError("");
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTabId("");
      setTabName("");
      setTabDescription("");
      setIdError("");
      setNameError("");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
            <Plus className="size-4" />
          </div>
          <div className="text-muted-foreground font-medium">Add tab</div>
        </DropdownMenuItem>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!idError}>
              <FieldLabel htmlFor="tab-id">ID *</FieldLabel>
              <Input
                id="tab-id"
                value={tabId}
                onChange={(e) => {
                  setTabId(e.target.value);
                  if (idError) validateId(e.target.value);
                }}
                onBlur={() => validateId(tabId)}
                placeholder="Enter unique ID"
                autoComplete="off"
                autoFocus
                aria-invalid={!!idError}
              />
              {idError && <FieldError>{idError}</FieldError>}
            </Field>

            <Field data-invalid={!!nameError}>
              <FieldLabel htmlFor="tab-name">Name *</FieldLabel>
              <Input
                id="tab-name"
                value={tabName}
                onChange={(e) => {
                  setTabName(e.target.value);
                  if (nameError) validateName(e.target.value);
                }}
                onBlur={() => validateName(tabName)}
                placeholder="Enter tab name"
                autoComplete="off"
                aria-invalid={!!nameError}
              />
              {nameError && <FieldError>{nameError}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="tab-description">Description</FieldLabel>
              <Input
                id="tab-description"
                value={tabDescription}
                onChange={(e) => setTabDescription(e.target.value)}
                placeholder="Enter tab description"
                autoComplete="off"
              />
            </Field>
          </FieldGroup>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!tabId.trim() || !tabName.trim()}
            >
              Add Tab
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
