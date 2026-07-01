// app.js - A股市场分析报告仪表盘
// 图表渲染 + 文字报告自动生成

const API = window.MarketDataAPI;
const COLORS = {
  up: '#ef4444',
  down: '#22c55e',
  neutral: '#60a5fa',
  grid: 'rgba(255,255,255,0.06)',
  text: '#cbd5e1',
  textDim: '#94a3b8',
  card: '#1a2233'
};

let currentData = null;
let charts = {};

// ===== 通用工具 =====
function $(id) { return document.getElementById(id); }

function fmtPct(n) { return API.formatPct(n); }
function fmtAmt(n) { return API.formatAmount(n); }

function pctColor(n) { return n >= 0 ? COLORS.up : COLORS.down; }

function pctClass(n) { return n >= 0 ? 'up' : 'down'; }

// ===== 1. 大盘指数概览 =====
function renderMarketIndex(data) {
  if (!data || !data.length) return;
  const container = $('market-index-grid');
  container.innerHTML = '';
  for (const idx of data) {
    const changeVal = idx.change !== undefined ? idx.change : 0;
    const upDownInfo = (idx.upCount !== undefined && idx.downCount !== undefined)
      ? `涨${idx.upCount} · 跌${idx.downCount}`
      : '';
    const card = document.createElement('div');
    card.className = 'index-card';
    card.innerHTML = `
      <div class="idx-name">${idx.name}</div>
      <div class="idx-price ${pctClass(idx.changePct)}">${idx.price.toFixed(2)}</div>
      <div class="idx-change ${pctClass(idx.changePct)}">
        ${fmtPct(idx.changePct)} · ${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}
      </div>
      <div class="idx-sub">${upDownInfo || '成交 ' + fmtAmt(idx.turnover)}</div>
    `;
    container.appendChild(card);
  }
}

