// app.js - 定投计算逻辑 + Chart.js 图表渲染 + 统计指标更新

// ===== 定投参数 =====
const DCA_DAY = 19;        // 每月定投日（19 号，与起始日呼应）
const DCA_AMOUNT = 1000;   // 每月定投金额（元）
const NAV_DIVISOR = 1000;  // 指数 / 1000 作为单位净值（便于份额计算）

// ===== 人民币格式化 =====
function formatCNY(n) {
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatPercent(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

// ===== 计算每月定投收益曲线 =====
// 策略：每月首个「日号 >= 19」的交易日投入 1000 元（19 号非交易日则顺延）
function calculateDCA(marketData) {
  const result = [];
  let cumShares = 0;          // 累计持有份额
  let cumCost = 0;            // 累计投入成本
  let investCount = 0;        // 定投次数
  let lastInvestKey = '';     // 上次定投月份标识 "YYYY-MM"

  for (const point of marketData) {
    const date = new Date(point.date);
    const day = date.getDate();
    const monthKey = point.date.slice(0, 7); // "YYYY-MM"

    // 当月尚未定投，且当前交易日日期 >= 19
    if (monthKey !== lastInvestKey && day >= DCA_DAY) {
      const nav = point.index / NAV_DIVISOR;
      const shares = DCA_AMOUNT / nav;
      cumShares += shares;
      cumCost += DCA_AMOUNT;
      lastInvestKey = monthKey;
      investCount++;
    }

    // 当日市值
    const nav = point.index / NAV_DIVISOR;
    const marketValue = cumShares * nav;
    const profit = marketValue - cumCost;

    result.push({
      date: point.date,
      index: point.index,
      cost: cumCost,
      marketValue: marketValue,
      shares: cumShares,
      investCount: investCount,
      profit: profit,
      profitRate: cumCost > 0 ? (profit / cumCost) * 100 : 0
    });
  }
  return result;
}

// ===== 更新顶部统计卡片 =====
function updateStatCards(dcaSeries) {
  const last = dcaSeries[dcaSeries.length - 1];
  const start = dcaSeries[0];
  const idxChange = last.index - MARKET_DATA[0].index;
  const idxChangePct = (idxChange / MARKET_DATA[0].index) * 100;

  document.getElementById('stat-cost').textContent = formatCNY(last.cost);
  document.getElementById('stat-value').textContent = formatCNY(last.marketValue);

  const profitEl = document.getElementById('stat-profit');
  profitEl.textContent = formatCNY(last.profit);
  profitEl.className = 'stat-value ' + (last.profit >= 0 ? 'up' : 'down');

  const rateEl = document.getElementById('stat-rate');
  rateEl.textContent = formatPercent(last.profitRate);
  rateEl.className = 'stat-value ' + (last.profitRate >= 0 ? 'up' : 'down');

  // 附加信息
  document.getElementById('stat-invest-count').textContent = last.investCount + ' 次';
  document.getElementById('stat-index-now').textContent = last.index.toFixed(2);
  const idxEl = document.getElementById('stat-index-change');
  idxEl.textContent = formatPercent(idxChangePct);
  idxEl.className = 'stat-sub ' + (idxChange >= 0 ? 'up' : 'down');

  // 日期范围
  document.getElementById('date-range').textContent =
    `${start.date} ~ ${last.date}（共 ${dcaSeries.length} 个交易日）`;
}

// ===== 颜色常量（中国习惯：红涨绿跌）=====
const COLOR_UP = '#ef4444';     // 红
const COLOR_DOWN = '#22c55e';   // 绿
const COLOR_INDEX = '#f87171';  // 浅红 - 大盘指数线
const COLOR_VALUE = '#60a5fa';  // 蓝 - 市值线
const COLOR_COST = '#94a3b8';   // 灰 - 成本线
const COLOR_GRID = 'rgba(255,255,255,0.06)';
const COLOR_TEXT = '#cbd5e1';

// ===== 渲染主图：大盘指数 + 投资市值（双 Y 轴）=====
function renderMainChart(dcaSeries) {
  const ctx = document.getElementById('chart-main').getContext('2d');
  const labels = dcaSeries.map(d => d.date);
  const indexData = dcaSeries.map(d => d.index);
  const valueData = dcaSeries.map(d => d.marketValue);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '大盘指数',
          data: indexData,
          borderColor: COLOR_INDEX,
          backgroundColor: 'rgba(248,113,113,0.08)',
          borderWidth: 2,
          yAxisID: 'yIndex',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: COLOR_INDEX,
          tension: 0.25,
          fill: false
        },
        {
          label: '投资市值',
          data: valueData,
          borderColor: COLOR_VALUE,
          backgroundColor: 'rgba(96,165,250,0.10)',
          borderWidth: 2,
          yAxisID: 'yValue',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: COLOR_VALUE,
          tension: 0.25,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: COLOR_TEXT, font: { size: 13 }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLOR_TEXT,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              const i = item.dataIndex;
              const d = dcaSeries[i];
              if (item.dataset.label === '大盘指数') {
                return `大盘指数: ${d.index.toFixed(2)} 点`;
              }
              return [
                `投资市值: ${formatCNY(d.marketValue)}`,
                `累计投入: ${formatCNY(d.cost)}`,
                `累计收益: ${formatCNY(d.profit)}`,
                `收益率: ${formatPercent(d.profitRate)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: COLOR_GRID },
          ticks: {
            color: COLOR_TEXT,
            maxTicksLimit: 12,
            maxRotation: 0
          }
        },
        yIndex: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: '大盘指数 (点)', color: COLOR_INDEX, font: { size: 12 } },
          grid: { color: COLOR_GRID },
          ticks: { color: COLOR_INDEX, callback: (v) => v.toFixed(0) }
        },
        yValue: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: '投资市值 (元)', color: COLOR_VALUE, font: { size: 12 } },
          grid: { drawOnChartArea: false },
          ticks: { color: COLOR_VALUE, callback: (v) => '¥' + v.toFixed(0) }
        }
      }
    }
  });
}

// ===== 渲染副图：累计成本 vs 当前市值（含收益填充）=====
function renderSubChart(dcaSeries) {
  const ctx = document.getElementById('chart-sub').getContext('2d');
  const labels = dcaSeries.map(d => d.date);
  const costData = dcaSeries.map(d => d.cost);
  const valueData = dcaSeries.map(d => d.marketValue);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '累计投入成本',
          data: costData,
          borderColor: COLOR_COST,
          backgroundColor: 'rgba(148,163,184,0.05)',
          borderWidth: 2,
          stepped: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false
        },
        {
          label: '当前市值',
          data: valueData,
          borderColor: COLOR_VALUE,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.25,
          // 填充至成本线，直观展示收益区间
          fill: { target: 0, above: 'rgba(239,68,68,0.18)', below: 'rgba(34,197,94,0.18)' }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: COLOR_TEXT, font: { size: 13 }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLOR_TEXT,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              const i = item.dataIndex;
              const d = dcaSeries[i];
              if (item.dataset.label === '累计投入成本') {
                return `累计投入: ${formatCNY(d.cost)}（第 ${d.investCount} 次定投）`;
              }
              return [
                `当前市值: ${formatCNY(d.marketValue)}`,
                `累计收益: ${formatCNY(d.profit)}`,
                `收益率: ${formatPercent(d.profitRate)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: COLOR_GRID },
          ticks: { color: COLOR_TEXT, maxTicksLimit: 12, maxRotation: 0 }
        },
        y: {
          title: { display: true, text: '金额 (元)', color: COLOR_TEXT, font: { size: 12 } },
          grid: { color: COLOR_GRID },
          ticks: { color: COLOR_TEXT, callback: (v) => '¥' + v.toFixed(0) }
        }
      }
    }
  });
}

// ===== 入口 =====
document.addEventListener('DOMContentLoaded', () => {
  const dcaSeries = calculateDCA(MARKET_DATA);
  updateStatCards(dcaSeries);
  renderMainChart(dcaSeries);
  renderSubChart(dcaSeries);
});
