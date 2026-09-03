/**
 * layout_erd.js
 * E-R 图独立布局引擎
 * 
 * 布局策略：
 * 1. 如果所有实体属性 <= 8，使用传统布局（实体+属性+关系在同一图）
 * 2. 如果有实体属性 > 8，使用两步布局：
 *    - 上半部分：实体关系图（只有实体和关系菱形，不绘制属性）
 *    - 下半部分：每个实体的详细图（实体 + 所有属性）
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate() {
  const templatePath = path.join(TEMPLATES_DIR, 'erd.json');
  return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
}

function parseNaturalLanguage(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const entities = [];
  const relationships = [];
  const entityMap = {};

  for (const line of lines) {
    const entityMatch = line.match(/^(.+?)实体[：:]\s*(.+)$/);
    if (entityMatch) {
      const name = entityMatch[1].trim();
      const attrStr = entityMatch[2];
      const attrs = attrStr.split(/[、,，]/).map(a => a.trim()).filter(a => a);
      const attributes = attrs.map(a => {
        const isPK = a.includes('主键') || a.includes('PK') || a.includes('pk');
        const cleanName = a.replace(/[（(][^）)]*[）)]/g, '').trim();
        return { name: cleanName, type: isPK ? 'PK' : 'normal' };
      });
      entities.push({ name, attributes });
      entityMap[name] = attributes;
      continue;
    }
    const relMatch = line.match(/^(.+?)\s+(m:1|1:m|1:1|m:n|n:m|n:1|1:n)\s+(.+?)\s+(.+)$/);
    if (relMatch) {
      const from = relMatch[1].trim();
      const cardinality = relMatch[2].trim(); // 保留 m:n，不替换为 n:n
      const name = relMatch[3].trim();
      const to = relMatch[4].trim();
      const [fromCard, toCard] = cardinality.split(':');
      relationships.push({ from, to, fromCardinality: fromCard, toCardinality: toCard, name });
      continue;
    }
  }
  return { entities, relationships };
}

function parseMarkdown(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const entities = [];
  const relationships = [];
  const entityMap = {};
  let currentSection = '';
  let tableHeader = [];
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    if (currentSection === '实体' || currentSection === 'entities') {
      for (const row of tableRows) {
        if (row.length < 2) continue;
        const [entityName, attrName, attrType] = row;
        if (!entityMap[entityName]) {
          entityMap[entityName] = [];
          entities.push({ name: entityName, attributes: entityMap[entityName] });
        }
        const type = (attrType || '').toUpperCase().includes('PK') ? 'PK' : 'normal';
        entityMap[entityName].push({ name: attrName, type });
      }
    } else if (currentSection === '关系' || currentSection === 'relationships') {
      for (const row of tableRows) {
        if (row.length < 4) continue;
        const [relName, from, fromCard, to, toCard] = row;
        relationships.push({ from, to, fromCardinality: fromCard || 'n', toCardinality: toCard || '1', name: relName });
      }
    }
    tableRows = [];
    tableHeader = [];
  };

  for (const line of lines) {
    const titleMatch = line.match(/^#+\s+(.+)$/);
    if (titleMatch) { flushTable(); currentSection = titleMatch[1].trim(); continue; }
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      if (tableHeader.length === 0) { tableHeader = cells; } else { tableRows.push(cells); }
    }
  }
  flushTable();
  return { entities, relationships };
}

/**
 * 检查是否需要使用两步布局
 */
/**
 * 判断是否需要两步布局
 * 触发条件（满足任一）：
 * 1. 任一实体属性数 > maxAttrs（默认 8）
 * 2. 实体数量 > 4
 */
function needsTwoStepLayout(entities, maxAttrs = 8) {
  // 条件 1：实体数量 > 4
  if (entities.length > 4) {
    return true;
  }
  
  // 条件 2：任一实体属性数 > maxAttrs
  for (const entity of entities) {
    if ((entity.attributes || []).length > maxAttrs) {
      return true;
    }
  }
  
  return false;
}

/**
 * E-R 图实体布局总体原则
 * 
 * 实体数量 → 布局形状：
 *   1 个：居中
 *   2 个：水平线（左右）
 *   3 个：倒三角 ▽（关系最多的在底部中间）
 *   4 个：方形（四角）
 *   5 个：五边形（五个顶点均匀分布，避免中心实体遮挡连线）
 *   6 个：六边形（六个顶点）
 *   7-9 个：环形（均匀分布在圆周上）
 *   10+ 个：网格
 * 
 * 属性分布原则：
 *   - 避开关系连线方向
 *   - 在剩余方向均匀分布
 */
function computeEntityPositions(entityCount, canvasW, canvasH, entityW, entityH, margin) {
  const positions = [];
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  // 增大 spread 上限，让实体分布更开，避免菱形重叠
  const spreadX = Math.min(400, (canvasW - 2 * margin - entityW) / 2 * 0.85);
  const spreadY = Math.min(300, (canvasH - 2 * margin - entityH) / 2 * 0.85);

  if (entityCount === 1) {
    // 居中
    positions.push({ x: centerX - entityW / 2, y: centerY - entityH / 2 });
  } else if (entityCount === 2) {
    // 水平线：左右分布
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY - entityH / 2 });
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY - entityH / 2 });
  } else if (entityCount === 3) {
    // 倒三角 ▽：左上、右上、下中
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 }); // 左上
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 }); // 右上
    positions.push({ x: centerX - entityW / 2, y: centerY + spreadY - entityH / 2 }); // 下中
  } else if (entityCount === 4) {
    // 方形：左上、右上、左下、右下
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 }); // 左上
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 }); // 右上
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY + spreadY - entityH / 2 }); // 左下
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY + spreadY - entityH / 2 }); // 右下
  } else if (entityCount === 5) {
    // 五边形：五个顶点均匀分布在圆周上（避免星型中心实体遮挡连线）
    // 半径受限于画布，确保所有实体在可视区域内
    const pentRadius = Math.min(spreadX * 1.2, spreadY * 1.5, (canvasH - 2 * margin - entityH) / 2 * 0.9);
    for (let i = 0; i < 5; i++) {
      const angle = (2 * Math.PI / 5) * i - Math.PI / 2; // 从顶部开始
      const x = centerX + pentRadius * Math.cos(angle) - entityW / 2;
      const y = centerY + pentRadius * Math.sin(angle) - entityH / 2;
      positions.push({ x, y });
    }
  } else if (entityCount === 6) {
    // 六边形：六个顶点
    const hexRadius = Math.min(spreadX, spreadY);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6; // 从顶部开始，顺时针
      const x = centerX + hexRadius * Math.cos(angle) - entityW / 2;
      const y = centerY + hexRadius * Math.sin(angle) - entityH / 2;
      positions.push({ x, y });
    }
  } else if (entityCount >= 7 && entityCount <= 9) {
    // 环形：均匀分布在圆周上（半径随实体数增加，避免拥挤）
    const ringRadius = Math.min(
      spreadX * (1 + (entityCount - 6) * 0.2),
      spreadY * (1 + (entityCount - 6) * 0.3),
      (canvasH - 2 * margin - entityH) / 2 * 0.9
    );
    for (let i = 0; i < entityCount; i++) {
      const angle = (2 * Math.PI / entityCount) * i - Math.PI / 2; // 从顶部开始
      const x = centerX + ringRadius * Math.cos(angle) - entityW / 2;
      const y = centerY + ringRadius * Math.sin(angle) - entityH / 2;
      positions.push({ x, y });
    }
  } else {
    // 10+ 个：网格布局
    const cols = Math.ceil(Math.sqrt(entityCount));
    const rows = Math.ceil(entityCount / cols);
    const cellW = (canvasW - 2 * margin) / cols;
    const cellH = (canvasH - 2 * margin) / rows;
    for (let i = 0; i < entityCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: margin + col * cellW + (cellW - entityW) / 2,
        y: margin + row * cellH + (cellH - entityH) / 2
      });
    }
  }
  return positions;
}

