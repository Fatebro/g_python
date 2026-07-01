// data.js - A股市场数据获取模块
// 使用东方财富JSONP接口获取实时行情、板块、资金、北向、涨跌停等数据
// 全部采用JSONP方式，无需后端代理，纯前端可用

// ===== JSONP 工具函数 =====
function jsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const cbName = callbackName || ('jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1e6));
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP 请求超时: ' + url));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = function (data) {
      cleanup();
      resolve(data);
    };

    script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'cb=' + cbName;
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP 加载失败: ' + url));
    };
    document.head.appendChild(script);
  });
}

// ===== 东方财富接口常量 =====
const EM_API_BASE = '//push2.eastmoney.com/api';
const EM_EX_BASE = '//push2ex.eastmoney.com';
const EM_UT = 'bd1d9ddb04089700cf9c27f6f7426281';
const EM_UT2 = 'b2884a393a59ad64002292a3e90d46a5';
const EM_UT3 = '7eea3edcaed734bea9cbfc24409ed989';

// ===== 申万一级行业板块 =====
// f3:涨跌幅 f12:板块代码 f14:板块名称 f2:最新价 f4:涨跌额 f5:成交量 f6:成交额
const SW_SECTOR_PARAMS = 'f2,f3,f4,f5,f6,f12,f14,f20,f21';
const SW_SECTOR_FS = 'm:90+t:2';

// ===== 工具函数：日期 =====
function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function formatAmount(yi) {
  if (yi === null || yi === undefined || isNaN(yi)) return '--';
  const n = Number(yi);
  if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(2) + '亿';
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(2) + '万';
  return n.toFixed(0);
}

// ===== 1. 获取申万一级行业板块涨跌幅排行 =====
async function getSectorRank(sortField, sortDir, limit) {
  sortField = sortField || 'f3';
  sortDir = sortDir || 1;
  limit = limit || 31;
  const url = `${EM_API_BASE}/qt/clist/get?pn=1&pz=${limit}&po=${sortDir}&np=1&ut=${EM_UT}&fltt=2&invt=2&fid=${sortField}&fs=${SW_SECTOR_FS}&fields=${SW_SECTOR_PARAMS}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.diff) return [];
  return res.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    price: item.f2,
    changePct: item.f3,
    change: item.f4,
    volume: item.f5,
    turnover: item.f6,
    totalMarketCap: item.f20,
    circulatingMarketCap: item.f21
  }));
}

// ===== 2. 获取板块主力资金流向 =====
// f62:主力净流入净额 f66:超大单净流入 f69:大单净流入 f72:中单净流入 f75:小单净流入
const SECTOR_FUNDS_PARAMS = 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f84,f85,f86,f87';
async function getSectorFundFlow(sortField, sortDir, limit) {
  sortField = sortField || 'f62';
  sortDir = sortDir || 1;
  limit = limit || 31;
  const url = `${EM_API_BASE}/qt/clist/get?pn=1&pz=${limit}&po=${sortDir}&np=1&ut=${EM_UT}&fltt=2&invt=2&fid=${sortField}&fs=${SW_SECTOR_FS}&fields=${SECTOR_FUNDS_PARAMS}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.diff) return [];
  return res.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    price: item.f2,
    changePct: item.f3,
    mainNetInflow: item.f62,
    mainNetInflowPct: item.f184,
    superLarge: item.f66,
    large: item.f69,
    medium: item.f72,
    small: item.f75,
    superLargePct: item.f84,
    largePct: item.f85,
    mediumPct: item.f86,
    smallPct: item.f87
  }));
}

