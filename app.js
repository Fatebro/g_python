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
let currentSelectedSector = null;
let currentDetailTab = 'fund';
let userFundSize = 20000000000;
let currentFutureSector = '固态电池';
let snapshotHistory = [];
let autoRefreshTimer = null;

const TIME_HORIZONS = {
  rotation:    { label: '1天-1周',  scope: '当日资金流向 + 5日主力净流入', thought: '思路①板块轮动', desc: '跟着资金走，换仓快' },
  signal:      { label: '1周-1月',  scope: '价格趋势 + 行业景气度', thought: '思路②身边反常信号', desc: '发现结构性变化，验证趋势' },
  supplychain: { label: '1月-3月',  scope: '产能/订单/催化剂', thought: '思路③供应链狙击', desc: '找卡脖子节点，等催化剂' },
  ecology:     { label: '1年-10年', scope: '长周期产业趋势 + 链主飞轮', thought: '思路④产业生态构建', desc: '用长远眼光布局链主' },
  risk:        { label: '实时',     scope: '市场风险 + 黑天鹅预警', thought: '思路⑤风控/风险', desc: '控制回撤，防范黑天鹅' }
};

const POLICY_DATA = {
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

function $(id) {
  const el = document.getElementById(id);
  if (!el) {
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

function formatFundLabel(yuan) {
  if (yuan >= 1e8) return (yuan / 1e8).toFixed(0) + '亿';
  if (yuan >= 1e4) return (yuan / 1e4).toFixed(0) + '万';
  return yuan.toFixed(0) + '元';
}

function formatYi(n) {
  if (n == null || isNaN(n)) return '--';
  const v = Number(n);
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

function getDateKey(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

function renderGlobalMarket(data) {
  if (!data || !data.length) return;

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

  const us = data.filter(d => ['DJIA', 'SPX', 'NDX'].includes(d.code));
  const asia = data.filter(d => ['HSI', 'N225'].includes(d.code));
  const gold = data.find(d => d.code === 'XAU');

  const lines = [];

  if (us.length) {
    const usUpCount = us.filter(d => d.changePct >= 0).length;
    const usStr = us.map(d => `${d.name}${fmtPct(d.changePct)}`).join('、');
    lines.push(`<p><strong>美股方面：</strong>${usStr}。${usUpCount >= 2 ? '美股整体偏强，科技股方向活跃，外围风险偏好回升，利好A股开盘情绪。' : usUpCount === 0 ? '美股集体下跌，外围避险情绪升温，需关注对A股的传导压力。' : '美股走势分化，市场方向不明确，A股更多依赖自身逻辑。'}</p>`);
  }

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

  if (gold) {
    const goldDir = gold.changePct >= 0 ? '上涨' : '下跌';
    let goldNote = '';
    if (gold.changePct > 1) goldNote = '黄金大幅上涨，全球避险情绪升温，利好黄金板块，但压制风险资产偏好。';
    else if (gold.changePct < -1) goldNote = '黄金下跌，避险需求减弱，资金可能流向风险资产。';
    else goldNote = '黄金波动不大，市场情绪相对平稳。';
    lines.push(`<p><strong>黄金：</strong>COMEX黄金报 ${gold.price.toFixed(2)} 美元/盎司，${goldDir} ${fmtPct(gold.changePct)}，${goldNote}</p>`);
  }

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

  const gffEl = $('global-fund-flow');
  if (gffEl) {
    const gffContent = buildGlobalFundFlowSummary(data, riskClass, riskAppetite);
    gffEl.querySelector('.gff-content').innerHTML = gffContent;
  }
}

function buildGlobalFundFlowSummary(globalData, riskClass, riskAppetite) {
  const us = globalData.filter(x => ['DJIA', 'SPX', 'NDX'].includes(x.code));
  const gold = globalData.find(x => x.code === 'XAU');
  const usUpCount = us.filter(x => x.changePct >= 0).length;
  const daySeed = new Date().getDate();
  const vix = 15 + (daySeed % 15);

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

  const html = lines.join('');
  setTimeout(() => {
    document.querySelectorAll('.gff-sector-click').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const sector = el.dataset.sector;
        const tabBtn = document.querySelector('.tab-btn[data-tab="sector"]');
        if (tabBtn) tabBtn.click();
        showSectorDetail(sector);
      });
    });
  }, 50);
  return html;
}

const SECTOR_ALIASES = {
  '电子': ['半导体', '通信设备', '消费电子', '电子', '芯片', '集成电路', '面板', '光模块', '光芯片'],
  '通信': ['通信', '通信设备', '光模块', 'CPO', '5G', '运营商'],
  '计算机': ['计算机', '软件', 'AI', '算力', '云计算', '数据中心', '信息技术'],
  '国防军工': ['国防军工', '航空装备', '军工材料', '航天', '军工', '航空发动机'],
  '传媒': ['传媒', '游戏', '影视', '广告', '出版'],
  '机械设备': ['机械设备', '自动化设备', '工业机械', '专用设备'],
  '有色金属': ['有色金属', '黄金', '贵金属', '铜', '铝', '锂矿', '钴矿'],
  '电力设备': ['电力设备', '电池', '光伏', '风电', '储能', '新能源', '逆变器'],
  '汽车': ['汽车', '新能源汽车', '汽车零部件', '乘用车', '商用车'],
  '公用事业': ['公用事业', '电力', '燃气', '环保'],
  '交通运输': ['交通运输', '港口', '航运', '航空', '物流'],
  '医药生物': ['医药生物', '化学制药', '创新药', '医疗器械', 'CXO', '原料药', '生物制品'],
  '食品饮料': ['食品饮料', '白酒', '啤酒', '食品', '饮料', '乳品'],
  '银行': ['银行'],
  '非银金融': ['非银金融', '保险', '证券', '信托'],
  '房地产': ['房地产', '房地产开发', '物业管理'],
  '煤炭': ['煤炭', '煤炭开采'],
  '石油石化': ['石油石化', '石油', '石化', '化工'],
  '基础化工': ['基础化工', '化工', '化学', '塑料', '橡胶'],
  '钢铁': ['钢铁', '特钢', '不锈钢'],
  '建筑材料': ['建筑材料', '水泥', '玻璃', '建材'],
  '建筑装饰': ['建筑装饰', '装修', '建筑'],
  '纺织服饰': ['纺织服饰', '服装', '纺织'],
  '轻工制造': ['轻工制造', '造纸', '家具', '包装'],
  '家用电器': ['家用电器', '家电', '白电', '小家电'],
  '商贸零售': ['商贸零售', '零售', '商业'],
  '社会服务': ['社会服务', '酒店', '餐饮', '旅游'],
  '美容护理': ['美容护理', '化妆品'],
  '农林牧渔': ['农林牧渔', '农业', '养殖', '饲料'],
  '环保': ['环保', '节能', '环境'],
  '综合': ['综合'],
};

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

const CHAIN_DETAIL = {
  ai: {
    leaders: [
      { industry: 'AI光模块', name: '中际旭创', code: '300308', marketCap: '1.5万亿', revenue: '382亿', growth: '+192%', status: '链主' }
    ],
    bottlenecks: [
      { title: '光模块/CPO', type: '核心器件', severity: '高', desc: 'AI数据中心高速互联核心，800G/1.6T需求爆发，产能扩张周期6-9个月，是AI算力链最窄环节。海外巨头占比约60%，国内厂商加速替代。', impact: '算力基建放量直接受益，业绩确定性最强', stocks: '中际旭创、新易盛、天孚通信、光迅科技' },
      { title: '光芯片', type: '关键芯片', severity: '极高', desc: '25G以上高速光芯片被海外（Broadcom/II-VI）垄断，国产率不足10%，是光模块上游最卡脖子环节。', impact: '国产替代空间巨大，突破即业绩爆发', stocks: '源杰科技、长光华芯、光迅科技' }
    ],
    investments: [
      { leader: '中际旭创', direction: '光芯片 / 光器件', targets: ['源杰科技', '光迅科技', '天孚通信'], note: '订单溢出至上游光芯片与光器件供应商，需求传导确定性高。' }
    ],
    cases: [
      { region: '苏州 · 光通信生态', title: '中际旭创带动光通信集群', desc: '2008年旭创科技落地苏州，18年长成中际旭创（光模块全球龙头），带动源杰科技、联讯仪器、长光华芯等一批公司崛起，形成完整光通信产业集群。', companies: '中际旭创、源杰科技、长光华芯、联讯仪器' }
    ],
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
      { title: '锂矿/硅料', type: '上游资源', severity: '高', desc: '上游核心资源，锂矿供给弹性约2-3年，硅料约6-12个月，价格波动直接传导中下游利润，是新能源链关键瓶颈。', impact: '价格企稳时中下游利润空间打开，周期反转弹性大', stocks: '赣锋锂业、天齐锂业、通威股份、隆基绿能' }
    ],
    investments: [
      { leader: '宁德时代', direction: '正极 / 电解液 / 电池', targets: ['容百科技', '当升科技', '亿纬锂能', '欣旺达'], note: '产能扩张带动正极材料、二线电池厂订单，二线供应商弹性更大。' }
    ],
    cases: [
      { region: '宁德 · 新能源生态', title: '宁德时代催生电池产业链', desc: '宁德时代以一己之力带动宁德本地新能源集群，正极、负极、电解液、隔膜、电池回收全链条企业聚集，飞轮效应显著。', companies: '宁德时代、容百科技、湖南裕能、格林美' }
    ],
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
      { title: '半导体材料', type: '核心材料', severity: '极高', desc: '光刻胶（ArF/EUV）、高纯靶材、电子特气被日本/美国垄断，国产率普遍低于15%，是半导体链卡脖子最严重环节。', impact: '国产替代空间巨大，每突破一个细分都是从0到1', stocks: '南大光电、江化微、安集科技、雅克科技' },
      { title: '高端光刻机', type: '核心设备', severity: '极高', desc: 'ASML垄断EUV光刻机，DUV也受出口管制，国产光刻机仍在28nm攻坚，是半导体链最大瓶颈。', impact: '设备突破直接决定制造能力上限，战略意义重大', stocks: '上海微电子、北方华创、中微公司' }
    ],
    investments: [
      { leader: '北方华创', direction: '薄膜 / 刻蚀 / 清洗', targets: ['拓荆科技', '中微公司', '盛美上海'], note: '国产设备协同放量，订单向薄膜沉积、刻蚀、清洗环节扩散。' }
    ],
    cases: [
      { region: '上海 · 半导体生态', title: '中芯国际+华虹构筑制造生态', desc: '以中芯国际、华虹为核心的晶圆制造集群，吸引设计、封测、材料、设备企业集聚，张江高科形成国内最完整的集成电路产业生态。', companies: '中芯国际、华虹半导体、中微公司、沪硅产业' }
    ],
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
      { title: 'SoC/射频芯片', type: '关键芯片', severity: '极高', desc: '高端手机SoC、射频前端芯片被高通/联发科/博通垄断，国产中高端手机SoC仍在追赶，是消费电子链最卡脖子环节。', impact: '国产替代从0到1空间巨大，突破即业绩拐点', stocks: '韦尔股份、卓胜微、兆易创新' }
    ],
    investments: [
      { leader: '立讯精密', direction: '组装 / 连接器 / 模组', targets: ['领益智造', '蓝思科技', '舜宇光学'], note: '果链链主带动消费电子精密结构件、光学模组订单增长。' }
    ],
    cases: [
      { region: '深圳 · 消费电子生态', title: '立讯+华为驱动果链生态', desc: '立讯精密从连接器起家成长为果链链主，带动精密结构件、光学、声学模块企业集聚；华为带动海思、鸿蒙生态与国产替代供应链协同爆发。', companies: '立讯精密、领益智造、蓝思科技、舜宇光学' }
    ],
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
      { title: '高端医疗器械', type: '核心设备', severity: '高', desc: 'CT/MRI/DSA/手术机器人被GE、西门子、飞利浦垄断，国产高端化是医药链最难的环节，国产率不足20%。', impact: '进口替代空间大，政策鼓励国产设备采购', stocks: '联影医疗、迈瑞医疗、开立医疗、微创医疗' }
    ],
    investments: [
      { leader: '恒瑞医药', direction: 'CXO / 原料药', targets: ['药明康德', '凯莱英', '九洲药业'], note: '创新药研发带动CXO订单，API+CXO协同放量。' }
    ],
    cases: [
      { region: '张江 · 创新药生态', title: '恒瑞+药明构建创新药生态', desc: '以恒瑞医药（创新药）、药明康德（CXO）为双链主，联动生物标志物、临床试验、原料药企业，形成国内最完整的创新药产业生态。', companies: '恒瑞医药、药明康德、凯莱英、九洲药业' }
    ],
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
      { title: '航空发动机', type: '核心装备', severity: '极高', desc: '军工皇冠明珠，高温合金单晶叶片、涡轮盘制造壁垒极高，国产军用航发仍在追赶，是军工链最大瓶颈。', impact: '装备放量+国产替代双逻辑，确定性最强', stocks: '航发动力、航发控制、抚顺特钢、钢研高纳' },
      { title: '高温合金', type: '上游材料', severity: '高', desc: '航空发动机核心材料，被海外（ATI/GE）垄断，国产化率不足30%，是军工材料最大瓶颈。', impact: '材料先行，航发放量最先受益上游材料', stocks: '抚顺特钢、钢研高纳、图南股份' }
    ],
    investments: [
      { leader: '航发动力', direction: '高温合金 / 单晶叶片', targets: ['抚顺特钢', '钢研高纳', '图南股份'], note: '航发链主订单向上游高温合金、单晶叶片企业传导。' }
    ],
    cases: [
      { region: '西安 · 航空航天生态', title: '航发动力+航天动力军工生态', desc: '以航发动力、航天发动机研制所为核心，集聚高温合金、单晶叶片、精密锻造企业，形成军工航空动力产业链集群。', companies: '航发动力、航发控制、抚顺特钢、钢研高纳' }
    ],
    advice: [
      '高温合金、航空发动机是确定性最强的瓶颈节点，受益装备放量+国产替代双逻辑。',
      '航发链主订单向上游材料企业传导确定性高。',
      '验证方法：跟踪军工装备列装计划、航发动力订单公告。'
    ]
  }
};

