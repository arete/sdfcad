import { useEffect, useRef } from 'react';
import { SDFEngine } from '../engine/sdf-engine';

/**
 * Motore di rendering SDF come componente React.
 *
 * @param {object} config   - shapeA, shapeB, operation, blend, separation,
 *                            colorA, colorB, autoRotate, speed
 */
export default function SDFCanvas({ config, className = '' }) {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // Mount / unmount del motore (una sola volta)
    useEffect(() => {
        let mounted = true;
        // Ritardiamo leggermente l'inizializzazione del motore per assicurarci
        // che il browser abbia il tempo di disegnare l'interfaccia (il pannello di controllo)
        const timerId = setTimeout(() => {
            if (!mounted) return;
            try {
                engineRef.current = new SDFEngine(canvasRef.current, config);
                engineRef.current.start();
            } catch (err) {
                console.error('[SDFCanvas]', err.message);
            }
        }, 10);

        return () => {
            mounted = false;
            clearTimeout(timerId);
            engineRef.current?.dispose();
            engineRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Propagazione dichiarativa della configurazione
    useEffect(() => {
        engineRef.current?.setConfig(config);
    }, [config]);

    return <canvas ref={canvasRef} className={`sdf-canvas ${className}`} />;
}
