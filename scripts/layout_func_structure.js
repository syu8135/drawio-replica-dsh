/**
 * layout_func_structure.js
 * 功能结构图独立布局引擎
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate() {
  const templatePath = path.join(TEMPLATES_DIR, 'func-structure.json');
  return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
}

function layoutFuncStructure(structure) {
  const template = loadTemplate();
  const s = template.structure;
  const style = template.style;
  const canvas = { ...template.canvas };

  const systemName = structure.systemName || '系统';
  const modules = structure.modules || [];
  const moduleCount = modules.length;

  const shapes = [];
  const connections = [];

  // 动态计算第二层模块矩形宽度（以文字最多的为基准）
  let maxModuleChars = 0;
  for (const mod of modules) {
    if (mod.name.length > maxModuleChars) maxModuleChars = mod.name.length;
  }
  const dynamicModuleW = Math.max(120, maxModuleChars * 14 + 30); // 14px/字 + 30px 内边距，最小 120px

  // 计算功能矩形高度（根据最长文字）
  let maxCharCount = 0;
  for (const mod of modules) {
    for (const func of (mod.functions || [])) {
      if (func.length > maxCharCount) maxCharCount = func.length;
    }
  }
  const funcRectH = maxCharCount * s.funcCharHeight + (maxCharCount - 1) * s.funcCharGap + (s.funcPadding || 10);

  // 第一层：系统名称矩形（居中顶部）
  const sysX = (canvas.defaultWidth - s.systemRectW) / 2;
  const sysY = style.spacing.layer1Y;
  const sysBottomY = sysY + s.systemRectH;
  const sysCenterX = sysX + s.systemRectW / 2;

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

  // 第二层：功能模块矩形（均匀分布，宽度动态调整）
  const totalModuleW = moduleCount * dynamicModuleW;
  const moduleGap = (canvas.defaultWidth - totalModuleW) / (moduleCount + 1);
  const moduleY = style.spacing.layer2Y;
  const moduleBottomY = moduleY + s.moduleRectH;
  const moduleCenters = [];

  for (let i = 0; i < moduleCount; i++) {
    const modX = moduleGap + i * (dynamicModuleW + moduleGap);
    const modCenterX = modX + dynamicModuleW / 2;
    moduleCenters.push(modCenterX);

    shapes.push({
      type: 'rect',
      x: modX, y: moduleY, w: dynamicModuleW, h: s.moduleRectH,
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

    // 系统 → 模块连接线（正交折线，无箭头）
    connections.push({
      from: 0, to: i + 1,
      style: {
        endArrow: 'none',
        orthogonal: true,
        rounded: 0,
        curved: 0,
        strokeColor: style.colors.lineColor,
        strokeWidth: style.colors.lineWidth,
        exitX: 0.5, exitY: 1,
        entryX: 0.5, entryY: 0
      }
    });
  }

  // 第三层：具体功能矩形（竖向文字，每个模块下方）
  const funcY = style.spacing.layer3Y;
  let shapeIdx = 1 + moduleCount;

  for (let i = 0; i < moduleCount; i++) {
    const funcs = modules[i].functions || [];
    const funcCount = funcs.length;
    const totalFuncW = funcCount * s.funcRectW + (funcCount - 1) * style.spacing.funcGap;
    const funcStartX = moduleCenters[i] - totalFuncW / 2;

    for (let j = 0; j < funcCount; j++) {
      const funcX = funcStartX + j * (s.funcRectW + style.spacing.funcGap);
      const funcCenterX = funcX + s.funcRectW / 2;
      const verticalText = funcs[j];
      
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
          verticalAlign: 1,
          textDirection: 'vertical-lr'
        }
      });

      // 模块 → 功能连接线（正交折线，无箭头）
      connections.push({
        from: i + 1, to: shapeIdx,
        style: {
          endArrow: 'none',
          orthogonal: true,
          rounded: 0,
          curved: 0,
          strokeColor: style.colors.lineColor,
          strokeWidth: style.colors.lineWidth,
          exitX: 0.5, exitY: 1,
          entryX: 0.5, entryY: 0
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutFuncStructure };
}