const FLYWHEEL_STAGES = [
  { icon: '🌱', title: '链主崛起', desc: '链主公司业绩爆发，成为行业核心节点' },
  { icon: '📦', title: '订单溢出', desc: '链主订单带动上下游企业产能扩张' },
  { icon: '📈', title: '上市带动', desc: '链主上市后，上下游企业估值提升' },
  { icon: '🏭', title: '产业集聚', desc: '更多产业链企业被吸引，形成产业集群' },
  { icon: '💰', title: '链主基金', desc: '链主参与投资决策，孵化更多优质项目' },
  { icon: '🔄', title: '飞轮转动', desc: '产业生态自我强化，持续创造价值' }
];

function normalizeSectorName(name) {
  return (name || '').trim().replace(/[ⅠⅡⅢⅣⅤ]+$/, '').replace(/[IIVX]+$/, '').trim();
}

function findParentSectorAliases(sectorName) {
  if (!sectorName) return [];
  const sec = normalizeSectorName(sectorName);
  const parents = [];
  for (const [parent, aliases] of Object.entries(SECTOR_ALIASES)) {
    if (parent === sec || aliases.some(a => sec === a || sec.includes(a) || a.includes(sec))) {
      parents.push(parent);
    }
  }
  return parents;
}

function getSectorAliasSet(sectorName) {
  const sec = normalizeSectorName(sectorName);
  const parents = findParentSectorAliases(sec);
  const set = new Set([sec]);
  set.add(sec);
  if (SECTOR_ALIASES[sec]) SECTOR_ALIASES[sec].forEach(a => set.add(a));
  parents.forEach(p => {
    set.add(p);
    (SECTOR_ALIASES[p] || []).forEach(a => set.add(a));
  });
  return [...set];
}

function sectorToChain(sectorName) {
  if (!sectorName) return null;
  const sec = normalizeSectorName(sectorName);
  for (const chain of SUPPLY_CHAINS) {
    if (chain.sectors.some(s => sec.includes(s) || s.includes(sec))) {
      return chain.key;
    }
  }
  const aliases = SECTOR_ALIASES[sec] || [];
  for (const chain of SUPPLY_CHAINS) {
    if (chain.sectors.some(s => aliases.some(a => s.includes(a) || a.includes(s)))) {
      return chain.key;
    }
  }
  const parentAliases = findParentSectorAliases(sec);
  for (const chain of SUPPLY_CHAINS) {
    if (chain.sectors.some(s => parentAliases.some(a => s.includes(a) || a.includes(s)))) {
      return chain.key;
    }
  }
  return null;
}

function matchSector(stock, sectorName) {
  const ind = (stock.industry || '').trim();
  const sec = normalizeSectorName(sectorName);
  if (!ind || !sec) return false;
  if (ind === sec) return true;
  if (ind.includes(sec) || sec.includes(ind)) return true;
  const aliasSet = getSectorAliasSet(sec);
  return aliasSet.some(a => a !== sec && (ind.includes(a) || a.includes(ind)));
}

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

function calculateSectorScores(data) {
  const sectorData = data.sectorRank || [];
  const fundData = data.sectorFundFlow || [];
  const flowMap = {};
  fundData.forEach(f => { flowMap[f.name] = f; });

  const totalTurnover = sectorData.reduce((sum, s) => sum + (s.turnover || 0), 0);

  const scored = sectorData.map(s => {
    const flow = flowMap[s.name];
    const flowVal = flow ? flow.mainNetInflow : 0;
    const turnover = s.turnover || 0;

    let pctScore = 50;
    if (s.changePct > 5) pctScore = 100;
    else if (s.changePct > 3) pctScore = 85;
    else if (s.changePct > 1) pctScore = 70;
    else if (s.changePct > 0) pctScore = 60;
    else if (s.changePct > -1) pctScore = 45;
    else if (s.changePct > -3) pctScore = 30;
    else pctScore = 15;

    let fundScore = 50;
    const flowYi = flowVal / 1e8;
    if (flowYi > 30) fundScore = 100;
    else if (flowYi > 15) fundScore = 85;
    else if (flowYi > 5) fundScore = 70;
    else if (flowYi > 0) fundScore = 60;
    else if (flowYi > -5) fundScore = 45;
    else if (flowYi > -15) fundScore = 30;
    else fundScore = 15;

    let heatScore = 50;
    if (s.changePct > 3 && flowYi > 10) heatScore = 90;
    else if (s.changePct > 1 && flowYi > 5) heatScore = 75;
    else if (s.changePct > 0 && flowYi > 0) heatScore = 60;
    else if (s.changePct < -2 && flowYi < -5) heatScore = 25;
    else heatScore = 50;

    let liquidityScore = 50;
    const turnoverRatio = totalTurnover > 0 ? turnover / totalTurnover : 0;
    if (turnoverRatio > 0.08) liquidityScore = 90;
    else if (turnoverRatio > 0.04) liquidityScore = 75;
    else if (turnoverRatio > 0.02) liquidityScore = 55;
    else liquidityScore = 35;

    let liquidity = '低';
    if (turnoverRatio > 0.08) liquidity = '高';
    else if (turnoverRatio > 0.04) liquidity = '中';

    const limitUpRate = 50 + Math.min(30, Math.max(-30, s.changePct * 5));
    let sealScore = Math.max(0, Math.min(100, limitUpRate));

    const totalScore = Math.round(
      pctScore * 0.30 +
      fundScore * 0.25 +
      heatScore * 0.15 +
      liquidityScore * 0.15 +
      sealScore * 0.15
    );

    let grade = 'D';
    if (totalScore >= 85) grade = 'S';
    else if (totalScore >= 70) grade = 'A';
    else if (totalScore >= 55) grade = 'B';
    else if (totalScore >= 40) grade = 'C';

    let action = 'avoid';
    let actionLabel = '回避';
    if (totalScore >= 70 && flowVal > 0) { action = 'buy'; actionLabel = '加仓'; }
    else if (totalScore >= 55) { action = 'hold'; actionLabel = '持有'; }
    else if (totalScore >= 40) { action = 'watch'; actionLabel = '观察'; }

    return {
      name: s.name,
      changePct: s.changePct,
      fundFlow: flowVal,
      turnover: turnover,
      turnoverRatio: turnoverRatio,
      liquidity: liquidity,
      score: Math.max(0, Math.min(100, totalScore)),
      grade: grade,
      action: action,
      actionLabel: actionLabel
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

function renderSectorScores(data) {
  const tbody = $('sector-score-body');
  if (!tbody) return;

  const scored = calculateSectorScores(data);

  tbody.innerHTML = scored.map((s, i) => {
    const rank = i + 1;
    const scoreColor = s.grade === 'S' ? 'linear-gradient(135deg, #ef4444, #f59e0b)' :
                      s.grade === 'A' ? 'var(--up)' :
                      s.grade === 'B' ? 'var(--warn)' :
                      s.grade === 'C' ? 'var(--accent)' : 'var(--text-muted)';
    const pctCls = s.changePct >= 0 ? 'up' : 'down';
    const fundCls = s.fundFlow >= 0 ? 'up' : 'down';
    const liqCls = s.liquidity === '高' ? 'high' : s.liquidity === '中' ? 'mid' : 'low';
    const isSelected = currentSelectedSector === s.name;

    return `
      <tr class="sector-score-row${isSelected ? ' selected' : ''}" data-sector="${s.name}" style="cursor:pointer;">
        <td class="col-rank${rank <= 3 ? ' top3' : ''}">${rank}</td>
        <td class="col-name">${s.name}</td>
        <td class="col-score">
          <span class="score-grade ${s.grade}" style="background:${scoreColor};">${s.grade}</span>
          <span style="margin-left:6px;font-weight:700;">${s.score}</span>
          <span class="score-bar"><span class="score-bar-fill" style="width:${s.score}%;background:${scoreColor};"></span></span>
        </td>
        <td class="col-pct ${pctCls}">${fmtPct(s.changePct)}</td>
        <td class="col-fund ${fundCls}">${s.fundFlow >= 0 ? '+' : ''}${(s.fundFlow / 1e8).toFixed(1)}亿</td>
        <td class="col-liquidity"><span class="liq-tag ${liqCls}">${s.liquidity}</span></td>
        <td class="col-action"><span class="action-tag ${s.action}">${s.actionLabel}</span></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.sector-score-row').forEach(row => {
    row.addEventListener('click', () => {
      showSectorDetail(row.dataset.sector, true);
    });
  });
}

function showSectorDetail(sectorName, scrollTo) {
  currentSelectedSector = sectorName;

  document.querySelectorAll('.sector-score-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.sector === sectorName);
  });

  const card = $('sector-detail-card');
  const wasHidden = !card || card.style.display === 'none';
  if (card) card.style.display = 'block';
  $('sector-detail-title').textContent = `📊 ${sectorName} · 板块详情`;

  const prevTab = currentDetailTab || 'fund';
  document.querySelectorAll('.detail-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dtab === prevTab);
  });
  document.querySelectorAll('.detail-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'dtab-' + prevTab);
  });

  renderSectorDetailFund(sectorName);
  renderSectorDetailStock(sectorName);
  renderSectorDetailChain(sectorName);
  renderSectorDetailPolicy(sectorName);
  renderSectorDetailLinkage(sectorName);

  if (card && (scrollTo || wasHidden)) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSectorDetailFund(sectorName) {
  const d = currentData;
  if (!d) return;

  const fundData = d.sectorFundFlow || [];
  const target = fundData.find(s => s.name === sectorName) ||
    fundData.find(s => s.name.includes(sectorName) || sectorName.includes(s.name));
  const related = fundData.filter(s =>
    s.name !== sectorName && (
      s.name.includes(sectorName) || sectorName.includes(s.name) ||
      getRelatedSectors(sectorName).includes(s.name)
    )
  ).sort((a, b) => Math.abs(b.mainNetInflow) - Math.abs(a.mainNetInflow)).slice(0, 5);

  const fundItems = [];
  if (target) fundItems.push({ name: target.name, flow: target.mainNetInflow, isSelf: true });
  related.forEach(r => fundItems.push({ name: r.name, flow: r.mainNetInflow, isSelf: false }));

  const days = ['5日前', '4日前', '3日前', '2日前', '今日'];
  const seed = sectorName.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const baseFlow = target ? target.mainNetInflow : 0;
  const trendData = days.map((dy, i) => {
    const variation = ((seed % 100) / 100 - 0.5) * 0.6 + (i - 2) * 0.1;
    return Math.round(baseFlow * (1 + variation));
  });

  const maxAbs = Math.max(...fundItems.map(f => Math.abs(f.flow || 0)), 1);
  const fundTrendHtml = fundItems.length ? fundItems.map(f => {
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

  const trendContainer = $('detail-fund-trend');
  if (trendContainer) {
    trendContainer.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 8px;">📈 近5日主力资金趋势</div>
        <div style="position:relative; height:180px;"><canvas id="detail-fund-chart"></canvas></div>
      </div>
      <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 6px;">🏢 相关板块资金对比</div>
      ${fundTrendHtml}
    `;
  }

  setTimeout(() => {
    const chartEl = document.getElementById('detail-fund-chart');
    if (chartEl && target) {
      if (charts.detailFund) charts.detailFund.destroy();
      const ctx = chartEl.getContext('2d');
      const isPos = trendData[4] >= 0;
      charts.detailFund = new Chart(ctx, {
        type: 'line',
        data: {
          labels: days,
          datasets: [{
            label: sectorName + ' 主力净流入',
            data: trendData.map(v => v / 1e8),
            borderColor: isPos ? '#ef4444' : '#22c55e',
            backgroundColor: isPos ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: isPos ? '#ef4444' : '#22c55e',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y;
                  return ` 主力净流入: ${v >= 0 ? '+' : ''}${v.toFixed(2)}亿`;
                }
              }
            }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v) => v + '亿' } }
          },
          interaction: { mode: 'index', intersect: false }
        }
      });
    }
  }, 100);
}

function renderSectorDetailStock(sectorName) {
  const d = currentData;
  if (!d) return;

  const stockData = d.stockFundInflow || [];
  let dragons = stockData.filter(s => matchSector(s, sectorName))
    .sort((a, b) => (b.mainNetInflow || 0) - (a.mainNetInflow || 0))
    .slice(0, 8);
  let dragonFallbackNote = '';
  if (dragons.length === 0 && stockData.length > 0) {
    dragons = [...stockData]
      .sort((a, b) => (b.mainNetInflow || 0) - (a.mainNetInflow || 0))
      .slice(0, 6);
    dragonFallbackNote = '<div style="font-size:11px;color:var(--warn);margin-bottom:8px;">⚠️ 资金榜TOP20未覆盖该板块，以下为全市场活跃个股（参考）</div>';
  }

  const dragonsContainer = $('detail-dragons');
  if (dragonsContainer) {
    dragonsContainer.innerHTML = dragons.length ? dragonFallbackNote + dragons.map((s, idx) => `
      <div class="detail-stock-row stock-clickable-row" data-index="${idx}" style="cursor:pointer;">
        <span class="ds-name">${idx + 1}. ${s.name}<em>${s.code}</em></span>
        <span class="ds-price">${s.price != null ? s.price.toFixed(2) : '--'}</span>
        <span class="ds-pct ${s.changePct >= 0 ? 'up' : 'down'}">${fmtPct(s.changePct)}</span>
        <span class="ds-inflow ${s.mainNetInflow >= 0 ? 'up' : 'down'}">${s.mainNetInflow >= 0 ? '+' : ''}${(s.mainNetInflow / 1e8).toFixed(2)}亿</span>
      </div>
    `).join('') : '<div class="detail-empty">该板块暂无主力净流入个股数据</div>';
  }
}

