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
import { usePacketsFilterStore } from "./store/usePacketsFilterStore";
import { useCommandsFilterStore } from "./store/useCommandsFilterStore";

// count: 0
// cycleTime: 0
// hexValue: string
// id: number
// measurements: Measurement[]
// name: string
// type: "data" | "string"

interface PacketsData {
  boards: BoardPacketsData[];
}

interface OrdersData {
  boards: BoardOrdersData[];
}

interface BoardOrdersData extends BoardData {
  orders: Command[];
}

interface BoardPacketsData extends BoardData {
  packets: Packet[];
}

interface BoardData {
  name: string;
}

function formatName(name: string): string {
  // Remove common board prefixes
  const withoutPrefix = name
    .replace(/^(bcu|pcu|lcu|hvscu|bmsl|vcu)_/, "")
    .replace(/^hvscu_cabinet_/, "");

  // Split by underscore and capitalize each word
  const words = withoutPrefix.split("_");

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

  const setPacketsDataSource = usePacketsFilterStore(
    (state) => state.setDataSource,
  );
  const setCommandsDataSource = useCommandsFilterStore(
    (state) => state.setDataSource,
  );

  const trasformedBoards = useMemo(() => {
    if (!packets?.boards) {
      logger.testingView.error("No packets found");
      return {};
    }

    if (!commands?.boards) {
      logger.testingView.error("No commands found");
      return {};
    }

    logger.testingView.log("Both packets and commands found");
    logger.testingView.log("Transforming boards...");

    const packetsResult: Record<string, Packet[]> = {};
    const commandsResult: Record<string, Command[]> = {};

    // Process packets data
    packets.boards.forEach((board) => {
      if (!packetsResult[board.name]) {
        packetsResult[board.name] = [];
      }

      packetsResult[board.name] = (board.packets || []).map((packet) => ({
        ...packet,
        label: formatName(packet.name),
      }));
    });

    logger.testingView.log("Packets data processed");
    setPacketsDataSource(packetsResult);

    // Process commands data
    commands.boards.forEach((board) => {
      if (!commandsResult[board.name]) {
        commandsResult[board.name] = [];
      }

      commandsResult[board.name] = (board.orders || []).map((command) => ({
        ...command,
        label: formatName(command.name),
      }));
    });

    logger.testingView.log("Commands data processed");
    setCommandsDataSource(commandsResult);

    return { packets: packetsResult, commands: commandsResult };
  }, [packets, commands]);

  const boards = Object.keys(trasformedBoards);

  useEffect(() => {
    logger.testingView.log("useFetchConfig / uploadableBoards", boards);
    logger.testingView.log("useFetchConfig / podDataStructure", packets);
    logger.testingView.log("useFetchConfig / orderStructures", commands);
    logger.testingView.log("Transformed boards", trasformedBoards);
  }, [boards, packets, commands, trasformedBoards]);

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
