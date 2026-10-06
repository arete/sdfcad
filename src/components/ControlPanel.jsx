import React from 'react';

const SHAPES = [
    { id: 0, label: 'Sfera' },
    { id: 1, label: 'Cubo' },
    { id: 2, label: 'Toro' },
];

const OPS = [
    { id: 0, label: 'Unione' },
    { id: 1, label: 'Intersezione' },
    { id: 2, label: 'Sottrazione' },
    { id: 3, label: 'Morbida' },
];

const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function Segmented({ options, value, onChange }) {
    return (
        <div className="segmented">
            {options.map((o) => (
                <button key={o.id}
                    className={o.id === value ? 'active' : ''}
                    onClick={() => onChange(o.id)}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function ControlPanel({ config, onChange }) {
    return (
        <aside className="panel">
            <h2>Solido A</h2>
            <Segmented options={SHAPES} value={config.shapeA}
                onChange={(shapeA) => onChange({ shapeA })} />
            <label>Colore A
                <input type="color" value="#f26666"
                    onChange={(e) => onChange({ colorA: hexToRgb(e.target.value) })} />
            </label>

            <h2>Solido B</h2>
            <Segmented options={SHAPES} value={config.shapeB}
                onChange={(shapeB) => onChange({ shapeB })} />
            <label>Colore B
                <input type="color" value="#6699f2"
                    onChange={(e) => onChange({ colorB: hexToRgb(e.target.value) })} />
            </label>

            <h2>Operazione booleana</h2>
            <Segmented options={OPS} value={config.operation}
                onChange={(operation) => onChange({ operation })} />

            <label>Distanza tra i solidi
                <input type="range" min="0" max="1" step="0.01"
                    value={config.separation}
                    onChange={(e) => onChange({ separation: +e.target.value })} />
            </label>

            {config.operation === 3 && (
                <label>Raggio di fusione
                    <input type="range" min="0.05" max="1" step="0.01"
                        value={config.blend}
                        onChange={(e) => onChange({ blend: +e.target.value })} />
                </label>
            )}

            <label className="checkbox">
                <input type="checkbox" checked={config.autoRotate}
                    onChange={(e) => onChange({ autoRotate: e.target.checked })} />
                Rotazione automatica
            </label>

            <p className="hint">🖱️ Trascina per orbitare · rotella per lo zoom</p>
        </aside>
    );
}