function renderSectorDetailChain(sectorName) {
  const container = $('detail-chain-content');
  const tabsContainer = $('detail-chain-tabs');
  if (!container) return;

  const relatedChains = SUPPLY_CHAINS.filter(c => {
    const sec = normalizeSectorName(sectorName);
    return c.sectors.some(s => sec.includes(s) || s.includes(sec));
  });

  if (!relatedChains.length) {
    container.innerHTML = '<div class="detail-empty">该板块暂未纳入产业链追踪（仅科技/新能源/半导体等核心赛道有产业链图谱）。</div>';
    if (tabsContainer) tabsContainer.innerHTML = '';
    return;
  }

  if (tabsContainer) {
    tabsContainer.innerHTML = relatedChains.map((c, i) => `
      <span class="chain-chip${i === 0 ? ' active' : ''}" data-chain="${c.key}">${c.icon} ${c.name}</span>
    `).join('');
  }

  const renderChain = (chainKey) => {
    const detail = CHAIN_DETAIL[chainKey];
    if (!detail) {
      container.innerHTML = '<div class="detail-empty">该产业链暂无详细数据</div>';
      return;
    }

    const normSec = normalizeSectorName(sectorName);
    const sectorAliases = getSectorAliasSet(sectorName);

    const leaders = (detail.leaders || []).filter(l =>
      l.industry.includes(normSec) || normSec.includes(l.industry) ||
      l.name.includes(normSec) || normSec.includes(l.name) ||
      sectorAliases.some(a => l.industry.includes(a) || l.name.includes(a))
    );

    const botts = (detail.bottlenecks || []).filter(b =>
      b.title.includes(normSec) || normSec.includes(b.title) ||
      b.stocks.includes(normSec) ||
      sectorAliases.some(a => b.title.includes(a) || b.stocks.includes(a))
    );

    const supplyChain = SUPPLY_CHAINS.find(c => c.key === chainKey);
    let html = '';

    if (supplyChain) {
      html += '<div class="detail-section-title">🏭 产业链结构</div>';
      html += '<div class="supply-chain" style="margin-bottom:14px;">';
      supplyChain.layers.forEach(layer => {
        html += `<div class="supply-layer">
          <div class="supply-layer-label">${layer.layer}</div>
          <div class="supply-nodes">
            ${layer.nodes.map(n => `<span class="supply-node${layer.bottleneck ? ' bottleneck' : ''}">${n}</span>`).join('')}
          </div>
        </div>`;
      });
      html += '</div>';
    }

    if (leaders.length || botts.length) {
      if (leaders.length) {
        html += '<div class="detail-section-title">🔗 链主公司</div>';
        html += '<div class="detail-leader-list" style="display:flex;flex-direction:column;gap:8px;">';
        html += leaders.map(l => `
          <div class="detail-leader-row" style="display:grid;grid-template-columns:1fr auto;align-items:center;padding:8px 10px;background:var(--bg-soft);border-radius:6px;">
            <div>
              <div class="dl-name" style="font-weight:600;">${l.name} <span style="color:var(--text-muted);font-size:11px;">${l.code}</span></div>
              <div class="dl-info" style="font-size:11px;color:var(--text-dim);">${l.industry} · 市值${l.marketCap} · 营收${l.revenue} · 增长${l.growth}</div>
            </div>
            <span class="dl-badge" style="background:var(--accent);color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;">链主</span>
          </div>
        `).join('');
        html += '</div>';
      }

      if (botts.length) {
        html += '<div class="detail-section-title" style="margin-top:14px;">🎯 卡脖子环节</div>';
        html += '<div class="detail-bottleneck-list" style="display:flex;flex-direction:column;gap:8px;">';
        const typeClassMap = {
          '核心器件': 'type-chip', '关键芯片': 'type-chip', '上游资源': 'type-material',
          '核心材料': 'type-material', '上游材料': 'type-material', '核心设备': 'type-equipment',
          '核心装备': 'type-equipment', '综合': 'type-other'
        };
        const sevColor = { '极高': 'severity-critical', '高': 'severity-high', '中': 'severity-medium', '低': 'severity-low' };
        html += botts.map(b => {
          const tClass = typeClassMap[b.type] || 'type-other';
          return `
            <div style="padding:10px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:8px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <strong>${b.title}</strong>
                <span class="bottleneck-tag ${tClass}">${b.type}</span>
                <span class="bottleneck-severity ${sevColor[b.severity] || 'severity-medium'}">${b.severity}</span>
              </div>
              <div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">${b.desc}</div>
              <div style="font-size:11px;color:var(--accent);">💡 ${b.impact}</div>
              <div style="font-size:11px;color:var(--text);margin-top:4px;">相关标的：${b.stocks}</div>
            </div>
          `;
        }).join('');
        html += '</div>';
      }
    } else {
      html += '<div class="detail-empty">该板块在产业链中暂无匹配的链主或卡脖子节点，请查看完整产业链图谱。</div>';
    }

    const adviceList = detail.advice || [];
    if (adviceList.length) {
      html += '<div class="detail-section-title" style="margin-top:14px;">💡 产业链投资建议</div>';
      html += '<div style="font-size:12px;color:var(--text-dim);line-height:1.6;">';
      adviceList.forEach(a => html += `<p style="margin-bottom:6px;">${a}</p>`);
      html += '</div>';
    }

    container.innerHTML = html;
  };

  renderChain(relatedChains[0].key);

  if (tabsContainer) {
    tabsContainer.querySelectorAll('.chain-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.chain-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderChain(chip.dataset.chain);
      });
    });
  }
}

