/**
 * E-R 图属性容量正确测算
 * 基于实际布局逻辑分析
 */

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'templates', 'erd.json');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
const style = template.style;
const canvas = template.canvas;

const entityW = style.spacing.entityW;
const entityH = style.spacing.entityH;
const attrW = style.spacing.attrW;
const attrH = style.spacing.attrH;
const attrGap = style.spacing.attrGap;
const attrDistance = style.spacing.attrDistance;

console.log('=== 当前布局实际分析 ===\n');
console.log('画布尺寸:', canvas.defaultWidth, 'x', canvas.defaultHeight);
console.log('实体尺寸:', entityW, 'x', entityH);
console.log('属性椭圆:', attrW, 'x', attrH);
console.log('属性间距:', attrGap);
console.log('属性距离:', attrDistance);
console.log('');

// 4个实体方形布局的实际位置
const centerX = canvas.defaultWidth / 2;
const centerY = canvas.defaultHeight / 2;
const spreadX = 280;
const spreadY = 200;

// 左上实体
const entityX = centerX - spreadX - entityW / 2;
const entityY = centerY - spreadY - entityH / 2;
const entityCx = entityX + entityW / 2;
const entityCy = entityY + entityH / 2;

console.log('左上实体位置:');
console.log('  实体左上角:', entityX, entityY);
console.log('  实体中心:', entityCx, entityCy);
console.log('');

// 属性分布计算
// top方向：属性在实体上方，水平排列
// left方向：属性在实体左侧，垂直排列

console.log('=== 属性分布计算 ===\n');

// top方向
const topAttrY = entityY - attrDistance - attrH;
const topAttrStartX = entityCx - (attrW / 2); // 第一个属性中心对齐实体中心
console.log('top方向:');
console.log('  属性y坐标:', topAttrY);
console.log('  第一个属性x:', topAttrStartX);
console.log('  向左扩展空间:', topAttrStartX, 'px');
console.log('  向右扩展空间:', canvas.defaultWidth - topAttrStartX, 'px');

// 计算top方向能放多少属性（向左扩展）
const leftSpace = topAttrStartX - attrW / 2; // 到画布左边的空间
const maxAttrsLeft = Math.floor(leftSpace / (attrW + attrGap));
console.log('  向左最多:', maxAttrsLeft, '个属性');

// left方向
const leftAttrX = entityX - attrDistance - attrW;
const leftAttrStartY = entityCy - (attrH / 2); // 第一个属性中心对齐实体中心
console.log('\nleft方向:');
console.log('  属性x坐标:', leftAttrX);
console.log('  第一个属性y:', leftAttrStartY);
console.log('  向上扩展空间:', leftAttrStartY, 'px');
console.log('  向下扩展空间:', canvas.defaultHeight - leftAttrStartY, 'px');

// 计算left方向能放多少属性（向上扩展）
const upSpace = leftAttrStartY - attrH / 2; // 到画布顶部的空间
const maxAttrsUp = Math.floor(upSpace / (attrH + attrGap));
console.log('  向上最多:', maxAttrsUp, '个属性');

console.log('\n=== 容量计算 ===');
console.log('top方向容量:', maxAttrsLeft, '个属性（向左扩展）');
console.log('left方向容量:', maxAttrsUp, '个属性（向上扩展）');
console.log('单个实体总容量:', maxAttrsLeft + maxAttrsUp, '个属性');

console.log('\n=== 不同属性数量的布局测试 ===\n');

for (let attrCount = 4; attrCount <= 12; attrCount += 2) {
  const perDir = Math.ceil(attrCount / 2);
  const topAttrs = perDir;
  const leftAttrs = attrCount - perDir;
  
  // 计算实际占用
  const topUsedWidth = topAttrs * (attrW + attrGap) - attrGap;
  const leftUsedHeight = leftAttrs * (attrH + attrGap) - attrGap;
  
  const topOverflow = topUsedWidth > leftSpace;
  const leftOverflow = leftUsedHeight > upSpace;
  
  console.log(`${attrCount} 个属性:`);
  console.log(`  分配: top=${topAttrs}, left=${leftAttrs}`);
  console.log(`  top占用: ${topUsedWidth}px / ${leftSpace}px ${topOverflow ? '❌ 超出' : '✅'}`);
  console.log(`  left占用: ${leftUsedHeight}px / ${upSpace}px ${leftOverflow ? '❌ 超出' : '✅'}`);
  
  if (!topOverflow && !leftOverflow) {
    console.log(`  ✅ 布局正常`);
  } else {
    console.log(`  ⚠️  可能混乱`);
  }
  console.log('');
}

// 优化建议
console.log('=== 优化建议 ===\n');

// 方案1：增加画布尺寸
const newCanvasH = 1200;
const newSpreadY = (newCanvasH - 2 * 100 - entityH) / 2;
const newEntityY = newCanvasH / 2 - newSpreadY - entityH / 2;
const newEntityCy = newEntityY + entityH / 2;
const newUpSpace = newEntityCy - attrH / 2;
const newMaxAttrsUp = Math.floor(newUpSpace / (attrH + attrGap));

console.log('方案1：增加画布高度到', newCanvasH);
console.log('  新spreadY:', newSpreadY);
console.log('  新实体中心y:', newEntityCy);
console.log('  新向上空间:', newUpSpace, 'px');
console.log('  left方向容量:', newMaxAttrsUp, '个属性');
console.log('');

// 方案2：调整实体位置
console.log('方案2：让实体更靠近角落');
const cornerSpreadX = (canvas.defaultWidth - 2 * 100 - entityW) / 2;
const cornerSpreadY = (canvas.defaultHeight - 2 * 100 - entityH) / 2;
const cornerEntityX = 100;
const cornerEntityY = 100;
const cornerEntityCx = cornerEntityX + entityW / 2;
const cornerEntityCy = cornerEntityY + entityH / 2;

const cornerLeftSpace = cornerEntityCx - attrW / 2;
const cornerUpSpace = cornerEntityCy - attrH / 2;
const cornerMaxAttrsLeft = Math.floor(cornerLeftSpace / (attrW + attrGap));
const cornerMaxAttrsUp = Math.floor(cornerUpSpace / (attrH + attrGap));

console.log('  实体位置:', cornerEntityX, cornerEntityY);
console.log('  实体中心:', cornerEntityCx, cornerEntityCy);
console.log('  top方向容量:', cornerMaxAttrsLeft, '个属性');
console.log('  left方向容量:', cornerMaxAttrsUp, '个属性');
console.log('  总容量:', cornerMaxAttrsLeft + cornerMaxAttrsUp, '个属性');
