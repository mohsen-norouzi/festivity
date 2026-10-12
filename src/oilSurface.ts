/** Flowing oil lobes, pinching liquid necks, and a cap that conforms to its host. */
export const oilVertex = `
  attribute vec2 fragmentFinish;
  attribute vec4 liquidState;
  attribute vec4 oilMotion;
  attribute vec3 surfaceAnchor;
  attribute vec3 surfaceShape;
  varying vec2 vFragmentFinish;
  vec3 liquidNormal(vec3 p, vec3 halfSize, float power) {
    return normalize(sign(p) * pow(max(abs(p / halfSize), vec3(0.00001)), vec3(power - 1.0)) / halfSize);
  }
  vec3 flowingDrop(vec3 p) {
    float phase = oilMotion.x + oilMotion.y * 8.0;
    float a = oilMotion.z;
    float taper = 1.0 + a * (0.65 * sin(phase) * p.y + 0.45 * cos(phase * 0.71 + p.y * 3.5));
    float bend = (1.0 - p.y * p.y) * a;
    return vec3(
      p.x * taper * (1.0 + a * 0.35 * sin(phase * 0.8)) + bend * sin(phase + p.y * 2.0),
      p.y,
      p.z * taper * (1.0 - a * 0.35 * sin(phase * 0.8)) + bend * 0.65 * cos(phase * 0.7 + p.y * 2.3)
    );
  }
  float smoothOilUnion(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / max(k, 0.0000001);
    return max(a, b) + h * h * k * 0.25;
  }
  float strandRadius(float y) {
    float r1 = liquidState.x, r2 = liquidState.y, distance = liquidState.z;
    float low = -distance * 0.5 - r1, high = distance * 0.5 + r2;
    float u = clamp((y - low) / (high - low), 0.0, 1.0);
    float first = r1 * r1 - pow(y + distance * 0.5, 2.0);
    float second = r2 * r2 - pow(y - distance * 0.5, 2.0);
    float envelope = smoothstep(low, low + r1, y) * (1.0 - smoothstep(high - r2, high, y));
    float neck = min(r1, r2) * oilMotion.z * 1.5 * envelope * (1.0 + 0.16 * sin(u * 9.0 - oilMotion.y * 9.0 + oilMotion.x));
    float bridge = neck * neck;
    float field = smoothOilUnion(max(first, second), bridge, bridge * 0.8);
    float undulation = 1.0 + 0.13 * sin(oilMotion.x + u * 7.0 - oilMotion.y * 8.0) + 0.06 * cos(u * 11.0 + oilMotion.y * 5.0);
    return sqrt(max(field, 0.0)) * undulation;
  }
  vec3 liquidVertexPosition(vec3 sphere, out vec3 resultNormal) {
    if (liquidState.w < -0.5) {
      // One smooth mesh encloses both lobes and the thinning neck between them.
      float u = (sphere.y + 1.0) * 0.5;
      float low = -liquidState.z * 0.5 - liquidState.x;
      float high = liquidState.z * 0.5 + liquidState.y;
      float span = high - low, y = mix(low, high, u);
      vec2 radial = sphere.xz / max(0.00001, length(sphere.xz));
      float radius = strandRadius(y);
      float epsilon = max(0.0001, span * 0.001);
      float slope = (strandRadius(y + epsilon) - strandRadius(y - epsilon)) / (2.0 * epsilon);
      vec2 bend = surfaceAnchor.xz * sin(u * 3.14159265);
      vec2 bendSlope = surfaceAnchor.xz * cos(u * 3.14159265) * 3.14159265 / span;
      resultNormal = normalize(vec3(radial.x, -slope - dot(radial, bendSlope), radial.y));
      return vec3(radial.x * radius + bend.x, y, radial.y * radius + bend.y);
    }
    if (liquidState.w < 0.5) {
      // Recompute normals from the changing shape, so highlights flow with it.
      vec3 reference = abs(sphere.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 t = normalize(cross(reference, sphere)), b = cross(sphere, t);
      vec3 p = flowingDrop(sphere);
      vec3 du = flowingDrop(normalize(sphere + t * 0.003)) - p;
      vec3 dv = flowingDrop(normalize(sphere + b * 0.003)) - p;
      resultNormal = normalize(cross(du, dv));
      return p;
    }
    vec3 anchor = surfaceAnchor * surfaceShape;
    vec3 n = liquidNormal(anchor, surfaceShape, liquidState.w);
    vec3 reference = abs(n.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 baseT = normalize(cross(reference, n)), baseB = cross(n, baseT);
    vec3 t = baseT * cos(oilMotion.w) + baseB * sin(oilMotion.w);
    vec3 b = cross(n, t);
    float angle = atan(sphere.z, sphere.x);
    float edge = 1.0 + 0.035 * sin(angle * 3.0 + oilMotion.x + oilMotion.y * 1.1) + 0.02 * cos(angle * 5.0 - oilMotion.y * 0.7);
    vec3 p = anchor + t * sphere.x * liquidState.x * edge + b * sphere.z * liquidState.y * edge;
    vec3 q = pow(abs(p / surfaceShape), vec3(liquidState.w));
    p /= pow(q.x + q.y + q.z, 1.0 / liquidState.w);
    n = liquidNormal(p, surfaceShape, liquidState.w);
    resultNormal = normalize(t * sphere.x / liquidState.x + b * sphere.z / liquidState.y + n * sphere.y / liquidState.z);
    return p + n * (sphere.y + 0.035) * liquidState.z;
  }
`
