import { useId } from "react";

type Props = {
    label: string;
    accept: string;
    onFile: (file: File) => void;
    className: string;
    children?: React.ReactNode;
};

export const FileInput = ({ accept, className, label, onFile }: Props) => {
    const id = useId();

    return (
        <>
            <label
                htmlFor={id}
                className={className}
                style={{ cursor: "pointer" }}
            >
                {label}
            </label>
            <input
                id={id}
                type="file"
                style={{ display: "none" }}
                accept={accept}
                onChange={(ev) => {
                    if (ev.target.files) onFile(ev.target.files[0]);
                }}
            />
        </>
    );
};
