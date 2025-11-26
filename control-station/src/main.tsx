import "common/dist/style.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { App } from "./App";
import "./index.css";
import { mainPageRoute } from "pages/VehiclePage/MainPage/mainPageRoute";
import { camerasRoute } from "pages/CamerasPage/camerasRoute";
import { batteriesRoute } from "pages/VehiclePage/BatteriesPage/batteriesRoute";
import { boosterRoute } from "pages/VehiclePage/BoosterPage/boosterRoute";
import { ConfigProvider, GlobalTicker } from "common";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "", element: <Navigate to={"vehicle"} /> },
      mainPageRoute,
      boosterRoute,
      batteriesRoute,
      camerasRoute,
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider devIp="127.0.0.1" prodIp="127.0.0.1">
      <GlobalTicker fps={30}>
        <RouterProvider router={router}></RouterProvider>
      </GlobalTicker>
    </ConfigProvider>
  </React.StrictMode>
);
