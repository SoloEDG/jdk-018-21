export function demoImage(): string {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 720;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, "#202d4a");
  sky.addColorStop(0.6, "#cb866e");
  sky.addColorStop(1, "#f2c392");
  g.fillStyle = sky;
  g.fillRect(0, 0, 960, 720);
  g.fillStyle = "#fbd7a0";
  g.beginPath();
  g.arc(650, 220, 94, 0, Math.PI * 2);
  g.fill();
  for (let layer = 0; layer < 4; layer++) {
    g.fillStyle = ["#6a6378", "#4d5869", "#2f4554", "#152d36"][layer]!;
    g.beginPath();
    g.moveTo(0, 720);
    for (let x = 0; x <= 960; x += 30) {
      const y =
        420 +
        layer * 65 -
        Math.sin(x * 0.008 + layer * 2) * 85 -
        Math.sin(x * 0.017 + layer) * 42;
      g.lineTo(x, y);
    }
    g.lineTo(960, 720);
    g.fill();
  }
  g.fillStyle = "#10282c";
  for (let i = 0; i < 18; i++) {
    const x = i * 59;
    const h = 35 + Math.sin(i * 4) * 25;
    g.beginPath();
    g.moveTo(x, 640 - h);
    g.lineTo(x - 18, 665);
    g.lineTo(x + 18, 665);
    g.fill();
    g.fillRect(x - 2, 660, 4, 35);
  }
  // 半透明薄雾：用于演示透明像素与底色的合成
  g.fillStyle = "rgba(226, 232, 240, 0.28)";
  g.fillRect(0, 300, 960, 46);
  g.fillStyle = "rgba(226, 232, 240, 0.16)";
  g.fillRect(0, 360, 960, 26);
  // 完全透明的开孔与柔边：演示 alpha 边缘在黑/白底色上的不同合成结果
  g.globalCompositeOperation = "destination-out";
  const hole = g.createRadialGradient(130, 120, 8, 130, 120, 78);
  hole.addColorStop(0, "rgba(0,0,0,1)");
  hole.addColorStop(0.7, "rgba(0,0,0,0.9)");
  hole.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hole;
  g.beginPath();
  g.arc(130, 120, 78, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = "source-over";
  return c.toDataURL("image/png");
}
