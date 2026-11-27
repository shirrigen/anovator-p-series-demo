(function (root) {
  'use strict';
  const sources = {};
  const metric = (id, label, value, unit, more = {}) => ({ id, label, value, unit, ...more });
  const bodyMetrics = [
    metric('height','身高',174,'cm'),metric('weight','体重',68.4,'kg'),metric('bmi','BMI',22.6,''),
    metric('fat','体脂率',23.1,'%'),metric('visceral','内脏脂肪',7,'等级'),metric('subfat','皮下脂肪率',20.4,'%'),
    metric('muscle','肌肉量',48.2,'kg'),metric('bone','骨量',2.8,'kg'),metric('water','总体水分',55.2,'%'),
    metric('protein','蛋白质',16.2,'%'),metric('bmr','基础代谢',1480,'kcal/日'),
    metric('musclePercent','肌肉比例',40,'%'),metric('fatFree','去脂体重',52.6,'kg'),metric('skeletal','骨骼肌',27.1,'kg')
  ];
  const task = (id,name,group,value,prep,stages,outputs,legacy,refs,extra={}) => ({id,name,group,value,prep,stages,outputs,legacy,refs,roles:['首次受测者','复测者','协助人员','专业解读者'],criteria:['I1','I3','G2','C1'],...extra});
  const tests = [
    task('body','人体成分','身体与生理','知道身体构成、读懂差异，并能找到具体指标和部位依据。',['双脚站稳，接触脚部电极','双手握住手柄，接触手部电极','按示范保持姿势'],['测量开始','正在采集身体数据','正在检查数据'],bodyMetrics,['F03','F11'],['old','mbody','composition'],{needsProfile:true,needsBasics:true,issue:'Q-FIELDS',detail:'保留旧 P 的 BMI、BMR、肌肉比例，以及 M 的肌肉量、去脂体重、骨骼肌；量与比例分开。更高频水分/相位角仅在能力确认后启用。',improve:'由有含义的数值与图形关系引导读取，缺测不显示成零；准备展示预期产出。'}),
    task('bp','血压','身体与生理','分清即时袖带压力与最终收缩压、舒张压，完整读取双值。',['按器械示范戴好并连接袖带','按示范调整测量姿势','准备好后开始'],['等待设备开始','充气 · 袖带压力','放气 · 袖带压力','血压测量完成'],[metric('systolic','收缩压',121,'mmHg'),metric('diastolic','舒张压',75,'mmHg')],['F04'],['old','mbody','home'],{peripheral:'cuff',issue:'Q-BP',improve:'纠正旧汇总双值错配；测中压力与结果分开，停止确认后才能离开。'}),
    task('oxygen','血氧与心率','身体与生理','知道接触是否有效，读取同次血氧和脉搏，区别实测与派生。',['连接指夹','按器械要求放入手指','保持手指稳定，等待信号'],['等待有效接触','信号稳定','记录血氧与脉搏'],[metric('spo2','血氧饱和度',98,'%'),metric('pulse','脉搏',72,'次/分'),metric('mhr','最大心率估计','—','',{pending:true}),metric('zone','运动心率区间','—','',{pending:true})],['F05'],['old','mbody'],{peripheral:'oximeter',issue:'Q-OX',improve:'无有效信号显示等待，避免初始 0 被当作真实结果；波形与派生区间分别标明依据。'}),
    task('posture','体态与围度','影像与活动度','把本人影像、尺寸、骨点和风险联系起来，允许按视角纠正采集。',['确认取景、服装与站姿要求','面对摄像头，进入完整取景范围','按提示完成正面和侧面'],['正面取景与采集','检查正面影像','侧面取景与采集','检查侧面影像','分析身体数据'],[metric('waist','腰围',81.5,'cm'),metric('hip','臀围',94.2,'cm'),metric('whr','腰臀比',0.87,''),metric('postureRisk','体态风险','未评级','',{pending:true})],['F10','F12'],['old','mposture'],{needsBasics:true,issue:'Q-POSTURE',quality:true,improve:'选视角、拍摄、查看和重拍有明确区别；保留脸部隐私遮蔽；尺寸缺失和分析失败可单独恢复。'}),
    task('scan360','360° 旋转采集','影像与活动度','明白旋转即将发生、何时保持与结束；获得独立有效的采集记录。',['按器械示范站稳，确认周围没有障碍','了解旋转过程中的开始和结束提示','准备好后，由本人或工作人员开始'],['确认旋转开始条件','正在旋转采集','等待转台停止','检查影像质量'],[metric('scan','旋转记录','已采集',''),metric('model','三维查看能力','待核','',{pending:true})],['G14'],['models','flow'],{issue:'Q-ROTATION',quality:true,improve:'不把正侧照片冒充旋转采集，也不凭“3D”名称推定可自由旋转的三维模型。'}),
    task('shoulder','肩关节活动度','影像与活动度','明确当前侧别与动作，完成左右前屈/外展并能局部重测。',['进入识别区域','查看当前测试的手臂和动作示范','按示范完成动作'],['左侧前屈','右侧前屈','左侧外展','右侧外展'],[metric('lf','左前屈',155,'°'),metric('rf','右前屈',158,'°'),metric('la','左外展',160,'°'),metric('ra','右外展',162,'°')],['F09'],['old','mshoulder'],{issue:'Q-ANGLES',improve:'动作目标与测得最大角度分开；左右与动作名称贯穿采集、重测、结果。'}),
    task('lung','肺活量','外设与视觉','跟上吹气时机，知道一次尝试是否有效，以及本次采用了哪一次结果。',['连接肺活量计','按器械示范准备吹嘴，调整姿势','等待设备就绪'],['连接与就绪','正在记录吹气数据','本次测量结束'],[metric('capacity','肺活量',3200,'mL')],['F06'],['old','mlung'],{peripheral:'spirometer',issue:'Q-ATTEMPTS',attempts:true,improve:'保留多次尝试；不默认取最大值。最后一次/最佳值/人工确认的正式规则待核。'}),
    task('grip','握力','外设与视觉','知道当前测试哪只手，区分即时施力与本次采用值，完成双侧或识别缺侧。',['连接握力计','按示范握好，确认先测哪只手','准备好后握紧'],['左手施力','左手完成与换手','右手施力','检查双手结果'],[metric('left','左手握力',32,'kg'),metric('right','右手握力',35,'kg')],['F31','G11'],['mgrip','models'],{peripheral:'dynamometer',issue:'Q-ATTEMPTS',attempts:true,improve:'纠正右手完成仍标 Left 的问题；缺一侧不伪装双侧完成，提交与重测分别可达。'}),
    task('vision','视力','外设与视觉','知道当前眼别、视标与应答方式，获得分眼结果。',['按设备指引站到指定位置','了解如何作答或请工作人员协助','遮盖非测试眼并按指引作答'],['右眼视标','应答回执及换眼','左眼视标'],[metric('leftEye','左眼','记录待计算','',{pending:true}),metric('rightEye','右眼','记录待计算','',{pending:true})],['X01'],['old','mvision','screenStudy'],{issue:'Q-VISION',improve:'保留 E/C/Snellen 与地区口径入口；本原型演示眼别和应答，不运行未经确认的计分。'}),
    task('color','色觉','外设与视觉','理解题目与作答，知道完成程度和结果适用边界。',['按设备指引调整观看位置','了解作答方式'],['题目与作答','核对漏答','完成记录'],[metric('colorResult','色觉结果','待正式判读','',{pending:true})],['F32'],['mvision','screenStudy'],{issue:'Q-VISION',improve:'题目、漏答、未完成与判读分开；不将示意色块用于真实测试。'}),
    task('astigmatism','散光','外设与视觉','完成指定视标任务，保留左右眼、轴位/散光字段的明确归属。',['查看视标与作答示范','按提示分别测试左右眼'],['左眼观察','右眼观察','记录答题'],[metric('leftEye','左眼线位','待记录','',{pending:true}),metric('rightEye','右眼线位','待记录','',{pending:true})],['F32'],['mvision','screenStudy'],{issue:'Q-VISION',improve:'不把旧画面中有字段当作该 P 型号已支持的有效检测。'}),
    task('balance','平衡能力','运动能力','不依赖持续看屏，也能理解动作、开始、停止与有效结束。',['按器械示范站稳','了解开始和结束的提示','如有需要，请工作人员协助'],['准备倒数','平衡动作进行','动作结束确认'],[metric('balance','平衡评分','未计算','',{pending:true})],['F07'],['old','models'],{issue:'Q-MOTOR',improve:'准备页不预填 100 分；提前落脚、无效和低分有不同状态。'}),
    task('agility','敏捷反应','运动能力','知道要响应哪个目标、还剩几次，并得到本次有效反应结果。',['站在可触达位置','了解如何点击目标'],['等待亮格','目标反应 · 5 次','点中回执'],[metric('reaction','平均反应时间','待计量','ms',{pending:true}),metric('count','有效响应','待记录','次',{pending:true})],['F08'],['old','models','screenStudy'],{issue:'Q-MOTOR',improve:'保留任务性目标刺激；主题变换不得改变协议规定的刺激分布和时序。'}),
    task('pushups','俯卧撑上肢力量','运动能力','理解动作判定、有效计次与结束，避免把识别丢失当成完成。',['查看本项动作示范','了解动作要求和计次方式','站到识别范围内，了解提示方式'],['识别就绪','动作与有效计次','结束与数据检查'],[metric('reps','有效次数',12,'次'),metric('grade','评价','未评级','',{pending:true})],['G12'],['models','old'],{issue:'Q-MOTOR',improve:'动作计次、无效动作、出框和完成分别表现；缺实际规程时只评审功能位置。'}),
    task('jump','下肢爆发力','运动能力','知道开始条件和落地后的结束信号，读取有效尝试。',['查看本项动作示范和准备要求','按指引进入安全动作区域'],['站位与识别','动作捕捉','落地与完成确认'],[metric('jump','爆发力结果','待正式字段','',{pending:true})],['G13'],['models','old'],{issue:'Q-MOTOR',improve:'P5手册中的阻抗前置条件仍需核实，不自行认定所有配置都依赖或都不依赖。'}),
    task('rope','一分钟跳绳','扩展参考','区分准备、计时计次、停止与最终记录。',['确认跳绳设备已连接','按示范准备足够的活动空间'],['外设就绪','计时计次','结束记录'],[metric('ropeCount','次数',80,'次'),metric('duration','时长',60,'秒')],['X02'],['old','models'],{issue:'Q-MOTOR',improve:'保留旧图能力去向；K2及部分历史/出口配置线索，不默认加入现有所有 P。'})
  ];
  const hiddenTests = new Set(root.ANOVATOR_HIDDEN_TESTS);
  const isTestVisible = id => !hiddenTests.has(id);
  const isRouteVisible = route => isTestVisible(route?.split('/')[1]);
  const visibleTests = tests.filter(task => isTestVisible(task.id));
  const profile = (id,name,tests,note,extra={}) => ({
    id,name,note,source:'models',height:'manual-review',weight:'auto',...extra,
    tests:tests.filter(isTestVisible),pending:(extra.pending||[]).filter(isTestVisible)
  });
  const profiles = [
    profile('p-ultrasonic','P · 带超声组件的条件样例',['body'],'只验证已确认的超声测高条件，不推定具体P型号的完整能力。体重在体成分内实测，无需录入。',{height:'auto',heightMethod:'ultrasonic'}),
    profile('m9-height','M9 · 相机测高参照',['body'],'只借用已确认的相机计算身高规则；不是M9完整功能配置。身高与体重随体成分无感取得，结果中展示；具体采集时机与接口待核。',{height:'auto',heightMethod:'camera',heightReference:true}),
    profile('p0','P0 · 基础',['body'],'产品表 CN G3：体成分。当前按无超声组件的手动身高条件评审，具体硬件版本仍待核。'),
    profile('p1','P1 · 资料配置',['body','posture','balance'],'CN G7：体成分、体态围度、平衡。'),
    profile('p2','P2 · 旧款资料',['body','posture','shoulder'],'CN G11：现有 M2PRO。不可替代新 P2 参数。',{pending:['scan360']}),
    profile('p2new','P2 · 新款已确认条件',['body'],'用户确认32英寸、约1473mm、身高体重双自动；新款其他测项未有独立签认表。',{height:'auto',weight:'auto',pending:['posture','shoulder','scan360'],rotation:true}),
    profile('p3','P3 · 中文资料',['body','bp','oxygen','posture','shoulder','lung','balance','agility'],'CN G15。视力/跳绳的市场与版本线索单列，未默认启用。',{pending:['vision','rope']}),
    profile('p5cn','P5 · 中文资料',['body','bp','oxygen','lung','balance','agility','grip','jump','pushups','posture'],'CN G19；心肺与英文表差异待签认。肩关节未列，不自行加入。',{pending:['scan360']}),
    profile('p5en','P5 · 英文资料',['body','bp','lung','balance','agility','grip','jump','pushups','posture'],'EN F19 未列心肺；血氧保留待核入口，不把缺列直接定为不支持。',{pending:['oxygen','scan360']}),
    profile('all','全能力参考 · P＋M',tests.map(t=>t.id),'用于完整功能覆盖评审，不代表任何一台已发布设备。视力、色觉、散光、跳绳及高级结果按来源保留。',{height:'auto',weight:'auto',referenceOnly:true,rotation:true,advancedBody:true})
  ];
  const roles = [{id:'self',name:'首次受测者'},{id:'repeat',name:'复测会员'},{id:'operator',name:'一线操作者'},{id:'professional',name:'专业解读者'},{id:'admin',name:'设备管理者'}];
  const issues = [
    {id:'Q-CONFIG',title:'型号、市场与软件功能表',area:'配置',detail:'P5心肺中英文差异、P3视力/跳绳版本、新P2独立能力表和M9血氧备注待确认。',close:'产品按型号/款型/市场/版本签认启用表。',refs:['models','product']},
    {id:'Q-IDENTITY',title:'身份、授权与匿名路线',area:'会话',detail:'ID规则、扫码协议、拒绝同意后是否允许匿名、会话保留期限与超时规则待确认。',close:'确认最小身份数据、允许的拒绝路线及公开界面清理规则。',refs:['old','product']},
    {id:'Q-BASICS',title:'身高条件与账号复用',area:'前置',detail:'已确认超声组件P在成分内测高、M9相机计算、其余手填绑定账号并复用。G01-v05实现条件分流与本地虚构账号；具体型号映射、自动回写、故障替代、更正权限及跨设备同步待核。所有设备均在体成分内测量体重，无手填体重路径；实测事件协议另核。',close:'确认传感器事件、账号服务与正式更正规则；实机验证。',refs:['models','flow']},
    {id:'Q-BP',title:'袖带事件与停止',area:'采集',detail:'实时压力可展示；充放气、双值完成、安全停止/移除及P并测条件仍需接口证据。',close:'取得目标袖带协议、实际日志及规程。',refs:['product','flow']},
    {id:'Q-OX',title:'血氧有效信号与适用配置',area:'采集',detail:'SpO₂、脉搏、轨迹、估计心率区间的来源不同；P5与M9配置有冲突。',close:'确认采样有效判据、输出字段和型号启用。',refs:['models','product']},
    {id:'Q-FIELDS',title:'成分字段与解释依据',area:'结果',detail:'肌肉比例与质量、BMR、内脏脂肪等级、水分和相位角按算法版本核对。健康评分、体龄与建议不得自行计算。',close:'字段键、单位、解释和依赖表签认。',refs:['product','models']},
    {id:'Q-POSTURE',title:'体态字段、质量与重拍影响',area:'影像',detail:'录屏13项、旧汇总15项、当前16项、枕肩距/枕间距等仍有差异。单视角重拍和脸部隐私语义已确认，跨视角重算待核。',close:'字段、标定、骨点、风险、质量事件及重拍影响范围明确。',refs:['mposture','product']},
    {id:'Q-ROTATION',title:'转台真实过程与三维输出',area:'采集',detail:'旋转开始、停止、屏幕不可见时提示和可离位条件待核；不得假设旋转期间仍握柄。',close:'按新P2及具体配置做真实站位/协议核查。',refs:['flow','models']},
    {id:'Q-ANGLES',title:'肩关节动作与侧别',area:'采集',detail:'前屈/前展命名、90°指令与最大角度示例需按规程区分。',close:'四项动作、目标/结果和局部重测规则明确。',refs:['mshoulder']},
    {id:'Q-ATTEMPTS',title:'尝试次数与采用值',area:'采集',detail:'肺活量FAQ曾写最后一次；握力次数、峰值与缺一侧提交未闭合。原型逐次保留并展示采用记录，不默认最大值。',close:'明确各外设有效尝试、提交与采用值规则。',refs:['mlung','mgrip','old']},
    {id:'Q-VISION',title:'视标、题库与计量',area:'视觉检测',detail:'距离/物理尺寸、E/C/Snellen、地区单位、色觉题库与散光字段需正式依据。原型只演示角色、眼别和答题。',close:'取得目标配置协议和专业规则。',refs:['mvision','models']},
    {id:'Q-MOTOR',title:'运动项目规程与有效判定',area:'运动',detail:'平衡闭眼提示、敏捷刺激、俯卧撑计次、爆发力前置和跳绳外设需各自规程。',close:'完整规则、失效事件、停止与结果字段签认。',refs:['old','models']},
    {id:'Q-REPORT',title:'报告、离线与领取',area:'交接',detail:'模板适用范围、生成/保存/领取、离线模板、二维码用途/有效期/显示时长需按配置定。',close:'记录与报告版本合同、失败恢复和各通道实际验证。',refs:['mreport','reportCenter','product']},
    {id:'Q-ADMIN',title:'管理权限、同步与维护',area:'管理',detail:'高级设置内部未见；账号编辑、同步冲突、锁屏恢复、更新回退和重置清除范围待核。',close:'权限和状态合同；未知内部不伪造为完整设置。',refs:['msettings','product']},
    {id:'Q-HISTORY',title:'历史可比与数据留存',area:'结果',detail:'同人、同项、单位、方法版本、时间与部分记录的可比条件尚未完整确认。',close:'可比规则、查询权限及记录期限明确。',refs:['mhistory','mquery']},
    {id:'Q-CLINICAL',title:'临床登记的适用范围',area:'身份',detail:'姓名/床位/住院号是旧式相邻任务，不默认成为全部P的必填资料。',close:'确认场所启用条件、字段校验与身份关联。',refs:['product']}
  ];
  root.ANOVATOR_CATALOG = {version:'G01-v06',date:'2026-11-19',features:Object.freeze({history:false}),
    sources,tests,visibleTests,isTestVisible,isRouteVisible,profiles,roles,issues,bodyMetrics};
  if(typeof module !== 'undefined') module.exports = root.ANOVATOR_CATALOG;
})(globalThis);
