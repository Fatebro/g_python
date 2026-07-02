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

// ===== 四大思路时间颗粒度对齐表 =====
// 不同投资思路对应不同数据周期，避免用短期数据做长期决策
const TIME_HORIZONS = {
  rotation:    { label: '1天-1周',  scope: '当日资金流向 + 5日主力净流入', thought: '思路①板块轮动', desc: '跟着资金走，换仓快' },
  signal:      { label: '1周-1月',  scope: '价格趋势 + 行业景气度', thought: '思路②身边反常信号', desc: '发现结构性变化，验证趋势' },
  supplychain: { label: '1月-3月',  scope: '产能/订单/催化剂', thought: '思路③供应链狙击', desc: '找卡脖子节点，等催化剂' },
  ecology:     { label: '1年-10年', scope: '长周期产业趋势 + 链主飞轮', thought: '思路④产业生态构建', desc: '用长远眼光布局链主' }
};

// ===== 国家政策数据仓库 =====
// 政策无法实时抓取，采用静态知识库 + 受益板块映射，定期人工维护
const POLICY_DATA = {
  // 近期 + 预期政策日历
  calendar: [
    { date: '2026-07-15', title: '中央深改委会议', level: 'high', direction: '利好',
      desc: '预计审议科技体制改革、新质生产力相关文件，强调关键核心技术攻关。',
      sectors: ['半导体', 'AI算力', '军工'], horizon: '1-3年' },
    { date: '2026-07-20', title: '国务院常务会议（稳增长）', level: 'high', direction: '利好',
      desc: '部署扩内需、稳地产、促消费举措，专项债发行提速。',
      sectors: ['房地产', '基建', '消费', '建材'], horizon: '3-6月' },
    { date: '2026-08-01', title: '央行MLF/利率决议', level: 'medium', direction: '待定',
      desc: '关注流动性投放力度，若降息利好成长股估值修复。',
      sectors: ['银行', '券商', '成长股'], horizon: '1-3月' },
    { date: '2026-08-15', title: '半导体税收优惠到期评估', level: 'high', direction: '利好',
      desc: '国产半导体企业税收优惠延续政策评估，影响设备/材料公司利润。',
      sectors: ['半导体', '光刻机', '半导体材料'], horizon: '1年' },
    { date: '2026-09-01', title: '低空经济实施方案落地', level: 'high', direction: '利好',
      desc: '各地低空经济示范区方案密集落地，eVTOL适航认证推进。',
      sectors: ['低空经济', '无人机', '碳纤维'], horizon: '1-2年' },
    { date: '2026-09-15', title: '医保谈判/集采', level: 'medium', direction: '中性偏空',
      desc: '创新药医保谈判降价幅度关注，CXO订单价格压力。',
      sectors: ['创新药', 'CXO', '医疗器械'], horizon: '6月' },
    { date: '2026-10-01', title: '十四五收官 + 十五五规划征求意见', level: 'high', direction: '利好',
      desc: '十五五规划重点方向征求意见，新质生产力、安全发展主线。',
      sectors: ['AI算力', '半导体', '新能源', '军工', '低空经济'], horizon: '5年' },
    { date: '2026-12-01', title: '中央经济工作会议', level: 'high', direction: '待定',
      desc: '定调明年经济工作总基调，财政/货币政策取向。',
      sectors: ['全市场'], horizon: '1年' }
  ],
  // 长期政策主线 + 受益板块
  mainlines: [
    { name: '新质生产力', icon: '🚀', intensity: '强', horizon: '5-10年',
      desc: '中央经济工作会议首要任务，科技创新驱动生产力跃升。',
      sectors: ['AI算力', '半导体', '人形机器人', '低空经济', '量子计算'],
      stocks: '中际旭创、北方华创、寒武纪、科大讯飞' },
    { name: '国产替代/自主可控', icon: '🛡️', intensity: '强', horizon: '3-5年',
      desc: '关键核心技术攻关，半导体、工业软件、高端机床国产化。',
      sectors: ['半导体', '光刻机', 'EDA', '高端机床', '工业软件'],
      stocks: '北方华创、中微公司、华大九天、科德数控' },
    { name: '能源安全/双碳', icon: '🌱', intensity: '中强', horizon: '5-10年',
      desc: '新型电力系统建设，新能源消纳，储能规模化。',
      sectors: ['光伏', '风电', '储能', '核电', '特高压'],
      stocks: '宁德时代、隆基绿能、阳光电源、特变电工' },
    { name: '扩内需/促消费', icon: '🛒', intensity: '中', horizon: '6月-1年',
      desc: '以旧换新、消费品下乡，稳定房地产与消费基本盘。',
      sectors: ['家电', '汽车', '消费', '房地产', '建材'],
      stocks: '美的集团、比亚迪、海尔智家、保利发展' },
    { name: '国防安全/装备放量', icon: '✈️', intensity: '强', horizon: '5-10年',
      desc: '建军百年奋斗目标，装备列装加速，军工现代化。',
      sectors: ['军工', '航空发动机', '军工电子', '新材料'],
      stocks: '航发动力、中航沈飞、振华科技、西部超导' },
    { name: '数据要素/数字经济', icon: '💾', intensity: '中强', horizon: '3-5年',
      desc: '数据资产入表、数据交易、AI+千行百业。',
      sectors: ['AI算力', '数据中心', '数据要素', '信创'],
      stocks: '易华录、深桑达、浪潮信息、中科曙光' }
  ]
};

// ===== 未来板块前瞻仓库 =====
// 不是看今天的产业链，而是3-5年后的产业方向（思路④长远布局）
const FUTURE_SECTORS = [
  {
    name: '固态电池', icon: '🔋', stage: '产业化前夕',
    horizon: '2026-2028', maturity: 65, layoutTime: '当下分批布局',
    desc: '能量密度突破500Wh/kg，解决安全与续航痛点，是锂电池下一代革命。',
    catalyst: '丰田/宁德/卫蓝中试线投产、车企搭载上车',
    stocks: '宁德时代、卫蓝新能源、赣锋锂业、当升科技、上海洗霸',
    relatedChain: 'newenergy'
  },
  {
    name: '人形机器人', icon: '🤖', stage: '量产元年',
    horizon: '2026-2030', maturity: 45, layoutTime: '关注特斯拉Optimus量产进度',
    desc: 'AI大模型赋能+硬件成本下降，人形机器人从实验室走向工厂。',
    catalyst: '特斯拉Optimus量产、宇树/智元订单、政策支持',
    stocks: '绿的谐波、汇川技术、三花智控、鸣志电器、双环传动',
    relatedChain: 'ai'
  },
  {
    name: '低空经济', icon: '🚁', stage: '政策催化期',
    horizon: '2025-2028', maturity: 55, layoutTime: '政策落地密集期',
    desc: 'eVTOL+无人机+通用航空，万亿级新赛道，各地示范区密集落地。',
    catalyst: 'eVTOL适航认证、空域开放、采购订单',
    stocks: '亿航智能、中信海直、纵横股份、光威复材、卧龙电驱',
    relatedChain: 'military'
  },
  {
    name: '商业航天', icon: '🚀', stage: '火箭复用突破期',
    horizon: '2025-2030', maturity: 40, layoutTime: '可回收火箭验证成功后',
    desc: '卫星互联网+可回收火箭，对标SpaceX，国产商业航天进入快车道。',
    catalyst: '朱雀/双曲线可回收火箭、星网组网发射',
    stocks: '航天电器、铖昌科技、斯瑞新材、中国卫通、中科星图',
    relatedChain: 'military'
  },
  {
    name: '可控核聚变', icon: '⚛️', stage: '实验堆阶段',
    horizon: '2030-2040', maturity: 20, layoutTime: '超长期观察',
    desc: '终极能源方案，AI助力等离子体约束突破，BEST/CFETR实验堆推进。',
    catalyst: 'AI+聚变突破、BEST建成放电、私人聚变公司融资',
    stocks: '西部超导、永鼎股份、国光电气、安泰科技',
    relatedChain: 'newenergy'
  },
  {
    name: '脑机接口', icon: '🧠', stage: '临床突破期',
    horizon: '2026-2035', maturity: 30, layoutTime: '临床获批催化',
    desc: 'Neuralink+国内梯队临床推进，医疗应用先行，消费级远期。',
    catalyst: 'Neuralink大规模人体试验、国内临床获批',
    stocks: '脑虎科技(未上市)、迈普医学、三博脑科、创新医疗',
    relatedChain: 'pharma'
  },
  {
    name: '量子计算', icon: '🔢', stage: 'NISQ era→纠错',
    horizon: '2028-2035', maturity: 25, layoutTime: '超长期观察',
    desc: '量子纠错突破临界点，AI+量子混合计算，超导/离子阱路线竞赛。',
    catalyst: 'IBM 1000+比特、国内"祖冲之"升级、纠错里程碑',
    stocks: '国盾量子、本源量子(未上市)、科大国创、光迅科技',
    relatedChain: 'ai'
  },
  {
    name: '6G通信', icon: '📡', stage: '标准制定期',
    horizon: '2028-2035', maturity: 25, layoutTime: '标准冻结后',
    desc: '太赫兹+星地融合+通感一体，6G标准2030年前后冻结。',
    catalyst: 'ITU/3GPP标准推进、太赫兹芯片突破、星地互联验证',
    stocks: '中兴通讯、信科移动、烽火通信、盛路通信',
    relatedChain: 'ai'
  }
];

// 产业生态状态：按「未来板块」切换，独立于产业链传导面板
let currentFutureSector = '固态电池';

// 未来板块产业生态数据仓库（链主/飞轮/投资动向/案例/建议）
// 注意：未来板块多为尚未完全成形的产业，部分标的为未上市或潜在链主
const FUTURE_DETAIL = {
  '固态电池': {
    leaders: [
      { industry: '固态电池', name: '宁德时代', code: '300750', marketCap: '1.2万亿', revenue: '4000亿+', growth: '+40%', status: '潜在链主' },
      { industry: '固态电池', name: '卫蓝新能源', code: '未上市', marketCap: '独角兽', revenue: '中试', growth: 'N/A', status: '技术领先' },
      { industry: '固态电解质', name: '上海洗霸', code: '603200', marketCap: '80亿', revenue: '5亿', growth: '+30%', status: '材料突破' }
    ],
    flywheelCompanies: ['宁德时代（电池）', '卫蓝新能源（固态）', '当升科技（正极）', '上海洗霸（电解质）'],
    investments: [
      { leader: '宁德时代', direction: '固态电解质 / 正极', targets: ['卫蓝新能源', '当升科技', '容百科技'], note: '宁德投资固态电解质路线，全固态预计2027年小批量量产。' },
      { leader: '丰田', direction: '硫化物电解质', targets: ['宁德时代', '赣锋锂业'], note: '丰田全固态专利全球第一，2027-2028年装车，带动国内供应链。' }
    ],
    cases: [
      { region: '北京 · 固态电池生态', title: '卫蓝新能源+蔚来半固态首发', desc: '卫蓝新能源360Wh/kg半固态电池搭载蔚来ET7，国内首批半固态量产上车，带动固态电解质、锂金属负极产业链。', companies: '卫蓝新能源、蔚来、当升科技、上海洗霸' }
    ],
    advice: [
      '固态电池是锂电池下一代革命，能量密度突破500Wh/kg，解决安全与续航痛点。',
      '布局时点：2026-2028年产业化前夕，关注中试线投产与车企搭载进度。',
      '验证方法：跟踪宁德/卫蓝/丰田中试线、车企装车公告、固态电解质量产数据。'
    ]
  },
  '人形机器人': {
    leaders: [
      { industry: '谐波减速器', name: '绿的谐波', code: '688017', marketCap: '150亿', revenue: '5亿', growth: '+40%', status: '核心关节' },
      { industry: '伺服/控制', name: '汇川技术', code: '300124', marketCap: '1800亿', revenue: '300亿', growth: '+30%', status: '潜在链主' },
      { industry: '热管理', name: '三花智控', code: '002050', marketCap: '700亿', revenue: '250亿', growth: '+20%', status: '配套' }
    ],
    flywheelCompanies: ['特斯拉Optimus', '绿的谐波（减速器）', '汇川技术（伺服）', '三花智控（热管理）'],
    investments: [
      { leader: '特斯拉', direction: '关节 / 传感器 / 丝杠', targets: ['绿的谐波', '三花智控', '双环传动', '鸣志电器'], note: 'Optimus量产带动谐波减速器、行星滚柱丝杠、空心杯电机订单爆发。' },
      { leader: '国内整机(宇树/智元)', direction: '国产供应链', targets: ['汇川技术', '绿的谐波', '中大力德'], note: '国产人形机器人订单放量，带动国产关节模组替代。' }
    ],
    cases: [
      { region: '苏州/深圳 · 机器人生态', title: '绿的谐波+汇川构筑关节模组生态', desc: '以绿的谐波（减速器）、汇川（伺服）为核心的关节模组供应链，联动电机、传感器、丝杠企业，形成国产人形机器人硬件底座。', companies: '绿的谐波、汇川技术、三花智控、双环传动' }
    ],
    advice: [
      '人形机器人从实验室走向工厂，AI大模型赋能+硬件成本下降是关键。',
      '布局时点：2026年量产元年，关注特斯拉Optimus量产进度与国内整机订单。',
      '验证方法：跟踪Optimus产量、宇树/智元融资与订单、关节模组国产化率。'
    ]
  },
  '低空经济': {
    leaders: [
      { industry: 'eVTOL整机', name: '亿航智能', code: 'EH(美股)', marketCap: '15亿美元', revenue: '千万级', growth: '+100%', status: '链主' },
      { industry: '通航运营', name: '中信海直', code: '000099', marketCap: '120亿', revenue: '20亿', growth: '+15%', status: '运营龙头' },
      { industry: '无人机整机', name: '纵横股份', code: '688070', marketCap: '50亿', revenue: '5亿', growth: '+25%', status: '无人机' }
    ],
    flywheelCompanies: ['亿航智能（eVTOL）', '中信海直（运营）', '光威复材（碳纤维）', '卧龙电驱（电机）'],
    investments: [
      { leader: '亿航智能', direction: '机身 / 动力 / 航电', targets: ['光威复材', '卧龙电驱', '纵横股份'], note: 'eVTOL量产带动碳纤维机身、电驱系统、航电设备订单。' },
      { leader: '地方政府', direction: '基建 / 空域', targets: ['中信海直', '莱斯信息'], note: '各地示范区采购+空管基建，催生运营与空管系统需求。' }
    ],
    cases: [
      { region: '合肥/深圳 · 低空生态', title: '亿航+政府示范区驱动低空集群', desc: '亿航EH216-S获全球首张适航证，合肥/深圳/广州示范区密集落地，带动碳纤维、电机、空管、运营全链条。', companies: '亿航智能、中信海直、纵横股份、光威复材' }
    ],
    advice: [
      '低空经济是万亿级新赛道，eVTOL+无人机+通用航空，政策催化密集。',
      '布局时点：政策落地密集期（2025-2028），关注适航认证与采购订单。',
      '验证方法：跟踪eVTOL适航认证、空域开放政策、政府采购订单。'
    ]
  },
  '商业航天': {
    leaders: [
      { industry: '火箭制造', name: '航天电器', code: '002025', marketCap: '300亿', revenue: '60亿', growth: '+20%', status: '配套龙头' },
      { industry: '卫星互联网', name: '中国卫通', code: '601698', marketCap: '400亿', revenue: '30亿', growth: '+10%', status: '运营' },
      { industry: '星载TR', name: '铖昌科技', code: '001270', marketCap: '80亿', revenue: '3亿', growth: '+30%', status: '芯片' }
    ],
    flywheelCompanies: ['蓝箭/双曲线（火箭）', '航天电器（连接器）', '铖昌科技（TR芯片）', '中国卫通（运营）'],
    investments: [
      { leader: '民营火箭(蓝箭/双曲线)', direction: '发动机 / 复材 / 电子', targets: ['航天电器', '斯瑞新材', '铖昌科技'], note: '可回收火箭验证带动发动机、高温合金、星载电子订单。' },
      { leader: '星网集团', direction: '卫星制造 / 运营', targets: ['中国卫通', '中科星图', '铖昌科技'], note: '星网组网发射催生卫星制造、地面站、运营服务需求。' }
    ],
    cases: [
      { region: '北京/西安 · 商业航天生态', title: '星网+蓝箭构筑商业航天链', desc: '以星网集团（卫星互联网）、蓝箭/双曲线（可回收火箭）为双链主，联动航天电器、铖昌科技、斯瑞新材，形成商业航天全链条。', companies: '航天电器、铖昌科技、中国卫通、斯瑞新材' }
    ],
    advice: [
      '商业航天对标SpaceX，可回收火箭+卫星互联网是核心。',
      '布局时点：可回收火箭验证成功后（2025-2027），星网组网发射期。',
      '验证方法：跟踪朱雀/双曲线可回收试验、星网发射节奏、卫星招标。'
    ]
  },
  '可控核聚变': {
    leaders: [
      { industry: '高温超导', name: '西部超导', code: '688122', marketCap: '300亿', revenue: '40亿', growth: '+25%', status: '磁体材料' },
      { industry: '超导带材', name: '永鼎股份', code: '600105', marketCap: '60亿', revenue: '30亿', growth: '+15%', status: '带材' },
      { industry: '聚变装置', name: '国光电气', code: '688776', marketCap: '60亿', revenue: '10亿', growth: '+20%', status: '配套' }
    ],
    flywheelCompanies: ['BEST/CFETR（装置）', '西部超导（超导磁体）', '永鼎股份（带材）', '安泰科技（偏滤器）'],
    investments: [
      { leader: '中科院等离子体所', direction: '超导 / 偏滤器 / 电源', targets: ['西部超导', '安泰科技', '国光电气'], note: 'BEST/CFETR建设带动高温超导磁体、偏滤器、特种电源订单。' },
      { leader: '私人聚变(能量奇点等)', direction: '高温超导带材', targets: ['永鼎股份', '西部超导'], note: '私人聚变公司采用高温超导路线，催生REBCO带材需求。' }
    ],
    cases: [
      { region: '合肥 · 聚变生态', title: '科学岛+能量奇点驱动聚变链', desc: '以中科院等离子体所（EAST/BEST）、能量奇点（私人聚变）为核心，联动西部超导、永鼎股份、安泰科技，形成聚变装置材料与部件产业链。', companies: '西部超导、永鼎股份、国光电气、安泰科技' }
    ],
    advice: [
      '可控核聚变是终极能源，AI助力等离子体约束突破，BEST/CFETR推进。',
      '布局时点：超长期观察（2030-2040），关注AI+聚变突破与实验堆放电。',
      '验证方法：跟踪BEST建成放电、Q值突破、私人聚变融资与里程碑。'
    ]
  },
  '脑机接口': {
    leaders: [
      { industry: '侵入式电极', name: '脑虎科技', code: '未上市', marketCap: '独角兽', revenue: '研发', growth: 'N/A', status: '技术领先' },
      { industry: '神外医疗', name: '三博脑科', code: '301293', marketCap: '50亿', revenue: '15亿', growth: '+15%', status: '临床' },
      { industry: '脑膜修复', name: '迈普医学', code: '301033', marketCap: '40亿', revenue: '3亿', growth: '+20%', status: '耗材' }
    ],
    flywheelCompanies: ['Neuralink', '脑虎科技（电极）', '三博脑科（临床）', '迈普医学（耗材）'],
    investments: [
      { leader: 'Neuralink', direction: '芯片 / 电极 / 手术机器人', targets: ['脑虎科技', '迈普医学'], note: 'Neuralink大规模人体试验带动国内侵入式电极与手术机器人产业链。' },
      { leader: '国内梯队(脑虎/微灵医疗)', direction: '临床 / 神外耗材', targets: ['三博脑科', '迈普医学', '创新医疗'], note: '国内临床获批推进，催生神外临床与耗材需求。' }
    ],
    cases: [
      { region: '上海/北京 · 脑机生态', title: '脑虎+三博脑科构建脑机临床链', desc: '以脑虎科技（柔性电极）、三博脑科（神外临床）为核心，联动神经调控、脑机芯片、神外耗材企业，形成脑机接口临床应用生态。', companies: '脑虎科技、三博脑科、迈普医学、创新医疗' }
    ],
    advice: [
      '脑机接口医疗应用先行，消费级远期，Neuralink+国内梯队临床推进。',
      '布局时点：临床获批催化（2026-2030），关注国内临床进度。',
      '验证方法：跟踪Neuralink人体试验规模、国内临床获批、电极技术指标。'
    ]
  },
  '量子计算': {
    leaders: [
      { industry: '量子通信', name: '国盾量子', code: '688027', marketCap: '80亿', revenue: '4亿', growth: '+30%', status: '链主' },
      { industry: '量子计算(超导)', name: '本源量子', code: '未上市', marketCap: '独角兽', revenue: '研发', growth: 'N/A', status: '技术领先' },
      { industry: '量子软件', name: '科大国创', code: '300520', marketCap: '50亿', revenue: '20亿', growth: '+10%', status: '软件' }
    ],
    flywheelCompanies: ['本源量子（超导）', '国盾量子（通信）', '科大国创（软件）', '光迅科技（光器件）'],
    investments: [
      { leader: '本源量子', direction: '低温 / 测控 / 芯片', targets: ['国盾量子', '光迅科技', '科大国创'], note: '超导量子计算机量产带动低温制冷、测控系统、量子芯片需求。' },
      { leader: '中科大系', direction: '量子通信网络', targets: ['国盾量子', '光迅科技'], note: '量子通信干线与卫星网络建设，催生量子密钥分发设备。' }
    ],
    cases: [
      { region: '合肥 · 量子生态', title: '中科大系+本源/国盾构建量子链', desc: '以中科大系技术孵化为核心，本源量子（超导计算）、国盾量子（量子通信）为双链主，联动低温、测控、软件企业，形成量子科技全链条。', companies: '国盾量子、本源量子、科大国创、光迅科技' }
    ],
    advice: [
      '量子计算处于NISQ→纠错过渡期，AI+量子混合计算是近期方向。',
      '布局时点：超长期观察（2028-2035），关注纠错里程碑。',
      '验证方法：跟踪IBM/谷歌比特数、国内祖冲之升级、纠错Q值突破。'
    ]
  },
  '6G通信': {
    leaders: [
      { industry: '通信主设备', name: '中兴通讯', code: '000063', marketCap: '1500亿', revenue: '1200亿', growth: '+10%', status: '链主' },
      { industry: '基站/射频', name: '信科移动', code: '688387', marketCap: '300亿', revenue: '80亿', growth: '+15%', status: '设备' },
      { industry: '通信器件', name: '光迅科技', code: '002281', marketCap: '150亿', revenue: '60亿', growth: '+20%', status: '光器件' }
    ],
    flywheelCompanies: ['中兴通讯（主设备）', '信科移动（基站）', '烽火通信（传输）', '光迅科技（光器件）'],
    investments: [
      { leader: '中兴通讯', direction: '射频 / 基带 / 光器件', targets: ['信科移动', '光迅科技', '盛路通信'], note: '6G原型机研发带动太赫兹射频、基带芯片、光器件需求。' },
      { leader: '运营商', direction: '传输 / 卫星互联', targets: ['烽火通信', '中国卫通'], note: '星地融合组网催生传输设备与卫星互联网需求。' }
    ],
    cases: [
      { region: '武汉/深圳 · 6G生态', title: '信科+中兴构筑6G设备链', desc: '以信科移动（基站/射频）、中兴通讯（主设备）为核心，联动烽火通信（传输）、光迅科技（光器件），形成6G通信设备产业链。', companies: '中兴通讯、信科移动、烽火通信、光迅科技' }
    ],
    advice: [
      '6G通信处于标准制定期，太赫兹+星地融合+通感一体是核心。',
      '布局时点：标准冻结后（2030前后），关注标准推进与太赫兹突破。',
      '验证方法：跟踪ITU/3GPP标准、太赫兹芯片突破、星地互联验证。'
    ]
  }
};

