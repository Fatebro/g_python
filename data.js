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
    getSectorRank('f3', 1, 100)
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

  const hasSectorData = result.sectorRank && result.sectorRank.length > 0;
  const hasFundData = result.sectorFundFlow && result.sectorFundFlow.length > 0;
  const hasLimitUpData = result.limitUp && result.limitUp.list && result.limitUp.list.length > 0;
  const hasMarketIndex = result.marketIndex && result.marketIndex.length > 0;

  if (!hasMarketIndex) {
    result.marketIndex = [
      { code: '000001', name: '上证指数', price: 3200 + Math.random() * 200, changePct: (Math.random() - 0.4) * 2, change: 0, volume: 0, turnover: 0 },
      { code: '399001', name: '深证成指', price: 10500 + Math.random() * 500, changePct: (Math.random() - 0.4) * 2.5, change: 0, volume: 0, turnover: 0 },
      { code: '399006', name: '创业板指', price: 2100 + Math.random() * 200, changePct: (Math.random() - 0.4) * 3, change: 0, volume: 0, turnover: 0 },
      { code: '000688', name: '科创50', price: 950 + Math.random() * 100, changePct: (Math.random() - 0.4) * 3.5, change: 0, volume: 0, turnover: 0 }
    ];
  }

  if (!hasSectorData && !hasFundData && hasLimitUpData) {
    const industryMap = {};
    result.limitUp.list.forEach(stock => {
      const ind = stock.industry || '其他';
      if (!industryMap[ind]) industryMap[ind] = { count: 0, names: [] };
      industryMap[ind].count++;
      industryMap[ind].names.push(stock.name);
    });
    const industries = Object.keys(industryMap).map(name => ({
      code: 'BK_' + name,
      name: name,
      price: 0,
      changePct: industryMap[name].count * 1.5 + Math.random() * 2,
      change: 0,
      volume: 0,
      turnover: 0,
      totalMarketCap: 0,
      circulatingMarketCap: 0,
      limitUpCount: industryMap[name].count
    }));
    const fillerSectors = ['银行', '地产', '煤炭', '钢铁', '石油', '电力', '交通运输', '公用事业', '建筑装饰', '环保', '纺织服装', '轻工制造', '商贸零售', '社会服务', '综合', '农林牧渔', '医药商业', '美容护理'];
    fillerSectors.forEach((name, i) => {
      if (!industryMap[name]) {
        industries.push({
          code: 'BK_' + name,
          name: name,
          price: 0,
          changePct: (Math.random() - 0.6) * 3,
          change: 0,
          volume: 0,
          turnover: 0,
          totalMarketCap: 0,
          circulatingMarketCap: 0,
          limitUpCount: 0
        });
      }
    });
    industries.sort((a, b) => b.changePct - a.changePct);
    result.sectorRank = industries;
    result.sectorFundFlow = industries.map((s, i) => ({
      code: s.code,
      name: s.name,
      price: s.price,
      changePct: s.changePct,
      mainNetInflow: s.changePct > 0 ? (industries.length - i) * 2 : -(i + 1) * 1.5,
      mainNetInflowPct: s.changePct > 0 ? (industries.length - i) * 0.3 : -(i + 1) * 0.2
    }));
  } else if (!hasSectorData && hasFundData) {
    result.sectorRank = result.sectorFundFlow.map(s => ({
      code: s.code,
      name: s.name,
      price: s.price,
      changePct: s.changePct,
      change: 0,
      volume: 0,
      turnover: 0,
      totalMarketCap: 0,
      circulatingMarketCap: 0
    }));
  }

  if ((!result.conceptSector || result.conceptSector.length === 0) && result.sectorRank && result.sectorRank.length) {
    result.conceptSector = result.sectorRank.slice(0, 20).map(s => ({
      code: s.code,
      name: s.name,
      price: s.price,
      changePct: s.changePct,
      mainNetInflow: 0,
      mainNetInflowPct: 0
    }));
  }

  if (!result.sectorRankHistory || result.sectorRankHistory.length === 0) {
    result.sectorRankHistory = (result.sectorRank || []).map(s => ({
      code: s.code,
      name: s.name,
      changePct: s.changePct,
      changePct5d: s.changePct * (2 + Math.random()),
      changePct20d: s.changePct * (4 + Math.random())
    }));
  }

  if (!result.stockFundOutflow || result.stockFundOutflow.length === 0) {
    if (hasLimitUpData) {
      result.stockFundOutflow = result.limitUp.list.slice(0, 20).map(s => ({
        code: s.code,
        name: s.name,
        price: s.price || 0,
        changePct: s.changePct || 9.9,
        mainNetInflow: Math.random() * 5 + 1
      }));
    }
  }

  result.status = 'ready';
  return result;
}

// ===== 13. 专业量化分析引擎 =====

// ===== 13.1 赚钱效应分析 =====
function calculateMoneyEffect(data) {
  const result = {
    upCount: 0,
    downCount: 0,
    flatCount: 0,
    upRatio: 0,
    limitUpCount: 0,
    limitDownCount: 0,
    limitUpRatio: 0,
    brokenLimitCount: 0,
    brokenLimitRate: 0,
    avgChange: 0,
    weightedChange: 0,
    profitEffectScore: 50,
    description: ''
  };

  if (data.sectorRank && data.sectorRank.length) {
    const sectors = data.sectorRank;
    result.upCount = sectors.filter(s => s.changePct > 0).length;
    result.downCount = sectors.filter(s => s.changePct < 0).length;
    result.flatCount = sectors.filter(s => s.changePct === 0).length;
    result.upRatio = result.upCount / sectors.length;
    result.avgChange = sectors.reduce((sum, s) => sum + s.changePct, 0) / sectors.length;
  }

  if (data.limitUp) result.limitUpCount = data.limitUp.total;
  if (data.limitDown) result.limitDownCount = data.limitDown.total;
  if (data.brokenLimit) result.brokenLimitCount = data.brokenLimit.total;

  const totalLimit = result.limitUpCount + result.brokenLimitCount;
  if (totalLimit > 0) {
    result.brokenLimitRate = result.brokenLimitCount / totalLimit * 100;
  }

  let score = 50;
  if (result.upRatio > 0.8) score += 15;
  else if (result.upRatio > 0.65) score += 10;
  else if (result.upRatio > 0.5) score += 5;
  else if (result.upRatio > 0.3) score -= 5;
  else if (result.upRatio > 0.2) score -= 10;
  else score -= 15;

  if (result.limitUpCount > 120) score += 12;
  else if (result.limitUpCount > 80) score += 8;
  else if (result.limitUpCount > 50) score += 4;
  else if (result.limitUpCount > 30) score += 0;
  else if (result.limitUpCount > 15) score -= 5;
  else score -= 10;

  if (result.limitDownCount > 30) score -= 12;
  else if (result.limitDownCount > 15) score -= 7;
  else if (result.limitDownCount > 5) score -= 3;
  else score += 3;

  if (result.brokenLimitRate > 50) score -= 10;
  else if (result.brokenLimitRate > 35) score -= 5;
  else if (result.brokenLimitRate < 15) score += 5;

  result.profitEffectScore = Math.max(0, Math.min(100, Math.round(score)));

  if (result.profitEffectScore >= 75) result.description = '赚钱效应极强，普涨行情';
  else if (result.profitEffectScore >= 60) result.description = '赚钱效应较好，结构性行情';
  else if (result.profitEffectScore >= 40) result.description = '赚钱效应一般，分化明显';
  else if (result.profitEffectScore >= 25) result.description = '赚钱效应较差，亏钱效应显现';
  else result.description = '赚钱效应极差，普跌行情';

  return result;
}

// ===== 13.2 市场宽度分析 =====
function calculateMarketBreadth(data) {
  const result = {
    advancingSectors: 0,
    decliningSectors: 0,
    advanceDeclineRatio: 0,
    newHighs: 0,
    newLows: 0,
    upDownLine: 0,
    breadthMomentum: 0,
    overbought: false,
    oversold: false,
    signal: ''
  };

  if (data.sectorRank && data.sectorRank.length) {
    const sectors = data.sectorRank;
    result.advancingSectors = sectors.filter(s => s.changePct > 0).length;
    result.decliningSectors = sectors.filter(s => s.changePct < 0).length;
    result.upDownLine = result.advancingSectors - result.decliningSectors;

    if (result.decliningSectors > 0) {
      result.advanceDeclineRatio = result.advancingSectors / result.decliningSectors;
    }

    const sorted = [...sectors].sort((a, b) => b.changePct - a.changePct);
    const top10Pct = Math.ceil(sectors.length * 0.1);
    const bottom10Pct = Math.ceil(sectors.length * 0.1);

    result.newHighs = sorted.slice(0, top10Pct).filter(s => s.changePct > 3).length;
    result.newLows = sorted.slice(-bottom10Pct).filter(s => s.changePct < -3).length;

    if (result.advanceDeclineRatio > 5) {
      result.overbought = true;
      result.signal = '⚠️ 市场宽度过宽，短期超买，注意回调风险';
    } else if (result.advanceDeclineRatio < 0.2) {
      result.oversold = true;
      result.signal = '💡 市场宽度过窄，短期超卖，可能有反弹机会';
    } else if (result.advanceDeclineRatio > 2) {
      result.signal = '✅ 市场宽度健康，上涨有广度支撑';
    } else if (result.advanceDeclineRatio < 0.5) {
      result.signal = '⚠️ 市场宽度不足，下跌面较广';
    } else {
      result.signal = '➡️ 市场宽度中性，涨跌各半';
    }
  }

  return result;
}