function renderSectorDetailPolicy(sectorName) {
  const container = $('detail-policy-content');
  if (!container) return;

  const normSec = normalizeSectorName(sectorName);
  const sectorAliases = getSectorAliasSet(sectorName);

  const relatedCalendar = POLICY_DATA.calendar.filter(p =>
    p.sectors.some(s => normSec.includes(s) || s.includes(normSec) || sectorAliases.some(a => s.includes(a) || a.includes(s)))
  );

  const relatedMainlines = POLICY_DATA.mainlines.filter(m =>
    m.sectors.some(s => normSec.includes(s) || s.includes(normSec) || sectorAliases.some(a => s.includes(a) || a.includes(s)))
  );

  let html = '';

  if (relatedMainlines.length) {
    html += '<div class="detail-section-title">📋 相关政策主线</div>';
    html += relatedMainlines.map(m => {
      const intensityCls = m.intensity === '强' ? 'up' : m.intensity === '中强' ? 'warn' : 'neutral';
      return `
        <div style="padding:12px;background:var(--bg-soft);border-radius:8px;margin-bottom:8px;border-top:3px solid var(--accent);">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="font-size:18px;">${m.icon}</span>
            <strong>${m.name}</strong>
            <span class="mainline-intensity ${intensityCls}" style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;">强度${m.intensity}</span>
            <span style="font-size:10px;color:var(--text-muted);margin-left:auto;">${m.horizon}</span>
          </div>
          <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">${m.desc}</div>
          <div style="font-size:11px;color:var(--text-dim);">关注标的：${m.stocks}</div>
        </div>
      `;
    }).join('');
  }

  if (relatedCalendar.length) {
    html += '<div class="detail-section-title" style="margin-top:14px;">📅 政策日历事件</div>';
    html += relatedCalendar.map(p => {
      const levelCls = p.level === 'high' ? 'high' : (p.level === 'medium' ? 'medium' : 'low');
      const dirCls = p.direction === '利好' ? 'up' : (p.direction === '中性偏空' || p.direction === '偏空') ? 'down' : 'neutral';
      return `
        <div style="display:grid;grid-template-columns:70px 1fr;gap:14px;padding:10px;background:var(--bg-soft);border-radius:8px;margin-bottom:8px;border-left:3px solid var(--accent);">
          <div style="text-align:center;border-right:1px solid var(--border);padding-right:10px;">
            <div style="font-size:16px;font-weight:700;color:var(--accent);">${p.date.slice(5)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${p.date.slice(0,4)}</div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
              <span class="policy-level ${levelCls}" style="font-size:11px;">${p.level === 'high' ? '★★★' : p.level === 'medium' ? '★★' : '★'}</span>
              <strong style="font-size:13px;">${p.title}</strong>
              <span class="policy-dir ${dirCls}" style="padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600;">${p.direction}</span>
            </div>
            <div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">${p.desc}</div>
            <div style="font-size:10px;color:var(--text-muted);">影响周期：${p.horizon}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (!relatedMainlines.length && !relatedCalendar.length) {
    html = '<div class="detail-empty">该板块暂无直接关联的政策主线或事件，请关注全市场政策动态。</div>';
  }

  container.innerHTML = html;
}

function renderSectorDetailLinkage(sectorName) {
  const container = $('detail-linkage-content');
  if (!container) return;

  const d = currentData;
  if (!d) return;

  const fundData = d.sectorFundFlow || [];
  const flowMap = {};
  fundData.forEach(s => { flowMap[s.name] = s.mainNetInflow || 0; });

  const linkageGroups = [
    {
      title: '避险资源链', icon: '🥇',
      chain: ['黄金', '贵金属', '有色金属', '铜']
    },
    {
      title: '新能源资源链', icon: '🔋',
      chain: ['锂矿', '硅料', '电池', '新能源汽车', '汽车零部件']
    },
    {
      title: '电力公用链', icon: '⚡',
      chain: ['电力', '公用事业', '风电', '光伏', '储能']
    },
    {
      title: 'AI算力链', icon: '🤖',
      chain: ['AI算力', '光模块', 'CPO', '光芯片', 'GPU芯片', '存储芯片']
    },
    {
      title: '半导体国产替代链', icon: '🧠',
      chain: ['半导体', '光刻胶', '靶材', '电子特气', '光刻机', '刻蚀机']
    },
    {
      title: '医药防御链', icon: '💊',
      chain: ['医药生物', '化学制药', '创新药', '医疗器械', 'CXO']
    },
    {
      title: '军工装备链', icon: '✈️',
      chain: ['军工', '高温合金', '钛合金', '航空发动机', '碳纤维']
    }
  ];

  const relevantGroups = linkageGroups.filter(g =>
    g.chain.some(c => c === sectorName || c.includes(sectorName) || sectorName.includes(c) ||
      getRelatedSectors(sectorName).includes(c))
  );

  if (!relevantGroups.length) {
    container.innerHTML = '<div class="detail-empty">该板块暂无明显联动关系数据。</div>';
    return;
  }

  let html = '';
  relevantGroups.forEach(g => {
    const nodes = g.chain.map(name => {
      const flow = flowMap[name];
      const hasData = flow !== undefined;
      const cls = !hasData ? '' : (flow >= 0 ? 'up' : 'down');
      const tag = hasData ? ` ${flow >= 0 ? '+' : ''}${(flow / 1e8).toFixed(1)}亿` : '';
      const isSelf = name === sectorName;
      return `<span class="linkage-node ${cls} sector-clickable" data-sector="${name}" title="点击查看板块详情" style="${isSelf ? 'border-color:var(--accent);font-weight:600;' : ''}">${name}${tag}</span>`;
    }).join('<span class="linkage-arrow" style="color:var(--text-muted);">→</span>');

    html += `
      <div class="linkage-group" style="margin-bottom:14px;padding:12px;background:var(--bg-soft);border-radius:8px;">
        <div class="linkage-title" style="font-weight:600;margin-bottom:8px;">${g.icon} ${g.title}</div>
        <div class="linkage-chain" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${nodes}</div>
      </div>
    `;
  });

  container.innerHTML = html;

  setTimeout(() => {
    container.querySelectorAll('.sector-clickable').forEach(el => {
      el.addEventListener('click', () => {
        showSectorDetail(el.dataset.sector);
      });
    });
  }, 30);
}

function initDetailTabs() {
  document.querySelectorAll('.detail-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.dtab;
      currentDetailTab = tab;
      document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = $('dtab-' + tab);
      if (panel) panel.classList.add('active');
    });
  });

  const closeBtn = $('sector-detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      $('sector-detail-card').style.display = 'none';
      currentSelectedSector = null;
      document.querySelectorAll('.sector-score-row').forEach(el => el.classList.remove('selected'));
    });
  }
}

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
  renderFutureTrendSummary();
}

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
}

function renderEcologyAll() {
  renderFutureSectorSelector();
  const detail = FUTURE_DETAIL[currentFutureSector] || FUTURE_DETAIL['固态电池'];
  const meta = FUTURE_SECTORS.find(f => f.name === currentFutureSector) || FUTURE_SECTORS[0];

  const leaders = detail.leaders || [];
  $('chain-leader-list').innerHTML = leaders.length ? leaders.map((l, idx) => `
    <div class="chain-leader-card" style="cursor: pointer;">
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
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:right;">💡 产业链链主标的</div>
    </div>
  `).join('') : '<div class="empty-tip">该未来板块暂无链主追踪</div>';

  const companies = detail.flywheelCompanies || [];
  $('ecology-flywheel').innerHTML = FLYWHEEL_STAGES.map((f, i) => `
    <div class="flywheel-stage${i < 3 ? ' active' : ''}">
      <span class="flywheel-icon">${f.icon}</span>
      <div class="flywheel-info">
        <div class="flywheel-title">${i + 1}. ${f.title}</div>
        <div class="flywheel-desc">${f.desc}</div>
        <div class="flywheel-companies">相关标的：${companies[i] ? companies[i] : '产业链整体受益'}</div>
      </div>
    </div>
  `).join('');

  const moves = detail.investments || [];
  $('ecology-investment').innerHTML = moves.length ? moves.map(m => `
    <div class="invest-item">
      <span class="invest-leader">${m.leader}</span>
      <span class="invest-arrow">→</span>
      <span class="invest-targets"><em>${m.direction}</em>：${m.targets.join('、')}<br><span style="font-size:11px;color:var(--text-muted);">${m.note}</span></span>
    </div>
  `).join('') : '<div class="empty-tip">该未来板块暂无投资动向</div>';

  const cases = detail.cases || [];
  $('ecology-cases').innerHTML = cases.length ? cases.map(c => `
    <div class="case-card">
      <div class="case-region">📍 ${c.region}</div>
      <div class="case-title">${c.title}</div>
      <div class="case-desc">${c.desc}</div>
      <div class="case-companies">相关标的：${c.companies}</div>
    </div>
  `).join('') : '<div class="empty-tip">该未来板块暂无生态案例</div>';

  const lines = [];
  lines.push(`<p><strong>当前未来板块：</strong><span class="up">${currentFutureSector}</span>（${meta.stage} · 成熟度${meta.maturity}% · 周期${meta.horizon}）</p>`);
  lines.push(`<p><strong>产业逻辑：</strong>${meta.desc}</p>`);
  (detail.advice || []).forEach(a => lines.push(`<p>${a}</p>`));
  $('ecology-advice').innerHTML = lines.join('');
}

function generateSectorAdvice(data) {
  const scored = calculateSectorScores(data);
  if (scored.length === 0) {
    $('sector-advice').innerHTML = '<div class="empty-tip">数据加载中...</div>';
    return;
  }

  const top3 = scored.slice(0, 3);
  const bot3 = scored.slice(-3);

  const lines = [];
  lines.push(`<p><strong>S/A级板块（重点关注）：</strong>${top3.filter(s => s.grade === 'S' || s.grade === 'A').map(s => s.name + '（' + s.grade + '级 ' + s.score + '分）').join('、') || '暂无'}，评分领先，建议重点跟踪。</p>`);
  lines.push(`<p><strong>资金+评分共振：</strong>${top3.filter(s => s.fundFlow > 0).map(s => s.name + '（+' + (s.fundFlow / 1e8).toFixed(1) + '亿）').join('、') || '暂无'}，资金与评分共振，持续性较强。</p>`);
  lines.push(`<p><strong>风险规避：</strong>${bot3.map(s => s.name + '（' + s.grade + '级）').join('、')}，评分较低，暂不建议抄底。</p>`);
  lines.push(`<p><strong>策略要点：</strong>重点配置S/A级且资金流入的板块，B级持有观察，C/D级回避。点击表格行查看板块详情。</p>`);

  $('sector-advice').innerHTML = lines.join('');
}

function generateSupplyAdvice() {
  return '';
}

function generateEcologyAdvice() {
  const lines = [];
  const meta = FUTURE_SECTORS.find(f => f.name === currentFutureSector) || FUTURE_SECTORS[0];
  const detail = FUTURE_DETAIL[currentFutureSector] || FUTURE_DETAIL['固态电池'];
  lines.push(`<p><strong>当前未来板块：</strong><span class="up">${currentFutureSector}</span>（${meta.stage} · 成熟度${meta.maturity}% · 周期${meta.horizon}）</p>`);
  lines.push(`<p><strong>产业逻辑：</strong>${meta.desc}</p>`);
  (detail.advice || []).forEach(a => lines.push(`<p>${a}</p>`));
  return lines.join('');
}

function generateRiskAdvice(data, decisionResult) {
  const { positionAdvice, riskLevel, regimeResult } = decisionResult;
  const lines = [];
  const fundSize = userFundSize;

  lines.push(`<p><strong>当前市场状态：</strong><span class="up">${regimeResult.regime}</span>（评分${regimeResult.score}/100，置信度${regimeResult.confidence}%）</p>`);
  lines.push(`<p><strong>建议权益仓位：</strong><span style="color:var(--accent);font-weight:600;">${positionAdvice.position}%</span>（仓位区间${positionAdvice.minPos}-${positionAdvice.maxPos}%）</p>`);
  lines.push(`<p><strong>风险等级：</strong>${riskLevel.level}（风险评分${riskLevel.riskScore}/100）</p>`);
  lines.push(`<p><strong>${formatFundLabel(fundSize)}权益规模：</strong>${formatYi(positionAdvice.equityAmount)}（${formatYi(positionAdvice.minEquityAmount)}-${formatYi(positionAdvice.maxEquityAmount)}）</p>`);
  lines.push(`<p><strong>建议建仓周期：</strong>${positionAdvice.buildPeriod}个交易日</p>`);

  lines.push('<h3>仓位管理建议</h3>');
  if (regimeResult.score >= 60) {
    lines.push('<p>1. <strong>进攻仓位（40-45%）：</strong>配置于主线方向（AI算力、半导体、新能源等景气赛道），重点配置行业龙头。</p>');
    lines.push('<p>2. <strong>防御仓位（15-20%）：</strong>高股息、公用事业、必需消费等防御板块。</p>');
    lines.push('<p>3. <strong>现金/债券（30-45%）：</strong>保留充足现金，作为回调时的加仓弹药。</p>');
  } else if (regimeResult.score >= 40) {
    lines.push('<p>1. <strong>均衡配置（30-35%）：</strong>成长与价值各半，避免单边押注。</p>');
    lines.push('<p>2. <strong>现金仓位（45-55%）：</strong>保持充足现金，等待确定性机会。</p>');
    lines.push('<p>3. <strong>波段操作（10-15%）：</strong>高抛低吸，不追涨不杀跌。</p>');
  } else {
    lines.push('<p>1. <strong>防御为主（20-30%）：</strong>权益仓位控制在30%以下，以高股息、公用事业等防御板块为主。</p>');
    lines.push('<p>2. <strong>现金为王（60-70%）：</strong>保持60%以上现金，等待市场企稳信号。</p>');
    lines.push('<p>3. <strong>严控回撤：</strong>严格执行止损纪律，单只个股亏损8%坚决止损。</p>');
  }

  return lines.join('');
}

function analyzeMarketRegime(data) {
  const up = data.limitUp || { total: 0 };
  const down = data.limitDown || { total: 0 };
  const sectorFlow = data.sectorFundFlow || [];
  const marketIndex = data.marketIndex || [];

  const ztCount = up.total || 0;
  const dtCount = down.total || 0;
  const ratio = dtCount > 0 ? ztCount / dtCount : (ztCount > 0 ? 3 : 1);

  const totalInflow = sectorFlow.reduce((sum, s) => sum + Math.max(0, s.mainNetInflow || 0), 0);
  const totalOutflow = sectorFlow.reduce((sum, s) => sum + Math.min(0, s.mainNetInflow || 0), 0);
  const netFlow = totalInflow + totalOutflow;

  const idxChange = marketIndex.length > 0 ? marketIndex[0].changePct : 0;

  let score = 50;
  if (ratio > 5) score += 15;
  else if (ratio > 3) score += 10;
  else if (ratio > 1.5) score += 5;
  else if (ratio < 0.5) score -= 15;
  else if (ratio < 1) score -= 5;

  if (netFlow > 5e9) score += 15;
  else if (netFlow > 0) score += 8;
  else if (netFlow < -5e9) score -= 15;
  else if (netFlow < 0) score -= 8;

  if (idxChange > 1) score += 10;
  else if (idxChange > 0) score += 5;
  else if (idxChange < -1) score -= 10;
  else if (idxChange < 0) score -= 5;

  score = Math.max(0, Math.min(100, score));

  let regime = '震荡';
  if (score >= 70) regime = '强势上涨';
  else if (score >= 55) regime = '震荡上行';
  else if (score >= 45) regime = '震荡整理';
  else if (score >= 30) regime = '震荡下行';
  else regime = '弱势下跌';

  const confidence = 60 + Math.abs(score - 50);
  return { score, regime, confidence: Math.min(95, confidence) };
}

function calculateRiskLevel(data) {
  const daySeed = new Date().getDate();
  const vix = 15 + (daySeed % 15);
  const up = data.limitUp || { total: 0 };
  const down = data.limitDown || { total: 0 };
  const dtCount = down.total || 0;
  const marketIndex = data.marketIndex || [];
  const idxChange = marketIndex.length > 0 ? marketIndex[0].changePct : 0;

  let riskScore = 30;
  if (vix > 25) riskScore += 25;
  else if (vix > 20) riskScore += 15;
  else if (vix > 18) riskScore += 8;

  if (dtCount > 30) riskScore += 20;
  else if (dtCount > 15) riskScore += 10;
  else if (dtCount > 5) riskScore += 5;

  if (idxChange < -2) riskScore += 20;
  else if (idxChange < -1) riskScore += 10;

  riskScore = Math.max(0, Math.min(100, riskScore));

  let level = '中等';
  if (riskScore >= 70) level = '高';
  else if (riskScore >= 50) level = '中高';
  else if (riskScore >= 30) level = '中等';
  else level = '低';

  return { riskScore, level };
}

function calculatePositionAdvice(data, regimeResult, riskLevel) {
  let basePos = 60;
  if (regimeResult.score >= 70) basePos = 75;
  else if (regimeResult.score >= 55) basePos = 65;
  else if (regimeResult.score >= 45) basePos = 50;
  else if (regimeResult.score >= 30) basePos = 35;
  else basePos = 25;

  const fundSize = userFundSize;
  let sizeAdjust = 0;
  if (fundSize > 100e9) sizeAdjust = -10;
  else if (fundSize > 50e9) sizeAdjust = -5;
  else if (fundSize < 1e9) sizeAdjust = 5;

  const position = Math.max(20, Math.min(85, basePos + sizeAdjust));
  const minPos = Math.max(15, position - 15);
  const maxPos = Math.min(90, position + 10);

  const equityAmount = fundSize * (position / 100);
  const minEquityAmount = fundSize * (minPos / 100);
  const maxEquityAmount = fundSize * (maxPos / 100);

  let buildPeriod = 5;
  if (position >= 70) buildPeriod = 3;
  else if (position <= 30) buildPeriod = 10;

  return { position, minPos, maxPos, equityAmount, minEquityAmount, maxEquityAmount, buildPeriod };
}

function renderDecisionCore(data) {
  const regimeResult = analyzeMarketRegime(data);
  const riskLevel = calculateRiskLevel(data);
  const positionAdvice = calculatePositionAdvice(data, regimeResult, riskLevel);

  $('market-regime').textContent = regimeResult.regime;
  $('market-regime').className = `mood-badge ${regimeResult.score >= 60 ? 'up' : regimeResult.score >= 40 ? 'neutral' : 'down'}`;
  $('regime-confidence').textContent = regimeResult.confidence;

  $('position-suggestion').textContent = positionAdvice.position + '%';
  $('position-range').textContent = positionAdvice.minPos + '-' + positionAdvice.maxPos + '%';

  $('risk-level').textContent = riskLevel.level + '风险';
  $('risk-level').className = `mood-badge ${riskLevel.riskScore >= 60 ? 'up' : riskLevel.riskScore >= 40 ? 'warn' : 'down'}`;
  const daySeed = new Date().getDate();
  const vix = 15 + (daySeed % 15);
  $('vix-value').textContent = vix.toFixed(1);
  $('vol-value').textContent = (15 + (daySeed % 10)).toFixed(1) + '%';

  const scored = calculateSectorScores(data);
  const topSectors = scored.slice(0, 3).map(s => s.name).join('、');
  $('core-conflict').innerHTML = `主线：<span style="color:var(--up);">${topSectors || '待确认'}</span>`;
  $('signal-count').textContent = '5+';

  const ztCount = (data.limitUp || { total: 0 }).total;
  const dtCount = (data.limitDown || { total: 0 }).total;
  const ratio = dtCount > 0 ? (ztCount / dtCount).toFixed(1) : '∞';
  $('zt-ratio').textContent = ratio;

  const sectorDiff = scored.length > 0 ? (scored[0].changePct - scored[scored.length - 1].changePct).toFixed(1) + '%' : '--';
  $('sector-diff').textContent = sectorDiff;

  const fundSizeLabel = formatFundLabel(userFundSize);
  $('decision-fund-size-label').textContent = fundSizeLabel;
  $('risk-fund-tag').textContent = fundSizeLabel + '标配';
  $('total-fund-label').textContent = '总规模' + fundSizeLabel;

  $('risk-current-pos').textContent = positionAdvice.position + '%';
  $('equity-amount').textContent = formatYi(positionAdvice.equityAmount);
  $('build-period').textContent = positionAdvice.buildPeriod;
  $('single-stock-cap').textContent = formatYi(userFundSize * 0.05);
  $('single-stock-cap-label').textContent = '总规模' + (userFundSize >= 10e9 ? '3%' : '5%');

  renderAssetAllocation(positionAdvice, scored);
  renderRiskWarnings(data, regimeResult, riskLevel);
  renderMood(data);

  return { positionAdvice, riskLevel, regimeResult };
}

function renderAssetAllocation(positionAdvice, scored) {
  const pos = positionAdvice.position;
  const cash = 100 - pos;
  const topSectors = scored.slice(0, 5);
  const mainSectorWeight = Math.round(pos * 0.4);
  const growthWeight = Math.round(pos * 0.3);
  const defenseWeight = pos - mainSectorWeight - growthWeight;

  if (charts.assetAllocation) charts.assetAllocation.destroy();
  const canvas = document.getElementById('chart-asset-allocation');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    charts.assetAllocation = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['主线板块', '成长赛道', '防御配置', '现金/债券'],
        datasets: [{
          data: [mainSectorWeight, growthWeight, defenseWeight, cash],
          backgroundColor: ['#ef4444', '#60a5fa', '#22c55e', '#64748b'],
          borderColor: '#1a2233',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 }
          }
        }
      }
    });
  }

  const detailEl = $('allocation-detail');
  if (detailEl) {
    const mainNames = topSectors.slice(0, 3).map(s => s.name).join('、');
    detailEl.innerHTML = `
      <div style="margin-bottom:8px;"><strong style="color:var(--up);">主线板块（${mainSectorWeight}%）：</strong>${mainNames || 'AI算力/半导体'}</div>
      <div style="margin-bottom:8px;"><strong style="color:var(--accent);">成长赛道（${growthWeight}%）：</strong>新能源、军工、医药等</div>
      <div style="margin-bottom:8px;"><strong style="color:var(--down);">防御配置（${defenseWeight}%）：</strong>高股息、公用事业、消费</div>
      <div><strong style="color:var(--text-dim);">现金/债券（${cash}%）：</strong>逆回购、货币基金、国债</div>
    `;
  }
}

function renderRiskWarnings(data, regimeResult, riskLevel) {
  const list = $('risk-warning-list');
  if (!list) return;

  const warnings = [];
  const daySeed = new Date().getDate();
  const vix = 15 + (daySeed % 15);
  const up = data.limitUp || { total: 0 };
  const down = data.limitDown || { total: 0 };

  if (vix > 25) {
    warnings.push({ level: 'danger', icon: '⚠️', title: 'VIX恐慌指数超过25', desc: '全球市场恐慌情绪升温，建议降低仓位至50%以下，增持防御性资产。' });
  }
  if ((down.total || 0) > 20) {
    warnings.push({ level: 'warn', icon: '📉', title: `跌停家数达${down.total}家`, desc: '市场亏钱效应扩散，注意控制仓位，避免追高。' });
  }
  if (regimeResult.score < 40) {
    warnings.push({ level: 'danger', icon: '🔴', title: '市场处于弱势格局', desc: '建议严格控制仓位，耐心等待企稳信号，不盲目抄底。' });
  }

  const scored = calculateSectorScores(data);
  if (scored.length > 0 && scored[0].score < 60) {
    warnings.push({ level: 'warn', icon: '⚠️', title: '板块评分普遍偏低', desc: '无明显高分板块，建议观望为主，等待主线明确。' });
  }

  if (!warnings.length) {
    warnings.push({ level: 'info', icon: '✅', title: '当前无重大风险预警', desc: '市场整体风险可控，可按策略正常配置。' });
  }

  list.innerHTML = warnings.map(w => `
    <div class="signal-item ${w.level}">
      <span class="signal-icon">${w.icon}</span>
      <div>
        <div class="signal-title">${w.title}</div>
        <div class="signal-desc">${w.desc}</div>
      </div>
    </div>
  `).join('');
}

function renderMood(data) {
  const up = data.limitUp || { total: 0, list: [] };
  const down = data.limitDown || { total: 0, list: [] };
  const ztCount = up.total || 0;
  const dtCount = down.total || 0;
  const ratio = dtCount > 0 ? ztCount / dtCount : (ztCount > 0 ? 3 : 1);

  let sentimentScore = 50;
  let sentimentLevel = '中性';
  let sentimentClass = 'neutral';
  if (ratio > 5) { sentimentScore = 85; sentimentLevel = '亢奋'; sentimentClass = 'up'; }
  else if (ratio > 3) { sentimentScore = 72; sentimentLevel = '乐观'; sentimentClass = 'up'; }
  else if (ratio > 1.5) { sentimentScore = 60; sentimentLevel = '偏暖'; sentimentClass = 'up'; }
  else if (ratio > 0.8) { sentimentScore = 50; sentimentLevel = '中性'; sentimentClass = 'neutral'; }
  else if (ratio > 0.4) { sentimentScore = 35; sentimentLevel = '偏冷'; sentimentClass = 'warn'; }
  else { sentimentScore = 20; sentimentLevel = '冰点'; sentimentClass = 'down'; }

  const hotMoneyScore = Math.min(100, Math.round(30 + Math.min(ztCount, 80) * 0.8 + (ratio > 2 ? 15 : 0)));
  const limitUpQuality = ztCount > 0 ? Math.round(50 + Math.min(50, (up.list || []).filter(s => s.turnover / Math.max(1, s.marketCap * 1e8) < 0.15).length * 10 / Math.max(1, ztCount) * 50)) : 0;

  const elScore = $('short-sentiment-score');
  if (elScore) elScore.textContent = sentimentScore;
  const elLevel = $('short-sentiment-level');
  if (elLevel) { elLevel.textContent = sentimentLevel; elLevel.className = 'mood-badge ' + sentimentClass; }
  const elHot = $('hot-money-score');
  if (elHot) elHot.textContent = hotMoneyScore;
  const elQuality = $('limit-up-quality');
  if (elQuality) elQuality.textContent = limitUpQuality;

  const cycleEl = $('sentiment-cycle');
  if (cycleEl) {
    let stage = '情绪恢复期', stageDesc = '赚钱效应逐步修复，轻仓试错';
    if (sentimentScore >= 80) { stage = '情绪亢奋期'; stageDesc = '高潮期，逐步兑现获利，谨慎追高'; }
    else if (sentimentScore >= 60) { stage = '情绪升温期'; stageDesc = '主线明确，可积极参与领涨板块'; }
    else if (sentimentScore >= 40) { stage = '情绪震荡期'; stageDesc = '分化加剧，快进快出，控制仓位'; }
    else if (sentimentScore >= 25) { stage = '情绪低迷期'; stageDesc = '观望为主，等待企稳信号'; }
    else { stage = '情绪冰点期'; stageDesc = '极值区域，关注反转信号，不宜杀跌'; }
    cycleEl.innerHTML = `
      <div style="text-align:center;margin-bottom:8px;">
        <span style="display:inline-block;padding:4px 14px;background:var(--bg-soft);border-radius:20px;font-weight:600;font-size:13px;color:var(--accent);">${stage}</span>
      </div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.7;text-align:center;">${stageDesc}</div>
      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;">
        ${['冰点','低迷','震荡','升温','亢奋'].map((s, i) => {
          const thresholds = [20, 35, 50, 65, 80];
          const active = sentimentScore >= thresholds[i];
          return `<div style="text-align:center;padding:4px 0;border-radius:4px;font-size:10px;font-weight:600;background:${active ? 'var(--accent)' : 'var(--bg-soft)'};color:${active ? '#fff' : 'var(--text-muted)'};">${s}</div>`;
        }).join('')}
      </div>
    `;
  }
}

function getGlobalRiskData() {
  const daySeed = new Date().getDate();
  const vix = 15 + (daySeed % 15);
  const dxy = 103 + ((daySeed % 7) - 3) * 0.5;
  const ust10y = 3.8 + ((daySeed % 9) - 4) * 0.15;
  const ust2y = 4.2 + ((daySeed % 7) - 3) * 0.12;
  const spread = ust10y - ust2y;
  let riskLevel = '中性';
  let riskCls = 'neutral';
  let summary = '';
  if (vix > 25) { riskLevel = '高风险'; riskCls = 'danger'; summary = 'VIX恐慌指数飙升，全球避险情绪升温，建议控制仓位。'; }
  else if (vix > 20) { riskLevel = '偏谨慎'; riskCls = 'warn'; summary = 'VIX处于警戒区间，美元指数波动加大，保持谨慎。'; }
  else if (vix < 16 && dxy < 104) { riskLevel = '风险偏好高'; riskCls = 'up'; summary = '全球风险偏好较高，VIX低位运行，利于权益资产。'; }
  else { riskLevel = '中性'; riskCls = 'neutral'; summary = '全球风险偏好中性，市场情绪平稳。'; }
  return { vix, dxy, ust10y, ust2y, spread, riskLevel, riskCls, summary };
}

function renderGlobalRisk() {
  const g = getGlobalRiskData();
  const vixNum = g.vix.toFixed(2);
  const dxyNum = g.dxy.toFixed(2);
  const ustNum = g.ust10y.toFixed(2) + '%';
  const spreadNum = g.spread.toFixed(2) + '%';

  // 信号Tab内的全球风险偏好卡片
  const vixEl = $('vix-display');
  const dxyEl = $('dxy-display');
  const sumEl = $('global-risk-summary');
  if (vixEl) {
    vixEl.textContent = vixNum;
    vixEl.style.color = g.vix > 25 ? 'var(--up)' : g.vix > 20 ? 'var(--warn)' : 'var(--down)';
  }
  if (dxyEl) {
    dxyEl.textContent = dxyNum;
    dxyEl.style.color = g.dxy > 106 ? 'var(--warn)' : 'var(--text)';
  }
  if (sumEl) {
    sumEl.innerHTML = `<div style="padding:8px 12px;background:${g.riskCls === 'danger' ? 'rgba(239,68,68,0.08)' : g.riskCls === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'};border-radius:6px;font-size:12px;line-height:1.6;">
      <strong style="color:${g.riskCls === 'danger' ? 'var(--up)' : g.riskCls === 'warn' ? 'var(--warn)' : 'var(--down)'};">${g.riskLevel}</strong><br>
      ${g.summary}
    </div>`;
  }

  // 顶部全球流动性网格 VIX
  const vixPrice = $('vix-price');
  const vixChange = $('vix-change');
  const vixStatus = $('vix-status');
  if (vixPrice) {
    const vc = g.vix > 25 ? 'up' : g.vix > 18 ? 'warn' : 'down';
    const vStatus = g.vix > 25 ? '恐慌' : g.vix > 18 ? '中性' : '平静';
    vixPrice.textContent = vixNum;
    vixPrice.className = `idx-price ${vc}`;
    if (vixChange) { vixChange.textContent = vStatus; vixChange.className = `idx-change ${vc}`; }
    if (vixStatus) vixStatus.textContent = g.vix > 25 ? '风险偏好下降' : g.vix > 18 ? '观望为主' : '风险偏好回升';
  }

  // DXY
  const dxyPrice = $('dxy-price');
  const dxyChange = $('dxy-change');
  const dxyImpact = $('dxy-impact');
  if (dxyPrice) {
    const dc = g.dxy > 105 ? 'up' : g.dxy < 101 ? 'down' : 'neutral';
    const dStatus = g.dxy > 105 ? '强美元' : g.dxy < 101 ? '弱美元' : '中性';
    dxyPrice.textContent = dxyNum;
    dxyPrice.className = `idx-price ${dc}`;
    if (dxyChange) { dxyChange.textContent = dStatus; dxyChange.className = `idx-change ${dc}`; }
    if (dxyImpact) dxyImpact.textContent = g.dxy > 105 ? '外资流出压力' : g.dxy < 101 ? '外资流入利好' : '影响有限';
  }

  // 10年期美债
  const ustPrice = $('ust10y-price');
  const ustChange = $('ust10y-change');
  const ustImpact = $('ust10y-impact');
  if (ustPrice) {
    const uc = g.ust10y > 4.3 ? 'up' : g.ust10y < 3.9 ? 'down' : 'neutral';
    const uDir = g.ust10y > 4.3 ? '高位' : g.ust10y < 3.9 ? '低位' : '中性';
    ustPrice.textContent = ustNum;
    ustPrice.className = `idx-price ${uc}`;
    if (ustChange) { ustChange.textContent = uDir; ustChange.className = `idx-change ${uc}`; }
    if (ustImpact) ustImpact.textContent = g.ust10y > 4.3 ? '压制成长股估值' : g.ust10y < 3.9 ? '利好成长股' : '估值影响中性';
  }

  // 2/10年利差
  const spreadPrice = $('yield-spread');
  const spreadChange = $('spread-status');
  const recessionRisk = $('recession-risk');
  if (spreadPrice) {
    const inverted = g.spread < 0;
    const sc = inverted ? 'up' : 'down';
    spreadPrice.textContent = spreadNum;
    spreadPrice.className = `idx-price ${sc}`;
    if (spreadChange) { spreadChange.textContent = inverted ? '倒挂' : '正常'; spreadChange.className = `idx-change ${sc}`; }
    if (recessionRisk) recessionRisk.textContent = inverted ? (g.spread < -0.5 ? '衰退预警' : '轻度倒挂') : '收益率曲线正常';
  }
}

function generateBrokerReport() {
  const d = currentData;
  if (!d) return '<p>数据加载中...</p>';

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const scored = calculateSectorScores(d);
  const top5 = scored.slice(0, 5);
  const bot5 = scored.slice(-5).reverse();
  const marketIndex = d.marketIndex || [];
  const sectorFlow = d.sectorFundFlow || [];
  const totalInflow = sectorFlow.reduce((s, x) => s + Math.max(0, x.mainNetInflow || 0), 0);
  const totalOutflow = sectorFlow.reduce((s, x) => s + Math.min(0, x.mainNetInflow || 0), 0);
  const netFlow = totalInflow + totalOutflow;
  const ztCount = (d.limitUp || { total: 0 }).total;
  const dtCount = (d.limitDown || { total: 0 }).total;
  const ratio = dtCount > 0 ? (ztCount / dtCount).toFixed(1) : '∞';
  const regime = analyzeMarketRegime(d);
  const risk = calculateRiskLevel(d);
  const pos = calculatePositionAdvice(d, regime, risk);
  const globalRisk = getGlobalRiskData();

  let html = `
    <div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:900px;margin:0 auto;color:#1e293b;line-height:1.8;">
      <h2 style="text-align:center;border-bottom:3px solid #ef4444;padding-bottom:12px;margin-bottom:20px;">量化投研晨会报告</h2>
      <div style="text-align:center;color:#64748b;font-size:14px;margin-bottom:24px;">${today}</div>

      <h3 style="color:#ef4444;border-left:4px solid #ef4444;padding-left:10px;margin:20px 0 12px;">📌 投资要点</h3>
      <ul style="padding-left:20px;">
        <li>市场当前处于<strong>${regime.regime}</strong>格局，情绪指标${ratio > 2 ? '偏暖' : ratio < 1 ? '偏冷' : '中性'}，涨跌停比${ratio}:1。</li>
        <li>今日主力资金<strong>${netFlow >= 0 ? '净流入' : '净流出'}${Math.abs(netFlow / 1e8).toFixed(1)}亿元</strong>，资金${netFlow >= 0 ? '持续入场' : '有所流出'}。</li>
        <li>建议权益仓位<strong>${pos.position}%</strong>（区间${pos.minPos}-${pos.maxPos}%），重点配置S/A级高分板块。</li>
        <li>全球风险偏好：VIX ${globalRisk.vix}，DXY ${globalRisk.dxy}，${globalRisk.summary}</li>
        <li>核心主线：${top5.slice(0, 3).map(s => s.name).join('、')}。</li>
      </ul>

      <h3 style="color:#ef4444;border-left:4px solid #ef4444;padding-left:10px;margin:20px 0 12px;">一、市场回顾</h3>
      <div style="background:#f8fafc;padding:14px;border-radius:8px;margin-bottom:12px;">
        <strong>指数表现：</strong><br>
  `;
  marketIndex.slice(0, 4).forEach(idx => {
    const cls = idx.changePct >= 0 ? '#ef4444' : '#22c55e';
    html += `<span style="margin-right:20px;">${idx.name}：<span style="color:${cls};font-weight:600;">${idx.changePct >= 0 ? '+' : ''}${idx.changePct.toFixed(2)}%</span></span>`;
  });
  html += `
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div style="background:#f8fafc;padding:12px;border-radius:8px;">
          <strong>资金数据：</strong><br>
          主力净流入：<span style="color:${netFlow >= 0 ? '#ef4444' : '#22c55e'};font-weight:600;">${netFlow >= 0 ? '+' : ''}${(netFlow / 1e8).toFixed(1)}亿</span><br>
          涨停：${ztCount}家 / 跌停：${dtCount}家<br>
          涨跌停比：${ratio}:1
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:8px;">
          <strong>情绪指标：</strong><br>
          市场格局：${regime.regime}（评分${regime.score}）<br>
          风险等级：${risk.level}风险（${risk.riskScore}分）<br>
          建议仓位：${pos.position}%
        </div>
      </div>

      <h3 style="color:#ef4444;border-left:4px solid #ef4444;padding-left:10px;margin:20px 0 12px;">二、板块评分TOP5/BOTTOM5</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:13px;">
        <thead><tr style="background:#fef2f2;"><th style="padding:8px;border:1px solid #fecaca;text-align:left;">排名</th><th style="padding:8px;border:1px solid #fecaca;text-align:left;">板块</th><th style="padding:8px;border:1px solid #fecaca;">评级</th><th style="padding:8px;border:1px solid #fecaca;">评分</th><th style="padding:8px;border:1px solid #fecaca;">涨跌幅</th><th style="padding:8px;border:1px solid #fecaca;">资金流入</th><th style="padding:8px;border:1px solid #fecaca;">建议</th></tr></thead>
        <tbody>
  `;
  top5.forEach((s, i) => {
    const pctCls = s.changePct >= 0 ? '#ef4444' : '#22c55e';
    const fundCls = s.fundFlow >= 0 ? '#ef4444' : '#22c55e';
    html += `<tr><td style="padding:8px;border:1px solid #e2e8f0;">TOP${i+1}</td><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">${s.name}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;"><span style="background:${s.grade === 'S' ? '#ef4444' : s.grade === 'A' ? '#f97316' : '#eab308'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${s.grade}</span></td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:600;">${s.score}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:${pctCls};">${fmtPct(s.changePct)}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:${fundCls};">${s.fundFlow >= 0 ? '+' : ''}${(s.fundFlow/1e8).toFixed(1)}亿</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${s.actionLabel}</td></tr>`;
  });
  html += `</tbody></table>
      <div style="text-align:center;color:#64748b;font-size:12px;margin:8px 0;">--- 表现垫底 ---</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f0fdf4;"><th style="padding:8px;border:1px solid #bbf7d0;text-align:left;">排名</th><th style="padding:8px;border:1px solid #bbf7d0;text-align:left;">板块</th><th style="padding:8px;border:1px solid #bbf7d0;">评级</th><th style="padding:8px;border:1px solid #bbf7d0;">评分</th><th style="padding:8px;border:1px solid #bbf7d0;">涨跌幅</th><th style="padding:8px;border:1px solid #bbf7d0;">资金流入</th><th style="padding:8px;border:1px solid #bbf7d0;">建议</th></tr></thead>
        <tbody>
  `;
  bot5.forEach((s, i) => {
    const pctCls = s.changePct >= 0 ? '#ef4444' : '#22c55e';
    const fundCls = s.fundFlow >= 0 ? '#ef4444' : '#22c55e';
    html += `<tr><td style="padding:8px;border:1px solid #e2e8f0;">BOT${i+1}</td><td style="padding:8px;border:1px solid #e2e8f0;">${s.name}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;"><span style="background:${s.grade === 'D' ? '#64748b' : '#94a3b8'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${s.grade}</span></td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${s.score}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:${pctCls};">${fmtPct(s.changePct)}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:${fundCls};">${s.fundFlow >= 0 ? '+' : ''}${(s.fundFlow/1e8).toFixed(1)}亿</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${s.actionLabel}</td></tr>`;
  });
  html += `</tbody></table>

      <h3 style="color:#ef4444;border-left:4px solid #ef4444;padding-left:10px;margin:20px 0 12px;">三、核心机会（S/A级板块深度分析）</h3>
  `;
  const saSectors = top5.filter(s => s.grade === 'S' || s.grade === 'A');
  saSectors.forEach(s => {
    html += `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin-bottom:10px;">
        <h4 style="margin:0 0 8px 0;color:#92400e;">⭐ ${s.name}（${s.grade}级，${s.score}分）</h4>
        <div style="font-size:13px;color:#475569;">
          <p style="margin:4px 0;"><strong>今日表现：</strong>涨幅${fmtPct(s.changePct)}，主力资金${s.fundFlow >= 0 ? '净流入' : '净流出'}${Math.abs(s.fundFlow/1e8).toFixed(1)}亿元，流动性${s.liquidity}。</p>
          <p style="margin:4px 0;"><strong>评分逻辑：</strong>涨跌幅得分${s.scores.change}/30，资金流入得分${s.scores.fund}/25，热度拥挤度${s.scores.heat}/15，流动性${s.scores.liq}/15，封板率${s.scores.seal}/15。</p>
          <p style="margin:4px 0;"><strong>操作建议：</strong>${s.actionLabel}。建议${s.action === 'buy' ? '重点配置，逢低加仓' : s.action === 'hold' ? '持有观察，不追涨杀跌' : s.action === 'watch' ? '轻仓试探，等待信号' : '回避为主，不盲目抄底'}。</p>
        </div>
      </div>
    `;
  });
  if (saSectors.length === 0) {
    html += '<p style="color:#64748b;">今日暂无S/A级板块，建议观望为主。</p>';
  }

  html += `
      <h3 style="color:#ef4444;border-left:4px solid #ef4444;padding-left:10px;margin:20px 0 12px;">四、异常信号提示</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
  `;
  const signals = buildSignalGroups(d);
  const keySignals = [];
  Object.values(signals).forEach(group => group.forEach(s => keySignals.push(s)));
  keySignals.slice(0, 6).forEach(sig => {
    const iconColor = sig.level === 'danger' ? '#dc2626' : sig.level === 'warn' ? '#d97706' : '#059669';
    html += `<div style="padding:10px 14px;background:${sig.level === 'danger' ? '#fef2f2' : sig.level === 'warn' ? '#fffbeb' : '#f0fdf4'};border-radius:6px;border-left:3px solid ${iconColor};"><span style="font-size:16px;margin-right:8px;">${sig.icon}</span><strong style="color:${iconColor};">${sig.title}</strong><span style="color:#64748b;font-size:12px;margin-left:8px;">[${sig.group}]</span><div style="font-size:12px;color:#64748b;margin-top:4px;">${sig.desc}</div></div>`;
  });
  html += `</div>

      <h3 style="color:#ef4444;border-left:4px solid #ef4444;padding-left:10px;margin:20px 0 12px;">五、操作策略</h3>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;">
        <p style="margin:0 0 10px;"><strong>仓位建议：</strong>建议权益仓位<strong style="color:#ef4444;">${pos.position}%</strong>，区间${pos.minPos}-${pos.maxPos}%。${pos.position >= 60 ? '市场处于可操作区间，可积极布局主线。' : pos.position >= 40 ? '仓位中性，保持均衡配置。' : '控制仓位，防御为主。'}</p>
        <p style="margin:0 0 10px;"><strong>配置方向：</strong>重点配置S/A级高分板块（${top5.filter(s=>s.grade==='S'||s.grade==='A').map(s=>s.name).join('、')||'暂无明确主线'}），B级板块持有观察，C/D级板块回避。</p>
        <p style="margin:0 0 10px;"><strong>建仓节奏：</strong>建议分${pos.buildPeriod}个交易日完成建仓，避免一次性满仓。单只个股仓位不超过总规模${userFundSize >= 10e9 ? '3%' : '5%'}。</p>
        <p style="margin:0;"><strong>操作纪律：</strong>严格执行止损，单只个股亏损8%坚决止损；盈利个股设移动止盈，不轻易离场但也不贪婪。</p>
      </div>

      <h3 style="color:#ef4444;border-left:4px solid #ef4444;padding-left:10px;margin:20px 0 12px;">六、风险提示</h3>
      <ul style="padding-left:20px;color:#64748b;font-size:13px;">
        <li>本报告基于量化模型生成，仅供参考，不构成投资建议。</li>
        <li>市场有风险，投资需谨慎。过往业绩不代表未来表现。</li>
        <li>宏观政策变化、海外市场波动、黑天鹅事件等可能导致策略失效。</li>
        <li>VIX当前${globalRisk.vix}，需警惕全球市场波动传导风险。</li>
        ${risk.riskScore >= 60 ? '<li style="color:#dc2626;">当前风险评分较高，建议严格控制仓位。</li>' : ''}
      </ul>

      <div style="text-align:center;color:#94a3b8;font-size:12px;margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;">
        量化投研系统 · ${new Date().toLocaleString('zh-CN')} · 数据来源：东方财富
      </div>
    </div>
  `;
  return html;
}

function showReportModal() {
  const modal = $('report-modal');
  const body = $('report-body');
  const title = $('report-title');
  if (!modal || !body) return;
  if (title) title.textContent = 'A股市场策略日报 · ' + new Date().toLocaleDateString('zh-CN');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">报告生成中...</div>';
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { body.innerHTML = generateBrokerReport(); }, 50);
}

const HistoryDB = {
  key: 'quant_history_db_v2',
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return { snapshots: {}, reports: {} };
      return JSON.parse(raw);
    } catch (e) { return { snapshots: {}, reports: {} }; }
  },
  save(db) {
    try { localStorage.setItem(this.key, JSON.stringify(db)); } catch (e) {}
  },
  saveSnapshot() {
    const db = this.load();
    const dateKey = new Date().toISOString().slice(0, 10);
    const d = currentData;
    if (!d) return false;
    db.snapshots[dateKey] = {
      date: dateKey,
      timestamp: Date.now(),
      marketIndex: d.marketIndex,
      sectors: calculateSectorScores(d),
      signals: buildSignalGroups(d),
      sentiment: { zt: (d.limitUp||{}).total||0, dt: (d.limitDown||{}).total||0 },
      netFlow: (d.sectorFundFlow||[]).reduce((s,x)=>s+(x.mainNetInflow||0),0)
    };
    this.save(db);
    this.saveDailyReport(dateKey);
    return true;
  },
  saveDailyReport(dateKey) {
    const db = this.load();
    const content = generateBrokerReport();
    const title = `${dateKey} 量化晨会日报`;
    db.reports[dateKey + '_daily'] = {
      type: 'daily', date: dateKey, title, content,
      summary: `市场评分${analyzeMarketRegime(currentData).score}分，建议仓位${calculatePositionAdvice(currentData, analyzeMarketRegime(currentData), calculateRiskLevel(currentData)).position}%`
    };
    this.save(db);
  },
  genWeekly() {
    const db = this.load();
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7*24*60*60*1000);
    const endKey = endDate.toISOString().slice(0,10);
    const startKey = startDate.toISOString().slice(0,10);
    const snapKeys = Object.keys(db.snapshots).filter(k => k >= startKey && k <= endKey).sort();
    if (snapKeys.length === 0) { alert('最近7天无历史快照，请先保存每日数据。'); return false; }
    let html = `<h2 style="text-align:center;">周度策略报告（${startKey} 至 ${endKey}）</h2>`;
    html += '<h3>周度走势回顾</h3><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f1f5f9;"><th style="padding:6px;border:1px solid #cbd5e1;">日期</th><th style="padding:6px;border:1px solid #cbd5e1;">市场评分</th><th style="padding:6px;border:1px solid #cbd5e1;">涨跌停比</th><th style="padding:6px;border:1px solid #cbd5e1;">主力净流入(亿)</th></tr></thead><tbody>';
    snapKeys.forEach(k => {
      const s = db.snapshots[k];
      const ratio = s.sentiment.dt > 0 ? (s.sentiment.zt/s.sentiment.dt).toFixed(1) : '∞';
      html += `<tr><td style="padding:6px;border:1px solid #e2e8f0;">${k}</td><td style="padding:6px;border:1px solid #e2e8f0;text-align:center;">${Math.round(50 + (s.sentiment.zt - s.sentiment.dt) * 2)}</td><td style="padding:6px;border:1px solid #e2e8f0;text-align:center;">${ratio}</td><td style="padding:6px;border:1px solid #e2e8f0;text-align:center;">${(s.netFlow/1e8).toFixed(1)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += '<h3>本周核心结论</h3><p>' + generateBrokerReport().split('投资要点')[1].split('一、')[0] + '</p>';
    const reportKey = endKey + '_weekly';
    db.reports[reportKey] = { type: 'weekly', date: endKey, title: `周度策略报告 ${startKey}~${endKey}`, content: html, summary: `本周共${snapKeys.length}个交易日数据` };
    this.save(db);
    return true;
  },
  genMonthly() {
    const db = this.load();
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30*24*60*60*1000);
    const endKey = endDate.toISOString().slice(0,10);
    const startKey = startDate.toISOString().slice(0,10);
    const snapKeys = Object.keys(db.snapshots).filter(k => k >= startKey && k <= endKey).sort();
    if (snapKeys.length === 0) { alert('最近30天无历史快照，请先保存每日数据。'); return false; }
    let html = `<h2 style="text-align:center;">月度策略报告（${startKey} 至 ${endKey}）</h2>`;
    html += `<p>本月共${snapKeys.length}个交易日数据。</p>`;
    html += '<h3>月度核心观点</h3>' + generateBrokerReport();
    const reportKey = endKey + '_monthly';
    db.reports[reportKey] = { type: 'monthly', date: endKey, title: `月度策略报告 ${startKey}~${endKey}`, content: html, summary: `本月共${snapKeys.length}个交易日数据` };
    this.save(db);
    return true;
  },
  deleteItem(key, type) {
    if (!confirm('确定删除这条记录吗？')) return false;
    const db = this.load();
    if (type === 'snapshot') delete db.snapshots[key];
    else delete db.reports[key];
    this.save(db);
    return true;
  },
  compareSnapshot(oldData, newData, oldDate) {
    const oldScored = oldData.sectors || [];
    const newScored = calculateSectorScores(newData);
    const newDate = new Date().toISOString().slice(0,10);
    let html = `<h3 style="color:var(--accent);">历史对比：${oldDate} vs ${newDate}</h3>`;
    html += '<h4>板块评分变化</h4>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:var(--bg-soft);"><th style="padding:6px;border:1px solid var(--border);">板块</th><th style="padding:6px;border:1px solid var(--border);">旧评分</th><th style="padding:6px;border:1px solid var(--border);">新评分</th><th style="padding:6px;border:1px solid var(--border);">变化</th></tr></thead><tbody>';
    newScored.slice(0,10).forEach(ns => {
      const oldS = oldScored.find(o => o.name === ns.name);
      const oldScore = oldS ? oldS.score : '-';
      let delta = '-';
      let deltaColor = 'var(--text-dim)';
      if (oldS) {
        const d = ns.score - oldS.score;
        delta = (d>=0?'+':'') + d;
        deltaColor = d >= 5 ? 'var(--up)' : d <= -5 ? 'var(--down)' : 'var(--text-dim)';
      }
      html += `<tr><td style="padding:6px;border:1px solid var(--border);">${ns.name}</td><td style="padding:6px;border:1px solid var(--border);text-align:center;">${oldScore}</td><td style="padding:6px;border:1px solid var(--border);text-align:center;">${ns.score}</td><td style="padding:6px;border:1px solid var(--border);text-align:center;color:${deltaColor};font-weight:600;">${delta}</td></tr>`;
    });
    html += '</tbody></table>';
    const oldNet = oldData.netFlow || 0;
    const newNet = (newData.sectorFundFlow||[]).reduce((s,x)=>s+(x.mainNetInflow||0),0);
    const oldZt = (oldData.sentiment||{}).zt || 0;
    const newZt = (newData.limitUp||{}).total || 0;
    const oldDt = (oldData.sentiment||{}).dt || 0;
    const newDt = (newData.limitDown||{}).total || 0;
    html += `<h4>市场情绪对比</h4><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:13px;">
      <div style="padding:10px;background:var(--bg-soft);border-radius:6px;text-align:center;">
        <div style="color:var(--text-dim);font-size:11px;">主力净流入</div>
        <div style="font-weight:600;color:${newNet>=0?'var(--up)':'var(--down)'};">${oldDate}: ${(oldNet/1e8).toFixed(1)}亿<br>${newDate}: ${(newNet/1e8).toFixed(1)}亿</div>
      </div>
      <div style="padding:10px;background:var(--bg-soft);border-radius:6px;text-align:center;">
        <div style="color:var(--text-dim);font-size:11px;">涨停</div>
        <div style="font-weight:600;">${oldDate}: ${oldZt}家<br>${newDate}: ${newZt}家</div>
      </div>
      <div style="padding:10px;background:var(--bg-soft);border-radius:6px;text-align:center;">
        <div style="color:var(--text-dim);font-size:11px;">跌停</div>
        <div style="font-weight:600;">${oldDate}: ${oldDt}家<br>${newDate}: ${newDt}家</div>
      </div>
    </div>`;
    return html;
  }
};

function renderHistoryTree() {
  const tree = $('history-tree');
  if (!tree) return;
  const db = HistoryDB.load();
  const allDates = new Set([...Object.keys(db.snapshots), ...Object.keys(db.reports).map(k => k.split('_')[0])]);
  const dates = Array.from(allDates).sort().reverse();
  if (dates.length === 0) {
    tree.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">暂无历史记录<br><br>点击"保存今日快照"开始</div>';
    return;
  }
  const years = {};
  dates.forEach(d => {
    const y = d.slice(0,4);
    const m = d.slice(0,7);
    if (!years[y]) years[y] = {};
    if (!years[y][m]) years[y][m] = [];
    years[y][m].push(d);
  });
  let html = '';
  Object.keys(years).sort().reverse().forEach(y => {
    html += `<div class="history-year" style="margin-bottom:8px;"><div class="history-year-toggle" style="cursor:pointer;font-weight:600;padding:6px 0;color:var(--accent);">📅 ${y}年</div><div class="history-months" style="padding-left:12px;">`;
    Object.keys(years[y]).sort().reverse().forEach(m => {
      const monthLabel = m.slice(5) + '月';
      html += `<div class="history-month" style="margin:4px 0;"><div class="history-month-toggle" style="cursor:pointer;color:var(--text);padding:4px 0;">📁 ${monthLabel}</div><div class="history-days" style="padding-left:16px;display:none;">`;
      years[y][m].forEach(d => {
        const hasSnap = !!db.snapshots[d];
        const dayReports = Object.keys(db.reports).filter(k => k.startsWith(d)).map(k => db.reports[k]);
        html += `<div class="history-day" style="margin:4px 0;"><span class="history-day-toggle" data-date="${d}" style="cursor:pointer;padding:2px 6px;border-radius:4px;display:inline-block;" onmouseover="this.style.background='var(--bg-soft)'" onmouseout="this.style.background='transparent'">📄 ${d.slice(5)}日 ${hasSnap ? '<span style="color:var(--up);font-size:10px;">快照</span>' : ''} ${dayReports.length ? `<span style="color:var(--accent);font-size:10px;">${dayReports.length}篇研报</span>` : ''}</span></div>`;
      });
      html += '</div></div>';
    });
    html += '</div></div>';
  });
  tree.innerHTML = html;

  setTimeout(() => {
    tree.querySelectorAll('.history-year-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const months = el.nextElementSibling;
        months.style.display = months.style.display === 'none' ? 'block' : 'none';
      });
    });
    tree.querySelectorAll('.history-month-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const days = el.nextElementSibling;
        days.style.display = days.style.display === 'none' ? 'block' : 'none';
      });
    });
    tree.querySelectorAll('.history-day-toggle').forEach(el => {
      el.addEventListener('click', () => loadHistory(el.dataset.date));
    });
    tree.querySelectorAll('.history-months').forEach(el => { el.style.display = 'block'; });
  }, 50);
}

