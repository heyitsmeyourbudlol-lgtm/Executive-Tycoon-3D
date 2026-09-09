/**
 * Lightweight post-processing stack without EffectComposer dependency.
 *
 * Sets renderer tone mapping, exposure, and color space. For "cinematic"
 * preset, adjusts fog, shadow softness, and emissive boosts on screens/lamps.
 *
 * Path tracing: stub via detectPathTraceSupport() + enablePathTraceStub().
 * Full progressive path tracer not implemented — approximated by darker
 * ambient, stronger fill/lamp, and higher roughness contrast.
 */

const QUALITY_PRESETS = {
  low: { exposure: 0.9, shadowSoftness: 0, fogNear: 30, fogFar: 55 },
  medium: { exposure: 1.0, shadowSoftness: 1, fogNear: 28, fogFar: 55 },
  high: { exposure: 1.05, shadowSoftness: 2, fogNear: 26, fogFar: 58 },
  cinematic: { exposure: 1.12, shadowSoftness: 3, fogNear: 24, fogFar: 52 },
};

/**
 * Check WebGPU availability for future path tracing.
 */
export function detectPathTraceSupport() {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator.gpu);
}

/**
 * Human-readable description of graphics mode.
 */
export function describeGfxMode(mode) {
  switch (mode) {
    case 'low':
      return 'Low — reduced shadows, standard tone mapping';
    case 'medium':
      return 'Medium — balanced shadows and ACES tone mapping';
    case 'high':
      return 'High — full-res shadows, ACES filmic output';
    case 'cinematic':
      return 'Cinematic — boosted emissives, softer fog, filmic exposure';
    case 'pathtrace':
      return 'RT-look (stub) — approximated lighting, not progressive path tracing';
    default:
      return `Unknown mode: ${mode}`;
  }
}

/**
 * @param {typeof THREE} THREE
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {string} [preset='medium']
 */
export function createPostStack(THREE, renderer, scene, camera, preset = 'medium') {
  const state = {
    preset,
    pathTraceEnabled: false,
    emissiveTargets: [],
  };

  function applyRendererSettings() {
    const p = QUALITY_PRESETS[state.preset] || QUALITY_PRESETS.medium;

    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    }
    renderer.toneMappingExposure = p.exposure;

    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    if (scene.fog) {
      scene.fog.near = p.fogNear;
      scene.fog.far = p.fogFar;
    }

    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      if (state.preset === 'cinematic' || state.preset === 'high') {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      } else {
        renderer.shadowMap.type = THREE.PCFShadowMap;
      }
    }
  }

  function registerEmissive(mesh) {
    if (mesh && !state.emissiveTargets.includes(mesh)) {
      state.emissiveTargets.push(mesh);
    }
  }

  function boostEmissives(factor) {
    state.emissiveTargets.forEach((mesh) => {
      const mat = mesh.material;
      if (!mat) return;
      if (mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = factor;
      }
      if (mat.emissive) {
        mat.needsUpdate = true;
      }
    });
  }

  function setPreset(next) {
    state.preset = next;
    applyRendererSettings();

    if (next === 'cinematic') {
      boostEmissives(0.6);
      if (scene.fog) {
        scene.fog.near = 22;
        scene.fog.far = 48;
      }
    } else {
      boostEmissives(next === 'high' ? 0.4 : 0.35);
    }
  }

  /**
   * Path trace stub: sets flag and boosts lighting realism via ambient
   * occlusion simulation (darker ambient + stronger lamps). Full WebGPU
   * progressive path tracer to be wired when available.
   */
  function enablePathTraceStub() {
    if (!detectPathTraceSupport()) {
      console.warn('[postFx] WebGPU not available; path trace stub uses approximated lighting.');
    }
    state.pathTraceEnabled = true;
    state.preset = 'pathtrace';

    scene.traverse((obj) => {
      if (obj.isLight && obj.type === 'AmbientLight') {
        obj.intensity *= 0.65;
      }
      if (obj.isLight && obj.type === 'PointLight') {
        obj.intensity *= 1.4;
      }
    });

    renderer.toneMappingExposure = 1.18;
    boostEmissives(0.7);

    if (scene.fog) {
      scene.fog.near = 20;
      scene.fog.far = 45;
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  applyRendererSettings();

  return {
    state,
    setPreset,
    enablePathTraceStub,
    registerEmissive,
    render,
    applyRendererSettings,
  };
}
