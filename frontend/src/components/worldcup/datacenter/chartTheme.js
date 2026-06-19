export const chartColors = {
  primary: 'hsl(var(--primary))',
  chart1: 'hsl(142 76% 36%)',
  chart2: 'hsl(221 83% 53%)',
  chart3: 'hsl(38 92% 50%)',
  chart4: 'hsl(280 65% 60%)',
  chart5: 'hsl(0 72% 51%)',
  muted: 'hsl(var(--muted-foreground))',
  grid: 'hsl(var(--border))',
};

export const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };
export const chartMargin = { top: 8, right: 12, left: 0, bottom: 4 };
export const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export const TIER_CHART_COLORS = {
  champion: chartColors.chart3,
  final: chartColors.chart2,
  semifinal: chartColors.chart4,
  quarter: chartColors.chart1,
  round16: 'hsl(199 89% 48%)',
  group: chartColors.muted,
  other: 'hsl(var(--border))',
};
