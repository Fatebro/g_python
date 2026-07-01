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

// ===== 短期情绪渲染 =====
function renderShortTermSentiment(analysis) {
  const st = analysis.shortTermSentiment;
  if (!st) return;

  const scoreEl = $('short-term-score');
  scoreEl.textContent = st.score;
  scoreEl.className = 'sentiment-score ' + (st.score >= 60 ? 'up' : st.score >= 40 ? 'neutral' : 'down');
  $('short-term-level').textContent = st.level;
  $('short-term-advice').textContent = st.advice;

  const hm = st.hotMoney;
  $('hot-money-score').textContent = hm.activeScore;
  $('hot-money-score').className = 'sentiment-score ' + (hm.activeScore >= 60 ? 'up' : hm.activeScore >= 40 ? 'neutral' : 'down');
  $('hot-money-level').textContent = hm.activeLevel;

  const q = st.quality;
  $('limit-quality-score').textContent = q.qualityScore;
  $('limit-quality-score').className = 'sentiment-score ' + (q.qualityScore >= 60 ? 'up' : q.qualityScore >= 40 ? 'neutral' : 'down');
  $('limit-quality-desc').textContent = q.description;

  // 情绪周期
  const c = st.cycle;
  const phaseColor = { '高潮期': 'down', '发酵期': 'up', '震荡期': 'neutral', '退潮期': 'down', '冰点期': 'info' };
  const phaseCls = phaseColor[c.phase] || 'neutral';
  const scoresLine = ['情绪', '赚钱', '资金'].map((label, i) => {
    const vals = [c.scores.sentiment, c.scores.moneyEffect, c.scores.fundHeat];
    return `<span style="margin-right:12px;">${label}: <strong style="color:var(--${vals[i] >= 60 ? 'up' : vals[i] >= 40 ? 'text' : 'down'});">${vals[i]}</strong></span>`;
  }).join('');
  $('sentiment-cycle').innerHTML = `
    <div style="text-align:center;padding:8px 0 12px;">
      <div style="display:inline-block;padding:8px 24px;background:var(--${phaseCls === 'neutral' ? 'bg-soft' : phaseCls + '-bg'});color:var(--${phaseCls === 'neutral' ? 'text' : phaseCls});border-radius:8px;font-size:18px;font-weight:700;">${c.phase}</div>
    </div>
    <div style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:10px;">${c.phaseDesc}</div>
    <div style="font-size:13px;margin-bottom:8px;">${scoresLine}</div>
    <div style="font-size:12px;color:var(--text-dim);">三因子均值: <strong>${c.scores.average}</strong> · 差值: <strong>${c.scores.divergence}</strong></div>
    <div style="margin-top:10px;padding:8px 12px;background:var(--bg-soft);border-radius:6px;font-size:13px;">📋 <strong>操作建议：</strong>${c.action}</div>
    <div style="margin-top:6px;font-size:12px;color:var(--text-muted);">下一阶段预判：${c.nextPhase}</div>
  `;

  // 游资信号
  if (hm.signals && hm.signals.length) {
    const levelColor = { strong: 'up', medium: 'neutral', weak: 'down', fast: 'up', normal: 'neutral', slow: 'down' };
    $('hot-money-signals').innerHTML = hm.signals.map(s => {
      const cls = levelColor[s.level] || 'neutral';
      return `
        <div style="padding:10px 0;border-bottom:1px dashed var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:600;font-size:13px;">${s.name}</span>
            <span style="padding:2px 8px;border-radius:4px;font-size:11px;background:var(--${cls === 'neutral' ? 'bg-soft' : cls + '-bg'});color:var(--${cls === 'neutral' ? 'text-dim' : cls});">${s.desc.match(/\d+\.?\d*%/)?.[0] || s.level}</span>
          </div>
          <div style="font-size:12px;color:var(--text-dim);">${s.desc}</div>
        </div>
      `;
    }).join('') + `<div style="margin-top:10px;font-size:13px;color:var(--text);">${hm.description}</div>`;
  } else {
    $('hot-money-signals').innerHTML = '<div class="empty-tip">暂无游资信号</div>';
  }

  // 涨停板质量
  const stats = [
    { name: '涨停总数', value: q.totalCount + '家', cls: 'up' },
    { name: '强封板', value: q.sealedCount + '家', cls: 'up' },
    { name: '弱封板', value: q.weakSealCount + '家', cls: 'warn' },
    { name: '炸板数', value: q.brokenCount + '家', cls: 'down' },
    { name: '封板率', value: q.sealRate.toFixed(0) + '%', cls: q.sealRate > 60 ? 'up' : 'down' },
    { name: '行业集中度', value: q.industryConcentration.toFixed(0) + '%', cls: 'neutral' },
    { name: '平均换手', value: q.avgTurnover.toFixed(1) + '%', cls: 'neutral' },
    { name: '质量评分', value: q.qualityScore + '分', cls: q.qualityScore >= 60 ? 'up' : 'neutral' }
  ];
  let qualityHTML = `<div class="market-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">`;
  qualityHTML += stats.map(s =>
    `<div class="market-item">
      <div class="market-name">${s.name}</div>
      <div class="market-price ${s.cls}">${s.value}</div>
    </div>`
  ).join('');
  qualityHTML += `</div>`;

  if (q.topIndustries && q.topIndustries.length) {
    qualityHTML += `<div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">涨停最多的行业：</div>`;
    qualityHTML += q.topIndustries.map((ind, i) =>
      `<span style="display:inline-block;padding:4px 12px;margin:3px;background:var(--up-bg);color:var(--up);border-radius:4px;font-size:12px;">${i+1}. ${ind.name} (${ind.count}家)</span>`
    ).join('');
  }
  qualityHTML += `<div style="margin-top:12px;font-size:13px;color:var(--text);">${q.description}</div>`;
  $('limit-quality-detail').innerHTML = qualityHTML;
}

