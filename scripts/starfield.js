export function createStarfieldTexture(
  THREE,
  { size = 2048, starCount = 4500, baseColor = '#02010a' } = {}
) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < starCount; i += 1) {
    const radius = Math.random() * 1.6 + 0.2;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const hue = 200 + Math.random() * 80;
    const opacity = 0.2 + Math.random() * 0.8;
    ctx.fillStyle = `hsla(${hue}, 80%, 90%, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (Math.random() > 0.995) {
      const glowRadius = radius * 6;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      gradient.addColorStop(0, `hsla(${hue}, 90%, 80%, ${opacity * 0.7})`);
      gradient.addColorStop(1, 'rgba(2, 1, 10, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