// ===== 3. 获取北向资金实时数据 =====
// s2n: 沪深港通北向资金分钟数据
// f51:时间 f52:沪股通 f53:深股通 f54:北向合计 f55:未知
async function getNorthboundFlow() {
  const url = `${EM_API_BASE}/qt/kamt.rtmin/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&ut=${EM_UT2}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.s2n) return { latest: null, series: [] };
  const raw = res.data.s2n;
  const series = raw.map(line => {
    const parts = line.split(',');
    return {
      time: parts[0],
      sh: Number(parts[1]) / 100000000,
      sz: Number(parts[2]) / 100000000,
      total: Number(parts[3]) / 100000000
    };
  });
  const valid = series.filter(s => s.total > 0 || s.sh > 0 || s.sz > 0);
  const latest = valid.length > 0 ? valid[valid.length - 1] : null;
  return { latest, series };
}

// ===== 4. 获取涨跌停股票池 =====
async function getLimitUpPool(date, pageIndex, pageSize) {
  date = date || getTodayStr();
  pageIndex = pageIndex || 0;
  pageSize = pageSize || 30;
  const url = `${EM_EX_BASE}/getTopicZTPool?ut=${EM_UT3}&dpt=wz.ztzt&Pageindex=${pageIndex}&pagesize=${pageSize}&sort=fbt%3Aasc&date=${date}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.pool) return { total: 0, list: [] };
  return {
    total: res.data.tc || 0,
    date: res.data.qdate,
    list: res.data.pool.map(item => ({
      code: item.c,
      name: item.n,
      price: item.p / 100,
      changePct: item.zdp,
      amount: item.amount,
      turnoverRate: item.hs,
      firstLimitTime: item.fbt,
      lastLimitTime: item.lbt,
      limitOpenCount: item.zbc,
      industry: item.hybk,
      limitDays: item.zttj && item.zttj.days ? item.zttj.days : 1
    }))
  };
}

// ===== 5. 获取跌停股票池 =====
async function getLimitDownPool(date, pageIndex, pageSize) {
  date = date || getTodayStr();
  pageIndex = pageIndex || 0;
  pageSize = pageSize || 30;
  const url = `${EM_EX_BASE}/getTopicDTPool?ut=${EM_UT3}&dpt=wz.dtzt&Pageindex=${pageIndex}&pagesize=${pageSize}&sort=fbt%3Aasc&date=${date}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.pool) return { total: 0, list: [] };
  return {
    total: res.data.tc || 0,
    date: res.data.qdate,
    list: res.data.pool.map(item => ({
      code: item.c,
      name: item.n,
      price: item.p / 100,
      changePct: item.zdp,
      amount: item.amount,
      turnoverRate: item.hs,
      firstLimitTime: item.fbt,
      lastLimitTime: item.lbt,
      industry: item.hybk
    }))
  };
}

// ===== 6. 获取大盘指数实时行情 =====
// 1.000001 上证指数 0.399001 深证成指 0.399006 创业板指 1.000688 科创50
// f2:最新价 f3:涨跌幅 f4:涨跌额 f12:代码 f14:名称
// f104:上涨家数 f105:下跌家数 f106:平盘家数 f5:成交量 f6:成交额
async function getMarketIndex() {
  const secids = '1.000001,0.399001,0.399006,1.000688';
  const fields = 'f2,f3,f4,f5,f6,f12,f14,f104,f105,f106';
  const url = `${EM_API_BASE}/qt/ulist.np/get?fltt=2&secids=${secids}&fields=${fields}&ut=${EM_UT}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.diff) return [];
  return res.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    price: item.f2,
    changePct: item.f3,
    change: item.f4,
    volume: item.f5,
    turnover: item.f6,
    upCount: item.f104,
    downCount: item.f105,
    flatCount: item.f106
  }));
}