// ===== 2. 板块轮动分析（涨跌幅排行 + 柱状图）=====
function renderSectorRotation(data) {
  if (!data || !data.length) return;

  const top10 = [...data].sort((a, b) => b.changePct - a.changePct).slice(0, 10);
  const bottom10 = [...data].sort((a, b) => a.changePct - b.changePct).slice(0, 10).reverse();

  const labels = [...bottom10.map(d => d.name), ...top10.map(d => d.name)];
  const values = [...bottom10.map(d => d.changePct), ...top10.map(d => d.changePct)];
  const colors = values.map(v => v >= 0 ? 'rgba(239,68,68,0.85)' : 'rgba(34,197,94,0.85)');

  const ctx = $('chart-sector').getContext('2d');
  if (charts.sector) charts.sector.destroy();
  charts.sector = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '涨跌幅 %',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        barThickness: 14
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (item) => `涨跌幅: ${fmtPct(item.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text, callback: v => v + '%' }
        },
        y: {
          grid: { display: false },
          ticks: { color: COLORS.text, font: { size: 11 } }
        }
      }
    }
  });

  // 领涨领跌文字
  const top3 = top10.slice(0, 3);
  const bot3 = [...data].sort((a, b) => a.changePct - b.changePct).slice(0, 3);
  $('sector-top3').innerHTML = top3.map((s, i) =>
    `<div class="rank-item"><span class="rank-no up">${i + 1}</span><span class="rank-name">${s.name}</span><span class="rank-val up">${fmtPct(s.changePct)}</span></div>`
  ).join('');
  $('sector-bottom3').innerHTML = bot3.map((s, i) =>
    `<div class="rank-item"><span class="rank-no down">${i + 1}</span><span class="rank-name">${s.name}</span><span class="rank-val down">${fmtPct(s.changePct)}</span></div>`
  ).join('');
}

// ===== 3. 大资金流向（板块资金）=====
function renderFundFlow(data) {
  if (!data || !data.length) return;

  const sorted = [...data].sort((a, b) => b.mainNetInflow - a.mainNetInflow);
  const top8 = sorted.slice(0, 8);
  const bot8 = sorted.slice(-8).reverse();

  const labels = [...bot8.map(d => d.name), ...top8.map(d => d.name)];
  const values = [...bot8.map(d => d.mainNetInflow / 100000000), ...top8.map(d => d.mainNetInflow / 100000000)];
  const colors = values.map(v => v >= 0 ? 'rgba(239,68,68,0.85)' : 'rgba(34,197,94,0.85)');

  const ctx = $('chart-funds').getContext('2d');
  if (charts.funds) charts.funds.destroy();
  charts.funds = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '主力净流入 (亿)',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        barThickness: 14
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (item) => `主力净流入: ${item.raw.toFixed(2)}亿`
          }
        }
      },
      scales: {
        x: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text, callback: v => v + '亿' }
        },
        y: {
          grid: { display: false },
          ticks: { color: COLORS.text, font: { size: 11 } }
        }
      }
    }
  });

  // 个股资金榜单
  const inflowTop5 = (currentData.stockFundInflow || []).slice(0, 5);
  const outflowTop5 = (currentData.stockFundOutflow || []).slice(0, 5);

  $('stock-inflow-top').innerHTML = inflowTop5.map((s, i) =>
    `<div class="rank-item">
      <span class="rank-no up">${i + 1}</span>
      <span class="rank-name">${s.name}<em>${s.code}</em></span>
      <span class="rank-val up">${fmtPct(s.changePct)}</span>
      <span class="rank-amt up">+${(s.mainNetInflow / 100000000).toFixed(2)}亿</span>
    </div>`
  ).join('');

  $('stock-outflow-top').innerHTML = outflowTop5.map((s, i) =>
    `<div class="rank-item">
      <span class="rank-no down">${i + 1}</span>
      <span class="rank-name">${s.name}<em>${s.code}</em></span>
      <span class="rank-val down">${fmtPct(s.changePct)}</span>
      <span class="rank-amt down">${(s.mainNetInflow / 100000000).toFixed(2)}亿</span>
    </div>`
  ).join('');
}

// ===== 4. 机构动向（北向资金曲线 + 数据）=====
function renderInstitutional(data) {
  if (!data || !data.series || !data.series.length) {
    $('northbound-summary').innerHTML = '<div class="empty-tip">北向资金数据加载中...</div>';
    return;
  }

  const series = data.series;
  const valid = series.filter(s => s.total > 0 || s.sh > 0 || s.sz > 0);

  const labels = valid.map(s => s.time);
  const totalData = valid.map(s => s.total);
  const shData = valid.map(s => s.sh);
  const szData = valid.map(s => s.sz);

  const latest = valid[valid.length - 1];

  const ctx = $('chart-northbound').getContext('2d');
  if (charts.northbound) charts.northbound.destroy();
  charts.northbound = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '北向合计',
          data: totalData,
          borderColor: COLORS.neutral,
          backgroundColor: 'rgba(96,165,250,0.15)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: '沪股通',
          data: shData,
          borderColor: '#f87171',
          borderWidth: 1.5,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderDash: [4, 2]
        },
        {
          label: '深股通',
          data: szData,
          borderColor: '#22d3ee',
          borderWidth: 1.5,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderDash: [4, 2]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: COLORS.text, font: { size: 12 }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (item) => `${item.dataset.label}: ${item.raw.toFixed(2)}亿`
          }
        }
      },
      scales: {
        x: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text, maxTicksLimit: 10, maxRotation: 0 }
        },
        y: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text, callback: v => v + '亿' }
        }
      }
    }
  });

  // 北向数据卡片
  const netDir = latest.total >= 0 ? 'up' : 'down';
  $('northbound-total').innerHTML = `<span class="${netDir}">${latest.total.toFixed(2)}亿</span>`;
  $('northbound-sh').innerHTML = `<span class="${latest.sh >= 0 ? 'up' : 'down'}">${latest.sh.toFixed(2)}亿</span>`;
  $('northbound-sz').innerHTML = `<span class="${latest.sz >= 0 ? 'up' : 'down'}">${latest.sz.toFixed(2)}亿</span>`;
}

// ===== 5. 市场特殊信号（涨跌停、情绪）=====
function renderMarketSignals(data) {
  const up = data.limitUp || { total: 0, list: [] };
  const down = data.limitDown || { total: 0, list: [] };

  $('zt-count').textContent = up.total;
  $('dt-count').textContent = down.total;
  $('zt-dt-ratio').textContent = down.total > 0 ? (up.total / down.total).toFixed(2) : '∞';

  // 情绪判断
  const totalStocks = 5000;
  const ztRatio = up.total / totalStocks * 100;
  let mood = '';
  let moodClass = '';
  if (ztRatio > 3) { mood = '极度亢奋'; moodClass = 'up'; }
  else if (ztRatio > 2) { mood = '偏强'; moodClass = 'up'; }
  else if (ztRatio > 1) { mood = '中性'; moodClass = 'neutral'; }
  else if (ztRatio > 0.5) { mood = '偏弱'; moodClass = 'down'; }
  else { mood = '冰点'; moodClass = 'down'; }

  $('market-mood').textContent = mood;
  $('market-mood').className = 'mood-badge ' + moodClass;

  // 涨停板列表 TOP 10
  const topList = (up.list || []).slice(0, 10);
  $('zt-list').innerHTML = topList.map(s =>
    `<div class="zt-item">
      <span class="zt-name">${s.name}<em>${s.code}</em></span>
      <span class="zt-pct up">${fmtPct(s.changePct)}</span>
      <span class="zt-hy">${s.industry || '--'}</span>
      <span class="zt-days">${s.limitDays > 1 ? s.limitDays + '连板' : '首板'}</span>
    </div>`
  ).join('');

  // 特殊信号检测
  const signals = detectSpecialSignals();
  $('signal-list').innerHTML = signals.map(s =>
    `<div class="signal-item ${s.level}">
      <span class="signal-icon">${s.level === 'danger' ? '⚠' : s.level === 'warn' ? '⚡' : '💡'}</span>
      <div>
        <div class="signal-title">${s.title}</div>
        <div class="signal-desc">${s.desc}</div>
      </div>
    </div>`
  ).join('');
}

// ===== 9. 概念板块分析 =====
function renderConceptSector(data) {
  if (!data || !data.length) return;
  const top15 = [...data].sort((a, b) => b.changePct - a.changePct).slice(0, 15);

  const labels = top15.map(d => d.name);
  const values = top15.map(d => d.changePct);
  const colors = values.map(v => v >= 0 ? 'rgba(239,68,68,0.85)' : 'rgba(34,197,94,0.85)');

  const ctx = $('chart-concept').getContext('2d');
  if (charts.concept) charts.concept.destroy();
  charts.concept = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '今日涨跌幅 %',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        barThickness: 16
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (item) => {
              const d = top15[item.dataIndex];
              return [
                `今日: ${fmtPct(d.changePct)}`,
                `5日: ${fmtPct(d.change5d)}`,
                `20日: ${fmtPct(d.change20d)}`,
                `主力净流入: ${d.mainNetInflow ? (d.mainNetInflow/100000000).toFixed(2)+'亿' : '--'}`
              ];
            }
          }
        }
      },
      scales: {
        x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, callback: v => v + '%' } },
        y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 11 } } }
      }
    }
  });

  // 概念板块列表
  const top10 = [...data].sort((a, b) => b.changePct - a.changePct).slice(0, 10);
  $('concept-top10').innerHTML = top10.map((s, i) =>
    `<div class="rank-item with-history">
      <span class="rank-no up">${i + 1}</span>
      <span class="rank-name">${s.name}</span>
      <span class="rank-val up">${fmtPct(s.changePct)}</span>
      <span class="rank-hist">${s.change5d !== undefined ? '5日 ' + fmtPct(s.change5d) : ''}</span>
    </div>`
  ).join('');
}

// ===== 10. 历史对比分析（5日/20日涨跌幅）=====
function renderHistoryComparison(data) {
  if (!data || !data.length) return;
  const sorted = [...data].sort((a, b) => b.changePct - a.changePct);
  const top10 = sorted.slice(0, 10);
  const bot10 = sorted.slice(-10).reverse();

  // 三组数据：今日/5日/20日
  const labels = [...bot10.map(d => d.name), ...top10.map(d => d.name)];
  const todayData = [...bot10.map(d => d.changePct), ...top10.map(d => d.changePct)];
  const fiveDayData = [...bot10.map(d => d.change5d || 0), ...top10.map(d => d.change5d || 0)];
  const twentyDayData = [...bot10.map(d => d.change20d || 0), ...top10.map(d => d.change20d || 0)];

  const ctx = $('chart-history').getContext('2d');
  if (charts.history) charts.history.destroy();
  charts.history = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: '今日 %', data: todayData, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 3, barThickness: 8 },
        { label: '5日 %', data: fiveDayData, backgroundColor: 'rgba(96,165,250,0.8)', borderRadius: 3, barThickness: 8 },
        { label: '20日 %', data: twentyDayData, backgroundColor: 'rgba(168,85,247,0.8)', borderRadius: 3, barThickness: 8 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: COLORS.text, font: { size: 11 }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (item) => `${item.dataset.label}: ${fmtPct(item.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, callback: v => v + '%' } },
        y: { grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10 } } }
      }
    }
  });

  // 趋势分析文字
  const trends = [];
  const upToday5d = sorted.filter(s => s.changePct > 0 && (s.change5d || 0) > 0);
  const downToday5d = sorted.filter(s => s.changePct < 0 && (s.change5d || 0) < 0);
  const strong20d = sorted.filter(s => (s.change20d || 0) > 10).sort((a,b) => (b.change20d||0) - (a.change20d||0)).slice(0, 3);
  const weak20d = sorted.filter(s => (s.change20d || 0) < -5).sort((a,b) => (a.change20d||0) - (b.change20d||0)).slice(0, 3);

  trends.push(`<div class="trend-item"><span class="trend-label up">短期强势</span>${upToday5d.length} 个板块今日与5日同涨，趋势延续</div>`);
  trends.push(`<div class="trend-item"><span class="trend-label down">短期弱势</span>${downToday5d.length} 个板块今日与5日同跌，注意回避</div>`);
  if (strong20d.length) trends.push(`<div class="trend-item"><span class="trend-label up">20日最强</span>${strong20d.map(s=>s.name+'('+fmtPct(s.change20d)+')').join('、')}</div>`);
  if (weak20d.length) trends.push(`<div class="trend-item"><span class="trend-label down">20日最弱</span>${weak20d.map(s=>s.name+'('+fmtPct(s.change20d)+')').join('、')}</div>`);

  $('trend-analysis').innerHTML = trends.join('');
}

