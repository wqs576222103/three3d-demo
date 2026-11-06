import * as THREE from "three";
import { getTerrainHeight } from "./terrain.js";

// 茅草屋坐落在小坡（z=-6）与小河（z≈-50）之间，门朝北面向小河。
export const HUT_ORIGIN = { x: -8, z: -36 };

const HUT = {
  width: 9.0, // 沿 X
  depth: 7.8, // 沿 Z
  wallHeight: 3.5,
  wallThickness: 0.16,
  doorWidth: 1.8,
  doorHeight: 2.35,
  roofRise: 2.0,
  roofOverhang: 0.55,
  floorThickness: 0.3,
};

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildRoofGeometry(hw, hd, wallHeight, rise, overhang, ridgeHalf) {
  const eX = hw + overhang;
  const eZ = hd + overhang;
  const eY = wallHeight - 0.06;
  const rY = wallHeight + rise;
  const sw = new THREE.Vector3(-eX, eY, eZ);
  const se = new THREE.Vector3(eX, eY, eZ);
  const nw = new THREE.Vector3(-eX, eY, -eZ);
  const ne = new THREE.Vector3(eX, eY, -eZ);
  const rw = new THREE.Vector3(-ridgeHalf, rY, 0);
  const re = new THREE.Vector3(ridgeHalf, rY, 0);

  const verts = [];
  const tri = (a, b, c) => verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  tri(sw, se, re);
  tri(sw, re, rw);
  tri(nw, rw, re);
  tri(nw, re, ne);
  tri(sw, rw, nw);
  tri(se, ne, re);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildBed(materials) {
  const bed = new THREE.Group();
  const width = 1.4; // 沿 X
  const length = 2.05; // 沿 Z（床头在 -Z 一侧）

  bed.add(box(width, 0.24, length, materials.woodDark, 0, 0.2, 0));
  [
    [-width / 2 + 0.1, -length / 2 + 0.12],
    [width / 2 - 0.1, -length / 2 + 0.12],
    [-width / 2 + 0.1, length / 2 - 0.12],
    [width / 2 - 0.1, length / 2 - 0.12],
  ].forEach(([lx, lz]) => {
    bed.add(box(0.12, 0.2, 0.12, materials.woodDark, lx, 0.1, lz));
  });
  bed.add(box(width, 0.66, 0.1, materials.woodDark, 0, 0.62, -length / 2 + 0.05));
  bed.add(box(width - 0.08, 0.22, length - 0.1, materials.mattress, 0, 0.42, 0.02));
  bed.add(box(0.54, 0.14, 0.34, materials.pillow, 0, 0.58, -length / 2 + 0.44));
  bed.add(box(width - 0.04, 0.13, length * 0.58, materials.blanket, 0, 0.56, length * 0.17));

  return bed;
}

export function createHut(collisionWorld, position = HUT_ORIGIN) {
  const groundY = getTerrainHeight(position.x, position.z);
  const floorY = groundY + HUT.floorThickness;

  const group = new THREE.Group();
  group.position.set(position.x, floorY, position.z);

  const hw = HUT.width / 2;
  const hd = HUT.depth / 2;
  const t = HUT.wallThickness;

  const materials = {
    wood: new THREE.MeshStandardMaterial({ color: 0x9a7449, roughness: 0.95, flatShading: true }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x5e452e, roughness: 0.96, flatShading: true }),
    thatch: new THREE.MeshStandardMaterial({
      color: 0xc09a58,
      roughness: 1,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    floor: new THREE.MeshStandardMaterial({ color: 0x82603d, roughness: 1, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ color: 0x6d6659, roughness: 1, flatShading: true }),
    mattress: new THREE.MeshStandardMaterial({ color: 0xd9cdb4, roughness: 0.98, flatShading: true }),
    pillow: new THREE.MeshStandardMaterial({ color: 0xf0e9dc, roughness: 0.98, flatShading: true }),
    blanket: new THREE.MeshStandardMaterial({ color: 0x8c4a3a, roughness: 0.98, flatShading: true }),
    rug: new THREE.MeshStandardMaterial({ color: 0x9c6b4f, roughness: 1, flatShading: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.6, metalness: 0.4, flatShading: true }),
    flame: new THREE.MeshStandardMaterial({
      color: 0xffd79a,
      emissive: 0xffa638,
      emissiveIntensity: 2.4,
      roughness: 1,
    }),
  };

  // 地基裙边（埋入草地，遮住地形起伏）
  group.add(box(HUT.width + 0.6, 0.9, HUT.depth + 0.6, materials.stone, 0, -0.55, 0));
  // 木地板
  group.add(box(HUT.width + 0.06, HUT.floorThickness, HUT.depth + 0.06, materials.floor, 0, -HUT.floorThickness / 2, 0));
  // 门口木平台（朝河一侧）
  group.add(box(2.6, HUT.floorThickness, 1.5, materials.floor, 0, -HUT.floorThickness / 2, -hd - 0.72));

  // 四面墙（北墙留门洞，面向小河）
  group.add(box(HUT.width, HUT.wallHeight, t, materials.wood, 0, HUT.wallHeight / 2, hd)); // 南
  group.add(box(t, HUT.wallHeight, HUT.depth, materials.wood, hw, HUT.wallHeight / 2, 0)); // 东
  group.add(box(t, HUT.wallHeight, HUT.depth, materials.wood, -hw, HUT.wallHeight / 2, 0)); // 西
  const doorHalf = HUT.doorWidth / 2;
  const sideW = hw - doorHalf;
  group.add(box(sideW, HUT.wallHeight, t, materials.wood, -(doorHalf + sideW / 2), HUT.wallHeight / 2, -hd));
  group.add(box(sideW, HUT.wallHeight, t, materials.wood, doorHalf + sideW / 2, HUT.wallHeight / 2, -hd));
  group.add(
    box(HUT.doorWidth, HUT.wallHeight - HUT.doorHeight, t, materials.wood, 0, HUT.doorHeight + (HUT.wallHeight - HUT.doorHeight) / 2, -hd),
  );

  // 门框
  group.add(box(0.14, HUT.doorHeight, t + 0.08, materials.woodDark, -doorHalf, HUT.doorHeight / 2, -hd));
  group.add(box(0.14, HUT.doorHeight, t + 0.08, materials.woodDark, doorHalf, HUT.doorHeight / 2, -hd));
  group.add(box(HUT.doorWidth + 0.28, 0.16, t + 0.08, materials.woodDark, 0, HUT.doorHeight + 0.08, -hd));

  // 四角立柱
  [
    [hw, hd],
    [-hw, hd],
    [hw, -hd],
    [-hw, -hd],
  ].forEach(([cx, cz]) => {
    group.add(box(0.26, HUT.wallHeight + 0.12, 0.26, materials.woodDark, cx, (HUT.wallHeight + 0.12) / 2, cz));
  });

  // 茅草屋顶
  const ridgeHalf = hw * 0.44;
  const roof = new THREE.Mesh(
    buildRoofGeometry(hw, hd, HUT.wallHeight, HUT.roofRise, HUT.roofOverhang, ridgeHalf),
    materials.thatch,
  );
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);
  group.add(box(ridgeHalf * 2 + 0.3, 0.14, 0.24, materials.woodDark, 0, HUT.wallHeight + HUT.roofRise + 0.02, 0));

  // 床（靠南墙，床头朝南；进门即可望见）
  const bed = buildBed(materials);
  const bedX = 1.0;
  const bedZ = hd - 1.2;
  bed.position.set(bedX, 0, bedZ);
  bed.rotation.y = Math.PI;
  group.add(bed);
  collisionWorld?.addCircle(position.x + bedX, position.z + bedZ - 0.5, 0.55);
  collisionWorld?.addCircle(position.x + bedX, position.z + bedZ + 0.5, 0.55);

  // 室内地板支撑：让主角站在木地板高度，而不是下沉到地形
  const supportR = 1.7;
  const supportOffsets = (half, step) => {
    const offsets = [0];
    for (let v = step; v <= half + step * 0.5; v += step) {
      offsets.push(v, -v);
    }
    return offsets;
  };
  for (const sx of supportOffsets(hw, 1.9)) {
    for (const sz of supportOffsets(hd, 1.7)) {
      collisionWorld?.addCircle(position.x + sx, position.z + sz, supportR, floorY);
    }
  }

  // 地毯
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 22), materials.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.7, 0.02, 0.2);
  rug.receiveShadow = true;
  group.add(rug);

  // 小凳
  const stool = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 12), materials.woodDark);
  seat.position.y = 0.44;
  seat.castShadow = true;
  stool.add(seat);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    stool.add(box(0.06, 0.44, 0.06, materials.woodDark, Math.cos(a) * 0.17, 0.22, Math.sin(a) * 0.17));
  }
  const stoolLocalX = -hw + 2.3;
  const stoolLocalZ = 0.9;
  stool.position.set(stoolLocalX, 0, stoolLocalZ);
  group.add(stool);

  // 吊灯 + 暖光
  const lanternY = HUT.wallHeight - 0.5;
  group.add(box(0.04, HUT.roofRise + 0.4, 0.04, materials.woodDark, 0, lanternY + (HUT.roofRise + 0.4) / 2, 0));
  const lanternCage = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), materials.metal);
  lanternCage.position.set(0, lanternY, 0);
  group.add(lanternCage);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), materials.flame);
  flame.position.set(0, lanternY, 0);
  group.add(flame);

  const lantern = new THREE.PointLight(0xffb45e, 18, 13, 2);
  lantern.position.set(0, lanternY, 0);
  group.add(lantern);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // 墙体碰撞（北墙留门洞，可步行进出）
  const ringRadius = 0.22;
  const spacing = 0.5;
  const addWall = (x0, z0, x1, z1, gapHalf = 0) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / spacing));
    for (let i = 0; i <= n; i += 1) {
      const tt = i / n;
      const lx = x0 + (x1 - x0) * tt;
      const lz = z0 + (z1 - z0) * tt;
      if (gapHalf > 0 && Math.abs(lx) < gapHalf) continue;
      collisionWorld?.addCircle(position.x + lx, position.z + lz, ringRadius);
    }
  };
  addWall(-hw, hd, hw, hd); // 南
  addWall(hw, -hd, hw, hd); // 东
  addWall(-hw, -hd, -hw, hd); // 西
  addWall(-hw, -hd, hw, -hd, doorHalf + 0.45); // 北（门洞，留出可通行宽度）

  // 交互锚点（世界坐标）
  const exitPoint = new THREE.Vector3(position.x, getTerrainHeight(position.x, position.z - hd - 1.3), position.z - hd - 1.3);
  const doorInside = new THREE.Vector3(position.x, 0, position.z - hd + 0.9);

  // 床：可交互区域（床的左右两侧与床尾都算"走近了床"）
  const bedZone = {
    minX: position.x + bedX - 1.55,
    maxX: position.x + bedX + 1.55,
    minZ: position.z + bedZ - 1.75,
    maxZ: position.z + bedZ + 0.95,
  };
  const isNearBed = (px, pz) =>
    px > bedZone.minX && px < bedZone.maxX && pz > bedZone.minZ && pz < bedZone.maxZ;

  // 躺下落点放在床尾、facing 取 π：人物放倒后头顶沿世界 +Z 展开，
  // 正好朝床头（南墙）那一侧，脸朝上。
  const bedLiePoint = {
    x: position.x + bedX,
    y: floorY + 0.85,
    z: position.z + bedZ - 1.0,
    facing: Math.PI,
  };

  // 小凳：坐下位置与朝向（面朝屋内 +X 方向）
  const stoolAnchor = new THREE.Vector3(
    position.x + stoolLocalX,
    floorY,
    position.z + stoolLocalZ,
  );
  const sitPoint = {
    x: position.x + stoolLocalX,
    y: floorY,
    z: position.z + stoolLocalZ,
    facing: Math.PI / 2,
  };

  const bounds = {
    minX: position.x - hw + 0.5,
    maxX: position.x + hw - 0.5,
    minZ: position.z - hd + 0.5,
    maxZ: position.z + hd - 0.5,
    minY: floorY + 0.5,
    maxY: floorY + HUT.wallHeight - 0.25,
  };

  // 镜头可达范围：比可行动范围更贴近墙面，屋内才容得下原地环绕
  const cameraBounds = {
    minX: position.x - hw + t,
    maxX: position.x + hw - t,
    minZ: position.z - hd + t,
    maxZ: position.z + hd - t,
    minY: floorY + 0.25,
    maxY: floorY + HUT.wallHeight - 0.1,
  };

  // 门洞走廊：门口这一段镜头可以退到门框内乃至门外平台上，否则进门时
  // 北墙会把镜头挤到角色身上（视角会突然翻到前面）。
  const doorCorridor = {
    minX: position.x - 1.0,
    maxX: position.x + 1.0,
    minZ: position.z - hd - 2.6,
    maxZ: position.z - hd + 0.4,
    minY: floorY - 0.7,
    maxY: floorY + HUT.wallHeight - 0.1,
  };

  const insideTest = (px, pz) =>    Math.abs(px - position.x) < hw - t * 0.5 && Math.abs(pz - position.z) < hd - t * 0.5;

  return {
    group,
    floorY,
    exitPoint,
    bedZone,
    isNearBed,
    bedLiePoint,
    doorInside,
    stoolAnchor,
    sitPoint,
    bounds,
    cameraBounds,
    doorCorridor,
    isInside: insideTest,
    clearing: { x: position.x, z: position.z, radius: Math.max(hw, hd) + 1.8 },
  };
}
