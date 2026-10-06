export const VERT_SRC = `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const FRAG_SRC = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2  uResolution;
uniform float uTime;
uniform float uYaw;          // orbita camera
uniform float uPitch;
uniform float uDist;
uniform int   uShapeA;       // 0=sfera  1=cubo  2=toro
uniform int   uShapeB;
uniform int   uOperation;    // 0=unione 1=intersezione 2=sottrazione 3=smooth
uniform float uBlend;        // raggio fusione (smooth union)
uniform float uSeparation;   // distanza tra i due solidi
uniform vec3  uColorA;
uniform vec3  uColorB;

#define MAX_STEPS 96
#define MAX_DIST  30.0
#define SURF_EPS  0.0015

// ---------------- PRIMITIVE SDF ----------------
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdPlaneY(vec3 p, float h) {
    return p.y - h;
}

// ---------------- OPERATORI CSG ----------------
float opUnion(float d1, float d2)      { return min(d1, d2); }
float opIntersect(float d1, float d2)  { return max(d1, d2); }
float opSubtract(float d1, float d2)   { return max(-d1, d2); }   // d2 - d1
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// ---------------- SCENA ----------------
// Ritorna vec2(distanza, materiale): 0=pavimento, 1=solido A, 2=solido B
vec2 map(vec3 p) {
    vec3 pa = p - vec3(-uSeparation,  0.22 * sin(uTime), 0.0);
    vec3 pb = p - vec3( uSeparation, -0.22 * sin(uTime), 0.0);

    float dA = uShapeA == 0 ? sdSphere(pa, 1.0)
             : uShapeA == 1 ? sdBox(pa, vec3(0.75))
             :                sdTorus(pa, vec2(0.85, 0.35));

    float dB = uShapeB == 0 ? sdSphere(pb, 1.0)
             : uShapeB == 1 ? sdBox(pb, vec3(0.75))
             :                sdTorus(pb, vec2(0.85, 0.35));

    float d, m;
    if (uOperation == 0) {                        // unione
        d = opUnion(dA, dB);       m = dA < dB ? 1.0 : 2.0;
    } else if (uOperation == 1) {                 // intersezione
        d = opIntersect(dA, dB);   m = dA > dB ? 1.0 : 2.0;
    } else if (uOperation == 2) {                 // sottrazione A − B
        d = opSubtract(dB, dA);    m = -dB > dA ? 2.0 : 1.0;
    } else {                                      // unione morbida
        float k = max(uBlend, 0.0001);
        d = opSmoothUnion(dA, dB, k);
        m = 1.0 + clamp(0.5 + 0.5 * (dB - dA) / k, 0.0, 1.0);
    }

    float ground = sdPlaneY(p, -1.4);
    if (ground < d) { d = ground; m = 0.0; }
    return vec2(d, m);
}

// ---------------- RAYMARCHING ----------------
vec2 march(vec3 ro, vec3 rd) {
    float t = 0.0;
    float m = -1.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        vec2 h = map(ro + rd * t);
        if (h.x < SURF_EPS) { m = h.y; break; }
        t += h.x;
        if (t > MAX_DIST) { m = -1.0; break; }
    }
    return vec2(t, m);
}

float softShadow(vec3 ro, vec3 rd) {
    float res = 1.0;
    float t = 0.02;
    for (int i = 0; i < 48; i++) {
        float h = map(ro + rd * t).x;
        res = min(res, 10.0 * h / t);
        t += clamp(h, 0.02, 0.25);
        if (res < 0.005 || t > 15.0) break;
    }
    return clamp(res, 0.0, 1.0);
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0015, 0.0);
    return normalize(vec3(
        map(p + e.xyy).x - map(p - e.xyy).x,
        map(p + e.yxy).x - map(p - e.yxy).x,
        map(p + e.yyx).x - map(p - e.yyx).x
    ));
}

vec3 matColor(float m) {
    if (m <= 0.5) return vec3(0.86, 0.87, 0.9);   // pavimento
    // m ∈ [1,2]: interpola i due materiali (utile per la smooth union)
    return mix(uColorA, uColorB, clamp(m - 1.0, 0.0, 1.0));
}

vec3 render(vec3 ro, vec3 rd) {
    vec3 sky = vec3(0.75, 0.82, 0.92);
    sky = mix(sky, vec3(1.0), 0.25 * clamp(1.0 - rd.y, 0.0, 1.0));

    vec2 hit = march(ro, rd);
    if (hit.y < -0.5) return sky;                 // nessuna intersezione

    vec3 p    = ro + rd * hit.x;
    vec3 n    = calcNormal(p);
    vec3 base = matColor(hit.y);

    vec3  lightDir = normalize(vec3(0.6, 0.9, 0.35));
    float dif = clamp(dot(n, lightDir), 0.0, 1.0)
              * softShadow(p + n * 0.02, lightDir);
    float amb = 0.55 + 0.45 * n.y;
    float spe = pow(clamp(dot(reflect(rd, n), lightDir), 0.0, 1.0), 40.0);

    vec3 col = base * (amb * vec3(0.55, 0.6, 0.68) + dif * vec3(1.0, 0.95, 0.85))
             + spe * 0.35;

    // foschia in distanza
    return mix(col, sky, 1.0 - exp(-0.02 * hit.x * hit.x));
}

vec3 orbitPos(float yaw, float pitch, float dist) {
    float cp = cos(pitch);
    return vec3(dist * cp * sin(yaw), dist * sin(pitch), dist * cp * cos(yaw));
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
    vec3 ro = orbitPos(uYaw, uPitch, uDist);
    vec3 ta = vec3(0.0, -0.1, 0.0);
    vec3 fw = normalize(ta - ro);
    vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fw);
    vec3 rd = normalize(uv.x * rt + uv.y * up + 1.6 * fw);

    vec3 col = render(ro, rd);
    col = col / (col + 0.9);            // tonemap semplice
    col = pow(col, vec3(0.4545));       // correzione gamma
    gl_FragColor = vec4(col, 1.0);
}
`;