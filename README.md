# GLYPH ASCII Studio

安装：`npm ci`

本地启动：`npm run dev`

Docker 启动：`docker compose up --build`，访问 http://localhost:18018。

## 色彩导入与解释流程

图片不再直接按浏览器解码后的颜色无条件转换，而是先经过 **02 / COLOR PROFILE** 面板：

1. **显示实际可识别的色彩信息**：解析 PNG（sRGB / gAMA / cHRM / iCCP / tRNS / 私有块）、JPEG（JFIF / Exif / APP2 ICC_PROFILE）、WebP（VP8 / VP8L / VP8X / ALPH / ICCP）容器标记，列出透明像素、半透明边缘与广色域超界像素统计。
2. **两种转换方式**：
   - **按显示效果**：直接使用浏览器解码后的颜色；
   - **统一工作色域**：读取 display-p3 数据并映射到 sRGB，超界颜色可选择 **保色相**（等色相裁剪）或 **保亮度**（等色相线上亮度最接近的合法点）。
3. **透明合成解释预览**：同一透明边缘在黑底、白底上的 alpha over 合成结果并排展示；采样与 PNG 导出使用与所选底色完全一致的公式。
4. **无法识别的标记**：界面只声明“采用默认解释”，需用户显式确认，不会表述为已准确还原。
5. **失败回滚**：色域转换结果须通过有限数值、通道范围与 alpha 一致性校验；失败时整份画布回到操作前那套有效解释，不会留下部分颜色处于新色域的中间状态。
6. **联动更新**：更换解释不影响裁剪与字符参数；原图比较、亮度分布（32 档）、字符结果与 PNG/TXT 导出均从同一解释产物派生，一并刷新。

## 验证

- 纯逻辑（标记解析、色域映射、合成、直方图）：`node --experimental-strip-types ../color-verification/verify-color.ts`
- 端到端（Playwright）：`node ../color-verification/e2e-color.mjs`
