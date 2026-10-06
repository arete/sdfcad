import { useState } from 'react';
import SDFCanvas from './components/SDFCanvas';
import ControlPanel from './components/ControlPanel';
import './styles/app.css';

export default function App() {
    const [config, setConfig] = useState({
        shapeA: 0,            // sfera
        shapeB: 1,            // cubo
        operation: 1,         // intersezione
        blend: 0.35,
        separation: 0.55,
        colorA: [0.95, 0.4, 0.4],
        colorB: [0.4, 0.6, 0.95],
        autoRotate: true,
        speed: 0.25,
    });

    const patch = (p) => setConfig((c) => ({ ...c, ...p }));

    return (
        <div className="app">
            <header>
                <h1>Motore SDF · CSG su GPU</h1>
            </header>
            <main>
                <SDFCanvas config={config} />
                <ControlPanel config={config} onChange={patch} />
            </main>
        </div>
    );
}
