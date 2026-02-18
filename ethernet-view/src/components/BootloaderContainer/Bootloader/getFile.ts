import { DragEvent } from "react";

function isCorrectFormat(fileName: string, fileFormat: string): boolean {
    return fileName.endsWith(`.${fileFormat}`);
}

export function getFile(
    ev: DragEvent<HTMLDivElement>,
    format: string
): File | null {
    ev.preventDefault();

    if (ev.dataTransfer.items) {
        return handleFileWithDataTransferItems(ev, format);
    } else {
        return handleFileWidthDataTransferFiles(ev);
    }
}

function handleFileWithDataTransferItems(
    ev: DragEvent<HTMLDivElement>,
    format: string
): File | null {
    if (ev.dataTransfer.items.length > 1 || ev.dataTransfer.items.length < 1) {
        console.error("Expected one file");
        return null;
    } else if (ev.dataTransfer.items[0].kind !== "file") {
        console.error("Dropped item is not file");
        return null;
    } else if (
        !isCorrectFormat(
            [...ev.dataTransfer.items][0].getAsFile()!.name,
            format
        )
    ) {
        const fileName = [...ev.dataTransfer.items][0].getAsFile()!.name;
        const extension = fileName.substring(fileName.lastIndexOf("."));

        console.error(
            `Incorrect file format: expected "${format}" got "${extension}"`
        );
        return null;
    } else {
        return [...ev.dataTransfer.items][0].getAsFile()!;
    }
}

function handleFileWidthDataTransferFiles(
    ev: DragEvent<HTMLDivElement>
): File | null {
    if (ev.dataTransfer.files.length > 1 || ev.dataTransfer.files.length < 1) {
        console.error("Expected one file");
        return null;
    } else {
        return [...ev.dataTransfer.files][0];
    }
}
