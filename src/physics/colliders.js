export function createCollisionWorld() {
  const circles = [];

  return {
    addCircle(x, z, radius) {
      circles.push({ x, z, radius });
    },
    resolve(x, z, radius) {
      let resolvedX = x;
      let resolvedZ = z;
      let normalX = 0;
      let normalZ = 0;
      let hit = false;

      for (let iteration = 0; iteration < 2; iteration += 1) {
        for (let i = 0; i < circles.length; i += 1) {
          const circle = circles[i];
          let dx = resolvedX - circle.x;
          let dz = resolvedZ - circle.z;
          const minimumDistance = radius + circle.radius;
          let distance = Math.hypot(dx, dz);

          if (distance >= minimumDistance) {
            continue;
          }

          if (distance < 0.0001) {
            dx = 1;
            dz = 0;
            distance = 1;
          }

          const push = minimumDistance - distance;
          normalX += dx / distance;
          normalZ += dz / distance;
          resolvedX += (dx / distance) * push;
          resolvedZ += (dz / distance) * push;
          hit = true;
        }
      }

      if (hit) {
        const length = Math.hypot(normalX, normalZ) || 1;
        normalX /= length;
        normalZ /= length;
      }

      return { x: resolvedX, z: resolvedZ, normalX, normalZ, hit };
    },
  };
}
