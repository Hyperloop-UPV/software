import { logger, socketService } from "@workspace/core";
import { useEffect } from "react";
import { SPECIAL_KEY_BINDINGS } from "../constants/specialKeyBindings";
import { getDefaultParameterValues } from "../lib/commandUtils";
import { useStore } from "../store/store";
import type { CommandCatalogItem } from "../types/data/commandCatalogItem";

export const useGlobalKeyBindings = () => {
  const getKeyBindings = useStore((s) => s.getKeyBindings);
  const commandsCatalog = useStore((s) => s.commandsCatalog);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/contenteditable
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Build key string (matching the format from AddKeyBindingDialog)
      let key: string;
      if (SPECIAL_KEY_BINDINGS[e.key]) {
        key = SPECIAL_KEY_BINDINGS[e.key];
      } else if (e.key.length === 1) {
        key = e.key.toUpperCase();
      } else {
        key = e.key;
      }

      // Get all bindings for this key
      const bindings = getKeyBindings().filter((b) => b.key === key);

      if (bindings.length === 0) return;

      // Execute each binding
      bindings.forEach((binding) => {
        // Find the command in the catalog
        let commandToExecute: CommandCatalogItem | null = null;
        for (const commands of Object.values(commandsCatalog)) {
          const found = commands.find((c) => c.id === binding.commandId) as
            | CommandCatalogItem
            | undefined;
          if (found) {
            commandToExecute = found;
            break;
          }
        }

        if (!commandToExecute) {
          logger.testingView.warn(
            `Command ${binding.commandId} not found for key binding [${key}]`,
          );
          return;
        }

        // Get parameters from binding (or use defaults)
        const parameterValues = binding.parameters || {};

        // Build payload with binding's configured parameters
        const payload = {
          id: commandToExecute.id,
          fields: Object.entries(commandToExecute.fields).reduce(
            (acc, [fieldKey, field]) => {
              // Use binding's parameter value or fall back to default
              let value = parameterValues[fieldKey];

              // If no value in binding, use field defaults
              if (value === undefined) {
                value = getDefaultParameterValues(commandToExecute.fields)[
                  fieldKey
                ];
              }

              acc[fieldKey] = {
                value: field.kind === "numeric" ? parseFloat(value) : value,
                isEnabled: true,
                type: field.type,
              };
              return acc;
            },
            {} as Record<string, any>,
          ),
        };

        logger.testingView.log(
          `Executing command via key binding [${key}]:`,
          commandToExecute.label,
          "with payload:",
          payload,
        );

        socketService.post("order/send", payload);
      });

      // Prevent default if we executed any commands
      if (bindings.length > 0) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [getKeyBindings, commandsCatalog]);
};
