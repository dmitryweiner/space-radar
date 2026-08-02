import * as THREE from 'three';

const FONT_PX = 44;
const PADDING_PX = 12;
const FONT = `600 ${FONT_PX}px system-ui, -apple-system, 'Segoe UI', sans-serif`;

export interface LabelSprite {
  sprite: THREE.Sprite;
  /** width / height of the label texture, used to keep text un-stretched. */
  aspect: number;
  dispose(): void;
}

// A camera-facing text label drawn onto a canvas texture. Kept small and
// depth-tested so labels behind the globe are naturally hidden by the opaque
// Earth mesh — no manual occlusion math needed. The world-space scale is set
// per-frame by the scene (see earthScene) so the on-screen size stays constant
// regardless of zoom.
export function makeLabelSprite(text: string, color = '#e6ecff'): LabelSprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    // Fall back to an empty sprite; label text is non-essential decoration.
    const empty = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0 }));
    return { sprite: empty, aspect: 1, dispose: () => empty.material.dispose() };
  }

  context.font = FONT;
  const textWidth = context.measureText(text).width;
  canvas.width = Math.ceil(textWidth + PADDING_PX * 2);
  canvas.height = Math.ceil(FONT_PX + PADDING_PX * 2);

  // Re-set the font: resizing the canvas resets its 2D context state.
  context.font = FONT;
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(5, 7, 13, 0.72)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.fillText(text, PADDING_PX, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(aspect, 1, 1);

  return {
    sprite,
    aspect,
    dispose() {
      material.dispose();
      texture.dispose();
    },
  };
}
