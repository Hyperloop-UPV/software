import { Dropdown } from "components/FormComponents/Dropdown/Dropdown";
import styles from "./Controls.module.scss";
import { Button } from "components/FormComponents/Button/Button";

type Props = {
    options: Array<string>;
    enableUpload: boolean;
    onBoardChange: (board: string) => void;
    onDownloadClick: () => void;
    onUploadClick: () => void;
};

export const Controls = ({
    options,
    enableUpload,
    onBoardChange,
    onDownloadClick,
    onUploadClick,
}: Props) => {
    return (
        <div className={styles.boardControlsWrapper}>
            <Dropdown
                options={options}
                onChange={onBoardChange}
            />

            <Button
                label="Download"
                onClick={onDownloadClick}
                color="hsl(209, 100%, 60%)"
            ></Button>
            <Button
                label="Upload"
                disabled={!enableUpload}
                onClick={() => {
                    if (enableUpload) onUploadClick();
                }}
            ></Button>
        </div>
    );
};