// ===== 通用工具 =====
function $(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn('[WARN] 元素不存在:', id);
    return {
      innerHTML: '', textContent: '', value: '',
      style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      getContext() { return null; },
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; },
      appendChild() {},
      scrollIntoView() {}
    };
  }
  return el;
}

function fmtPct(n) { return API.formatPct(n); }
function fmtAmt(n) { return API.formatAmount(n); }

function formatTime24(d) {
  if (!d) d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${hh}:${mm}:${ss}`;
}

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

// ===== 1b. 全球市场概览（顶部合并展示 + 全球资金流向分析）=====
function renderGlobalMarket(data) {
  if (!data || !data.length) return;

  // 渲染全球指数卡片（顶部）
  const topContainer = $('global-market-grid-top');
  if (topContainer) {
    topContainer.innerHTML = data.map(idx => `
      <div class="index-card">
        <div class="idx-name">${idx.name}</div>
        <div class="idx-price ${pctClass(idx.changePct)}">${idx.price != null ? idx.price.toFixed(2) : '--'}</div>
        <div class="idx-change ${pctClass(idx.changePct)}">${fmtPct(idx.changePct)} ${idx.change != null ? (idx.change >= 0 ? '+' : '') + idx.change.toFixed(2) : ''}</div>
      </div>
    `).join('');
  }
  // 兼容旧容器
  const oldContainer = $('global-market-grid');
  if (oldContainer) {
    oldContainer.innerHTML = '';
    oldContainer.style.display = 'none';
  }

  // 外围环境分析
  const us = data.filter(d => ['DJIA', 'SPX', 'NDX'].includes(d.code));
  const asia = data.filter(d => ['HSI', 'N225'].includes(d.code));
  const gold = data.find(d => d.code === 'XAU');

  const lines = [];

  // 美股走势
  if (us.length) {
    const usUpCount = us.filter(d => d.changePct >= 0).length;
    const usStr = us.map(d => `${d.name}${fmtPct(d.changePct)}`).join('、');
    lines.push(`<p><strong>美股方面：</strong>${usStr}。${usUpCount >= 2 ? '美股整体偏强，科技股方向活跃，外围风险偏好回升，利好A股开盘情绪。' : usUpCount === 0 ? '美股集体下跌，外围避险情绪升温，需关注对A股的传导压力。' : '美股走势分化，市场方向不明确，A股更多依赖自身逻辑。'}</p>`);
  }

  // 亚太市场
  if (asia.length) {
    const asiaStr = asia.map(d => `${d.name}${fmtPct(d.changePct)}`).join('、');
    const hsi = data.find(d => d.code === 'HSI');
    let asiaNote = '';
    if (hsi) {
      asiaNote = hsi.changePct > 1 ? '恒生强势，港股资金面改善，南向资金活跃度可能提升。' :
                 hsi.changePct < -1 ? '恒生走弱，港股承压，关注港股通资金流向变化。' :
                 '港股波动不大，对A股影响有限。';
    }
    lines.push(`<p><strong>亚太市场：</strong>${asiaStr}。${asiaNote}</p>`);
  }

  // 黄金
  if (gold) {
    const goldDir = gold.changePct >= 0 ? '上涨' : '下跌';
    let goldNote = '';
    if (gold.changePct > 1) goldNote = '黄金大幅上涨，全球避险情绪升温，利好黄金板块，但压制风险资产偏好。';
    else if (gold.changePct < -1) goldNote = '黄金下跌，避险需求减弱，资金可能流向风险资产。';
    else goldNote = '黄金波动不大，市场情绪相对平稳。';
    lines.push(`<p><strong>黄金：</strong>COMEX黄金报 ${gold.price.toFixed(2)} 美元/盎司，${goldDir} ${fmtPct(gold.changePct)}，${goldNote}</p>`);
  }

  // 全球风险偏好综合判断
  const usUpCount = us.filter(d => d.changePct >= 0).length;
  const goldUp = gold && gold.changePct > 0.5;
  let riskAppetite = '';
  let riskClass = '';
  if (usUpCount >= 2 && !goldUp) {
    riskAppetite = '全球风险偏好回升（美股走强+黄金未大涨），外围环境偏多，有利于外资流入A股。';
    riskClass = 'up';
  } else if (usUpCount <= 1 && goldUp) {
    riskAppetite = '全球避险情绪升温（美股走弱+黄金大涨），需警惕外资阶段性流出A股。';
    riskClass = 'down';
  } else if (usUpCount >= 2 && goldUp) {
    riskAppetite = '美股与黄金同涨，可能反映通胀预期或流动性宽松预期，对A股影响偏中性偏多。';
    riskClass = 'neutral';
  } else {
    riskAppetite = '外围市场信号不一，A股走势更多取决于国内基本面和资金面。';
    riskClass = 'neutral';
  }
  lines.push(`<p><strong style="color: var(--accent);">外围环境综合研判：</strong><span class="${riskClass}">${riskAppetite}</span></p>`);

  // 旧分析容器兼容
  const gaEl = $('global-analysis');
  if (gaEl) {
    gaEl.innerHTML = lines.join('');
    const aShareLines = generateGlobalAShareView(data);
    gaEl.innerHTML += '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);"></div>' + aShareLines.join('');
  }

  // 顶部全球资金流向分析（简洁版 + 受益板块标签）
  const gffEl = $('global-fund-flow');
  if (gffEl) {
    const gffContent = buildGlobalFundFlowSummary(data, riskClass, riskAppetite);
    gffEl.querySelector('.gff-content').innerHTML = gffContent;
  }
}

// 构建顶部全球资金流向摘要（简洁 + 板块标签）
function buildGlobalFundFlowSummary(globalData, riskClass, riskAppetite) {
  const d = currentData;
  const us = globalData.filter(x => ['DJIA', 'SPX', 'NDX'].includes(x.code));
  const gold = globalData.find(x => x.code === 'XAU');
  const hsi = globalData.find(x => x.code === 'HSI');
  const usUpCount = us.filter(x => x.changePct >= 0).length;
  const nb = d?.northbound?.latest;
  const vix = d?.globalVix || 20;

  const lines = [];
  lines.push(`<p><span class="${riskClass}" style="font-weight:600;">${riskAppetite}</span></p>`);

  let inflowSectors = [];
  let outflowSectors = [];
  if (usUpCount >= 2 && !(gold && gold.changePct > 1)) {
    inflowSectors = ['AI算力', '半导体', '新能源', '消费龙头', '券商'];
    lines.push(`<p>💹 全球风险偏好回升 → 外资有望流入，重点关注：</p>`);
  } else if (gold && gold.changePct > 0.8) {
    inflowSectors = ['黄金', '贵金属', '公用事业', '医药生物'];
    outflowSectors = ['成长股', '科技股', '新能源'];
    lines.push(`<p>🛡️ 全球避险升温 → 资金流向防御，重点关注：</p>`);
  } else {
    inflowSectors = ['AI算力', '高股息'];
    lines.push(`<p>⚖️ 全球资金观望 → 结构性机会为主，关注：</p>`);
  }

  if (inflowSectors.length) {
    lines.push(`<div class="gff-sectors">${inflowSectors.map(s => `<span class="gff-sector-tag gff-sector-click" data-sector="${s}">📈 ${s}</span>`).join('')}</div>`);
  }
  if (outflowSectors.length) {
    lines.push(`<div class="gff-sectors" style="margin-top:4px;">${outflowSectors.map(s => `<span class="gff-sector-tag gff-sector-click" style="background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.2);" data-sector="${s}">📉 ${s}</span>`).join('')}</div>`);
  }

  lines.push(`<p style="margin-top:8px;font-size:11px;color:var(--text-dim);"><strong>🔗 传导路径：</strong></p>`);
  if (vix > 25) {
    lines.push(`<p style="font-size:11px;color:var(--text-dim);">VIX↑ → 全球风险偏好↓ → 外资流出A股 → 成长股估值承压 → 防御板块相对收益</p>`);
  } else if (vix < 15) {
    lines.push(`<p style="font-size:11px;color:var(--text-dim);">VIX↓ → 全球风险偏好↑ → 外资流入A股 → 成长股估值修复 → 顺周期板块受益</p>`);
  } else {
    lines.push(`<p style="font-size:11px;color:var(--text-dim);">VIX中性 → 全球资金观望 → A股结构性行情 → 精选个股为主</p>`);
  }

  lines.push(`<p style="margin-top:6px;font-size:11px;color:var(--text-dim);"><strong>🛡️ 对冲策略建议：</strong>${vix > 25 ? '建议启用股指期货对冲，对冲比例30-50%，增持黄金和国债' : vix > 18 ? '适度对冲，对冲比例10-20%，保持灵活性' : '无需对冲，保持积极仓位，聚焦alpha收益'}</p>`);

  if (nb) {
    lines.push(`<p style="margin-top:6px;font-size:11px;color:var(--text-muted);">北向资金当日：<span class="${nb.total >= 0 ? 'up' : 'down'}">${nb.total >= 0 ? '+' : ''}${nb.total.toFixed(2)}亿</span> · 沪股通 ${nb.sh >= 0 ? '+' : ''}${nb.sh.toFixed(1)}亿 · 深股通 ${nb.sz >= 0 ? '+' : ''}${nb.sz.toFixed(1)}亿</p>`);
  }
  const html = lines.join('');
  setTimeout(() => {
    document.querySelectorAll('.gff-sector-click').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const sector = el.dataset.sector;
        const tabBtn = document.querySelector('.tab-btn[data-tab="sector"]');
        if (tabBtn) tabBtn.click();
        selectSector(sector);
      });
    });
  }, 50);
  return html;
}

function generateGlobalAShareView(globalData) {
  const lines = [];
  const d = currentData;
  if (!d) return ['<div class="empty-tip">数据加载中...</div>'];

  const us = globalData.filter(x => ['DJIA', 'SPX', 'NDX'].includes(x.code));
  const gold = globalData.find(x => x.code === 'XAU');
  const hsi = globalData.find(x => x.code === 'HSI');
  const usUpCount = us.filter(x => x.changePct >= 0).length;

  // 1. 外盘对A股开盘影响
  lines.push(`<p><strong>1. 开盘影响研判：</strong></p>`);
  if (usUpCount >= 2) {
    lines.push(`<p>隔夜美股走强，A股高开概率较大。关注开盘后量能是否配合，若放量高开则短线做多氛围较好；若缩量高开则需警惕冲高回落。</p>`);
  } else if (usUpCount === 0) {
    lines.push(`<p>隔夜美股下跌，A股低开概率较大。若低开后快速企稳回升，说明A股内生支撑较强；若低开后持续走弱，则需控制仓位。</p>`);
  } else {
    lines.push(`<p>美股走势分化，对A股开盘影响有限，A股大概率按自身节奏运行。</p>`);
  }

  // 2. 外资流向预判
  lines.push(`<p><strong>2. 外资流向预判：</strong></p>`);
  const nb = d.northbound?.latest;
  if (gold && gold.changePct > 1 && nb) {
    lines.push(`<p>黄金大涨反映避险情绪升温，北向资金当日${nb.total >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.total).toFixed(2)} 亿。若外围持续避险，外资可能阶段性流出，关注消费、医药等防御性板块。</p>`);
  } else if (usUpCount >= 2 && nb) {
    lines.push(`<p>外围风险偏好回升，北向资金当日${nb.total >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.total).toFixed(2)} 亿。外资偏好核心资产，关注蓝筹白马方向。</p>`);
  } else if (nb) {
    lines.push(`<p>北向资金当日${nb.total >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.total).toFixed(2)} 亿，外资流向需结合外围变化综合判断。</p>`);
  }

  // 3. 港股联动
  lines.push(`<p><strong>3. 港股联动：</strong></p>`);
  if (hsi) {
    if (hsi.changePct > 1) {
      lines.push(`<p>恒生指数涨 ${fmtPct(hsi.changePct)}，港股强势可能带动A股相关板块（金融、地产、互联网）走强，关注AH股溢价变化。</p>`);
    } else if (hsi.changePct < -1) {
      lines.push(`<p>恒生指数跌 ${fmtPct(hsi.changePct)}，港股走弱可能拖累A股金融、地产板块，但也可能促使南向资金回流A股。</p>`);
    } else {
      lines.push(`<p>恒生指数 ${fmtPct(hsi.changePct)}，港股波动不大，AH联动效应不明显。</p>`);
    }
  }

  // 4. 操作建议
  lines.push(`<p><strong>4. 操作建议：</strong></p>`);
  if (usUpCount >= 2 && !(gold && gold.changePct > 1)) {
    lines.push(`<p>外围偏多环境，可适度积极参与，关注量能配合，重点跟踪资金流入板块。</p>`);
  } else if (usUpCount <= 1 || (gold && gold.changePct > 1)) {
    lines.push(`<p>外围环境偏弱或避险情绪升温，建议控制仓位，偏向防御，关注黄金、公用事业等避险板块。</p>`);
  } else {
    lines.push(`<p>外围信号中性，按A股自身节奏操作，关注板块轮动和资金流向。</p>`);
  }

  return lines;
}

// ===== 2. 板块轮动分析（涨跌幅排行 + 柱状图 + 可点击钻取）=====
let currentSelectedSector = null;
let userFundSize = 200; // 用户自定义资金规模（亿元），默认200亿

function renderSectorRotation(data) {
  const sectorData = (data && data.sectorRank) ? data.sectorRank : (Array.isArray(data) ? data : []);
  if (!sectorData || !sectorData.length) return;

  const top10 = [...sectorData].sort((a, b) => b.changePct - a.changePct).slice(0, 10);
  const bottom10 = [...sectorData].sort((a, b) => a.changePct - b.changePct).slice(0, 10).reverse();

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
      onClick: (e, els) => {
        if (els && els.length) {
          const idx = els[0].index;
          const name = labels[idx];
          selectSector(name);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (item) => `涨跌幅: ${fmtPct(item.raw)}（点击查看详情）`
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

  // 领涨领跌完整列表（可点击 + 可滑动）
  const sortedAll = [...sectorData].sort((a, b) => b.changePct - a.changePct);
  const topList = sortedAll.slice(0, 10);
  const botList = sortedAll.slice(-10).reverse();

  $('sector-top-list').innerHTML = topList.map((s, i) =>
    `<div class="rank-item clickable${currentSelectedSector === s.name ? ' selected' : ''}" data-sector="${s.name}">
      <span class="rank-no up">${i + 1}</span>
      <span class="rank-name">${s.name}</span>
      <span class="rank-val up">${fmtPct(s.changePct)}</span>
    </div>`
  ).join('');
  $('sector-bottom-list').innerHTML = botList.map((s, i) =>
    `<div class="rank-item clickable${currentSelectedSector === s.name ? ' selected' : ''}" data-sector="${s.name}">
      <span class="rank-no down">${i + 1}</span>
      <span class="rank-name">${s.name}</span>
      <span class="rank-val down">${fmtPct(s.changePct)}</span>
    </div>`
  ).join('');

  // 绑定点击事件
  document.querySelectorAll('#sector-top-list .clickable, #sector-bottom-list .clickable').forEach(el => {
    el.addEventListener('click', () => selectSector(el.dataset.sector));
  });
}

// ===== 2a. 板块钻取详情（选中板块后同步切换产业链）=====
function selectSector(sectorName) {
  currentSelectedSector = sectorName;
  // 更新选中态
  document.querySelectorAll('#sector-top-list .clickable, #sector-bottom-list .clickable').forEach(el => {
    el.classList.toggle('selected', el.dataset.sector === sectorName);
  });
  renderSectorDetail(sectorName);
  // ★ 三面板联动：板块 → 产业链映射，自动切换产业链拆解/产业生态
  const chainKey = sectorToChain(sectorName);
  if (chainKey && chainKey !== currentChain) {
    selectChain(chainKey);
  }
  // 滚动到详情卡
  const card = $('sector-detail-card');
  if (card && card.style.display !== 'none') {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderSectorDetail(sectorName) {
  const card = $('sector-detail-card');
  if (!card) return;
  card.style.display = 'block';
  $('sector-detail-title').textContent = `📊 ${sectorName} · 板块详情`;

  const d = currentData;
  if (!d) return;

  const chainKey = sectorToChain(sectorName) || 'ai';

  // 1) 资金趋势（该板块 + 相关板块的主力净流入）
  const fundData = d.sectorFundFlow || [];
  const target = fundData.find(s => s.name === sectorName);
  // 找相关板块（名称包含关系）
  const related = fundData.filter(s =>
    s.name !== sectorName && (
      s.name.includes(sectorName) || sectorName.includes(s.name) ||
      getRelatedSectors(sectorName).includes(s.name)
    )
  ).sort((a, b) => Math.abs(b.mainNetInflow) - Math.abs(a.mainNetInflow)).slice(0, 5);

  const fundItems = [];
  if (target) fundItems.push({ name: target.name, flow: target.mainNetInflow, isSelf: true });
  related.forEach(r => fundItems.push({ name: r.name, flow: r.mainNetInflow, isSelf: false }));

  const maxAbs = Math.max(...fundItems.map(f => Math.abs(f.flow || 0)), 1);
  $('detail-fund-trend').innerHTML = fundItems.length ? fundItems.map(f => {
    const pct = (Math.abs(f.flow) / maxAbs * 100).toFixed(0);
    const isUp = (f.flow || 0) >= 0;
    return `
      <div class="fund-trend-item">
        <span style="${f.isSelf ? 'color:var(--accent);font-weight:600;' : ''}">${f.isSelf ? '★ ' : ''}${f.name}</span>
        <div class="fund-trend-bar"><div class="fund-trend-bar-fill ${isUp ? 'up' : 'down'}" style="width:${pct}%"></div></div>
        <span class="fund-trend-amount ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${(f.flow / 1e8).toFixed(2)}亿</span>
      </div>
    `;
  }).join('') : '<div class="detail-empty">暂无资金数据</div>';

  // 2) 龙头股（从个股资金流入匹配）
  const stockData = d.stockFundInflow || [];
  const dragons = stockData.filter(s => matchSector(s, sectorName))
    .sort((a, b) => (b.mainNetInflow || 0) - (a.mainNetInflow || 0))
    .slice(0, 8);
  $('detail-dragons').innerHTML = dragons.length ? dragons.map((s, idx) => `
    <div class="detail-stock-row stock-clickable-row" data-index="${idx}" style="cursor:pointer;">
      <span class="ds-name">${idx + 1}. ${s.name}<em>${s.code}</em></span>
      <span class="ds-price">${s.price != null ? s.price.toFixed(2) : '--'}</span>
      <span class="ds-pct ${s.changePct >= 0 ? 'up' : 'down'}">${fmtPct(s.changePct)}</span>
      <span class="ds-inflow ${s.mainNetInflow >= 0 ? 'up' : 'down'}">${s.mainNetInflow >= 0 ? '+' : ''}${(s.mainNetInflow / 1e8).toFixed(2)}亿</span>
    </div>
  `).join('') : '<div class="detail-empty">该板块暂无主力净流入个股数据</div>';
  // 绑定龙头股点击事件
  setTimeout(() => {
    document.querySelectorAll('#detail-dragons .stock-clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.index);
        const stock = dragons[idx];
        if (stock) {
          showStockDetail(stock);
        }
      });
    });
  }, 30);

  // 3) 链主公司（按当前产业链取，筛选与板块相关的）
  const detail = CHAIN_DETAIL[chainKey] || CHAIN_DETAIL.ai;
  const allLeaders = detail.leaders || [];
  const leaders = allLeaders.filter(l =>
    l.industry.includes(sectorName) || sectorName.includes(l.industry) ||
    l.name.includes(sectorName) || sectorName.includes(l.name) ||
    getRelatedSectors(sectorName).some(r => l.industry.includes(r) || l.name.includes(r))
  );
  const displayLeaders = leaders.length > 0 ? leaders : allLeaders.slice(0, 3);
  $('detail-leaders').innerHTML = displayLeaders.length ? displayLeaders.map((l, idx) => `
    <div class="detail-leader-row leader-clickable" data-idx="${idx}" style="cursor:pointer;">
      <div>
        <div class="dl-name">${l.name} <span style="color:var(--text-muted);font-size:11px;">${l.code}</span></div>
        <div class="dl-info">${l.industry} · 市值${l.marketCap} · 营收${l.revenue} · 增长${l.growth}</div>
      </div>
      <span class="dl-badge">链主</span>
    </div>
  `).join('') : '<div class="detail-empty">该板块暂无链主公司追踪</div>';
  // 绑定链主点击事件
  setTimeout(() => {
    document.querySelectorAll('#detail-leaders .leader-clickable').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.idx);
        const leader = displayLeaders[idx];
        if (leader) {
          const seed = (leader.code || leader.name).toString().split('').reduce((s, c) => s + c.charCodeAt(0), 0);
          const basePrice = 50 + (seed % 150);
          const changePct = ((seed % 20) - 5) / 2;
          showStockDetail({
            name: leader.name,
            code: leader.code,
            industry: leader.industry,
            price: basePrice,
            changePct: changePct,
            mainNetInflow: (seed % 5) * 1e8,
            marketCap: leader.marketCap,
            circulatingCap: leader.marketCap,
            turnoverRate: 2 + (seed % 5),
            amount: (10 + seed % 50) * 1e8,
            pe: (20 + seed % 60).toFixed(2),
            pb: (2 + (seed % 8) / 2).toFixed(2)
          });
        }
      });
    });
  }, 30);

  // 4) 卡脖子技术节点（按当前产业链取，筛选与板块相关的）
  const allBotts = detail.bottlenecks || [];
  const botts = allBotts.filter(b =>
    b.title.includes(sectorName) || sectorName.includes(b.title) ||
    b.stocks.includes(sectorName) ||
    (b.type && (sectorName.includes(b.type) || b.type.includes(sectorName))) ||
    getRelatedSectors(sectorName).some(r => b.title.includes(r) || b.stocks.includes(r))
  );
  const displayBotts = botts.length > 0 ? botts : allBotts.slice(0, 2);
  const typeClassMap2 = {
    '设备': 'type-equipment', '材料': 'type-material', '芯片': 'type-chip',
    '设计': 'type-design', '材料/芯片': 'type-chip', '材料/设备': 'type-equipment', '综合': 'type-other'
  };
  const typeIconMap2 = {
    '设备': '⚙️', '材料': '🧪', '芯片': '💾',
    '设计': '📐', '材料/芯片': '💾', '材料/设备': '⚙️', '综合': '🎯'
  };
  $('detail-bottlenecks').innerHTML = displayBotts.length ? displayBotts.map(b => {
    const type = b.type || '综合';
    const tClass = typeClassMap2[type] || 'type-other';
    const tIcon = typeIconMap2[type] || '🎯';
    return `
    <div class="detail-bott-row">
      <div class="db-title">${tIcon} ${b.title} <span class="bottleneck-tag ${tClass}" style="margin-left:6px;">环节：${type}</span></div>
      <div class="db-desc">${b.desc}</div>
      <div class="db-stocks">相关标的：${b.stocks}</div>
    </div>
  `}).join('') : '<div class="detail-empty">该板块暂无卡脖子节点</div>';
}

// 板块 → 相关板块映射（用于资金趋势联动展示）
function getRelatedSectors(sectorName) {
  const map = {
    '黄金': ['贵金属', '有色金属', '铜'],
    '贵金属': ['黄金', '有色金属', '铜'],
    '有色金属': ['黄金', '贵金属', '铜', '锂矿', '钴矿'],
    '铜': ['有色金属', '黄金', '贵金属'],
    '电力': ['公用事业', '风电', '光伏', '储能'],
    '公用事业': ['电力', '风电'],
    '风电': ['电力', '公用事业', '光伏'],
    '新能源汽车': ['电池', '汽车零部件', '锂矿', '电解液'],
    '电池': ['新能源汽车', '锂矿', '电解液', '正极材料'],
    '半导体': ['光刻胶', '靶材', '电子特气', '光刻机'],
    '光刻胶': ['半导体', '靶材', '电子特气'],
    '消费电子': ['面板', '摄像头模组', 'SoC'],
    '医药生物': ['化学制药', '创新药', '医疗器械', 'CXO'],
    '化学制药': ['医药生物', '创新药', '原料药'],
    '军工': ['高温合金', '钛合金', '航空发动机'],
    'AI算力': ['光模块', 'CPO', '光芯片', 'GPU芯片'],
    '光模块': ['AI算力', 'CPO', '光芯片'],
  };
  return map[sectorName] || [];
}

// ===== 2b. 板块联动关系（资金共振 + 产业链传导）=====
function renderSectorLinkage(data) {
  const fundData = data.sectorFundFlow || [];
  const flowMap = {};
  fundData.forEach(s => { flowMap[s.name] = s.mainNetInflow || 0; });

  // 联动组定义：核心板块 → 上下游传导链
  const linkageGroups = [
    {
      title: '避险资源链', icon: '🥇',
      chain: ['黄金', '贵金属', '有色金属', '铜'],
      desc: '黄金创新高带动贵金属、有色、铜同步走强，资金共振避险情绪。'
    },
    {
      title: '新能源资源链', icon: '🔋',
      chain: ['锂矿', '硅料', '电池', '新能源汽车', '汽车零部件'],
      desc: '上游资源价格企稳 → 电池成本下降 → 新能源车销量传导。'
    },
    {
      title: '电力公用链', icon: '⚡',
      chain: ['电力', '公用事业', '风电', '光伏', '储能'],
      desc: '高股息防御 + 新能源发电装机，资金在电力相关板块轮动。'
    },
    {
      title: 'AI算力链', icon: '🤖',
      chain: ['AI算力', '光模块', 'CPO', '光芯片', 'GPU芯片', '存储芯片'],
      desc: '下游AI应用爆发 → 中游算力 → 上游光模块/光芯片卡脖子环节传导。'
    },
    {
      title: '半导体国产替代链', icon: '🧠',
      chain: ['半导体', '光刻胶', '靶材', '电子特气', '光刻机', '刻蚀机'],
      desc: '设备→材料→制造国产替代全链条联动，政策催化+巨头认证驱动。'
    },
    {
      title: '医药防御链', icon: '💊',
      chain: ['医药生物', '化学制药', '创新药', '医疗器械', 'CXO'],
      desc: '防御属性+创新药催化，资金在医药子板块间轮动。'
    },
    {
      title: '军工装备链', icon: '✈️',
      chain: ['军工', '高温合金', '钛合金', '航空发动机', '碳纤维'],
      desc: '装备放量+国产替代双逻辑，上游材料→中游分系统→下游总装传导。'
    }
  ];

  $('sector-linkage').innerHTML = linkageGroups.map((g, gi) => {
    const nodes = g.chain.map(name => {
      const flow = flowMap[name];
      const hasData = flow !== undefined;
      const cls = !hasData ? '' : (flow >= 0 ? 'up' : 'down');
      const tag = hasData ? ` ${flow >= 0 ? '+' : ''}${(flow / 1e8).toFixed(1)}亿` : '';
      return `<span class="linkage-node ${cls} sector-clickable" data-sector="${name}" title="点击查看板块详情">${name}${tag}</span>`;
    }).join('<span class="linkage-arrow">→</span>');
    return `
      <div class="linkage-group">
        <div class="linkage-title">${g.icon} ${g.title}<span class="linkage-hint">· 点击节点跳转板块</span></div>
        <div class="linkage-chain">${nodes}</div>
        <div class="linkage-desc">${g.desc}</div>
      </div>
    `;
  }).join('');
  // 绑定节点点击：跳转到板块
  document.querySelectorAll('#sector-linkage .sector-clickable').forEach(el => {
    el.addEventListener('click', () => {
      const sector = el.dataset.sector;
      // 先切到行业板块tab
      const tabBtn = document.querySelector('.tab-btn[data-tab="sector"]');
      if (tabBtn) tabBtn.click();
      // 选中板块
      selectSector(sector);
    });
  });
}

// ===== 2c. 热点板块龙头股 + 策略建议 =====
// 龙头筛选逻辑：
//   1) 取板块涨幅 TOP3 作为热点方向
//   2) 用个股 industry 字段（f100）匹配板块，命中即取该板块资金净流入最大的 2 只
//   3) 匹配不足时，用「主力资金净流入 TOP 个股」兜底，保证永远有龙头展示
function matchSector(stock, sectorName) {
  const ind = (stock.industry || '').trim();
  const sec = (sectorName || '').trim();
  if (!ind || !sec) return false;
  return ind === sec || ind.includes(sec) || sec.includes(ind);
}

function renderDragonStocks(data) {
  const sectorData = data.sectorRank || [];
  const stockData = data.stockFundInflow || [];

  const dragonCards = [];
  const usedCodes = new Set();

  // 路径一：按涨幅 TOP3 板块匹配龙头
  const topSectors = [...sectorData].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
  for (const sector of topSectors) {
    const sectorStocks = stockData
      .filter(s => matchSector(s, sector.name))
      .sort((a, b) => (b.mainNetInflow || 0) - (a.mainNetInflow || 0))
      .slice(0, 2);
    for (const stock of sectorStocks) {
      if (!usedCodes.has(stock.code)) {
        usedCodes.add(stock.code);
        dragonCards.push({
          sector: sector.name,
          sectorPct: sector.changePct,
          name: stock.name,
          code: stock.code,
          price: stock.price,
          changePct: stock.changePct,
          inflow: stock.mainNetInflow
        });
      }
    }
  }

  // 路径二：兜底——用主力资金净流入 TOP 个股补齐至 6 只
  if (dragonCards.length < 6) {
    const fallback = [...stockData]
      .sort((a, b) => (b.mainNetInflow || 0) - (a.mainNetInflow || 0));
    for (const stock of fallback) {
      if (usedCodes.has(stock.code)) continue;
      usedCodes.add(stock.code);
      dragonCards.push({
        sector: stock.industry || '主力净流入',
        sectorPct: null,
        name: stock.name,
        code: stock.code,
        price: stock.price,
        changePct: stock.changePct,
        inflow: stock.mainNetInflow
      });
      if (dragonCards.length >= 6) break;
    }
  }

  if (dragonCards.length === 0) {
    $('dragon-stocks').innerHTML = '<div class="empty-tip">暂无龙头股数据</div>';
    return;
  }

  $('dragon-stocks').innerHTML = dragonCards.slice(0, 6).map(s => `
    <div class="dragon-card stock-clickable ${s.changePct >= 0 ? 'up' : 'down'}" data-name="${s.name}" data-code="${s.code}" data-industry="${s.sector || ''}" data-price="${s.price || ''}" data-change-pct="${s.changePct}" data-flow="${s.inflow || 0}">
      <div class="dragon-sector">🔥 ${s.sector}${s.sectorPct != null ? ' ' + fmtPct(s.sectorPct) : ''}</div>
      <div class="dragon-name">${s.name}<span class="dragon-code">${s.code}</span></div>
      <div class="dragon-price ${s.changePct >= 0 ? 'up' : 'down'}">
        ${s.price != null ? s.price.toFixed(2) : '--'}
      </div>
      <div class="dragon-pct ${s.changePct >= 0 ? 'up' : 'down'}">
        ${fmtPct(s.changePct)}${s.inflow != null ? ' · 主力' + (s.inflow >= 0 ? '+' : '') + (s.inflow / 1e8).toFixed(2) + '亿' : ''}
      </div>
    </div>
  `).join('');
}

function renderSectorAdvice(data) {
  const sectorData = data.sectorRank || [];
  const fundData = data.sectorFundFlow || [];
  
  if (sectorData.length === 0) {
    $('sector-advice').innerHTML = '<div class="empty-tip">数据加载中...</div>';
    return;
  }
  
  const sorted = [...sectorData].sort((a, b) => b.changePct - a.changePct);
  const top3 = sorted.slice(0, 3);
  const bot3 = sorted.slice(-3);
  
  const sortedFund = [...fundData].sort((a, b) => b.mainNetInflow - a.mainNetInflow);
  const topFund3 = sortedFund.slice(0, 3);
  
  const lines = [];
  lines.push(`<p><strong>当前热点方向：</strong>${top3.map(s => s.name).join('、')}，资金流向与涨幅共振，可重点关注。</p>`);
  lines.push(`<p><strong>资金认可板块：</strong>${topFund3.map(s => s.name + '（+' + (s.mainNetInflow / 100000000).toFixed(2) + '亿）').join('、')}，主力持续加仓，持续性较强。</p>`);
  lines.push(`<p><strong>风险规避：</strong>${bot3.map(s => s.name).join('、')}，近期跌幅较大，暂不建议抄底。</p>`);
  lines.push(`<p><strong>策略要点：</strong>跟着资金走，买行业龙头，板块轮动就换仓。关注热点持续性，3日内未继续走强则果断切换。</p>`);
  
  $('sector-advice').innerHTML = lines.join('');
}

// ===== 2c. 产业链传导分析（数据驱动 + 三面板联动）=====
const SUPPLY_CHAINS = [
  {
    key: 'ai', name: 'AI算力', icon: '🤖',
    sectors: ['AI算力', '光模块', 'CPO', '光芯片', 'GPU', '存储芯片', '算力', '数据中心'],
    layers: [
      { layer: '下游', nodes: ['AI应用', '大模型', '智能硬件'], bottleneck: false },
      { layer: '中游', nodes: ['GPU芯片', 'CPU芯片', '存储芯片'], bottleneck: false },
      { layer: '上游', nodes: ['光模块', 'CPO', '光芯片'], bottleneck: true },
      { layer: '材料', nodes: ['光刻胶', '靶材', '电子特气'], bottleneck: true },
      { layer: '设备', nodes: ['光刻机', '刻蚀机', '薄膜沉积'], bottleneck: true }
    ]
  },
  {
    key: 'newenergy', name: '新能源', icon: '⚡',
    sectors: ['新能源', '新能源汽车', '电池', '锂电池', '光伏', '风电', '储能', '锂矿', '硅料', '电解液', '正极材料', '负极材料', '电力', '公用事业', '乘用车', '汽车零部件', '逆变器', '组件'],
    layers: [
      { layer: '下游', nodes: ['新能源汽车', '储能', '光伏电站'], bottleneck: false },
      { layer: '中游', nodes: ['电池', '组件', '逆变器'], bottleneck: false },
      { layer: '上游', nodes: ['锂矿', '钴矿', '硅料'], bottleneck: true },
      { layer: '材料', nodes: ['电解液', '正极材料', '负极材料'], bottleneck: false },
      { layer: '设备', nodes: ['电池设备', '光伏设备', '检测设备'], bottleneck: false }
    ]
  },
  {
    key: 'semi', name: '半导体', icon: '🧠',
    sectors: ['半导体', '光刻胶', '靶材', '电子特气', '光刻机', '刻蚀机', '芯片', '晶圆', '封装测试', '集成电路'],
    layers: [
      { layer: '下游', nodes: ['消费电子', '汽车电子', '工业控制'], bottleneck: false },
      { layer: '中游', nodes: ['芯片设计', '晶圆制造', '封装测试'], bottleneck: false },
      { layer: '上游', nodes: ['硅片', '特种气体', '掩膜版'], bottleneck: true },
      { layer: '材料', nodes: ['光刻胶', '抛光液', '靶材'], bottleneck: true },
      { layer: '设备', nodes: ['光刻机', '刻蚀机', '离子注入机'], bottleneck: true }
    ]
  },
  {
    key: 'consumer', name: '消费电子', icon: '📱',
    sectors: ['消费电子', '面板', '摄像头', 'FPC', '组装', '连接器', '智能手机', 'TWS', 'VR', 'AR', '果链'],
    layers: [
      { layer: '下游', nodes: ['智能手机', 'TWS耳机', 'VR/AR'], bottleneck: false },
      { layer: '中游', nodes: ['整机组装', '零部件', '结构件'], bottleneck: false },
      { layer: '上游', nodes: ['面板', '摄像头模组', 'FPC'], bottleneck: false },
      { layer: '芯片', nodes: ['SoC', '射频芯片', '电源管理'], bottleneck: true },
      { layer: '材料', nodes: ['玻璃盖板', '铜箔', '柔性材料'], bottleneck: false }
    ]
  },
  {
    key: 'pharma', name: '医药', icon: '💊',
    sectors: ['医药', '医药生物', '化学制药', '创新药', '仿制药', '医疗器械', '高端器械', 'CXO', '原料药', '药用包材', '培养基'],
    layers: [
      { layer: '下游', nodes: ['医院', '药店', '线上医疗'], bottleneck: false },
      { layer: '中游', nodes: ['创新药', '仿制药', '高端器械'], bottleneck: true },
      { layer: '上游', nodes: ['原料药', 'CXO', '药用包材'], bottleneck: false },
      { layer: '研发', nodes: ['新药发现', '临床试验', '生物标志物'], bottleneck: true },
      { layer: '材料', nodes: ['培养基', '一次性生物反应器', '色谱填料'], bottleneck: true }
    ]
  },
  {
    key: 'military', name: '军工', icon: '✈️',
    sectors: ['军工', '国防', '航空', '航天', '高温合金', '钛合金', '碳纤维', '航空发动机', '燃气轮机', '军用芯片', '雷达'],
    layers: [
      { layer: '下游', nodes: ['航空主机厂', '航天总体', '船舶总装'], bottleneck: false },
      { layer: '中游', nodes: ['分系统', '机电零部件', '连接器'], bottleneck: false },
      { layer: '上游', nodes: ['高温合金', '钛合金', '碳纤维'], bottleneck: true },
      { layer: '电子', nodes: ['军用芯片', '雷达', '军用通信'], bottleneck: true },
      { layer: '动力', nodes: ['航空发动机', '燃气轮机', '推进系统'], bottleneck: true }
    ]
  }
];

// 全局当前产业链（三大面板共享）
let currentChain = 'ai';

// 板块名 → 产业链 key 映射
function sectorToChain(sectorName) {
  if (!sectorName) return null;
  for (const chain of SUPPLY_CHAINS) {
    if (chain.sectors.some(s => sectorName.includes(s) || s.includes(sectorName))) {
      return chain.key;
    }
  }
  return null;
}

// 统一产业链数据仓库（链主/卡脖子/投资动向/案例/飞轮标的/建议）
const CHAIN_DETAIL = {
  ai: {
    leaders: [
      { industry: 'AI光模块', name: '中际旭创', code: '300308', marketCap: '1.5万亿', revenue: '382亿', growth: '+192%', status: '链主' }
    ],
    bottlenecks: [
      { title: '光模块/CPO', type: '设备', severity: '高', desc: 'AI数据中心高速互联核心，800G/1.6T需求爆发，产能扩张周期6-9个月，是AI算力链最窄环节。海外巨头占比约60%，国内厂商加速替代。', impact: '算力基建放量直接受益，业绩确定性最强', stocks: '中际旭创、新易盛、天孚通信、光迅科技' },
      { title: '光芯片', type: '材料/芯片', severity: '极高', desc: '25G以上高速光芯片被海外（Broadcom/II-VI）垄断，国产率不足10%，是光模块上游最卡脖子环节。', impact: '国产替代空间巨大，突破即业绩爆发', stocks: '源杰科技、长光华芯、光迅科技' }
    ],
    investments: [
      { leader: '中际旭创', direction: '光芯片 / 光器件', targets: ['源杰科技', '光迅科技', '天孚通信'], note: '订单溢出至上游光芯片与光器件供应商，需求传导确定性高。' }
    ],
    cases: [
      { region: '苏州 · 光通信生态', title: '中际旭创带动光通信集群', desc: '2008年旭创科技落地苏州，18年长成中际旭创（光模块全球龙头），带动源杰科技、联讯仪器、长光华芯等一批公司崛起，形成完整光通信产业集群。', companies: '中际旭创、源杰科技、长光华芯、联讯仪器' },
      { region: '北京 · AI算力生态', title: '寒武纪+浪潮构建AI算力生态', desc: '以AI芯片设计（寒武纪）与服务器（浪潮）为双链主，联动数据中心、液冷、光模块企业，形成国产AI算力产业生态。', companies: '寒武纪、浪潮信息、中科曙光、光环新网' }
    ],
    flywheelCompanies: ['中际旭创（光模块）', '源杰科技（光芯片）', '联讯仪器（测试）', '苏州光通信集群'],
    advice: [
      '光模块、CPO、光芯片是AI算力链核心卡脖子环节，需求确定性高，重点跟踪。',
      '800G/1.6T升级周期+算力基建放量，是未来2-3年最确定的产业趋势。',
      '验证方法：关注中际旭创订单公告、海外巨头（谷歌/英伟达）资本开支。'
    ]
  },
  newenergy: {
    leaders: [
      { industry: '新能源电池', name: '宁德时代', code: '300750', marketCap: '1.2万亿', revenue: '4000亿+', growth: '+40%', status: '链主' },
      { industry: '新能源汽车', name: '比亚迪', code: '002594', marketCap: '8000亿', revenue: '8000亿+', growth: '+50%', status: '链主' },
      { industry: '光伏', name: '隆基绿能', code: '601012', marketCap: '3000亿', revenue: '1500亿', growth: '+30%', status: '链主' }
    ],
    bottlenecks: [
      { title: '锂矿/硅料', type: '材料', severity: '高', desc: '上游核心资源，锂矿供给弹性约2-3年，硅料约6-12个月，价格波动直接传导中下游利润，是新能源链关键瓶颈。', impact: '价格企稳时中下游利润空间打开，周期反转弹性大', stocks: '赣锋锂业、天齐锂业、通威股份、隆基绿能' },
      { title: '钴矿', type: '材料', severity: '中', desc: '钴资源高度依赖刚果(金)，供给集中度CR5超60%，价格波动大，是三元电池关键瓶颈。磷酸铁锂替代趋势下影响减弱。', impact: '供给扰动时脉冲行情，长期被替代风险需警惕', stocks: '华友钴业、洛阳钼业、寒锐钴业' },
      { title: '高端隔膜设备', type: '设备', severity: '高', desc: '高端湿法隔膜核心设备被海外（日本制钢所/德国布鲁克纳）垄断，国产替代加速中。', impact: '国产设备突破带来降本空间，设备厂商业绩弹性大', stocks: '星源材质、恩捷股份、先导智能' }
    ],
    investments: [
      { leader: '宁德时代', direction: '正极 / 电解液 / 电池', targets: ['容百科技', '当升科技', '亿纬锂能', '欣旺达'], note: '产能扩张带动正极材料、二线电池厂订单，二线供应商弹性更大。' },
      { leader: '比亚迪', direction: '弗迪系 / 半导体', targets: ['弗迪电池', '比亚迪半导体', '欣旺达'], note: '自建供应链+对外供货，带动车规半导体与动力电池生态。' }
    ],
    cases: [
      { region: '宁德 · 新能源生态', title: '宁德时代催生电池产业链', desc: '宁德时代以一己之力带动宁德本地新能源集群，正极、负极、电解液、隔膜、电池回收全链条企业聚集，飞轮效应显著。', companies: '宁德时代、容百科技、湖南裕能、格林美' }
    ],
    flywheelCompanies: ['宁德时代（电池）', '容百科技（正极）', '亿纬锂能（二线电池）', '宁德新能源集群'],
    advice: [
      '锂矿、硅料是上游核心资源，价格企稳回升时中下游利润空间打开。',
      '电池链主宁德时代订单溢出至正极、电解液、二线电池厂。',
      '验证方法：跟踪碳酸锂/硅料价格、宁德时代产能扩张公告。'
    ]
  },
  semi: {
    leaders: [
      { industry: '半导体设备', name: '北方华创', code: '002371', marketCap: '5000亿', revenue: '300亿', growth: '+70%', status: '链主' }
    ],
    bottlenecks: [
      { title: '半导体材料', type: '材料', severity: '极高', desc: '光刻胶（ArF/EUV）、高纯靶材、电子特气被日本/美国垄断，国产率普遍低于15%，是半导体链卡脖子最严重环节。', impact: '国产替代空间巨大，每突破一个细分都是从0到1', stocks: '南大光电、江化微、安集科技、雅克科技' },
      { title: '高端光刻机', type: '设备', severity: '极高', desc: 'ASML垄断EUV光刻机，DUV也受出口管制，国产光刻机仍在28nm攻坚，是半导体链最大瓶颈。', impact: '设备突破直接决定制造能力上限，战略意义重大', stocks: '上海微电子、北方华创、中微公司' },
      { title: '刻蚀设备', type: '设备', severity: '高', desc: '中微公司5nm刻蚀已进入台积电供应链，但高端介质刻蚀仍被应用材料主导，国产替代加速。', impact: '国产刻蚀设备市占率快速提升，业绩弹性大', stocks: '中微公司、北方华创、芯源微' }
    ],
    investments: [
      { leader: '北方华创', direction: '薄膜 / 刻蚀 / 清洗', targets: ['拓荆科技', '中微公司', '盛美上海'], note: '国产设备协同放量，订单向薄膜沉积、刻蚀、清洗环节扩散。' },
      { leader: '中微公司', direction: '刻蚀 / MOCVD', targets: ['北方华创', '芯源微', '华海清科'], note: '设备链协同突破，CMP、涂胶显影等配套环节同步受益。' }
    ],
    cases: [
      { region: '上海 · 半导体生态', title: '中芯国际+华虹构筑制造生态', desc: '以中芯国际、华虹为核心的晶圆制造集群，吸引设计、封测、材料、设备企业集聚，张江高科形成国内最完整的集成电路产业生态。', companies: '中芯国际、华虹半导体、中微公司、沪硅产业' }
    ],
    flywheelCompanies: ['北方华创（设备）', '中微公司（刻蚀）', '南大光电（光刻胶）', '张江半导体集群'],
    advice: [
      '材料与设备国产替代是长逻辑，政策催化+巨头认证驱动订单落地。',
      '设备链协同突破，刻蚀、薄膜、清洗环节同步放量。',
      '验证方法：关注中芯国际资本开支、设备国产化率数据。'
    ]
  },
  consumer: {
    leaders: [
      { industry: '消费电子', name: '立讯精密', code: '002475', marketCap: '2000亿', revenue: '2000亿', growth: '+20%', status: '链主' }
    ],
    bottlenecks: [
      { title: 'SoC/射频芯片', type: '芯片', severity: '极高', desc: '高端手机SoC、射频前端芯片被高通/联发科/博通垄断，国产中高端手机SoC仍在追赶，是消费电子链最卡脖子环节。', impact: '国产替代从0到1空间巨大，突破即业绩拐点', stocks: '韦尔股份、卓胜微、兆易创新' },
      { title: '高端光学镜头', type: '材料/设备', severity: '中', desc: '高端手机镜头、车载镜头被大立光/舜宇主导，高端传感器被索尼垄断，国产在中低端已突破。', impact: '光学升级持续，国产替代逐步推进', stocks: '舜宇光学、欧菲光、韦尔股份' }
    ],
    investments: [
      { leader: '立讯精密', direction: '组装 / 连接器 / 模组', targets: ['领益智造', '蓝思科技', '舜宇光学'], note: '果链链主带动消费电子精密结构件、光学模组订单增长。' }
    ],
    cases: [
      { region: '深圳 · 消费电子生态', title: '立讯+华为驱动果链生态', desc: '立讯精密从连接器起家成长为果链链主，带动精密结构件、光学、声学模块企业集聚；华为带动海思、鸿蒙生态与国产替代供应链协同爆发。', companies: '立讯精密、领益智造、蓝思科技、舜宇光学' }
    ],
    flywheelCompanies: ['立讯精密（组装）', '蓝思科技（玻璃）', '舜宇光学（镜头）', '深圳果链集群'],
    advice: [
      '果链链主立讯精密订单溢出至精密结构件、光学模组。',
      '高端SoC/射频芯片国产替代是长期机会。',
      '验证方法：跟踪苹果新品发布、立讯精密季报订单。'
    ]
  },
  pharma: {
    leaders: [
      { industry: '化学制药', name: '恒瑞医药', code: '600276', marketCap: '3000亿', revenue: '200亿', growth: '+15%', status: '链主' },
      { industry: '医疗器械', name: '迈瑞医疗', code: '300760', marketCap: '3500亿', revenue: '300亿', growth: '+20%', status: '链主' }
    ],
    bottlenecks: [
      { title: '高端医疗器械', type: '设备', severity: '高', desc: 'CT/MRI/DSA/手术机器人被GE、西门子、飞利浦垄断，国产高端化是医药链最难的环节，国产率不足20%。', impact: '进口替代空间大，政策鼓励国产设备采购', stocks: '联影医疗、迈瑞医疗、开立医疗、微创医疗' },
      { title: '上游耗材/试剂', type: '材料', severity: '极高', desc: '培养基、一次性生物反应器、色谱填料、高端试剂被海外垄断，是创新药/CXO上游最卡脖子环节，国产率不足10%。', impact: '国产替代从0到1，CXO订单回暖同步受益', stocks: '奥浦迈、多宁生物、纳微科技、义翘神州' }
    ],
    investments: [
      { leader: '恒瑞医药', direction: 'CXO / 原料药', targets: ['药明康德', '凯莱英', '九洲药业'], note: '创新药研发带动CXO订单，API+CXO协同放量。' },
      { leader: '迈瑞医疗', direction: '耗材 / 试剂', targets: ['健帆生物', '万孚生物', '安图生物'], note: '器械龙头带动体外诊断耗材与试剂订单。' }
    ],
    cases: [
      { region: '张江 · 创新药生态', title: '恒瑞+药明构建创新药生态', desc: '以恒瑞医药（创新药）、药明康德（CXO）为双链主，联动生物标志物、临床试验、原料药企业，形成国内最完整的创新药产业生态。', companies: '恒瑞医药、药明康德、凯莱英、九洲药业' }
    ],
    flywheelCompanies: ['恒瑞医药（创新药）', '药明康德（CXO）', '联影医疗（器械）', '张江创新药集群'],
    advice: [
      '高端器械与上游耗材（培养基、色谱填料）国产化率低，CXO订单回暖值得关注。',
      '创新药链主恒瑞研发投入带动CXO全链条订单。',
      '验证方法：跟踪医保谈判、创新药获批、CXO龙头订单增速。'
    ]
  },
  military: {
    leaders: [
      { industry: '航空发动机', name: '航发动力', code: '600893', marketCap: '2000亿', revenue: '300亿', growth: '+25%', status: '链主' }
    ],
    bottlenecks: [
      { title: '航空发动机', type: '设备', severity: '极高', desc: '军工皇冠明珠，高温合金单晶叶片、涡轮盘制造壁垒极高，国产军用航发仍在追赶，是军工链最大瓶颈。', impact: '装备放量+国产替代双逻辑，确定性最强', stocks: '航发动力、航发控制、抚顺特钢、钢研高纳' },
      { title: '高温合金', type: '材料', severity: '高', desc: '航空发动机核心材料，被海外（ATI/GE）垄断，国产化率不足30%，是军工材料最大瓶颈。', impact: '材料先行，航发放量最先受益上游材料', stocks: '抚顺特钢、钢研高纳、图南股份' },
      { title: '高端数控机床', type: '设备', severity: '高', desc: '五轴联动被德日（DMG/马扎克）垄断，是军工/高端制造基础瓶颈，国产替代加速。', impact: '工业母机，政策支持力度大，国产替代空间广阔', stocks: '科德数控、华中数控、纽威数控' }
    ],
    investments: [
      { leader: '航发动力', direction: '高温合金 / 单晶叶片', targets: ['抚顺特钢', '钢研高纳', '图南股份'], note: '航发链主订单向上游高温合金、单晶叶片企业传导。' }
    ],
    cases: [
      { region: '西安 · 航空航天生态', title: '航发动力+航天动力军工生态', desc: '以航发动力、航天发动机研制所为核心，集聚高温合金、单晶叶片、精密锻造企业，形成军工航空动力产业链集群。', companies: '航发动力、航发控制、抚顺特钢、钢研高纳' }
    ],
    flywheelCompanies: ['航发动力（发动机）', '抚顺特钢（高温合金）', '钢研高纳（单晶叶片）', '西安军工集群'],
    advice: [
      '高温合金、航空发动机是确定性最强的瓶颈节点，受益装备放量+国产替代双逻辑。',
      '航发链主订单向上游材料企业传导确定性高。',
      '验证方法：跟踪军工装备列装计划、航发动力订单公告。'
    ]
  }
};

// 飞轮6阶段（通用，companies 按 currentChain 动态填充）
const FLYWHEEL_STAGES = [
  { icon: '🌱', title: '链主崛起', desc: '链主公司业绩爆发，成为行业核心节点' },
  { icon: '📦', title: '订单溢出', desc: '链主订单带动上下游企业产能扩张' },
  { icon: '📈', title: '上市带动', desc: '链主上市后，上下游企业估值提升' },
  { icon: '🏭', title: '产业集聚', desc: '更多产业链企业被吸引，形成产业集群' },
  { icon: '💰', title: '链主基金', desc: '链主参与投资决策，孵化更多优质项目' },
  { icon: '🔄', title: '飞轮转动', desc: '产业生态自我强化，持续创造价值' }
];

// ===== 2d. 产业链渲染 + 三面板联动切换 =====
function renderSupplyChain() {
  const tabsEl = $('supply-chain-tabs');
  tabsEl.innerHTML = SUPPLY_CHAINS.map(c => `
    <span class="chain-chip${c.key === currentChain ? ' active' : ''}" data-chain="${c.key}">${c.icon} ${c.name}</span>
  `).join('');
  tabsEl.querySelectorAll('.chain-chip').forEach(chip => {
    chip.addEventListener('click', () => selectChain(chip.dataset.chain));
  });

  const chain = SUPPLY_CHAINS.find(c => c.key === currentChain) || SUPPLY_CHAINS[0];
  $('supply-chain-detail').innerHTML = chain.layers.map(layer => `
    <div class="supply-layer">
      <div class="supply-layer-label">${layer.layer}</div>
      <div class="supply-nodes">
        ${layer.nodes.map(node => `
          <span class="supply-node${layer.bottleneck ? ' bottleneck' : ''} chain-sector-clickable" data-sector="${node}" title="点击跳转板块">${node}${layer.bottleneck ? ' ⚠️' : ''}</span>
        `).join('')}
      </div>
    </div>
  `).join('');
  // 产业链节点 → 热点板块跳转
  document.querySelectorAll('#supply-chain-detail .chain-sector-clickable').forEach(el => {
    el.addEventListener('click', () => {
      const sector = el.dataset.sector;
      const tabBtn = document.querySelector('.tab-btn[data-tab="sector"]');
      if (tabBtn) tabBtn.click();
      selectSector(sector);
    });
  });

  // 仅联动产业链面板的卡脖子/建议，不再联动产业生态（生态独立按未来板块）
  renderBottleneckList();
  renderSupplyAdvice();
}

// 统一产业链切换（仅产业链面板内部联动，不影响产业生态）
function selectChain(chainKey) {
  if (!chainKey || chainKey === currentChain) return;
  currentChain = chainKey;
  renderSupplyChain();
}

function renderBottleneckList() {
  const detail = CHAIN_DETAIL[currentChain] || CHAIN_DETAIL.ai;
  const bottlenecks = detail.bottlenecks || [];
  const sevColor = { '极高': 'severity-critical', '高': 'severity-high', '中': 'severity-medium', '低': 'severity-low' };
  const typeClassMap = {
    '设备': 'type-equipment',
    '材料': 'type-material',
    '芯片': 'type-chip',
    '设计': 'type-design',
    '材料/芯片': 'type-chip',
    '材料/设备': 'type-equipment',
    '综合': 'type-other'
  };
  const typeIconMap = {
    '设备': '⚙️',
    '材料': '🧪',
    '芯片': '💾',
    '设计': '📐',
    '材料/芯片': '💾',
    '材料/设备': '⚙️',
    '综合': '🎯'
  };
  $('bottleneck-list').innerHTML = bottlenecks.length ? bottlenecks.map(b => {
    const type = b.type || '综合';
    const typeClass = typeClassMap[type] || 'type-other';
    const typeIcon = typeIconMap[type] || '🎯';
    return `
    <div class="bottleneck-item">
      <div class="bottleneck-head">
        <span class="bottleneck-icon">${typeIcon}</span>
        <div class="bottleneck-title">${b.title}</div>
        <span class="bottleneck-tag ${typeClass}">环节：${type}</span>
        <span class="bottleneck-severity ${sevColor[b.severity] || 'severity-medium'}">${b.severity || '中'}</span>
      </div>
      <div class="bottleneck-desc">${b.desc}</div>
      ${b.impact ? `<div class="bottleneck-impact">💡 投资影响：${b.impact}</div>` : ''}
      <div class="bottleneck-stocks">相关标的：${b.stocks}</div>
    </div>
  `}).join('') : '<div class="empty-tip">该产业链暂无卡脖子节点</div>';
}

function renderSupplyAdvice() {
  const detail = CHAIN_DETAIL[currentChain] || CHAIN_DETAIL.ai;
  const chainName = (SUPPLY_CHAINS.find(c => c.key === currentChain) || {}).name || '';
  const lines = [];
  lines.push(`<p><strong>当前产业链：</strong><span class="up">${chainName}</span> · 产业链传导思路——从下游需求爆发，向上游传导，找最窄的瓶颈环节。</p>`);
  (detail.advice || []).forEach(a => lines.push(`<p>${a}</p>`));
  $('supply-advice').innerHTML = lines.join('');
}

// ===== 2d. 北向资金行业配置趋势 =====
function renderNorthboundSectorTrend(data) {
  const sectorData = data.sectorFundFlow || [];
  const nbData = data.northbound;
  
  if (sectorData.length === 0 || !nbData) {
    $('nb-sector-trend').innerHTML = '<div class="empty-tip">数据加载中...</div>';
    return;
  }
  
  const sorted = [...sectorData].sort((a, b) => b.mainNetInflow - a.mainNetInflow);
  const top8 = sorted.slice(0, 8);
  
  const maxFlow = Math.max(...top8.map(s => Math.abs(s.mainNetInflow)));
  
  $('nb-sector-trend').innerHTML = top8.map(s => {
    const pct = (Math.abs(s.mainNetInflow) / maxFlow * 100).toFixed(0);
    const isUp = s.mainNetInflow >= 0;
    return `
      <div class="nb-sector-item">
        <span style="width: 80px; flex-shrink: 0;">${s.name}</span>
        <div class="nb-sector-bar">
          <div class="nb-sector-bar-fill ${isUp ? 'up' : 'down'}" style="width: ${pct}%"></div>
        </div>
        <span style="width: 60px; text-align: right; font-size: 11px;">${isUp ? '+' : ''}${(s.mainNetInflow / 100000000).toFixed(1)}亿</span>
      </div>
    `;
  }).join('');
}

function renderInstAdvice(data) {
  const nb = data.northbound?.latest;
  
  if (!nb) {
    $('inst-advice').innerHTML = '<div class="empty-tip">数据加载中...</div>';
    return;
  }
  
  const lines = [];
  
  if (nb.total > 50) {
    lines.push(`<p><strong>外资大幅流入：</strong>北向资金当日净流入 ${nb.total.toFixed(2)} 亿，外资看好A股，可跟随配置核心资产。</p>`);
    lines.push(`<p><strong>验证方法：</strong>看连续几周/几个月的趋势，不是单天数据。机构家数增加比持仓市值增加更有意义。</p>`);
    lines.push(`<p><strong>重点关注：</strong>外资偏好的消费、医药、科技龙头，长期持有胜率较高。</p>`);
  } else if (nb.total < -30) {
    lines.push(`<p><strong>外资大幅流出：</strong>北向资金当日净流出 ${Math.abs(nb.total).toFixed(2)} 亿，外资风险偏好下降，需谨慎。</p>`);
    lines.push(`<p><strong>验证方法：</strong>关注是否持续流出，单次流出可能是短期调仓，持续流出需警惕。</p>`);
    lines.push(`<p><strong>操作建议：</strong>控制仓位，转向防御性板块，等待外资回流信号。</p>`);
  } else {
    lines.push(`<p><strong>外资流向平稳：</strong>北向资金当日${nb.total >= 0 ? '净流入' : '净流出'} ${Math.abs(nb.total).toFixed(2)} 亿，市场处于观望状态。</p>`);
    lines.push(`<p><strong>验证方法：</strong>结合行业资金流向，看外资在哪些行业持续加仓。</p>`);
    lines.push(`<p><strong>操作建议：</strong>按A股自身节奏操作，关注板块轮动和资金流向。</p>`);
  }
  
  $('inst-advice').innerHTML = lines.join('');
}

// ===== 2e. 产业生态构建（按「未来板块」切换，独立于产业链传导）=====
// 按成熟度从高到低排序的未来板块（选择器专用）
function getFutureSectorsSorted() {
  return [...FUTURE_SECTORS].sort((a, b) => b.maturity - a.maturity);
}

function renderFutureSectorSelector() {
  const tabsEl = $('ecology-chain-tabs');
  if (!tabsEl) return;
  const sorted = getFutureSectorsSorted();
  tabsEl.innerHTML = sorted.map(f => `
    <span class="chain-chip${f.name === currentFutureSector ? ' active' : ''}" data-future="${f.name}">${f.icon} ${f.name}<em class="chip-maturity">${f.maturity}%</em></span>
  `).join('');
  tabsEl.querySelectorAll('.chain-chip').forEach(chip => {
    chip.addEventListener('click', () => selectFutureSector(chip.dataset.future));
  });

  // 选择器下方渲染当前未来板块的趋势摘要
  renderFutureTrendSummary();
}

// 当前未来板块趋势摘要（选择器下方，与「未来板块前瞻」联动）
function renderFutureTrendSummary() {
  const el = $('future-trend-summary');
  if (!el) return;
  const meta = FUTURE_SECTORS.find(f => f.name === currentFutureSector) || FUTURE_SECTORS[0];
  const maturityColor = meta.maturity >= 60 ? 'var(--up)' : meta.maturity >= 40 ? 'var(--warn)' : 'var(--text-dim)';
  const stageColor = meta.maturity >= 60 ? 'up' : meta.maturity >= 40 ? 'warn' : 'neutral';
  el.innerHTML = `
    <div class="ft-summary">
      <div class="ft-header">
        <span class="ft-icon">${meta.icon}</span>
        <div class="ft-title-block">
          <div class="ft-name">${meta.name}</div>
          <div class="ft-stage"><span class="mood-badge ${stageColor}">${meta.stage}</span></div>
        </div>
        <span class="ft-horizon">周期 ${meta.horizon}</span>
      </div>
      <div class="ft-maturity">
        <span class="fm-label">成熟度</span>
        <div class="fm-bar"><div class="fm-fill" style="width:${meta.maturity}%;background:${maturityColor};"></div></div>
        <span class="fm-val" style="color:${maturityColor};">${meta.maturity}%</span>
        <span class="fm-layout">📍 ${meta.layoutTime}</span>
      </div>
      <div class="ft-desc">${meta.desc}</div>
      <div class="ft-catalyst"><strong>🎯 催化剂：</strong>${meta.catalyst}</div>
      <div class="ft-stocks"><strong>📌 关注标的：</strong>${meta.stocks}</div>
    </div>
  `;
}

function selectFutureSector(name) {
  if (!name || name === currentFutureSector) return;
  currentFutureSector = name;
  renderEcologyAll();
  // 联动「未来板块前瞻」卡片高亮
  highlightFutureCard(name);
}

// 统一渲染产业生态（链主/飞轮/投资动向/案例/建议 + 选择器）
function renderEcologyAll() {
  renderFutureSectorSelector();
  const detail = FUTURE_DETAIL[currentFutureSector] || FUTURE_DETAIL['固态电池'];
  const meta = FUTURE_SECTORS.find(f => f.name === currentFutureSector) || FUTURE_SECTORS[0];

  // 链主
  const leaders = detail.leaders || [];
  $('chain-leader-list').innerHTML = leaders.length ? leaders.map((l, idx) => `
    <div class="chain-leader-card clickable-leader" data-index="${idx}" style="cursor: pointer;">
      <span class="leader-badge">${l.status}</span>
      <div class="leader-industry">🔧 ${l.industry} · ${currentFutureSector}</div>
      <div class="leader-name">${l.name}<span class="leader-code">${l.code}</span></div>
      <div class="leader-metrics">
        <div class="leader-metric">
          <div class="leader-metric-value">${l.marketCap}</div>
          <div class="leader-metric-label">市值</div>
        </div>
        <div class="leader-metric">
          <div class="leader-metric-value">${l.revenue}</div>
          <div class="leader-metric-label">营收</div>
        </div>
        <div class="leader-metric">
          <div class="leader-metric-value up">${l.growth}</div>
          <div class="leader-metric-label">增长</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:right;">💡 点击查看K线走势</div>
    </div>
  `).join('') : '<div class="empty-tip">该未来板块暂无链主追踪</div>';
  // 绑定链主卡片点击事件
  setTimeout(() => {
    document.querySelectorAll('#chain-leader-list .clickable-leader').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index);
        const leader = leaders[idx];
        if (leader) {
          const seed = (leader.code || leader.name).toString().split('').reduce((s, c) => s + c.charCodeAt(0), 0);
          const basePrice = 50 + (seed % 150);
          const changePct = ((seed % 20) - 5) / 2;
          showStockDetail({
            name: leader.name,
            code: leader.code,
            industry: leader.industry,
            price: basePrice,
            changePct: changePct,
            mainNetInflow: (seed % 5) * 1e8,
            marketCap: leader.marketCap,
            circulatingCap: leader.marketCap,
            turnoverRate: 2 + (seed % 5),
            amount: (10 + seed % 50) * 1e8,
            pe: (20 + seed % 60).toFixed(2),
            pb: (2 + (seed % 8) / 2).toFixed(2)
          });
        }
      });
    });
  }, 50);

  // 飞轮
  const companies = detail.flywheelCompanies || [];
  $('ecology-flywheel').innerHTML = FLYWHEEL_STAGES.map((f, i) => `
    <div class="flywheel-stage${i < 3 ? ' active' : ''}">
      <span class="flywheel-icon">${f.icon}</span>
      <div class="flywheel-info">
        <div class="flywheel-title">${i + 1}. ${f.title}</div>
        <div class="flywheel-desc">${f.desc}</div>
        <div class="flywheel-companies">相关标的：${companies[i] || '产业链整体受益'}</div>
      </div>
    </div>
  `).join('');

  // 投资动向
  const moves = detail.investments || [];
  $('ecology-investment').innerHTML = moves.length ? moves.map(m => `
    <div class="invest-item">
      <span class="invest-leader">${m.leader}</span>
      <span class="invest-arrow">→</span>
      <span class="invest-targets"><em>${m.direction}</em>：${m.targets.join('、')}<br><span style="font-size:11px;color:var(--text-muted);">${m.note}</span></span>
    </div>
  `).join('') : '<div class="empty-tip">该未来板块暂无投资动向</div>';

  // 案例
  const cases = detail.cases || [];
  $('ecology-cases').innerHTML = cases.length ? cases.map(c => `
    <div class="case-card">
      <div class="case-region">📍 ${c.region}</div>
      <div class="case-title">${c.title}</div>
      <div class="case-desc">${c.desc}</div>
      <div class="case-companies">相关标的：${c.companies}</div>
    </div>
  `).join('') : '<div class="empty-tip">该未来板块暂无生态案例</div>';

  // 建议
  const lines = [];
  lines.push(`<p><strong>当前未来板块：</strong><span class="up">${currentFutureSector}</span>（${meta.stage} · 成熟度${meta.maturity}% · 周期${meta.horizon}）</p>`);
  lines.push(`<p><strong>产业逻辑：</strong>${meta.desc}</p>`);
  (detail.advice || []).forEach(a => lines.push(`<p>${a}</p>`));
  $('ecology-advice').innerHTML = lines.join('');
}

// ===== 2h. 未来板块前瞻（思路④长远布局，不是看今天的链）=====
function renderFutureSectors() {
  const sorted = getFutureSectorsSorted();
  const html = sorted.map(f => {
    const maturityColor = f.maturity >= 60 ? 'var(--up)' : f.maturity >= 40 ? 'var(--warn)' : 'var(--text-dim)';
    return `
      <div class="future-card${f.name === currentFutureSector ? ' selected' : ''}" data-future="${f.name}" data-chain="${f.relatedChain}">
        <div class="future-header">
          <span class="future-icon">${f.icon}</span>
          <div class="future-title-block">
            <div class="future-name">${f.name}</div>
            <div class="future-stage">${f.stage}</div>
          </div>
          <span class="future-horizon">${f.horizon}</span>
        </div>
        <div class="future-maturity">
          <span class="fm-label">成熟度</span>
          <div class="fm-bar"><div class="fm-fill" style="width:${f.maturity}%;background:${maturityColor};"></div></div>
          <span class="fm-val" style="color:${maturityColor};">${f.maturity}%</span>
        </div>
        <div class="future-desc">${f.desc}</div>
        <div class="future-meta">
          <div><strong>催化剂：</strong>${f.catalyst}</div>
          <div><strong>布局时点：</strong><span style="color:var(--accent);">${f.layoutTime}</span></div>
          <div><strong>关注标的：</strong>${f.stocks}</div>
        </div>
      </div>
    `;
  }).join('');
  $('future-sectors-list').innerHTML = html;
  // 点击未来板块卡片：联动选择器 + 联动产业链
  $('future-sectors-list').querySelectorAll('.future-card').forEach(card => {
    card.addEventListener('click', () => {
      const fname = card.dataset.future;
      if (fname && fname !== currentFutureSector) {
        selectFutureSector(fname);
      }
      const ckey = card.dataset.chain;
      if (ckey && ckey !== currentChain) selectChain(ckey);
    });
  });
}

// 高亮「未来板块前瞻」中对应的卡片（与选择器联动）
function highlightFutureCard(name) {
  document.querySelectorAll('#future-sectors-list .future-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.future === name);
  });
}

// ===== 2i. 国家政策影响 =====
function renderPolicyCalendar() {
  const sorted = [...POLICY_DATA.calendar].sort((a, b) => a.date.localeCompare(b.date));
  $('policy-calendar').innerHTML = sorted.map(p => {
    const levelCls = p.level === 'high' ? 'high' : (p.level === 'medium' ? 'medium' : 'low');
    const dirCls = p.direction === '利好' ? 'up' : (p.direction === '中性偏空' || p.direction === '偏空') ? 'down' : 'neutral';
    return `
      <div class="policy-item">
        <div class="policy-date">
          <div class="pd-day">${p.date.slice(5)}</div>
          <div class="pd-year">${p.date.slice(0,4)}</div>
        </div>
        <div class="policy-body">
          <div class="policy-title">
            <span class="policy-level ${levelCls}">${p.level === 'high' ? '★★★' : p.level === 'medium' ? '★★' : '★'}</span>
            ${p.title}
            <span class="policy-dir ${dirCls}">${p.direction}</span>
            <span class="policy-horizon">影响周期 ${p.horizon}</span>
          </div>
          <div class="policy-desc">${p.desc}</div>
          <div class="policy-sectors">受益板块：${p.sectors.map(s => `<span class="policy-tag policy-sector-click" data-sector="${s}">${s}</span>`).join('')}</div>
        </div>
      </div>
    `;
  }).join('');
  // 绑定受益板块点击：跳转行业板块tab并选中
  document.querySelectorAll('#policy-calendar .policy-sector-click').forEach(el => {
    el.addEventListener('click', () => {
      const sector = el.dataset.sector;
      const tabBtn = document.querySelector('.tab-btn[data-tab="sector"]');
      if (tabBtn) tabBtn.click();
      selectSector(sector);
    });
  });
}

function renderPolicyMainlines() {
  const intensityOrder = { '强': 4, '中强': 3, '中': 2, '弱': 1 };
  const sorted = [...POLICY_DATA.mainlines].sort((a, b) =>
    (intensityOrder[b.intensity] || 0) - (intensityOrder[a.intensity] || 0)
  );
  $('policy-mainlines').innerHTML = sorted.map(m => {
    const intensityCls = m.intensity === '强' ? 'up' : m.intensity === '中强' ? 'warn' : 'neutral';
    return `
      <div class="mainline-card">
        <div class="mainline-header">
          <span class="mainline-icon">${m.icon}</span>
          <div class="mainline-name">${m.name}</div>
          <span class="mainline-intensity ${intensityCls}">强度${m.intensity}</span>
          <span class="mainline-horizon">${m.horizon}</span>
        </div>
        <div class="mainline-desc">${m.desc}</div>
        <div class="mainline-sectors">受益板块：${m.sectors.map(s => `<span class="policy-tag policy-sector-click" data-sector="${s}">${s}</span>`).join('')}</div>
        <div class="mainline-stocks">关注标的：${m.stocks}</div>
      </div>
    `;
  }).join('');
  // 绑定受益板块点击
  document.querySelectorAll('#policy-mainlines .policy-sector-click').forEach(el => {
    el.addEventListener('click', () => {
      const sector = el.dataset.sector;
      const tabBtn = document.querySelector('.tab-btn[data-tab="sector"]');
      if (tabBtn) tabBtn.click();
      selectSector(sector);
    });
  });
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
    `<div class="stock-row stock-clickable" data-name="${s.name}" data-code="${s.code}" data-industry="${s.industry || ''}" data-price="${s.price}" data-change-pct="${s.changePct}" data-flow="${s.mainNetInflow}">
      <span class="sr-rank up">${i + 1}</span>
      <span class="sr-name">${s.name}<em>${s.code}</em></span>
      <span class="sr-pct up">${fmtPct(s.changePct)}</span>
      <span class="sr-amt up">+${(s.mainNetInflow / 100000000).toFixed(2)}亿</span>
    </div>`
  ).join('') || '<div class="empty-tip">暂无数据</div>';

  $('stock-outflow-list').innerHTML = outflowTop5.map((s, i) =>
    `<div class="stock-row stock-clickable" data-name="${s.name}" data-code="${s.code}" data-industry="${s.industry || ''}" data-price="${s.price}" data-change-pct="${s.changePct}" data-flow="${s.mainNetInflow}">
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

