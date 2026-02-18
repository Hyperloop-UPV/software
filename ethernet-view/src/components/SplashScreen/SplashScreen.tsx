import styles from './SplashScreen.module.scss';
import { animated, useSpring } from '@react-spring/web';

// TODO: change for common front SplashScreen
export const SplashScreen = () => {
    const springs = useSpring({
        from: { fontSize: '0rem' },
        to: { fontSize: '16rem' },
        config: {
            mass: 5,
        },
        delay: 150,
    });

    return (
        <div className={styles.loadingView}>
            <animated.div className={styles.monkey} style={{ ...springs }}>
                🐒
            </animated.div>
        </div>
    );
};
