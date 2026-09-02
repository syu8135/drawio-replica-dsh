/**
 * layout_engine.js v3
 * 模板驱动的自动布局引擎
 * 
 * 支持模板：layered（分层图）、radial（同心圆图）、cycle-segmented（分段同心圆图）
 * 模板路径：../templates/layered.json, ../templates/radial.json, ../templates/cycle-segmented.json
 */

const fs = require('fs');
const path = require('path');

// ============ 模板加载 ============
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate(templateId) {
  const templatePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`模板不存在: ${templateId}，可用模板: ${getAvailableTemplates().join(', ')}`);
  }
  return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
}

function getAvailableTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

// ============ 颜色解析 ============
function resolveColor(template, colorKey) {
  const colors = template.style.colors;
  return colors[colorKey] || '#000000';
}

// ============ 智能适配 ============
function autoAdjust(structure, template) {
  const canvas = { ...template.canvas };
  const spacing = { ...template.style.spacing };
  const typography = { ...template.style.typography };

  const layers = structure.layers || [];
  const layerCount = layers.length;

  // 根据层数调整画布高度
  if (layerCount > 0) {
    const totalLayerHeight = layerCount * canvas.layerHeight + (layerCount - 1) * spacing.layerGap;
    canvas.defaultHeight = Math.max(canvas.defaultHeight, totalLayerHeight + spacing.padding * 2 + 100);
  }

  // 根据每层元素数量调整字号
  for (const layer of layers) {
    const maxItems = Math.max(
      (layer.items || []).length,
      (layer.params || []).length,
      (layer.mechanisms || []).length
    );
    if (maxItems > 6) {
      typography.itemSize = Math.min(typography.itemSize, 9);
      typography.paramSize = Math.min(typography.paramSize, 8);
    } else if (maxItems > 4) {
      typography.itemSize = Math.min(typography.itemSize, 10);
    }
  }

  // 根据层数调整间距
  if (layerCount > 5) {
    spacing.layerGap = Math.min(spacing.layerGap, 15);
  }

  return { canvas, spacing, typography };
}

