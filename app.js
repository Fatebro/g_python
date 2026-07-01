const API = window.MarketDataAPI;

let currentData = null;
let refreshTimer = null;

function $(id) { return document.getElementById(id); }

function fmtPct(n) { return API.formatPct(n); }
function fmtAmt(n) { return API.formatAmount(n); }

function pctClass(n) { return n >= 0 ? 'up' : 'down'; }

let currentTooltip = null;
let tooltipData = {
  sentimentBreakdown: null,
  advice: null,
  sectors: {}
};

function buildSentimentTooltipHTML(breakdown, totalScore) {
  if (!breakdown) return '';
  const items = [
    { key: 'index', label: '大盘涨跌' },
    { key: 'limitUp', label: '涨停家数' },
    { key: 'limitDown', label: '跌停家数' },
    { key: 'limitRatio', label: '涨跌停比' },
    { key: 'brokenRate', label: '炸板率' },
    { key: 'ladder', label: '连板高度' },
    { key: 'northbound', label: '北向资金' },
    { key: 'sectorBreadth', label: '板块涨跌比' }
  ];

  let maxAbs = 1;
  items.forEach(it => {
    const val = Math.abs(breakdown[it.key]?.value || 0);
    if (val > maxAbs) maxAbs = val;
  });

  const rows = items.map(it => {
    const d = breakdown[it.key];
    if (!d) return '';
    const val = d.value;
    const isPos = val >= 0;
    const pct = Math.abs(val) / maxAbs * 100;
    return `
      <div class="tooltip-row">
        <span class="tooltip-label">${d.label}</span>
        <span class="tooltip-bar">
          <span class="tooltip-bar-fill ${isPos ? 'positive' : 'negative'}" style="width:${pct}%;margin-left:${isPos ? '50%' : (50 - pct) + '%'};"></span>
        </span>
        <span class="tooltip-value ${isPos ? 'positive' : 'negative'}">${val >= 0 ? '+' : ''}${val}</span>
      </div>
      <div class="tooltip-detail">${d.detail || ''}</div>
    `;
  }).join('');

  return `
    <div class="tooltip-title">📊 情绪评分构成</div>
    ${rows}
    <div class="tooltip-total">
      <span>基础分 + 调整 = 总分</span>
      <span class="tooltip-total-val ${totalScore >= 50 ? 'up' : 'down'}">${breakdown.base} ${totalScore - breakdown.base >= 0 ? '+' : ''}${totalScore - breakdown.base} = ${totalScore}</span>
    </div>
    <div class="tooltip-note">情绪评分从 8 个维度综合计算，基础分 50 分，正数加分、负数减分。分值越高代表市场情绪越亢奋，越低代表越低迷。</div>
  `;
}

function buildSectorTooltipHTML(sector) {
  if (!sector || !sector.scoreBreakdown) return '';
  const b = sector.scoreBreakdown;
  const items = [
    { key: 'today', label: '今日涨幅' },
    { key: 'd5', label: '5日动量' },
    { key: 'd20', label: '20日趋势' },
    { key: 'fund', label: '主力资金额' },
    { key: 'fundPct', label: '资金占比' },
    { key: 'bonus', label: '共振加分' }
  ];

  let maxAbs = 1;
  items.forEach(it => {
    const val = Math.abs(b[it.key]?.value || 0);
    if (val > maxAbs) maxAbs = val;
  });

  const rows = items.map(it => {
    const d = b[it.key];
    if (!d) return '';
    const val = d.value;
    const isPos = val >= 0;
    const pct = Math.abs(val) / maxAbs * 100;
    return `
      <div class="tooltip-row">
        <span class="tooltip-label">${d.label}</span>
        <span class="tooltip-bar">
          <span class="tooltip-bar-fill ${isPos ? 'positive' : 'negative'}" style="width:${pct}%;margin-left:${isPos ? '50%' : (50 - pct) + '%'};"></span>
        </span>
        <span class="tooltip-value ${isPos ? 'positive' : 'negative'}">${val >= 0 ? '+' : ''}${val.toFixed(0)}</span>
      </div>
      <div class="tooltip-detail">${d.raw || ''}${d.weight ? '（权重' + d.weight + '分）' : ''}</div>
    `;
  }).join('');

  return `
    <div class="tooltip-title">🎯 机会评分构成 · ${sector.name}</div>
    ${rows}
    <div class="tooltip-total">
      <span>总评分</span>
      <span class="tooltip-total-val ${sector.score >= 50 ? 'up' : 'down'}">${sector.score} 分</span>
    </div>
    <div class="tooltip-note">满分 100 分，60 分以上可关注，70 分以上强势，30 分以下建议回避。</div>
  `;
}

