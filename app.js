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

// ===== 6. 特殊信号检测 =====
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
    const sh = d.marketIndex.find(i => i.code === 'sh000001');
    const cyb = d.marketIndex.find(i => i.code === 'sz399006');
    if (sh && cyb) {
      const diff = sh.changePct - cyb.changePct;
      if (Math.abs(diff) > 1.5) {
        const direction = diff > 0 ? '权重护盘，题材走弱' : '题材活跃，权重压盘';
        signals.push({ level: 'warn', title: '指数严重背离', desc: `上证 ${fmtPct(sh.changePct)} vs 创业板 ${fmtPct(cyb.changePct)}，${direction}，风格切换信号。` });
      }
    }
  }

  if (signals.length === 0) {
    signals.push({ level: 'info', title: '市场运行平稳', desc: '未检测到极端信号，市场处于正常波动范围。' });
  }

  return signals;
}

// ===== 7. 自动生成文字分析报告 =====
function generateTextReport(data) {
  const lines = [];
  const dateStr = new Date().toLocaleDateString('zh-CN');

  lines.push(`## 一、大盘概览`);
  if (data.marketIndex && data.marketIndex.length) {
    const sh = data.marketIndex.find(i => i.code === 'sh000001');
    const cyb = data.marketIndex.find(i => i.code === 'sz399006');
    const kc = data.marketIndex.find(i => i.code === 'sh000688');
    if (sh) {
      lines.push(`截至收盘，上证指数报 ${sh.price.toFixed(2)} 点，${sh.changePct >= 0 ? '上涨' : '下跌'} ${fmtPct(sh.changePct)}，成交 ${fmtAmt(sh.turnover)}。`);
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
  lines.push(`## 四、机构动向（北向资金）`);
  if (data.northbound && data.northbound.latest) {
    const nb = data.northbound.latest;
    const dir = nb.total >= 0 ? '净流入' : '净流出';
    lines.push(`北向资金当日${dir} ${Math.abs(nb.total).toFixed(2)} 亿元，其中沪股通${nb.sh >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.sh).toFixed(2)} 亿，深股通${nb.sz >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.sz).toFixed(2)} 亿。`);
    if (nb.total > 50) {
      lines.push(`外资大幅流入，显示对外围风险偏好回升，重点加仓方向值得跟踪。`);
    } else if (nb.total < -30) {
      lines.push(`外资持续流出，需警惕外部不确定性对A股的扰动。`);
    }
  }

  lines.push('');
  lines.push(`## 五、市场情绪与特殊信号`);
  if (data.limitUp && data.limitDown) {
    lines.push(`涨停 ${data.limitUp.total} 家，跌停 ${data.limitDown.total} 家，涨跌停比 ${data.limitDown.total > 0 ? (data.limitUp.total / data.limitDown.total).toFixed(2) : '∞'}。`);
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
  lines.push(`4. 风险提示：以上分析基于当日数据生成，仅供参考，不构成投资建议。`);

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
    renderFundFlow(data.sectorFundFlow);
    renderInstitutional(data.northbound);
    renderMarketSignals(data);
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