// ===== 5. 市场特殊信号（涨跌停、情绪、反常信号）=====
function renderMarketSignals(data) {
  const up = data.limitUp || { total: 0, list: [] };
  const down = data.limitDown || { total: 0, list: [] };

  // 涨跌停统计（元素缺失时安全兜底）
  const ztCountEl = document.getElementById('zt-count');
  if (ztCountEl) ztCountEl.textContent = up.total;
  const dtCountEl = document.getElementById('dt-count');
  if (dtCountEl) dtCountEl.textContent = down.total;

  // 涨停原因分析（基于行业、连板数、换手率等推断）
  function analyzeZtReason(stock) {
    const reasons = [];
    const industry = stock.industry || '';
    const days = stock.limitDays || 1;
    const turnover = stock.turnoverRate || 5;
    // 行业驱动
    if (industry.match(/AI|算力|光模块|芯片|半导体/)) reasons.push('AI/算力主线驱动');
    else if (industry.match(/新能源|电池|光伏/)) reasons.push('新能源板块联动');
    else if (industry.match(/医药|创新药/)) reasons.push('医药板块反弹');
    else if (industry.match(/军工|航空|航天/)) reasons.push('军工装备放量预期');
    else if (industry.match(/消费|食品|白酒/)) reasons.push('消费复苏预期');
    else if (industry.match(/地产|基建|建材/)) reasons.push('稳增长政策催化');
    else reasons.push('板块轮动带动');
    // 连板数判断
    if (days >= 5) reasons.push('市场总龙头，情绪标杆');
    else if (days >= 3) reasons.push('连板高度股，资金认可度高');
    else if (days === 2) reasons.push('二板确认，有望走成龙头');
    else reasons.push('首板启动，关注持续性');
    // 换手率判断
    if (turnover > 20) reasons.push('高换手，多空分歧大');
    else if (turnover > 10) reasons.push('换手充分，接力健康');
    else reasons.push('缩量涨停，抛压较轻');
    return reasons;
  }
  // 连板概率评估（基于连板数、行业、换手率）
  function estimateContinueProb(stock) {
    const days = stock.limitDays || 1;
    const turnover = stock.turnoverRate || 5;
    let prob = 50;
    if (days >= 5) prob = 30;
    else if (days >= 3) prob = 45;
    else if (days === 2) prob = 55;
    else prob = 40;
    if (turnover > 25) prob -= 15;
    else if (turnover > 15) prob -= 5;
    else if (turnover < 5) prob += 10;
    const industry = stock.industry || '';
    if (industry.match(/AI|算力|光模块|芯片/)) prob += 10;
    prob = Math.max(10, Math.min(90, prob));
    return prob;
  }

  // 涨停板列表 TOP 10（可点击查看详情 + 浮动分析）
  const topList = (up.list || []).slice(0, 10);
  $('zt-list').innerHTML = topList.length ? topList.map(s => {
    const reasons = analyzeZtReason(s);
    const prob = estimateContinueProb(s);
    const probClass = prob >= 60 ? 'up' : prob >= 40 ? 'neutral' : 'down';
    return `
    <div class="zt-item stock-clickable zt-item-with-tip" data-name="${s.name}" data-code="${s.code}" data-industry="${s.industry || ''}" data-price="${s.price}" data-change-pct="${s.changePct}" data-flow="${s.amount || 0}" data-turnover="${s.turnoverRate || 0}" data-amount="${s.amount || 0}">
      <span class="zt-name">${s.name}<em>${s.code}</em></span>
      <span class="zt-pct up">${fmtPct(s.changePct)}</span>
      <span class="zt-hy">${s.industry || '--'}</span>
      <span class="zt-days">${s.limitDays > 1 ? s.limitDays + '连板' : '首板'}</span>
      <div class="zt-tooltip">
        <div class="zt-tip-title">📊 涨停分析</div>
        <div class="zt-tip-section">
          <div class="zt-tip-label">涨停原因：</div>
          <div class="zt-tip-reasons">
            ${reasons.map(r => `<span class="zt-reason-tag">${r}</span>`).join('')}
          </div>
        </div>
        <div class="zt-tip-section">
          <div class="zt-tip-label">明日连板概率：<span class="zt-prob ${probClass}">${prob}%</span></div>
          <div class="zt-tip-desc">${prob >= 60 ? '连板概率较高，关注开盘承接力度' : prob >= 40 ? '连板概率中等，需观察量能变化' : '连板概率偏低，谨慎追高'}</div>
        </div>
        <div class="zt-tip-footer">💡 点击查看完整K线走势</div>
      </div>
    </div>`;
  }).join('') : '<div class="empty-tip">暂无涨停数据</div>';

  // 特殊信号检测（涨跌停比、北向异动等）— 已合并进反常信号卡片，此处仅做安全兜底
  const signals = detectSpecialSignals();
  const signalListEl = document.getElementById('signal-list');
  if (signalListEl) {
    signalListEl.innerHTML = signals.length ? signals.map(s =>
      `<div class="signal-item ${s.level}">
        <span class="signal-icon">${s.level === 'danger' ? '⚠' : s.level === 'warn' ? '⚡' : '💡'}</span>
        <div>
          <div class="signal-title">${s.title}</div>
          <div class="signal-desc">${s.desc}</div>
        </div>
      </div>`
    ).join('') : '<div class="empty-tip">暂无明显特殊信号</div>';
  }

  // ★ 反常信号 + 突发信号（与资金流入同步）
  renderAbnormalSignals(data);
}

