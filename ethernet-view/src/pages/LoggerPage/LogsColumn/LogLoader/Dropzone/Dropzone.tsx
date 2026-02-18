import { useState } from "react";
import { UploadInformation, UploadState } from "../LogLoader";
import styles from "./Dropzone.module.scss"
import { extractLoggerSession } from "../LogsProcessor";
import { Controls } from "./Controls/Controls";
import { useDropzone } from "./useDropzone";
import { LogSession, useLogStore } from "pages/LoggerPage/useLogStore";

export const Dropzone = () => {

    const [uploadInformation, setUploadInformation] = useState<UploadInformation>({state: UploadState.IDLE});
    const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
    const {dropZoneText, draftSession, setDraftSession} = useDropzone({uploadInformation});
    const addLogSession = useLogStore(state => state.addLogSession);

    const uploadSession = async (directory: FileSystemDirectoryEntry) => {
        setUploadInformation({state: UploadState.UPLOADING});
        try {
            const loggerSession = await extractLoggerSession(directory);
            setDraftSession({name: directory.name, measurementLogs: loggerSession} as LogSession);
            setUploadInformation({state: UploadState.SUCCESS});
        } catch(err) {
            if(err instanceof Error) {
                setUploadInformation({state: UploadState.ERROR, errorMessage: err.message});
            } else {
                setUploadInformation({state: UploadState.ERROR, errorMessage: "An unexpected error occurred"});
            }
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        try {
            validateEntry(e.dataTransfer.items);
            const directory = e.dataTransfer.items[0].webkitGetAsEntry();
            console.log(directory)
            await uploadSession(directory as FileSystemDirectoryEntry);
        } catch(err) {
            if (err instanceof Error){
                setUploadInformation({state: UploadState.ERROR, errorMessage: err.cause as string});
            } else {
                setUploadInformation({state: UploadState.ERROR, errorMessage: "An unexpected error occurred"});
            }
        }
    };

    return (
        <div>
        <div 
            className={`${styles.dropZone} 
                ${isDraggingOver ? styles.Active : ""}
                ${uploadInformation.state === UploadState.UPLOADING ? styles.Uploading : ""}
                ${uploadInformation.state === UploadState.SUCCESS ? styles.Success : ""}
                ${uploadInformation.state === UploadState.ERROR ? styles.Error : ""}
            `}
            onDragEnter={e => {
                e.preventDefault();
                setIsDraggingOver(true);
            }}
            onDragLeave={e => {
                e.preventDefault();
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setIsDraggingOver(false);
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
        >
            <div className={styles.dropZoneText}>
                <p>
                    {dropZoneText}
                    {uploadInformation.state === UploadState.IDLE &&
                        <div>
                            <label 
                                htmlFor="directoryInput"
                                className={styles.selectLabel}
                            >Select a directory</label>
                            <input 
                                type="file" 
                                id="directoryInput"
                                {...{ webkitdirectory: '', mozdirectory: '', directory: '' }}
                                style={{ display: "none" }}
                                onChange={ev => {
                                    if(ev.target.files && ev.target.files.length === 1) {
                                        
                                    }
                                }}
                            >
                            </input>
                        </div>
                    }
                    {uploadInformation.errorMessage}
                </p>
            </div>
        </div>

        
        <Controls
            uploadInformation={uploadInformation}
            onLoad={() => {
                if(draftSession) {
                    addLogSession(draftSession);
                    setUploadInformation({state: UploadState.IDLE});
                    setDraftSession(undefined);
                }
            }}
            onRemove={() => {
                setUploadInformation({state: UploadState.IDLE});
                setDraftSession(undefined);
            }}
        />

        </div>
    )
}

/**
 * The function `validateEntry` checks if only one directory is selected from a list of files.
 * @param {DataTransferItemList} files - The `files` parameter in the `validateEntry` function is of
 * type `DataTransferItemList`, which represents a list of items.
 */
function validateEntry(files: DataTransferItemList) {
    if(files.length != 1) throw new Error("Only one file or directory is allowed");
    let file = files[0].webkitGetAsEntry();
    if(!file) throw new Error("Invalid file");
    if(!file.isDirectory) throw new Error("Only directories are allowed");
}