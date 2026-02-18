import styles from "./ReceiveTable.module.scss";
import { BoardView } from "./BoardView/BoardView";
import { Header } from "./Header/Header";
import { TableUpdater } from "./TableUpdater";
import { Board, useMeasurementsStore} from "common";

type Props = {
    boards: Board[];
};

export const ReceiveTable = ({ boards }: Props) => {
    const handleLogAll = (log: boolean) => {
        useMeasurementsStore.getState().setLogAll(log);
    };
    
    const handleShowAllLatest = (showLatest: boolean) => {
        useMeasurementsStore.getState().setShowAllLatest(showLatest);
    };
    return (
        <TableUpdater>
            <div className={styles.newReceiveTable}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 12, gap: 6 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            onClick={() => handleLogAll(true)}
                            style={{ background: 'green', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                        >
                            Log all
                        </button>
                        <button
                            onClick={() => handleLogAll(false)}
                            style={{ background: '#aaa', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                        >
                            Log none
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            onClick={() => handleShowAllLatest(true)}
                            style={{ background: 'blue', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                        >
                            Latest all
                        </button>
                        <button
                            onClick={() => handleShowAllLatest(false)}
                            style={{ background: '#aaa', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                        >
                            Average all
                        </button>
                    </div>
                </div>
                <Header items={["ID", "NAME", "COUNT", "CYCLE (ns)"]} />
                <div className={styles.boards}>
                    {boards
                        .filter((item) => item.packets.length > 0)
                        .map((board) => {
                            return (
                                <BoardView
                                    key={board.name}
                                    board={board}
                                />
                            );
                        })}
                </div>
            </div>
        </TableUpdater>
    );
};
