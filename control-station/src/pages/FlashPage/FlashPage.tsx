import { useEffect } from 'react';

export const FlashPage = () => {
    useEffect(() => {
        if ((window as any).electronAPI?.switchView) {
            (window as any).electronAPI.switchView('flashing-view');
        }
    }, []);

    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100vh',
            width: '100%',
            color: 'var(--text-color)'
        }}>
            <p>Opening flashing view...</p>
        </div>
    );
};