// ===== 5b. 信号驱动资金流向（每个信号对应显示具体资金数据，而非一窝蜂全显示）=====
// 思路②数据化：检测反常/突发信号，并内联展示触发该信号的具体板块/个股资金明细
function renderAbnormalSignals(data) {
  const list = $('abnormal-signal-list');
  if (!list) return;

  const signals = [];
  const sectorFlow = data.sectorFundFlow || [];
  const stockFlowIn = data.stockFundInflow || [];
  const stockFlowOut = data.stockFundOutflow || [];
  const nb = data.northbound?.latest;
  const yi = v => (v / 1e8).toFixed(1);

  // 1) 板块巨额流入 → 内联展示这些板块的资金明细
  const bigInflow = sectorFlow.filter(s => (s.mainNetInflow || 0) > 5e9).sort((a, b) => b.mainNetInflow - a.mainNetInflow);
  if (bigInflow.length) {
    signals.push({
      level: 'danger', type: '突发', icon: '🔥',
      title: `${bigInflow.length}个板块主力巨额流入（>50亿）`,
      implication: '资金集中涌入 → 可能突发利好或主线确立，思路①跟资金布局龙头',
      evidence: bigInflow.slice(0, 6).map(s => ({ name: s.name, value: '+' + yi(s.mainNetInflow) + '亿', sub: fmtPct(s.changePct), dir: 'up' }))
    });
  }

  // 2) 板块大幅流出 → 内联展示流出板块明细
  const bigOutflow = sectorFlow.filter(s => (s.mainNetInflow || 0) < -3e9).sort((a, b) => a.mainNetInflow - b.mainNetInflow);
  if (bigOutflow.length) {
    signals.push({
      level: 'warn', type: '突发', icon: '🩸',
      title: `${bigOutflow.length}个板块主力大幅流出（<-30亿）`,
      implication: '资金集中撤离 → 警惕突发利空或主线退潮，回避相关板块',
      evidence: bigOutflow.slice(0, 6).map(s => ({ name: s.name, value: yi(s.mainNetInflow) + '亿', sub: fmtPct(s.changePct), dir: 'down' }))
    });
  }

  // 3) 价跌资金进背离 → 内联展示背离板块（价格 vs 资金对照）
  const divergence = sectorFlow.filter(s =>
    s.changePct != null && s.mainNetInflow != null && s.changePct < -1 && s.mainNetInflow > 1e9
  ).sort((a, b) => b.mainNetInflow - a.mainNetInflow);
  if (divergence.length) {
    signals.push({
      level: 'info', type: '反常', icon: '🔍',
      title: `${divergence.length}个板块"价跌但资金流入"（背离抄底）`,
      implication: '价跌资金进 = 机构逆势抄底，思路②反常信号，关注后续修复',
      evidence: divergence.slice(0, 6).map(s => ({ name: s.name, value: '+' + yi(s.mainNetInflow) + '亿', sub: '跌' + fmtPct(s.changePct), dir: 'up' }))
    });
  }

  // 4) 价涨资金出出货 → 内联展示出货板块
  const shipment = sectorFlow.filter(s =>
    s.changePct != null && s.mainNetInflow != null && s.changePct > 1 && s.mainNetInflow < -1e9
  ).sort((a, b) => a.mainNetInflow - b.mainNetInflow);
  if (shipment.length) {
    signals.push({
      level: 'warn', type: '反常', icon: '📤',
      title: `${shipment.length}个板块"价涨但资金流出"（拉高出货）`,
      implication: '价涨资金出 = 机构拉高出货，警惕追高被套',
      evidence: shipment.slice(0, 6).map(s => ({ name: s.name, value: yi(s.mainNetInflow) + '亿', sub: '涨' + fmtPct(s.changePct), dir: 'down' }))
    });
  }

  // 5) 个股巨额流入 → 内联展示这些个股（含行业）
  const bigStockIn = stockFlowIn.filter(s => (s.mainNetInflow || 0) > 1e10).slice(0, 6);
  if (bigStockIn.length) {
    signals.push({
      level: 'info', type: '突发', icon: '💎',
      title: `${bigStockIn.length}只个股主力净流入>10亿`,
      implication: '单票巨额流入 → 突发利好或机构建仓，思路①关注这些龙头',
      evidence: bigStockIn.map(s => ({ name: s.name, value: '+' + yi(s.mainNetInflow) + '亿', sub: (s.industry || '') + ' ' + fmtPct(s.changePct), dir: 'up' }))
    });
  }

  // 6) 个股巨额流出 → 内联展示流出个股
  const bigStockOut = stockFlowOut.filter(s => (s.mainNetInflow || 0) < -3e9).slice(0, 6);
  if (bigStockOut.length) {
    signals.push({
      level: 'warn', type: '突发', icon: '💸',
      title: `${bigStockOut.length}只个股主力净流出>3亿`,
      implication: '资金撤离 → 警惕个股利空或机构调仓，回避',
      evidence: bigStockOut.map(s => ({ name: s.name, value: yi(s.mainNetInflow) + '亿', sub: (s.industry || '') + ' ' + fmtPct(s.changePct), dir: 'down' }))
    });
  }

  // 7) 北向异动 → 内联展示北向明细
  if (nb && (nb.total > 50 || nb.total < -30)) {
    const dir = nb.total >= 0 ? 'up' : 'down';
    signals.push({
      level: nb.total >= 0 ? 'info' : 'danger', type: '突发', icon: '🌍',
      title: `北向资金${nb.total >= 0 ? '大幅净流入' : '大幅净流出'} ${Math.abs(nb.total).toFixed(1)}亿`,
      implication: nb.total >= 0 ? '外资强势买入 → 跟随外资偏好（消费/医药/科技龙头）' : '外资大幅撤离 → 警惕系统性风险，转向防御',
      evidence: [
        { name: '沪股通', value: (nb.sh >= 0 ? '+' : '') + nb.sh.toFixed(1) + '亿', sub: '', dir: nb.sh >= 0 ? 'up' : 'down' },
        { name: '深股通', value: (nb.sz >= 0 ? '+' : '') + nb.sz.toFixed(1) + '亿', sub: '', dir: nb.sz >= 0 ? 'up' : 'down' },
        { name: '北向合计', value: (nb.total >= 0 ? '+' : '') + nb.total.toFixed(1) + '亿', sub: '', dir }
      ]
    });
  }

  // 8) 涨跌停极端 → 内联展示涨停个股
  const up = data.limitUp || { total: 0, list: [] };
  const down = data.limitDown || { total: 0, list: [] };
  if (up.total > 60) {
    signals.push({
      level: 'info', type: '突发', icon: '🚀',
      title: `涨停${up.total}家，赚钱效应极强（跌停${down.total}家）`,
      implication: '情绪亢奋 → 跟随主线但注意高位股分歧风险',
      evidence: (up.list || []).slice(0, 6).map(s => ({ name: s.name, value: fmtPct(s.changePct), sub: (s.industry || '') + (s.limitDays > 1 ? ' ' + s.limitDays + '连板' : ' 首板'), dir: 'up' }))
    });
  } else if (down.total > 30) {
    signals.push({
      level: 'danger', type: '突发', icon: '💀',
      title: `跌停${down.total}家，亏钱效应显著（涨停${up.total}家）`,
      implication: '市场恐慌 → 控制仓位，转向防御',
      evidence: (down.list || []).slice(0, 6).map(s => ({ name: s.name, value: fmtPct(s.changePct), sub: s.industry || '', dir: 'down' }))
    });
  }

  // 生成轮动推演：基于当前热门板块，推演下一个可能轮动的方向
  function genRotation(signalType, evidence) {
    const rotations = {
      '板块巨额流入': [
        '资金集中涌入主线 → 后续可能向上下游产业链扩散，关注上游材料/设备机会',
        '主线确立后 → 低位补涨标的弹性更大，可挖掘同板块未启动个股',
        '注意：连续3日巨额流入需警惕短期见顶，控制追高风险'
      ],
      '板块大幅流出': [
        '资金集中撤离 → 短期回避，关注防御性板块（公用事业、医药、高股息）',
        '主线退潮 → 资金可能切换至低位超跌板块做反弹，关注前期超跌方向',
        '注意：若伴随北向大幅流出，需警惕系统性风险，降低总仓位'
      ],
      '价跌资金流入': [
        '机构逆势抄底 → 后续修复概率大，可逢低布局，左侧建仓',
        '背离板块多为机构重仓方向 → 修复时优先反弹，关注行业龙头',
        '注意：需设置止损，若继续下跌需重新评估逻辑'
      ],
      '价涨资金流出': [
        '拉高出货 → 短期回避高位股，资金可能切换至低位板块',
        '注意：若为主线板块首次分歧，可能还有二波机会，观察承接力度'
      ],
      '北向大幅净流入': [
        '外资强势买入 → 优先关注外资重仓板块：消费龙头、医药、新能源、核心科技',
        '北向持续流入 → 市场底部区域确认，可逐步加大仓位',
        '资金风格切换：从题材炒作转向价值蓝筹，关注大盘蓝筹股'
      ],
      '北向大幅净流出': [
        '外资撤离 → 转向防御：高股息、公用事业、黄金等避险板块',
        '北向流出往往领先市场 → 控制仓位，等待企稳信号',
        '注意：若汇率稳定后北向回流，可能是较好的买点'
      ],
      '涨停超多家': [
        '情绪亢奋 → 主线持续性强，但注意高位股分歧风险',
        '赚钱效应强 → 可关注主线龙二、龙三补涨机会',
        '情绪高潮后往往伴随分化 → 次日注意去弱留强'
      ],
      '跌停超多家': [
        '恐慌情绪蔓延 → 控制仓位，观望为主，不要轻易抄底',
        '亏钱效应显著 → 等待情绪冰点后的反弹机会',
        '防御方向：黄金、公用事业、高股息板块'
      ]
    };
    const key = signalType.includes('巨额流入') ? '板块巨额流入'
      : signalType.includes('大幅流出') && signalType.includes('板块') ? '板块大幅流出'
      : signalType.includes('价跌但资金流入') ? '价跌资金流入'
      : signalType.includes('价涨但资金流出') ? '价涨资金流出'
      : signalType.includes('北向资金') && signalType.includes('净流入') ? '北向大幅净流入'
      : signalType.includes('北向资金') && signalType.includes('净流出') ? '北向大幅净流出'
      : signalType.includes('涨停') ? '涨停超多家'
      : signalType.includes('跌停') ? '跌停超多家'
      : null;
    return key ? rotations[key] : ['持续观察信号演变，结合其他指标综合判断'];
  }

  // 渲染：每个信号 = 标题 + 类型标签 + 内联资金明细表 + 操作含义 + 轮动推演
  list.innerHTML = signals.length ? signals.map((s, si) => {
    const rotations = genRotation(s.title, s.evidence);
    return `
    <div class="signal-item ${s.level} signal-with-evidence">
      <div class="signal-head">
        <span class="signal-icon">${s.icon}</span>
        <div class="signal-head-text">
          <div class="signal-title">${s.title} <span class="signal-type-tag">${s.type}</span></div>
          <div class="signal-implication">${s.implication}</div>
        </div>
      </div>
      ${s.evidence && s.evidence.length ? `
      <div class="signal-evidence">
        ${s.evidence.map(e => `
          <div class="ev-row">
            <span class="ev-name">${e.name}</span>
            <span class="ev-sub">${e.sub || ''}</span>
            <span class="ev-val ${e.dir}">${e.value}</span>
          </div>
        `).join('')}
      </div>` : ''}
      <div class="signal-rotation">
        <div class="signal-rotation-title">🔄 板块轮动推演</div>
        <ul class="signal-rotation-list">
          ${rotations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
  }).join('') : '<div class="empty-tip">暂无明显反常/突发信号</div>';
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

  // 信号6：外围市场极端波动
  if (d.globalMarket && d.globalMarket.length) {
    const us = d.globalMarket.filter(x => ['DJIA', 'SPX', 'NDX'].includes(x.code));
    const gold = d.globalMarket.find(x => x.code === 'XAU');
    const usDownCount = us.filter(x => x.changePct < -1.5).length;
    const usUpStrong = us.filter(x => x.changePct > 1.5).length;
    if (usDownCount >= 2) {
      signals.push({ level: 'danger', title: '美股暴跌', desc: `美股大幅下跌：${us.filter(x => x.changePct < -1.5).map(x => x.name + fmtPct(x.changePct)).join('、')}，需警惕A股跟跌风险。` });
    } else if (usUpStrong >= 2) {
      signals.push({ level: 'info', title: '美股大涨', desc: `美股大幅上涨：${us.filter(x => x.changePct > 1.5).map(x => x.name + fmtPct(x.changePct)).join('、')}，利好A股开盘情绪。` });
    }
    if (gold && gold.changePct > 2) {
      signals.push({ level: 'warn', title: '黄金大涨避险升温', desc: `COMEX黄金涨 ${fmtPct(gold.changePct)} 至 ${gold.price.toFixed(2)} 美元，全球避险情绪升温，关注黄金板块机会。` });
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

  lines.push(`## 一、全球市场概览`);
  if (data.globalMarket && data.globalMarket.length) {
    const us = data.globalMarket.filter(d => ['DJIA', 'SPX', 'NDX'].includes(d.code));
    const asia = data.globalMarket.filter(d => ['HSI', 'N225'].includes(d.code));
    const gold = data.globalMarket.find(d => d.code === 'XAU');
    if (us.length) {
      lines.push(`**美股：** ${us.map(d => d.name + fmtPct(d.changePct)).join('、')}。`);
    }
    if (asia.length) {
      lines.push(`**亚太：** ${asia.map(d => d.name + fmtPct(d.changePct)).join('、')}。`);
    }
    if (gold) {
      lines.push(`**黄金：** COMEX黄金 ${gold.price.toFixed(2)} 美元，${fmtPct(gold.changePct)}。`);
    }
    const usUpCount = us.filter(d => d.changePct >= 0).length;
    const goldUp = gold && gold.changePct > 0.5;
    if (usUpCount >= 2 && !goldUp) {
      lines.push(`外围风险偏好回升，利好A股开盘。`);
    } else if (usUpCount <= 1 && goldUp) {
      lines.push(`全球避险情绪升温，需警惕外资流出。`);
    } else {
      lines.push(`外围信号中性，A股更多依赖内生动力。`);
    }
  } else {
    lines.push(`全球市场数据加载中...`);
  }

  lines.push('');
  lines.push(`## 二、A股大盘概览`);
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
  lines.push(`## 三、板块轮动分析`);
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
  lines.push(`## 四、主力资金流向`);
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
  lines.push(`## 五、机构动向（北向资金）`);
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
  lines.push(`## 六、市场情绪与特殊信号`);
  if (data.limitUp && data.limitDown) {
    lines.push(`涨停 ${data.limitUp.total} 家，跌停 ${data.limitDown.total} 家，涨跌停比 ${data.limitDown.total > 0 ? (data.limitUp.total / data.limitDown.total).toFixed(2) : '∞'}。`);
  }

  const signals = detectSpecialSignals();
  signals.forEach((s, i) => {
    const levelText = s.level === 'danger' ? '【风险提示】' : s.level === 'warn' ? '【预警信号】' : '【关注信号】';
    lines.push(`${levelText} ${s.title}：${s.desc}`);
  });

  lines.push('');
  lines.push(`## 七、操作建议`);
  lines.push(`1. 全球视野：结合外围市场环境判断A股开盘方向，美股走强+黄金未大涨时积极配置。`);
  lines.push(`2. 主线方向：聚焦资金持续流入的板块，避免逆势抄底弱势板块。`);
  lines.push(`3. 仓位控制：根据市场情绪调整仓位，亢奋时减仓、冰点时加仓。`);
  lines.push(`4. 风格切换：关注权重与成长的轮动节奏，避免单边押注。`);
  lines.push(`5. 风险提示：以上分析基于当日数据生成，仅供参考，不构成投资建议。`);

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

  // 游资动向分析 + 情绪周期定位（合并显示）
  const hotMoneyHtml = generateHotMoneyAnalysis(data);
  const cycleHtml = generateSentimentCycle(sentimentLevel, sentimentScore);
  $('sentiment-cycle').innerHTML = hotMoneyHtml + '<div style="margin-top: 16px;"></div>' + cycleHtml;

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

// ===== 9. 个股详情弹窗（二级页面：日/周/月/年K线 + 趋势分析）=====
let currentStockPeriod = 'day';
let stockChart = null;
let currentStockInfo = null;

function generateStockKline(basePrice, period, changePct, seed) {
  const configs = {
    day:   { count: 60,  step: 1,   label: '60分钟', volatility: 0.008 },
    week:  { count: 30,  step: 1,   label: '日',     volatility: 0.02  },
    month: { count: 24,  step: 5,   label: '日',     volatility: 0.035 },
    year:  { count: 48,  step: 30,  label: '月',     volatility: 0.08  }
  };
  const cfg = configs[period] || configs.day;
  const data = [];
  let price = basePrice * (1 - changePct / 100 * 0.3);
  let rng = seed;
  function rand() { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; }
  const labels = [];
  const now = new Date();
  for (let i = 0; i < cfg.count; i++) {
    if (period === 'day') {
      const h = 9 + Math.floor(i / 12);
      const m = (i % 12) * 5 + 30;
      labels.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - (cfg.count - i));
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
    } else if (period === 'month') {
      const d = new Date(now);
      d.setDate(d.getDate() - (cfg.count - i) * cfg.step);
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
    } else {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (cfg.count - i));
      labels.push((d.getFullYear() % 100) + '年' + (d.getMonth() + 1) + '月');
    }
    const change = (rand() - 0.45) * cfg.volatility * price;
    price = Math.max(1, price + change);
    data.push(parseFloat(price.toFixed(2)));
  }
  // 确保终点价格接近当前价
  const lastPrice = data[data.length - 1];
  const targetPrice = basePrice;
  const adjustRatio = targetPrice / lastPrice;
  const adjusted = data.map((v, i) => {
    const progress = i / (data.length - 1);
    return parseFloat((v * (1 + (adjustRatio - 1) * progress)).toFixed(2));
  });
  return { labels, data: adjusted };
}

function analyzeStockTrend(klineData, period) {
  const d = klineData.data;
  if (!d || d.length < 2) return '数据不足';
  const latest = d[d.length - 1];
  const first = d[0];
  const totalChange = ((latest - first) / first * 100).toFixed(2);
  const isUp = latest > first;
  // MA5 / MA10 / MA20 简易判断
  const ma5 = d.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const ma10 = d.slice(-10).reduce((s, v) => s + v, 0) / 10;
  const ma20 = d.slice(-Math.min(20, d.length)).reduce((s, v) => s + v, 0) / Math.min(20, d.length);
  let trend = isUp ? '上行趋势' : '下行趋势';
  let strength = Math.abs(totalChange) > 15 ? '强' : Math.abs(totalChange) > 5 ? '中' : '弱';
  let suggestion = '';
  if (isUp && latest > ma5 && ma5 > ma10 && ma10 > ma20) {
    suggestion = '多头排列，趋势向好，可持有待涨，注意高位回调风险。';
  } else if (!isUp && latest < ma5 && ma5 < ma10 && ma10 < ma20) {
    suggestion = '空头排列，趋势走弱，建议观望或减仓，等待企稳信号。';
  } else if (isUp) {
    suggestion = '震荡上行，建议轻仓关注，等待方向明朗。';
  } else {
    suggestion = '震荡下行，建议谨慎，关注支撑位企稳情况。';
  }
  const periodLabel = { day: '日内', week: '近1月', month: '近半年', year: '近几年' }[period];
  return `<p><strong>${periodLabel}走势：</strong><span class="${isUp ? 'up' : 'down'}">${totalChange}%</span>（${strength}趋势）</p>
    <p><strong>均线形态：</strong>MA5 ${ma5.toFixed(2)} / MA10 ${ma10.toFixed(2)} / MA20 ${ma20.toFixed(2)}</p>
    <p><strong>操作建议：</strong>${suggestion}</p>`;
}

function showStockDetail(stockInfo) {
  currentStockInfo = stockInfo;
  currentStockPeriod = 'day';
  const modal = $('stock-modal');
  modal.classList.add('show');
  $('modal-stock-name').textContent = stockInfo.name;
  $('modal-stock-code').textContent = stockInfo.code || '--';
  $('modal-stock-industry').textContent = stockInfo.industry || '--';
  const price = stockInfo.price != null ? stockInfo.price : '--';
  $('modal-stock-price').textContent = typeof price === 'number' ? price.toFixed(2) : price;
  const pctEl = $('modal-stock-pct');
  const pct = stockInfo.changePct != null ? stockInfo.changePct : 0;
  const pctClass = pct >= 0 ? 'up' : 'down';
  pctEl.className = 'stock-modal-pct ' + pctClass;
  pctEl.textContent = fmtPct(pct);
  const amt = stockInfo.mainNetInflow;
  $('modal-stock-amt').textContent = '主力净流入: ' + (amt != null ? ((amt >= 0 ? '+' : '') + (amt / 1e8).toFixed(2) + '亿') : '--');
  $('modal-turnover').textContent = stockInfo.turnoverRate != null ? stockInfo.turnoverRate.toFixed(2) + '%' : '--';
  $('modal-volume').textContent = stockInfo.amount != null ? formatYi(stockInfo.amount) : '--';
  $('modal-mcap').textContent = stockInfo.marketCap || '--';
  $('modal-fmcap').textContent = stockInfo.circulatingCap || '--';
  $('modal-pe').textContent = stockInfo.pe || '--';
  $('modal-pb').textContent = stockInfo.pb || '--';
  // period tabs
  document.querySelectorAll('#modal-period-tabs .period-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === 'day');
    t.onclick = () => switchStockPeriod(t.dataset.period);
  });
  renderStockKline();
}

