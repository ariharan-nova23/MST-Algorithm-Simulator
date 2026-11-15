function prepareCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(280, Math.floor(bounds.width));
  const height = Math.max(180, Math.floor(bounds.height));
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function grid(context, width, height, max, formatter, left = 46, bottom = 32) {
  const top = 14;
  const plotHeight = height - top - bottom;
  context.font = "12px system-ui, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let index = 0; index <= 4; index++) {
    const y = top + (plotHeight * index) / 4;
    const value = max * (1 - index / 4);
    context.strokeStyle = "#253047";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - 10, y);
    context.stroke();
    context.fillStyle = "#7e899e";
    context.fillText(formatter(value), left - 8, y);
  }
  return { top, plotHeight, left, bottom, plotWidth: width - left - 10 };
}

export function drawAlgorithmChart(canvas, samples) {
  if (!canvas || !samples?.length) return;
  const { context: ctx, width, height } = prepareCanvas(canvas);
  const max = Math.max(0.001, ...samples.flatMap((item) => [item.kruskalMs, item.primMs])) * 1.16;
  const plot = grid(ctx, width, height, max, (value) => value < 0.1 ? value.toFixed(3) : value.toFixed(2));
  const categories = samples.length;
  const groupWidth = plot.plotWidth / categories;
  const barWidth = Math.min(24, groupWidth * 0.27);
  const colors = ["#9b7bff", "#42b8f5"];
  samples.forEach((sample, index) => {
    const center = plot.left + groupWidth * (index + 0.5);
    [sample.kruskalMs, sample.primMs].forEach((value, series) => {
      const barHeight = (value / max) * plot.plotHeight;
      const x = center + (series === 0 ? -barWidth - 3 : 3);
      const y = plot.top + plot.plotHeight - barHeight;
      ctx.fillStyle = colors[series];
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, Math.max(2, barHeight), [4, 4, 0, 0]);
      ctx.fill();
    });
    ctx.fillStyle = "#9ca7ba";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(sample.label, center, height - 23);
  });
}

export function drawUnionChart(canvas, variants) {
  if (!canvas || !variants?.length) return;
  const { context: ctx, width, height } = prepareCanvas(canvas);
  const left = 114;
  const right = 42;
  const top = 15;
  const rowHeight = (height - top - 8) / variants.length;
  const max = Math.max(0.001, ...variants.map((item) => item.milliseconds)) * 1.15;
  ctx.font = "12px system-ui, sans-serif";
  variants.forEach((item, index) => {
    const y = top + index * rowHeight;
    ctx.fillStyle = "#a9b3c5";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(item.shortName, left - 10, y + rowHeight * 0.38);
    const barWidth = Math.max(2, (item.milliseconds / max) * (width - left - right));
    ctx.fillStyle = ["#ffb45c", "#42b8f5", "#9b7bff", "#55d6a5"][index];
    ctx.beginPath();
    ctx.roundRect(left, y + rowHeight * 0.18, barWidth, Math.max(8, rowHeight * 0.36), 4);
    ctx.fill();
    ctx.fillStyle = "#e7ebf4";
    ctx.textAlign = "left";
    ctx.fillText(`${item.milliseconds.toFixed(3)} ms`, left + barWidth + 7, y + rowHeight * 0.38);
    ctx.fillStyle = "#77839a";
    ctx.textAlign = "left";
    ctx.fillText(`${item.parentHops} hops · depth ${item.maxDepth}`, left, y + rowHeight * 0.78);
  });
}
