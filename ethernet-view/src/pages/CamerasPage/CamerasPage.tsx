import { Button, LiveStreamPlayer, TextInput } from 'common';
import styles from './CamerasPage.module.scss';
import { useState } from 'react';

export const CamerasPage = () => {
    const [cameras, setCameras] = useState<Map<number, string>>(new Map());
    const [cameraLeftURL, setCameraLeftURL] = useState<string>('');
    const [cameraRightURL, setCameraRightURL] = useState<string>('');

    const handleSetCamera = (cameraId: number, cameraURL: string) => () => {
        setCameras((prev) => new Map(prev).set(cameraId, cameraURL));
    };

    return (
        <div className={styles.camerasPage}>
        <div className={styles.camerasRow}>
            <div className={styles.cameraColumn}>
            <div className={styles.cameraInput}>
                <TextInput
                    isValid={true}
                    placeholder='Camera 1 URL'
                    value={cameraLeftURL}
                    onChange={(e) => setCameraLeftURL(e.target.value)}
                />
                <Button onClick={handleSetCamera(1, cameraLeftURL)} label='Set Camera' />
            </div>
                <LiveStreamPlayer src={cameras.get(1) || ''} />
            </div>

            <div className={styles.cameraColumn}>
            <div className={styles.cameraInput}>
                <TextInput
                    isValid={true}
                    placeholder='Camera 2 URL'
                    value={cameraRightURL}
                    onChange={(e) => setCameraRightURL(e.target.value)}
                />
                <Button onClick={handleSetCamera(2, cameraRightURL)} label='Set Camera' />
            </div>
                <LiveStreamPlayer src={cameras.get(2) || ''} />
            </div>
        </div>
        </div>
    );
};