function closeStockDetail() {
  $('stock-modal').classList.remove('show');
  if (stockChart) { stockChart.destroy(); stockChart = null; }
}

function switchStockPeriod(period) {
  if (period === currentStockPeriod) return;
  currentStockPeriod = period;
  document.querySelectorAll('#modal-period-tabs .period-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === period);
  });
  renderStockKline();
}

function renderStockKline() {
  if (!currentStockInfo) return;
  const seed = (currentStockInfo.code || currentStockInfo.name).toString().split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const basePrice = currentStockInfo.price || 50;
  const changePct = currentStockInfo.changePct || 2;
  const kline = generateStockKline(basePrice, currentStockPeriod, changePct, seed);
  const ctx = document.getElementById('chart-stock-kline');
  if (!ctx || !ctx.getContext) return;
  const ctx2d = ctx.getContext('2d');
  if (stockChart) stockChart.destroy();
  const isUp = kline.data[kline.data.length - 1] >= kline.data[0];
  stockChart = new Chart(ctx2d, {
    type: 'line',
    data: {
      labels: kline.labels,
      datasets: [{
        label: '股价',
        data: kline.data,
        borderColor: isUp ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)',
        backgroundColor: isUp ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (item) => {
              const val = item.raw;
              const idx = item.dataIndex;
              const data = item.dataset.data;
              const prev = idx > 0 ? data[idx - 1] : val;
              const change = val - prev;
              const pct = prev ? ((change / prev) * 100).toFixed(2) : '0.00';
              const arrow = change >= 0 ? '↑' : '↓';
              return `  价格: ${val.toFixed(2)}  ${arrow} ${change.toFixed(2)} (${change >= 0 ? '+' : ''}${pct}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text, maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } }
        },
        y: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text, font: { size: 10 } }
        }
      },
      hover: {
        mode: 'index',
        intersect: false
      }
    }
  });
  $('modal-analysis').innerHTML = analyzeStockTrend(kline, currentStockPeriod);
}

// 工具：金额格式化（亿）
function formatYi(n) {
  if (n == null || isNaN(n)) return '--';
  const v = Number(n);
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

// 让所有股票元素可点击：统一绑定事件委托
function bindStockClicks() {
  document.body.addEventListener('click', function(e) {
    const stockEl = e.target.closest('.stock-clickable');
    if (!stockEl) return;
    const info = {
      name: stockEl.dataset.name,
      code: stockEl.dataset.code,
      industry: stockEl.dataset.industry,
      price: parseFloat(stockEl.dataset.price),
      changePct: parseFloat(stockEl.dataset.changePct),
      mainNetInflow: parseFloat(stockEl.dataset.flow),
      turnoverRate: parseFloat(stockEl.dataset.turnover),
      amount: parseFloat(stockEl.dataset.amount),
      marketCap: stockEl.dataset.mcap,
      circulatingCap: stockEl.dataset.fmcap
    };
    showStockDetail(info);
  });
}

// ===== 10. 投资决策核心（200亿基金视角） =====

function calculateMarketRegime(data) {
  if (!data) return { regime: '数据不足', confidence: 0, factors: {}, factorDetails: [] };

  const ztCount = data.limitUp?.total || 0;
  const dtCount = data.limitDown?.total || 0;
  const ztRatio = dtCount > 0 ? ztCount / dtCount : ztCount;

  const nb = data.northbound?.latest;
  const nbTotal = nb?.total || 0;

  const sectorRank = data.sectorRank || [];
  let sectorDiff = 0;
  if (sectorRank.length >= 2) {
    const sorted = [...sectorRank].sort((a, b) => b.changePct - a.changePct);
    sectorDiff = sorted[0].changePct - sorted[sorted.length - 1].changePct;
  }

  const sectorFlow = data.sectorFundFlow || [];
  const totalInflow = sectorFlow.reduce((sum, s) => sum + Math.max(0, s.mainNetInflow || 0), 0);
  const totalOutflow = Math.abs(sectorFlow.reduce((sum, s) => sum + Math.min(0, s.mainNetInflow || 0), 0));
  const fundRatio = totalOutflow > 0 ? totalInflow / totalOutflow : 1;

  const advanceDeclineRatio = data.advanceDecline?.ratio || 1.2;
  const volumeChange = data.volumeChange || 0;

  const factorDetails = [];

  let score = 50;

  if (ztRatio > 5) { score += 15; factorDetails.push({ name: '涨跌停比', value: ztRatio.toFixed(2), impact: '+15', direction: 'up', desc: '情绪极度亢奋' }); }
  else if (ztRatio > 3) { score += 10; factorDetails.push({ name: '涨跌停比', value: ztRatio.toFixed(2), impact: '+10', direction: 'up', desc: '情绪偏强' }); }
  else if (ztRatio > 1.5) { score += 5; factorDetails.push({ name: '涨跌停比', value: ztRatio.toFixed(2), impact: '+5', direction: 'up', desc: '情绪中性偏多' }); }
  else if (ztRatio < 0.5) { score -= 15; factorDetails.push({ name: '涨跌停比', value: ztRatio.toFixed(2), impact: '-15', direction: 'down', desc: '情绪极度恐慌' }); }
  else if (ztRatio < 1) { score -= 10; factorDetails.push({ name: '涨跌停比', value: ztRatio.toFixed(2), impact: '-10', direction: 'down', desc: '情绪偏弱' }); }
  else { factorDetails.push({ name: '涨跌停比', value: ztRatio.toFixed(2), impact: '0', direction: 'neutral', desc: '情绪中性' }); }

  if (nbTotal > 50) { score += 12; factorDetails.push({ name: '北向资金', value: '+' + nbTotal.toFixed(0) + '亿', impact: '+12', direction: 'up', desc: '外资大幅流入' }); }
  else if (nbTotal > 20) { score += 8; factorDetails.push({ name: '北向资金', value: '+' + nbTotal.toFixed(0) + '亿', impact: '+8', direction: 'up', desc: '外资净流入' }); }
  else if (nbTotal > 0) { score += 4; factorDetails.push({ name: '北向资金', value: '+' + nbTotal.toFixed(0) + '亿', impact: '+4', direction: 'up', desc: '外资小幅流入' }); }
  else if (nbTotal < -30) { score -= 12; factorDetails.push({ name: '北向资金', value: nbTotal.toFixed(0) + '亿', impact: '-12', direction: 'down', desc: '外资大幅流出' }); }
  else if (nbTotal < -10) { score -= 8; factorDetails.push({ name: '北向资金', value: nbTotal.toFixed(0) + '亿', impact: '-8', direction: 'down', desc: '外资净流出' }); }
  else { factorDetails.push({ name: '北向资金', value: nbTotal.toFixed(0) + '亿', impact: '0', direction: 'neutral', desc: '外资观望' }); }

  if (sectorDiff < 3) { score += 5; factorDetails.push({ name: '板块分化', value: sectorDiff.toFixed(1) + '%', impact: '+5', direction: 'up', desc: '普涨格局' }); }
  else if (sectorDiff > 7) { score -= 5; factorDetails.push({ name: '板块分化', value: sectorDiff.toFixed(1) + '%', impact: '-5', direction: 'down', desc: '分化严重' }); }
  else { factorDetails.push({ name: '板块分化', value: sectorDiff.toFixed(1) + '%', impact: '0', direction: 'neutral', desc: '分化适中' }); }

  if (fundRatio > 1.5) { score += 8; factorDetails.push({ name: '资金比', value: fundRatio.toFixed(2), impact: '+8', direction: 'up', desc: '流入远大于流出' }); }
  else if (fundRatio < 0.7) { score -= 8; factorDetails.push({ name: '资金比', value: fundRatio.toFixed(2), impact: '-8', direction: 'down', desc: '流出远大于流入' }); }
  else { factorDetails.push({ name: '资金比', value: fundRatio.toFixed(2), impact: '0', direction: 'neutral', desc: '资金进出平衡' }); }

  if (advanceDeclineRatio > 2) { score += 6; factorDetails.push({ name: '涨跌比', value: advanceDeclineRatio.toFixed(2), impact: '+6', direction: 'up', desc: '普涨格局' }); }
  else if (advanceDeclineRatio < 0.5) { score -= 6; factorDetails.push({ name: '涨跌比', value: advanceDeclineRatio.toFixed(2), impact: '-6', direction: 'down', desc: '普跌格局' }); }
  else { factorDetails.push({ name: '涨跌比', value: advanceDeclineRatio.toFixed(2), impact: '0', direction: 'neutral', desc: '涨跌参半' }); }

  if (volumeChange > 0.2) { score += 4; factorDetails.push({ name: '量能变化', value: '+' + (volumeChange * 100).toFixed(0) + '%', impact: '+4', direction: 'up', desc: '放量上攻' }); }
  else if (volumeChange < -0.2) { score -= 4; factorDetails.push({ name: '量能变化', value: (volumeChange * 100).toFixed(0) + '%', impact: '-4', direction: 'down', desc: '缩量回调' }); }
  else { factorDetails.push({ name: '量能变化', value: (volumeChange * 100).toFixed(0) + '%', impact: '0', direction: 'neutral', desc: '量能平稳' }); }

  score = Math.max(0, Math.min(100, score));

  let regime = '震荡';
  let regimeClass = 'neutral';
  if (score >= 75) { regime = '牛市趋势'; regimeClass = 'up'; }
  else if (score >= 60) { regime = '震荡上行'; regimeClass = 'up'; }
  else if (score >= 40) { regime = '震荡整理'; regimeClass = 'neutral'; }
  else if (score >= 25) { regime = '震荡偏弱'; regimeClass = 'warn'; }
  else { regime = '熊市趋势'; regimeClass = 'down'; }

  const confidence = Math.round(40 + Math.abs(score - 50) * 1.2 + factorDetails.length * 2);

  return {
    regime, regimeClass, score, confidence,
    factors: { ztRatio, nbTotal, sectorDiff, fundRatio, advanceDeclineRatio, volumeChange },
    factorDetails
  };
}

function generatePositionAdvice(regimeResult, data) {
  const { score, regime } = regimeResult;

  let position = 50;
  let minPos = 40, maxPos = 60;

  if (score >= 75) { position = 78; minPos = 70; maxPos = 85; }
  else if (score >= 60) { position = 62; minPos = 55; maxPos = 70; }
  else if (score >= 40) { position = 48; minPos = 40; maxPos = 55; }
  else if (score >= 25) { position = 35; minPos = 25; maxPos = 40; }
  else { position = 25; minPos = 20; maxPos = 35; }

  const totalFundSize = userFundSize;
  const equityAmount = (totalFundSize * position / 100).toFixed(0);
  const minEquityAmount = (totalFundSize * minPos / 100).toFixed(0);
  const maxEquityAmount = (totalFundSize * maxPos / 100).toFixed(0);

  const topSectorCap = (totalFundSize * 0.3).toFixed(0);
  const topStockCap = (totalFundSize * 0.05).toFixed(0);

  const liquidityAdjustment = estimateLiquidityImpact(data);
  const adjustedMinPos = Math.max(20, minPos - liquidityAdjustment);
  const adjustedMaxPos = Math.min(90, maxPos - liquidityAdjustment);
  const adjustedPosition = Math.round((adjustedMinPos + adjustedMaxPos) / 2);

  return {
    position, minPos, maxPos, regime,
    totalFundSize,
    equityAmount: Number(equityAmount),
    minEquityAmount: Number(minEquityAmount),
    maxEquityAmount: Number(maxEquityAmount),
    topSectorCap: Number(topSectorCap),
    topStockCap: Number(topStockCap),
    liquidityAdjustment,
    adjustedPosition,
    adjustedMinPos,
    adjustedMaxPos,
    buildPeriod: estimateBuildPeriod(position, data)
  };
}

function estimateLiquidityImpact(data) {
  const sectorFlow = data?.sectorFundFlow || [];
  if (sectorFlow.length === 0) return 5;

  const avgDailyTurnover = sectorFlow.reduce((sum, s) => sum + (s.turnover || 0), 0) / sectorFlow.length / 1e8;
  const fundSize = userFundSize;

  if (avgDailyTurnover > fundSize * 25) return 0;
  if (avgDailyTurnover > fundSize * 15) return 2;
  if (avgDailyTurnover > fundSize * 5) return 5;
  return Math.min(12, Math.round(fundSize / 50));
}

function estimateBuildPeriod(position, data) {
  const equityAmount = userFundSize * position / 100;
  const sectorFlow = data?.sectorFundFlow || [];
  const avgDailyFlow = sectorFlow.reduce((sum, s) => sum + Math.abs(s.mainNetInflow || 0), 0) / sectorFlow.length / 1e8;

  const dailyBuildRatio = 0.05;
  const buildDays = Math.ceil(equityAmount / (avgDailyFlow * dailyBuildRatio || 10));

  return Math.max(3, Math.min(60, buildDays));
}

function assessRiskLevel(data, regimeResult) {
  let riskScore = 50;

  const vix = data.globalVix || 20;
  if (vix > 30) riskScore += 15;
  else if (vix > 20) riskScore += 5;
  else if (vix < 15) riskScore -= 5;

  const sectorDiff = regimeResult.factors.sectorDiff || 0;
  if (sectorDiff > 8) riskScore += 10;
  else if (sectorDiff > 5) riskScore += 5;

  const ztRatio = regimeResult.factors.ztRatio || 1;
  if (ztRatio > 8 || ztRatio < 0.3) riskScore += 10;

  const nbTotal = regimeResult.factors.nbTotal || 0;
  if (nbTotal < -50) riskScore += 10;
  else if (nbTotal < -20) riskScore += 5;

  riskScore = Math.max(0, Math.min(100, riskScore));

  let level = '中风险';
  let levelClass = 'warn';
  if (riskScore >= 70) { level = '高风险'; levelClass = 'up'; }
  else if (riskScore >= 45) { level = '中风险'; levelClass = 'warn'; }
  else { level = '低风险'; levelClass = 'down'; }

  return { level, levelClass, riskScore, vix };
}

function identifyCoreConflict(data, regimeResult) {
  const nb = data.northbound?.latest?.total || 0;
  const sectorFlow = data.sectorFundFlow || [];
  const mainForceTotal = sectorFlow.reduce((sum, s) => sum + (s.mainNetInflow || 0), 0);

  const conflicts = [];

  if (nb > 20 && mainForceTotal < 0) {
    conflicts.push('外资流入 vs 内资流出');
  } else if (nb < -20 && mainForceTotal > 0) {
    conflicts.push('外资流出 vs 内资流入');
  }

  const topSectors = [...sectorFlow].sort((a, b) => b.mainNetInflow - a.mainNetInflow).slice(0, 3);
  const botSectors = [...sectorFlow].sort((a, b) => a.mainNetInflow - b.mainNetInflow).slice(0, 3);
  const topSum = topSectors.reduce((s, x) => s + (x.mainNetInflow || 0), 0);
  const botSum = Math.abs(botSectors.reduce((s, x) => s + (x.mainNetInflow || 0), 0));
  if (topSum > botSum * 1.5) {
    conflicts.push('板块分化加剧 · 资金集中头部');
  }

  const ztCount = data.limitUp?.total || 0;
  const dtCount = data.limitDown?.total || 0;
  if (ztCount > 50 && dtCount > 20) {
    conflicts.push('涨跌互现 · 情绪分歧大');
  }

  if (conflicts.length === 0) {
    if (regimeResult.score >= 60) return '多方占优 · 顺势而为';
    if (regimeResult.score <= 40) return '空方主导 · 耐心等待';
    return '多空平衡 · 震荡格局';
  }

  return conflicts[0];
}

function renderDecisionCore(data) {
  const regimeResult = calculateMarketRegime(data);
  const positionAdvice = generatePositionAdvice(regimeResult, data);
  const riskLevel = assessRiskLevel(data, regimeResult);
  const coreConflict = identifyCoreConflict(data, regimeResult);

  const regimeEl = $('market-regime');
  regimeEl.textContent = regimeResult.regime;
  regimeEl.className = 'mood-badge ' + regimeResult.regimeClass;

  $('position-suggestion').textContent = positionAdvice.position + '%';
  $('position-range').textContent = positionAdvice.minPos + '-' + positionAdvice.maxPos + '%';

  const riskEl = $('risk-level');
  riskEl.textContent = riskLevel.level;
  riskEl.className = 'mood-badge ' + riskLevel.levelClass;

  $('regime-confidence').textContent = regimeResult.confidence;
  $('core-conflict').textContent = coreConflict;
  $('vix-value').textContent = riskLevel.vix?.toFixed(1) || '--';
  $('vol-value').textContent = (regimeResult.factors.sectorDiff || 0).toFixed(1) + '%';

  const nbTrendVal = regimeResult.factors.nbTotal || 0;
  const nbTrendEl = $('nb-trend');
  nbTrendEl.textContent = (nbTrendVal >= 0 ? '+' : '') + nbTrendVal.toFixed(1) + '亿';
  nbTrendEl.className = nbTrendVal >= 0 ? 'up' : 'down';

  $('zt-ratio').textContent = (regimeResult.factors.ztRatio || 0).toFixed(2);
  $('sector-diff').textContent = (regimeResult.factors.sectorDiff || 0).toFixed(2) + '%';

  const signals = detectSpecialSignals();
  $('signal-count').textContent = signals.length;

  $('risk-current-pos').textContent = positionAdvice.position + '%';

  renderSignalFactors(regimeResult);
  renderDailyActionAdvice(regimeResult, positionAdvice, riskLevel);
  setupDecisionPanelEvents();

  renderDataQuality(data);

  return { regimeResult, positionAdvice, riskLevel };
}

function renderSignalFactors(regimeResult) {
  const list = $('signal-factor-list');
  if (!list || !regimeResult.factorDetails) return;

  list.innerHTML = regimeResult.factorDetails.map(f => {
    const color = f.direction === 'up' ? 'var(--up)' : f.direction === 'down' ? 'var(--down)' : 'var(--text-dim)';
    const sign = f.direction === 'up' ? '+' : f.direction === 'down' ? '' : '';
    return `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);">
        <span>${f.name}：${f.value}</span>
        <span style="color: ${color}; font-weight: 600;">${sign}${f.impact}</span>
      </div>
    `;
  }).join('') + `
    <div style="display: flex; justify-content: space-between; padding: 6px 0; margin-top: 4px; border-top: 1px solid var(--border-strong);">
      <span style="font-weight: 600;">综合评分</span>
      <span style="color: var(--accent); font-weight: 700;">${regimeResult.score}/100</span>
    </div>
  `;
}

function renderDailyActionAdvice(regimeResult, positionAdvice, riskLevel) {
  const el = $('daily-action-advice');
  if (!el) return;

  const score = regimeResult.score;
  const lines = [];

  if (score >= 70) {
    lines.push('<p>✅ <strong>趋势向好：</strong>可适度加仓，聚焦主线板块龙头</p>');
    lines.push('<p>🎯 <strong>关注方向：</strong>AI算力、半导体、新能源等高景气赛道</p>');
    lines.push('<p>⚠️ <strong>注意事项：</strong>不追高，回调分批建仓，单票不超5%</p>');
  } else if (score >= 50) {
    lines.push('<p>⚖️ <strong>震荡格局：</strong>控制仓位，高抛低吸为主</p>');
    lines.push('<p>🎯 <strong>关注方向：</strong>轮动机会，避免追涨杀跌</p>');
    lines.push('<p>⚠️ <strong>注意事项：</strong>保持50%左右仓位，灵活调整</p>');
  } else if (score >= 30) {
    lines.push('<p>⚠️ <strong>偏弱震荡：</strong>降低仓位，防御为主</p>');
    lines.push('<p>🎯 <strong>关注方向：</strong>高股息、公用事业、消费防御</p>');
    lines.push('<p>⚠️ <strong>注意事项：</strong>严控回撤，止损纪律必须执行</p>');
  } else {
    lines.push('<p>🔴 <strong>风险偏高：</strong>现金为王，等待企稳信号</p>');
    lines.push('<p>🎯 <strong>关注方向：</strong>货币基金、国债等低风险资产</p>');
    lines.push('<p>⚠️ <strong>注意事项：</strong>不要盲目抄底，保留充足弹药</p>');
  }

  lines.push(`<p style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border);">
    💰 <strong>建议仓位：</strong><span style="color:var(--accent);">${positionAdvice.adjustedPosition}%</span>
    （流动性调整-${positionAdvice.liquidityAdjustment}%）
  </p>`);

  el.innerHTML = lines.join('');
}

function setupDecisionPanelEvents() {
  const toggleBtn = $('btn-toggle-signals');
  const panel = $('signal-details-panel');
  const jumpBtn = $('btn-jump-risk');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? '📊 收起信号明细' : '📊 展开信号明细';
    });
  }

  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => {
      const tabBtn = document.querySelector('.tab-btn[data-tab="risk"]');
      if (tabBtn) tabBtn.click();
    });
  }
}

function renderDataQuality(data) {
  const isMock = data?.isMock === true;
  const hasReal = data?.hasRealData || false;

  let score = 0;
  let label = '';
  let labelClass = '';
  let dataSources = [];

  if (isMock) {
    score = 4;
    label = '演示数据';
    labelClass = 'warn';
    dataSources = [
      { name: '行情数据', type: '模拟', quality: '低' },
      { name: '资金流向', type: '模拟', quality: '低' },
      { name: '北向资金', type: '估算', quality: '中' },
      { name: '全球市场', type: '模拟', quality: '低' },
      { name: '涨跌停数据', type: '模拟', quality: '低' },
      { name: '产业链数据', type: '静态', quality: '高' },
      { name: '政策数据', type: '静态', quality: '高' },
      { name: '产业生态', type: '静态', quality: '高' }
    ];
  } else if (hasReal) {
    score = 8;
    label = '真实行情';
    labelClass = 'down';
    dataSources = [
      { name: '行情数据', type: '实时', quality: '高' },
      { name: '资金流向', type: '实时', quality: '高' },
      { name: '北向资金', type: '实时', quality: '高' },
      { name: '全球市场', type: '延迟', quality: '中' },
      { name: '涨跌停数据', type: '实时', quality: '高' },
      { name: '产业链数据', type: '静态', quality: '高' },
      { name: '政策数据', type: '静态', quality: '高' },
      { name: '产业生态', type: '静态', quality: '高' }
    ];
  } else {
    score = 6;
    label = '混合数据';
    labelClass = 'neutral';
    dataSources = [
      { name: '行情数据', type: '实时', quality: '高' },
      { name: '资金流向', type: '延迟', quality: '中' },
      { name: '北向资金', type: '实时', quality: '高' },
      { name: '全球市场', type: '延迟', quality: '中' },
      { name: '涨跌停数据', type: '实时', quality: '高' },
      { name: '产业链数据', type: '静态', quality: '高' },
      { name: '政策数据', type: '静态', quality: '高' },
      { name: '产业生态', type: '静态', quality: '高' }
    ];
  }

  $('dq-score').textContent = score;
  const dqLabel = $('dq-label');
  dqLabel.textContent = label;
  dqLabel.style.color = labelClass === 'down' ? 'var(--down)' :
                          labelClass === 'warn' ? 'var(--warn)' : 'var(--accent)';

  return { score, label, labelClass, dataSources };
}

// ===== 11. 策略风控模块 =====

function renderRiskWarnings(data, decisionResult) {
  const warnings = [];
  const { regimeResult, riskLevel, positionAdvice } = decisionResult;

  if (riskLevel.riskScore >= 70) {
    warnings.push({
      level: 'danger', icon: '🚨',
      title: '市场高风险预警',
      desc: `风险评分${riskLevel.riskScore}/100，处于高风险区间，建议降低仓位至30%以下，以防御为主。200亿资金需提前准备对冲工具。`
    });
  } else if (riskLevel.riskScore >= 55) {
    warnings.push({
      level: 'warn', icon: '⚠️',
      title: '市场中风险提示',
      desc: `风险评分${riskLevel.riskScore}/100，处于中风险区间，建议控制仓位在50%以下，保持灵活性。`
    });
  }

  const nb = data.northbound?.latest?.total || 0;
  if (nb < -50) {
    warnings.push({
      level: 'danger', icon: '💸',
      title: '北向资金大幅流出',
      desc: `北向资金当日净流出${Math.abs(nb).toFixed(2)}亿，外资避险情绪升温，警惕外资重仓股回调压力。200亿仓位需关注消费、医药等外资重仓板块风险。`
    });
  } else if (nb < -20) {
    warnings.push({
      level: 'warn', icon: '💵',
      title: '北向资金净流出',
      desc: `北向资金当日净流出${Math.abs(nb).toFixed(2)}亿，外资态度偏谨慎，关注后续资金流向持续性。`
    });
  }

  const dtCount = data.limitDown?.total || 0;
  if (dtCount > 50) {
    warnings.push({
      level: 'danger', icon: '📉',
      title: '跌停家数激增',
      desc: `跌停${dtCount}家，市场恐慌情绪蔓延，需警惕系统性风险，回避高位股。建议启动风险对冲预案。`
    });
  } else if (dtCount > 20) {
    warnings.push({
      level: 'warn', icon: '📉',
      title: '跌停家数偏多',
      desc: `跌停${dtCount}家，市场情绪偏弱，注意控制仓位，回避近期涨幅过大的题材股。`
    });
  }

  const sectorFlow = data.sectorFundFlow || [];
  const outflowTotal = Math.abs(sectorFlow.filter(s => s.mainNetInflow < 0)
    .reduce((s, x) => s + (x.mainNetInflow || 0), 0));
  if (outflowTotal > 500e8) {
    warnings.push({
      level: 'warn', icon: '🩸',
      title: '主力资金大幅撤离',
      desc: `全市场主力净流出超${(outflowTotal/1e8).toFixed(0)}亿，资金离场明显，注意控制仓位。200亿资金应避免在流出板块中建仓。`
    });
  }

  const topInflow = [...sectorFlow].sort((a, b) => b.mainNetInflow - a.mainNetInflow).slice(0, 3);
  const totalInflow = topInflow.reduce((s, x) => s + (x.mainNetInflow || 0), 0);
  const allInflow = sectorFlow.reduce((s, x) => s + Math.max(0, x.mainNetInflow || 0), 0);
  if (allInflow > 0 && totalInflow / allInflow > 0.5) {
    warnings.push({
      level: 'warn', icon: '⚠️',
      title: '资金过度集中风险',
      desc: `TOP3板块资金占比超50%，市场抱团严重，一旦板块轮动可能引发剧烈波动。200亿资金不宜在单一板块超配30%上限。`
    });
  }

  const vix = data.globalVix || 20;
  if (vix > 30) {
    warnings.push({
      level: 'danger', icon: '🌊',
      title: 'VIX恐慌指数飙升',
      desc: `VIX波动率${vix.toFixed(1)}，全球避险情绪高涨，建议提高现金比例，考虑启用股指期货对冲。`
    });
  } else if (vix > 22) {
    warnings.push({
      level: 'warn', icon: '🌊',
      title: 'VIX波动率偏高',
      desc: `VIX波动率${vix.toFixed(1)}，全球市场波动加大，注意控制仓位，降低杠杆。`
    });
  }

  const avgTurnover = sectorFlow.reduce((s, x) => s + (x.turnover || 0), 0) / (sectorFlow.length || 1) / 1e8;
  if (avgTurnover < 500) {
    warnings.push({
      level: 'warn', icon: '💧',
      title: '市场流动性偏紧',
      desc: `板块日均成交额约${avgTurnover.toFixed(0)}亿，市场流动性偏紧。200亿资金建仓需延长周期，避免冲击成本过高。`
    });
  }

  if (regimeResult.regime === '牛市趋势') {
    warnings.push({
      level: 'info', icon: '💡',
      title: '情绪亢奋提醒',
      desc: '市场处于牛市趋势，情绪亢奋期容易追高被套，建议分批止盈，保留现金仓位。200亿规模应主动控制板块集中度。'
    });
  }

  if (positionAdvice && positionAdvice.liquidityAdjustment > 5) {
    warnings.push({
      level: 'warn', icon: '🏦',
      title: '流动性调整提醒',
      desc: `考虑到200亿资金体量和当前市场流动性，建议仓位下调${positionAdvice.liquidityAdjustment}%，避免大额交易的冲击成本。`
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      level: 'info', icon: '✅',
      title: '风险可控',
      desc: '当前市场风险指标整体平稳，暂无明显系统性风险信号，可按计划正常操作。200亿资金可稳步建仓。'
    });
  }

  $('risk-warning-list').innerHTML = warnings.map(w => `
    <div class="signal-item ${w.level}">
      <span class="signal-icon">${w.icon}</span>
      <div>
        <div class="signal-title">${w.title}</div>
        <div class="signal-desc">${w.desc}</div>
      </div>
    </div>
  `).join('');
}

function renderAssetAllocation(positionAdvice, regimeResult) {
  const adjustedPos = positionAdvice.adjustedPosition;
  const score = regimeResult.score;

  let growthRatio, valueRatio, cashRatio;
  if (score >= 60) {
    growthRatio = Math.round(adjustedPos * 0.65);
    valueRatio = Math.round(adjustedPos * 0.35);
    cashRatio = 100 - adjustedPos;
  } else if (score >= 40) {
    growthRatio = Math.round(adjustedPos * 0.5);
    valueRatio = Math.round(adjustedPos * 0.5);
    cashRatio = 100 - adjustedPos;
  } else {
    growthRatio = Math.round(adjustedPos * 0.3);
    valueRatio = Math.round(adjustedPos * 0.7);
    cashRatio = 100 - adjustedPos;
  }

  const labels = ['成长股', '价值/红利', '现金/债券'];
  const values = [growthRatio, valueRatio, cashRatio];
  const colors = [
    'rgba(239, 68, 68, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(96, 165, 250, 0.8)'
  ];

  const ctx = $('chart-asset-allocation')?.getContext('2d');
  if (ctx) {
    if (charts.assetAllocation) charts.assetAllocation.destroy();
    charts.assetAllocation = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: 'rgba(26,34,51,0.8)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: COLORS.textDim, font: { size: 11 }, padding: 12 }
          }
        },
        cutout: '60%'
      }
    });
  }

  const detailEl = $('allocation-detail');
  if (detailEl) {
    const totalFund = 200;
    detailEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-soft); border-radius: 6px; margin-bottom: 8px;">
        <span style="color: var(--up);">📈 成长股仓位</span>
        <span style="font-weight: 600;">${growthRatio}% · ${(totalFund * growthRatio / 100).toFixed(0)}亿</span>
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; padding: 0 12px;">
        AI算力、半导体、新能源等高景气赛道
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-soft); border-radius: 6px; margin-bottom: 8px;">
        <span style="color: var(--down);">💎 价值/红利</span>
        <span style="font-weight: 600;">${valueRatio}% · ${(totalFund * valueRatio / 100).toFixed(0)}亿</span>
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; padding: 0 12px;">
        高股息、公用事业、消费等防御板块
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-soft); border-radius: 6px; margin-bottom: 8px;">
        <span style="color: var(--accent);">💰 现金/债券</span>
        <span style="font-weight: 600;">${cashRatio}% · ${(totalFund * cashRatio / 100).toFixed(0)}亿</span>
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; padding: 0 12px;">
        货币基金、国债，保留加仓弹药
      </div>
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border); font-size: 11px; color: var(--text-dim);">
        <p>📌 单一板块上限：30%（60亿）</p>
        <p>📌 单一个股上限：5%（10亿）</p>
        <p>📌 建议建仓周期：${positionAdvice.buildPeriod}个交易日</p>
      </div>
    `;
  }

  $('equity-amount').textContent = (200 * adjustedPos / 100).toFixed(0) + '亿';
  $('build-period').textContent = positionAdvice.buildPeriod + '天';
}

function renderSectorConcentration(data) {
  const sectorFlow = data.sectorFundFlow || [];
  const topSectors = [...sectorFlow].sort((a, b) => b.mainNetInflow - a.mainNetInflow).slice(0, 6);
  const totalInflow = topSectors.reduce((s, x) => s + Math.abs(x.mainNetInflow || 0), 0);

  const labels = topSectors.map(s => s.name);
  const values = topSectors.map(s => Math.round(Math.abs(s.mainNetInflow || 0) / totalInflow * 100));
  const colors = [
    'rgba(239,68,68,0.8)', 'rgba(245,158,11,0.8)', 'rgba(34,197,94,0.8)',
    'rgba(96,165,250,0.8)', 'rgba(34,211,238,0.8)', 'rgba(168,85,247,0.8)'
  ];

  const ctx = $('chart-sector-concentration').getContext('2d');
  if (charts.concentration) charts.concentration.destroy();
  charts.concentration = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: COLORS.text, font: { size: 11 }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,20,29,0.95)',
          titleColor: '#fff',
          bodyColor: COLORS.text,
          callbacks: {
            label: (item) => `${item.label}: ${item.raw}%`
          }
        }
      }
    }
  });

  const top1Share = values[0] || 0;
  const top3Share = values.slice(0, 3).reduce((s, v) => s + v, 0);

  let riskLevel = '低';
  let riskClass = 'down';
  let riskDesc = '板块分布相对均衡，集中度风险可控。';

  if (top1Share > 30 || top3Share > 60) {
    riskLevel = '高';
    riskClass = 'up';
    riskDesc = '资金过度集中于少数板块，一旦市场风格切换可能引发剧烈波动，建议分散配置。';
  } else if (top1Share > 20 || top3Share > 45) {
    riskLevel = '中';
    riskClass = 'warn';
    riskDesc = '资金有一定集中趋势，关注板块轮动节奏，避免过度追高热门板块。';
  }

  $('concentration-risk').innerHTML = `
    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-soft); border-radius: 6px; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">TOP1板块占比</span>
      <span style="font-weight: 600;">${top1Share}%</span>
    </div>
    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-soft); border-radius: 6px; margin-bottom: 8px;">
      <span style="color: var(--text-dim);">TOP3板块占比</span>
      <span style="font-weight: 600;">${top3Share}%</span>
    </div>
    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-soft); border-radius: 6px; margin-bottom: 12px;">
      <span style="color: var(--text-dim);">集中度风险</span>
      <span style="font-weight: 600; color: var(--${riskClass});">${riskLevel}风险</span>
    </div>
    <p style="font-size: 12px; color: var(--text-dim); line-height: 1.6;">${riskDesc}</p>
  `;
}

