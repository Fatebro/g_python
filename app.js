const API = window.MarketDataAPI;

let currentData = null;
let refreshTimer = null;

function $(id) { return document.getElementById(id); }

function fmtPct(n) { return API.formatPct(n); }
function fmtAmt(n) { return API.formatAmount(n); }

function pctClass(n) { return n >= 0 ? 'up' : 'down'; }

function renderHero(analysis) {
  const advice = analysis.tradingAdvice;
  const sent = analysis.sentiment;

  $('hero-action').textContent = advice.action;
  $('hero-action').className = 'hero-action-text ' + advice.actionLevel;
  $('hero-sub').textContent = sent.advice;
  $('hero-position').textContent = advice.position;
  $('hero-risk').textContent = advice.riskLevel;
  $('hero-sentiment-level').textContent = sent.level;
  $('hero-sentiment-level').className = 'hero-stat-value ' + sent.color;

  $('hero-reasons').innerHTML = advice.reasons.map(r =>
    `<div class="reason-item"><span class="reason-dot"></span><span>${r}</span></div>`
  ).join('');
}

function renderSentiment(analysis) {
  const score = analysis.sentimentScore;
  const sent = analysis.sentiment;

  $('sentiment-score').textContent = score;
  $('sentiment-score').className = 'sentiment-score ' + sent.color;
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
  $('focus-sectors').innerHTML = focus.map((s, i) =>
    `<div class="sector-item">
      <span class="sector-rank up">${i + 1}</span>
      <div class="sector-info">
        <div class="sector-name">${s.name}</div>
        <div class="sector-reason">${s.reason}</div>
      </div>
      <div class="sector-score">
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
  $('avoid-sectors').innerHTML = avoid.map((s, i) =>
    `<div class="sector-item">
      <span class="sector-rank down">${i + 1}</span>
      <div class="sector-info">
        <div class="sector-name">${s.name}</div>
        <div class="sector-reason">${s.reason}</div>
      </div>
      <div class="sector-score">
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
  $('btn-refresh').addEventListener('click', loadData);
  $('btn-export').addEventListener('click', exportReport);
  $('auto-refresh').addEventListener('change', (e) => {
    toggleAutoRefresh(e.target.checked);
  });
  loadData();
});
