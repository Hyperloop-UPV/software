import { Outlet } from 'react-router-dom';
import 'styles/global.scss';
import 'styles/scrollbars.scss';
import styles from './App.module.scss';
import { Sidebar } from 'components/Sidebar/Sidebar';
import { ReactComponent as Wheel } from 'assets/svg/wheel.svg';
import { ReactComponent as Cabinet } from  'assets/svg/cabinet.svg';
import { ReactComponent as Cameras } from 'assets/svg/cameras.svg';
import { ReactComponent as TeamLogo } from 'assets/svg/team_logo.svg';
import { ReactComponent as Batteries } from 'assets/svg/battery-filled.svg'
import { SplashScreen, WsHandlerProvider, useLoadBackend } from 'common';
import { useEffect } from 'react';

const FlashIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

export const App = () => {
    const isProduction = import.meta.env.PROD;
    const loadBackend = useLoadBackend(isProduction);
    
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    return (
        <div className={styles.appWrapper}>
            {loadBackend.state === 'fulfilled' && (
                <WsHandlerProvider handler={loadBackend.wsHandler}>
                    <Sidebar
                        items={[
                            { path: '/vehicle', icon: <Wheel /> },
                            { path: '/booster', icon: <Cabinet /> },
                            { path: '/batteries', icon: <Batteries /> },
                            { path: '/cameras', icon: <Cameras /> },
                            { path: '/flash', icon: <FlashIcon /> }
                        ]}
                    />
                    <Outlet />
                </WsHandlerProvider>
            )}
            {loadBackend.state === 'pending' && (
                <SplashScreen>
                    <TeamLogo />
                </SplashScreen>
            )}
            {loadBackend.state === 'rejected' && (
                <div>{`${loadBackend.error}`}</div>
            )}
        </div>
    );
};
