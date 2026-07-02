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
  if (sortDir == null) sortDir = 1;
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
  if (sortDir == null) sortDir = 1;
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
  if (sortDir == null) sortDir = 1;
  limit = limit || 20;
  // m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048 沪深A股
  const fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
  const fields = 'f2,f3,f12,f14,f62,f66,f69,f72,f75,f84,f85,f100,f184';
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
    small: item.f75,
    superLargePct: item.f84,
    largePct: item.f85,
    industry: item.f100 || ''
  }));
}

// ===== 8. 获取全球市场数据（海外指数+商品）=====
// 100:海外指数  122:外盘商品
// DJIA道琼斯 SPX标普500 NDX纳斯达克 HSI恒生 N225日经 XAU黄金
async function getGlobalMarket() {
  const secids = '100.DJIA,100.SPX,100.NDX,100.HSI,100.N225,122.XAU';
  const fields = 'f2,f3,f4,f6,f12,f14';
  const url = `${EM_API_BASE}/qt/ulist.np/get?fltt=2&secids=${secids}&fields=${fields}&ut=${EM_UT}`;
  const res = await jsonp(url);
  if (!res || !res.data || !res.data.diff) return [];
  return res.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    price: item.f2,
    changePct: item.f3,
    change: item.f4,
    turnover: item.f6
  }));
}

// ===== 统一数据采集入口 =====
async function fetchAllMarketData() {
  const result = {
    timestamp: new Date().toISOString(),
    status: 'loading',
    marketIndex: null,
    globalMarket: null,
    sectorRank: null,
    sectorFundFlow: null,
    northbound: null,
    limitUp: null,
    limitDown: null,
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

  // 全球市场（海外指数+商品）
  promises.push(
    getGlobalMarket()
      .then(data => { result.globalMarket = data; })
      .catch(err => { console.warn('全球市场获取失败:', err); result.globalMarket = []; })
  );

  // 板块涨跌幅排行
  promises.push(
    getSectorRank('f3', 1, 31)
      .then(data => { result.sectorRank = data; })
      .catch(err => { console.warn('板块排行获取失败:', err); result.sectorRank = []; })
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
    getLimitUpPool(today, 0, 50)
      .then(data => { result.limitUp = data; })
      .catch(err => { console.warn('涨停池获取失败:', err); result.limitUp = { total: 0, list: [] }; })
  );

  promises.push(
    getLimitDownPool(today, 0, 50)
      .then(data => { result.limitDown = data; })
      .catch(err => { console.warn('跌停池获取失败:', err); result.limitDown = { total: 0, list: [] }; })
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

// ===== 导出到全局 =====
window.MarketDataAPI = {
  jsonp,
  getSectorRank,
  getSectorFundFlow,
  getNorthboundFlow,
  getLimitUpPool,
  getLimitDownPool,
  getMarketIndex,
  getGlobalMarket,
  getStockFundFlow,
  fetchAllMarketData,
  formatPct,
  formatAmount,
  getTodayStr
};