function buildActionTooltipHTML(advice, score) {
  const steps = [
    { title: '计算情绪评分', desc: `从 8 个维度综合得出 <strong>${score} 分</strong>` },
    { title: '判断情绪区间', desc: score >= 75 ? '处于 <strong>亢奋区间</strong>' : score >= 60 ? '处于 <strong>偏强区间</strong>' : score >= 40 ? '处于 <strong>中性区间</strong>' : score >= 25 ? '处于 <strong>偏弱区间</strong>' : '处于 <strong>冰点区间</strong>' },
    { title: '匹配操作策略', desc: `建议操作：<strong>${advice.action}</strong>` },
    { title: '设定仓位区间', desc: `建议仓位：<strong>${advice.position}</strong>` }
  ];

  const stepsHTML = steps.map((s, i) => `
    <div class="action-tip-item">
      <span class="action-tip-step">${i + 1}</span>
      <div class="action-tip-text"><strong>${s.title}</strong><br>${s.desc}</div>
    </div>
  `).join('');

  return `
    <div class="tooltip-title">🔗 决策链：从数据到操作</div>
    <div class="action-tip-list">${stepsHTML}</div>
    <div class="tooltip-note">决策逻辑：情绪分越高，仓位越轻（防止追高）；情绪分越低，仓位越重（逆向布局）。反向操作是长期盈利的核心。</div>
  `;
}

function showTooltip(targetEl, html) {
  hideTooltip();
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.innerHTML = html;
  document.body.appendChild(tip);

  const rect = targetEl.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();

  let top = rect.bottom + 8 + window.scrollY;
  let left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;

  if (left < 10) left = 10;
  if (left + tipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tipRect.width - 10;
  }

  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
  tip.style.position = 'absolute';

  requestAnimationFrame(() => tip.classList.add('show'));
  currentTooltip = tip;
}

function hideTooltip() {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}

function initTooltips() {
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.has-tip');
    if (!target) return;

    const tipType = target.dataset.tipType;
    let html = '';

    if (tipType === 'sentimentBreakdown' && tooltipData.sentimentBreakdown) {
      const score = tooltipData.sentimentScore;
      html = buildSentimentTooltipHTML(tooltipData.sentimentBreakdown, score);
    } else if (tipType === 'action' && tooltipData.advice) {
      html = buildActionTooltipHTML(tooltipData.advice, tooltipData.sentimentScore);
    } else if (tipType === 'position' && tooltipData.advice) {
      html = buildActionTooltipHTML(tooltipData.advice, tooltipData.sentimentScore);
    } else if (tipType === 'risk' && tooltipData.advice) {
      html = `<div class="tooltip-title">⚠️ 风险评估</div><p style="font-size:12px;line-height:1.6;">当前风险等级：<strong>${tooltipData.advice.riskLevel}</strong></p><p style="font-size:11px;color:var(--text-muted);margin-top:6px;">风险等级基于情绪分、涨跌停比、北向资金流向综合判断。</p>`;
    } else if (tipType === 'sentiment' && tooltipData.advice) {
      html = buildActionTooltipHTML(tooltipData.advice, tooltipData.sentimentScore);
    } else if (tipType === 'sector') {
      const code = target.dataset.sectorCode;
      if (code && tooltipData.sectors[code]) {
        html = buildSectorTooltipHTML(tooltipData.sectors[code]);
      }
    }

    if (html) {
      showTooltip(target, html);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('.has-tip');
    if (target) hideTooltip();
  });
}

