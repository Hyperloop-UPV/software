import { Board } from "common";
import styles from "./BoardView.module.scss";
import { PacketView } from "./PacketView/PacketView";
import { useState } from "react";
import { Header } from "./Header/Header";

type Props = {
    board: Board;
};

export const BoardView = ({ board }: Props) => {
    const [open, setOpen] = useState(false);

    return (
        <div className={styles.boardView}>
            <Header
                name={board.name}
                open={open}
                onClick={() => setOpen((prev) => !prev)}
            ></Header>
            {open &&
                board.packets.map((packet) => {
                    return (
                        <PacketView
                            key={packet.id}
                            packet={packet}
                        />
                    );
                })}
        </div>
    );
};