// ============ 分层布局引擎 ============
function layoutLayered(structure) {
  const templateId = structure.template || 'layered';
  const template = loadTemplate(templateId);
  const { canvas, spacing, typography } = autoAdjust(structure, template);

  const shapes = [];
  const connections = [];
  let currentY = spacing.padding;

  // 标题
  if (structure.title) {
    shapes.push({
      type: 'text',
      x: (canvas.defaultWidth - 500) / 2,
      y: currentY,
      w: 500,
      h: 40,
      text: structure.title,
      style: {
        fontSize: typography.titleSize,
        bold: true,
        fontColor: resolveColor(template, 'text'),
        align: 1
      }
    });
    currentY += 50;
  }

  const layers = structure.layers || [];
  const layerIds = [];
  const layerWidth = canvas.defaultWidth * canvas.layerWidthRatio;
  const layerStartX = spacing.padding;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    layerIds.push(layer.id || `layer_${i}`);

    const layerHeight = canvas.layerHeight;
    const bgColors = template.style.colors.layerBg;
    const bgColor = bgColors[i % bgColors.length];

    // 层容器
    shapes.push({
      type: template.structure.layerShape,
      x: layerStartX,
      y: currentY,
      w: layerWidth,
      h: layerHeight,
      text: '',
      style: {
        fillColor: bgColor,
        strokeColor: '#C08080',
        strokeWidth: template.style.effects.strokeWidth
      }
    });

    // 层标题（右侧）
    if (layer.title) {
      shapes.push({
        type: 'text',
        x: layerStartX + layerWidth + 15,
        y: currentY + layerHeight / 2 - 15,
        w: 150,
        h: 30,
        text: layer.title,
        style: {
          fontSize: typography.layerTitleSize,
          bold: true,
          fontColor: resolveColor(template, 'text')
        }
      });
    }

    // 层副标题
    if (layer.subtitle) {
      shapes.push({
        type: 'text',
        x: layerStartX + layerWidth + 15,
        y: currentY + layerHeight / 2 + 15,
        w: 150,
        h: 25,
        text: layer.subtitle,
        style: {
          fontSize: typography.paramSize,
          fontColor: resolveColor(template, 'text')
        }
      });
    }

    // 左侧标签
    if (layer.leftLabel) {
      shapes.push({
        type: 'text',
        x: 10,
        y: currentY + layerHeight / 2 - 12,
        w: 50,
        h: 25,
        text: layer.leftLabel,
        style: {
          fontSize: typography.paramSize,
          fontColor: resolveColor(template, 'text')
        }
      });
    }

    // 主项目（items）- 垂直排列
    const items = layer.items || [];
    const itemW = canvas.itemWidth;
    const itemH = canvas.itemHeight;
    const itemX = layerStartX + 30;
    let itemY = currentY + 15;

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const itemType = item.type || template.structure.itemShape;
      shapes.push({
        type: itemType,
        x: itemX,
        y: itemY + j * (itemH + 5),
        w: itemW,
        h: itemH,
        text: item.text,
        style: {
          fillColor: resolveColor(template, 'itemFillColor'),
          strokeColor: '#600000',
          strokeWidth: template.style.effects.itemStrokeWidth,
          fontSize: typography.itemSize,
          bold: template.rules.itemBold,
          fontColor: resolveColor(template, 'itemFontColor'),
          align: 1,
          ...(item.style || {})
        }
      });
    }

    // 参数（params）- 水平排列
    const params = layer.params || [];
    const paramW = canvas.paramWidth;
    const paramH = canvas.paramHeight;
    const paramX = layerStartX + itemW + 50;
    const paramY = currentY + 15;

    for (let k = 0; k < params.length; k++) {
      const param = params[k];
      const paramType = param.type || template.structure.paramShape;
      shapes.push({
        type: paramType,
        x: paramX + k * (paramW + 10),
        y: paramY,
        w: paramW,
        h: paramH,
        text: param.text,
        style: {
          fillColor: resolveColor(template, 'paramFillColor'),
          strokeColor: '#B0D0E0',
          strokeWidth: template.style.effects.paramStrokeWidth,
          fontSize: typography.paramSize,
          fontColor: resolveColor(template, 'paramFontColor'),
          align: 1,
          ...(param.style || {})
        }
      });
    }

    // 备注
    if (layer.note) {
      const noteW = Math.min(400, layerWidth - itemW - 60);
      shapes.push({
        type: 'rect',
        x: paramX,
        y: currentY + 55,
        w: noteW,
        h: 30,
        text: layer.note,
        style: {
          fillColor: resolveColor(template, 'noteFillColor'),
          strokeColor: '#A0C0D0',
          strokeWidth: 0.8,
          fontSize: typography.noteSize,
          fontColor: resolveColor(template, 'noteFontColor'),
          align: 1
        }
      });
    }

    // 机制（mechanisms）- 水平排列在底部
    const mechanisms = layer.mechanisms || [];
    const mechW = canvas.mechanismWidth;
    const mechH = canvas.mechanismHeight;
    const mechX = layerStartX + itemW + 120;
    const mechY = currentY + layerHeight - mechH - 15;

    for (let m = 0; m < mechanisms.length; m++) {
      const mech = mechanisms[m];
      const mechType = mech.type || template.structure.mechanismShape;
      shapes.push({
        type: mechType,
        x: mechX + m * (mechW + 10),
        y: mechY,
        w: mechW,
        h: mechH,
        text: mech.text,
        style: {
          fillColor: resolveColor(template, 'mechanismFillColor'),
          strokeColor: '#C0C0C0',
          strokeWidth: 0.8,
          fontSize: typography.mechanismSize,
          fontColor: resolveColor(template, 'mechanismFontColor'),
          align: 1,
          ...(mech.style || {})
        }
      });
    }

    currentY += layerHeight + spacing.layerGap;
  }

  // 侧边栏
  if (structure.sidebar) {
    const sidebar = structure.sidebar;
    const sbW = canvas.sidebarWidth;
    const sbX = canvas.defaultWidth - sbW - 20;
    let sbY = spacing.padding + 50;

    // 侧边栏标题（箭头形状）
    if (sidebar.title) {
      shapes.push({
        type: template.structure.arrowShape,
        x: sbX,
        y: sbY,
        w: sbW,
        h: 80,
        text: sidebar.title,
        style: {
          fillColor: resolveColor(template, 'itemFillColor'),
          strokeColor: '#600000',
          fontSize: typography.itemSize + 2,
          bold: true,
          fontColor: resolveColor(template, 'itemFontColor'),
          align: 1
        }
      });
      sbY += 100;
    }

    // 分类
    if (sidebar.categories && sidebar.categories.length > 0) {
      const catW = (sbW - 20) / sidebar.categories.length;
      for (let i = 0; i < sidebar.categories.length; i++) {
        shapes.push({
          type: 'rect',
          x: sbX + i * (catW + 10),
          y: sbY,
          w: catW,
          h: 60,
          text: sidebar.categories[i],
          style: {
            fillColor: '#FFFFFF',
            strokeColor: '#000000',
            strokeWidth: 1.5,
            fontSize: typography.paramSize,
            align: 1
          }
        });
      }
      sbY += 80;
    }

    // 属性列表
    if (sidebar.properties && sidebar.properties.length > 0) {
      const propW = (sbW - 20) / sidebar.properties.length;
      const propH = 120;
      for (let i = 0; i < sidebar.properties.length; i++) {
        shapes.push({
          type: 'rect',
          x: sbX + i * (propW + 10),
          y: sbY,
          w: propW,
          h: propH,
          text: sidebar.properties[i],
          style: {
            fillColor: resolveColor(template, 'paramFillColor'),
            strokeColor: '#B0D0E0',
            fontSize: typography.mechanismSize,
            align: 1
          }
        });
      }
    }
  }

  return {
    page: {
      name: structure.title || 'Diagram',
      width: canvas.defaultWidth,
      height: Math.max(currentY + spacing.padding, canvas.defaultHeight)
    },
    shapes,
    connections
  };
}

