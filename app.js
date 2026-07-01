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

function renderMoneyEffect(analysis) {
  const me = analysis.moneyEffect;
  const mb = analysis.marketBreadth;
  const fh = analysis.fundHeat;

  const scoreEl = $('money-effect-score');
  scoreEl.textContent = me.profitEffectScore;
  scoreEl.className = 'sentiment-score ' + (me.profitEffectScore >= 60 ? 'up' : me.profitEffectScore >= 40 ? 'neutral' : 'down');
  $('money-effect-desc').textContent = me.description;

  $('breadth-ratio').textContent = mb.advanceDeclineRatio.toFixed(2) + ':1';
  $('breadth-ratio').className = 'sentiment-score ' + (mb.advanceDeclineRatio > 2 ? 'up' : mb.advanceDeclineRatio < 0.5 ? 'down' : 'neutral');
  $('breadth-signal').textContent = mb.signal.replace(/[^\u4e00-\u9fa5，。、]/g, '').slice(0, 12);

  $('fund-heat-score').textContent = fh.fundHeatScore;
  $('fund-heat-score').className = 'sentiment-score ' + (fh.fundHeatScore >= 60 ? 'up' : fh.fundHeatScore >= 45 ? 'neutral' : 'down');
  $('fund-heat-desc').textContent = fh.description;

  const stats = [
    { name: '上涨板块', value: me.upCount + ' 个', cls: 'up' },
    { name: '下跌板块', value: me.downCount + ' 个', cls: 'down' },
    { name: '涨停', value: me.limitUpCount + ' 家', cls: 'up' },
    { name: '跌停', value: me.limitDownCount + ' 家', cls: 'down' },
    { name: '炸板', value: me.brokenLimitCount + ' 家', cls: 'warn' },
    { name: '炸板率', value: me.brokenLimitRate.toFixed(1) + '%', cls: me.brokenLimitRate > 35 ? 'down' : 'up' }
  ];
  $('money-stats').innerHTML = stats.map(s =>
    `<div class="market-item">
      <div class="market-name">${s.name}</div>
      <div class="market-price ${s.cls}">${s.value}</div>
    </div>`
  ).join('');
}

function renderLadder(analysis) {
  const ladder = analysis.deepLadder;
  if (!ladder || !ladder.ladder || !ladder.ladder.length) {
    $('ladder-container').innerHTML = '<div class="empty-tip">暂无连板数据</div>';
    return;
  }
  const html = ladder.ladder.map(l => {
    const stocks = l.stocks.map(s => s.name).join('、');
    return `
      <div style="padding:10px 0;border-bottom:1px dashed var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:600;font-size:14px;"><span style="color:var(--up);">${l.height}板</span> × ${l.count}家</span>
        </div>
        <div style="font-size:12px;color:var(--text-dim);line-height:1.6;">${stocks || '-'}</div>
      </div>
    `;
  }).join('');
  $('ladder-container').innerHTML = html;
}