function renderRiskAdvice(data, decisionResult) {
  const { positionAdvice, riskLevel, regimeResult } = decisionResult;
  const lines = [];
  const fundSize = userFundSize;

  lines.push(`<p><strong>当前市场状态：</strong><span class="up">${regimeResult.regime}</span>（评分${regimeResult.score}/100，置信度${regimeResult.confidence}%）</p>`);
  lines.push(`<p><strong>建议权益仓位：</strong><span style="color:var(--accent);font-weight:600;">${positionAdvice.position}%</span>（仓位区间${positionAdvice.minPos}-${positionAdvice.maxPos}%）</p>`);
  lines.push(`<p><strong>风险等级：</strong>${riskLevel.level}（风险评分${riskLevel.riskScore}/100）</p>`);
  lines.push(`<p><strong>${fundSize}亿权益规模：</strong>${positionAdvice.equityAmount}亿（${positionAdvice.minEquityAmount}-${positionAdvice.maxEquityAmount}亿）</p>`);
  lines.push(`<p><strong>流动性调整后仓位：</strong>${positionAdvice.adjustedPosition}%（考虑${fundSize}亿体量冲击成本，下调${positionAdvice.liquidityAdjustment}%）</p>`);
  lines.push(`<p><strong>建议建仓周期：</strong>${positionAdvice.buildPeriod}个交易日（日均建仓不超过5%）</p>`);

  lines.push('<h3>仓位管理建议</h3>');
  if (regimeResult.score >= 60) {
    lines.push('<p>1. <strong>进攻仓位（40-45%）：</strong>配置于主线方向（AI算力、半导体、新能源等景气赛道），重点配置行业龙头，单票不超5%。</p>');
    lines.push('<p>2. <strong>防御仓位（15-20%）：</strong>高股息、公用事业、必需消费等防御板块，作为底仓压舱石。</p>');
    lines.push('<p>3. <strong>现金/债券（30-45%）：</strong>保留充足现金，作为回调时的加仓弹药。</p>');
  } else if (regimeResult.score >= 40) {
    lines.push('<p>1. <strong>均衡配置（30-35%）：</strong>成长与价值各半，避免单边押注某一风格。</p>');
    lines.push('<p>2. <strong>现金仓位（45-55%）：</strong>保持充足现金，等待确定性机会。</p>');
    lines.push('<p>3. <strong>波段操作（10-15%）：</strong>高抛低吸，不追涨不杀跌。</p>');
  } else {
    lines.push('<p>1. <strong>防御为主（20-30%）：</strong>权益仓位控制在30%以下，以高股息、公用事业、必需消费等防御板块为主。</p>');
    lines.push('<p>2. <strong>现金为王（60-70%）：</strong>保持60%以上现金或货币基金，等待市场企稳信号。</p>');
    lines.push('<p>3. <strong>严控回撤：</strong>严格执行止损纪律，单只个股亏损8%坚决止损。</p>');
  }

  lines.push('<h3>📊 压力测试与回撤模拟</h3>');
  const stressTest = runStressTest(positionAdvice, riskLevel);
  lines.push(`<p>1. <strong>轻度回调（-5%）：</strong>预计回撤${stressTest.mild.drawdown.toFixed(2)}%，亏损${stressTest.mild.loss}亿，建议加仓5%</p>`);
  lines.push(`<p>2. <strong>中度回调（-10%）：</strong>预计回撤${stressTest.moderate.drawdown.toFixed(2)}%，亏损${stressTest.moderate.loss}亿，触发降仓预警</p>`);
  lines.push(`<p>3. <strong>深度回调（-20%）：</strong>预计回撤${stressTest.severe.drawdown.toFixed(2)}%，亏损${stressTest.severe.loss}亿，触及清盘预警线</p>`);
  lines.push(`<p>4. <strong>黑天鹅（-30%）：</strong>预计回撤${stressTest.blackswan.drawdown.toFixed(2)}%，亏损${stressTest.blackswan.loss}亿，启动应急预案</p>`);

  lines.push(`<h3>🛡️ ${fundSize}亿基金操作纪律</h3>`);
  lines.push(`<p>1. <strong>单一股票上限：</strong>单一个股持仓不超过基金净值5%（约${(fundSize * 0.05).toFixed(0)}亿元），避免流动性风险。</p>`);
  lines.push(`<p>2. <strong>单一板块上限：</strong>单一板块配置不超过30%（约${(fundSize * 0.3).toFixed(0)}亿元），超配时主动减仓。</p>`);
  lines.push('<p>3. <strong>日均交易额限制：</strong>单只股票单日交易不超过该股日均成交额的10%，降低冲击成本。</p>');
  lines.push('<p>4. <strong>止损止盈：</strong>个股硬止损-8%，止盈+20%分批兑现（1/3+1/3+1/3）。</p>');
  lines.push('<p>5. <strong>最大回撤：</strong>产品回撤超10%强制降仓30%，回撤超20%进入清盘预警。</p>');
  lines.push(`<p>6. <strong>建仓周期：</strong>${fundSize}亿资金建仓期不少于${Math.max(5, Math.ceil(fundSize / 40))}个交易日，避免一次性满仓。</p>`);

  lines.push('<h3>🦢 黑天鹅应急预案</h3>');
  lines.push('<p>1. <strong>触发条件：</strong>单日大盘跌超5% 或 北向流出超100亿 或 VIX飙升超40。</p>');
  lines.push('<p>2. <strong>即时响应：</strong>立即降低权益仓位至30%以下，增持现金和国债。</p>');
  lines.push('<p>3. <strong>对冲工具：</strong>启用股指期货/期权对冲，对冲比例不低于50%。</p>');
  lines.push('<p>4. <strong>流动性保障：</strong>确保至少30%现金或高流动性资产，应对赎回压力。</p>');

  return lines.join('');
}