/**
 * 根据关系数量重新排序实体
 * 
 * 3 个实体（倒三角）：关系最多的放最后（底部中间）
 * 5 个实体（五边形）：关系最多的放顶部（index 0）
 */
function reorderEntitiesForLayout(entities, relationships) {
  if (entities.length !== 3 && entities.length !== 5) return entities;
  
  // 计算每个实体的关系数量
  const relCount = entities.map(e => {
    return relationships.filter(r => r.from === e.name || r.to === e.name).length;
  });
  
  // 找到关系最多的实体索引
  let maxIdx = 0;
  for (let i = 1; i < relCount.length; i++) {
    if (relCount[i] > relCount[maxIdx]) maxIdx = i;
  }
  
  const reordered = [...entities];
  if (entities.length === 3) {
    // 倒三角：关系最多的放最后（底部中间）
    if (maxIdx !== 2) {
      const [maxEntity] = reordered.splice(maxIdx, 1);
      reordered.push(maxEntity);
    }
  } else if (entities.length === 5) {
    // 五边形：关系最多的放顶部（index 0）
    if (maxIdx !== 0) {
      const [maxEntity] = reordered.splice(maxIdx, 1);
      reordered.unshift(maxEntity);
    }
  }
  
  return reordered;
}

/**
 * 贪心环形排序：让有关系的实体尽量相邻，减少连线交叉
 * 适用于 5+ 实体的环形/多边形布局
 * 
 * 算法：从关系最多的实体开始，每次选择与已放置实体连接最多
 * （并列时优先与上一个放置的实体相连）的实体放在下一个位置
 */
function reorderEntitiesForRing(entities, relationships) {
  if (entities.length < 5) return entities;
  
  const hasEdge = (a, b) =>
    relationships.some(r => (r.from === a && r.to === b) || (r.from === b && r.to === a));
  
  // 计算两个排列的交叉数（环形布局）
  const countCrossings = (perm) => {
    const n = perm.length;
    const pos = {};
    perm.forEach((e, i) => pos[e.name] = i);
    
    let crossings = 0;
    const edges = [];
    relationships.forEach(r => {
      const p1 = pos[r.from], p2 = pos[r.to];
      if (p1 !== undefined && p2 !== undefined) {
        edges.push([Math.min(p1, p2), Math.max(p1, p2)]);
      }
    });
    
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const [a, b] = edges[i];
        const [c, d] = edges[j];
        // 两条弦交叉当且仅当端点交替：a<c<b<d 或 c<a<d<b
        if ((a < c && c < b && b < d) || (c < a && a < d && d < b)) {
          crossings++;
        }
      }
    }
    return crossings;
  };
  
  // 找到关系最多的实体，固定在位置 0（环顶部）
  const relCount = entities.map(e =>
    relationships.filter(r => r.from === e.name || r.to === e.name).length);
  let startIdx = 0;
  for (let i = 1; i < relCount.length; i++) {
    if (relCount[i] > relCount[startIdx]) startIdx = i;
  }
  
  const fixed = entities[startIdx];
  const remaining = entities.filter((e, i) => i !== startIdx);
  
  // 枚举所有排列（最多 6! = 720 种）
  const perms = generatePermutations(remaining);
  let bestPerm = [fixed, ...perms[0]], bestCrossings = Infinity;
  
  for (const perm of perms) {
    const candidate = [fixed, ...perm];
    const crossings = countCrossings(candidate);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      bestPerm = candidate;
    }
  }
  
  return bestPerm;
}

/**
 * 生成数组的所有排列（Heap 算法）
 */
function generatePermutations(arr) {
  const result = [];
  const n = arr.length;
  const c = new Array(n).fill(0);
  result.push([...arr]);
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) {
        [arr[0], arr[i]] = [arr[i], arr[0]];
      } else {
        [arr[c[i]], arr[i]] = [arr[i], arr[c[i]]];
      }
      result.push([...arr]);
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
  return result;
}

/**
 * 检测枢纽实体：关系数 ≥3 且 ≥ 总关系数一半
 * 返回枢纽实体索引，无枢纽返回 -1
 */
function detectHubEntity(entities, relationships) {
  if (relationships.length === 0) return -1;
  let maxIdx = -1, maxDeg = 0;
  entities.forEach((e, i) => {
    const deg = relationships.filter(r => r.from === e.name || r.to === e.name).length;
    if (deg > maxDeg) { maxDeg = deg; maxIdx = i; }
  });
  return (maxDeg >= 3 && maxDeg >= Math.ceil(relationships.length / 2)) ? maxIdx : -1;
}

/**
 * 枢纽辐射布局：枢纽在圆心，辐条围环
 * 辐条按辐条间关系贪心排序（相关辐条相邻，环边不交叉；半径线天然不交叉）
 */
