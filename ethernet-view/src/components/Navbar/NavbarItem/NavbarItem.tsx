import styles from "components/Navbar/NavbarItem/NavbarItem.module.scss";

export type NavbarItemData = {
    icon: string;
    page: string;
    
};

type Props = {
    item: NavbarItemData;
    pageShown: string;
    setPageShown: (page: string) => void;
};

export const NavbarItem = ({ item, pageShown, setPageShown }: Props) => {

    const handleClick = () => {
        setPageShown(item.page);
    }

    return (
        <div className={pageShown === item.page ? styles.active : ""}>
            <div className={styles.iconWrapper} onClick={handleClick}>
                <img src={item.icon} alt="icon" />
            </div>
        </div>
    );
};
