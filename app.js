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

  // 个股资金龙虎榜（左右两列对照）
  const inflowTop5 = (currentData.stockFundInflow || []).slice(0, 5);
  const outflowTop5 = (currentData.stockFundOutflow || []).slice(0, 5);

  $('stock-inflow-list').innerHTML = inflowTop5.map((s, i) =>
    `<div class="stock-row">
      <span class="sr-rank up">${i + 1}</span>
      <span class="sr-name">${s.name}<em>${s.code}</em></span>
      <span class="sr-pct up">${fmtPct(s.changePct)}</span>
      <span class="sr-amt up">+${(s.mainNetInflow / 100000000).toFixed(2)}亿</span>
    </div>`
  ).join('') || '<div class="empty-tip">暂无数据</div>';

  $('stock-outflow-list').innerHTML = outflowTop5.map((s, i) =>
    `<div class="stock-row">
      <span class="sr-rank down">${i + 1}</span>
      <span class="sr-name">${s.name}<em>${s.code}</em></span>
      <span class="sr-pct down">${fmtPct(s.changePct)}</span>
      <span class="sr-amt down">${(s.mainNetInflow / 100000000).toFixed(2)}亿</span>
    </div>`
  ).join('') || '<div class="empty-tip">暂无数据</div>';
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

// ===== 8. 短期情绪分析 =====
function renderShortTermSentiment(data) {
  if (!data) return;

  // 计算情绪评分（基于涨跌停数量）
  const ztCount = data.limitUp?.total || 0;
  const dtCount = data.limitDown?.total || 0;
  const ratio = dtCount > 0 ? ztCount / dtCount : ztCount;

  let sentimentScore = 50;
  let sentimentLevel = '中性';
  let levelClass = 'neutral';

  if (ratio > 5) { sentimentScore = 85; sentimentLevel = '极度亢奋'; levelClass = 'up'; }
  else if (ratio > 3) { sentimentScore = 70; sentimentLevel = '偏强'; levelClass = 'up'; }
  else if (ratio > 1.5) { sentimentScore = 55; sentimentLevel = '温和'; levelClass = 'neutral'; }
  else if (ratio > 0.5) { sentimentScore = 40; sentimentLevel = '偏弱'; levelClass = 'down'; }
  else { sentimentScore = 25; sentimentLevel = '冰点'; levelClass = 'down'; }

  $('short-sentiment-score').textContent = sentimentScore;
  $('short-sentiment-level').textContent = sentimentLevel;
  $('short-sentiment-level').className = 'mood-badge ' + levelClass;

  // 游资活跃度
  const hotMoneyScore = Math.min(100, Math.round(ztCount * 2 + (data.stockFundInflow?.length || 0)));
  $('hot-money-score').textContent = hotMoneyScore;

  // 涨停质量
  const limitUpQuality = ztCount > 20 ? '优' : ztCount > 10 ? '良' : ztCount > 5 ? '中' : '差';
  $('limit-up-quality').textContent = limitUpQuality;

  // 游资动向分析
  const hotMoneyHtml = generateHotMoneyAnalysis(data);
  $('hot-money-analysis').innerHTML = hotMoneyHtml;

  // 情绪周期定位
  const cycleHtml = generateSentimentCycle(sentimentLevel, sentimentScore);
  $('sentiment-cycle').innerHTML = cycleHtml;

  // 短线操作建议
  const adviceHtml = generateShortTermAdvice(sentimentLevel, sentimentScore, data);
  $('short-term-advice').innerHTML = adviceHtml;
}

function generateHotMoneyAnalysis(data) {
  const lines = [];
  const ztCount = data.limitUp?.total || 0;
  const dtCount = data.limitDown?.total || 0;

  lines.push(`<p><strong>涨停数量：</strong>${ztCount}家，跌停${dtCount}家，涨跌停比${dtCount > 0 ? (ztCount/dtCount).toFixed(2) : '∞'}。</p>`);

  if (data.stockFundInflow && data.stockFundInflow.length > 0) {
    const top5 = data.stockFundInflow.slice(0, 5);
    lines.push(`<p><strong>资金净流入TOP5：</strong>${top5.map(s => s.name).join('、')}，显示主力短期偏好方向。</p>`);
  }

  if (data.sectorRank && data.sectorRank.length > 0) {
    const top3 = [...data.sectorRank].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    lines.push(`<p><strong>短线热点板块：</strong>${top3.map(s => s.name + '(' + fmtPct(s.changePct) + ')').join('、')}，可关注持续性。</p>`);
  }

  return lines.join('');
}