// ===== 7. 获取个股资金流向（主力净流入排行前20）=====
async function getStockFundFlow(sortField, sortDir, limit) {
  sortField = sortField || 'f62';
  sortDir = sortDir || 1;
  limit = limit || 20;
  // m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048 沪深A股
  const fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
  const fields = 'f2,f3,f12,f14,f62,f66,f69,f72,f75,f184';
  const url = `${EM_API_BASE}/qt/clist/get?pn=1&pz=${limit}&po=${sortDir}&np=1&ut=${EM_UT}&fltt=2&invt=2&fid=${sortField}&fs=${encodeURIComponent(fs)}&fields=${fields}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.diff) return [];
  return res.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    price: item.f2,
    changePct: item.f3,
    mainNetInflow: item.f62,
    mainNetInflowPct: item.f184,
    superLarge: item.f66,
    large: item.f69,
    medium: item.f72,
    small: item.f75
  }));
}

// ===== 8. 获取概念板块涨跌幅排行（含5日/20日历史对比）=====
// fs=m:90+t:3 为概念板块
// f25:5日涨跌幅 f183:20日涨跌幅 f62:主力净流入
const CONCEPT_SECTOR_FS = 'm:90+t:3';
const CONCEPT_PARAMS = 'f2,f3,f12,f14,f25,f183,f62,f184,f6';

async function getConceptSectorRank(sortField, sortDir, limit) {
  sortField = sortField || 'f3';
  sortDir = sortDir || 1;
  limit = limit || 20;
  const url = `${EM_API_BASE}/qt/clist/get?pn=1&pz=${limit}&po=${sortDir}&np=1&ut=${EM_UT}&fltt=2&invt=2&fid=${sortField}&fs=${CONCEPT_SECTOR_FS}&fields=${CONCEPT_PARAMS}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.diff) return [];
  return res.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    changePct: item.f3,
    change5d: item.f25,
    change20d: item.f183,
    mainNetInflow: item.f62,
    mainNetInflowPct: item.f184,
    turnover: item.f6
  }));
}

// ===== 9. 带历史对比的行业板块排行（5日/20日）=====
const SECTOR_HISTORY_PARAMS = 'f2,f3,f12,f14,f25,f183,f62,f184,f6';
async function getSectorRankWithHistory(sortField, sortDir, limit) {
  sortField = sortField || 'f3';
  sortDir = sortDir || 1;
  limit = limit || 31;
  const url = `${EM_API_BASE}/qt/clist/get?pn=1&pz=${limit}&po=${sortDir}&np=1&ut=${EM_UT}&fltt=2&invt=2&fid=${sortField}&fs=${SW_SECTOR_FS}&fields=${SECTOR_HISTORY_PARAMS}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.diff) return [];
  return res.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    price: item.f2,
    changePct: item.f3,
    change5d: item.f25,
    change20d: item.f183,
    mainNetInflow: item.f62,
    mainNetInflowPct: item.f184,
    turnover: item.f6
  }));
}

// ===== 10. 获取龙虎榜数据（机构席位）=====
async function getDragonTigerList(date, pageIndex, pageSize) {
  date = date || getTodayStr();
  pageIndex = pageIndex || 0;
  pageSize = pageSize || 20;
  const url = `${EM_EX_BASE}/getLHBStock?ut=${EM_UT3}&dpt=wz.ztzt&Pageindex=${pageIndex}&pagesize=${pageSize}&sort=fbt%3Aasc&date=${date}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.pool) return { total: 0, list: [] };
  return {
    total: res.data.tc || 0,
    date: res.data.qdate,
    list: res.data.pool.map(item => ({
      code: item.c,
      name: item.n,
      price: item.p / 100,
      changePct: item.zdp,
      amount: item.amount,
      turnoverRate: item.hs,
      firstLimitTime: item.fbt,
      reason: item.zttj ? item.zttj.days : 0,
      industry: item.hybk
    }))
  };
}

