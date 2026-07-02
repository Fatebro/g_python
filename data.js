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

  // 兜底：若关键数据全部为空（JSONP 失败/无网络），使用模拟数据保证仪表盘可用
  const hasRealData = (result.sectorRank && result.sectorRank.length > 0) ||
                      (result.sectorFundFlow && result.sectorFundFlow.length > 0) ||
                      (result.marketIndex && result.marketIndex.length > 0);
  if (!hasRealData) {
    console.warn('[兜底] 实时数据获取失败，启用模拟数据（演示模式）');
    return getMockMarketData();
  }

  result.status = 'ready';
  return result;
}

// ===== 模拟数据兜底（JSONP 失败时使用，保证仪表盘始终可用，辅助决策）=====
// 标记数据来源，便于前端提示用户
function getMockMarketData() {
  // 申万一级行业 31 个（名称 + 涨跌幅 + 主力净流入，单位：元）
  const sec = [
    { name: '电子', changePct: 3.85, mainNetInflow: 8.6e9 },
    { name: '通信', changePct: 3.12, mainNetInflow: 6.2e9 },
    { name: '计算机', changePct: 2.74, mainNetInflow: 5.1e9 },
    { name: '国防军工', changePct: 2.45, mainNetInflow: 4.3e9 },
    { name: '传媒', changePct: 2.10, mainNetInflow: 3.2e9 },
    { name: '机械设备', changePct: 1.62, mainNetInflow: 2.1e9 },
    { name: '有色金属', changePct: 1.48, mainNetInflow: 1.8e9 },
    { name: '电力设备', changePct: 1.25, mainNetInflow: 1.5e9 },
    { name: '汽车', changePct: 0.92, mainNetInflow: 0.9e9 },
    { name: '综合', changePct: 0.66, mainNetInflow: 0.4e9 },
    { name: '公用事业', changePct: 0.51, mainNetInflow: 0.2e9 },
    { name: '交通运输', changePct: 0.38, mainNetInflow: -0.1e9 },
    { name: '环保', changePct: 0.22, mainNetInflow: -0.3e9 },
    { name: '钢铁', changePct: 0.08, mainNetInflow: -0.5e9 },
    { name: '煤炭', changePct: -0.15, mainNetInflow: -0.7e9 },
    { name: '石油石化', changePct: -0.32, mainNetInflow: -0.9e9 },
    { name: '基础化工', changePct: -0.55, mainNetInflow: -1.2e9 },
    { name: '纺织服饰', changePct: -0.78, mainNetInflow: -1.5e9 },
    { name: '轻工制造', changePct: -0.92, mainNetInflow: -1.8e9 },
    { name: '建筑材料', changePct: -1.15, mainNetInflow: -2.1e9 },
    { name: '家用电器', changePct: -1.32, mainNetInflow: -2.4e9 },
    { name: '商贸零售', changePct: -1.55, mainNetInflow: -2.8e9 },
    { name: '社会服务', changePct: -1.78, mainNetInflow: -3.1e9 },
    { name: '美容护理', changePct: -1.95, mainNetInflow: -3.4e9 },
    { name: '农林牧渔', changePct: -2.18, mainNetInflow: -3.8e9 },
    { name: '医药生物', changePct: -2.42, mainNetInflow: -4.2e9 },
    { name: '食品饮料', changePct: -2.68, mainNetInflow: -4.6e9 },
    { name: '银行', changePct: -2.85, mainNetInflow: -5.1e9 },
    { name: '非银金融', changePct: -3.12, mainNetInflow: -5.6e9 },
    { name: '建筑装饰', changePct: -3.45, mainNetInflow: -6.2e9 },
    { name: '房地产', changePct: -3.88, mainNetInflow: -7.1e9 }
  ];

  const sectorRank = sec.map((s, i) => ({
    code: 'BK0' + (400 + i),
    name: s.name,
    price: 1000 + i * 50 + s.changePct * 10,
    changePct: s.changePct,
    change: s.changePct * 8,
    volume: 5e8 + Math.random() * 1e9,
    turnover: 2e10 + Math.random() * 5e10,
    totalMarketCap: 1e12 + Math.random() * 5e12,
    circulatingMarketCap: 8e11 + Math.random() * 4e12
  }));

  const sectorFundFlow = sec.map((s, i) => ({
    code: 'BK0' + (400 + i),
    name: s.name,
    price: 1000 + i * 50,
    changePct: s.changePct,
    mainNetInflow: s.mainNetInflow,
    mainNetInflowPct: s.mainNetInflow / 1e10 * 100,
    superLarge: s.mainNetInflow * 0.5,
    large: s.mainNetInflow * 0.3,
    medium: -s.mainNetInflow * 0.2,
    small: -s.mainNetInflow * 0.15,
    superLargePct: 50, largePct: 30, mediumPct: 12, smallPct: 8
  }));

  const marketIndex = [
    { code: 'sh000001', name: '上证指数', price: 3285.42, changePct: 0.85, change: 27.65, volume: 3.8e10, turnover: 4.2e11, upCount: 2856, downCount: 1986, flatCount: 158 },
    { code: 'sz399001', name: '深证成指', price: 10482.15, changePct: 1.32, change: 136.42, volume: 4.2e10, turnover: 5.1e11, upCount: 3120, downCount: 1654, flatCount: 126 },
    { code: 'sz399006', name: '创业板指', price: 2156.88, changePct: 2.15, change: 45.36, volume: 1.8e10, turnover: 2.3e11, upCount: 980, downCount: 420, flatCount: 50 },
    { code: 'sh000688', name: '科创50', price: 985.36, changePct: 2.86, change: 27.42, volume: 1.2e10, turnover: 1.6e11, upCount: 380, downCount: 120, flatCount: 20 }
  ];

  const globalMarket = [
    { code: 'DJIA', name: '道琼斯', price: 42156.32, changePct: 0.45, change: 188.65, turnover: 0 },
    { code: 'SPX', name: '标普500', price: 5842.88, changePct: 0.62, change: 35.92, turnover: 0 },
    { code: 'NDX', name: '纳斯达克', price: 20586.45, changePct: 0.88, change: 178.36, turnover: 0 },
    { code: 'HSI', name: '恒生指数', price: 18652.12, changePct: 1.25, change: 230.45, turnover: 0 },
    { code: 'N225', name: '日经225', price: 40125.66, changePct: -0.32, change: -128.55, turnover: 0 },
    { code: 'XAU', name: '黄金/美元', price: 2658.42, changePct: 0.85, change: 22.36, turnover: 0 }
  ];

  // 北向资金分钟序列（模拟当日走势）
  const nbSeries = [];
  let nbAcc = 0;
  for (let h = 9; h <= 15; h++) {
    for (let m = 30; m <= 59; m += 5) {
      if (h === 9 && m < 30) continue;
      if (h >= 15 && m > 0) continue;
      const t = h + ':' + String(m).padStart(2, '0');
      const delta = (Math.random() - 0.35) * 15;
      nbAcc += delta;
      nbSeries.push({ time: t, sh: nbAcc * 0.6, sz: nbAcc * 0.4, total: nbAcc });
    }
  }
  const nbLatest = nbSeries[nbSeries.length - 1] || { total: 68.5, sh: 42.3, sz: 26.2 };

  const limitUp = {
    total: 93,
    date: '2026-07-02',
    list: [
      { code: '300308', name: '中际旭创', price: 168.5, changePct: 20.01, amount: 8.5e9, turnoverRate: 5.2, firstLimitTime: '09:35', lastLimitTime: '09:35', limitOpenCount: 0, industry: '通信', limitDays: 2 },
      { code: '300502', name: '新易盛', price: 92.3, changePct: 20.0, amount: 6.2e9, turnoverRate: 8.1, firstLimitTime: '09:42', lastLimitTime: '10:15', limitOpenCount: 1, industry: '通信', limitDays: 1 },
      { code: '300394', name: '天孚通信', price: 65.8, changePct: 20.0, amount: 4.1e9, turnoverRate: 6.5, firstLimitTime: '09:48', lastLimitTime: '09:48', limitOpenCount: 0, industry: '通信', limitDays: 1 },
      { code: '688048', name: '长华化学', price: 28.5, changePct: 20.0, amount: 2.8e9, turnoverRate: 12.3, firstLimitTime: '10:05', lastLimitTime: '14:20', limitOpenCount: 3, industry: '化工', limitDays: 1 },
      { code: '002371', name: '北方华创', price: 425.6, changePct: 10.01, amount: 5.5e9, turnoverRate: 3.2, firstLimitTime: '10:12', lastLimitTime: '10:12', limitOpenCount: 0, industry: '电子', limitDays: 1 },
      { code: '688256', name: '寒武纪', price: 528.3, changePct: 20.0, amount: 7.8e9, turnoverRate: 9.5, firstLimitTime: '10:25', lastLimitTime: '10:25', limitOpenCount: 0, industry: '电子', limitDays: 3 },
      { code: '300750', name: '宁德时代', price: 268.5, changePct: 6.85, amount: 9.2e9, turnoverRate: 2.1, firstLimitTime: '13:15', lastLimitTime: '14:05', limitOpenCount: 2, industry: '电力设备', limitDays: 1 },
      { code: '002475', name: '立讯精密', price: 42.8, changePct: 10.02, amount: 4.5e9, turnoverRate: 4.2, firstLimitTime: '13:35', lastLimitTime: '13:35', limitOpenCount: 0, industry: '电子', limitDays: 1 },
      { code: '600893', name: '航发动力', price: 48.5, changePct: 10.01, amount: 3.2e9, turnoverRate: 3.8, firstLimitTime: '14:02', lastLimitTime: '14:02', limitOpenCount: 0, industry: '国防军工', limitDays: 2 },
      { code: '688122', name: '西部超导', price: 68.2, changePct: 20.0, amount: 2.1e9, turnoverRate: 7.5, firstLimitTime: '14:15', lastLimitTime: '14:15', limitOpenCount: 0, industry: '国防军工', limitDays: 1 }
    ]
  };

  const limitDown = {
    total: 12,
    date: '2026-07-02',
    list: [
      { code: '600048', name: '保利发展', price: 8.5, changePct: -10.02, amount: 1.2e9, turnoverRate: 1.5, firstLimitTime: '10:30', lastLimitTime: '10:30', industry: '房地产' },
      { code: '001979', name: '招商蛇口', price: 7.8, changePct: -10.01, amount: 0.9e9, turnoverRate: 1.2, firstLimitTime: '11:05', lastLimitTime: '11:05', industry: '房地产' }
    ]
  };

  const stockFundInflow = [
    { code: '300750', name: '宁德时代', price: 268.5, changePct: 6.85, mainNetInflow: 1.85e10, mainNetInflowPct: 8.5, superLarge: 1.2e10, large: 5e9, medium: 1.5e9, small: -1e9, superLargePct: 65, largePct: 27, industry: '电池' },
    { code: '300308', name: '中际旭创', price: 168.5, changePct: 20.01, mainNetInflow: 1.52e10, mainNetInflowPct: 12.3, superLarge: 9e9, large: 4.5e9, medium: 1.7e9, small: -0.5e9, superLargePct: 59, largePct: 30, industry: '通信设备' },
    { code: '688256', name: '寒武纪', price: 528.3, changePct: 20.0, mainNetInflow: 1.38e10, mainNetInflowPct: 15.2, superLarge: 8e9, large: 4.2e9, medium: 1.6e9, small: -0.8e9, superLargePct: 58, largePct: 30, industry: '半导体' },
    { code: '002371', name: '北方华创', price: 425.6, changePct: 10.01, mainNetInflow: 1.15e10, mainNetInflowPct: 9.8, superLarge: 7e9, large: 3.5e9, medium: 1e9, small: -0.5e9, superLargePct: 61, largePct: 30, industry: '半导体' },
    { code: '300502', name: '新易盛', price: 92.3, changePct: 20.0, mainNetInflow: 9.8e9, mainNetInflowPct: 14.5, superLarge: 5.8e9, large: 3e9, medium: 1e9, small: -0.4e9, superLargePct: 59, largePct: 31, industry: '通信设备' },
    { code: '600893', name: '航发动力', price: 48.5, changePct: 10.01, mainNetInflow: 7.5e9, mainNetInflowPct: 7.2, superLarge: 4.5e9, large: 2.2e9, medium: 0.8e9, small: -0.3e9, superLargePct: 60, largePct: 29, industry: '航空装备' },
    { code: '002475', name: '立讯精密', price: 42.8, changePct: 10.02, mainNetInflow: 6.8e9, mainNetInflowPct: 6.5, superLarge: 4e9, large: 2e9, medium: 0.8e9, small: -0.2e9, superLargePct: 59, largePct: 29, industry: '消费电子' },
    { code: '688122', name: '西部超导', price: 68.2, changePct: 20.0, mainNetInflow: 5.5e9, mainNetInflowPct: 11.8, superLarge: 3.2e9, large: 1.6e9, medium: 0.7e9, small: -0.3e9, superLargePct: 58, largePct: 29, industry: '军工材料' },
    { code: '300124', name: '汇川技术', price: 68.5, changePct: 8.5, mainNetInflow: 4.8e9, mainNetInflowPct: 5.2, superLarge: 2.8e9, large: 1.4e9, medium: 0.6e9, small: -0.2e9, superLargePct: 58, largePct: 29, industry: '自动化设备' },
    { code: '688027', name: '国盾量子', price: 32.5, changePct: 15.2, mainNetInflow: 3.2e9, mainNetInflowPct: 9.5, superLarge: 1.8e9, large: 0.9e9, medium: 0.5e9, small: -0.1e9, superLargePct: 56, largePct: 28, industry: '通信设备' }
  ];

  const stockFundOutflow = [
    { code: '600048', name: '保利发展', price: 8.5, changePct: -10.02, mainNetInflow: -8.5e9, mainNetInflowPct: -6.8, superLarge: -5e9, large: -2.5e9, medium: -1e9, small: 0.5e9, superLargePct: 59, largePct: 29, industry: '房地产' },
    { code: '001979', name: '招商蛇口', price: 7.8, changePct: -10.01, mainNetInflow: -6.2e9, mainNetInflowPct: -5.5, superLarge: -3.6e9, large: -1.8e9, medium: -0.8e9, small: 0.4e9, superLargePct: 58, largePct: 29, industry: '房地产' },
    { code: '600519', name: '贵州茅台', price: 1485.2, changePct: -2.85, mainNetInflow: -5.8e9, mainNetInflowPct: -3.2, superLarge: -3.4e9, large: -1.6e9, medium: -0.8e9, small: 0.4e9, superLargePct: 59, largePct: 28, industry: '白酒' },
    { code: '000858', name: '五粮液', price: 132.5, changePct: -3.12, mainNetInflow: -4.5e9, mainNetInflowPct: -4.1, superLarge: -2.6e9, large: -1.3e9, medium: -0.6e9, small: 0.3e9, superLargePct: 58, largePct: 29, industry: '白酒' },
    { code: '601318', name: '中国平安', price: 45.8, changePct: -2.45, mainNetInflow: -3.8e9, mainNetInflowPct: -2.8, superLarge: -2.2e9, large: -1.1e9, medium: -0.5e9, small: 0.3e9, superLargePct: 58, largePct: 29, industry: '保险' }
  ];

  return {
    timestamp: new Date().toISOString(),
    status: 'demo',
    isMock: true,
    marketIndex, globalMarket, sectorRank, sectorFundFlow,
    northbound: { latest: nbLatest, series: nbSeries },
    limitUp, limitDown, stockFundInflow, stockFundOutflow
  };
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
