export function createCollisionWorld() {
  const circles = [];

  return {
    addCircle(x, z, radius, topY = Number.POSITIVE_INFINITY) {
      circles.push({ x, z, radius, topY });
    },
    resolve(x, z, radius, feetY = 0) {
      let resolvedX = x;
      let resolvedZ = z;
      let normalX = 0;
      let normalZ = 0;
      let hit = false;

      for (let iteration = 0; iteration < 2; iteration += 1) {
        for (let i = 0; i < circles.length; i += 1) {
          const circle = circles[i];

          if (feetY >= circle.topY - 0.06) {
            continue;
          }

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
    getSupportHeight(x, z, feetY, radius = 0) {
      let support = Number.NEGATIVE_INFINITY;

      for (let i = 0; i < circles.length; i += 1) {
        const circle = circles[i];
        if (!Number.isFinite(circle.topY)) {
          continue;
        }
        if (feetY < circle.topY - 0.06) {
          continue;
        }
        if (Math.hypot(x - circle.x, z - circle.z) > circle.radius + radius) {
          continue;
        }
        support = Math.max(support, circle.topY);
      }

      return support;
    },
  };
}