// ===== 11. 获取炸板池（曾涨停但打开的股票）=====
async function getBrokenLimitPool(date, pageIndex, pageSize) {
  date = date || getTodayStr();
  pageIndex = pageIndex || 0;
  pageSize = pageSize || 50;
  const url = `${EM_EX_BASE}/getTopicZBPool?ut=${EM_UT3}&dpt=wz.ztzt&Pageindex=${pageIndex}&pagesize=${pageSize}&sort=fbt%3Aasc&date=${date}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.pool) return { total: 0, list: [] };
  return {
    total: res.data.tc || 0,
    date: res.data.qdate,
    list: res.data.pool.map(item => ({
      code: item.c,
      name: item.n,
      price: item.p / 100,
      limitPrice: item.ztp / 100,
      changePct: item.zdp,
      amount: item.amount,
      turnoverRate: item.hs,
      firstLimitTime: item.fbt,
      limitOpenCount: item.zbc,
      amplitude: item.zf,
      industry: item.hybk
    }))
  };
}

// ===== 12. 从涨停池统计连板梯队 =====
function analyzeLimitLadder(limitUpList) {
  if (!limitUpList || !limitUpList.length) return { ladder: [], firstBoardCount: 0, multiBoardCount: 0, maxHeight: 0 };
  const ladderMap = {};
  let firstBoard = 0;
  let multiBoard = 0;
  let maxH = 0;
  for (const s of limitUpList) {
    const days = s.limitDays || 1;
    ladderMap[days] = (ladderMap[days] || 0) + 1;
    if (days === 1) firstBoard++;
    else multiBoard++;
    if (days > maxH) maxH = days;
  }
  const ladder = Object.keys(ladderMap).map(k => ({
    height: Number(k),
    count: ladderMap[k]
  })).sort((a, b) => a.height - b.height);
  return { ladder, firstBoardCount: firstBoard, multiBoardCount: multiBoard, maxHeight: maxH };
}

// ===== 统一数据采集入口（扩展版）=====
async function fetchAllMarketData() {
  const result = {
    timestamp: new Date().toISOString(),
    status: 'loading',
    marketIndex: null,
    sectorRank: null,
    sectorRankHistory: null,
    conceptSector: null,
    sectorFundFlow: null,
    northbound: null,
    limitUp: null,
    limitDown: null,
    brokenLimit: null,
    limitLadder: null,
    dragonTiger: null,
    stockFundInflow: null,
    stockFundOutflow: null
  };

  const promises = [];

  // 大盘指数
  promises.push(
    getMarketIndex()
      .then(data => { result.marketIndex = data; })
      .catch(err => { console.warn('大盘指数获取失败:', err); result.marketIndex = []; })
  );

  // 板块涨跌幅排行
  promises.push(
    getSectorRank('f3', 1, 31)
      .then(data => { result.sectorRank = data; })
      .catch(err => { console.warn('板块排行获取失败:', err); result.sectorRank = []; })
  );

  // 板块历史对比（5日/20日）
  promises.push(
    getSectorRankWithHistory('f3', 1, 31)
      .then(data => { result.sectorRankHistory = data; })
      .catch(err => { console.warn('板块历史对比获取失败:', err); result.sectorRankHistory = []; })
  );

  // 概念板块
  promises.push(
    getConceptSectorRank('f3', 1, 20)
      .then(data => { result.conceptSector = data; })
      .catch(err => { console.warn('概念板块获取失败:', err); result.conceptSector = []; })
  );

  // 板块资金流向
  promises.push(
    getSectorFundFlow('f62', 1, 31)
      .then(data => { result.sectorFundFlow = data; })
      .catch(err => { console.warn('板块资金获取失败:', err); result.sectorFundFlow = []; })
  );

  // 北向资金
  promises.push(
    getNorthboundFlow()
      .then(data => { result.northbound = data; })
      .catch(err => { console.warn('北向资金获取失败:', err); result.northbound = { latest: null, series: [] }; })
  );

  // 涨跌停
  const today = getTodayStr();
  promises.push(
    getLimitUpPool(today, 0, 100)
      .then(data => {
        result.limitUp = data;
        result.limitLadder = analyzeLimitLadder(data.list);
      })
      .catch(err => { console.warn('涨停池获取失败:', err); result.limitUp = { total: 0, list: [] }; result.limitLadder = { ladder: [], firstBoardCount: 0, multiBoardCount: 0, maxHeight: 0 }; })
  );

  promises.push(
    getLimitDownPool(today, 0, 50)
      .then(data => { result.limitDown = data; })
      .catch(err => { console.warn('跌停池获取失败:', err); result.limitDown = { total: 0, list: [] }; })
  );

  // 炸板池
  promises.push(
    getBrokenLimitPool(today, 0, 50)
      .then(data => { result.brokenLimit = data; })
      .catch(err => { console.warn('炸板池获取失败:', err); result.brokenLimit = { total: 0, list: [] }; })
  );

  // 龙虎榜
  promises.push(
    getDragonTigerList(today, 0, 20)
      .then(data => { result.dragonTiger = data; })
      .catch(err => { console.warn('龙虎榜获取失败:', err); result.dragonTiger = { total: 0, list: [] }; })
  );

  // 个股资金净流入TOP
  promises.push(
    getStockFundFlow('f62', 1, 20)
      .then(data => { result.stockFundInflow = data; })
      .catch(err => { console.warn('个股资金流入获取失败:', err); result.stockFundInflow = []; })
  );

  // 个股资金净流出TOP
  promises.push(
    getStockFundFlow('f62', 0, 20)
      .then(data => { result.stockFundOutflow = data; })
      .catch(err => { console.warn('个股资金流出获取失败:', err); result.stockFundOutflow = []; })
  );

  await Promise.all(promises);
  result.status = 'ready';
  return result;
}

// ===== 13. 智能分析引擎 =====

// 板块机会评分（0-100分）
// 维度：今日涨幅(20%) + 5日动量(20%) + 20日趋势(15%) + 主力资金流入(25%) + 资金占比(20%)
function scoreSectorOpportunity(sector, fundFlow, indexChange) {
  let score = 50;
  const w = { today: 20, d5: 20, d20: 15, fund: 25, fundPct: 20 };

  const todayPct = sector.changePct || 0;
  const d5Pct = sector.change5d || 0;
  const d20Pct = sector.change20d || 0;

  if (todayPct > 5) score += w.today;
  else if (todayPct > 3) score += w.today * 0.8;
  else if (todayPct > 1) score += w.today * 0.5;
  else if (todayPct > 0) score += w.today * 0.2;
  else if (todayPct > -2) score -= w.today * 0.3;
  else if (todayPct > -5) score -= w.today * 0.6;
  else score -= w.today;

  if (d5Pct > 10) score += w.d5;
  else if (d5Pct > 5) score += w.d5 * 0.7;
  else if (d5Pct > 2) score += w.d5 * 0.4;
  else if (d5Pct > 0) score += w.d5 * 0.15;
  else if (d5Pct > -5) score -= w.d5 * 0.3;
  else score -= w.d5 * 0.7;

  if (d20Pct > 20) score += w.d20;
  else if (d20Pct > 10) score += w.d20 * 0.7;
  else if (d20Pct > 5) score += w.d20 * 0.4;
  else if (d20Pct > 0) score += w.d20 * 0.15;
  else if (d20Pct > -10) score -= w.d20 * 0.4;
  else score -= w.d20 * 0.8;

  const fund = fundFlow ? fundFlow.mainNetInflow / 100000000 : 0;
  const fundPct = fundFlow ? fundFlow.mainNetInflowPct || 0 : 0;

  if (fund > 20) score += w.fund;
  else if (fund > 10) score += w.fund * 0.75;
  else if (fund > 5) score += w.fund * 0.5;
  else if (fund > 0) score += w.fund * 0.2;
  else if (fund > -10) score -= w.fund * 0.3;
  else if (fund > -20) score -= w.fund * 0.6;
  else score -= w.fund;

  if (fundPct > 1) score += w.fundPct;
  else if (fundPct > 0.5) score += w.fundPct * 0.7;
  else if (fundPct > 0.2) score += w.fundPct * 0.4;
  else if (fundPct > 0) score += w.fundPct * 0.15;
  else if (fundPct > -0.5) score -= w.fundPct * 0.3;
  else score -= w.fundPct * 0.7;

  if (todayPct > 0 && d5Pct > 0 && fund > 0) {
    score += 8;
  }
  if (todayPct < 0 && d5Pct < 0 && fund < 0) {
    score -= 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// 综合市场情绪评分（0-100）
function calculateMarketSentiment(data) {
  let score = 50;

  const sh = data.marketIndex ? data.marketIndex.find(i => i.code === '000001' || i.code === 'sh000001') : null;
  if (sh) {
    if (sh.changePct > 2) score += 15;
    else if (sh.changePct > 1) score += 10;
    else if (sh.changePct > 0.5) score += 5;
    else if (sh.changePct > 0) score += 2;
    else if (sh.changePct > -0.5) score -= 3;
    else if (sh.changePct > -1) score -= 8;
    else if (sh.changePct > -2) score -= 12;
    else score -= 18;
  }

  if (data.limitUp && data.limitDown) {
    const up = data.limitUp.total;
    const down = data.limitDown.total;
    const ratio = down > 0 ? up / down : 999;

    if (up > 150) score += 12;
    else if (up > 100) score += 8;
    else if (up > 60) score += 4;
    else if (up > 30) score += 0;
    else if (up > 15) score -= 5;
    else score -= 10;

    if (down > 50) score -= 12;
    else if (down > 30) score -= 8;
    else if (down > 15) score -= 4;
    else if (down > 5) score -= 1;
    else score += 2;

    if (ratio > 10) score += 6;
    else if (ratio > 5) score += 3;
    else if (ratio > 2) score += 1;
    else if (ratio < 0.5) score -= 5;
    else if (ratio < 0.3) score -= 10;
  }

  if (data.brokenLimit && data.limitUp) {
    const total = data.limitUp.total + data.brokenLimit.total;
    if (total > 0) {
      const brokenRate = data.brokenLimit.total / total * 100;
      if (brokenRate > 50) score -= 10;
      else if (brokenRate > 35) score -= 6;
      else if (brokenRate > 20) score -= 2;
      else if (brokenRate < 10) score += 4;
    }
  }

  if (data.limitLadder) {
    if (data.limitLadder.maxHeight >= 7) score += 8;
    else if (data.limitLadder.maxHeight >= 5) score += 5;
    else if (data.limitLadder.maxHeight >= 3) score += 2;
    else if (data.limitLadder.maxHeight <= 1) score -= 3;
  }

  if (data.northbound && data.northbound.latest) {
    const nb = data.northbound.latest.total;
    if (nb > 100) score += 10;
    else if (nb > 50) score += 6;
    else if (nb > 20) score += 3;
    else if (nb > 0) score += 1;
    else if (nb > -30) score -= 3;
    else if (nb > -80) score -= 7;
    else score -= 12;
  }

  if (data.sectorRank && data.sectorRank.length > 0) {
    const sorted = [...data.sectorRank].sort((a, b) => b.changePct - a.changePct);
    const upCount = sorted.filter(s => s.changePct > 0).length;
    const downCount = sorted.filter(s => s.changePct < 0).length;
    const upRatio = upCount / sorted.length;

    if (upRatio > 0.8) score += 6;
    else if (upRatio > 0.6) score += 3;
    else if (upRatio > 0.5) score += 1;
    else if (upRatio < 0.2) score -= 6;
    else if (upRatio < 0.3) score -= 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// 情绪等级判断
function sentimentLevel(score) {
  if (score >= 80) return { level: '极度亢奋', color: 'up', advice: '减仓避险' };
  if (score >= 65) return { level: '偏强乐观', color: 'up', advice: '持有为主' };
  if (score >= 45) return { level: '中性震荡', color: 'neutral', advice: '波段操作' };
  if (score >= 30) return { level: '偏弱谨慎', color: 'down', advice: '控制仓位' };
  if (score >= 15) return { level: '低迷恐慌', color: 'down', advice: '观望为主' };
  return { level: '极端冰点', color: 'down', advice: '分批抄底' };
}

// 生成操作建议
function generateTradingAdvice(data, sentimentScore) {
  const advice = {
    action: '',
    actionLevel: '',
    position: '',
    focus: [],
    avoid: [],
    reasons: [],
    riskLevel: ''
  };

  const sent = sentimentLevel(sentimentScore);
  advice.sentiment = sent;

  if (sentimentScore >= 75) {
    advice.action = '减仓兑现';
    advice.actionLevel = 'warn';
    advice.position = '3-5成';
    advice.riskLevel = '高';
    advice.reasons.push('市场情绪过热，短期回调风险加大');
    advice.reasons.push('涨停数量过多，赚钱效应扩散至尾声');
  } else if (sentimentScore >= 60) {
    advice.action = '持有做多';
    advice.actionLevel = 'up';
    advice.position = '6-8成';
    advice.riskLevel = '中低';
    advice.reasons.push('市场情绪积极，赚钱效应良好');
    advice.reasons.push('资金流入明确，趋势延续概率大');
  } else if (sentimentScore >= 40) {
    advice.action = '震荡布局';
    advice.actionLevel = 'neutral';
    advice.position = '5-6成';
    advice.riskLevel = '中';
    advice.reasons.push('市场处于震荡区间，结构性机会为主');
    advice.reasons.push('板块分化明显，精选个股优于追涨');
  } else if (sentimentScore >= 25) {
    advice.action = '谨慎观望';
    advice.actionLevel = 'down';
    advice.position = '2-4成';
    advice.riskLevel = '中高';
    advice.reasons.push('市场情绪偏弱，亏钱效应显现');
    advice.reasons.push('资金流出明显，防御为主');
  } else {
    advice.action = '分批抄底';
    advice.actionLevel = 'info';
    advice.position = '3-5成';
    advice.riskLevel = '中';
    advice.reasons.push('市场情绪接近冰点，恐慌情绪释放');
    advice.reasons.push('逆向投资窗口开启，分批布局优质标的');
  }

  if (data.sectorFundFlow && data.sectorRankHistory) {
    const fundMap = {};
    data.sectorFundFlow.forEach(s => { fundMap[s.code] = s; });

    const scored = data.sectorRankHistory.map(s => ({
      ...s,
      score: scoreSectorOpportunity(s, fundMap[s.code]),
      fund: fundMap[s.code]
    }));

    scored.sort((a, b) => b.score - a.score);

    const topSectors = scored.filter(s => s.score >= 65).slice(0, 5);
    const bottomSectors = scored.filter(s => s.score <= 35).slice(-5).reverse();

    advice.focus = topSectors.map(s => ({
      name: s.name,
      score: s.score,
      reason: s.fund && s.fund.mainNetInflow > 0
        ? `今日${formatPct(s.changePct)} + 主力净流入${(s.fund.mainNetInflow/100000000).toFixed(1)}亿`
        : `今日${formatPct(s.changePct)} + 5日${formatPct(s.change5d)}趋势向上`
    }));

    advice.avoid = bottomSectors.map(s => ({
      name: s.name,
      score: s.score,
      reason: s.fund && s.fund.mainNetInflow < 0
        ? `今日${formatPct(s.changePct)} + 主力净流出${Math.abs(s.fund.mainNetInflow/100000000).toFixed(1)}亿`
        : `今日${formatPct(s.changePct)} + 5日${formatPct(s.change5d)}趋势向下`
    }));

    if (advice.focus.length < 3) {
      advice.focus = scored.slice(0, 3).map(s => ({
        name: s.name,
        score: s.score,
        reason: s.fund && s.fund.mainNetInflow > 0
          ? `今日${formatPct(s.changePct)} + 主力净流入${(s.fund.mainNetInflow/100000000).toFixed(1)}亿`
          : `今日${formatPct(s.changePct)} + 5日${formatPct(s.change5d)}`
      }));
    }
    if (advice.avoid.length < 3) {
      advice.avoid = scored.slice(-3).reverse().map(s => ({
        name: s.name,
        score: s.score,
        reason: s.fund && s.fund.mainNetInflow < 0
          ? `今日${formatPct(s.changePct)} + 主力净流出${Math.abs(s.fund.mainNetInflow/100000000).toFixed(1)}亿`
          : `今日${formatPct(s.changePct)} + 5日${formatPct(s.change5d)}`
      }));
    }
  }

  if (data.conceptSector && data.conceptSector.length) {
    const conceptTop = [...data.conceptSector].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    advice.hotConcepts = conceptTop.map(s => ({
      name: s.name,
      changePct: s.changePct,
      change5d: s.change5d
    }));
  }

  return advice;
}

// 生成明日关注清单
function generateTomorrowWatchlist(data) {
  const watchlist = {
    strongStocks: [],
    breakouts: [],
    fallenAngels: []
  };

  if (data.limitUp && data.limitUp.list) {
    const multiBoard = data.limitUp.list.filter(s => s.limitDays >= 2).slice(0, 5);
    watchlist.strongStocks = multiBoard.map(s => ({
      name: s.name,
      code: s.code,
      days: s.limitDays,
      changePct: s.changePct,
      industry: s.industry,
      reason: `${s.limitDays}连板，市场高标，关注连板高度延续性`
    }));

    const firstBoard = data.limitUp.list
      .filter(s => s.limitDays === 1 && s.industry)
      .slice(0, 5);
    watchlist.breakouts = firstBoard.map(s => ({
      name: s.name,
      code: s.code,
      changePct: s.changePct,
      industry: s.industry,
      reason: `首板涨停，${s.industry}板块，关注明日溢价`
    }));
  }

  if (data.stockFundInflow && data.stockFundInflow.length) {
    const bigInflow = data.stockFundInflow
      .filter(s => s.mainNetInflow / 100000000 > 5 && s.changePct < 5)
      .slice(0, 3);
    if (bigInflow.length) {
      watchlist.fallenAngels = bigInflow.map(s => ({
        name: s.name,
        code: s.code,
        changePct: s.changePct,
        inflow: (s.mainNetInflow / 100000000).toFixed(2),
        reason: `主力净流入${(s.mainNetInflow/100000000).toFixed(1)}亿但涨幅不大，资金潜伏`
      }));
    }
  }

  return watchlist;
}

// 风险预警检测
function detectRisks(data) {
  const risks = [];

  if (data.marketIndex) {
    const sh = data.marketIndex.find(i => i.code === '000001' || i.code === 'sh000001');
    if (sh && sh.changePct < -1.5) {
      risks.push({ level: 'high', title: '大盘大跌', desc: `上证指数下跌 ${formatPct(sh.changePct)}，系统性风险显现，建议降低仓位。` });
    }
  }

  if (data.limitDown && data.limitDown.total > 30) {
    risks.push({ level: 'high', title: '跌停潮', desc: `跌停个股达 ${data.limitDown.total} 家，市场恐慌情绪蔓延，空仓观望为上。` });
  }

  if (data.northbound && data.northbound.latest && data.northbound.latest.total < -80) {
    risks.push({ level: 'high', title: '北向大幅流出', desc: `北向资金净流出 ${Math.abs(data.northbound.latest.total).toFixed(0)} 亿，外资大幅撤离。` });
  }

  if (data.brokenLimit && data.limitUp) {
    const total = data.limitUp.total + data.brokenLimit.total;
    if (total > 0 && data.brokenLimit.total / total > 0.5) {
      risks.push({ level: 'medium', title: '炸板率过高', desc: `炸板率 ${(data.brokenLimit.total/total*100).toFixed(0)}%，打板情绪极差，短线资金退缩。` });
    }
  }

  if (data.sectorFundFlow && data.sectorFundFlow.length) {
    const outflow = data.sectorFundFlow.filter(s => s.mainNetInflow < 0);
    if (outflow.length > data.sectorFundFlow.length * 0.7) {
      risks.push({ level: 'medium', title: '资金全面流出', desc: `超七成板块主力资金净流出，市场缺乏承接力量。` });
    }
  }

  return risks;
}

// ===== 14. 统一采集 + 智能分析 =====
async function fetchAllMarketDataWithAnalysis() {
  const data = await fetchAllMarketData();

  data.analysis = {};
  data.analysis.sentimentScore = calculateMarketSentiment(data);
  data.analysis.sentiment = sentimentLevel(data.analysis.sentimentScore);
  data.analysis.tradingAdvice = generateTradingAdvice(data, data.analysis.sentimentScore);
  data.analysis.watchlist = generateTomorrowWatchlist(data);
  data.analysis.risks = detectRisks(data);

  if (data.sectorRankHistory && data.sectorFundFlow) {
    const fundMap = {};
    data.sectorFundFlow.forEach(s => { fundMap[s.code] = s; });
    data.analysis.scoredSectors = data.sectorRankHistory.map(s => ({
      ...s,
      score: scoreSectorOpportunity(s, fundMap[s.code])
    })).sort((a, b) => b.score - a.score);
  }

  return data;
}

// ===== 导出到全局 =====
window.MarketDataAPI = {
  jsonp,
  getSectorRank,
  getSectorRankWithHistory,
  getConceptSectorRank,
  getSectorFundFlow,
  getNorthboundFlow,
  getLimitUpPool,
  getLimitDownPool,
  getBrokenLimitPool,
  getDragonTigerList,
  getMarketIndex,
  getStockFundFlow,
  analyzeLimitLadder,
  fetchAllMarketData,
  formatPct,
  formatAmount,
  getTodayStr,
  scoreSectorOpportunity,
  calculateMarketSentiment,
  sentimentLevel,
  generateTradingAdvice,
  generateTomorrowWatchlist,
  detectRisks,
  fetchAllMarketDataWithAnalysis
};