function renderHero(analysis) {
  const advice = analysis.tradingAdvice;
  const sent = analysis.sentiment;

  const actionEl = $('hero-action');
  actionEl.textContent = advice.action;
  actionEl.className = 'hero-action-text has-tip ' + advice.actionLevel;

  $('hero-sub').textContent = sent.advice;
  $('hero-position').textContent = advice.position;
  $('hero-risk').textContent = advice.riskLevel;
  $('hero-sentiment-level').textContent = sent.level;
  $('hero-sentiment-level').className = 'hero-stat-value has-tip ' + sent.color;

  $('hero-reasons').innerHTML = advice.reasons.map(r =>
    `<div class="reason-item"><span class="reason-dot"></span><span>${r}</span></div>`
  ).join('');
}

function renderSentiment(analysis) {
  const score = analysis.sentimentScore;
  const sent = analysis.sentiment;

  const scoreEl = $('sentiment-score');
  scoreEl.textContent = score;
  scoreEl.className = 'sentiment-score has-tip ' + sent.color;
  $('sentiment-label').textContent = sent.level;

  const pointer = $('gauge-pointer');
  pointer.style.left = score + '%';
  if (score >= 70) pointer.style.borderColor = 'var(--up)';
  else if (score >= 40) pointer.style.borderColor = 'var(--accent)';
  else pointer.style.borderColor = 'var(--down)';
}

function renderMarketIndex(data) {
  if (!data || !data.length) return;
  const grid = $('market-grid');
  const items = grid.querySelectorAll('.market-item');
  data.forEach((idx, i) => {
    if (i >= items.length) return;
    const item = items[i];
    item.querySelector('.market-name').textContent = idx.name;
    item.querySelector('.market-price').textContent = idx.price.toFixed(2);
    const changeEl = item.querySelector('.market-change');
    changeEl.textContent = fmtPct(idx.changePct);
    changeEl.className = 'market-change ' + pctClass(idx.changePct);
  });
}

function renderFocusSectors(advice) {
  const focus = advice.focus || [];
  if (!focus.length) {
    $('focus-sectors').innerHTML = '<div class="empty-tip">暂无明确推荐板块</div>';
    return;
  }
  focus.forEach(s => {
    if (s.code && s.scoreBreakdown) {
      tooltipData.sectors[s.code] = { name: s.name, score: s.score, scoreBreakdown: s.scoreBreakdown };
    }
  });
  $('focus-sectors').innerHTML = focus.map((s, i) =>
    `<div class="sector-item">
      <span class="sector-rank up">${i + 1}</span>
      <div class="sector-info">
        <div class="sector-name">${s.name}</div>
        <div class="sector-reason">${s.reason}</div>
      </div>
      <div class="sector-score has-tip" data-tip-type="sector" data-sector-code="${s.code || ''}">
        <div class="score-number up">${s.score}</div>
        <div class="score-label">机会评分</div>
      </div>
    </div>`
  ).join('');
}

function renderAvoidSectors(advice) {
  const avoid = advice.avoid || [];
  if (!avoid.length) {
    $('avoid-sectors').innerHTML = '<div class="empty-tip">暂无明确回避板块</div>';
    return;
  }
  avoid.forEach(s => {
    if (s.code && s.scoreBreakdown) {
      tooltipData.sectors[s.code] = { name: s.name, score: s.score, scoreBreakdown: s.scoreBreakdown };
    }
  });
  $('avoid-sectors').innerHTML = avoid.map((s, i) =>
    `<div class="sector-item">
      <span class="sector-rank down">${i + 1}</span>
      <div class="sector-info">
        <div class="sector-name">${s.name}</div>
        <div class="sector-reason">${s.reason}</div>
      </div>
      <div class="sector-score has-tip" data-tip-type="sector" data-sector-code="${s.code || ''}">
        <div class="score-number down">${s.score}</div>
        <div class="score-label">风险评分</div>
      </div>
    </div>`
  ).join('');
}

