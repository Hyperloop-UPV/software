import "./App.css";
import { TestingPage } from "pages/TestingPage/TestingPage";
import { SplashScreen } from "components/SplashScreen/SplashScreen";
import { WsHandlerProvider } from "common";
import { useLoadBackend } from "common";
import { AppLayout } from "layouts/AppLayout/AppLayout";
import { useState, useEffect } from "react";
import { LoggerPage } from "pages/LoggerPage/LoggerPage";
import { CamerasPage } from "pages/CamerasPage/CamerasPage";

function App() {

    const isProduction = import.meta.env.PROD;
    const loadBackend = useLoadBackend(isProduction);
    const [pageShown, setPageShown] = useState<string>("testing");

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", savedTheme);
    }, []);

    return (
        <AppLayout
            pageShown={pageShown}
            setPageShown={setPageShown}
        >
            <div
                className="App"
                style={{
                    display: pageShown == "testing" ? "block" : "none"
                }}
            >
                {loadBackend.state === "fulfilled" && 
                    <WsHandlerProvider handler={loadBackend.wsHandler}>
                        <TestingPage />
                    </WsHandlerProvider>}
                {loadBackend.state === "pending" && <SplashScreen />}
                {loadBackend.state === "rejected" && <div>{`${loadBackend.error}`}</div>}
            </div>
            <div 
                className="App"
                style={{
                    display: pageShown == "logger" ? "block" : "none"
                }}
            >
                <LoggerPage />
            </div>
            <div 
                className="App"
                style={{
                    display: pageShown == "cameras" ? "block" : "none"
                }}
            >
                <CamerasPage />
            </div>
        </AppLayout>
    );
}

export default App;