function generateSentimentCycle(level, score) {
  const phases = ['冰点', '复苏', '温和', '偏强', '亢奋'];
  const currentPhase = level === '冰点' ? '冰点期' :
                       level === '偏弱' ? '复苏期' :
                       level === '中性' || level === '温和' ? '温和期' :
                       level === '偏强' ? '偏强期' : '亢奋期';

  const advice = level === '冰点' ? '市场情绪低迷，适合潜伏低吸，等待反转信号。' :
                 level === '偏弱' ? '情绪开始回暖，可小幅试探，控制仓位。' :
                 level === '中性' || level === '温和' ? '情绪温和，适合波段操作，快进快出。' :
                 level === '偏强' ? '情绪偏强，可适度加仓，但注意止盈。' :
                 '情绪亢奋，追高需谨慎，注意风险控制。';

  return `<p><strong>当前阶段：</strong>${currentPhase}（评分：${score}/100）</p><p><strong>周期建议：</strong>${advice}</p>`;
}

function generateShortTermAdvice(level, score, data) {
  const lines = [];

  if (score >= 70) {
    lines.push(`<p>1. <strong>仓位建议：</strong>情绪高涨时保持5-7成仓位，不宜满仓追涨。</p>`);
    lines.push(`<p>2. <strong>操作策略：</strong>快进快出，日内为主，关注热点龙头持续性。</p>`);
    lines.push(`<p>3. <strong>风险提示：</strong>情绪过热时易出现回调，做好止盈准备。</p>`);
  } else if (score >= 50) {
    lines.push(`<p>1. <strong>仓位建议：</strong>保持3-5成仓位，灵活调整。</p>`);
    lines.push(`<p>2. <strong>操作策略：</strong>波段操作为主，关注板块轮动节奏。</p>`);
    lines.push(`<p>3. <strong>关注方向：</strong>资金流入板块+题材热点共振方向。</p>`);
  } else {
    lines.push(`<p>1. <strong>仓位建议：</strong>控制在2-3成，耐心等待机会。</p>`);
    lines.push(`<p>2. <strong>操作策略：</strong>低吸为主，避免追涨，关注超跌反弹。</p>`);
    lines.push(`<p>3. <strong>防守重点：</strong>规避高位股，控制回撤风险。</p>`);
  }

  return lines.join('');
}

// ===== 9. 长期价值分析 =====
function renderLongTermValue(data) {
  if (!data) return;

  // 价值评分（基于北向资金、板块分化等）
  const nbTotal = data.northbound?.latest?.total || 0;
  let valueScore = 50;
  if (nbTotal > 50) valueScore = 70;
  else if (nbTotal > 20) valueScore = 60;
  else if (nbTotal < -30) valueScore = 30;
  else if (nbTotal < -10) valueScore = 40;

  $('long-value-score').textContent = valueScore;

  // 行业生命周期
  const stage = valueScore >= 60 ? '成长期' : valueScore >= 40 ? '成熟期' : '调整期';
  $('industry-stage').textContent = stage;
  $('industry-stage').className = 'mood-badge ' + (valueScore >= 60 ? 'up' : valueScore >= 40 ? 'neutral' : 'down');

  // 北向长期趋势
  const nbTrend = nbTotal > 30 ? '持续流入' : nbTotal > 0 ? '小幅流入' : nbTotal > -20 ? '小幅流出' : '持续流出';
  $('northbound-long').textContent = nbTrend;

  // 风格偏好
  const style = valueScore >= 60 ? '价值+成长' : valueScore >= 40 ? '均衡' : '防守';
  $('value-growth-style').textContent = style;

  // 行业景气度分析
  const prosperityHtml = generateIndustryProsperity(data);
  $('industry-prosperity').innerHTML = prosperityHtml;

  // 北向资金长期信号
  const nbSignalHtml = generateNorthboundSignal(data);
  $('northbound-signal').innerHTML = nbSignalHtml;

  // 长期投资建议
  const adviceHtml = generateLongTermAdvice(valueScore, data);
  $('long-term-advice').innerHTML = adviceHtml;
}