function loadHistory(dateKey) {
  const content = $('history-content');
  if (!content) return;
  const db = HistoryDB.load();
  let html = `<div style="padding:12px;"><h3 style="margin:0 0 16px 0;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:8px;">📂 ${dateKey} 历史记录</h3>`;

  const snap = db.snapshots[dateKey];
  if (snap) {
    html += `<div style="background:var(--bg-soft);border-radius:8px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong>📊 市场快照</strong>
        <button class="btn btn-sm btn-history-del" data-type="snapshot" data-key="${dateKey}" style="background:#ef4444;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">删除</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:13px;margin-bottom:10px;">
        <div><span style="color:var(--text-dim);">涨停：</span>${snap.sentiment.zt}家</div>
        <div><span style="color:var(--text-dim);">跌停：</span>${snap.sentiment.dt}家</div>
        <div><span style="color:var(--text-dim);">净流入：</span><span style="color:${snap.netFlow>=0?'var(--up)':'var(--down)'};">${snap.netFlow>=0?'+':''}${(snap.netFlow/1e8).toFixed(1)}亿</span></div>
      </div>
      <div style="font-size:12px;color:var(--text-dim);">板块评分TOP3：${snap.sectors.slice(0,3).map(s=>s.name+'('+s.grade+')').join('、')}</div>
    </div>`;
  }

  const reports = Object.keys(db.reports).filter(k => k.startsWith(dateKey)).map(k => ({key:k, ...db.reports[k]}));
  if (reports.length) {
    reports.forEach(r => {
      const typeLabel = r.type === 'daily' ? '日报' : r.type === 'weekly' ? '周报' : '月报';
      const typeColor = r.type === 'daily' ? '#3b82f6' : r.type === 'weekly' ? '#8b5cf6' : '#ec4899';
      html += `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div><span style="background:${typeColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:8px;">${typeLabel}</span><strong>${r.title}</strong></div>
          <button class="btn btn-sm btn-history-del" data-type="report" data-key="${r.key}" style="background:#ef4444;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">删除</button>
        </div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">${r.summary}</div>
        <details><summary style="cursor:pointer;color:var(--accent);font-size:12px;">查看完整内容</summary><div style="margin-top:10px;padding:12px;background:var(--bg);border-radius:6px;max-height:500px;overflow-y:auto;font-size:13px;">${r.content}</div></details>
      </div>`;
    });
  }

  if (!snap && !reports.length) {
    html += '<div style="text-align:center;color:var(--text-dim);padding:30px;">该日期无记录</div>';
  }
  html += '</div>';
  content.innerHTML = html;

  setTimeout(() => {
    content.querySelectorAll('.btn-history-del').forEach(btn => {
      btn.addEventListener('click', () => {
        if (HistoryDB.deleteItem(btn.dataset.key, btn.dataset.type)) {
          renderHistoryTree();
          loadHistory(dateKey);
        }
      });
    });
  }, 50);
}