// ===== 11. 龙虎榜机构席位 =====
function renderDragonTiger(data) {
  if (!data || !data.list || !data.list.length) {
    $('dragon-tiger-list').innerHTML = '<div class="empty-tip">暂无龙虎榜数据（可能收盘后更新）</div>';
    return;
  }
  $('dragon-tiger-list').innerHTML = data.list.slice(0, 15).map((s, i) =>
    `<div class="rank-item with-amt">
      <span class="rank-no up">${i + 1}</span>
      <span class="rank-name">${s.name}<em>${s.code}</em></span>
      <span class="rank-val up">${fmtPct(s.changePct)}</span>
      <span class="rank-amt">${s.industry || '--'}</span>
    </div>`
  ).join('');
}

// ===== 12. 涨跌停深度统计（炸板率/连板梯队）=====
function renderLimitDepth(data) {
  const up = data.limitUp || { total: 0, list: [] };
  const broken = data.brokenLimit || { total: 0, list: [] };
  const ladder = data.limitLadder || { ladder: [], firstBoardCount: 0, multiBoardCount: 0, maxHeight: 0 };

  // 炸板率 = 炸板数 / (涨停数 + 炸板数)
  const totalAttempt = up.total + broken.total;
  const brokenRate = totalAttempt > 0 ? (broken.total / totalAttempt * 100).toFixed(1) : '0';

  $('broken-count').textContent = broken.total;
  $('broken-rate').textContent = brokenRate + '%';
  $('first-board-count').textContent = ladder.firstBoardCount;
  $('multi-board-count').textContent = ladder.multiBoardCount;
  $('max-ladder-height').textContent = ladder.maxHeight > 0 ? ladder.maxHeight + '板' : '--';

  // 炸板率情绪判断
  let brokenMood = '';
  let brokenClass = '';
  const br = Number(brokenRate);
  if (br > 40) { brokenMood = '情绪转弱'; brokenClass = 'down'; }
  else if (br > 25) { brokenMood = '分歧加大'; brokenClass = 'warn'; }
  else if (br > 10) { brokenMood = '情绪稳定'; brokenClass = 'neutral'; }
  else { brokenMood = '情绪强势'; brokenClass = 'up'; }
  $('broken-mood').textContent = brokenMood;
  $('broken-mood').className = 'mood-badge ' + brokenClass;

  // 连板梯队
  if (ladder.ladder && ladder.ladder.length) {
    $('ladder-list').innerHTML = ladder.ladder.map(l => {
      const heightText = l.height === 1 ? '首板' : l.height + '连板';
      const barWidth = Math.min(l.count / ladder.ladder[0].count * 100, 100);
      return `<div class="ladder-item">
        <span class="ladder-height">${heightText}</span>
        <div class="ladder-bar-bg"><div class="ladder-bar" style="width:${barWidth}%"></div></div>
        <span class="ladder-count">${l.count}</span>
      </div>`;
    }).join('');
  } else {
    $('ladder-list').innerHTML = '<div class="empty-tip">暂无连板数据</div>';
  }

  // 炸板列表 TOP10
  const brokenTop = (broken.list || []).slice(0, 10);
  $('broken-list').innerHTML = brokenTop.length ? brokenTop.map(s =>
    `<div class="zt-item">
      <span class="zt-name">${s.name}<em>${s.code}</em></span>
      <span class="zt-pct ${pctClass(s.changePct)}">${fmtPct(s.changePct)}</span>
      <span class="zt-hy">${s.industry || '--'}</span>
      <span class="zt-days" style="color:var(--up)">炸${s.limitOpenCount || 1}次</span>
    </div>`
  ).join('') : '<div class="empty-tip">今日无炸板</div>';
}