// ============ 径向布局引擎 ============
function layoutRadial(structure) {
  const templateId = structure.template || 'radial';
  const template = loadTemplate(templateId);
  const { canvas, spacing } = autoAdjust(structure, template);

  const shapes = [];
  const connections = [];

  const centerX = canvas.defaultWidth / 2;
  const centerY = canvas.defaultHeight / 2;
  const rings = structure.rings || [];
  const labelOffset = spacing.labelOffset || 0.7;

  // 从外到内绘制圆环
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    const radius = ring.radius || (canvas.maxRadius - i * canvas.radiusStep);
    const ringColors = template.style.colors.ringColors;
    const ringStrokeColors = template.style.colors.ringStrokeColors;

    shapes.push({
      type: template.structure.ringShape,
      x: centerX - radius,
      y: centerY - radius,
      w: radius * 2,
      h: radius * 2,
      text: '',
      style: {
        fillColor: ringColors[i % ringColors.length],
        strokeColor: ringStrokeColors[i % ringStrokeColors.length],
        strokeWidth: template.style.effects.strokeWidth,
        dashed: ring.dashed || (template.style.effects.dashedOuter && i === rings.length - 1)
      }
    });

    // 环上标注
    if (ring.labels) {
      for (const label of ring.labels) {
        const angle = (label.angle || 0) * Math.PI / 180;
        const offset = labelOffset;
        const lx = centerX + Math.cos(angle) * radius * offset;
        const ly = centerY + Math.sin(angle) * radius * offset;

        let fontColor = resolveColor(template, 'labelFontColor');
        if (label.style && label.style.fontColor === '#00B478') {
          fontColor = resolveColor(template, 'highlightLabelColor');
        } else if (label.style && label.style.fontColor === '#C8A032') {
          fontColor = resolveColor(template, 'goldLabelColor');
        }

        shapes.push({
          type: 'text',
          x: lx - 40,
          y: ly - 15,
          w: 80,
          h: 30,
          text: label.text,
          style: {
            fontSize: template.style.typography.ringLabelSize,
            fontColor: fontColor,
            bold: label.bold || false,
            align: 1,
            ...(label.style || {})
          }
        });
      }
    }
  }

  // 中心元素
  if (structure.center) {
    shapes.push({
      type: structure.center.type || template.structure.centerShape,
      x: centerX - canvas.centerWidth / 2,
      y: centerY - canvas.centerHeight / 2,
      w: canvas.centerWidth,
      h: canvas.centerHeight,
      text: structure.center.text,
      style: {
        fillColor: resolveColor(template, 'centerFillColor'),
        strokeColor: resolveColor(template, 'centerFillColor'),
        fontSize: template.style.typography.centerSize,
        bold: template.rules.centerBold,
        fontColor: resolveColor(template, 'centerFontColor'),
        align: 1,
        ...(structure.center.style || {})
      }
    });
  }

  return {
    page: {
      name: structure.title || 'Radial',
      width: canvas.defaultWidth,
      height: canvas.defaultHeight
    },
    shapes,
    connections
  };
}

