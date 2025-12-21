import { useMemo } from "react";
import { logger } from "@workspace/core";
import { useStore } from "../store/store";
import { MOCK_PACKETS } from "../mocks/packets";
import { MOCK_COMMANDS } from "../mocks/commands";
import { formatName } from "../lib/utils";
import type { BoardName } from "../types/BoardName";
import type { Command } from "../types/Command";
import type { Packet } from "../types/Packet";
import type {
  PacketsData,
  OrdersData,
  TransformedBoards,
} from "../types/AppData";
import type { AppMode } from "../store/slices/appSlice";

export function useBoardData(
  packets: PacketsData | null,
  commands: OrdersData | null,
  appMode: AppMode,
) {
  const transformedBoards = useMemo<TransformedBoards>(() => {
    if (!packets?.boards || !commands?.boards || appMode === "mock") {
      logger.testingView.error("No packets or commands found");
      return {
        packets: MOCK_PACKETS,
        commands: MOCK_COMMANDS,
        boards: new Set(),
      };
    }

    if (appMode === "error") {
      logger.testingView.error("No packets or commands found");
      return {
        packets: MOCK_PACKETS,
        commands: MOCK_COMMANDS,
        boards: new Set(),
      };
    }

    logger.testingView.log("Both packets and commands found");
    logger.testingView.log("Transforming boards...");

    const packetsResult: Record<string, Packet[]> = {};
    const commandsResult: Record<string, Command[]> = {};
    const availableBoards: Set<BoardName> = new Set();

    // Process packets data
    packets.boards.forEach((board) => {
      availableBoards.add(board.name);

      if (!packetsResult[board.name]) {
        packetsResult[board.name] = [];
      }

      packetsResult[board.name] = (board.packets || []).map((packet) => ({
        ...packet,
        label: formatName(packet.name),
      }));
    });

    logger.testingView.log("Packets data processed");

    // Process commands data
    commands.boards.forEach((board) => {
      availableBoards.add(board.name);

      if (!commandsResult[board.name]) {
        commandsResult[board.name] = [];
      }

      commandsResult[board.name] = (board.orders || []).map((command) => ({
        ...command,
        label: formatName(command.name),
      }));
    });

    logger.testingView.log("Commands data processed");

    return {
      packets: packetsResult,
      commands: commandsResult,
      boards: availableBoards,
    };
  }, [packets, commands, appMode]);

  return transformedBoards;
}