function renderAdviceReasons(advice) {
  const reasons = advice.reasons || [];
  $('advice-reasons').innerHTML = reasons.map(r =>
    `<div class="reason-item"><span class="reason-dot"></span><span>${r}</span></div>`
  ).join('');
}

function renderWatchlist(watchlist) {
  const strong = watchlist.strongStocks || [];
  $('strong-stocks').innerHTML = strong.length ? strong.map(s =>
    `<div class="stock-item">
      <span class="stock-tag">${s.days}连板</span>
      <div class="stock-name">${s.name}<em>${s.code}</em></div>
      <div class="stock-reason">${s.industry || ''}</div>
    </div>`
  ).join('') : '<div class="empty-tip">暂无连板个股</div>';

  const breakouts = watchlist.breakouts || [];
  $('breakout-stocks').innerHTML = breakouts.length ? breakouts.map(s =>
    `<div class="stock-item">
      <span class="stock-tag">首板</span>
      <div class="stock-name">${s.name}<em>${s.code}</em></div>
      <div class="stock-reason">${s.industry || ''}</div>
    </div>`
  ).join('') : '<div class="empty-tip">暂无首板个股</div>';

  const angels = watchlist.fallenAngels || [];
  $('fallen-angels').innerHTML = angels.length ? angels.map(s =>
    `<div class="stock-item">
      <span class="stock-tag" style="background:var(--info-bg);color:var(--info);">潜伏</span>
      <div class="stock-name">${s.name}<em>${s.code}</em></div>
      <div class="stock-reason">流入${s.inflow}亿 · ${fmtPct(s.changePct)}</div>
    </div>`
  ).join('') : '<div class="empty-tip">暂无明显资金潜伏个股</div>';
}

function renderRisks(risks) {
  if (!risks || !risks.length) {
    $('risk-list').innerHTML = '<div class="empty-tip">✅ 暂无重大风险，市场运行平稳</div>';
    return;
  }
  $('risk-list').innerHTML = risks.map(r =>
    `<div class="risk-item ${r.level}">
      <div class="risk-title">
        ${r.level === 'high' ? '🔴' : '🟡'} ${r.title}
      </div>
      <div class="risk-desc">${r.desc}</div>
    </div>`
  ).join('');
}

