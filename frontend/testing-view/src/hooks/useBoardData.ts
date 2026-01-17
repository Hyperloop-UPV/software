import { logger } from "@workspace/core";
import { useMemo } from "react";
import { formatName } from "../lib/utils";
import { MOCK_COMMANDS_CATALOG } from "../mocks/commands";
import { MOCK_TELEMETRY_CATALOG } from "../mocks/telemetry";
import type { AppMode } from "../types/app/mode";
import type { BoardName } from "../types/data/board";
import type { CommandCatalogItem } from "../types/data/commandCatalogItem";
import type { TelemetryCatalogItem } from "../types/data/telemetryCatalogItem";
import type {
  OrdersData,
  PacketsData,
  TransformedBoards,
} from "../types/data/transformedBoards";

export function useBoardData(
  packets: PacketsData | null,
  commands: OrdersData | null,
  appMode: AppMode,
) {
  const transformedBoards = useMemo<TransformedBoards>(() => {
    // For now 'boards' property is not used, I keep it because it could be useful
    if (appMode === "loading") {
      logger.testingView.log("[useBoardData] Loading mode");
      return {
        telemetryCatalog: {},
        commandsCatalog: {},
        boards: new Set(),
      };
    }

    if (appMode === "mock" || appMode === "mock-active") {
      logger.testingView.warn("[useBoardData] Mock mode");
      return {
        telemetryCatalog: MOCK_TELEMETRY_CATALOG,
        commandsCatalog: MOCK_COMMANDS_CATALOG,
        boards: new Set(),
      };
    }

    if (appMode === "error") {
      logger.testingView.error(
        "[useBoardData] Error mode. No telemetry catalog or commands catalog found",
      );
      return {
        telemetryCatalog: {},
        commandsCatalog: {},
        boards: new Set(),
      };
    }

    logger.testingView.log("[useBoardData] Transforming boards...");

    // If data fetched successfully, I transform it into a different format
    // (also add label prop for the name I display)

    const telemetryCatalogResult: Record<string, TelemetryCatalogItem[]> = {};
    const commandsCatalogResult: Record<string, CommandCatalogItem[]> = {};
    const availableBoards: Set<BoardName> = new Set();

    // Process packets data
    packets?.boards.forEach((board) => {
      availableBoards.add(board.name);

      if (!telemetryCatalogResult[board.name]) {
        telemetryCatalogResult[board.name] = [];
      }

      telemetryCatalogResult[board.name] = (board.packets || []).map(
        (packet) => ({
          ...packet,
          label: formatName(packet.name),
        }),
      );
    });

    logger.testingView.log("[useBoardData] Telemetry catalog data processed");

    // Process commands data
    commands?.boards.forEach((board) => {
      availableBoards.add(board.name);

      if (!commandsCatalogResult[board.name]) {
        commandsCatalogResult[board.name] = [];
      }

      commandsCatalogResult[board.name] = (board.orders || []).map(
        (command) => ({
          ...command,
          label: formatName(command.name),
        }),
      );
    });

    logger.testingView.log("[useBoardData] Commands data processed");

    return {
      telemetryCatalog: telemetryCatalogResult,
      commandsCatalog: commandsCatalogResult,
      boards: availableBoards,
    };
  }, [packets, commands, appMode]);

  return transformedBoards;
}