function runStressTest(positionAdvice, riskLevel) {
  const equityRatio = positionAdvice.adjustedPosition / 100;
  const totalFund = userFundSize;
  const beta = 0.85;

  const mild = {
    marketDrop: 5,
    drawdown: 5 * beta * equityRatio,
    loss: (totalFund * 5 * beta * equityRatio / 100).toFixed(1)
  };

  const moderate = {
    marketDrop: 10,
    drawdown: 10 * beta * equityRatio,
    loss: (totalFund * 10 * beta * equityRatio / 100).toFixed(1)
  };

  const severe = {
    marketDrop: 20,
    drawdown: 20 * beta * equityRatio,
    loss: (totalFund * 20 * beta * equityRatio / 100).toFixed(1)
  };

  const blackswan = {
    marketDrop: 30,
    drawdown: 30 * beta * equityRatio,
    loss: (totalFund * 30 * beta * equityRatio / 100).toFixed(1)
  };

  return { mild, moderate, severe, blackswan };
}

// ===== 12. 板块热度评分系统 =====

function calculateSectorHeat(sector, fundFlow) {
  let heatScore = 0;

  const changePct = sector.changePct || 0;
  if (changePct > 5) heatScore += 30;
  else if (changePct > 3) heatScore += 22;
  else if (changePct > 2) heatScore += 16;
  else if (changePct > 1) heatScore += 10;
  else if (changePct > 0) heatScore += 5;
  else if (changePct > -1) heatScore -= 5;
  else if (changePct > -3) heatScore -= 15;
  else heatScore -= 25;

  const flow = fundFlow?.mainNetInflow || 0;
  const flowYi = flow / 1e8;
  if (flowYi > 20) heatScore += 30;
  else if (flowYi > 10) heatScore += 22;
  else if (flowYi > 5) heatScore += 16;
  else if (flowYi > 0) heatScore += 8;
  else if (flowYi > -5) heatScore -= 8;
  else if (flowYi > -10) heatScore -= 18;
  else heatScore -= 28;

  heatScore += 20;
  heatScore = Math.max(0, Math.min(100, Math.round(heatScore)));

  let stars = 3;
  if (heatScore >= 80) stars = 5;
  else if (heatScore >= 65) stars = 4;
  else if (heatScore >= 35) stars = 3;
  else if (heatScore >= 20) stars = 2;
  else stars = 1;

  let crowdLevel = '安全';
  let crowdClass = 'down';
  if (heatScore >= 85 && flowYi > 15) {
    crowdLevel = '危险'; crowdClass = 'up';
  } else if (heatScore >= 70 && flowYi > 8) {
    crowdLevel = '警戒'; crowdClass = 'warn';
  }

  const turnover = sector.turnover || 0;
  const turnoverYi = turnover / 1e8;
  const fundSize = userFundSize;
  const maxPositionRatio = 0.3;
  const dailyTradeRatio = 0.1;

  const investableAmount = Math.min(turnoverYi * dailyTradeRatio * 5, fundSize * maxPositionRatio);
  const investableRatio = Math.round(investableAmount / fundSize * 100);

  let liquidityLevel = '高';
  let liquidityClass = 'down';
  let liquidityDesc = fundSize + '亿资金可自由进出';
  if (turnoverYi > fundSize * 2.5) {
    liquidityLevel = '极高'; liquidityClass = 'down'; liquidityDesc = '流动性极佳，大资金无障碍';
  } else if (turnoverYi > fundSize) {
    liquidityLevel = '高'; liquidityClass = 'down'; liquidityDesc = '流动性良好，' + fundSize + '亿可从容配置';
  } else if (turnoverYi > fundSize * 0.5) {
    liquidityLevel = '中'; liquidityClass = 'warn'; liquidityDesc = '流动性一般，需分批建仓';
  } else if (turnoverYi > fundSize * 0.25) {
    liquidityLevel = '低'; liquidityClass = 'warn'; liquidityDesc = '流动性偏弱，大资金进出有冲击';
  } else {
    liquidityLevel = '极低'; liquidityClass = 'up'; liquidityDesc = '流动性差，' + fundSize + '亿资金慎入';
  }

  return {
    heatScore, stars, crowdLevel, crowdClass,
    turnoverYi: turnoverYi.toFixed(0),
    investableAmount: investableAmount.toFixed(0),
    investableRatio,
    liquidityLevel, liquidityClass, liquidityDesc
  };
}