function generateDecisionReport(data) {
  const lines = [];
  const analysis = data.analysis;
  const advice = analysis.tradingAdvice;

  lines.push(`# A股决策助手 · 每日策略报告`);
  lines.push('');
  lines.push(`**日期：** ${new Date().toLocaleDateString('zh-CN')}`);
  lines.push(`**情绪评分：** ${analysis.sentimentScore} / 100（${analysis.sentiment.level}）`);
  lines.push(`**操作建议：** ${advice.action}`);
  lines.push(`**建议仓位：** ${advice.position}`);
  lines.push(`**风险等级：** ${advice.riskLevel}`);
  lines.push('');

  lines.push(`## 一、核心判断`);
  advice.reasons.forEach((r, i) => {
    lines.push(`${i + 1}. ${r}`);
  });
  lines.push('');

  lines.push(`## 二、重点关注板块`);
  if (advice.focus && advice.focus.length) {
    advice.focus.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.name}**（机会评分：${s.score}分）— ${s.reason}`);
    });
  } else {
    lines.push('暂无明确推荐板块。');
  }
  lines.push('');

  lines.push(`## 三、建议回避板块`);
  if (advice.avoid && advice.avoid.length) {
    advice.avoid.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.name}**（风险评分：${s.score}分）— ${s.reason}`);
    });
  } else {
    lines.push('暂无明确回避板块。');
  }
  lines.push('');

  lines.push(`## 四、明日关注个股`);
  const wl = analysis.watchlist;
  if (wl.strongStocks && wl.strongStocks.length) {
    lines.push('');
    lines.push('**强势连板股：**');
    wl.strongStocks.forEach(s => {
      lines.push(`- ${s.name}（${s.code}）${s.days}连板 · ${s.industry || ''} — ${s.reason}`);
    });
  }
  if (wl.breakouts && wl.breakouts.length) {
    lines.push('');
    lines.push('**首板突破股：**');
    wl.breakouts.forEach(s => {
      lines.push(`- ${s.name}（${s.code}）首板 · ${s.industry || ''} — ${s.reason}`);
    });
  }
  if (wl.fallenAngels && wl.fallenAngels.length) {
    lines.push('');
    lines.push('**资金潜伏股：**');
    wl.fallenAngels.forEach(s => {
      lines.push(`- ${s.name}（${s.code}）流入${s.inflow}亿 · ${fmtPct(s.changePct)} — ${s.reason}`);
    });
  }
  lines.push('');

  lines.push(`## 五、风险预警`);
  if (analysis.risks && analysis.risks.length) {
    analysis.risks.forEach(r => {
      lines.push(`- **[${r.level === 'high' ? '高风险' : '中等风险'}] ${r.title}：** ${r.desc}`);
    });
  } else {
    lines.push('暂无重大风险，市场运行平稳。');
  }
  lines.push('');

  lines.push(`## 六、操作纪律`);
  lines.push(`1. 严格执行仓位管理，不满仓、不空仓。`);
  lines.push(`2. 聚焦主线板块，避免在弱势板块中抄底。`);
  lines.push(`3. 设置止损止盈，不恋战、不扛单。`);
  lines.push(`4. 以上分析基于当日数据生成，仅供参考，不构成投资建议。`);

  return lines.join('\n');
}

function renderTextReport(data) {
  const report = generateDecisionReport(data);
  const container = $('text-report');
  let html = report
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => match.startsWith('<') ? match : '<p>' + match + '</p>');
  container.innerHTML = html;
}

async function loadData() {
  $('status-text').textContent = '数据获取中...';
  $('status-dot').className = 'status-dot loading';

  try {
    const data = await API.fetchAllMarketDataWithAnalysis();
    currentData = data;

    tooltipData.sentimentBreakdown = data.analysis.sentimentBreakdown;
    tooltipData.sentimentScore = data.analysis.sentimentScore;
    tooltipData.advice = data.analysis.tradingAdvice;

    renderHero(data.analysis);
    renderSentiment(data.analysis);
    renderMarketIndex(data.marketIndex);
    renderFocusSectors(data.analysis.tradingAdvice);
    renderAvoidSectors(data.analysis.tradingAdvice);
    renderAdviceReasons(data.analysis.tradingAdvice);
    renderWatchlist(data.analysis.watchlist);
    renderRisks(data.analysis.risks);
    renderTextReport(data);

    const now = new Date();
    $('update-time').textContent = now.toLocaleTimeString('zh-CN');
    $('status-text').textContent = '分析完成';
    $('status-dot').className = 'status-dot ready';
  } catch (err) {
    console.error('加载失败:', err);
    $('status-text').textContent = '加载失败';
    $('status-dot').className = 'status-dot error';
  }
}

function exportReport() {
  const report = generateDecisionReport(currentData);
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `A股决策报告_${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
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

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initTooltips();
  $('btn-refresh').addEventListener('click', loadData);
  $('btn-export').addEventListener('click', exportReport);
  $('auto-refresh').addEventListener('change', (e) => {
    toggleAutoRefresh(e.target.checked);
  });
  loadData();
});
