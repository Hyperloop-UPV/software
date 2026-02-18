import { Bootloader } from "./Bootloader/Bootloader";
import { useEffect, useState } from "react";
import { config, useFetchBack } from "common";

export const BootloaderContainer = () => {
    const [boards, setBoards] = useState<string[]>();
    const uploadableBoardsPromise = useFetchBack(
        import.meta.env.PROD,
        config.paths.uploadableBoards
    );
    useEffect(() => {
        uploadableBoardsPromise.then((value: string[]) => {
            setBoards(value);
        });
    }, []);

    if (boards) {
        return <Bootloader boards={boards} />;
    } else {
        return <>Fetching boards...</>;
    }
};
