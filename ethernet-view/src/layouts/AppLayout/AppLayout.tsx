import styles from "./AppLayout.module.scss";
import Testing from "assets/svg/testing.svg";
// import Logger from "assets/svg/logger.svg";
// import Camera from "assets/svg/camera.svg";
import { Navbar } from "components/Navbar/Navbar";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  pageShown: string;
  setPageShown: (page: string) => void;
}

export const AppLayout = ({ children, pageShown, setPageShown }: Props) => {
  return (
    <div className={styles.appLayout}>
      <Navbar
        items={[
          {
            icon: Testing,
            page: "testing",
          },
          // {
          //     icon: Logger,
          //     page: "logger"
          // },
          // {
          //     icon: Camera,
          //     page: "cameras"
          // }
        ]}
        pageShown={pageShown}
        setPageShown={setPageShown}
      />
      {children}
    </div>
  );
};