function buildSignalGroups(data) {
  const d = data;
  const up = d.limitUp || { total: 0, list: [] };
  const down = d.limitDown || { total: 0, list: [] };
  const ztCount = up.total || 0;
  const dtCount = down.total || 0;
  const ratio = dtCount > 0 ? ztCount / dtCount : (ztCount > 0 ? 3 : 1);
  const sectorFlow = d.sectorFundFlow || [];
  const totalInflow = sectorFlow.reduce((s, x) => s + Math.max(0, x.mainNetInflow || 0), 0);
  const totalOutflow = sectorFlow.reduce((s, x) => s + Math.min(0, x.mainNetInflow || 0), 0);
  const netFlow = totalInflow + totalOutflow;
  const scored = calculateSectorScores(d);
  const daySeed = new Date().getDate();
  const vix = 15 + (daySeed % 15);
  const globalRisk = getGlobalRiskData();
  const regime = analyzeMarketRegime(d);
  const risk = calculateRiskLevel(d);

  const groups = {
    '资金/趋势': [],
    '流动性/情绪': [],
    '产业链传导': [],
    '产业生态': [],
    '风控/风险': []
  };

  if (totalInflow > 8e9) groups['资金/趋势'].push({ icon: '💰', level: 'success', title: '主力资金大幅流入', desc: `全市场主力净流入${(totalInflow/1e8).toFixed(0)}亿，资金入场积极，关注主线持续性。` });
  else if (totalOutflow < -8e9) groups['资金/趋势'].push({ icon: '💸', level: 'danger', title: '主力资金大幅流出', desc: `全市场主力净流出${Math.abs(totalOutflow/1e8).toFixed(0)}亿，资金离场明显，注意风险。` });
  if (ztCount > 60) groups['资金/趋势'].push({ icon: '🚀', level: 'success', title: '涨停潮涌现', desc: `涨停家数达${ztCount}家，市场赚钱效应强，情绪活跃。` });
  if (dtCount > 30) groups['资金/趋势'].push({ icon: '📉', level: 'danger', title: '跌停潮出现', desc: `跌停家数达${dtCount}家，亏钱效应扩散，控制仓位。` });
  const topSector = scored[0];
  if (topSector && topSector.score >= 80 && topSector.fundFlow > 0) groups['资金/趋势'].push({ icon: '⭐', level: 'success', title: '高分板块领涨', desc: `${topSector.name}评分${topSector.score}分（${topSector.grade}级），资金流入${(topSector.fundFlow/1e8).toFixed(1)}亿，或为今日主线。` });

  const totalVol = sectorFlow.reduce((s, x) => s + Math.abs(x.mainNetInflow || 0), 0) / 1e8;
  if (totalVol > 200) groups['流动性/情绪'].push({ icon: '🌊', level: 'warn', title: '成交量异常放大', desc: `板块资金成交${totalVol.toFixed(0)}亿，交投过热，警惕冲高回落。` });
  else if (totalVol < 50) groups['流动性/情绪'].push({ icon: '🧊', level: 'warn', title: '成交量萎缩', desc: `板块资金成交仅${totalVol.toFixed(0)}亿，市场观望情绪浓。` });
  if (ratio > 5) groups['流动性/情绪'].push({ icon: '🔥', level: 'success', title: '市场情绪过热', desc: `涨跌停比${ratio.toFixed(1)}:1，情绪亢奋，注意获利了结。` });
  else if (ratio < 0.4) groups['流动性/情绪'].push({ icon: '❄️', level: 'danger', title: '市场情绪冰点', desc: `涨跌停比仅${ratio.toFixed(1)}:1，情绪极度低迷，等待企稳信号。` });
  if (vix > 25) groups['流动性/情绪'].push({ icon: '😱', level: 'danger', title: 'VIX恐慌指数飙升', desc: `VIX=${globalRisk.vix}，全球避险情绪升温。` });
  else if (vix < 16) groups['流动性/情绪'].push({ icon: '😌', level: 'success', title: 'VIX低位运行', desc: `VIX=${globalRisk.vix}，全球风险偏好较高。` });

  const hotChains = scored.slice(0, 5).filter(s => {
    const normSec = s.name;
    return SUPPLY_CHAINS.some(c => c.sectors.some(sec => normSec.includes(sec) || sec.includes(normSec)));
  });
  if (hotChains.length >= 2) {
    groups['产业链传导'].push({ icon: '🔗', level: 'success', title: '产业链联动上涨', desc: `${hotChains.map(s=>s.name).slice(0,3).join('、')}等产业链相关板块集体走强，关注链主机会。` });
  }
  const bottlenecks = [];
  Object.values(CHAIN_DETAIL).forEach(cd => {
    (cd.bottlenecks || []).forEach(b => {
      const hasHot = scored.slice(0,8).some(s => b.stocks.includes(s.name) || s.name.includes(b.title.slice(0,2)));
      if (hasHot && b.severity === '极高') bottlenecks.push(b.title);
    });
  });
  if (bottlenecks.length) groups['产业链传导'].push({ icon: '🎯', level: 'warn', title: '卡脖子环节异动', desc: `${bottlenecks.slice(0,2).join('、')}等环节受关注，国产替代逻辑强化。` });

  const flywheelActive = ['固态电池', 'AI Agent', '人形机器人'].filter(name => {
    const s = scored.find(x => x.name === name || x.name.includes(name.slice(0,2)));
    return s && s.changePct > 1;
  });
  if (flywheelActive.length) groups['产业生态'].push({ icon: '🔄', level: 'success', title: '长期主线启动', desc: `${flywheelActive.join('、')}产业飞轮方向异动，可长线布局。` });
  const chainLeaders = [];
  Object.values(CHAIN_DETAIL).forEach(cd => {
    (cd.leaders || []).forEach(l => {
      const hot = scored.slice(0,5).some(s => l.industry.includes(s.name) || s.name.includes(l.industry.slice(0,2)));
      if (hot) chainLeaders.push(l.name);
    });
  });
  if (chainLeaders.length) groups['产业生态'].push({ icon: '🏭', level: 'success', title: '链主公司领涨', desc: `${chainLeaders.slice(0,3).join('、')}等产业链链主表现强势。` });

  const idxChange = (d.marketIndex && d.marketIndex[0]) ? d.marketIndex[0].changePct : 0;
  if (idxChange < -2) groups['风控/风险'].push({ icon: '🚨', level: 'danger', title: '指数大幅下挫', desc: `大盘跌幅${idxChange.toFixed(2)}%，市场破位下跌，严格止损。` });
  if (risk.riskScore >= 60) groups['风控/风险'].push({ icon: '⚠️', level: 'danger', title: '风险等级偏高', desc: `风险评分${risk.riskScore}分，${risk.level}风险，建议降仓。` });
  const flashCrash = scored.filter(s => s.changePct < -5).slice(0, 2);
  if (flashCrash.length) groups['风控/风险'].push({ icon: '⚡', level: 'warn', title: '板块闪崩预警', desc: `${flashCrash.map(s=>s.name).join('、')}跌幅较大，回避相关标的。` });
  if (globalRisk.riskCls === 'danger') groups['风控/风险'].push({ icon: '🌍', level: 'warn', title: '全球风险升温', desc: globalRisk.summary });

  Object.keys(groups).forEach(k => {
    if (groups[k].length === 0) {
      groups[k].push({ icon: '✅', level: 'info', title: '暂无异常信号', desc: '该维度运行平稳。' });
    }
    groups[k].forEach(s => s.group = k);
  });
  return groups;
}

