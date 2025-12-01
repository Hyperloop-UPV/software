import styles from "./Navbar.module.scss";
import { NavbarItem, NavbarItemData } from "./NavbarItem/NavbarItem";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import { ConfigPopup } from "components/ConfigPopup/ConfigPopup";
import { useState } from "react";

type Props = {
  items: NavbarItemData[];
  pageShown: string;
  setPageShown: (page: string) => void;
};

export const Navbar = ({ items, pageShown, setPageShown }: Props) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  return (
    <nav className={styles.navbarWrapper}>
      <div className={styles.separator} />
      <div className={styles.items}>
        {items.map((item, index) => {
          return (
            <NavbarItem
              key={index}
              item={item}
              pageShown={pageShown}
              setPageShown={setPageShown}
            />
          );
        })}
      </div>
      <div className={styles.spacer} />

      <button onClick={() => setIsConfigOpen(true)}>Cnfg</button>
      <ConfigPopup
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <ThemeToggle />
    </nav>
  );
};
