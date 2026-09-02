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
      const cardinality = relMatch[2].trim().replace(/m/g, 'n');
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
function needsTwoStepLayout(entities, maxAttrs = 8) {
  for (const entity of entities) {
    if ((entity.attributes || []).length > maxAttrs) {
      return true;
    }
  }
  return false;
}

/**
 * 计算实体几何位置
 */
function computeEntityPositions(entityCount, canvasW, canvasH, entityW, entityH, margin) {
  const positions = [];
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  const spreadX = Math.min(280, (canvasW - 2 * margin - entityW) / 2 * 0.8);
  const spreadY = Math.min(200, (canvasH - 2 * margin - entityH) / 2 * 0.8);

  if (entityCount === 1) {
    positions.push({ x: centerX - entityW / 2, y: centerY - entityH / 2 });
  } else if (entityCount === 2) {
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY - entityH / 2 });
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY - entityH / 2 });
  } else if (entityCount === 3) {
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 });
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 });
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY + spreadY - entityH / 2 });
  } else if (entityCount === 4) {
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 });
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY - spreadY - entityH / 2 });
    positions.push({ x: centerX - spreadX - entityW / 2, y: centerY + spreadY - entityH / 2 });
    positions.push({ x: centerX + spreadX - entityW / 2, y: centerY + spreadY - entityH / 2 });
  } else {
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

function getEntityDirection(entityIndex, entityCount) {
  if (entityCount <= 2) return entityIndex === 0 ? 'left' : 'right';
  if (entityCount === 3) {
    if (entityIndex === 0) return 'top-left';
    if (entityIndex === 1) return 'top-right';
    return 'bottom-right';
  }
  if (entityCount === 4) {
    if (entityIndex === 0) return 'top-left';
    if (entityIndex === 1) return 'top-right';
    if (entityIndex === 2) return 'bottom-left';
    return 'bottom-right';
  }
  return 'center';
}

function getOutwardDirections(direction) {
  switch (direction) {
    case 'left': return ['left'];
    case 'right': return ['right'];
    case 'top-left': return ['top', 'left'];
    case 'top-right': return ['top', 'right'];
    case 'bottom-left': return ['bottom', 'left'];
    case 'bottom-right': return ['bottom', 'right'];
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
  const attrW = style.spacing.attrW || 70;
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

  const entities = parsed.entities;
  const relationships = parsed.relationships;
  const entityCount = entities.length;

  const entityW = style.spacing.entityW || 120;
  const entityH = style.spacing.entityH || 60;
  const attrW = style.spacing.attrW || 70;
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
  // 上半部分：实体关系图（高度约 500px）
  const relDiagramHeight = 500;
  // 下半部分：实体详细图（每个实体需要的高度）
  const maxAttrsPerEntity = Math.max(...entities.map(e => (e.attributes || []).length));
  const detailHeightPerEntity = entityH + 2 * (attrDistance + attrH) + 100; // 实体 + 上下属性 + 间距
  const detailDiagramHeight = detailHeightPerEntity + 100; // 加间距

  canvas.defaultWidth = Math.max(canvas.defaultWidth, 1400);
  canvas.defaultHeight = relDiagramHeight + detailDiagramHeight + 100; // 总高度

  const shapes = [];
  const connections = [];

  // 第一步：绘制实体关系图（上半部分）
  const positions = computeEntityPositions(entityCount, canvas.defaultWidth, relDiagramHeight, entityW, entityH, margin);
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

  // 第二步：绘制每个实体的详细图（下半部分）
  const detailStartY = separatorY + 50;
  const entitySpacing = (canvas.defaultWidth - 2 * margin) / entityCount;

  for (let i = 0; i < entityCount; i++) {
    const entityX = margin + i * entitySpacing + (entitySpacing - entityW) / 2;
    const entityY = detailStartY + (detailHeightPerEntity - entityH) / 2;
    
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
 * 传统布局（属性 <= 8 时使用）
 */
function layoutTraditional(entities, relationships, style, canvas, title) {
  const shapes = [];
  const connections = [];
  const entityW = style.spacing.entityW || 120;
  const entityH = style.spacing.entityH || 60;
  const attrW = style.spacing.attrW || 70;
  const attrH = style.spacing.attrH || 32;
  const relW = style.spacing.relW || 100;
  const relH = style.spacing.relH || 60;
  const attrGap = style.spacing.attrGap || 12;
  const attrDistance = style.spacing.attrDistance || 70;
  const margin = 150;
  const entityCount = entities.length;

  const minW = entityCount <= 2 ? 800 : 1400;
  const minH = entityCount <= 2 ? 600 : 900;
  canvas.defaultWidth = Math.max(canvas.defaultWidth, minW);
  canvas.defaultHeight = Math.max(canvas.defaultHeight, minH);

  const positions = computeEntityPositions(entityCount, canvas.defaultWidth, canvas.defaultHeight, entityW, entityH, margin);
  const entityPositions = {};
  const entityShapeIdx = {};
  let shapeIdx = 0;

  // 绘制实体和属性
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

    // 属性：根据数量智能分布
    const attrs = entities[i].attributes || [];
    const attrCount = attrs.length;
    
    // 智能分布策略：
    // <= 4 个：全部放上方
    // 5-8 个：上方和下方
    // > 8 个：四个方向（但传统布局最多8个，所以这里用上方+下方）
    let outwardDirs = [];
    if (attrCount <= 4) {
      outwardDirs = ['top'];
    } else if (attrCount <= 8) {
      outwardDirs = ['top', 'bottom'];
    } else {
      outwardDirs = ['top', 'bottom', 'left', 'right'];
    }
    
    const perDir = Math.ceil(attrCount / outwardDirs.length);
    const dirAttrs = {};
    outwardDirs.forEach((dir, idx) => {
      const start = idx * perDir;
      const end = Math.min(start + perDir, attrCount);
      dirAttrs[dir] = attrs.slice(start, end);
    });

    for (const dir of outwardDirs) {
      const dirAttrList = dirAttrs[dir];
      if (!dirAttrList || dirAttrList.length === 0) continue;
      const count = dirAttrList.length;

      if (dir === 'top' || dir === 'bottom') {
        const totalW = count * attrW + (count - 1) * attrGap;
        const startX = ecx - totalW / 2;
        const y = dir === 'top' ? (ey - attrH - attrDistance) : (ey + entityH + attrDistance);

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
        const x = dir === 'left' ? (ex - attrW - attrDistance) : (ex + entityW + attrDistance);

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

  // 关系菱形
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