// ============ 分段同心圆布局引擎 ============
function layoutCycleSegmented(structure) {
  const templateId = structure.template || 'cycle-segmented';
  const template = loadTemplate(templateId);
  const canvas = { ...template.canvas };

  const shapes = [];
  const connections = [];

  const centerX = canvas.defaultWidth / 2;
  const centerY = canvas.defaultHeight / 2;

  // 绘制同心圆环（从外到内）
  const rings = structure.rings || [];
  const ringColors = [
    resolveColor(template, 'outerRing'),
    resolveColor(template, 'secondRing'),
    resolveColor(template, 'thirdRing')
  ];

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const radius = ring.radius || (canvas.maxRadius - i * canvas.radiusStep);
    const ringWidth = canvas.ringWidth;

    // 绘制圆环（用两个椭圆叠加实现环效果）
    const outerRadius = radius + ringWidth / 2;
    const innerRadius = radius - ringWidth / 2;

    // 外圆（填充色）
    shapes.push({
      type: 'oval',
      x: centerX - outerRadius,
      y: centerY - outerRadius,
      w: outerRadius * 2,
      h: outerRadius * 2,
      text: '',
      style: {
        fillColor: ringColors[i % ringColors.length],
        strokeColor: '#FFFFFF',
        strokeWidth: 2
      }
    });

    // 内圆（白色，形成环效果）
    if (innerRadius > 0) {
      shapes.push({
        type: 'oval',
        x: centerX - innerRadius,
        y: centerY - innerRadius,
        w: innerRadius * 2,
        h: innerRadius * 2,
        text: '',
        style: {
          fillColor: '#FFFFFF',
          strokeColor: '#FFFFFF',
          strokeWidth: 0
        }
      });
    }

    // 放置环上文字
    if (ring.labels) {
      for (const label of ring.labels) {
        const angle = (label.angle || 0) * Math.PI / 180;
        const labelRadius = radius;
        const lx = centerX + Math.cos(angle) * labelRadius - 60;
        const ly = centerY + Math.sin(angle) * labelRadius - 15;

        // 合并模板默认样式和标签自定义样式
        const labelStyle = {
          fontSize: template.style.typography.ringLabelSize,
          fontColor: resolveColor(template, 'ringLabelColor'),
          bold: label.bold || false,
          align: 1,
          rotation: label.rotation || 0,
          ...(label.style || {})
        };

        shapes.push({
          type: 'text',
          x: lx,
          y: ly,
          w: 120,
          h: 30,
          text: label.text,
          style: labelStyle
        });
      }
    }
  }

  // 绘制中心圆
  if (structure.center) {
    const centerW = canvas.centerWidth;
    const centerH = canvas.centerHeight;

    shapes.push({
      type: 'oval',
      x: centerX - centerW / 2,
      y: centerY - centerH / 2,
      w: centerW,
      h: centerH,
      text: '',
      style: {
        fillColor: resolveColor(template, 'centerFillColor'),
        strokeColor: '#FFFFFF',
        strokeWidth: 2
      }
    });

    // 中心主标题
    if (structure.center.text) {
      shapes.push({
        type: 'text',
        x: centerX - 80,
        y: centerY - 30,
        w: 160,
        h: 40,
        text: structure.center.text,
        style: {
          fontSize: template.style.typography.centerMainSize,
          fontColor: resolveColor(template, 'centerFontColor'),
          bold: true,
          align: 1
        }
      });
    }

    // 中心副标题
    if (structure.center.subtitle) {
      shapes.push({
        type: 'text',
        x: centerX - 100,
        y: centerY + 20,
        w: 200,
        h: 30,
        text: structure.center.subtitle,
        style: {
          fontSize: template.style.typography.centerSubSize,
          fontColor: resolveColor(template, 'centerFontColor'),
          align: 1
        }
      });
    }
  }

  return {
    page: {
      name: structure.title || 'Cycle Diagram',
      width: canvas.defaultWidth,
      height: canvas.defaultHeight
    },
    shapes,
    connections
  };
}