function generateIndustryProsperity(data) {
  const lines = [];

  if (data.sectorFundFlow && data.sectorFundFlow.length > 0) {
    const sorted = [...data.sectorFundFlow].sort((a, b) => b.mainNetInflow - a.mainNetInflow);
    const top3 = sorted.slice(0, 3);
    const bot3 = sorted.slice(-3).reverse();

    lines.push(`<p><strong>高景气行业：</strong>${top3.map(s => s.name).join('、')}，主力资金持续流入，景气度向好。</p>`);
    lines.push(`<p><strong>低景气行业：</strong>${bot3.map(s => s.name).join('、')}，资金流出明显，需谨慎配置。</p>`);
  }

  if (data.sectorRank && data.sectorRank.length > 0) {
    const sorted = [...data.sectorRank].sort((a, b) => b.changePct - a.changePct);
    const growthSectors = sorted.filter(s => s.changePct > 2).slice(0, 5);
    if (growthSectors.length > 0) {
      lines.push(`<p><strong>成长性突出：</strong>${growthSectors.map(s => s.name).join('、')}，涨幅超2%，短期成长动力足。</p>`);
    }
  }

  return lines.join('');
}

function generateNorthboundSignal(data) {
  const lines = [];
  const nb = data.northbound?.latest;

  if (!nb) {
    return `<p>北向资金数据加载中...</p>`;
  }

  const total = nb.total || 0;
  const sh = nb.sh || 0;
  const sz = nb.sz || 0;

  lines.push(`<p><strong>当日净流入：</strong>${total >= 0 ? '+' : ''}${total.toFixed(2)}亿，沪股通${sh.toFixed(2)}亿，深股通${sz.toFixed(2)}亿。</p>`);

  if (total > 50) {
    lines.push(`<p><strong>信号解读：</strong>外资大幅流入，看好A股中长期价值，关注外资偏好板块（消费、医药、科技）。</p>`);
  } else if (total > 20) {
    lines.push(`<p><strong>信号解读：</strong>外资稳步流入，市场信心恢复，适合中长期布局。</p>`);
  } else if (total < -30) {
    lines.push(`<p><strong>信号解读：</strong>外资大幅流出，短期避险情绪升温，需控制仓位。</p>`);
  } else {
    lines.push(`<p><strong>信号解读：</strong>外资流向平稳，市场处于观望状态。</p>`);
  }

  return lines.join('');
}

function generateLongTermAdvice(score, data) {
  const lines = [];

  if (score >= 60) {
    lines.push(`<p>1. <strong>配置方向：</strong>关注北向资金持续流入板块，中长期持有优质龙头。</p>`);
    lines.push(`<p>2. <strong>持仓周期：</strong>建议3-6个月以上，避免频繁调仓。</p>`);
    lines.push(`<p>3. <strong>重点板块：</strong>消费升级、科技创新、高端制造等长期景气赛道。</p>`);
  } else if (score >= 40) {
    lines.push(`<p>1. <strong>配置方向：</strong>均衡配置价值与成长，关注业绩确定性高的标的。</p>`);
    lines.push(`<p>2. <strong>持仓周期：</strong>建议1-3个月，适度灵活调整。</p>`);
    lines.push(`<p>3. <strong>防守策略：</strong>保留部分现金仓位，等待确定性机会。</p>`);
  } else {
    lines.push(`<p>1. <strong>配置方向：</strong>偏防守策略，关注低估值、高分红板块。</p>`);
    lines.push(`<p>2. <strong>持仓周期：</strong>观望为主，控制仓位在30%以下。</p>`);
    lines.push(`<p>3. <strong>避险重点：</strong>公用事业、必需消费等防御性板块。</p>`);
  }

  return lines.join('');
}

// ===== 10. 渲染文字报告 =====
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
  $('status-text').textContent = '数据获取中...';
  $('status-dot').className = 'status-dot loading';

  try {
    const data = await fetchAllMarketData();
    currentData = data;

    renderMarketIndex(data.marketIndex);
    renderSectorRotation(data.sectorRank);
    renderShortTermSentiment(data);
    renderLongTermValue(data);
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
    $('status-text').textContent = '加载失败: ' + (err.message || err);
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