// ===== 长期价值渲染 =====
function renderLongTermValue(analysis) {
  const lt = analysis.longTermValue;
  if (!lt) return;

  const scoreEl = $('long-term-score');
  scoreEl.textContent = lt.score;
  scoreEl.className = 'sentiment-score ' + (lt.score >= 60 ? 'up' : lt.score >= 40 ? 'neutral' : 'down');
  $('long-term-level').textContent = lt.level;
  $('long-term-advice').textContent = lt.advice;

  const p = lt.prosperity;
  $('prosperity-score').textContent = p.avgProsperity;
  $('prosperity-score').className = 'sentiment-score ' + (p.avgProsperity >= 60 ? 'up' : p.avgProsperity >= 40 ? 'neutral' : 'down');
  $('prosperity-desc').textContent = p.description;

  const nb = lt.northbound;
  $('nb-signal-score').textContent = nb.netFlow > 0 ? '+' + nb.netFlow.toFixed(1) : nb.netFlow.toFixed(1);
  $('nb-signal-score').className = 'sentiment-score ' + (nb.netFlow > 30 ? 'up' : nb.netFlow > 0 ? 'neutral' : 'down');
  $('nb-signal-text').textContent = nb.signal;

  // 价值vs成长
  const s = lt.style;
  const maxScore = Math.max(s.valueScore, s.growthScore, 1);
  const valPct = (s.valueScore / maxScore * 100).toFixed(0);
  const groPct = (s.growthScore / maxScore * 100).toFixed(0);
  const dominantColor = s.dominant === '成长占优' ? 'var(--up)' : s.dominant === '价值占优' ? 'var(--accent)' : 'var(--text-dim)';
  $('value-growth-style').innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <span style="display:inline-block;padding:6px 16px;background:var(--bg-soft);border-radius:6px;font-size:14px;font-weight:600;color:${dominantColor};">${s.dominant}</span>
    </div>
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;">💎 价值板块（${s.valueCount}个）</span>
        <span style="font-size:13px;color:var(--accent);">${s.valueAvg}% · 评分${s.valueScore}</span>
      </div>
      <div style="height:10px;background:var(--bg-soft);border-radius:5px;overflow:hidden;">
        <div style="height:100%;width:${valPct}%;background:var(--accent);border-radius:5px;transition:width 0.5s;"></div>
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;">🚀 成长板块（${s.growthCount}个）</span>
        <span style="font-size:13px;color:var(--up);">${s.growthAvg}% · 评分${s.growthScore}</span>
      </div>
      <div style="height:10px;background:var(--bg-soft);border-radius:5px;overflow:hidden;">
        <div style="height:100%;width:${groPct}%;background:var(--up);border-radius:5px;transition:width 0.5s;"></div>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text);line-height:1.6;">${s.description}</div>
  `;

  // 北向资金长线
  $('nb-longterm-signal').innerHTML = `
    <div style="text-align:center;margin-bottom:12px;">
      <span style="display:inline-block;padding:6px 16px;border-radius:6px;font-size:14px;font-weight:600;background:var(--${nb.netFlow > 0 ? 'up' : 'down'}-bg);color:var(--${nb.netFlow > 0 ? 'up' : 'down'});">${nb.signal}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="text-align:center;padding:10px;background:var(--bg-soft);border-radius:6px;">
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">净流入</div>
        <div style="font-size:18px;font-weight:700;color:${nb.netFlow > 0 ? 'var(--up)' : 'var(--down)'};">${nb.netFlow > 0 ? '+' : ''}${nb.netFlow.toFixed(1)}亿</div>
      </div>
      <div style="text-align:center;padding:10px;background:var(--bg-soft);border-radius:6px;">
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">趋势</div>
        <div style="font-size:14px;font-weight:600;color:var(--text);">${nb.trend}</div>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text);margin-bottom:8px;">${nb.description}</div>
    <div style="padding:8px 12px;background:var(--bg-soft);border-radius:6px;font-size:13px;">📋 <strong>建议：</strong>${nb.advice}</div>
  `;

  // 行业景气度排行
  if (p.industries && p.industries.length) {
    const trendIcon = { '上升': '📈', '下降': '📉', '回调': '🔄', '反弹': '↩️', '震荡': '➡️' };
    $('prosperity-list').innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:8px;color:var(--text-dim);font-weight:500;">行业</th>
          <th style="text-align:center;padding:8px;color:var(--text-dim);font-weight:500;">景气度</th>
          <th style="text-align:center;padding:8px;color:var(--text-dim);font-weight:500;">今日</th>
          <th style="text-align:center;padding:8px;color:var(--text-dim);font-weight:500;">5日</th>
          <th style="text-align:center;padding:8px;color:var(--text-dim);font-weight:500;">20日</th>
          <th style="text-align:center;padding:8px;color:var(--text-dim);font-weight:500;">趋势</th>
        </tr>
      </thead>
      <tbody>
        ${p.industries.map(ind => `
          <tr style="border-bottom:1px dashed var(--border);">
            <td style="padding:8px;font-weight:500;">${ind.name}</td>
            <td style="text-align:center;padding:8px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:var(--${ind.prosperity >= 65 ? 'up' : ind.prosperity >= 40 ? 'bg-soft' : 'down'}-bg);color:var(--${ind.prosperity >= 65 ? 'up' : ind.prosperity >= 40 ? 'text' : 'down'});font-weight:600;">${ind.prosperity}</span></td>
            <td style="text-align:center;padding:8px;color:${ind.today >= 0 ? 'var(--up)' : 'var(--down)'};">${ind.today >= 0 ? '+' : ''}${ind.today.toFixed(2)}%</td>
            <td style="text-align:center;padding:8px;color:${ind.d5 >= 0 ? 'var(--up)' : 'var(--down)'};">${ind.d5 >= 0 ? '+' : ''}${ind.d5.toFixed(2)}%</td>
            <td style="text-align:center;padding:8px;color:${ind.d20 >= 0 ? 'var(--up)' : 'var(--down)'};">${ind.d20 >= 0 ? '+' : ''}${ind.d20.toFixed(2)}%</td>
            <td style="text-align:center;padding:8px;">${trendIcon[ind.trend] || '➡️'} ${ind.trend}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  } else {
    $('prosperity-list').innerHTML = '<div class="empty-tip">暂无景气度数据</div>';
  }

  // 行业生命周期
  const lc = lt.lifecycle;
  if (lc.lifecycle && lc.lifecycle.length) {
    const stageColor = { '导入期': 'up', '成长期': 'up', '加速期': 'warn', '成熟期': 'neutral', '震荡期': 'neutral', '衰退期': 'down', '回暖期': 'info' };
    $('lifecycle-list').innerHTML = `
      <div style="margin-bottom:12px;padding:10px 14px;background:var(--bg-soft);border-radius:6px;font-size:13px;color:var(--text);">${lc.description}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
        ${Object.entries(lc.stageCount).map(([stage, count]) => {
          const cls = stageColor[stage] || 'neutral';
          return `<span style="padding:4px 10px;border-radius:4px;font-size:12px;background:var(--${cls === 'neutral' ? 'bg-soft' : cls + '-bg'});color:var(--${cls === 'neutral' ? 'text-dim' : cls});">${stage}：${count}个</span>`;
        }).join('')}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:8px;color:var(--text-dim);font-weight:500;">行业</th>
            <th style="text-align:center;padding:8px;color:var(--text-dim);font-weight:500;">阶段</th>
            <th style="text-align:left;padding:8px;color:var(--text-dim);font-weight:500;">说明</th>
            <th style="text-align:center;padding:8px;color:var(--text-dim);font-weight:500;">潜力</th>
          </tr>
        </thead>
        <tbody>
          ${lc.lifecycle.map(l => {
            const cls = stageColor[l.stage] || 'neutral';
            return `<tr style="border-bottom:1px dashed var(--border);">
              <td style="padding:8px;font-weight:500;">${l.name}</td>
              <td style="text-align:center;padding:8px;"><span style="padding:2px 8px;border-radius:4px;background:var(--${cls === 'neutral' ? 'bg-soft' : cls + '-bg'});color:var(--${cls === 'neutral' ? 'text' : cls});font-size:12px;">${l.stage}</span></td>
              <td style="padding:8px;font-size:12px;color:var(--text-dim);">${l.stageDesc}</td>
              <td style="text-align:center;padding:8px;font-size:12px;color:var(--text);">${l.potential}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } else {
    $('lifecycle-list').innerHTML = '<div class="empty-tip">暂无生命周期数据</div>';
  }
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
    renderShortTermSentiment(data.analysis);
    renderLongTermValue(data.analysis);
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
