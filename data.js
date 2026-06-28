// data.js - 中国股市模拟数据生成（基于真实趋势）
// 使用带种子的伪随机游走，保证每次刷新数据走势一致

// ===== 全局配置常量 =====
const START_DATE = '2024-07-19';   // 起始日期
const START_INDEX = 2982;          // 上证指数 2024/7/19 收盘附近
const RNG_SEED = 20240719;         // 随机种子（固定，保证可复现）

// ===== mulberry32 种子伪随机数生成器 =====
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(RNG_SEED);

// ===== 标准正态分布随机数（Box-Muller 变换）=====
function randNormal() {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ===== 日期工具函数 =====
function isTradingDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 跳过周六、周日
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ===== 根据日期获取阶段参数 =====
// drift: 日漂移率（期望收益率）, vol: 日波动率
// 参考真实上证指数走势的阶段特征
function getPhaseParams(date) {
  const t = date.getTime();

  // 2024/9/24 - 2024/10/8: "924" 政策驱动的急涨行情（真实：2760→3489）
  if (t >= new Date('2024-09-24').getTime() && t <= new Date('2024-10-08').getTime()) {
    return { drift: 0.025, vol: 0.020 };
  }
  // 2024/10/9 - 2024/10/31: 高位冲高回落
  if (t >= new Date('2024-10-09').getTime() && t <= new Date('2024-10-31').getTime()) {
    return { drift: -0.004, vol: 0.018 };
  }
  // 2024/11 - 2025/1: 高位震荡回落
  if (t >= new Date('2024-11-01').getTime() && t <= new Date('2025-01-31').getTime()) {
    return { drift: -0.0012, vol: 0.013 };
  }
  // 2025/2 - 2025/6: 缓慢反弹回升
  if (t >= new Date('2025-02-01').getTime() && t <= new Date('2025-06-30').getTime()) {
    return { drift: 0.0012, vol: 0.011 };
  }
  // 2025/7 至今: 震荡上行
  if (t >= new Date('2025-07-01').getTime()) {
    return { drift: 0.0010, vol: 0.0105 };
  }
  // 2024/7/19 - 2024/9/23: 底部阴跌震荡（默认，真实：2982→2760）
  return { drift: -0.0018, vol: 0.0095 };
}

// ===== 生成交易日序列 =====
function generateTradingDays(start, end) {
  const days = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endT = end.getTime();
  while (cur.getTime() <= endT) {
    if (isTradingDay(cur)) {
      days.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ===== 生成市场数据（几何布朗运动模拟）=====
function generateMarketData() {
  const start = new Date(START_DATE);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const tradingDays = generateTradingDays(start, end);

  const data = [];
  let prevIndex = START_INDEX;
  for (const day of tradingDays) {
    const { drift, vol } = getPhaseParams(day);
    // 几何布朗运动: S_t = S_{t-1} * exp((drift - 0.5*vol^2) + vol*Z)
    const z = randNormal();
    const ret = Math.exp((drift - 0.5 * vol * vol) + vol * z);
    const idx = prevIndex * ret;
    data.push({
      date: formatDate(day),
      index: Math.round(idx * 100) / 100
    });
    prevIndex = idx;
  }
  return data;
}

// ===== 导出全局变量 =====
var MARKET_DATA = generateMarketData();