function computeHubRadialPositions(entities, relationships, hubIdx, canvasW, canvasH, entityW, entityH, margin) {
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  const positions = new Array(entities.length);
  positions[hubIdx] = { x: centerX - entityW / 2, y: centerY - entityH / 2 };

  const spokeIdxs = entities.map((e, i) => i).filter(i => i !== hubIdx);
  const hasEdge = (a, b) =>
    relationships.some(r => (r.from === a && r.to === b) || (r.from === b && r.to === a));

  // 贪心排序辐条：从辐条间关系最多的开始，每次选与已放置辐条连接最多的
  let start = spokeIdxs[0], startDeg = -1;
  for (const i of spokeIdxs) {
    const d = spokeIdxs.filter(j => j !== i && hasEdge(entities[i].name, entities[j].name)).length;
    if (d > startDeg) { startDeg = d; start = i; }
  }
  let ordered = [start];
  const used = new Set([start]);
  while (ordered.length < spokeIdxs.length) {
    const last = ordered[ordered.length - 1];
    let pick = -1, pickConn = -1, pickConnLast = 0;
    for (const i of spokeIdxs) {
      if (used.has(i)) continue;
      let conn = 0;
      for (const j of ordered) {
        if (hasEdge(entities[i].name, entities[j].name)) conn++;
      }
      const connLast = hasEdge(entities[i].name, entities[last].name) ? 1 : 0;
      if (conn > pickConn || (conn === pickConn && connLast > pickConnLast)) {
        pick = i; pickConn = conn; pickConnLast = connLast;
      }
    }
    ordered.push(pick);
    used.add(pick);
  }

  // 排列优化：对 ≤6 辐条枚举所有排列，选环上相邻边最多的（避免对径点有边导致菱形与枢纽重叠）
  if (ordered.length <= 6) {
    const permutations = generatePermutations(ordered);
    let bestPerm = ordered, bestAdj = -1;
    for (const perm of permutations) {
      let adj = 0;
      for (let i = 0; i < perm.length; i++) {
        const a = perm[i], b = perm[(i + 1) % perm.length];
        if (hasEdge(entities[a].name, entities[b].name)) adj++;
      }
      if (adj > bestAdj) { bestAdj = adj; bestPerm = perm; }
    }
    ordered = bestPerm;
  } else {
    // 辐条太多时，用循环移位近似
    let bestOrder = [...ordered], bestAdj = -1;
    for (let shift = 0; shift < ordered.length; shift++) {
      const shifted = [...ordered.slice(shift), ...ordered.slice(0, shift)];
      let adj = 0;
      for (let i = 0; i < shifted.length; i++) {
        const a = shifted[i], b = shifted[(i + 1) % shifted.length];
        if (hasEdge(entities[a].name, entities[b].name)) adj++;
      }
      if (adj > bestAdj) { bestAdj = adj; bestOrder = shifted; }
    }
    ordered = bestOrder;
  }

  // 辐条均匀分布在圆周上（从顶部开始顺时针）
  const radius = Math.min(
    (canvasW - 2 * margin - entityW) / 2 * 0.9,
    (canvasH - 2 * margin - entityH) / 2 * 0.9
  );
  ordered.forEach((idx, k) => {
    const angle = (2 * Math.PI / ordered.length) * k - Math.PI / 2;
    positions[idx] = {
      x: centerX + radius * Math.cos(angle) - entityW / 2,
      y: centerY + radius * Math.sin(angle) - entityH / 2
    };
  });
  return positions;
}

/**
 * 获取实体在布局中的方向标识
 * 用于确定属性分布的朝外方向
 */
function getEntityDirection(entityIndex, entityCount) {
  if (entityCount <= 2) return entityIndex === 0 ? 'left' : 'right';
  if (entityCount === 3) {
    // 倒三角：左上、右上、下中
    if (entityIndex === 0) return 'top-left';
    if (entityIndex === 1) return 'top-right';
    return 'bottom-center';
  }
  if (entityCount === 4) {
    // 方形：左上、右上、左下、右下
    if (entityIndex === 0) return 'top-left';
    if (entityIndex === 1) return 'top-right';
    if (entityIndex === 2) return 'bottom-left';
    return 'bottom-right';
  }
  if (entityCount === 5) {
    // 五边形：从顶部顺时针编号
    const dirs = ['top', 'top-right', 'bottom-right', 'bottom-left', 'top-left'];
    return dirs[entityIndex] || 'center';
  }
  if (entityCount === 6) {
    // 六边形：从顶部顺时针编号
    const dirs = ['top', 'top-right', 'bottom-right', 'bottom', 'bottom-left', 'top-left'];
    return dirs[entityIndex] || 'center';
  }
  if (entityCount >= 7 && entityCount <= 9) {
    // 环形：根据角度判断方向
    const angle = (2 * Math.PI / entityCount) * entityIndex - Math.PI / 2;
    const deg = (angle * 180 / Math.PI + 360) % 360;
    if (deg >= 315 || deg < 45) return 'top';
    if (deg >= 45 && deg < 90) return 'top-right';
    if (deg >= 90 && deg < 135) return 'right';
    if (deg >= 135 && deg < 225) return 'bottom';
    if (deg >= 225 && deg < 270) return 'left';
    return 'top-left';
  }
  return 'center';
}

/**
 * 根据方向标识获取属性分布的朝外方向
 */
function getOutwardDirections(direction) {
  switch (direction) {
    case 'left': return ['left'];
    case 'right': return ['right'];
    case 'top': return ['top'];
    case 'bottom': return ['bottom'];
    case 'top-left': return ['top', 'left'];
    case 'top-right': return ['top', 'right'];
    case 'bottom-left': return ['bottom', 'left'];
    case 'bottom-right': return ['bottom', 'right'];
    case 'bottom-center': return ['bottom', 'left', 'right'];
    case 'center': return ['top', 'bottom', 'left', 'right'];
    default: return ['top', 'bottom'];
  }
}

function getConnectionDirection(posA, posB) {
  const ax = posA.x + 60;
  const ay = posA.y + 30;
  const bx = posB.x + 60;
  const by = posB.y + 30;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'horizontal' : 'horizontal-reverse';
  }
  return dy > 0 ? 'vertical' : 'vertical-reverse';
}

/**
 * 获取实体有关系连线的方向
 * 用于排除属性分布方向，避免属性与关系连线重叠
 */
function getRelationDirections(entityName, entities, relationships, positions) {
  const relationDirs = [];
  const entityIndex = entities.findIndex(e => e.name === entityName);
  if (entityIndex === -1) return relationDirs;
  
  const pos = positions[entityIndex];
  const ecx = pos.x + 60; // entityW/2
  const ecy = pos.y + 30; // entityH/2
  
  for (const rel of relationships) {
    if (rel.from !== entityName && rel.to !== entityName) continue;
    
    const otherName = rel.from === entityName ? rel.to : rel.from;
    const otherIndex = entities.findIndex(e => e.name === otherName);
    if (otherIndex === -1) continue;
    
    const otherPos = positions[otherIndex];
    const otherCx = otherPos.x + 60;
    const otherCy = otherPos.y + 30;
    
    const dx = otherCx - ecx;
    const dy = otherCy - ecy;
    
    // 判断关系在哪个方向
    if (Math.abs(dx) > Math.abs(dy)) {
      relationDirs.push(dx > 0 ? 'right' : 'left');
    } else {
      relationDirs.push(dy > 0 ? 'bottom' : 'top');
    }
  }
  
  return relationDirs;
}

/**
 * 绘制实体关系图（不绘制属性）
 */