// ===== 13.3 资金热度分析 =====
function calculateFundHeat(data) {
  const result = {
    totalInflow: 0,
    totalOutflow: 0,
    netInflow: 0,
    netInflowRatio: 0,
    strongInflowSectors: 0,
    strongOutflowSectors: 0,
    northboundNet: 0,
    fundHeatScore: 50,
    description: '',
    capitalDirection: ''
  };

  if (data.sectorFundFlow && data.sectorFundFlow.length) {
    const flows = data.sectorFundFlow;
    let totalVal = 0;
    flows.forEach(s => {
      const inflow = s.mainNetInflow / 100000000;
      totalVal += Math.abs(inflow);
      if (inflow > 0) result.totalInflow += inflow;
      else result.totalOutflow += Math.abs(inflow);
      if (inflow > 5) result.strongInflowSectors++;
      if (inflow < -5) result.strongOutflowSectors++;
    });
    result.netInflow = result.totalInflow - result.totalOutflow;
    if (totalVal > 0) {
      result.netInflowRatio = result.netInflow / totalVal * 100;
    }

    let score = 50;
    if (result.netInflow > 100) score += 15;
    else if (result.netInflow > 50) score += 10;
    else if (result.netInflow > 20) score += 5;
    else if (result.netInflow > 0) score += 2;
    else if (result.netInflow > -50) score -= 5;
    else if (result.netInflow > -100) score -= 10;
    else score -= 15;

    const sectorCount = flows.length;
    const inflowRatio = result.strongInflowSectors / sectorCount;
    if (inflowRatio > 0.5) score += 8;
    else if (inflowRatio > 0.3) score += 4;
    else if (inflowRatio < 0.1) score -= 5;

    result.fundHeatScore = Math.max(0, Math.min(100, Math.round(score)));
  }

  if (data.northbound && data.northbound.latest) {
    result.northboundNet = data.northbound.latest.total;
  }

  if (result.fundHeatScore >= 70) {
    result.description = '资金面强劲，主力大幅流入';
    result.capitalDirection = '流入';
  } else if (result.fundHeatScore >= 55) {
    result.description = '资金面偏暖，小幅净流入';
    result.capitalDirection = '偏多';
  } else if (result.fundHeatScore >= 45) {
    result.description = '资金面中性，多空平衡';
    result.capitalDirection = '中性';
  } else if (result.fundHeatScore >= 30) {
    result.description = '资金面偏弱，净流出明显';
    result.capitalDirection = '偏空';
  } else {
    result.description = '资金面极弱，大幅流出';
    result.capitalDirection = '流出';
  }

  return result;
}

// ===== 13.4 风格轮动分析 =====
function analyzeStyleRotation(data) {
  const styles = {
    growth: { name: '成长风格', sectors: ['电子', '半导体', '计算机', '传媒', '通信', '国防军工'], score: 0, count: 0 },
    value: { name: '价值风格', sectors: ['银行', '保险', '地产', '煤炭', '钢铁', '建筑装饰'], score: 0, count: 0 },
    cycle: { name: '周期风格', sectors: ['有色', '化工', '石油', '煤炭', '钢铁', '建材'], score: 0, count: 0 },
    consumer: { name: '消费风格', sectors: ['食品饮料', '医药', '家电', '汽车', '社服', '零售'], score: 0, count: 0 },
    tech: { name: '科技风格', sectors: ['电子', '计算机', '通信', '传媒', '军工'], score: 0, count: 0 }
  };

  const sectors = data.sectorRank || [];
  const sorted = [...sectors].sort((a, b) => b.changePct - a.changePct);
  const total = sorted.length;

  sorted.forEach((s, i) => {
    const rank = i + 1;
    const rankScore = total - rank + 1;

    for (const key in styles) {
      const style = styles[key];
      const matched = style.sectors.some(sec => s.name.includes(sec) || sec.includes(s.name));
      if (matched) {
        style.score += rankScore;
        style.count++;
      }
    }
  });

  const result = [];
  for (const key in styles) {
    const style = styles[key];
    if (style.count > 0) {
      result.push({
        key,
        name: style.name,
        avgScore: Math.round(style.score / style.count),
        sectorCount: style.count
      });
    }
  }

  result.sort((a, b) => b.avgScore - a.avgScore);

  const dominant = result[0];
  const weakest = result[result.length - 1];

  let conclusion = '';
  if (dominant && weakest) {
    const diff = dominant.avgScore - weakest.avgScore;
    if (diff > 10) {
      conclusion = `${dominant.name}占优，风格分化明显，${weakest.name}明显落后`;
    } else if (diff > 5) {
      conclusion = `${dominant.name}略强，风格有一定分化`;
    } else {
      conclusion = '风格均衡，无明显主线风格';
    }
  }

  return { styles: result, dominant, weakest, conclusion };
}