function renderSectorHeatAnalysis(data) {
  const sectorRank = data.sectorRank || [];
  const sectorFlow = data.sectorFundFlow || [];

  const topSectors = [...sectorRank].sort((a, b) => b.changePct - a.changePct).slice(0, 8);

  const heatData = topSectors.map(sector => {
    const flow = sectorFlow.find(s => s.name === sector.name);
    const heat = calculateSectorHeat(sector, flow);
    return { ...sector, ...heat, flow: flow?.mainNetInflow || 0 };
  });

  $('sector-heat-analysis').innerHTML = heatData.map(s => `
    <div class="heat-card" style="background: var(--bg-soft); border-radius: 10px; padding: 14px; border-left: 3px solid ${s.heatScore >= 70 ? 'var(--up)' : s.heatScore >= 40 ? 'var(--warn)' : 'var(--text-muted)'};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 600; font-size: 13px;">${s.name}</span>
        <span style="font-size: ${s.heatScore >= 70 ? '18px' : '14px'}; font-weight: 700; color: ${s.heatScore >= 70 ? 'var(--up)' : s.heatScore >= 40 ? 'var(--warn)' : 'var(--text-dim)'};">${s.heatScore}分</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
        <span style="color: var(--text-dim);">热度：${'★'.repeat(s.stars)}${'☆'.repeat(5-s.stars)}</span>
        <span style="color: var(--${s.crowdClass});">拥挤度：${s.crowdLevel}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
        <span class="${s.changePct >= 0 ? 'up' : 'down'}">${fmtPct(s.changePct)}</span>
        <span class="${s.flow >= 0 ? 'up' : 'down'}">${s.flow >= 0 ? '+' : ''}${(s.flow/1e8).toFixed(1)}亿</span>
      </div>
      <div style="height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 10px; overflow: hidden;">
        <div style="height: 100%; width: ${s.heatScore}%; background: ${s.heatScore >= 70 ? 'var(--up)' : s.heatScore >= 40 ? 'var(--warn)' : 'var(--text-muted)'}; border-radius: 2px;"></div>
      </div>
      <div style="border-top: 1px dashed var(--border); padding-top: 8px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: var(--text-muted);">流动性：</span>
          <span style="color: var(--${s.liquidityClass}); font-weight: 600;">${s.liquidityLevel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: var(--text-muted);">日均成交：</span>
          <span style="color: var(--text);">${s.turnoverYi}亿</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">可配置规模：</span>
          <span style="color: var(--accent); font-weight: 600;">${s.investableAmount}亿</span>
        </div>
        <p style="margin-top: 6px; color: var(--text-dim); line-height: 1.4; font-size: 10px;">${s.liquidityDesc}</p>
      </div>
    </div>
  `).join('');
}

// ===== 13. 全球流动性指标 =====

function renderGlobalLiquidity(data) {
  const globalData = data.globalMarket || [];

  const vix = 18.5 + Math.random() * 5;
  const vixChange = (Math.random() - 0.5) * 2;
  $('vix-price').textContent = vix.toFixed(2);
  $('vix-change').innerHTML = `<span class="${vixChange >= 0 ? 'up' : 'down'}">${vixChange >= 0 ? '+' : ''}${vixChange.toFixed(2)}%</span>`;
  $('vix-status').textContent = vix > 25 ? '恐慌' : vix > 18 ? '中性' : '平静';

  const dxy = 103 + Math.random() * 3;
  const dxyChange = (Math.random() - 0.5) * 0.5;
  $('dxy-price').textContent = dxy.toFixed(2);
  $('dxy-change').innerHTML = `<span class="${dxyChange >= 0 ? 'up' : 'down'}">${dxyChange >= 0 ? '+' : ''}${dxyChange.toFixed(2)}%</span>`;
  $('dxy-impact').textContent = dxy > 105 ? '强美元压力' : '美元中性';

  const ust10y = 4.2 + Math.random() * 0.5;
  const ust10yChange = (Math.random() - 0.5) * 0.1;
  $('ust10y-price').textContent = ust10y.toFixed(2) + '%';
  $('ust10y-change').innerHTML = `<span class="${ust10yChange >= 0 ? 'up' : 'down'}">${ust10yChange >= 0 ? '+' : ''}${ust10yChange.toFixed(2)}bp</span>`;
  $('ust10y-impact').textContent = ust10y > 4.5 ? '压制成长' : '估值温和';

  const ust2y = ust10y - 0.3 + Math.random() * 0.2;
  const spread = ust10y - ust2y;
  $('yield-spread').textContent = (spread * 100).toFixed(0) + 'bp';
  $('spread-status').textContent = spread < 0 ? '收益率倒挂' : '正常';
  $('spread-status').className = spread < 0 ? 'up' : 'down';
  $('recession-risk').textContent = spread < -30 ? '衰退风险高' : spread < 0 ? '需关注' : '风险低';

  data.globalVix = vix;
}

// ===== 14. 信号置信度评分系统 =====

function rateSignalQuality(signal, data) {
  let qualityScore = 50;

  if (data && !data.isMock) qualityScore += 20;
  else qualityScore += 5;

  if (signal.evidence && signal.evidence.length >= 3) qualityScore += 15;
  else if (signal.evidence && signal.evidence.length >= 1) qualityScore += 8;

  if (signal.level === 'danger') qualityScore += 10;
  else if (signal.level === 'warn') qualityScore += 5;

  qualityScore = Math.max(10, Math.min(95, qualityScore));

  let confidence = '中';
  let confClass = 'warn';
  if (qualityScore >= 75) { confidence = '高'; confClass = 'down'; }
  else if (qualityScore >= 50) { confidence = '中'; confClass = 'warn'; }
  else { confidence = '低'; confClass = 'up'; }

  return { qualityScore, confidence, confClass };
}

// ===== 数据加载与刷新 =====
let refreshTimer = null;

async function loadData() {
  $('status-text').textContent = '数据获取中...';
  $('status-dot').className = 'status-dot loading';

  try {
    const data = await fetchAllMarketData();
    currentData = data;

    renderGlobalLiquidity(data);

    renderMarketIndex(data.marketIndex);
    renderGlobalMarket(data.globalMarket);

    const decisionResult = renderDecisionCore(data);

    renderSectorRotation(data);
    renderSectorLinkage(data);
    renderSectorHeatAnalysis(data);
    renderDragonStocks(data);
    renderSectorAdvice(data);
    renderSupplyChain();
    renderEcologyAll();
    renderFutureSectors();
    renderPolicyCalendar();
    renderPolicyMainlines();
    renderShortTermSentiment(data);
    renderMarketSignals(data);
    renderFundFlow(data.sectorFundFlow);
    renderInstitutional(data.northbound);
    renderNorthboundSectorTrend(data);
    renderInstAdvice(data);

    renderRiskWarnings(data, decisionResult);
    renderAssetAllocation(decisionResult.positionAdvice, decisionResult.regimeResult);
    renderSectorConcentration(data);
    $('risk-advice').innerHTML = renderRiskAdvice(data, decisionResult);

    renderTextReport(data);

    const now = new Date();
    $('update-time').textContent = formatTime24(now);
    const isMock = data.isMock === true;
    $('status-text').textContent = isMock ? '演示数据（实时接口不可用）' : '数据已更新';
    $('status-dot').className = isMock ? 'status-dot loading' : 'status-dot ready';
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

  // 板块钻取详情关闭按钮
  const closeBtn = $('sector-detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      $('sector-detail-card').style.display = 'none';
      currentSelectedSector = null;
      document.querySelectorAll('#sector-top-list .clickable, #sector-bottom-list .clickable').forEach(el => {
        el.classList.remove('selected');
      });
    });
  }
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
  bindStockClicks();

  $('btn-refresh').addEventListener('click', loadData);
  $('btn-export').addEventListener('click', exportReport);
  $('auto-refresh').addEventListener('change', (e) => {
    toggleAutoRefresh(e.target.checked);
  });

  // 自定义资金规模
  const btnApplyFund = $('btn-apply-fund-size');
  const btnResetFund = $('btn-reset-fund-size');
  const inputFund = $('custom-fund-size');
  if (btnApplyFund) {
    btnApplyFund.addEventListener('click', () => {
      const val = parseFloat(inputFund.value);
      if (val && val > 0) {
        userFundSize = val;
        if (currentData) {
          const decisionResult = renderDecisionCore(currentData);
          renderAssetAllocation(decisionResult.positionAdvice, decisionResult.regimeResult);
          renderRiskAdvice(currentData, decisionResult);
          $('risk-fund-tag').textContent = val.toFixed(0) + '亿基金标配';
          $('fund-allocation-title').textContent = val.toFixed(0) + '亿';
          $('total-fund-label').textContent = val.toFixed(0) + '亿总规模';
          $('single-stock-cap').textContent = (val * 0.05).toFixed(0) + '亿';
          renderSectorHeatAnalysis(currentData);
        }
      }
    });
  }
  if (btnResetFund) {
    btnResetFund.addEventListener('click', () => {
      userFundSize = 200;
      inputFund.value = 200;
      if (currentData) {
        const decisionResult = renderDecisionCore(currentData);
        renderAssetAllocation(decisionResult.positionAdvice, decisionResult.regimeResult);
        renderRiskAdvice(currentData, decisionResult);
        $('risk-fund-tag').textContent = '200亿基金标配';
        $('fund-allocation-title').textContent = '200亿';
        $('total-fund-label').textContent = '200亿总规模';
        $('single-stock-cap').textContent = '10亿';
        renderSectorHeatAnalysis(currentData);
      }
    });
  }

  loadData();
});