function drawRelationshipDiagram(entities, relationships, positions, style, offsetY = 0) {
  const shapes = [];
  const connections = [];
  const entityW = style.spacing.entityW || 120;
  const entityH = style.spacing.entityH || 60;
  const relW = style.spacing.relW || 100;
  const relH = style.spacing.relH || 60;

  const entityPositions = {};
  const entityShapeIdx = {};
  let shapeIdx = 0;

  // 绘制实体（不绘制属性）
  for (let i = 0; i < entities.length; i++) {
    const pos = positions[i];
    const ex = pos.x;
    const ey = pos.y + offsetY;
    const ecx = ex + entityW / 2;
    const ecy = ey + entityH / 2;
    entityPositions[entities[i].name] = { x: ex, y: ey, w: entityW, h: entityH, cx: ecx, cy: ecy, right: ex + entityW, bottom: ey + entityH };

    shapes.push({
      type: 'rect',
      x: ex, y: ey, w: entityW, h: entityH,
      text: entities[i].name,
      style: {
        fillColor: style.colors.entityFill,
        strokeColor: style.colors.entityStroke,
        strokeWidth: style.colors.entityStrokeWidth,
        fontSize: style.typography.entitySize,
        bold: true,
        fontColor: style.colors.textColor,
        align: 1
      }
    });
    entityShapeIdx[i] = shapeIdx;
    shapeIdx++;
  }

  // 绘制关系菱形
  const entityNameToIdx = {};
  entities.forEach((e, i) => { entityNameToIdx[e.name] = i; });

  for (const rel of relationships) {
    const fromIdx = entityNameToIdx[rel.from];
    const toIdx = entityNameToIdx[rel.to];
    if (fromIdx === undefined || toIdx === undefined) continue;

    const fromPos = entityPositions[rel.from];
    const toPos = entityPositions[rel.to];

    const relCx = (fromPos.cx + toPos.cx) / 2;
    const relCy = (fromPos.cy + toPos.cy) / 2;
    const relX = relCx - relW / 2;
    const relY = relCy - relH / 2;

    shapes.push({
      type: 'rhombus',
      x: relX, y: relY, w: relW, h: relH,
      text: rel.name,
      style: {
        fillColor: style.colors.relFill,
        strokeColor: style.colors.relStroke,
        strokeWidth: style.colors.relStrokeWidth,
        fontSize: style.typography.relSize,
        fontColor: style.colors.textColor,
        align: 1
      }
    });
    const relShapeIdx = shapes.length - 1;

    const connDir = getConnectionDirection(fromPos, toPos);
    let fromExitX, fromExitY, toExitX, toExitY;
    let relEntryFromX, relEntryFromY, relEntryToX, relEntryToY;

    if (connDir === 'horizontal') {
      fromExitX = 1; fromExitY = 0.5;
      toExitX = 0; toExitY = 0.5;
      relEntryFromX = 0; relEntryFromY = 0.5;
      relEntryToX = 1; relEntryToY = 0.5;
    } else if (connDir === 'horizontal-reverse') {
      fromExitX = 0; fromExitY = 0.5;
      toExitX = 1; toExitY = 0.5;
      relEntryFromX = 1; relEntryFromY = 0.5;
      relEntryToX = 0; relEntryToY = 0.5;
    } else if (connDir === 'vertical') {
      fromExitX = 0.5; fromExitY = 1;
      toExitX = 0.5; toExitY = 0;
      relEntryFromX = 0.5; relEntryFromY = 0;
      relEntryToX = 0.5; relEntryToY = 1;
    } else {
      fromExitX = 0.5; fromExitY = 0;
      toExitX = 0.5; toExitY = 1;
      relEntryFromX = 0.5; relEntryFromY = 1;
      relEntryToX = 0.5; relEntryToY = 0;
    }

    connections.push({
      from: entityShapeIdx[fromIdx], to: relShapeIdx,
      style: { endArrow: 'none', strokeColor: style.colors.lineColor, strokeWidth: style.colors.lineWidth,
        exitX: fromExitX, exitY: fromExitY, entryX: relEntryFromX, entryY: relEntryFromY }
    });
    connections.push({
      from: entityShapeIdx[toIdx], to: relShapeIdx,
      style: { endArrow: 'none', strokeColor: style.colors.lineColor, strokeWidth: style.colors.lineWidth,
        exitX: toExitX, exitY: toExitY, entryX: relEntryToX, entryY: relEntryToY }
    });

    // 基数标注
    const fromLineMidX = (fromPos.cx + relX + relW / 2) / 2;
    const fromLineMidY = (fromPos.cy + relCy) / 2;
    let fromLabelX = fromLineMidX;
    let fromLabelY = fromLineMidY;
    if (connDir === 'horizontal' || connDir === 'horizontal-reverse') {
      fromLabelY -= 15;
    } else {
      fromLabelX += 15;
    }
    shapes.push({
      type: 'text', x: fromLabelX - 10, y: fromLabelY - 10, w: 20, h: 20,
      text: rel.fromCardinality || 'n',
      style: { fontSize: style.typography.cardinalitySize || 14, fontColor: style.colors.textColor, align: 1 }
    });
    shapeIdx++;

    const toLineMidX = (toPos.cx + relX + relW / 2) / 2;
    const toLineMidY = (toPos.cy + relCy) / 2;
    let toLabelX = toLineMidX;
    let toLabelY = toLineMidY;
    if (connDir === 'horizontal' || connDir === 'horizontal-reverse') {
      toLabelY -= 15;
    } else {
      toLabelX += 15;
    }
    shapes.push({
      type: 'text', x: toLabelX - 10, y: toLabelY - 10, w: 20, h: 20,
      text: rel.toCardinality || '1',
      style: { fontSize: style.typography.cardinalitySize || 14, fontColor: style.colors.textColor, align: 1 }
    });
    shapeIdx++;
  }

  return { shapes, connections, entityPositions, entityShapeIdx };
}

/**
 * 绘制单个实体的详细图（实体 + 所有属性）
 */
function drawEntityDetailDiagram(entity, entityX, entityY, style) {
  const shapes = [];
  const connections = [];
  const entityW = style.spacing.entityW || 120;
  const entityH = style.spacing.entityH || 60;
  const attrW = style.spacing.attrW || 110;
  const attrH = style.spacing.attrH || 32;
  const attrGap = style.spacing.attrGap || 12;
  const attrDistance = style.spacing.attrDistance || 70;

  const ecx = entityX + entityW / 2;
  const ecy = entityY + entityH / 2;

  // 实体矩形
  shapes.push({
    type: 'rect',
    x: entityX, y: entityY, w: entityW, h: entityH,
    text: entity.name,
    style: {
      fillColor: style.colors.entityFill,
      strokeColor: style.colors.entityStroke,
      strokeWidth: style.colors.entityStrokeWidth,
      fontSize: style.typography.entitySize,
      bold: true,
      fontColor: style.colors.textColor,
      align: 1
    }
  });
  const entityShapeIdx = 0;
  let shapeIdx = 1;

  // 属性：根据数量智能分布
  const attrs = entity.attributes || [];
  const attrCount = attrs.length;
  if (attrCount === 0) return { shapes, connections };

  // 智能分布策略：
  // <= 4 个：全部放上方
  // 5-8 个：上方和下方
  // > 8 个：四个方向
  let dirs = [];
  if (attrCount <= 4) {
    dirs = ['top'];
  } else if (attrCount <= 8) {
    dirs = ['top', 'bottom'];
  } else {
    dirs = ['top', 'bottom', 'left', 'right'];
  }
  
  const perDir = Math.ceil(attrCount / dirs.length);
  const dirAttrs = {};
  dirs.forEach((dir, idx) => {
    const start = idx * perDir;
    const end = Math.min(start + perDir, attrCount);
    dirAttrs[dir] = attrs.slice(start, end);
  });

  for (const dir of dirs) {
    const dirAttrList = dirAttrs[dir];
    if (!dirAttrList || dirAttrList.length === 0) continue;
    const count = dirAttrList.length;

    if (dir === 'top' || dir === 'bottom') {
      const totalW = count * attrW + (count - 1) * attrGap;
      const startX = ecx - totalW / 2;
      const y = dir === 'top' ? (entityY - attrH - attrDistance) : (entityY + entityH + attrDistance);

      for (let j = 0; j < count; j++) {
        const ax = startX + j * (attrW + attrGap);
        const ay = y;
        shapes.push({
          type: 'ellipse',
          x: ax, y: ay, w: attrW, h: attrH,
          text: dirAttrList[j].name,
          style: {
            fillColor: style.colors.attrFill,
            strokeColor: style.colors.attrStroke,
            strokeWidth: style.colors.attrStrokeWidth,
            fontSize: style.typography.attrSize,
            fontColor: style.colors.textColor,
            align: 1,
            underline: dirAttrList[j].type === 'PK'
          }
        });
        connections.push({
          from: shapeIdx, to: entityShapeIdx,
          style: {
            endArrow: 'none',
            strokeColor: style.colors.lineColor,
            strokeWidth: style.colors.lineWidth,
            exitX: 0.5, exitY: dir === 'top' ? 1 : 0,
            entryX: 0.5, entryY: dir === 'top' ? 0 : 1
          }
        });
        shapeIdx++;
      }
    } else {
      const totalH = count * attrH + (count - 1) * attrGap;
      const startY = ecy - totalH / 2;
      const x = dir === 'left' ? (entityX - attrW - attrDistance) : (entityX + entityW + attrDistance);

      for (let j = 0; j < count; j++) {
        const ax = x;
        const ay = startY + j * (attrH + attrGap);
        shapes.push({
          type: 'ellipse',
          x: ax, y: ay, w: attrW, h: attrH,
          text: dirAttrList[j].name,
          style: {
            fillColor: style.colors.attrFill,
            strokeColor: style.colors.attrStroke,
            strokeWidth: style.colors.attrStrokeWidth,
            fontSize: style.typography.attrSize,
            fontColor: style.colors.textColor,
            align: 1,
            underline: dirAttrList[j].type === 'PK'
          }
        });
        connections.push({
          from: shapeIdx, to: entityShapeIdx,
          style: {
            endArrow: 'none',
            strokeColor: style.colors.lineColor,
            strokeWidth: style.colors.lineWidth,
            exitX: dir === 'left' ? 1 : 0, exitY: 0.5,
            entryX: dir === 'left' ? 0 : 1, entryY: 0.5
          }
        });
        shapeIdx++;
      }
    }
  }

  return { shapes, connections };
}

