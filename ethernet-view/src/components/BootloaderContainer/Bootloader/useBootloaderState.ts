import { BootloaderViewState } from "./BootloaderViewState";
import { useState } from "react";
import { useBootloader } from "services/useBootloader";

export function useBootloaderState() {
    const [state, setState] = useState<BootloaderViewState>({ kind: "empty" });

    const { uploader, downloader } = useBootloader(
        onSuccess,
        onFailure,
        onSuccess,
        onFailure,
        onProgress
    );

    function upload(board: string, file: File) {
        file.arrayBuffer().then((data) => {
            uploader(
                board,
                window.btoa(Array.from(new Uint8Array(data), (x) => String.fromCodePoint(x)).join(""))
            );
        });
    }

    function download(board: string) {
        downloader(board);
        setState({ kind: "awaiting", progress: 0 });
    }

    function onSuccess() {
        setState({ kind: "success" });
        setTimeout(() => {
            setState(() => {
                return { kind: "empty" };
            });
        }, 1000);
    }

    function onFailure() {
        setState({ kind: "failure" });
        setTimeout(() => {
            setState(() => {
                return { kind: "empty" };
            });
        }, 1000);
    }

    function onProgress(progress: number) {
        setState({ kind: "awaiting", progress: progress });
    }

    function removeFile() {
        setState({ kind: "empty" });
    }

    function setFile(file: File) {
        setState({ kind: "send", file: file });
    }

    return [state, upload, download, setFile, removeFile] as const;
}