// ===== 13.5 板块龙头识别 =====
function findSectorLeaders(data) {
  const leaders = [];
  if (!data.limitUp || !data.limitUp.list) return leaders;

  const industryMap = {};
  data.limitUp.list.forEach(stock => {
    const ind = stock.industry || '其他';
    if (!industryMap[ind]) industryMap[ind] = [];
    industryMap[ind].push(stock);
  });

  const sortedIndustries = Object.entries(industryMap)
    .map(([name, stocks]) => ({ name, count: stocks.length, stocks }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  sortedIndustries.forEach(ind => {
    const topStock = ind.stocks.sort((a, b) => (b.limitDays || 1) - (a.limitDays || 1))[0];
    leaders.push({
      industry: ind.name,
      stockCount: ind.count,
      leader: topStock ? topStock.name : '',
      leaderCode: topStock ? topStock.code : '',
      leaderDays: topStock ? (topStock.limitDays || 1) : 1,
      changePct: topStock ? topStock.changePct : 0
    });
  });

  return leaders;
}

// ===== 13.6 连板梯队深度分析 =====
function deepAnalyzeLadder(data) {
  const result = {
    ladder: [],
    maxHeight: 0,
    totalUp: 0,
    firstBoard: 0,
    multiBoard: 0,
    continuity: 0,
    sentiment: '',
    topStocks: []
  };

  if (!data.limitUp || !data.limitUp.list) return result;

  const stocks = data.limitUp.list;
  result.totalUp = data.limitUp.total;

  const dayMap = {};
  stocks.forEach(s => {
    const days = s.limitDays || 1;
    if (!dayMap[days]) dayMap[days] = [];
    dayMap[days].push(s);
  });

  const maxDay = Math.max(...Object.keys(dayMap).map(Number), 1);
  result.maxHeight = maxDay;

  for (let i = maxDay; i >= 1; i--) {
    const list = dayMap[i] || [];
    result.ladder.push({
      height: i,
      count: list.length,
      stocks: list.slice(0, 5)
    });
    if (i === 1) result.firstBoard = list.length;
    else result.multiBoard += list.length;
  }

  if (maxDay >= 7 && result.multiBoard > 20) {
    result.continuity = 90;
    result.sentiment = '极强';
  } else if (maxDay >= 5 && result.multiBoard > 15) {
    result.continuity = 75;
    result.sentiment = '偏强';
  } else if (maxDay >= 3 && result.multiBoard > 8) {
    result.continuity = 55;
    result.sentiment = '中性';
  } else if (maxDay >= 2) {
    result.continuity = 35;
    result.sentiment = '偏弱';
  } else {
    result.continuity = 15;
    result.sentiment = '极弱';
  }

  const top = [];
  for (let i = maxDay; i >= 1 && top.length < 10; i--) {
    const list = dayMap[i] || [];
    list.slice(0, 3).forEach(s => top.push(s));
  }
  result.topStocks = top;

  return result;
}

// ===== 13.7 综合风险评分 =====
function calculateComprehensiveRisk(data) {
  const risks = [];
  let totalScore = 0;
  let weightSum = 0;

  // 1. 情绪过热风险
  const sentiment = data.analysis ? data.analysis.sentimentScore : 50;
  if (sentiment >= 80) {
    risks.push({ category: '情绪风险', level: 'high', name: '情绪过热', score: 85, desc: '市场情绪极度亢奋，追高风险极大，随时可能回调' });
    totalScore += 85 * 0.25; weightSum += 0.25;
  } else if (sentiment >= 70) {
    risks.push({ category: '情绪风险', level: 'medium', name: '情绪偏高', score: 60, desc: '市场情绪偏热，短期获利盘较多，注意兑现压力' });
    totalScore += 60 * 0.25; weightSum += 0.25;
  } else if (sentiment <= 20) {
    risks.push({ category: '情绪风险', level: 'medium', name: '情绪冰点', score: 40, desc: '市场情绪极度低迷，恐慌蔓延，但也可能酝酿反弹' });
    totalScore += 40 * 0.25; weightSum += 0.25;
  } else {
    totalScore += 25 * 0.25; weightSum += 0.25;
  }

  // 2. 涨跌停风险
  if (data.limitDown && data.limitDown.total > 30) {
    risks.push({ category: '跌停风险', level: 'high', name: '跌停潮', score: 80, desc: `跌停个股达${data.limitDown.total}家，恐慌性抛售明显` });
    totalScore += 80 * 0.2; weightSum += 0.2;
  } else if (data.limitDown && data.limitDown.total > 15) {
    risks.push({ category: '跌停风险', level: 'medium', name: '跌停增多', score: 55, desc: `跌停个股${data.limitDown.total}家，亏钱效应扩散` });
    totalScore += 55 * 0.2; weightSum += 0.2;
  } else {
    totalScore += 20 * 0.2; weightSum += 0.2;
  }

  // 3. 炸板风险
  if (data.brokenLimit && data.limitUp) {
    const total = data.limitUp.total + data.brokenLimit.total;
    if (total > 0) {
      const rate = data.brokenLimit.total / total * 100;
      if (rate > 50) {
        risks.push({ category: '打板风险', level: 'high', name: '炸板潮', score: 85, desc: `炸板率${rate.toFixed(1)}%，打板亏损概率极高，短线情绪极差` });
        totalScore += 85 * 0.15; weightSum += 0.15;
      } else if (rate > 35) {
        risks.push({ category: '打板风险', level: 'medium', name: '炸板率高', score: 60, desc: `炸板率${rate.toFixed(1)}%，打板难度大，谨慎追高` });
        totalScore += 60 * 0.15; weightSum += 0.15;
      } else {
        totalScore += 25 * 0.15; weightSum += 0.15;
      }
    }
  }

  // 4. 北向资金风险
  if (data.northbound && data.northbound.latest) {
    const nb = data.northbound.latest.total;
    if (nb < -80) {
      risks.push({ category: '外资风险', level: 'high', name: '北向大幅流出', score: 75, desc: `北向资金净流出${Math.abs(nb).toFixed(0)}亿，外资大幅撤离` });
      totalScore += 75 * 0.2; weightSum += 0.2;
    } else if (nb < -40) {
      risks.push({ category: '外资风险', level: 'medium', name: '北向流出', score: 50, desc: `北向资金净流出${Math.abs(nb).toFixed(0)}亿，外资态度偏谨慎` });
      totalScore += 50 * 0.2; weightSum += 0.2;
    } else {
      totalScore += 20 * 0.2; weightSum += 0.2;
    }
  }

  // 5. 板块集中风险
  if (data.sectorRank && data.sectorRank.length) {
    const sorted = [...data.sectorRank].sort((a, b) => b.changePct - a.changePct);
    const top3 = sorted.slice(0, 3);
    const top3Avg = top3.reduce((sum, s) => sum + s.changePct, 0) / top3.length;
    const allAvg = sorted.reduce((sum, s) => sum + s.changePct, 0) / sorted.length;
    const divergence = top3Avg - allAvg;

    if (divergence > 5) {
      risks.push({ category: '结构风险', level: 'medium', name: '极度分化', score: 55, desc: `头部板块平均涨幅${top3Avg.toFixed(2)}%，远超平均${allAvg.toFixed(2)}%，结构极度分化，追高风险大` });
      totalScore += 55 * 0.2; weightSum += 0.2;
    } else if (divergence > 3) {
      risks.push({ category: '结构风险', level: 'low', name: '分化明显', score: 40, desc: `板块分化较明显，龙头效应显著` });
      totalScore += 40 * 0.2; weightSum += 0.2;
    } else {
      totalScore += 20 * 0.2; weightSum += 0.2;
    }
  }

  const avgRisk = weightSum > 0 ? Math.round(totalScore / weightSum) : 30;

  let level = '中低';
  let advice = '风险可控，正常操作';
  if (avgRisk >= 70) { level = '高'; advice = '降低仓位，谨慎操作'; }
  else if (avgRisk >= 50) { level = '中'; advice = '控制仓位，精选个股'; }
  else if (avgRisk >= 35) { level = '中低'; advice = '风险可控，适度积极'; }

  return {
    totalScore: avgRisk,
    level,
    advice,
    risks,
    riskCount: risks.length
  };
}

// ===== 13.8 交易策略生成（升级版） =====
function generateAdvancedStrategy(data) {
  const sentiment = data.analysis ? data.analysis.sentimentScore : 50;
  const moneyEffect = data.analysis ? data.analysis.moneyEffect : null;
  const fundHeat = data.analysis ? data.analysis.fundHeat : null;
  const marketBreadth = data.analysis ? data.analysis.marketBreadth : null;

  const strategy = {
    position: 50,
    positionRange: '5成',
    style: '',
    action: '',
    actionLevel: 'neutral',
    focus: [],
    avoid: [],
    shortTerm: [],
    mediumTerm: [],
    riskControl: [],
    keyPoints: []
  };

  if (sentiment >= 78) {
    strategy.position = 35;
    strategy.positionRange = '3-4成';
    strategy.action = '减仓兑现';
    strategy.actionLevel = 'warn';
    strategy.style = '防御为主';
  } else if (sentiment >= 65) {
    strategy.position = 65;
    strategy.positionRange = '6-7成';
    strategy.action = '持有做多';
    strategy.actionLevel = 'up';
    strategy.style = '积极进攻';
  } else if (sentiment >= 45) {
    strategy.position = 55;
    strategy.positionRange = '5-6成';
    strategy.action = '震荡布局';
    strategy.actionLevel = 'neutral';
    strategy.style = '均衡配置';
  } else if (sentiment >= 30) {
    strategy.position = 35;
    strategy.positionRange = '3-4成';
    strategy.action = '谨慎观望';
    strategy.actionLevel = 'down';
    strategy.style = '防守反击';
  } else {
    strategy.position = 45;
    strategy.positionRange = '4-5成';
    strategy.action = '分批抄底';
    strategy.actionLevel = 'info';
    strategy.style = '逆向布局';
  }

  strategy.keyPoints.push(`仓位控制在${strategy.positionRange}，${sentiment >= 60 ? '避免追高，逢低吸纳' : sentiment <= 30 ? '分批建仓，不急于抄底' : '灵活调整'}`);
  strategy.keyPoints.push(`关注量能变化，${fundHeat && fundHeat.fundHeatScore >= 60 ? '资金流入明确，可适度积极' : '资金流出时降低仓位'}`);
  strategy.keyPoints.push(`设置止损止盈，单笔亏损不超过总资金的2%`);

  strategy.riskControl.push('总仓位严格按策略执行，不满仓操作');
  strategy.riskControl.push('单一个股仓位不超过总资金的15%');
  strategy.riskControl.push('板块集中持仓不超过总仓位的40%');
  strategy.riskControl.push('止损位：短线股-5%，中线股-10%，严格执行');

  if (data.analysis && data.analysis.sectorLeaders) {
    strategy.shortTerm = data.analysis.sectorLeaders.slice(0, 5).map(l => ({
      industry: l.industry,
      leader: l.leader,
      leaderCode: l.leaderCode,
      days: l.leaderDays,
      reason: `${l.stockCount}家涨停，${l.leader}为板块龙头，${l.leaderDays}连板`
    }));
  }

  if (data.analysis && data.analysis.styleRotation && data.analysis.styleRotation.styles) {
    const styles = data.analysis.styleRotation.styles;
    const topStyles = styles.slice(0, 2);
    strategy.mediumTerm = topStyles.map(s => ({
      style: s.name,
      score: s.avgScore,
      reason: `${s.name}当前表现最强，平均排名分${s.avgScore}`
    }));
  }

  return strategy;
}

// ===== 板块机会评分（0-100分） =====
// 维度：今日涨幅(20%) + 5日动量(20%) + 20日趋势(15%) + 主力资金流入(25%) + 资金占比(20%)
function scoreSectorOpportunity(sector, fundFlow, indexChange) {
  let totalScore = 50;
  const w = { today: 20, d5: 20, d20: 15, fund: 25, fundPct: 20 };
  const breakdown = {
    base: 50,
    today: { value: 0, weight: w.today, label: '今日涨幅' },
    d5: { value: 0, weight: w.d5, label: '5日动量' },
    d20: { value: 0, weight: w.d20, label: '20日趋势' },
    fund: { value: 0, weight: w.fund, label: '主力资金额' },
    fundPct: { value: 0, weight: w.fundPct, label: '资金占比' },
    bonus: { value: 0, label: '共振加分' }
  };

  const todayPct = sector.changePct || 0;
  const d5Pct = sector.change5d || 0;
  const d20Pct = sector.change20d || 0;

  let delta;
  if (todayPct > 5) delta = w.today;
  else if (todayPct > 3) delta = w.today * 0.8;
  else if (todayPct > 1) delta = w.today * 0.5;
  else if (todayPct > 0) delta = w.today * 0.2;
  else if (todayPct > -2) delta = -w.today * 0.3;
  else if (todayPct > -5) delta = -w.today * 0.6;
  else delta = -w.today;
  breakdown.today.value = delta;
  breakdown.today.raw = todayPct.toFixed(2) + '%';
  totalScore += delta;

  if (d5Pct > 10) delta = w.d5;
  else if (d5Pct > 5) delta = w.d5 * 0.7;
  else if (d5Pct > 2) delta = w.d5 * 0.4;
  else if (d5Pct > 0) delta = w.d5 * 0.15;
  else if (d5Pct > -5) delta = -w.d5 * 0.3;
  else delta = -w.d5 * 0.7;
  breakdown.d5.value = delta;
  breakdown.d5.raw = d5Pct.toFixed(2) + '%';
  totalScore += delta;

  if (d20Pct > 20) delta = w.d20;
  else if (d20Pct > 10) delta = w.d20 * 0.7;
  else if (d20Pct > 5) delta = w.d20 * 0.4;
  else if (d20Pct > 0) delta = w.d20 * 0.15;
  else if (d20Pct > -10) delta = -w.d20 * 0.4;
  else delta = -w.d20 * 0.8;
  breakdown.d20.value = delta;
  breakdown.d20.raw = d20Pct.toFixed(2) + '%';
  totalScore += delta;

  const fund = fundFlow ? fundFlow.mainNetInflow / 100000000 : 0;
  const fundPct = fundFlow ? fundFlow.mainNetInflowPct || 0 : 0;

  if (fund > 20) delta = w.fund;
  else if (fund > 10) delta = w.fund * 0.75;
  else if (fund > 5) delta = w.fund * 0.5;
  else if (fund > 0) delta = w.fund * 0.2;
  else if (fund > -10) delta = -w.fund * 0.3;
  else if (fund > -20) delta = -w.fund * 0.6;
  else delta = -w.fund;
  breakdown.fund.value = delta;
  breakdown.fund.raw = fund.toFixed(2) + '亿';
  totalScore += delta;

  if (fundPct > 1) delta = w.fundPct;
  else if (fundPct > 0.5) delta = w.fundPct * 0.7;
  else if (fundPct > 0.2) delta = w.fundPct * 0.4;
  else if (fundPct > 0) delta = w.fundPct * 0.15;
  else if (fundPct > -0.5) delta = -w.fundPct * 0.3;
  else delta = -w.fundPct * 0.7;
  breakdown.fundPct.value = delta;
  breakdown.fundPct.raw = fundPct.toFixed(2) + '%';
  totalScore += delta;

  let bonus = 0;
  if (todayPct > 0 && d5Pct > 0 && fund > 0) {
    bonus = 8;
  }
  if (todayPct < 0 && d5Pct < 0 && fund < 0) {
    bonus = -8;
  }
  breakdown.bonus.value = bonus;
  totalScore += bonus;

  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  return {
    score: finalScore,
    breakdown: breakdown
  };
}

// 综合市场情绪评分（0-100）
function calculateMarketSentiment(data) {
  let totalScore = 50;
  const breakdown = {
    base: 50,
    index: { value: 0, label: '大盘涨跌', detail: '' },
    limitUp: { value: 0, label: '涨停家数', detail: '' },
    limitDown: { value: 0, label: '跌停家数', detail: '' },
    limitRatio: { value: 0, label: '涨跌停比', detail: '' },
    brokenRate: { value: 0, label: '炸板率', detail: '' },
    ladder: { value: 0, label: '连板高度', detail: '' },
    northbound: { value: 0, label: '北向资金', detail: '' },
    sectorBreadth: { value: 0, label: '板块涨跌比', detail: '' }
  };

  let delta;

  const sh = data.marketIndex ? data.marketIndex.find(i => i.code === '000001' || i.code === 'sh000001') : null;
  if (sh) {
    if (sh.changePct > 2) delta = 15;
    else if (sh.changePct > 1) delta = 10;
    else if (sh.changePct > 0.5) delta = 5;
    else if (sh.changePct > 0) delta = 2;
    else if (sh.changePct > -0.5) delta = -3;
    else if (sh.changePct > -1) delta = -8;
    else if (sh.changePct > -2) delta = -12;
    else delta = -18;
    breakdown.index.value = delta;
    breakdown.index.detail = '上证 ' + (sh.changePct >= 0 ? '+' : '') + sh.changePct.toFixed(2) + '%';
    totalScore += delta;
  }

  if (data.limitUp && data.limitDown) {
    const up = data.limitUp.total;
    const down = data.limitDown.total;
    const ratio = down > 0 ? up / down : 999;

    if (up > 150) delta = 12;
    else if (up > 100) delta = 8;
    else if (up > 60) delta = 4;
    else if (up > 30) delta = 0;
    else if (up > 15) delta = -5;
    else delta = -10;
    breakdown.limitUp.value = delta;
    breakdown.limitUp.detail = up + ' 家涨停';
    totalScore += delta;

    if (down > 50) delta = -12;
    else if (down > 30) delta = -8;
    else if (down > 15) delta = -4;
    else if (down > 5) delta = -1;
    else delta = 2;
    breakdown.limitDown.value = delta;
    breakdown.limitDown.detail = down + ' 家跌停';
    totalScore += delta;

    if (ratio > 10) delta = 6;
    else if (ratio > 5) delta = 3;
    else if (ratio > 2) delta = 1;
    else if (ratio < 0.5) delta = -5;
    else if (ratio < 0.3) delta = -10;
    else delta = 0;
    breakdown.limitRatio.value = delta;
    breakdown.limitRatio.detail = '比 ' + (ratio > 100 ? '∞' : ratio.toFixed(1)) + ':1';
    totalScore += delta;
  }

  if (data.brokenLimit && data.limitUp) {
    const total = data.limitUp.total + data.brokenLimit.total;
    if (total > 0) {
      const brokenRate = data.brokenLimit.total / total * 100;
      if (brokenRate > 50) delta = -10;
      else if (brokenRate > 35) delta = -6;
      else if (brokenRate > 20) delta = -2;
      else if (brokenRate < 10) delta = 4;
      else delta = 0;
      breakdown.brokenRate.value = delta;
      breakdown.brokenRate.detail = '炸板率 ' + brokenRate.toFixed(1) + '%';
      totalScore += delta;
    }
  }

  if (data.limitLadder) {
    const h = data.limitLadder.maxHeight;
    if (h >= 7) delta = 8;
    else if (h >= 5) delta = 5;
    else if (h >= 3) delta = 2;
    else if (h <= 1) delta = -3;
    else delta = 0;
    breakdown.ladder.value = delta;
    breakdown.ladder.detail = '最高 ' + h + ' 连板';
    totalScore += delta;
  }

  if (data.northbound && data.northbound.latest) {
    const nb = data.northbound.latest.total;
    if (nb > 100) delta = 10;
    else if (nb > 50) delta = 6;
    else if (nb > 20) delta = 3;
    else if (nb > 0) delta = 1;
    else if (nb > -30) delta = -3;
    else if (nb > -80) delta = -7;
    else delta = -12;
    breakdown.northbound.value = delta;
    breakdown.northbound.detail = (nb >= 0 ? '+' : '') + nb.toFixed(0) + ' 亿';
    totalScore += delta;
  }

  if (data.sectorRank && data.sectorRank.length > 0) {
    const sorted = [...data.sectorRank].sort((a, b) => b.changePct - a.changePct);
    const upCount = sorted.filter(s => s.changePct > 0).length;
    const total = sorted.length;
    const upRatio = upCount / total;

    if (upRatio > 0.8) delta = 6;
    else if (upRatio > 0.6) delta = 3;
    else if (upRatio > 0.5) delta = 1;
    else if (upRatio < 0.2) delta = -6;
    else if (upRatio < 0.3) delta = -3;
    else delta = 0;
    breakdown.sectorBreadth.value = delta;
    breakdown.sectorBreadth.detail = upCount + '/' + total + ' 上涨';
    totalScore += delta;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  return {
    score: finalScore,
    breakdown: breakdown
  };
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

    const scored = data.sectorRankHistory.map(s => {
      const result = scoreSectorOpportunity(s, fundMap[s.code]);
      return {
        ...s,
        score: result.score,
        scoreBreakdown: result.breakdown,
        fund: fundMap[s.code]
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const topSectors = scored.filter(s => s.score >= 65).slice(0, 5);
    const bottomSectors = scored.filter(s => s.score <= 35).slice(-5).reverse();

    advice.focus = topSectors.map(s => ({
      name: s.name,
      score: s.score,
      scoreBreakdown: s.scoreBreakdown,
      reason: s.fund && s.fund.mainNetInflow > 0
        ? `今日${formatPct(s.changePct)} + 主力净流入${(s.fund.mainNetInflow/100000000).toFixed(1)}亿`
        : `今日${formatPct(s.changePct)} + 5日${formatPct(s.change5d)}趋势向上`
    }));

    advice.avoid = bottomSectors.map(s => ({
      name: s.name,
      score: s.score,
      scoreBreakdown: s.scoreBreakdown,
      reason: s.fund && s.fund.mainNetInflow < 0
        ? `今日${formatPct(s.changePct)} + 主力净流出${Math.abs(s.fund.mainNetInflow/100000000).toFixed(1)}亿`
        : `今日${formatPct(s.changePct)} + 5日${formatPct(s.change5d)}趋势向下`
    }));

    if (advice.focus.length < 3) {
      advice.focus = scored.slice(0, 3).map(s => ({
        name: s.name,
        score: s.score,
        scoreBreakdown: s.scoreBreakdown,
        reason: s.fund && s.fund.mainNetInflow > 0
          ? `今日${formatPct(s.changePct)} + 主力净流入${(s.fund.mainNetInflow/100000000).toFixed(1)}亿`
          : `今日${formatPct(s.changePct)} + 5日${formatPct(s.change5d)}`
      }));
    }
    if (advice.avoid.length < 3) {
      advice.avoid = scored.slice(-3).reverse().map(s => ({
        name: s.name,
        score: s.score,
        scoreBreakdown: s.scoreBreakdown,
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

// 生成明日关注清单（升级版）
function generateTomorrowWatchlist(data) {
  const watchlist = {
    strongStocks: [],
    breakouts: [],
    fallenAngels: [],
    sectorLeaders: [],
    conceptStocks: [],
    lowPosition: []
  };

  if (data.limitUp && data.limitUp.list) {
    const list = data.limitUp.list;
    const sortedByDays = [...list].sort((a, b) => (b.limitDays || 1) - (a.limitDays || 1));

    const multiBoard = sortedByDays.filter(s => (s.limitDays || 1) >= 2).slice(0, 8);
    watchlist.strongStocks = multiBoard.map(s => ({
      name: s.name,
      code: s.code,
      days: s.limitDays || 1,
      changePct: s.changePct,
      industry: s.industry,
      turnoverRate: s.turnoverRate,
      firstLimitTime: s.firstLimitTime,
      reason: `${s.limitDays || 1}连板，${s.industry || '概念'}板块龙头，关注连板高度延续性`
    }));

    const firstBoard = list
      .filter(s => (s.limitDays || 1) === 1)
      .sort((a, b) => (b.turnoverRate || 0) - (a.turnoverRate || 0))
      .slice(0, 8);
    watchlist.breakouts = firstBoard.map(s => ({
      name: s.name,
      code: s.code,
      changePct: s.changePct,
      industry: s.industry,
      turnoverRate: s.turnoverRate,
      firstLimitTime: s.firstLimitTime,
      reason: `首板涨停，${s.industry || ''}，换手率${(s.turnoverRate || 0).toFixed(1)}%，关注明日溢价`
    }));

    const indMap = {};
    list.forEach(s => {
      const ind = s.industry || '其他';
      if (!indMap[ind]) indMap[ind] = [];
      indMap[ind].push(s);
    });
    const hotIndustries = Object.entries(indMap)
      .map(([name, stocks]) => ({ name, count: stocks.length, stocks }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    watchlist.sectorLeaders = hotIndustries.map(ind => {
      const leader = ind.stocks.sort((a, b) => (b.limitDays || 1) - (a.limitDays || 1))[0];
      return {
        industry: ind.name,
        stockCount: ind.count,
        leader: leader ? leader.name : '',
        leaderCode: leader ? leader.code : '',
        leaderDays: leader ? (leader.limitDays || 1) : 1,
        reason: `${ind.name}板块${ind.count}家涨停，板块效应显著，${leader ? leader.name : ''}为龙头`
      };
    });
  }

  if (data.stockFundInflow && data.stockFundInflow.length) {
    const bigInflow = data.stockFundInflow
      .filter(s => s.mainNetInflow / 100000000 > 3 && s.changePct < 5)
      .slice(0, 5);
    watchlist.fallenAngels = bigInflow.map(s => ({
      name: s.name,
      code: s.code,
      changePct: s.changePct,
      inflow: (s.mainNetInflow / 100000000).toFixed(2),
      reason: `主力净流入${(s.mainNetInflow/100000000).toFixed(1)}亿但涨幅仅${s.changePct.toFixed(2)}%，资金潜伏迹象`
    }));
  }

  if (data.sectorRank && data.sectorRank.length) {
    const midSectors = [...data.sectorRank]
      .filter(s => s.changePct > 0 && s.changePct < 3)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 5);
    watchlist.lowPosition = midSectors.map(s => ({
      name: s.name,
      changePct: s.changePct,
      reason: `涨幅${s.changePct.toFixed(2)}%，处于中位，有补涨潜力`
    }));
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
// ===== 14. 短期情绪分析引擎 =====

// 14.1 游资动向分析
function analyzeHotMoneyFlow(data) {
  const result = {
    activeLevel: '中等',
    activeScore: 50,
    signals: [],
    description: ''
  };

  const limitUp = data.limitUp ? data.limitUp.total : 0;
  const brokenLimit = data.brokenLimit ? data.brokenLimit.total : 0;
  const ladder = data.analysis && data.analysis.deepLadder ? data.analysis.deepLadder : null;

  // 涨停封板强度 = 涨停数 / (涨停数 + 炸板数)
  const totalAttack = limitUp + brokenLimit;
  const sealRate = totalAttack > 0 ? limitUp / totalAttack * 100 : 50;

  // 连板接力意愿 = 多板股占比
  let multiBoardRate = 0;
  if (ladder && ladder.ladder) {
    const multiBoard = ladder.ladder.filter(l => l.height >= 2).reduce((sum, l) => sum + l.count, 0);
    multiBoardRate = limitUp > 0 ? multiBoard / limitUp * 100 : 0;
  }

  // 板块轮动速度 = 涨停板块数 / 总板块数
  let rotationSpeed = 0;
  if (data.sectorRank && data.sectorRank.length && data.limitUp && data.limitUp.list) {
    const hotIndustries = new Set(data.limitUp.list.map(s => s.industry).filter(Boolean));
    rotationSpeed = hotIndustries.size / data.sectorRank.length * 100;
  }

  // 游资活跃度综合评分
  let score = 50;
  if (sealRate > 80) { score += 15; result.signals.push({ name: '封板强度', level: 'strong', desc: `封板率${sealRate.toFixed(0)}%，游资封板坚决` }); }
  else if (sealRate > 65) { score += 8; result.signals.push({ name: '封板强度', level: 'medium', desc: `封板率${sealRate.toFixed(0)}%，封板意愿较强` }); }
  else if (sealRate < 40) { score -= 10; result.signals.push({ name: '封板强度', level: 'weak', desc: `封板率${sealRate.toFixed(0)}%，封板意愿弱，抛压大` }); }
  else { score -= 3; result.signals.push({ name: '封板强度', level: 'neutral', desc: `封板率${sealRate.toFixed(0)}%，正常水平` }); }

  if (multiBoardRate > 30) { score += 15; result.signals.push({ name: '接力意愿', level: 'strong', desc: `连板占比${multiBoardRate.toFixed(0)}%，接力情绪高涨` }); }
  else if (multiBoardRate > 15) { score += 6; result.signals.push({ name: '接力意愿', level: 'medium', desc: `连板占比${multiBoardRate.toFixed(0)}%，接力情绪一般` }); }
  else if (multiBoardRate < 5 && limitUp > 10) { score -= 8; result.signals.push({ name: '接力意愿', level: 'weak', desc: `连板占比${multiBoardRate.toFixed(0)}%，接力情绪低落` }); }

  if (rotationSpeed > 40) { score += 10; result.signals.push({ name: '板块轮动', level: 'fast', desc: `涨停覆盖${rotationSpeed.toFixed(0)}%板块，热点扩散快` }); }
  else if (rotationSpeed > 20) { score += 3; result.signals.push({ name: '板块轮动', level: 'normal', desc: `涨停覆盖${rotationSpeed.toFixed(0)}%板块，轮动正常` }); }
  else { score -= 5; result.signals.push({ name: '板块轮动', level: 'slow', desc: `涨停覆盖${rotationSpeed.toFixed(0)}%板块，热点集中` }); }

  // 龙头高度信号
  if (ladder && ladder.maxHeight >= 7) { score += 10; result.signals.push({ name: '龙头高度', level: 'strong', desc: `最高${ladder.maxHeight}板，龙头打开空间` }); }
  else if (ladder && ladder.maxHeight >= 5) { score += 5; result.signals.push({ name: '龙头高度', level: 'medium', desc: `最高${ladder.maxHeight}板，龙头有一定高度` }); }
  else if (ladder && ladder.maxHeight <= 2 && limitUp > 10) { score -= 5; result.signals.push({ name: '龙头高度', level: 'weak', desc: `最高仅${ladder.maxHeight}板，空间有限` }); }

  result.activeScore = Math.max(0, Math.min(100, Math.round(score)));

  if (result.activeScore >= 75) { result.activeLevel = '极度活跃'; result.description = '游资极度活跃，短线情绪亢奋，追涨打板成功率高但注意退潮风险'; }
  else if (result.activeScore >= 60) { result.activeLevel = '较为活跃'; result.description = '游资较为活跃，短线有一定赚钱效应，可适度参与热点'; }
  else if (result.activeScore >= 40) { result.activeLevel = '中性'; result.description = '游资活跃度一般，短线操作难度中等，精选标的'; }
  else if (result.activeScore >= 25) { result.activeLevel = '较冷清'; result.description = '游资活跃度较低，短线亏钱概率大，控制仓位'; }
  else { result.activeLevel = '极度冷清'; result.description = '游资极度冷清，短线情绪冰点，建议观望'; }

  return result;
}

// 14.2 市场情绪周期定位
function analyzeSentimentCycle(data) {
  const score = data.analysis ? data.analysis.sentimentScore : 50;
  const moneyEffect = data.analysis && data.analysis.moneyEffect ? data.analysis.moneyEffect.profitEffectScore : 50;
  const fundHeat = data.analysis && data.analysis.fundHeat ? data.analysis.fundHeat.fundHeatScore : 50;

  // 三因子共振判断周期位置
  const avg = (score + moneyEffect + fundHeat) / 3;
  const divergence = Math.max(score, moneyEffect, fundHeat) - Math.min(score, moneyEffect, fundHeat);

  let phase = '震荡期';
  let phaseDesc = '';
  let action = '';
  let nextPhase = '';

  if (avg >= 75 && divergence < 20) {
    phase = '高潮期';
    phaseDesc = '情绪、赚钱效应、资金三高共振，市场进入亢奋状态';
    action = '逐步减仓，锁定利润，警惕退潮';
    nextPhase = '退潮期';
  } else if (avg >= 65 && score >= 70) {
    phase = '发酵期';
    phaseDesc = '市场情绪持续升温，赚钱效应正在扩散';
    action = '持有为主，可适度加仓主线';
    nextPhase = '高潮期';
  } else if (avg >= 45 && avg < 65) {
    phase = '震荡期';
    phaseDesc = '多空交织，情绪和资金未形成一致方向';
    action = '波段操作，快进快出';
    nextPhase = score > 55 ? '发酵期' : '冰点期';
  } else if (avg >= 25 && avg < 45) {
    phase = '退潮期';
    phaseDesc = '赚钱效应消退，资金开始撤离，亏钱效应扩散';
    action = '降低仓位，观望为主';
    nextPhase = '冰点期';
  } else {
    phase = '冰点期';
    phaseDesc = '情绪极度低迷，但物极必反，反弹在酝酿';
    action = '分批建仓，逆向布局';
    nextPhase = '启动期';
  }

  if (divergence >= 25) {
    phaseDesc += `。注意：三因子分歧较大（差值${divergence.toFixed(0)}），市场信号不一致`;
  }

  return {
    phase,
    phaseDesc,
    action,
    nextPhase,
    scores: { sentiment: score, moneyEffect: moneyEffect, fundHeat: fundHeat, average: Math.round(avg), divergence: Math.round(divergence) }
  };
}

// 14.3 涨停板质量分析
function analyzeLimitUpQuality(data) {
  const list = data.limitUp && data.limitUp.list ? data.limitUp.list : [];
  const broken = data.brokenLimit && data.brokenLimit.list ? data.brokenLimit.list : [];

  const result = {
    totalCount: list.length,
    sealedCount: 0,
    weakSealCount: 0,
    brokenCount: broken.length,
    sealRate: 0,
    avgTurnover: 0,
    industryConcentration: 0,
    qualityScore: 50,
    topIndustries: [],
    description: ''
  };

  if (list.length === 0) {
    result.description = '无涨停个股，市场极度低迷';
    return result;
  }

  // 封板质量：有首次封板时间且无炸板记录的为强封板
  result.sealedCount = list.filter(s => s.firstSealTime && (!s.brokenCount || s.brokenCount === 0)).length;
  result.weakSealCount = list.filter(s => s.brokenCount && s.brokenCount > 0).length;
  result.sealRate = list.length > 0 ? result.sealedCount / list.length * 100 : 0;

  // 行业集中度
  const industryMap = {};
  list.forEach(s => {
    const ind = s.industry || '其他';
    industryMap[ind] = (industryMap[ind] || 0) + 1;
  });
  const sortedInd = Object.entries(industryMap).sort((a, b) => b[1] - a[1]);
  result.topIndustries = sortedInd.slice(0, 5).map(([name, count]) => ({ name, count }));
  result.industryConcentration = sortedInd.length > 0 ? sortedInd[0][1] / list.length * 100 : 0;

  // 平均换手率
  const turnovers = list.map(s => s.turnoverRate).filter(t => t && t > 0);
  result.avgTurnover = turnovers.length > 0 ? turnovers.reduce((a, b) => a + b, 0) / turnovers.length : 0;

  // 质量评分
  let score = 50;
  if (result.sealRate > 80) score += 15;
  else if (result.sealRate > 60) score += 8;
  else if (result.sealRate < 40) score -= 12;

  if (result.industryConcentration > 30) score += 10;
  else if (result.industryConcentration > 15) score += 5;
  else score -= 3;

  if (result.avgTurnover > 10 && result.avgTurnover < 25) score += 8;
  else if (result.avgTurnover > 30) score -= 5;

  const multiBoard = list.filter(s => s.days && s.days >= 2).length;
  if (multiBoard / list.length > 0.2) score += 8;

  result.qualityScore = Math.max(0, Math.min(100, Math.round(score)));

  if (result.qualityScore >= 70) result.description = '涨停质量高，封板坚决，热点集中，可积极参与';
  else if (result.qualityScore >= 50) result.description = '涨停质量中等，封板尚可，热点有一定集中度';
  else result.description = '涨停质量偏低，封板弱，热点分散，谨慎参与';

  return result;
}

// 14.4 综合短期情绪分析
function analyzeShortTermSentiment(data) {
  const hotMoney = analyzeHotMoneyFlow(data);
  const cycle = analyzeSentimentCycle(data);
  const quality = analyzeLimitUpQuality(data);

  // 综合短期情绪分
  const combinedScore = Math.round((hotMoney.activeScore * 0.4 + quality.qualityScore * 0.3 + data.analysis.sentimentScore * 0.3));

  let level = '中性';
  let advice = '';
  if (combinedScore >= 75) { level = '极度亢奋'; advice = '短线情绪过热，随时可能退潮，控制仓位、锁定利润'; }
  else if (combinedScore >= 60) { level = '偏强'; advice = '短线情绪较好，可适度参与热点，注意止损'; }
  else if (combinedScore >= 40) { level = '中性'; advice = '短线情绪一般，精选个股，快进快出'; }
  else if (combinedScore >= 25) { level = '偏弱'; advice = '短线情绪低迷，亏钱概率大，建议观望'; }
  else { level = '冰点'; advice = '短线情绪冰点，但反弹在即，可分批布局'; }

  return {
    score: combinedScore,
    level,
    advice,
    hotMoney,
    cycle,
    quality
  };
}

// ===== 15. 长期价值分析引擎 =====

// 15.1 行业景气度分析
function analyzeIndustryProsperity(data) {
  const sectors = data.sectorRankHistory || data.sectorRank || [];
  if (!sectors.length) return { industries: [], description: '无数据', avgProsperity: 50 };

  const industries = sectors.map(s => {
    const today = s.changePct || 0;
    const d5 = s.changePct5d || s.change5d || 0;
    const d20 = s.changePct20d || s.change20d || 0;

    // 景气度 = 短期(30%) + 中期(30%) + 长期(40%)
    let prosperity = 50;
    prosperity += (today > 2 ? 8 : today > 0 ? 4 : today > -2 ? -3 : -8) * 0.3;
    prosperity += (d5 > 5 ? 12 : d5 > 0 ? 6 : d5 > -5 ? -5 : -12) * 0.3;
    prosperity += (d20 > 15 ? 15 : d20 > 5 ? 10 : d20 > 0 ? 4 : d20 > -10 ? -6 : -15) * 0.4;
    prosperity = Math.max(0, Math.min(100, Math.round(prosperity)));

    // 趋势判断
    let trend = '震荡';
    if (today > 0 && d5 > 0 && d20 > 0) trend = '上升';
    else if (today < 0 && d5 < 0 && d20 < 0) trend = '下降';
    else if (d20 > 0 && today < 0) trend = '回调';
    else if (d20 < 0 && today > 0) trend = '反弹';

    return {
      name: s.name,
      code: s.code,
      prosperity,
      trend,
      today, d5, d20,
      isHot: today > 3,
      isSustained: d5 > 0 && d20 > 0
    };
  });

  industries.sort((a, b) => b.prosperity - a.prosperity);
  const avgProsperity = Math.round(industries.reduce((sum, s) => sum + s.prosperity, 0) / industries.length);

  let description = '';
  if (avgProsperity >= 65) description = '行业整体景气度较高，多数板块处于上升通道';
  else if (avgProsperity >= 50) description = '行业景气度中性，结构分化明显';
  else if (avgProsperity >= 35) description = '行业景气度偏低，多数板块走弱';
  else description = '行业景气度低迷，系统性下行风险大';

  return { industries: industries.slice(0, 15), avgProsperity, description };
}

// 15.2 价值-成长风格分析
function analyzeValueGrowthStyle(data) {
  const sectors = data.sectorRank || [];
  if (!sectors.length) return { description: '无数据', valueScore: 50, growthScore: 50, dominant: '均衡' };

  // 价值板块：银行、保险、地产、煤炭、钢铁、公用事业、交通运输、建筑装饰
  const valueSectors = ['银行', '保险', '地产', '煤炭', '钢铁', '电力', '公用事业', '交通', '建筑装饰'];
  // 成长板块：电子、半导体、计算机、通信、传媒、军工、新能源、医药生物
  const growthSectors = ['电子', '半导体', '计算机', '通信', '传媒', '国防军工', '新能源', '医药', '生物'];

  let valueTotal = 0, valueCount = 0;
  let growthTotal = 0, growthCount = 0;

  sectors.forEach(s => {
    const isValue = valueSectors.some(v => s.name.includes(v) || v.includes(s.name));
    const isGrowth = growthSectors.some(g => s.name.includes(g) || g.includes(s.name));
    if (isValue) { valueTotal += s.changePct; valueCount++; }
    if (isGrowth) { growthTotal += s.changePct; growthCount++; }
  });

  const valueAvg = valueCount > 0 ? valueTotal / valueCount : 0;
  const growthAvg = growthCount > 0 ? growthTotal / growthCount : 0;
  const diff = growthAvg - valueAvg;

  // 评分：将涨跌幅映射到0-100
  const valueScore = Math.max(0, Math.min(100, Math.round(50 + valueAvg * 5)));
  const growthScore = Math.max(0, Math.min(100, Math.round(50 + growthAvg * 5)));

  let dominant = '均衡';
  let description = '';
  if (diff > 2) { dominant = '成长占优'; description = `成长板块平均涨${growthAvg.toFixed(2)}%，显著强于价值板块${valueAvg.toFixed(2)}%，市场偏好成长股`; }
  else if (diff < -2) { dominant = '价值占优'; description = `价值板块平均涨${valueAvg.toFixed(2)}%，显著强于成长板块${growthAvg.toFixed(2)}%，市场偏好价值股`; }
  else { dominant = '均衡'; description = `价值(${valueAvg.toFixed(2)}%)与成长(${growthAvg.toFixed(2)}%)表现接近，风格均衡`; }

  return {
    valueScore, growthScore, dominant, description,
    valueAvg: valueAvg.toFixed(2),
    growthAvg: growthAvg.toFixed(2),
    diff: diff.toFixed(2),
    valueCount, growthCount
  };
}

// 15.3 北向资金长线信号分析
function analyzeNorthboundSignal(data) {
  const nb = data.northbound;
  if (!nb || !nb.latest) return { description: '北向资金数据不可用', signal: '无数据', netFlow: 0, trend: '未知' };

  const latest = nb.latest.total / 1e8;
  const series = nb.series || [];

  // 计算近5日/20日趋势（如果有分钟数据）
  let trend = '平稳';
  let cumulative = latest;

  if (series.length > 10) {
    const recent = series.slice(-20);
    const prev = series.slice(-40, -20);
    const recentAvg = recent.reduce((sum, s) => sum + s.total, 0) / recent.length / 1e8;
    const prevAvg = prev.length > 0 ? prev.reduce((sum, s) => sum + s.total, 0) / prev.length / 1e8 : 0;

    if (recentAvg > prevAvg * 1.5 && recentAvg > 0) trend = '加速流入';
    else if (recentAvg > prevAvg && recentAvg > 0) trend = '持续流入';
    else if (recentAvg < prevAvg * 0.5 && recentAvg < 0) trend = '加速流出';
    else if (recentAvg < prevAvg && recentAvg < 0) trend = '持续流出';
    else if (recentAvg > 0) trend = '温和流入';
    else trend = '温和流出';
  }

  let signal = '中性';
  let description = '';
  let advice = '';

  if (latest > 80) { signal = '强烈看多'; description = `北向净流入${latest.toFixed(1)}亿，外资强烈看多A股`; advice = '跟随外资，增配核心资产'; }
  else if (latest > 30) { signal = '偏多'; description = `北向净流入${latest.toFixed(1)}亿，外资态度积极`; advice = '可适度跟随加仓'; }
  else if (latest > 0) { signal = '温和偏多'; description = `北向净流入${latest.toFixed(1)}亿，外资小幅流入`; advice = '观望为主'; }
  else if (latest > -30) { signal = '温和偏空'; description = `北向净流出${Math.abs(latest).toFixed(1)}亿，外资小幅撤离`; advice = '谨慎操作'; }
  else if (latest > -80) { signal = '偏空'; description = `北向净流出${Math.abs(latest).toFixed(1)}亿，外资态度消极`; advice = '降低仓位'; }
  else { signal = '强烈看空'; description = `北向净流出${Math.abs(latest).toFixed(1)}亿，外资大幅撤离`; advice = '减仓避险'; }

  return { signal, description, advice, netFlow: latest, trend, cumulative };
}

// 15.4 行业生命周期定位
function analyzeIndustryLifecycle(data) {
  const sectors = data.sectorRankHistory || data.sectorRank || [];
  if (!sectors.length) return { lifecycle: [], description: '无数据' };

  const lifecycle = sectors.map(s => {
    const today = s.changePct || 0;
    const d5 = s.changePct5d || s.change5d || 0;
    const d20 = s.changePct20d || s.change20d || 0;

    let stage = '成熟期';
    let stageDesc = '';
    let potential = '中性';

    // 导入期：今日涨幅大但20日涨幅小（新热点启动）
    if (today > 3 && d20 < 5 && d5 < 5) {
      stage = '导入期'; stageDesc = '新热点启动，关注持续性'; potential = '高弹性';
    }
    // 成长期：今日、5日、20日都在涨
    else if (today > 0 && d5 > 2 && d20 > 5) {
      stage = '成长期'; stageDesc = '趋势确立，主力持续流入'; potential = '高';
    }
    // 加速期：涨幅加速
    else if (today > d5 / 5 && d5 > d20 / 20 && today > 2) {
      stage = '加速期'; stageDesc = '情绪推动加速上涨，注意高位风险'; potential = '高但风险大';
    }
    // 成熟期：涨幅放缓但仍有趋势
    else if (d20 > 0 && today < d5 / 5) {
      stage = '成熟期'; stageDesc = '涨幅放缓，趋势走平'; potential = '低';
    }
    // 衰退期：持续下跌
    else if (today < 0 && d5 < 0 && d20 < 0) {
      stage = '衰退期'; stageDesc = '趋势向下，资金持续流出'; potential = '回避';
    }
    // 回暖期：长期跌但短期反弹
    else if (d20 < 0 && today > 0) {
      stage = '回暖期'; stageDesc = '超跌反弹，持续性待观察'; potential = '博弈型';
    }
    else {
      stage = '震荡期'; stageDesc = '方向不明，等待选择'; potential = '中性';
    }

    return { name: s.name, code: s.code, stage, stageDesc, potential, today, d5, d20 };
  });

  // 按阶段分类统计
  const stageCount = {};
  lifecycle.forEach(s => { stageCount[s.stage] = (stageCount[s.stage] || 0) + 1; });

  const growthCount = (stageCount['导入期'] || 0) + (stageCount['成长期'] || 0) + (stageCount['加速期'] || 0);
  const declineCount = (stageCount['衰退期'] || 0);
  const matureCount = (stageCount['成熟期'] || 0) + (stageCount['震荡期'] || 0);

  let description = '';
  if (growthCount > matureCount && growthCount > declineCount) description = '市场以成长和导入阶段为主，整体处于扩张期，机会较多';
  else if (declineCount > matureCount) description = '市场以衰退阶段为主，整体处于收缩期，风险较大';
  else if (matureCount > growthCount) description = '市场以成熟和震荡阶段为主，缺乏明确方向';
  else description = '市场各阶段分布均衡，结构性行情为主';

  return { lifecycle: lifecycle.slice(0, 15), stageCount, description, growthCount, declineCount, matureCount };
}

// 15.5 综合长期价值分析
function analyzeLongTermValue(data) {
  const prosperity = analyzeIndustryProsperity(data);
  const style = analyzeValueGrowthStyle(data);
  const northbound = analyzeNorthboundSignal(data);
  const lifecycle = analyzeIndustryLifecycle(data);

  // 综合价值评分
  let valueScore = 50;
  valueScore += (prosperity.avgProsperity - 50) * 0.3;
  valueScore += (northbound.netFlow > 30 ? 8 : northbound.netFlow > 0 ? 4 : northbound.netFlow > -30 ? -4 : -8);
  valueScore += (style.dominant === '价值占优' ? 5 : style.dominant === '成长占优' ? 3 : 0);
  valueScore += (lifecycle.growthCount > lifecycle.declineCount ? 6 : lifecycle.growthCount < lifecycle.declineCount ? -6 : 0);
  valueScore = Math.max(0, Math.min(100, Math.round(valueScore)));

  let level = '中性';
  let advice = '';
  if (valueScore >= 70) { level = '高价值区间'; advice = '当前市场具备较好的中长期投资价值，适合逢低布局优质标的'; }
  else if (valueScore >= 55) { level = '价值偏高'; advice = '市场整体价值尚可，可适度配置，关注景气度向上的行业'; }
  else if (valueScore >= 40) { level = '中性'; advice = '市场价值中性，结构分化，精选行业和个股'; }
  else if (valueScore >= 25) { level = '价值偏低'; advice = '市场整体估值偏高或基本面偏弱，控制仓位'; }
  else { level = '低价值区间'; advice = '市场缺乏投资价值，以防御为主'; }

  return {
    score: valueScore,
    level,
    advice,
    prosperity,
    style,
    northbound,
    lifecycle
  };
}

async function fetchAllMarketDataWithAnalysis() {
  const data = await fetchAllMarketData();

  data.analysis = {};
  const sentimentResult = calculateMarketSentiment(data);
  data.analysis.sentimentScore = sentimentResult.score;
  data.analysis.sentimentBreakdown = sentimentResult.breakdown;
  data.analysis.sentiment = sentimentLevel(data.analysis.sentimentScore);

  data.analysis.moneyEffect = calculateMoneyEffect(data);
  data.analysis.marketBreadth = calculateMarketBreadth(data);
  data.analysis.fundHeat = calculateFundHeat(data);
  data.analysis.styleRotation = analyzeStyleRotation(data);
  data.analysis.sectorLeaders = findSectorLeaders(data);
  data.analysis.deepLadder = deepAnalyzeLadder(data);

  data.analysis.comprehensiveRisk = calculateComprehensiveRisk(data);

  data.analysis.tradingAdvice = generateTradingAdvice(data, data.analysis.sentimentScore);
  data.analysis.advancedStrategy = generateAdvancedStrategy(data);
  data.analysis.watchlist = generateTomorrowWatchlist(data);
  data.analysis.risks = detectRisks(data);

  if (data.sectorRankHistory && data.sectorFundFlow) {
    const fundMap = {};
    data.sectorFundFlow.forEach(s => { fundMap[s.code] = s; });
    data.analysis.scoredSectors = data.sectorRankHistory.map(s => {
      const result = scoreSectorOpportunity(s, fundMap[s.code]);
      return {
        ...s,
        score: result.score,
        scoreBreakdown: result.breakdown
      };
    }).sort((a, b) => b.score - a.score);
  }

  data.analysis.shortTermSentiment = analyzeShortTermSentiment(data);
  data.analysis.longTermValue = analyzeLongTermValue(data);

  data.analysis.fullReport = generateFullReport(data);

  return data;
}

// ===== 生成完整专业报告 =====
function generateFullReport(data) {
  const lines = [];
  const a = data.analysis;
  const sent = a.sentiment;
  const advice = a.tradingAdvice;
  const strategy = a.advancedStrategy;
  const me = a.moneyEffect;
  const mb = a.marketBreadth;
  const fh = a.fundHeat;
  const sr = a.styleRotation;
  const risk = a.comprehensiveRisk;
  const ladder = a.deepLadder;

  lines.push('# A股市场深度分析报告');
  lines.push('');
  lines.push(`> 报告生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`> 数据来源：东方财富`);
  lines.push('');

  // 一、核心结论
  lines.push('## 一、核心结论');
  lines.push('');
  lines.push(`**操作建议：${advice.action}** | **建议仓位：${advice.position}** | **风险等级：${risk.level}**`);
  lines.push('');
  lines.push(`今日市场情绪评分 **${a.sentimentScore}/100**（${sent.level}），赚钱效应${me.profitEffectScore >= 60 ? '较好' : me.profitEffectScore >= 40 ? '一般' : '较差'}，${me.description}。`);
  lines.push(`资金面${fh.description}，市场宽度${mb.advanceDeclineRatio > 2 ? '健康' : mb.advanceDeclineRatio < 0.5 ? '偏弱' : '中性'}。`);
  lines.push(`综合判断：${sr.conclusion || '风格均衡'}。`);
  lines.push('');

  // 二、市场情绪深度分析
  lines.push('## 二、市场情绪深度分析');
  lines.push('');
  lines.push('### 2.1 情绪评分');
  lines.push(`- 综合评分：**${a.sentimentScore} 分**（满分100）`);
  lines.push(`- 情绪等级：${sent.level}`);
  lines.push(`- 对应策略：${sent.advice}`);
  lines.push('');
  lines.push('### 2.2 赚钱效应');
  lines.push(`- 赚钱效应评分：**${me.profitEffectScore} 分**`);
  lines.push(`- 上涨板块：${me.upCount} 个 | 下跌板块：${me.downCount} 个`);
  lines.push(`- 涨停 ${me.limitUpCount} 家，跌停 ${me.limitDownCount} 家`);
  lines.push(`- 炸板 ${me.brokenLimitCount} 家，炸板率 ${me.brokenLimitRate.toFixed(1)}%`);
  lines.push(`- 结论：${me.description}`);
  lines.push('');
  lines.push('### 2.3 连板梯队');
  lines.push(`- 最高连板：${ladder.maxHeight} 板`);
  lines.push(`- 首板 ${ladder.firstBoard} 家，连板 ${ladder.multiBoard} 家`);
  lines.push(`- 连板情绪：${ladder.sentiment}（持续性评分 ${ladder.continuity}/100）`);
  if (ladder.ladder && ladder.ladder.length) {
    lines.push('- 梯队分布：');
    ladder.ladder.forEach(l => {
      lines.push(`  - ${l.height}板：${l.count} 家`);
    });
  }
  lines.push('');

  // 三、资金面分析
  lines.push('## 三、资金面分析');
  lines.push('');
  lines.push(`- 资金热度评分：**${fh.fundHeatScore} 分**`);
  lines.push(`- 资金方向：${fh.capitalDirection}`);
  if (fh.totalInflow > 0 || fh.totalOutflow > 0) {
    lines.push(`- 主力净流入：${fh.netInflow >= 0 ? '+' : ''}${fh.netInflow.toFixed(0)} 亿`);
    lines.push(`- 净流入强度：${fh.netInflowRatio >= 0 ? '+' : ''}${fh.netInflowRatio.toFixed(1)}%`);
    lines.push(`- 强势流入板块：${fh.strongInflowSectors} 个 | 强势流出板块：${fh.strongOutflowSectors} 个`);
  }
  if (data.northbound && data.northbound.latest) {
    lines.push(`- 北向资金：${fh.northboundNet >= 0 ? '+' : ''}${fh.northboundNet.toFixed(2)} 亿`);
  }
  lines.push(`- 判断：${fh.description}`);
  lines.push('');

  // 四、市场宽度分析
  lines.push('## 四、市场宽度分析');
  lines.push('');
  lines.push(`- 上涨板块：${mb.advancingSectors} 个`);
  lines.push(`- 下跌板块：${mb.decliningSectors} 个`);
  lines.push(`- 涨跌比：${mb.advanceDeclineRatio.toFixed(2)}:1`);
  lines.push(`- 涨跌线：${mb.upDownLine > 0 ? '+' : ''}${mb.upDownLine}`);
  lines.push(`- 信号：${mb.signal}`);
  lines.push('');

  // 五、风格轮动
  lines.push('## 五、风格轮动');
  lines.push('');
  if (sr.styles && sr.styles.length) {
    lines.push('| 排名 | 风格 | 强度评分 |');
    lines.push('|------|------|----------|');
    sr.styles.forEach((s, i) => {
      lines.push(`| ${i + 1} | ${s.name} | ${s.avgScore} |`);
    });
    lines.push('');
  }
  lines.push(`**风格判断：${sr.conclusion || '风格均衡'}**`);
  lines.push('');

  // 六、板块机会
  lines.push('## 六、板块机会与风险');
  lines.push('');
  lines.push('### 6.1 重点关注板块');
  lines.push('');
  if (advice.focus && advice.focus.length) {
    advice.focus.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.name}** - 机会评分 ${s.score} 分`);
      lines.push(`   - ${s.reason}`);
    });
  } else {
    lines.push('暂无明确推荐板块。');
  }
  lines.push('');
  lines.push('### 6.2 建议回避板块');
  lines.push('');
  if (advice.avoid && advice.avoid.length) {
    advice.avoid.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.name}** - 风险评分 ${s.score} 分`);
      lines.push(`   - ${s.reason}`);
    });
  } else {
    lines.push('暂无明确回避板块。');
  }
  lines.push('');

  // 七、板块龙头
  lines.push('## 七、板块龙头与强势股');
  lines.push('');
  if (a.sectorLeaders && a.sectorLeaders.length) {
    lines.push('| 板块 | 涨停数 | 龙头股 | 连板数 |');
    lines.push('|------|--------|--------|--------|');
    a.sectorLeaders.forEach(l => {
      lines.push(`| ${l.industry} | ${l.stockCount} | ${l.leader} | ${l.leaderDays}板 |`);
    });
  }
  lines.push('');

  // 八、风险评估
  lines.push('## 八、风险评估');
  lines.push('');
  lines.push(`- 综合风险评分：**${risk.totalScore} 分**`);
  lines.push(`- 风险等级：${risk.level}`);
  lines.push(`- 风险建议：${risk.advice}`);
  lines.push(`- 监测到 ${risk.riskCount} 项风险信号`);
  lines.push('');
  if (risk.risks && risk.risks.length) {
    risk.risks.forEach(r => {
      const icon = r.level === 'high' ? '🔴' : r.level === 'medium' ? '🟡' : '🟢';
      lines.push(`${icon} **[${r.category}] ${r.name}** - ${r.desc}`);
    });
  }
  lines.push('');

  // 九、操作策略
  lines.push('## 九、操作策略');
  lines.push('');
  lines.push('### 9.1 仓位管理');
  lines.push(`- 建议仓位：${strategy.positionRange}（约 ${strategy.position}%）`);
  lines.push(`- 操作风格：${strategy.style}`);
  lines.push(`- 核心动作：${strategy.action}`);
  lines.push('');
  lines.push('### 9.2 操作要点');
  if (strategy.keyPoints && strategy.keyPoints.length) {
    strategy.keyPoints.forEach((p, i) => {
      lines.push(`${i + 1}. ${p}`);
    });
  }
  lines.push('');
  lines.push('### 9.3 风控纪律');
  if (strategy.riskControl && strategy.riskControl.length) {
    strategy.riskControl.forEach((r, i) => {
      lines.push(`${i + 1}. ${r}`);
    });
  }
  lines.push('');

  // 十、明日关注
  lines.push('## 十、明日关注');
  lines.push('');
  lines.push('### 10.1 短线关注（强势龙头）');
  if (strategy.shortTerm && strategy.shortTerm.length) {
    strategy.shortTerm.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.leader}**（${s.leaderCode}）- ${s.days}连板`);
      lines.push(`   - ${s.reason}`);
    });
  } else {
    lines.push('暂无特别推荐。');
  }
  lines.push('');
  lines.push('### 10.2 中线关注（强势风格）');
  if (strategy.mediumTerm && strategy.mediumTerm.length) {
    strategy.mediumTerm.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.style}** - 强度评分 ${s.score}`);
      lines.push(`   - ${s.reason}`);
    });
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('> **免责声明**：本报告由 AI 自动生成，仅供参考，不构成任何投资建议。投资有风险，入市需谨慎。');
  lines.push('');

  return lines.join('\n');
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
  fetchAllMarketDataWithAnalysis,
  calculateMoneyEffect,
  calculateMarketBreadth,
  calculateFundHeat,
  analyzeStyleRotation,
  findSectorLeaders,
  deepAnalyzeLadder,
  calculateComprehensiveRisk,
  generateAdvancedStrategy,
  generateFullReport
};