/**
 * 主布局函数
 */
function layoutErd(structure) {
  const template = loadTemplate();
  const style = template.style;
  const canvas = { ...template.canvas };

  let parsed;
  if (structure.mode === 'markdown' || structure.markdown) {
    parsed = parseMarkdown(structure.markdown || structure.text || '');
  } else if (structure.mode === 'natural' || structure.text) {
    parsed = parseNaturalLanguage(structure.text || '');
  } else if (structure.entities) {
    parsed = { entities: structure.entities || [], relationships: structure.relationships || [] };
  } else {
    parsed = { entities: [], relationships: [] };
  }

  let entities = parsed.entities;
  const relationships = parsed.relationships;
  const entityCount = entities.length;

  const entityW = style.spacing.entityW || 120;
  const entityH = style.spacing.entityH || 60;
  const attrW = style.spacing.attrW || 110;
  const attrH = style.spacing.attrH || 32;
  const attrGap = style.spacing.attrGap || 12;
  const attrDistance = style.spacing.attrDistance || 70;
  const margin = 150;

  // 检查是否需要两步布局
  const useTwoStep = needsTwoStepLayout(entities, 8);

  if (!useTwoStep) {
    // 传统布局：实体+属性+关系在同一图
    return layoutTraditional(entities, relationships, style, canvas, structure.title);
  }

  // 两步布局
  // 3个实体：关系最多的放底部中间；5+实体：贪心环形排序让相关实体相邻（减少交叉）
  entities = entityCount >= 5
    ? reorderEntitiesForRing(entities, relationships)
    : reorderEntitiesForLayout(entities, relationships);
  
  // 上半部分：实体关系图（根据实体数量调整高度，不绘制属性所以空间加倍）
  const relDiagramHeight = entityCount <= 3 ? 800 : (entityCount <= 5 ? 1200 : 1500);
  
  // 检测枢纽实体，决定使用辐射式还是纯环形
  const hubIdx = detectHubEntity(entities, relationships);
  let positions;
  if (hubIdx >= 0) {
    // 枢纽辐射布局：枢纽在圆心，辐条围环
    positions = computeHubRadialPositions(entities, relationships, hubIdx, canvas.defaultWidth, relDiagramHeight, entityW, entityH, margin);
  } else {
    // 纯环形布局
    positions = computeEntityPositions(entityCount, canvas.defaultWidth, relDiagramHeight, entityW, entityH, margin);
  }
  // 下半部分：实体详细图（每行最多 2 个）
  const detailCols = 2; // 每行 2 个子图
  const detailRows = Math.ceil(entityCount / detailCols);
  const detailWidthPerEntity = (canvas.defaultWidth - 2 * margin) / detailCols;
  const detailHeightPerEntity = entityH + 2 * (attrDistance + attrH) + 100;
  const detailDiagramHeight = detailRows * detailHeightPerEntity + (detailRows - 1) * 50;

  canvas.defaultWidth = Math.max(canvas.defaultWidth, 1400);
  canvas.defaultHeight = relDiagramHeight + detailDiagramHeight + 100;

  const shapes = [];
  const connections = [];

  // 第一步：绘制实体关系图（上半部分）
  const relResult = drawRelationshipDiagram(entities, relationships, positions, style, 0);
  shapes.push(...relResult.shapes);
  connections.push(...relResult.connections);

  // 添加分隔线
  const separatorY = relDiagramHeight + 20;
  shapes.push({
    type: 'line',
    x1: 50, y1: separatorY,
    x2: canvas.defaultWidth - 50, y2: separatorY,
    style: { strokeColor: '#CCCCCC', strokeWidth: 2, dashed: true }
  });

  // 第二步：绘制每个实体的详细图（下半部分，每行最多 2 个）
  const detailStartY = separatorY + 50;

  for (let i = 0; i < entityCount; i++) {
    const row = Math.floor(i / detailCols);
    const col = i % detailCols;
    const entityX = margin + col * detailWidthPerEntity + (detailWidthPerEntity - entityW) / 2;
    const entityY = detailStartY + row * (detailHeightPerEntity + 50) + (detailHeightPerEntity - entityH) / 2;
    
    const detailResult = drawEntityDetailDiagram(entities[i], entityX, entityY, style);
    
    // 调整索引（因为 shapes 数组已经有元素了）
    const offset = shapes.length;
    for (const shape of detailResult.shapes) {
      shapes.push(shape);
    }
    for (const conn of detailResult.connections) {
      connections.push({
        from: conn.from + offset,
        to: conn.to + offset,
        style: conn.style
      });
    }
  }

  return {
    page: { name: structure.title || 'E-R 图', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

/**
 * E-R 图布局原则：实体属性和线条不能遮挡和交叉
 * 
 * 检测并解决以下冲突：
 * 1. 属性椭圆与关系菱形重叠
 * 2. 属性椭圆与连接线交叉
 * 3. 连接线之间交叉
 */

/**
 * 检测两个矩形是否重叠（用于属性椭圆和菱形的碰撞检测）
 */
function rectsOverlap(r1, r2, padding = 5) {
  return !(r1.x + r1.w + padding < r2.x || 
           r2.x + r2.w + padding < r1.x || 
           r1.y + r1.h + padding < r2.y || 
           r2.y + r2.h + padding < r1.y);
}

/**
 * 检测线段是否与矩形相交
 */
function lineIntersectsRect(x1, y1, x2, y2, rect) {
  const { x, y, w, h } = rect;
  
  // 检查线段是否与矩形的四条边相交
  const edges = [
    { x1: x, y1: y, x2: x + w, y2: y },           // 上边
    { x1: x + w, y1: y, x2: x + w, y2: y + h },   // 右边
    { x1: x + w, y1: y + h, x2: x, y2: y + h },   // 下边
    { x1: x, y1: y + h, x2: x, y2: y }            // 左边
  ];
  
  for (const edge of edges) {
    if (lineSegmentsIntersect(x1, y1, x2, y2, edge.x1, edge.y1, edge.x2, edge.y2)) {
      return true;
    }
  }
  
  // 检查线段端点是否在矩形内
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) {
    return true;
  }
  
  return false;
}

/**
 * 检测两条线段是否相交
 */
function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return false;
  
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = -((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)) / d;
  
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * 检测点是否在矩形内
 */
function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && 
         py >= rect.y && py <= rect.y + rect.h;
}

/**
 * 解决属性与菱形的重叠冲突
 * 将重叠的属性沿远离菱形的方向移动
 */
function resolveAttrRhombusOverlap(shapes, rhombusPositions, attrDistance = 70) {
  const attrShapes = shapes.filter(s => s.type === 'ellipse');
  const resolved = [];
  
  for (const attr of attrShapes) {
    let overlap = false;
    let moveDir = null;
    
    for (const rhombus of rhombusPositions) {
      if (rectsOverlap(attr, rhombus)) {
        overlap = true;
        
        // 计算属性相对于菱形的方向
        const attrCx = attr.x + attr.w / 2;
        const attrCy = attr.y + attr.h / 2;
        const rhombusCx = rhombus.x + rhombus.w / 2;
        const rhombusCy = rhombus.y + rhombus.h / 2;
        
        const dx = attrCx - rhombusCx;
        const dy = attrCy - rhombusCy;
        
        // 沿远离菱形的方向移动
        if (Math.abs(dx) > Math.abs(dy)) {
          moveDir = dx > 0 ? 'right' : 'left';
        } else {
          moveDir = dy > 0 ? 'bottom' : 'top';
        }
        break;
      }
    }
    
    if (overlap && moveDir) {
      const shift = attrDistance;
      if (moveDir === 'top') attr.y -= shift;
      else if (moveDir === 'bottom') attr.y += shift;
      else if (moveDir === 'left') attr.x -= shift;
      else if (moveDir === 'right') attr.x += shift;
      
      resolved.push(attr);
    }
  }
  
  return resolved;
}

/**
 * 解决属性与连接线的交叉冲突
 * 将交叉的属性沿垂直于连线的方向移动
 */
function resolveAttrLineOverlap(shapes, connections, entityPositions, attrDistance = 70) {
  const attrShapes = shapes.filter(s => s.type === 'ellipse');
  const resolved = [];
  
  // 构建连接线信息
  const lines = [];
  for (const conn of connections) {
    const fromShape = shapes[conn.from];
    const toShape = shapes[conn.to];
    if (!fromShape || !toShape) continue;
    
    const x1 = fromShape.x + fromShape.w * (conn.style.exitX || 0.5);
    const y1 = fromShape.y + fromShape.h * (conn.style.exitY || 0.5);
    const x2 = toShape.x + toShape.w * (conn.style.entryX || 0.5);
    const y2 = toShape.y + toShape.h * (conn.style.entryY || 0.5);
    
    lines.push({ x1, y1, x2, y2 });
  }
  
  for (const attr of attrShapes) {
    let intersect = false;
    let moveDir = null;
    
    for (const line of lines) {
      if (lineIntersectsRect(line.x1, line.y1, line.x2, line.y2, attr)) {
        intersect = true;
        
        // 计算连线的方向
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        
        // 沿垂直于连线的方向移动
        if (Math.abs(dx) > Math.abs(dy)) {
          // 水平连线，垂直移动
          const attrCy = attr.y + attr.h / 2;
          const lineMidY = (line.y1 + line.y2) / 2;
          moveDir = attrCy < lineMidY ? 'top' : 'bottom';
        } else {
          // 垂直连线，水平移动
          const attrCx = attr.x + attr.w / 2;
          const lineMidX = (line.x1 + line.x2) / 2;
          moveDir = attrCx < lineMidX ? 'left' : 'right';
        }
        break;
      }
    }
    
    if (intersect && moveDir) {
      const shift = attrDistance;
      if (moveDir === 'top') attr.y -= shift;
      else if (moveDir === 'bottom') attr.y += shift;
      else if (moveDir === 'left') attr.x -= shift;
      else if (moveDir === 'right') attr.x += shift;
      
      resolved.push(attr);
    }
  }
  
  return resolved;
}

/**
 * 传统布局（属性 <= 8 时使用）
 */
function layoutTraditional(entities, relationships, style, canvas, title) {
  const shapes = [];
  const connections = [];
  const entityW = style.spacing.entityW || 120;
  const entityH = style.spacing.entityH || 60;
  const attrW = style.spacing.attrW || 110;
  const attrH = style.spacing.attrH || 32;
  const relW = style.spacing.relW || 100;
  const relH = style.spacing.relH || 60;
  const attrGap = style.spacing.attrGap || 12;
  const attrDistance = style.spacing.attrDistance || 70;
  const margin = 150;
  
  // 3/5个实体时，关系最多的放最后（底部中间/中心位置）
  entities = reorderEntitiesForLayout(entities, relationships);
  const entityCount = entities.length;

  const minW = entityCount <= 2 ? 800 : 1400;
  const minH = entityCount <= 2 ? 600 : 900;
  canvas.defaultWidth = Math.max(canvas.defaultWidth, minW);
  canvas.defaultHeight = Math.max(canvas.defaultHeight, minH);

  const positions = computeEntityPositions(entityCount, canvas.defaultWidth, canvas.defaultHeight, entityW, entityH, margin);
  const entityPositions = {};
  const entityShapeIdx = {};
  let shapeIdx = 0;

  // === 第一步：放置实体 ===
  for (let i = 0; i < entityCount; i++) {
    const pos = positions[i];
    const ex = pos.x;
    const ey = pos.y;
    const ecx = ex + entityW / 2;
    const ecy = ey + entityH / 2;
    entityPositions[entities[i].name] = { x: ex, y: ey, w: entityW, h: entityH, cx: ecx, cy: ecy, right: ex + entityW, bottom: ey + entityH };

    shapes.push({
      type: 'rect',
      x: ex, y: ey, w: entityW, h: entityH,
      text: entities[i].name,
      style: {
        fillColor: style.colors.entityFill,
        strokeColor: style.colors.entityStroke,
        strokeWidth: style.colors.entityStrokeWidth,
        fontSize: style.typography.entitySize,
        bold: true,
        fontColor: style.colors.textColor,
        align: 1
      }
    });
    entityShapeIdx[i] = shapeIdx;
    shapeIdx++;
  }

  // === 第二步：计算菱形位置（用于碰撞检测）===
  const entityNameToIdx = {};
  entities.forEach((e, i) => { entityNameToIdx[e.name] = i; });

  const rhombusPositions = [];
  const relConnections = []; // 关系连线信息

  for (const rel of relationships) {
    const fromIdx = entityNameToIdx[rel.from];
    const toIdx = entityNameToIdx[rel.to];
    if (fromIdx === undefined || toIdx === undefined) continue;

    const fromPos = entityPositions[rel.from];
    const toPos = entityPositions[rel.to];

    const relCx = (fromPos.cx + toPos.cx) / 2;
    const relCy = (fromPos.cy + toPos.cy) / 2;
    const relX = relCx - relW / 2;
    const relY = relCy - relH / 2;

    rhombusPositions.push({ x: relX, y: relY, w: relW, h: relH, cx: relCx, cy: relCy });

    // 记录关系连线（实体中心到菱形中心）
    const connDir = getConnectionDirection(fromPos, toPos);
    relConnections.push({
      from: fromPos, to: toPos,
      rhombus: { x: relX, y: relY, w: relW, h: relH, cx: relCx, cy: relCy },
      dir: connDir
    });
  }

  // === 第三步：放置属性（带碰撞检测）===
  for (let i = 0; i < entityCount; i++) {
    const pos = positions[i];
    const ex = pos.x;
    const ey = pos.y;
    const epos = entityPositions[entities[i].name];
    const ecx = epos.cx;
    const ecy = epos.cy;

    const attrs = entities[i].attributes || [];
    const attrCount = attrs.length;
    
    const allDirs = ['top', 'bottom', 'left', 'right'];
    const relationDirs = getRelationDirections(entities[i].name, entities, relationships, positions);
    
    // 优先使用朝外方向（基于实体在布局中的位置）
    const entityDirection = getEntityDirection(i, entityCount);
    const outwardDirs = getOutwardDirections(entityDirection);
    
    // 从朝外方向中排除关系方向
    let availableDirs = outwardDirs.filter(dir => !relationDirs.includes(dir));
    
    // 如果朝外方向不够，添加朝内方向
    if (availableDirs.length === 0) {
      availableDirs = ['top', 'bottom'];
    } else {
      const maxPerDir = 4;
      const minDirsNeeded = Math.ceil(attrCount / maxPerDir);
      if (availableDirs.length < minDirsNeeded) {
        // 添加剩余方向（朝内方向）
        const remainingDirs = allDirs.filter(dir => !availableDirs.includes(dir) && !relationDirs.includes(dir));
        availableDirs = [...availableDirs, ...remainingDirs].slice(0, Math.max(minDirsNeeded, availableDirs.length));
      }
    }
    
    const perDir = Math.floor(attrCount / availableDirs.length);
    const remainder = attrCount % availableDirs.length;
    
    const dirAttrs = {};
    let attrIdx = 0;
    availableDirs.forEach((dir, idx) => {
      const count = perDir + (idx < remainder ? 1 : 0);
      dirAttrs[dir] = attrs.slice(attrIdx, attrIdx + count);
      attrIdx += count;
    });

    // 对每个方向，计算安全距离（避免与菱形/连线碰撞）
    for (const dir of availableDirs) {
      const dirAttrList = dirAttrs[dir];
      if (!dirAttrList || dirAttrList.length === 0) continue;
      const count = dirAttrList.length;

      // 计算属性组的边界
      let attrBounds;
      if (dir === 'top' || dir === 'bottom') {
        const totalW = count * attrW + (count - 1) * attrGap;
        const startX = ecx - totalW / 2;
        attrBounds = { x: startX, y: 0, w: totalW, h: attrH };
      } else {
        const totalH = count * attrH + (count - 1) * attrGap;
        const startY = ecy - totalH / 2;
        attrBounds = { x: 0, y: startY, w: attrW, h: totalH };
      }

      // 计算安全距离：检测与菱形和连线的碰撞
      let safeDistance = attrDistance;
      const maxIterations = 10;
      
      for (let iter = 0; iter < maxIterations; iter++) {
        let collision = false;
        
        // 检测与菱形的碰撞
        for (const rhombus of rhombusPositions) {
          if (dir === 'top' || dir === 'bottom') {
            const attrY = dir === 'top' ? (ey - attrH - safeDistance) : (ey + entityH + safeDistance);
            const testBounds = { x: attrBounds.x, y: attrY, w: attrBounds.w, h: attrBounds.h };
            if (rectsOverlap(testBounds, rhombus, 5)) {
              collision = true;
              break;
            }
          } else {
            const attrX = dir === 'left' ? (ex - attrW - safeDistance) : (ex + entityW + safeDistance);
            const testBounds = { x: attrX, y: attrBounds.y, w: attrBounds.w, h: attrBounds.h };
            if (rectsOverlap(testBounds, rhombus, 5)) {
              collision = true;
              break;
            }
          }
        }
        
        // 检测与关系连线的碰撞
        if (!collision) {
          for (const relConn of relConnections) {
            const { from, to, rhombus, dir: relDir } = relConn;
            
            // 计算连线的方向向量
            const dx = to.cx - from.cx;
            const dy = to.cy - from.cy;
            const isDiagonal = Math.abs(dx) > 50 && Math.abs(dy) > 50;
            
            // 对于斜向连线，跳过碰撞检测（避免过度推远属性）
            if (isDiagonal) continue;
            
            if (dir === 'top' || dir === 'bottom') {
              const attrY = dir === 'top' ? (ey - attrH - safeDistance) : (ey + entityH + safeDistance);
              // 检查连线是否穿过属性行的 y 范围
              const lineY1 = Math.min(from.cy, to.cy, rhombus.cy);
              const lineY2 = Math.max(from.cy, to.cy, rhombus.cy);
              if (attrY >= lineY1 - attrH && attrY <= lineY2 + attrH) {
                // 检查 x 范围是否重叠
                const lineX1 = Math.min(from.cx, to.cx, rhombus.cx);
                const lineX2 = Math.max(from.cx, to.cx, rhombus.cx);
                if (attrBounds.x < lineX2 + attrW && attrBounds.x + attrBounds.w > lineX1 - attrW) {
                  collision = true;
                  break;
                }
              }
            } else {
              const attrX = dir === 'left' ? (ex - attrW - safeDistance) : (ex + entityW + safeDistance);
              const lineX1 = Math.min(from.cx, to.cx, rhombus.cx);
              const lineX2 = Math.max(from.cx, to.cx, rhombus.cx);
              if (attrX >= lineX1 - attrW && attrX <= lineX2 + attrW) {
                const lineY1 = Math.min(from.cy, to.cy, rhombus.cy);
                const lineY2 = Math.max(from.cy, to.cy, rhombus.cy);
                if (attrBounds.y < lineY2 + attrH && attrBounds.y + attrBounds.h > lineY1 - attrH) {
                  collision = true;
                  break;
                }
              }
            }
          }
        }
        
        if (!collision) break;
        safeDistance += 15; // 每次增加 15px（更精细的调整）
      }

      // 放置属性（使用安全距离）
      if (dir === 'top' || dir === 'bottom') {
        const totalW = count * attrW + (count - 1) * attrGap;
        const startX = ecx - totalW / 2;
        const y = dir === 'top' ? (ey - attrH - safeDistance) : (ey + entityH + safeDistance);

        for (let j = 0; j < count; j++) {
          const ax = startX + j * (attrW + attrGap);
          const ay = y;
          shapes.push({
            type: 'ellipse',
            x: ax, y: ay, w: attrW, h: attrH,
            text: dirAttrList[j].name,
            style: {
              fillColor: style.colors.attrFill,
              strokeColor: style.colors.attrStroke,
              strokeWidth: style.colors.attrStrokeWidth,
              fontSize: style.typography.attrSize,
              fontColor: style.colors.textColor,
              align: 1,
              underline: dirAttrList[j].type === 'PK'
            }
          });
          connections.push({
            from: shapeIdx, to: entityShapeIdx[i],
            style: {
              endArrow: 'none',
              strokeColor: style.colors.lineColor,
              strokeWidth: style.colors.lineWidth,
              exitX: 0.5, exitY: dir === 'top' ? 1 : 0,
              entryX: 0.5, entryY: dir === 'top' ? 0 : 1
            }
          });
          shapeIdx++;
        }
      } else {
        const totalH = count * attrH + (count - 1) * attrGap;
        const startY = ecy - totalH / 2;
        const x = dir === 'left' ? (ex - attrW - safeDistance) : (ex + entityW + safeDistance);

        for (let j = 0; j < count; j++) {
          const ax = x;
          const ay = startY + j * (attrH + attrGap);
          shapes.push({
            type: 'ellipse',
            x: ax, y: ay, w: attrW, h: attrH,
            text: dirAttrList[j].name,
            style: {
              fillColor: style.colors.attrFill,
              strokeColor: style.colors.attrStroke,
              strokeWidth: style.colors.attrStrokeWidth,
              fontSize: style.typography.attrSize,
              fontColor: style.colors.textColor,
              align: 1,
              underline: dirAttrList[j].type === 'PK'
            }
          });
          connections.push({
            from: shapeIdx, to: entityShapeIdx[i],
            style: {
              endArrow: 'none',
              strokeColor: style.colors.lineColor,
              strokeWidth: style.colors.lineWidth,
              exitX: dir === 'left' ? 1 : 0, exitY: 0.5,
              entryX: dir === 'left' ? 0 : 1, entryY: 0.5
            }
          });
          shapeIdx++;
        }
      }
    }
  }

  // === 第四步：放置菱形和关系连线 ===
  for (const rel of relationships) {
    const fromIdx = entityNameToIdx[rel.from];
    const toIdx = entityNameToIdx[rel.to];
    if (fromIdx === undefined || toIdx === undefined) continue;

    const fromPos = entityPositions[rel.from];
    const toPos = entityPositions[rel.to];

    const relCx = (fromPos.cx + toPos.cx) / 2;
    const relCy = (fromPos.cy + toPos.cy) / 2;
    const relX = relCx - relW / 2;
    const relY = relCy - relH / 2;

    shapes.push({
      type: 'rhombus',
      x: relX, y: relY, w: relW, h: relH,
      text: rel.name,
      style: {
        fillColor: style.colors.relFill,
        strokeColor: style.colors.relStroke,
        strokeWidth: style.colors.relStrokeWidth,
        fontSize: style.typography.relSize,
        fontColor: style.colors.textColor,
        align: 1
      }
    });
    const relShapeIdx = shapes.length - 1;

    const connDir = getConnectionDirection(fromPos, toPos);
    let fromExitX, fromExitY, toExitX, toExitY;
    let relEntryFromX, relEntryFromY, relEntryToX, relEntryToY;

    if (connDir === 'horizontal') {
      fromExitX = 1; fromExitY = 0.5;
      toExitX = 0; toExitY = 0.5;
      relEntryFromX = 0; relEntryFromY = 0.5;
      relEntryToX = 1; relEntryToY = 0.5;
    } else if (connDir === 'horizontal-reverse') {
      fromExitX = 0; fromExitY = 0.5;
      toExitX = 1; toExitY = 0.5;
      relEntryFromX = 1; relEntryFromY = 0.5;
      relEntryToX = 0; relEntryToY = 0.5;
    } else if (connDir === 'vertical') {
      fromExitX = 0.5; fromExitY = 1;
      toExitX = 0.5; toExitY = 0;
      relEntryFromX = 0.5; relEntryFromY = 0;
      relEntryToX = 0.5; relEntryToY = 1;
    } else {
      fromExitX = 0.5; fromExitY = 0;
      toExitX = 0.5; toExitY = 1;
      relEntryFromX = 0.5; relEntryFromY = 1;
      relEntryToX = 0.5; relEntryToY = 0;
    }

    connections.push({
      from: entityShapeIdx[fromIdx], to: relShapeIdx,
      style: { endArrow: 'none', strokeColor: style.colors.lineColor, strokeWidth: style.colors.lineWidth,
        exitX: fromExitX, exitY: fromExitY, entryX: relEntryFromX, entryY: relEntryFromY }
    });
    connections.push({
      from: entityShapeIdx[toIdx], to: relShapeIdx,
      style: { endArrow: 'none', strokeColor: style.colors.lineColor, strokeWidth: style.colors.lineWidth,
        exitX: toExitX, exitY: toExitY, entryX: relEntryToX, entryY: relEntryToY }
    });

    const fromLineMidX = (fromPos.cx + relX + relW / 2) / 2;
    const fromLineMidY = (fromPos.cy + relCy) / 2;
    let fromLabelX = fromLineMidX;
    let fromLabelY = fromLineMidY;
    if (connDir === 'horizontal' || connDir === 'horizontal-reverse') {
      fromLabelY -= 15;
    } else {
      fromLabelX += 15;
    }
    shapes.push({
      type: 'text', x: fromLabelX - 10, y: fromLabelY - 10, w: 20, h: 20,
      text: rel.fromCardinality || 'n',
      style: { fontSize: style.typography.cardinalitySize || 14, fontColor: style.colors.textColor, align: 1 }
    });
    shapeIdx++;

    const toLineMidX = (toPos.cx + relX + relW / 2) / 2;
    const toLineMidY = (toPos.cy + relCy) / 2;
    let toLabelX = toLineMidX;
    let toLabelY = toLineMidY;
    if (connDir === 'horizontal' || connDir === 'horizontal-reverse') {
      toLabelY -= 15;
    } else {
      toLabelX += 15;
    }
    shapes.push({
      type: 'text', x: toLabelX - 10, y: toLabelY - 10, w: 20, h: 20,
      text: rel.toCardinality || '1',
      style: { fontSize: style.typography.cardinalitySize || 14, fontColor: style.colors.textColor, align: 1 }
    });
    shapeIdx++;
  }

  // 调整画布大小
  let maxX = 0, maxY = 0;
  for (const shape of shapes) {
    const right = shape.x + shape.w;
    const bottom = shape.y + shape.h;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  canvas.defaultWidth = Math.max(canvas.defaultWidth, maxX + 100);
  canvas.defaultHeight = Math.max(canvas.defaultHeight, maxY + 100);

  return {
    page: { name: title || 'E-R 图', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutErd, parseNaturalLanguage, parseMarkdown, needsTwoStepLayout };
}
