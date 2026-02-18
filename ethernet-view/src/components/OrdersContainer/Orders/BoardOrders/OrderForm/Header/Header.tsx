import styles from './Header.module.scss';
import { useState, useEffect } from 'react';
import { Button } from 'components/FormComponents/Button/Button';
import { Caret } from 'components/Caret/Caret';
import { SpringValue, animated } from '@react-spring/web';
import { ReactComponent as Target } from 'assets/svg/target.svg';

export type HeaderInfo = ToggableHeader | FixedHeader;

type ToggableHeader = {
    type: 'toggable';
    isOpen: boolean;
    toggleDropdown: () => void;
};

type FixedHeader = {
    type: 'fixed';
};

type Props = {
    name: string;
    disabled: boolean;
    info: HeaderInfo;
    springs: Record<string, SpringValue>;
    onTargetClick: (state: boolean) => void;
    onButtonClick: () => void;
};

export const Header = ({
    name,
    disabled,
    info,
    springs,
    onTargetClick,
    onButtonClick,
}: Props) => {
    const [targetOn, setTargetOn] = useState(false);

    useEffect(() => {
        onTargetClick(targetOn);
    }, [targetOn]);

    return (
        <animated.div
            className={styles.headerWrapper}
            onClick={info.type == 'toggable' ? info.toggleDropdown : () => {}}
            style={{
                ...springs,
                cursor: info.type == 'toggable' ? 'pointer' : 'auto',
            }}
        >
            <Caret
                isOpen={info.type == 'toggable' ? info.isOpen : false}
                className={`${styles.caret} ${
                    info.type == 'toggable' ? styles.visible : styles.hidden
                }`}
            />
            <div className={styles.name}>{name}</div>
            <Target
                className={`${styles.target} ${
                    targetOn ? styles.targetVisible : ''
                }`}
                onClick={(ev) => {
                    ev.stopPropagation();
                    setTargetOn((prev) => {
                        return !prev;
                    });
                }}
            />
            <div className={styles.sendBtn}>
                <Button
                    label="send"
                    onClick={(ev) => {
                        onButtonClick();
                        ev.stopPropagation();
                    }}
                    disabled={disabled}
                />
            </div>
        </animated.div>
    );
};