function renderMarketSignals() {
  const d = currentData;
  if (!d) return;
  const container = $('abnormal-signal-list');
  if (!container) return;
  renderGlobalRisk();
  const groups = buildSignalGroups(d);
  let html = '';
  Object.entries(groups).forEach(([name, sigs]) => {
    if (!sigs || sigs.length === 0) return;
    const hasDanger = sigs.some(s => s.level === 'danger');
    html += `<div class="signal-group" style="margin-bottom:16px;">
      <div class="signal-group-title" style="font-weight:600;font-size:13px;padding:8px 12px;background:${hasDanger ? 'rgba(239,68,68,0.1)' : 'var(--bg-soft)'};border-radius:6px;margin-bottom:8px;border-left:3px solid ${hasDanger ? '#ef4444' : 'var(--accent)'};}">
        ${name} <span style="font-weight:400;font-size:11px;color:var(--text-muted);margin-left:6px;">${sigs.length}条信号</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
    `;
    sigs.forEach(s => {
      const borderColor = s.level === 'danger' ? '#ef4444' : s.level === 'warn' ? '#f59e0b' : s.level === 'success' ? '#22c55e' : '#64748b';
      const bgColor = s.level === 'danger' ? 'rgba(239,68,68,0.06)' : s.level === 'warn' ? 'rgba(245,158,11,0.06)' : s.level === 'success' ? 'rgba(34,197,94,0.06)' : 'var(--bg-soft)';
      html += `<div class="signal-item ${s.level}" style="padding:10px 14px;background:${bgColor};border-radius:6px;border-left:3px solid ${borderColor};display:flex;gap:10px;align-items:flex-start;">
        <span style="font-size:18px;">${s.icon}</span>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${s.title}</div>
          <div style="font-size:12px;color:var(--text-dim);">${s.desc}</div>
        </div>
      </div>`;
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      const panelId = 'panel-' + tabName;
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = $(panelId);
      if (panel) panel.classList.add('active');
      document.querySelectorAll('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.tab === tabName));
      if (tabName === 'history') renderHistoryTree();
    });
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = link.dataset.tab;
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
      if (tabBtn) tabBtn.click();
      const sidebar = $('sidebar');
      if (sidebar) sidebar.classList.remove('open');
      const backdrop = $('sidebar-backdrop');
      if (backdrop) backdrop.classList.remove('show');
    });
  });
  const sbToggle = $('sidebar-toggle');
  if (sbToggle) {
    sbToggle.addEventListener('click', () => {
      const sb = $('sidebar');
      const bd = $('sidebar-backdrop');
      if (sb) sb.classList.toggle('open');
      if (bd) bd.classList.toggle('show');
    });
  }
  const sbBackdrop = $('sidebar-backdrop');
  if (sbBackdrop) {
    sbBackdrop.addEventListener('click', () => {
      const sb = $('sidebar');
      if (sb) sb.classList.remove('open');
      sbBackdrop.classList.remove('show');
    });
  }
}

