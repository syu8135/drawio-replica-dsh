/**
 * 测试E-R图属性容量
 * 测算单个实体最多能绘制多少个属性
 */

const fs = require('fs');
const path = require('path');

// 从模板读取参数
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
const margin = 150;

// 4个实体方形布局的参数
const spreadX = Math.min(280, (canvas.defaultWidth - 2 * margin - entityW) / 2 * 0.8);
const spreadY = Math.min(200, (canvas.defaultHeight - 2 * margin - entityH) / 2 * 0.8);

console.log('=== E-R 图属性容量测算 ===\n');
console.log('画布尺寸:', canvas.defaultWidth, 'x', canvas.defaultHeight);
console.log('实体尺寸:', entityW, 'x', entityH);
console.log('属性椭圆:', attrW, 'x', attrH);
console.log('属性间距:', attrGap);
console.log('实体间距:', spreadX * 2, 'x', spreadY * 2);
console.log('');

// 4个实体方形布局：左上实体的位置
const centerX = canvas.defaultWidth / 2;
const centerY = canvas.defaultHeight / 2;
const entityX = centerX - spreadX - entityW / 2;
const entityY = centerY - spreadY - entityH / 2;
const entityCx = entityX + entityW / 2;
const entityCy = entityY + entityH / 2;

console.log('左上实体位置:');
console.log('  实体中心:', entityCx, entityCy);
console.log('  实体左边:', entityX);
console.log('  实体上边:', entityY);
console.log('');

// 计算朝外方向的可用空间
// 左上实体：top 和 left 方向
const topAvailableWidth = entityCx - margin; // 从左边距到实体中心
const leftAvailableHeight = entityCy - margin; // 从上边距到实体中心

console.log('可用空间:');
console.log('  top方向可用宽度:', topAvailableWidth, 'px');
console.log('  left方向可用高度:', leftAvailableHeight, 'px');
console.log('');

// 计算每个方向能放多少属性
const attrSpaceW = attrW + attrGap;
const attrSpaceH = attrH + attrGap;

const maxAttrsTop = Math.floor(topAvailableWidth / attrSpaceW);
const maxAttrsLeft = Math.floor(leftAvailableHeight / attrSpaceH);

console.log('单个方向容量:');
console.log('  top方向最多:', maxAttrsTop, '个属性');
console.log('  left方向最多:', maxAttrsLeft, '个属性');
console.log('');

const totalCapacity = maxAttrsTop + maxAttrsLeft;
console.log('=== 结论 ===');
console.log('4个实体方形布局下，单个实体最多可容纳:', totalCapacity, '个属性');
console.log('');

// 测试不同属性数量的布局效果
console.log('=== 不同属性数量的布局测试 ===\n');

for (let attrCount = 4; attrCount <= 12; attrCount += 2) {
  const perDir = Math.ceil(attrCount / 2);
  const topAttrs = perDir;
  const leftAttrs = attrCount - perDir;
  
  // 计算实际占用空间
  const topUsedWidth = topAttrs * attrSpaceW - attrGap;
  const leftUsedHeight = leftAttrs * attrSpaceH - attrGap;
  
  const topOverflow = topUsedWidth > topAvailableWidth;
  const leftOverflow = leftUsedHeight > leftAvailableHeight;
  
  console.log(`${attrCount} 个属性:`);
  console.log(`  分配: top=${topAttrs}, left=${leftAttrs}`);
  console.log(`  top占用: ${topUsedWidth}px / ${topAvailableWidth}px ${topOverflow ? '❌ 超出' : '✅'}`);
  console.log(`  left占用: ${leftUsedHeight}px / ${leftAvailableHeight}px ${leftOverflow ? '❌ 超出' : '✅'}`);
  
  if (topOverflow || leftOverflow) {
    console.log(`  ⚠️  布局可能混乱`);
  } else {
    console.log(`  ✅ 布局正常`);
  }
  console.log('');
}

// 计算推荐值
console.log('=== 推荐值 ===');
console.log(`建议单个实体属性数量: ${Math.min(totalCapacity, 8)} 个以内`);
console.log(`如果超过 ${totalCapacity} 个属性，建议:`);
console.log('  1. 拆分为多个实体');
console.log('  2. 增加画布尺寸');
console.log('  3. 减小属性椭圆尺寸');
