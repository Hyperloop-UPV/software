import styles from "components/Logger/Logger.module.scss";
import { useLogger } from "./useLogger";
import { Island } from "components/Island/Island";
import { Button } from "components/FormComponents/Button/Button";
import oscilloscope from "assets/svg/oscilloscope.svg";
import { useConfig } from "common";

export const Logger = () => {

    const [state, startLogging, stopLogging] = useLogger();
    const config = useConfig();

    return (
        <Island style={{ height: "min-content" }}>
            <div className={styles.logger}>
                <span className={styles.state}>Logging: {`${state}`}</span>
                <div className={styles.buttons}>
                    <Button
                        label="Start"
                        color="hsl(116, 38%, 50%)"
                        onClick={() => {
                            startLogging();
                        }}
                    ></Button>
                    <Button
                        label="Stop"
                        color="hsl(0, 77%, 53%)"
                        onClick={() => {
                            stopLogging();
                        }}
                    ></Button>

                    <Button
                        icon={oscilloscope}
                        onClick={() => {
                            window.open(`http://${config.oscilloscope.ip}/screenshot.png`, '_blank');
                        }}
                    ></Button>
                </div>
            </div>
        </Island>
    );
};
