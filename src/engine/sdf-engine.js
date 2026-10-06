import { VERT_SRC, FRAG_SRC } from './shaders.js';

const DEFAULT_CONFIG = {
    shapeA: 0,            // 0 sfera, 1 cubo, 2 toro
    shapeB: 1,
    operation: 1,         // 0 unione, 1 intersezione, 2 sottrazione, 3 smooth
    blend: 0.35,
    separation: 0.55,
    colorA: [0.95, 0.4, 0.4],
    colorB: [0.4, 0.6, 0.95],
    autoRotate: true,
    speed: 0.25,          // rad/s
};

export class SDFEngine {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.yaw = 0.7;
        this.pitch = 0.35;
        this.dist = 4.6;
        this._pointer = null;
        this._raf = null;
        this._last = null;

        const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
        if (!gl) throw new Error('WebGL non disponibile su questo browser.');
        this.gl = gl;

        this._initGL();
        this._bindEvents();
        this._resize();
    }

    // ---------- setup ----------
    _initGL() {
        const { gl } = this;
        const prog = gl.createProgram();
        gl.attachShader(prog, this._compile(gl.VERTEX_SHADER, VERT_SRC));
        gl.attachShader(prog, this._compile(gl.FRAGMENT_SHADER, FRAG_SRC));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('Link shader fallito: ' + gl.getProgramInfoLog(prog));
        }
        gl.useProgram(prog);
        this.program = prog;

        // Fullscreen quad (triangle strip)
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'aPosition');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        // Cache delle location degli uniform
        this.u = {};
        for (const n of ['uResolution', 'uTime', 'uYaw', 'uPitch', 'uDist',
                         'uShapeA', 'uShapeB', 'uOperation', 'uBlend',
                         'uSeparation', 'uColorA', 'uColorB']) {
            this.u[n] = gl.getUniformLocation(prog, n);
        }
    }

    _compile(type, src) {
        const { gl } = this;
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src.trim());
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            throw new Error('Compilazione shader fallita:\n' + log);
        }
        return sh;
    }

    // ---------- input: orbit camera ----------
    _bindEvents() {
        const c = this.canvas;
        c.addEventListener('pointerdown', (e) => {
            this._pointer = { x: e.clientX, y: e.clientY };
            c.setPointerCapture(e.pointerId);
        });
        c.addEventListener('pointermove', (e) => {
            if (!this._pointer) return;
            this.yaw   -= (e.clientX - this._pointer.x) * 0.008;
            this.pitch  = Math.min(1.45, Math.max(-0.12,
                          this.pitch + (e.clientY - this._pointer.y) * 0.008));
            this._pointer = { x: e.clientX, y: e.clientY };
        });
        const end = () => (this._pointer = null);
        c.addEventListener('pointerup', end);
        c.addEventListener('pointercancel', end);
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.dist = Math.min(9, Math.max(2.4, this.dist + e.deltaY * 0.002));
        }, { passive: false });

        this._ro = new ResizeObserver(() => this._resize());
        this._ro.observe(c);
    }

    _resize() {
        const c = this.canvas;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(c.clientWidth * dpr));
        const h = Math.max(1, Math.floor(c.clientHeight * dpr));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        this.gl.viewport(0, 0, w, h);
    }

    // ---------- API pubblica ----------
    setConfig(partial) {
        Object.assign(this.config, partial);
    }

    start() {
        if (this._raf) return;
        const loop = (now) => {
            this._raf = requestAnimationFrame(loop);
            this._frame(now);
        };
        this._raf = requestAnimationFrame(loop);
    }

    stop() {
        cancelAnimationFrame(this._raf);
        this._raf = null;
    }

    dispose() {
        this.stop();
        this._ro?.disconnect();
        this.gl?.deleteProgram(this.program);
    }

    // ---------- rendering ----------
    _frame(now) {
        const dt = Math.min(0.05, (now - (this._last ?? now)) / 1000);
        this._last = now;
        this._resize();

        const { gl, u, config } = this;
        if (config.autoRotate && !this._pointer) this.yaw += config.speed * dt;

        gl.uniform2f(u.uResolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(u.uTime, now / 1000);
        gl.uniform1f(u.uYaw, this.yaw);
        gl.uniform1f(u.uPitch, this.pitch);
        gl.uniform1f(u.uDist, this.dist);
        gl.uniform1i(u.uShapeA, config.shapeA);
        gl.uniform1i(u.uShapeB, config.shapeB);
        gl.uniform1i(u.uOperation, config.operation);
        gl.uniform1f(u.uBlend, config.blend);
        gl.uniform1f(u.uSeparation, config.separation);
        gl.uniform3fv(u.uColorA, config.colorA);
        gl.uniform3fv(u.uColorB, config.colorB);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
