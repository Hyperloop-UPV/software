import App from "App";
import { ConfigProvider, GlobalTicker } from "common";
import "common/dist/style.css";
import React from "react";
import ReactDOM from "react-dom/client";
import "styles/fonts.scss";
import "./index.scss";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <ConfigProvider
            devIp="127.0.0.1"
            prodIp="127.0.0.1"
        >
            <GlobalTicker fps={100}>
                <App />
            </GlobalTicker>
        </ConfigProvider>
    </React.StrictMode>
);