function renderStyleRotation(analysis) {
  const sr = analysis.styleRotation;
  if (!sr || !sr.styles || !sr.styles.length) {
    $('style-rotation').innerHTML = '<div class="empty-tip">暂无风格数据</div>';
    return;
  }
  const maxScore = Math.max(...sr.styles.map(s => s.avgScore), 1);
  const html = sr.styles.map((s, i) => {
    const pct = (s.avgScore / maxScore * 100).toFixed(0);
    const isTop = i === 0;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:${isTop ? 600 : 400};color:${isTop ? 'var(--up)' : 'var(--text)'};">${i + 1}. ${s.name}</span>
          <span style="font-size:13px;color:var(--text-dim);">强度分 ${s.avgScore}</span>
        </div>
        <div style="height:8px;background:var(--bg-soft);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${isTop ? 'var(--up)' : 'var(--accent)'};border-radius:4px;transition:width 0.5s;"></div>
        </div>
      </div>
    `;
  }).join('');
  $('style-rotation').innerHTML = html + `<div style="margin-top:8px;font-size:13px;color:var(--text-dim);text-align:center;">${sr.conclusion || ''}</div>`;
}

function renderComprehensiveRisk(analysis) {
  const risk = analysis.comprehensiveRisk;
  if (!risk) return;

  $('risk-total-score').textContent = risk.totalScore;
  $('risk-total-score').className = 'sentiment-score ' + (risk.totalScore >= 60 ? 'up' : risk.totalScore >= 40 ? 'warn' : 'neutral');
  $('risk-level').textContent = '风险等级：' + risk.level;
  $('risk-advice').textContent = risk.advice;

  if (risk.risks && risk.risks.length) {
    $('risk-list-detail').innerHTML = risk.risks.map(r =>
      `<div class="risk-item ${r.level}">
        <div class="risk-title" style="font-size:12px;">
          [${r.category}] ${r.name}
        </div>
        <div class="risk-desc">${r.desc}</div>
      </div>`
    ).join('');
  }
}

function renderSectorLeadersFull(analysis) {
  const leaders = analysis.sectorLeaders;
  if (!leaders || !leaders.length) {
    $('sector-leaders-full').innerHTML = '<div class="empty-tip">暂无板块龙头数据</div>';
    return;
  }
  const html = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="border-bottom:1px solid var(--border);">
        <th style="text-align:left;padding:10px 8px;color:var(--text-dim);font-weight:500;">板块</th>
        <th style="text-align:center;padding:10px 8px;color:var(--text-dim);font-weight:500;">涨停数</th>
        <th style="text-align:left;padding:10px 8px;color:var(--text-dim);font-weight:500;">龙头股</th>
        <th style="text-align:center;padding:10px 8px;color:var(--text-dim);font-weight:500;">连板</th>
      </tr>
    </thead>
    <tbody>
      ${leaders.map(l => `
        <tr style="border-bottom:1px dashed var(--border);">
          <td style="padding:10px 8px;font-weight:500;">${l.industry}</td>
          <td style="text-align:center;padding:10px 8px;color:var(--up);">${l.stockCount}</td>
          <td style="padding:10px 8px;"><span style="color:var(--up);font-weight:500;">${l.leader}</span> <span style="color:var(--text-muted);font-size:11px;">${l.leaderCode}</span></td>
          <td style="text-align:center;padding:10px 8px;"><span class="stock-tag">${l.leaderDays}板</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
  $('sector-leaders-full').innerHTML = html;
}

function renderLadderFull(analysis) {
  const ladder = analysis.deepLadder;
  if (!ladder || !ladder.ladder || !ladder.ladder.length) {
    $('ladder-full').innerHTML = '<div class="empty-tip">暂无连板数据</div>';
    return;
  }
  const html = ladder.ladder.map(l => {
    const stocks = (l.stocks || []).map(s =>
      `<span style="display:inline-block;padding:4px 10px;margin:3px;background:var(--up-bg);color:var(--up);border-radius:4px;font-size:12px;">${s.name}<em style="font-style:normal;color:var(--text-muted);margin-left:4px;font-size:10px;">${s.code}</em></span>`
    ).join('');
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="display:inline-block;padding:4px 12px;background:var(--up);color:#fff;border-radius:4px;font-weight:600;font-size:13px;">${l.height}板</span>
          <span style="color:var(--text-dim);font-size:12px;">${l.count} 家</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">${stocks || '<span style="color:var(--text-muted);">暂无</span>'}</div>
      </div>
    `;
  }).join('');
  $('ladder-full').innerHTML = html;
}

function renderWatchlistFull(watchlist) {
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
      <div class="stock-reason">${s.industry || ''} · 换手${(s.turnoverRate||0).toFixed(1)}%</div>
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

  const sectorLeaders = watchlist.sectorLeaders || [];
  $('hot-sector-leaders').innerHTML = sectorLeaders.length ? sectorLeaders.map(s =>
    `<div class="stock-item">
      <span class="stock-tag" style="background:var(--warn-bg);color:var(--warn);">${s.stockCount}家</span>
      <div class="stock-name">${s.leader}<em>${s.industry}</em></div>
      <div class="stock-reason">${s.leaderDays}连板 · 板块龙头</div>
    </div>`
  ).join('') : '<div class="empty-tip">暂无热门板块龙头</div>';
}

function generateDecisionReport(data) {
  return data.analysis.fullReport || '';
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
    renderWatchlistFull(data.analysis.watchlist);
    renderRisks(data.analysis.risks);
    renderMoneyEffect(data.analysis);
    renderLadder(data.analysis);
    renderStyleRotation(data.analysis);
    renderComprehensiveRisk(data.analysis);
    renderSectorLeadersFull(data.analysis);
    renderLadderFull(data.analysis);
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
