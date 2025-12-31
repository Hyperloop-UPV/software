import { logger } from "@workspace/core";
import { useMemo } from "react";
import { formatName } from "../lib/utils";
import { MOCK_COMMANDS } from "../mocks/commands";
import { MOCK_PACKETS } from "../mocks/packets";
import type { AppMode } from "../store/slices/appSlice";
import type { BoardName } from "../types/data/board";
import type { Command } from "../types/data/command";
import type { Packet } from "../types/data/packet";
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
    if (appMode === "loading") {
      logger.testingView.log("[useBoardData] Loading mode");
      return {
        packets: {},
        commands: {},
        boards: new Set(),
      };
    }

    if (appMode === "mock") {
      logger.testingView.warn("[useBoardData] Mock mode");
      return {
        packets: MOCK_PACKETS,
        commands: MOCK_COMMANDS,
        boards: new Set(),
      };
    }

    if (appMode === "error") {
      logger.testingView.error(
        "[useBoardData] Error mode. No packets or commands found",
      );
      return {
        packets: {},
        commands: {},
        boards: new Set(),
      };
    }

    logger.testingView.log("[useBoardData] Transforming boards...");

    const packetsResult: Record<string, Packet[]> = {};
    const commandsResult: Record<string, Command[]> = {};
    const availableBoards: Set<BoardName> = new Set();

    // Process packets data
    packets?.boards.forEach((board) => {
      availableBoards.add(board.name);

      if (!packetsResult[board.name]) {
        packetsResult[board.name] = [];
      }

      packetsResult[board.name] = (board.packets || []).map((packet) => ({
        ...packet,
        label: formatName(packet.name),
      }));
    });

    logger.testingView.log("[useBoardData] Packets data processed");

    // Process commands data
    commands?.boards.forEach((board) => {
      availableBoards.add(board.name);

      if (!commandsResult[board.name]) {
        commandsResult[board.name] = [];
      }

      commandsResult[board.name] = (board.orders || []).map((command) => ({
        ...command,
        label: formatName(command.name),
      }));
    });

    logger.testingView.log("[useBoardData] Commands data processed");

    return {
      packets: packetsResult,
      commands: commandsResult,
      boards: availableBoards,
    };
  }, [packets, commands, appMode]);

  return transformedBoards;
}