// ===== 13. 扩展信号检测 =====
function detectSpecialSignals() {
  const signals = [];
  const d = currentData;
  if (!d) return signals;

  // 信号1：涨跌停比极端
  if (d.limitUp && d.limitDown && d.limitDown.total > 0) {
    const ratio = d.limitUp.total / d.limitDown.total;
    if (ratio > 10) {
      signals.push({ level: 'info', title: '赚钱效应极强', desc: `涨停 ${d.limitUp.total} 家 / 跌停 ${d.limitDown.total} 家，比例 ${ratio.toFixed(1)}:1，市场情绪亢奋。` });
    } else if (ratio < 0.3) {
      signals.push({ level: 'danger', title: '亏钱效应显著', desc: `涨停 ${d.limitUp.total} 家 / 跌停 ${d.limitDown.total} 家，比例 ${ratio.toFixed(2)}:1，需控制仓位。` });
    }
  }

  // 信号2：北向资金大幅净流入/流出
  if (d.northbound && d.northbound.latest) {
    const nb = d.northbound.latest.total;
    if (nb > 100) {
      signals.push({ level: 'info', title: '北向资金大幅净流入', desc: `北向当日净流入 ${nb.toFixed(2)} 亿元，外资积极入场，关注核心资产方向。` });
    } else if (nb < -50) {
      signals.push({ level: 'warn', title: '北向资金大幅净流出', desc: `北向当日净流出 ${Math.abs(nb).toFixed(2)} 亿元，外资风险偏好下降，需谨慎。` });
    }
  }

  // 信号3：板块极度分化
  if (d.sectorRank && d.sectorRank.length >= 5) {
    const sorted = [...d.sectorRank].sort((a, b) => b.changePct - a.changePct);
    const top = sorted[0].changePct;
    const bot = sorted[sorted.length - 1].changePct;
    const diff = top - bot;
    if (diff > 6) {
      signals.push({ level: 'warn', title: '板块分化加剧', desc: `最强板块 ${sorted[0].name} 涨 ${fmtPct(top)}，最弱板块 ${sorted[sorted.length - 1].name} 跌 ${fmtPct(bot)}，分化超 ${diff.toFixed(1)} 个百分点。` });
    }
  }

  // 信号4：资金集中抱团
  if (d.sectorFundFlow && d.sectorFundFlow.length >= 3) {
    const sorted = [...d.sectorFundFlow].sort((a, b) => b.mainNetInflow - a.mainNetInflow);
    const topInflow = sorted[0].mainNetInflow / 100000000;
    if (topInflow > 100) {
      signals.push({ level: 'info', title: '资金集中抱团', desc: `${sorted[0].name} 板块主力净流入 ${topInflow.toFixed(2)} 亿元，为市场最强主线，关注持续性。` });
    }
  }

  // 信号5：指数背离
  if (d.marketIndex && d.marketIndex.length >= 4) {
    const sh = d.marketIndex.find(i => i.code === '000001' || i.code === 'sh000001');
    const cyb = d.marketIndex.find(i => i.code === '399006' || i.code === 'sz399006');
    if (sh && cyb) {
      const diff = sh.changePct - cyb.changePct;
      if (Math.abs(diff) > 1.5) {
        const direction = diff > 0 ? '权重护盘，题材走弱' : '题材活跃，权重压盘';
        signals.push({ level: 'warn', title: '指数严重背离', desc: `上证 ${fmtPct(sh.changePct)} vs 创业板 ${fmtPct(cyb.changePct)}，${direction}，风格切换信号。` });
      }
    }
  }

  // 信号6：炸板率过高（新增）
  if (d.brokenLimit && d.limitUp) {
    const totalAttempt = d.limitUp.total + d.brokenLimit.total;
    if (totalAttempt > 10) {
      const brokenRate = d.brokenLimit.total / totalAttempt * 100;
      if (brokenRate > 40) {
        signals.push({ level: 'danger', title: '炸板率过高', desc: `炸板 ${d.brokenLimit.total} 家 / 封板 ${d.limitUp.total} 家，炸板率 ${brokenRate.toFixed(1)}%，打板风险加大。` });
      }
    }
  }

  // 信号7：连板高度（新增）
  if (d.limitLadder && d.limitLadder.maxHeight >= 4) {
    signals.push({ level: 'info', title: '连板高度突破', desc: `最高 ${d.limitLadder.maxHeight} 连板，游资做多意愿强烈，市场赚钱效应延续。` });
  }

  if (signals.length === 0) {
    signals.push({ level: 'info', title: '市场运行平稳', desc: '未检测到极端信号，市场处于正常波动范围。' });
  }

  return signals;
}

