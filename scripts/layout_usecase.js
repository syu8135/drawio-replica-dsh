/**
 * layout_usecase.js
 * 用例图独立布局引擎
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate() {
  const templatePath = path.join(TEMPLATES_DIR, 'usecase.json');
  return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
}

function layoutUsecase(structure) {
  const template = loadTemplate();
  const s = template.structure;
  const style = template.style;
  const canvas = { ...template.canvas };

  const actorName = structure.actorName || '用户';
  const usecases = structure.usecases || [];
  const usecaseCount = usecases.length;

  const shapes = [];
  const connections = [];

  // 计算画布高度（根据用例数量）
  const totalUsecaseH = usecaseCount * s.usecaseH + (usecaseCount - 1) * style.spacing.usecaseGap;
  const canvasHeight = Math.max(canvas.defaultHeight, style.spacing.paddingY * 2 + totalUsecaseH);
  canvas.defaultHeight = canvasHeight;

  // 角色位置（左侧居中）
  const actorX = style.spacing.actorX;
  const actorY = (canvasHeight - s.actorH) / 2;
  const actorCenterX = actorX + s.actorW / 2;
  const actorCenterY = actorY + s.actorH / 2;

  // 绘制角色（人形）
  shapes.push({
    type: 'actor',
    x: actorX, y: actorY, w: s.actorW, h: s.actorH,
    text: actorName,
    style: {
      fillColor: style.colors.actorFill,
      strokeColor: style.colors.actorStroke,
      strokeWidth: style.colors.actorStrokeWidth,
      fontSize: style.typography.actorNameSize + 1,
      bold: true,
      fontColor: style.colors.textColor,
      align: 'center',
      verticalAlign: 'top',
      labelPosition: 'center',
      verticalLabelPosition: 'bottom'
    }
  });

  // 用例位置（右侧均匀分布）
  const usecaseStartY = (canvasHeight - totalUsecaseH) / 2;

  for (let i = 0; i < usecaseCount; i++) {
    const usecaseX = style.spacing.usecaseX;
    const usecaseY = usecaseStartY + i * (s.usecaseH + style.spacing.usecaseGap);
    const usecaseCenterX = usecaseX + s.usecaseW / 2;
    const usecaseCenterY = usecaseY + s.usecaseH / 2;

    shapes.push({
      type: 'ellipse',
      x: usecaseX, y: usecaseY, w: s.usecaseW, h: s.usecaseH,
      text: usecases[i],
      style: {
        fillColor: style.colors.usecaseFill,
        strokeColor: style.colors.usecaseStroke,
        strokeWidth: style.colors.usecaseStrokeWidth,
        fontSize: style.typography.usecaseSize,
        fontColor: style.colors.textColor,
        align: 1
      }
    });

    // 角色 → 用例连接线
    connections.push({
      from: 0, to: i + 1,
      style: {
        endArrow: 'none',
        strokeColor: style.colors.lineColor,
        strokeWidth: style.colors.lineWidth,
        exitX: 1, exitY: 0.5,
        entryX: 0, entryY: 0.5
      }
    });
  }

  return {
    page: { name: structure.title || actorName + '用例图', width: canvas.defaultWidth, height: canvas.defaultHeight },
    shapes,
    connections
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutUsecase };
}
