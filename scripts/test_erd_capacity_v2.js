/**
 * E-R 图属性容量优化测算
 * 分析当前布局的问题并提出优化方案
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
const margin = 150;

console.log('=== 当前布局问题分析 ===\n');
console.log('画布尺寸:', canvas.defaultWidth, 'x', canvas.defaultHeight);
console.log('实体尺寸:', entityW, 'x', entityH);
console.log('属性椭圆:', attrW, 'x', attrH);
console.log('边距:', margin);
console.log('');

// 当前布局：实体在方形四角
const spreadX = Math.min(280, (canvas.defaultWidth - 2 * margin - entityW) / 2 * 0.8);
const spreadY = Math.min(200, (canvas.defaultHeight - 2 * margin - entityH) / 2 * 0.8);

const centerX = canvas.defaultWidth / 2;
const centerY = canvas.defaultHeight / 2;

// 左上实体
const entityX = centerX - spreadX - entityW / 2;
const entityY = centerY - spreadY - entityH / 2;
const entityCx = entityX + entityW / 2;
const entityCy = entityY + entityH / 2;

console.log('当前布局（方形）:');
console.log('  spreadX:', spreadX, 'spreadY:', spreadY);
console.log('  左上实体中心:', entityCx, entityCy);
console.log('  实体到左边距:', entityX - margin, 'px');
console.log('  实体到上边距:', entityY - margin, 'px');
console.log('');

// 问题：实体太靠近中心，属性空间不足
// 解决方案：让实体更靠近角落

console.log('=== 优化方案 ===\n');

// 方案1：增加画布尺寸
const newCanvasW = 1800;
const newCanvasH = 1200;
const newSpreadX = (newCanvasW - 2 * margin - entityW) / 2;
const newSpreadY = (newCanvasH - 2 * margin - entityH) / 2;

const newEntityX = newCanvasW / 2 - newSpreadX - entityW / 2;
const newEntityY = newCanvasH / 2 - newSpreadY - entityH / 2;
const newEntityCx = newEntityX + entityW / 2;
const newEntityCy = newEntityY + entityH / 2;

console.log('方案1：增加画布尺寸到', newCanvasW, 'x', newCanvasH);
console.log('  新spreadX:', newSpreadX, '新spreadY:', newSpreadY);
console.log('  左上实体中心:', newEntityCx, newEntityCy);
console.log('  实体到左边距:', newEntityX - margin, 'px');
console.log('  实体到上边距:', newEntityY - margin, 'px');

// 计算新布局的属性容量
const attrSpaceW = attrW + attrGap;
const attrSpaceH = attrH + attrGap;

const newTopCapacity = Math.floor((newEntityCx - margin) / attrSpaceW);
const newLeftCapacity = Math.floor((newEntityCy - margin) / attrSpaceH);
const newTotalCapacity = newTopCapacity + newLeftCapacity;

console.log('  top方向容量:', newTopCapacity, '个属性');
console.log('  left方向容量:', newLeftCapacity, '个属性');
console.log('  总容量:', newTotalCapacity, '个属性');
console.log('');

// 方案2：调整实体位置，让实体更靠近角落
console.log('方案2：调整实体位置（保持画布尺寸不变）');
const adjustedSpreadX = (canvas.defaultWidth - 2 * margin - entityW) / 2;
const adjustedSpreadY = (canvas.defaultHeight - 2 * margin - entityH) / 2;

const adjEntityX = centerX - adjustedSpreadX - entityW / 2;
const adjEntityY = centerY - adjustedSpreadY - entityH / 2;
const adjEntityCx = adjEntityX + entityW / 2;
const adjEntityCy = adjEntityY + entityH / 2;

console.log('  新spreadX:', adjustedSpreadX, '新spreadY:', adjustedSpreadY);
console.log('  左上实体中心:', adjEntityCx, adjEntityCy);
console.log('  实体到左边距:', adjEntityX - margin, 'px');
console.log('  实体到上边距:', adjEntityY - margin, 'px');

const adjTopCapacity = Math.floor((adjEntityCx - margin) / attrSpaceW);
const adjLeftCapacity = Math.floor((adjEntityCy - margin) / attrSpaceH);
const adjTotalCapacity = adjTopCapacity + adjLeftCapacity;

console.log('  top方向容量:', adjTopCapacity, '个属性');
console.log('  left方向容量:', adjLeftCapacity, '个属性');
console.log('  总容量:', adjTotalCapacity, '个属性');
console.log('');

// 方案3：减少边距
console.log('方案3：减少边距到80px');
const smallMargin = 80;
const smallSpreadX = (canvas.defaultWidth - 2 * smallMargin - entityW) / 2;
const smallSpreadY = (canvas.defaultHeight - 2 * smallMargin - entityH) / 2;

const smallEntityX = centerX - smallSpreadX - entityW / 2;
const smallEntityY = centerY - smallSpreadY - entityH / 2;
const smallEntityCx = smallEntityX + entityW / 2;
const smallEntityCy = smallEntityY + entityH / 2;

console.log('  新spreadX:', smallSpreadX, '新spreadY:', smallSpreadY);
console.log('  左上实体中心:', smallEntityCx, smallEntityCy);
console.log('  实体到左边距:', smallEntityX - smallMargin, 'px');
console.log('  实体到上边距:', smallEntityY - smallMargin, 'px');

const smallTopCapacity = Math.floor((smallEntityCx - smallMargin) / attrSpaceW);
const smallLeftCapacity = Math.floor((smallEntityCy - smallMargin) / attrSpaceH);
const smallTotalCapacity = smallTopCapacity + smallLeftCapacity;

console.log('  top方向容量:', smallTopCapacity, '个属性');
console.log('  left方向容量:', smallLeftCapacity, '个属性');
console.log('  总容量:', smallTotalCapacity, '个属性');
console.log('');

// 综合方案
console.log('=== 推荐方案 ===');
console.log('结合方案1和方案3：');
console.log('  画布尺寸:', newCanvasW, 'x', newCanvasH);
console.log('  边距:', smallMargin);

const finalSpreadX = (newCanvasW - 2 * smallMargin - entityW) / 2;
const finalSpreadY = (newCanvasH - 2 * smallMargin - entityH) / 2;

const finalEntityX = newCanvasW / 2 - finalSpreadX - entityW / 2;
const finalEntityY = newCanvasH / 2 - finalSpreadY - entityH / 2;
const finalEntityCx = finalEntityX + entityW / 2;
const finalEntityCy = finalEntityY + entityH / 2;

console.log('  新spreadX:', finalSpreadX, '新spreadY:', finalSpreadY);
console.log('  左上实体中心:', finalEntityCx, finalEntityCy);
console.log('  实体到左边距:', finalEntityX - smallMargin, 'px');
console.log('  实体到上边距:', finalEntityY - smallMargin, 'px');

const finalTopCapacity = Math.floor((finalEntityCx - smallMargin) / attrSpaceW);
const finalLeftCapacity = Math.floor((finalEntityCy - smallMargin) / attrSpaceH);
const finalTotalCapacity = finalTopCapacity + finalLeftCapacity;

console.log('  top方向容量:', finalTopCapacity, '个属性');
console.log('  left方向容量:', finalLeftCapacity, '个属性');
console.log('  总容量:', finalTotalCapacity, '个属性');
console.log('');

console.log('=== 结论 ===');
console.log('推荐配置：');
console.log('  1. 画布尺寸: 1800 x 1200');
console.log('  2. 边距: 80px');
console.log('  3. 单个实体最大属性数:', finalTotalCapacity, '个');