// ===== 7. 自动生成文字分析报告 =====
function generateTextReport(data) {
  const lines = [];

  lines.push(`## 一、大盘概览`);
  if (data.marketIndex && data.marketIndex.length) {
    const sh = data.marketIndex.find(i => i.code === '000001' || i.code === 'sh000001');
    const cyb = data.marketIndex.find(i => i.code === '399006' || i.code === 'sz399006');
    const kc = data.marketIndex.find(i => i.code === '000688' || i.code === 'sh000688');
    if (sh) {
      lines.push(`截至收盘，上证指数报 ${sh.price.toFixed(2)} 点，${sh.changePct >= 0 ? '上涨' : '下跌'} ${fmtPct(sh.changePct)}，上涨 ${sh.upCount || '--'} 家，下跌 ${sh.downCount || '--'} 家。`);
    }
    if (cyb && kc) {
      lines.push(`创业板指${fmtPct(cyb.changePct)}，科创50${fmtPct(kc.changePct)}，${kc.changePct > cyb.changePct ? '科技成长领涨' : '科技成长相对偏弱'}。`);
    }
  }

  lines.push('');
  lines.push(`## 二、板块轮动分析`);
  if (data.sectorRank && data.sectorRank.length) {
    const sorted = [...data.sectorRank].sort((a, b) => b.changePct - a.changePct);
    const top5 = sorted.slice(0, 5);
    const bot5 = sorted.slice(-5);
    lines.push(`**领涨板块：** ${top5.map(s => s.name + '（' + fmtPct(s.changePct) + '）').join('、')}。`);
    lines.push(`**领跌板块：** ${bot5.map(s => s.name + '（' + fmtPct(s.changePct) + '）').join('、')}。`);
    const diff = top5[0].changePct - bot5[0].changePct;
    lines.push(`板块分化${diff > 5 ? '显著' : '相对温和'}，首尾相差 ${diff.toFixed(2)} 个百分点。`);
  }

  // 概念板块
  if (data.conceptSector && data.conceptSector.length) {
    const conceptTop3 = [...data.conceptSector].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    lines.push(`**热门概念：** ${conceptTop3.map(s => s.name + '（' + fmtPct(s.changePct) + '）').join('、')}。`);
  }

  // 历史对比
  if (data.sectorRankHistory && data.sectorRankHistory.length) {
    const sorted = [...data.sectorRankHistory].sort((a, b) => b.changePct - a.changePct);
    const trendUp = sorted.filter(s => s.changePct > 0 && (s.change5d || 0) > 0).length;
    const trendDown = sorted.filter(s => s.changePct < 0 && (s.change5d || 0) < 0).length;
    lines.push(`**趋势延续性：** ${trendUp} 个板块今日与5日同涨（短期强势），${trendDown} 个板块今日与5日同跌（短期弱势）。`);
  }

  lines.push('');
  lines.push(`## 三、主力资金流向`);
  if (data.sectorFundFlow && data.sectorFundFlow.length) {
    const sorted = [...data.sectorFundFlow].sort((a, b) => b.mainNetInflow - a.mainNetInflow);
    const inflow3 = sorted.slice(0, 3);
    const outflow3 = sorted.slice(-3).reverse();
    lines.push(`**主力净流入前三：** ${inflow3.map(s => s.name + '（+' + (s.mainNetInflow / 100000000).toFixed(2) + '亿）').join('、')}。`);
    lines.push(`**主力净流出前三：** ${outflow3.map(s => s.name + '（' + (s.mainNetInflow / 100000000).toFixed(2) + '亿）').join('、')}。`);
    const topInflow = inflow3[0].mainNetInflow / 100000000;
    if (topInflow > 100) {
      lines.push(`资金明显向 ${inflow3[0].name} 集中，显示市场主线明确。`);
    }
  }

  lines.push('');
  lines.push(`## 四、机构动向`);
  if (data.northbound && data.northbound.latest) {
    const nb = data.northbound.latest;
    const dir = nb.total >= 0 ? '净流入' : '净流出';
    lines.push(`**北向资金：** 当日${dir} ${Math.abs(nb.total).toFixed(2)} 亿元，其中沪股通${nb.sh >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.sh).toFixed(2)} 亿，深股通${nb.sz >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.sz).toFixed(2)} 亿。`);
  }
  if (data.dragonTiger && data.dragonTiger.list && data.dragonTiger.list.length) {
    lines.push(`**龙虎榜：** 共 ${data.dragonTiger.total} 只个股上榜，机构席位活跃度${data.dragonTiger.total > 30 ? '较高' : '一般'}。`);
  }

  lines.push('');
  lines.push(`## 五、市场情绪与特殊信号`);
  if (data.limitUp && data.limitDown) {
    lines.push(`涨停 ${data.limitUp.total} 家，跌停 ${data.limitDown.total} 家，涨跌停比 ${data.limitDown.total > 0 ? (data.limitUp.total / data.limitDown.total).toFixed(2) : '∞'}。`);
  }
  // 炸板率与连板
  if (data.brokenLimit && data.limitUp) {
    const totalAttempt = data.limitUp.total + data.brokenLimit.total;
    if (totalAttempt > 0) {
      const brokenRate = (data.brokenLimit.total / totalAttempt * 100).toFixed(1);
      lines.push(`炸板 ${data.brokenLimit.total} 家，炸板率 ${brokenRate}%，${Number(brokenRate) > 30 ? '打板风险加大' : '封板质量良好'}。`);
    }
  }
  if (data.limitLadder && data.limitLadder.maxHeight > 0) {
    lines.push(`连板梯队：首板 ${data.limitLadder.firstBoardCount} 家，连板 ${data.limitLadder.multiBoardCount} 家，最高 ${data.limitLadder.maxHeight} 连板。`);
  }

  const signals = detectSpecialSignals();
  signals.forEach((s, i) => {
    const levelText = s.level === 'danger' ? '【风险提示】' : s.level === 'warn' ? '【预警信号】' : '【关注信号】';
    lines.push(`${levelText} ${s.title}：${s.desc}`);
  });

  lines.push('');
  lines.push(`## 六、操作建议`);
  lines.push(`1. 主线方向：聚焦资金持续流入的板块，避免逆势抄底弱势板块。`);
  lines.push(`2. 仓位控制：根据市场情绪调整仓位，亢奋时减仓、冰点时加仓。`);
  lines.push(`3. 风格切换：关注权重与成长的轮动节奏，避免单边押注。`);
  lines.push(`4. 打板策略：关注炸板率变化，炸板率超30%时减少打板操作。`);
  lines.push(`5. 风险提示：以上分析基于当日数据生成，仅供参考，不构成投资建议。`);

  return lines.join('\n\n');
}

