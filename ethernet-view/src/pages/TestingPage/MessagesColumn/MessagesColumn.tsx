import styles from "pages/TestingPage/MessagesColumn/MessagesColumn.module.scss";
import { SplitLayout } from "layouts/SplitLayout/SplitLayout";
import { Orientation } from "hooks/useSplit/Orientation";
import { TabLayout } from "layouts/TabLayout/TabLayout";
import { BiLineChart } from "react-icons/bi";
import { nanoid } from "nanoid";
import { MessagesContainer } from "components/MessagesContainer/MessagesContainer";
import { Logger } from "components/Logger/Logger";
import { useRef } from "react";
import { Connections } from "common";
import { BootloaderContainer } from "components/BootloaderContainer/BootloaderContainer";
import letter from "assets/svg/letter.svg"
import connection from "assets/svg/connection.svg"

export const MessagesColumn = () => {
    const messagesTabItems = useRef([
        {
            id: nanoid(),
            name: "Messages",
            icon: <BiLineChart />,

            component: <MessagesContainer />,
        },
    ]);

    const connectionsTabItems = useRef([
        {
            id: nanoid(),
            name: "Connections",
            icon: <BiLineChart />,

            component: <Connections />,
        }
    ])

    return (
        <div className={styles.messageColumnWrapper}>
            <SplitLayout
                components={[
                    {
                        component: <TabLayout tabs={messagesTabItems.current}></TabLayout>,
                        collapsedIcon: letter,
                    },
                    {
                        component: <TabLayout tabs={connectionsTabItems.current}></TabLayout>,
                        collapsedIcon: connection,
                    },
                ]}
                orientation={Orientation.VERTICAL}
            ></SplitLayout>
            <Logger />
            <BootloaderContainer />
        </div>
    );
};
