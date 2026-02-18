import { Button } from "components/FormComponents/Button/Button"
import styles from "./Controls.module.scss"
import { UploadInformation, UploadState } from "../../LogLoader";

type Props = {
    uploadInformation: UploadInformation;
    onLoad: () => void;
    onRemove: () => void;
}

export const Controls = ({uploadInformation, onLoad, onRemove}: Props) => {
    return (
        <div className={styles.controlsWrapper}>

            <Button 
                label="Load"
                color="#317ae7"
                disabled={uploadInformation.state !== UploadState.SUCCESS}
                onClick={() => onLoad()}
            />

            <Button
                label="Remove"
                disabled={uploadInformation.state !== UploadState.SUCCESS && uploadInformation.state !== UploadState.ERROR}
                onClick={() => onRemove() }
            />

        </div>
    )
}