// ===== 8. 渲染文字报告 =====
function renderTextReport(data) {
  const report = generateTextReport(data);
  const container = $('text-report');
  // Markdown 简易渲染（标题、加粗、列表）
  let html = report
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => match.startsWith('<') ? match : '<p>' + match + '</p>');
  html = html.replace(/<li>(.+?)<\/li>/g, (m, g) => m);
  container.innerHTML = html;
}

// ===== 9. 数据加载与刷新 =====
let refreshTimer = null;

async function loadData() {
  $('status-text').textContent = '数据加载中...';
  $('status-dot').className = 'status-dot loading';

  try {
    const data = await API.fetchAllMarketData();
    currentData = data;

    renderMarketIndex(data.marketIndex);
    renderSectorRotation(data.sectorRank);
    renderConceptSector(data.conceptSector);
    renderHistoryComparison(data.sectorRankHistory);
    renderFundFlow(data.sectorFundFlow);
    renderInstitutional(data.northbound);
    renderDragonTiger(data.dragonTiger);
    renderMarketSignals(data);
    renderLimitDepth(data);
    renderTextReport(data);

    const now = new Date();
    $('update-time').textContent = now.toLocaleTimeString('zh-CN');
    $('status-text').textContent = '数据已更新';
    $('status-dot').className = 'status-dot ready';
  } catch (err) {
    console.error('加载失败:', err);
    $('status-text').textContent = '加载失败';
    $('status-dot').className = 'status-dot error';
  }
}

function toggleAutoRefresh(enabled) {
  if (enabled) {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(loadData, 60000);
  } else {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }
}

// ===== 10. 标签页切换 =====
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('panel-' + target).classList.add('active');
    });
  });
}

// ===== 11. 导出报告 =====
function exportReport() {
  const report = generateTextReport(currentData);
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `A股市场分析报告_${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== 入口 =====
document.addEventListener('DOMContentLoaded', () => {
  initTabs();

  $('btn-refresh').addEventListener('click', loadData);
  $('btn-export').addEventListener('click', exportReport);
  $('auto-refresh').addEventListener('change', (e) => {
    toggleAutoRefresh(e.target.checked);
  });

  loadData();
});
