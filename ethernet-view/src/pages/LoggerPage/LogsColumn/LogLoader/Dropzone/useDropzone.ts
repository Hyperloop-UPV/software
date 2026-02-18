import { useEffect, useState } from "react";
import { UploadInformation, UploadState } from "../LogLoader";
import { LogSession } from "pages/LoggerPage/useLogStore";

interface Props {
    uploadInformation: UploadInformation;
}

export const useDropzone = ({uploadInformation}: Props) => {

    const [dropZoneText, setDropZoneText] = useState<string>();
    const [draftSession, setDraftSession] = useState<LogSession>();

    useEffect(() => {
        setDropZoneText(`${
            uploadInformation.state === UploadState.UPLOADING ? "Uploading..." :
            uploadInformation.state === UploadState.SUCCESS ? "Upload successful" :
            uploadInformation.state === UploadState.ERROR ? "Upload failed" : 
            "Drop a logger session directory here"
        }`);
    }, [uploadInformation]);

    return {
        dropZoneText,
        setDraftSession,
        draftSession
    }

}