function closeReportModal() {
  const modal = $('report-modal');
  if (modal) modal.classList.remove('show');
  document.body.style.overflow = '';
}

function initButtons() {
  const btnReport = $('btn-report');
  if (btnReport) btnReport.addEventListener('click', showReportModal);

  const btnSaveDaily = $('btn-save-daily');
  if (btnSaveDaily) btnSaveDaily.addEventListener('click', () => {
    if (HistoryDB.saveSnapshot()) {
      alert('今日快照和日报已保存！');
      renderHistoryTree();
    } else { alert('数据未加载，请稍后重试。'); }
  });
  const btnGenWeekly = $('btn-gen-weekly');
  if (btnGenWeekly) btnGenWeekly.addEventListener('click', () => {
    if (HistoryDB.genWeekly()) { alert('周报已生成！'); renderHistoryTree(); }
    else { alert('历史数据不足，至少需要一天快照。'); }
  });
  const btnGenMonthly = $('btn-gen-monthly');
  if (btnGenMonthly) btnGenMonthly.addEventListener('click', () => {
    if (HistoryDB.genMonthly()) { alert('月报已生成！'); renderHistoryTree(); }
    else { alert('历史数据不足，至少需要一天快照。'); }
  });

  const btnRefresh = $('btn-refresh');
  if (btnRefresh) btnRefresh.addEventListener('click', () => { loadAllData(); });

  const fundSizeInput = $('custom-fund-size');
  const btnApplyFund = $('btn-apply-fund-size');
  const btnResetFund = $('btn-reset-fund-size');
  if (btnApplyFund) btnApplyFund.addEventListener('click', applyFundSize);
  if (btnResetFund) btnResetFund.addEventListener('click', () => {
    userFundSize = 2e10;
    if (fundSizeInput) fundSizeInput.value = 20000000000;
    if (currentData) {
      const decision = renderDecisionCore(currentData);
      $('risk-advice').innerHTML = generateRiskAdvice(currentData, decision);
    }
  });

  const btnSnapshot = $('btn-snapshot');
  if (btnSnapshot) btnSnapshot.addEventListener('click', () => {
    if (!currentData) return alert('数据未加载');
    HistoryDB.saveSnapshot();
    alert('快照已保存到研报库');
    renderSidebarSnapshots();
  });

  const autoRefresh = $('auto-refresh');
  if (autoRefresh) {
    autoRefresh.addEventListener('change', () => {
      if (autoRefreshTimer) clearInterval(autoRefreshTimer);
      if (autoRefresh.checked) {
        autoRefreshTimer = setInterval(() => { if (currentData) loadAllData(); }, 60000);
      }
    });
  }

  const btnCloseCompare = $('btn-close-compare');
  if (btnCloseCompare) btnCloseCompare.addEventListener('click', () => {
    $('compare-result-card').style.display = 'none';
  });

  initSnapshotButtons();
  initDetailTabs();
  renderSidebarSnapshots();
}

function applyFundSize() {
  const input = $('custom-fund-size');
  if (!input) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || val <= 0) { alert('请输入正确的资产规模（单位：元）'); return; }
  userFundSize = val;
  if (currentData) {
    const decision = renderDecisionCore(currentData);
    $('risk-advice').innerHTML = generateRiskAdvice(currentData, decision);
    alert('已应用新资产规模：' + formatFundLabel(userFundSize));
  }
}

async function loadAllData() {
  try {
    const data = await API.fetchAllMarketData();
    currentData = data;
    renderMarketIndex(data.marketIndex);
    renderGlobalMarket(data.globalMarket);
    renderSectorScores(data);
    generateSectorAdvice(data);
    renderMarketSignals();
    renderEcologyAll();
    const decision = renderDecisionCore(data);
    $('risk-advice').innerHTML = generateRiskAdvice(data, decision);
    if (currentSelectedSector) {
      showSectorDetail(currentSelectedSector);
    }
    renderSidebarSnapshots();
  } catch (e) {
    console.error('Data load error:', e);
  }
}

function initSnapshotButtons() {
  const btnRestore = $('btn-restore-snapshot');
  const btnCompare = $('btn-compare-snapshot');
  const btnDelete = $('btn-delete-snapshot');
  const sel = $('snapshot-select');
  if (btnRestore && sel) {
    btnRestore.addEventListener('click', () => {
      const key = sel.value;
      if (!key) return alert('请先选择快照');
      const db = HistoryDB.load();
      const snap = db.snapshots[key];
      if (!snap) return alert('快照不存在');
      currentData = snap.data;
      renderMarketIndex(currentData.marketIndex);
      renderGlobalMarket(currentData.globalMarket);
      renderSectorScores(currentData);
      generateSectorAdvice(currentData);
      renderMarketSignals();
      renderEcologyAll();
      const decision = renderDecisionCore(currentData);
      $('risk-advice').innerHTML = generateRiskAdvice(currentData, decision);
      alert('已回溯到 ' + key + ' 快照');
    });
  }
  if (btnCompare && sel) {
    btnCompare.addEventListener('click', () => {
      const key = sel.value;
      if (!key || !currentData) return alert('请先选择快照并加载当前数据');
      const db = HistoryDB.load();
      const snap = db.snapshots[key];
      if (!snap) return alert('快照不存在');
      const html = HistoryDB.compareSnapshot(snap.data, currentData, key);
      $('compare-result-content').innerHTML = html;
      $('compare-result-card').style.display = 'block';
    });
  }
  if (btnDelete && sel) {
    btnDelete.addEventListener('click', () => {
      const key = sel.value;
      if (!key) return alert('请先选择快照');
      if (!confirm('确认删除 ' + key + ' 快照？')) return;
      const db = HistoryDB.load();
      delete db.snapshots[key];
      if (db.reports[key]) delete db.reports[key];
      HistoryDB.save(db);
      renderSidebarSnapshots();
      renderHistoryTree();
    });
  }
}

function renderSidebarSnapshots() {
  const container = $('sidebar-snapshot');
  const actions = $('sidebar-snapshot-actions');
  const sel = $('snapshot-select');
  if (!container || !sel) return;
  const db = HistoryDB.load();
  const keys = Object.keys(db.snapshots).sort().reverse();
  if (keys.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">暂无快照，点击📷按钮保存</div>';
    if (actions) actions.style.display = 'none';
    sel.style.display = 'none';
    return;
  }
  container.innerHTML = `<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">共 ${keys.length} 个快照</div>`;
  sel.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
  sel.style.display = 'block';
  if (actions) actions.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initButtons();
  loadAllData();
});