// ============ 流程图布局引擎 ============
function layoutFlowchart(structure) {
  const templateId = structure.template || 'flowchart';
  const template = loadTemplate(templateId);
  const canvas = { ...template.canvas };
  const spacing = { ...template.style.spacing };

  const shapes = [];
  const connections = [];

  const nodes = structure.nodes || [];
  const flows = structure.flows || [];
  const nodeW = template.structure.nodeWidth;
  const nodeH = template.structure.nodeHeight;

  // 自动计算列数和行数
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const startX = spacing.padding;
  const startY = spacing.padding + 50; // 标题下方

  // 绘制节点
  nodes.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (nodeW + spacing.nodeGap);
    const y = startY + row * (nodeH + spacing.rowGap);

    let shapeType = template.structure.processShape;
    if (node.type === 'start' || node.type === 'end') shapeType = template.structure.startShape;
    else if (node.type === 'decision') shapeType = template.structure.decisionShape;
    else if (node.type === 'io') shapeType = template.structure.ioShape;

    shapes.push({
      type: shapeType,
      x, y, w: nodeW, h: nodeH,
      text: node.text,
      style: {
        fillColor: resolveColor(template, node.type === 'decision' ? 'decision' : 'process'),
        strokeColor: '#333333',
        strokeWidth: 1,
        fontSize: template.style.typography.nodeSize,
        fontColor: '#FFFFFF',
        bold: true
      }
    });

    node._x = x + nodeW / 2;
    node._y = y + nodeH / 2;
  });

  // 绘制连接线
  flows.forEach(flow => {
    const fromNode = nodes.find(n => n.id === flow.from);
    const toNode = nodes.find(n => n.id === flow.to);
    if (fromNode && toNode) {
      connections.push({
        from: { x: fromNode._x, y: fromNode._y },
        to: { x: toNode._x, y: toNode._y },
        style: { strokeColor: '#333333', strokeWidth: 2, endArrow: 'classic' }
      });
    }
  });

  return {
    page: { name: structure.title || 'Flowchart', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

// ============ 泳道图布局引擎 ============
function layoutSwimlane(structure) {
  const templateId = structure.template || 'swimlane';
  const template = loadTemplate(templateId);
  const canvas = { ...template.canvas };
  const spacing = { ...template.style.spacing };

  const shapes = [];
  const connections = [];

  const lanes = structure.lanes || [];
  const laneW = spacing.laneWidth;
  const startX = spacing.padding;
  const startY = spacing.padding + 50;

  // 绘制泳道背景
  lanes.forEach((lane, i) => {
    const x = startX + i * laneW;
    shapes.push({
      type: 'rect',
      x, y: startY, w: laneW, h: canvas.defaultHeight - startY - spacing.padding,
      text: '',
      style: {
        fillColor: resolveColor(template, `lane${(i % 5) + 1}`),
        strokeColor: '#CCCCCC',
        strokeWidth: 1
      }
    });

    // 泳道标题
    shapes.push({
      type: 'text',
      x: x + 10, y: startY + 10, w: laneW - 20, h: 30,
      text: lane.name,
      style: {
        fontSize: template.style.typography.laneSize,
        fontColor: '#333333',
        bold: true,
        align: 1
      }
    });

    // 绘制泳道内的节点
    const nodeW = template.structure.nodeWidth;
    const nodeH = template.structure.nodeHeight;
    lane.nodes.forEach((node, j) => {
      const nx = x + (laneW - nodeW) / 2;
      const ny = startY + 60 + j * (nodeH + spacing.nodeGap);

      shapes.push({
        type: template.structure.processShape,
        x: nx, y: ny, w: nodeW, h: nodeH,
        text: node.text,
        style: {
          fillColor: resolveColor(template, 'process'),
          strokeColor: '#333333',
          strokeWidth: 1,
          fontSize: template.style.typography.nodeSize,
          fontColor: '#FFFFFF',
          bold: true
        }
      });

      node._x = nx + nodeW / 2;
      node._y = ny + nodeH / 2;
      node._lane = i;
    });
  });

  // 绘制连接线
  const allNodes = lanes.flatMap(l => l.nodes);
  structure.flows.forEach(flow => {
    const fromNode = allNodes.find(n => n.id === flow.from);
    const toNode = allNodes.find(n => n.id === flow.to);
    if (fromNode && toNode) {
      connections.push({
        from: { x: fromNode._x, y: fromNode._y },
        to: { x: toNode._x, y: toNode._y },
        style: { strokeColor: '#333333', strokeWidth: 2, endArrow: 'classic' }
      });
    }
  });

  return {
    page: { name: structure.title || 'Swimlane Diagram', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

// ============ 用例图布局引擎 ============
function layoutUsecase(structure) {
  const templateId = structure.template || 'usecase';
  const template = loadTemplate(templateId);
  const canvas = { ...template.canvas };
  const spacing = { ...template.style.spacing };

  const shapes = [];
  const connections = [];

  const actors = structure.actors || [];
  const usecases = structure.usecases || [];
  const actorW = template.structure.actorWidth;
  const actorH = template.structure.actorHeight;
  const ucW = template.structure.usecaseWidth;
  const ucH = template.structure.usecaseHeight;

  // 绘制系统边界
  if (template.structure.systemBorder) {
    shapes.push({
      type: 'rect',
      x: 300, y: spacing.padding + 50, w: canvas.defaultWidth - 400, h: canvas.defaultHeight - spacing.padding * 2 - 50,
      text: structure.systemName || '系统',
      style: {
        fillColor: 'none',
        strokeColor: '#333333',
        strokeWidth: 2,
        fontSize: 14,
        fontColor: '#333333',
        align: 1
      }
    });
  }

  // 绘制参与者（左侧）
  actors.forEach((actor, i) => {
    const x = spacing.padding;
    const y = spacing.padding + 100 + i * (actorH + spacing.actorGap);

    // 简化的参与者图形（用矩形代替）
    shapes.push({
      type: 'rect',
      x, y, w: actorW, h: actorH,
      text: actor.name,
      style: {
        fillColor: resolveColor(template, 'actor'),
        strokeColor: '#333333',
        strokeWidth: 1,
        fontSize: template.style.typography.actorSize,
        fontColor: '#FFFFFF',
        bold: true
      }
    });

    actor._x = x + actorW;
    actor._y = y + actorH / 2;
  });

  // 绘制用例（右侧）
  usecases.forEach((uc, i) => {
    const cols = 2;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 400 + col * (ucW + spacing.usecaseGap);
    const y = spacing.padding + 100 + row * (ucH + spacing.usecaseGap * 1.5);

    shapes.push({
      type: 'oval',
      x, y, w: ucW, h: ucH,
      text: uc.name,
      style: {
        fillColor: resolveColor(template, 'usecase'),
        strokeColor: '#333333',
        strokeWidth: 1,
        fontSize: template.style.typography.usecaseSize,
        fontColor: '#FFFFFF',
        bold: true,
        align: 1
      }
    });

    uc._x = x;
    uc._y = y + ucH / 2;
  });

  // 绘制关联线
  structure.associations.forEach(assoc => {
    const actor = actors.find(a => a.name === assoc.actor);
    const uc = usecases.find(u => u.name === assoc.usecase);
    if (actor && uc) {
      connections.push({
        from: { x: actor._x, y: actor._y },
        to: { x: uc._x, y: uc._y },
        style: { strokeColor: '#333333', strokeWidth: 1 }
      });
    }
  });

  return {
    page: { name: structure.title || 'Use Case Diagram', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

// ============ E-R 图布局引擎 ============
function layoutErd(structure) {
  const templateId = structure.template || 'erd';
  const template = loadTemplate(templateId);
  const canvas = { ...template.canvas };
  const spacing = { ...template.style.spacing };

  const shapes = [];
  const connections = [];

  const entities = structure.entities || [];
  const entityW = template.structure.entityWidth;
  const entityH = template.structure.entityHeight;
  const attrW = template.structure.attributeWidth;
  const attrH = template.structure.attributeHeight;

  // 自动布局实体
  const cols = Math.ceil(Math.sqrt(entities.length));
  const startX = spacing.padding;
  const startY = spacing.padding + 50;

  entities.forEach((entity, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (entityW + spacing.entityGap);
    const y = startY + row * (entityH + spacing.entityGap * 2);

    // 实体矩形
    shapes.push({
      type: 'rect',
      x, y, w: entityW, h: entityH,
      text: entity.name,
      style: {
        fillColor: resolveColor(template, 'entity'),
        strokeColor: '#333333',
        strokeWidth: 2,
        fontSize: template.style.typography.entitySize,
        fontColor: '#FFFFFF',
        bold: true,
        align: 1
      }
    });

    entity._x = x + entityW / 2;
    entity._y = y + entityH / 2;

    // 属性（椭圆）
    entity.attributes.forEach((attr, j) => {
      const ax = x + (j - entity.attributes.length / 2) * (attrW + spacing.attributeGap);
      const ay = y - attrH - 20;

      shapes.push({
        type: 'oval',
        x: ax, y: ay, w: attrW, h: attrH,
        text: attr.name,
        style: {
          fillColor: resolveColor(template, attr.isKey ? 'key' : 'attribute'),
          strokeColor: '#333333',
          strokeWidth: 1,
          fontSize: template.style.typography.attributeSize,
          fontColor: '#FFFFFF',
          align: 1
        }
      });

      connections.push({
        from: { x: ax + attrW / 2, y: ay + attrH },
        to: { x: x + entityW / 2, y },
        style: { strokeColor: '#333333', strokeWidth: 1 }
      });
    });
  });

  // 绘制关系线
  structure.relationships.forEach(rel => {
    const fromEntity = entities.find(e => e.name === rel.from);
    const toEntity = entities.find(e => e.name === rel.to);
    if (fromEntity && toEntity) {
      connections.push({
        from: { x: fromEntity._x, y: fromEntity._y },
        to: { x: toEntity._x, y: toEntity._y },
        style: { strokeColor: '#9C27B0', strokeWidth: 2, endArrow: 'classic', label: rel.name || '' }
      });
    }
  });

  return {
    page: { name: structure.title || 'E-R Diagram', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

// ============ 架构图布局引擎 v4（层标签间箭头 + 无颜色 + 自动换行）============
function layoutArchitecture(structure) {
  const templateId = structure.template || 'architecture';
  const template = loadTemplate(templateId);
  const canvas = { ...template.canvas };
  const spacing = { ...template.style.spacing };

  const shapes = [];
  const connections = [];

  const layers = structure.layers || [];
  const baseLayerH = template.structure.layerHeight; // 基础层高度
  const compW = template.structure.componentWidth;
  const compH = template.structure.componentHeight;
  const labelW = spacing.labelWidth;
  const sidebarW = structure.sidebar ? spacing.sidebarWidth : 0;

  // 计算内容宽度（根据最多组件的层动态计算，但限制最大宽度）
  const maxComponentsPerLayer = Math.max(...layers.map(l => (l.components || []).length));
  // 一行最多放4个组件，超过就换行
  const maxPerRow = 4;
  
  // 计算每层需要的行数和实际层高度
  const layerInfo = layers.map(layer => {
    const comps = layer.components || [];
    const rows = Math.ceil(comps.length / maxPerRow);
    return {
      rows,
      layerH: baseLayerH * rows, // 层高度 = 基础高度 * 行数
      components: comps
    };
  });

  // 计算内容宽度（基于一行4个组件）
  const contentWidth = maxPerRow * compW + (maxPerRow - 1) * spacing.componentGap + 60;
  const contentStartX = spacing.padding + labelW;

  // 计算总高度
  const totalLayerHeight = layerInfo.reduce((sum, info) => sum + info.layerH, 0) 
    + (layers.length - 1) * spacing.layerGap;
  const startY = spacing.padding + 60;

  // 存储每个层标签的 Y 坐标（用于绘制箭头）
  const labelPositions = [];

  // 按数组顺序绘制（第一个在最上面）
  layers.forEach((layer, i) => {
    const info = layerInfo[i];
    const layerH = info.layerH;
    const rows = info.rows;
    const y = startY + layerInfo.slice(0, i).reduce((sum, info) => sum + info.layerH + spacing.layerGap, -spacing.layerGap);

    // 淡色背景（交替浅灰色，确保打印可见）
    const bgColors = ['#FFFFFF', '#F5F5F5', '#FAFAFA', '#F0F0F0'];
    const bgColor = bgColors[i % bgColors.length];

    // 层背景矩形（淡色背景 + 边框）
    shapes.push({
      type: 'rect',
      x: contentStartX, y, w: contentWidth, h: layerH,
      text: '',
      style: {
        fillColor: bgColor,
        strokeColor: '#AAAAAA',
        strokeWidth: 1
      }
    });

    // 左侧层标签（矩形框，高度与层背景一致，白色背景）
    shapes.push({
      type: 'rect',
      x: spacing.padding, y, w: labelW - 20, h: layerH,
      text: layer.name,
      style: {
        fillColor: '#FFFFFF',
        strokeColor: '#333333',
        strokeWidth: 1,
        fontSize: template.style.typography.layerLabelSize,
        fontColor: '#333333',
        bold: true,
        align: 1
      }
    });

    // 记录层标签位置
    labelPositions.push({
      top: y,
      bottom: y + layerH,
      centerX: spacing.padding + (labelW - 20) / 2
    });

    // 层内组件（支持多行布局）
    const components = info.components;
    const compGap = spacing.componentGap;
    
    components.forEach((comp, j) => {
      const row = Math.floor(j / maxPerRow);
      const col = j % maxPerRow;
      
      // 计算这一行有多少个组件（最后一行可能不满）
      const rowStart = row * maxPerRow;
      const rowEnd = Math.min(rowStart + maxPerRow, components.length);
      const componentsInRow = rowEnd - rowStart;
      
      // 每行的总宽度和起始X
      const totalRowWidth = componentsInRow * compW + (componentsInRow - 1) * compGap;
      const rowStartX = contentStartX + (contentWidth - totalRowWidth) / 2;
      
      const cx = rowStartX + col * (compW + compGap);
      const cy = y + row * (compH + spacing.componentGap) + (layerH - rows * compH - (rows - 1) * spacing.componentGap) / 2;

      // 判断是否是数据库图标（圆柱体）
      const isDb = comp.type === 'database' || comp.isDb;
      const shapeType = isDb ? 'cylinder' : 'rect';

      shapes.push({
        type: shapeType,
        x: cx, y: cy, w: compW, h: compH,
        text: comp.name,
        style: {
          fillColor: '#FFFFFF',
          strokeColor: '#333333',
          strokeWidth: 1,
          fontSize: template.style.typography.componentSize,
          fontColor: '#333333',
          align: 1
        }
      });
    });
  });

  // 绘制层间箭头（从下向上，连接两个矩形）
  for (let i = 1; i < layers.length; i++) {
    const lowerLabel = labelPositions[i];
    const upperLabel = labelPositions[i - 1];

    shapes.push({
      type: 'line',
      x1: lowerLabel.centerX, y1: lowerLabel.top,
      x2: upperLabel.centerX, y2: upperLabel.bottom,
      style: {
        strokeColor: '#333333',
        strokeWidth: 1.5,
        endArrow: 'classic'
      }
    });
  }

  // 动态调整画布宽度
  canvas.defaultWidth = contentStartX + contentWidth + sidebarW + spacing.padding;

  // 调整画布高度
  const totalHeight = startY + totalLayerHeight + spacing.padding;
  canvas.defaultHeight = Math.max(canvas.defaultHeight, totalHeight);

  return {
    page: { name: structure.title || 'Architecture Diagram', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

// ============ 功能结构图布局 ============
function layoutFuncStructure(structure) {
  const templateId = structure.template || 'func-structure';
  const template = loadTemplate(templateId);
  const s = template.structure;
  const style = template.style;
  const canvas = { ...template.canvas };

  const systemName = structure.systemName || '系统';
  const modules = structure.modules || [];
  const moduleCount = modules.length;

  const shapes = [];
  const connections = [];

  // 计算功能矩形高度（根据最长文字）
  let maxCharCount = 0;
  for (const mod of modules) {
    for (const func of (mod.functions || [])) {
      if (func.length > maxCharCount) maxCharCount = func.length;
    }
  }
  const funcRectH = maxCharCount * s.funcCharHeight + (maxCharCount - 1) * s.funcCharGap + 20;

  // 第一层：系统名称矩形（居中顶部）
  const sysX = (canvas.defaultWidth - s.systemRectW) / 2;
  const sysY = style.spacing.layer1Y;
  shapes.push({
    type: 'rect',
    x: sysX, y: sysY, w: s.systemRectW, h: s.systemRectH,
    text: systemName,
    style: {
      fillColor: style.colors.rectFill,
      strokeColor: style.colors.rectStroke,
      strokeWidth: style.colors.rectStrokeWidth,
      fontSize: style.typography.systemSize,
      bold: true,
      fontColor: style.colors.textColor,
      align: 1
    }
  });
  const sysCenterX = sysX + s.systemRectW / 2;
  const sysBottomY = sysY + s.systemRectH;

  // 第二层：功能模块矩形（均匀分布）
  const totalModuleW = moduleCount * s.moduleRectW;
  const moduleGap = (canvas.defaultWidth - totalModuleW) / (moduleCount + 1);
  const moduleY = style.spacing.layer2Y;
  const moduleCenters = [];

  for (let i = 0; i < moduleCount; i++) {
    const modX = moduleGap + i * (s.moduleRectW + moduleGap);
    const modCenterX = modX + s.moduleRectW / 2;
    moduleCenters.push(modCenterX);

    shapes.push({
      type: 'rect',
      x: modX, y: moduleY, w: s.moduleRectW, h: s.moduleRectH,
      text: modules[i].name,
      style: {
        fillColor: style.colors.rectFill,
        strokeColor: style.colors.rectStroke,
        strokeWidth: style.colors.rectStrokeWidth,
        fontSize: style.typography.moduleSize,
        bold: true,
        fontColor: style.colors.textColor,
        align: 1
      }
    });

    // 系统 → 模块连接线（折线：先垂直向下，再水平，再垂直）
    const midY = (sysBottomY + moduleY) / 2;
    connections.push({
      from: 0, to: i + 1,
      style: {
        endArrow: 'none',
        strokeColor: style.colors.lineColor,
        strokeWidth: style.colors.lineWidth,
        exitX: 0.5, exitY: 1,
        entryX: 0.5, entryY: 0,
        waypoints: [{ x: sysCenterX, y: midY }, { x: moduleCenters[i], y: midY }]
      }
    });
  }

  const moduleBottomY = moduleY + s.moduleRectH;

  // 第三层：具体功能矩形（竖向文字，每个字一行，每个模块下方）
  const funcY = style.spacing.layer3Y;
  let shapeIdx = 1 + moduleCount;

  for (let i = 0; i < moduleCount; i++) {
    const funcs = modules[i].functions || [];
    const funcCount = funcs.length;
    const totalFuncW = funcCount * s.funcRectW + (funcCount - 1) * style.spacing.funcGap;
    const funcStartX = moduleCenters[i] - totalFuncW / 2;

    for (let j = 0; j < funcCount; j++) {
      const funcX = funcStartX + j * (s.funcRectW + style.spacing.funcGap);
      // 每个字之间加换行，实现纵向排列
      const verticalText = funcs[j].split('').join('\n');
      shapes.push({
        type: 'rect',
        x: funcX, y: funcY, w: s.funcRectW, h: funcRectH,
        text: verticalText,
        style: {
          fillColor: style.colors.rectFill,
          strokeColor: style.colors.rectStroke,
          strokeWidth: style.colors.rectStrokeWidth,
          fontSize: style.typography.funcSize,
          fontColor: style.colors.textColor,
          align: 1,
          verticalAlign: 1
        }
      });

      // 模块 → 功能连接线（折线：先垂直向下，再水平，再垂直）
      const funcCenterX = funcX + s.funcRectW / 2;
      const midY = (moduleBottomY + funcY) / 2;
      connections.push({
        from: i + 1, to: shapeIdx,
        style: {
          endArrow: 'none',
          strokeColor: style.colors.lineColor,
          strokeWidth: style.colors.lineWidth,
          exitX: 0.5, exitY: 1,
          entryX: 0.5, entryY: 0,
          waypoints: [{ x: moduleCenters[i], y: midY }, { x: funcCenterX, y: midY }]
        }
      });
      shapeIdx++;
    }
  }

  return {
    page: { name: structure.title || systemName, width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

// ============ 主入口 ============
function autoLayout(structure) {
  // 支持 template 和 layout 两种字段
  const layoutType = structure.layout || structure.template || 'layered';

  switch (layoutType) {
    case 'layered':
      return layoutLayered(structure);
    case 'radial':
      return layoutRadial(structure);
    case 'cycle-segmented':
      return layoutCycleSegmented(structure);
    case 'flowchart':
      return layoutFlowchart(structure);
    case 'swimlane':
      return layoutSwimlane(structure);
    case 'usecase':
      return layoutUsecase(structure);
    case 'erd':
      return layoutErd(structure);
    case 'architecture':
      return layoutArchitecture(structure);
    case 'func-structure':
      return layoutFuncStructure(structure);
    case 'free':
    default:
      return {
        page: structure.page || { name: 'Free', width: 1500, height: 900 },
        shapes: structure.shapes || [],
        connections: structure.connections || []
      };
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    autoLayout, 
    layoutLayered, 
    layoutRadial, 
    layoutCycleSegmented,
    layoutFlowchart,
    layoutSwimlane,
    layoutUsecase,
    layoutErd,
    layoutArchitecture,
    layoutFuncStructure,
    loadTemplate, 
    getAvailableTemplates 
  };
}
