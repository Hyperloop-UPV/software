import { AppLayout } from "./layout/AppLayout";

import { Testing } from "./pages/Testing";
import { Route, Routes } from "react-router";
import { Logs } from "./pages/Logs";
import { CameraView } from "./pages/CameraView";
import { useFetchConfig, useWebSocket } from "@workspace/ui/hooks";
import { useEffect, useMemo } from "react";
import { logger } from "@workspace/core";
import type { Packet } from "./types/Packet";
import type { Command } from "./types/Command";
import type { BoardName } from "./types/BoardName";
import { useStore } from "./store/store";
import { MOCK_PACKETS } from "./mocks/packets";
import { MOCK_COMMANDS } from "./mocks/commands";

// count: 0
// cycleTime: 0
// hexValue: string
// id: number
// measurements: Measurement[]
// name: string
// type: "data" | "string"

interface BoardData {
  name: BoardName;
}

interface BoardOrdersData extends BoardData {
  orders: Command[];
}

interface BoardPacketsData extends BoardData {
  packets: Packet[];
}

interface PacketsData {
  boards: BoardPacketsData[];
}

interface OrdersData {
  boards: BoardOrdersData[];
}

function formatName(name: string): string {
  const withoutParentheses = name.replace(/[()]/g, "");

  // Remove common board prefixes
  const withoutPrefix = withoutParentheses
    .replace(/(bcu|pcu|lcu|hvscu|bmsl|vcu)_/, "")
    .replace(/hvscu_cabinet_/, "");

  // Split by underscore and capitalize each word
  const words = withoutPrefix.split(/[_ ]+/);

  // Special cases for acronyms that should stay uppercase
  const acronyms = [
    "SOC",
    "SOH",
    "CAN",
    "HV",
    "DC",
    "DC-DC",
    "PFM",
    "RPM",
    "CPU",
    "12V",
    "IMD",
    "SDC",
    "OBCCU",
    "BCU",
    "PFM",
    "PWM",
  ];

  const formatted = words
    .map((word) => {
      const upperWord = word.toUpperCase();
      // Check if word is an acronym
      if (acronyms.includes(upperWord)) {
        return upperWord;
      }
      // Capitalize first letter, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  return formatted;
}

function App() {
  useWebSocket();

  const { data: packets, loading: packetsLoading } =
    useFetchConfig<PacketsData>("podDataStructure");
  const { data: commands, loading: commandsLoading } =
    useFetchConfig<OrdersData>("orderStructures");

  const setPackets = useStore((s) => s.setPackets);
  const setCommands = useStore((s) => s.setCommands);
  const initializeTabFilters = useStore((s) => s.initializeTabFilters);

  const transformedBoards = useMemo(() => {
    if (!packets?.boards || !commands?.boards) {
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
  }, [packets, commands]);

  useEffect(() => {
    if (!transformedBoards.packets || !transformedBoards.commands) return;

    setPackets(transformedBoards.packets);
    setCommands(transformedBoards.commands);
    initializeTabFilters();
  }, [transformedBoards]);

  const boards = Object.keys(transformedBoards);

  useEffect(() => {
    logger.testingView.log("useFetchConfig / podDataStructure", packets);
    logger.testingView.log("useFetchConfig / orderStructures", commands);
    logger.testingView.log("Transformed / boards", transformedBoards.boards);
    logger.testingView.log("Transformed boards", transformedBoards);
  }, [boards, packets, commands, transformedBoards]);

  const determineMode = () => {
    const isDev = import.meta.env.DEV;
    const isLoading = packetsLoading || commandsLoading;
    const hasData = packets?.boards && commands?.boards;

    if (isLoading) return "loading";
    if (hasData) return "active";
    if (isDev) return "mock";
    return "error";
  };

  logger.testingView.log("determineMode", determineMode());

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Testing />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/camera-view" element={<CameraView />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
