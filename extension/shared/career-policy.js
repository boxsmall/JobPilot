// Independent implementation. The model supplies evidence, never permission to send.
export const CAREER_KEY = 'bht_career_v1';
export const CAREER_SECRET = 'bht_career_api_key';
export const CAREER_DEFAULTS = {
  endpoint: 'https://api.deepseek.com', model: 'deepseek-flash',
  enabled: false, minScore: 70, resumeText: '', resumeConfirmed: false,
  preferences: '', facts: { intro: '', skills: '', experience: '', education: '', location: '' },
  monitorEnabled: false, autoReply: true, autoResume: true, dailyReplyLimit: 20,
  resumeName: '', reports: {}, scores: {}, interactions: [], dailyReports: {},
};

export function normalizeCareer(value = {}) {
  return { ...CAREER_DEFAULTS, ...value,
    facts: { ...CAREER_DEFAULTS.facts, ...value.facts },
    minScore: Math.max(0, Math.min(100, Number(value.minScore ?? CAREER_DEFAULTS.minScore) || 0)),
    dailyReplyLimit: Math.max(1, Math.min(100, Number(value.dailyReplyLimit) || 20)),
  };
}

export function endpointURL(base) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('AI 服务地址必须是 HTTPS，且不能带账号、查询参数或片段');
  }
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '') + '/chat/completions';
  return url.href;
}

export function parseModelJSON(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const value = JSON.parse(cleaned);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI 返回格式无效');
  return value;
}

export function normalizeScore(value) {
  const dimensions = {};
  const weights = { skill: 0.4, experience: 0.3, salary: 0.2, growth: 0.1 };
  let total = 0, weight = 0;
  for (const [key, w] of Object.entries(weights)) {
    const entry = value.dimensions?.[key];
    if (!entry || (entry.score !== null && (typeof entry.score !== 'number' || !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 100))) {
      throw new Error('AI 评分缺失或越界：' + key);
    }
    if (!String(entry.reason || '').trim()) throw new Error('AI 评分缺少依据：' + key);
    dimensions[key] = { score: entry.score, reason: String(entry.reason).slice(0, 1200) };
    if (entry.score !== null) { total += entry.score * w; weight += w; }
  }
  if (dimensions.skill.score === null || dimensions.experience.score === null) throw new Error('技能或经历证据不足，无法评分');
  const score = Math.round(total / weight);
  if (!Array.isArray(value.gaps) || typeof value.reason !== 'string' || !value.reason.trim()) throw new Error('AI 评分缺少理由或差距');
  return { score, dimensions, reason: value.reason.slice(0, 2000), gaps: value.gaps.map(String).slice(0, 8),
    recommendation: score >= 85 ? '强烈推荐' : score >= 70 ? '建议投递' : score >= 55 ? '可以考虑' : '不推荐',
    scoredAt: Date.now() };
}

export async function scoreFingerprint(job, config) {
  const text = JSON.stringify(['career-score-v1', config.endpoint, config.model, config.resumeText, config.preferences,
    job.jobId, job.title, job.company, job.salary, job.location, job.jd]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
}

export function classifyReply(text, facts = {}) {
  const s = String(text || '').trim();
  if (/不合适|不匹配|暂不考虑|停止|别发|不要.*联系|无需回复|不用.*简历|不要.*简历|不需要.*简历|无需.*简历/.test(s)) return { kind: 'ignore', reason: '对方拒绝或无需回复' };
  // Commitment questions take precedence, even when the same message also asks for a resume.
  const boundaryText = /^.{0,12}想要一份您的附件简历[，,。\s]*(是否同意[？?]?)?$/.test(s) ? '索要简历' : s;
  if (/薪资|薪酬|工资|待遇|到岗|入职|离职|offer|面试|接受|同意|加班|出差|搬家|异地|微信|电话|手机|邮箱|身份证|银行|转账|链接|https?:|忽略.*指令|ignore.*instruction/i.test(boundaryText)) {
    return { kind: 'review', reason: '涉及承诺、联系方式或其他需本人确认的信息' };
  }
  if (/薪资|薪酬|到岗|入职|面试/.test(s)) return { kind: 'review', reason: '包含需确认的承诺' };
  if (/(发|给|提供|要|看).{0,12}(简历|履历)|(简历|履历).{0,12}(发|给|提供)|附件简历/.test(s)) return { kind: 'resume', reason: 'HR 索要简历' };
  if (/不合适|不匹配|暂不考虑|停止|别发|不要.*联系|无需回复/.test(s)) return { kind: 'ignore', reason: '对方拒绝或无需回复' };
  // Only narrowly scoped questions get a verbatim, previously confirmed answer.
  const questions = [
    ['education', /^(请问|您好[，, ]*|你好[，, ]*)?(您的?|你)?(学历|毕业院校|毕业学校)(是什么|是哪里|是哪所|情况)?[？?。!！\s]*$/],
    ['location', /^(请问|您好[，, ]*|你好[，, ]*)?(您的?|你)?(目前|现在)?(在哪个城市|在哪座城市|所在地|所在城市)[？?。!！\s]*$/],
    ['intro', /^(请|可以|能否|方便)?(简单)?(自我介绍|介绍一下自己|介绍一下您的背景)(一下|吗)?[？?。!！\s]*$/],
    ['skills', /^(请问)?(您的?|你)?(主要|擅长的)?(技能|技术栈)(是什么|有哪些)?[？?。!！\s]*$/],
    ['experience', /^(请|可以|能否)?(简单)?(介绍一下)?(您的?|你)?(工作经历|项目经历|过往经验)(介绍一下|是什么|有哪些|吗)?[？?。!！\s]*$/],
  ];
  for (const [key, re] of questions) {
    if (re.test(s) && facts[key]?.trim()) return { kind: 'fact', fact: key, text: facts[key].trim(), reason: '使用已确认信息' };
  }
  return { kind: 'review', reason: '问题不在已确认的自动回复范围内' };
}

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyReport(day, history = [], interactions = [], scores = [], stats = null) {
  const rows = history.filter(x => dayKey(x.ts) === day);
  const chats = interactions.filter(x => dayKey(x.at) === day);
  const rated = scores.filter(x => dayKey(x.scoredAt) === day);
  const clean = x => String(x || '').replace(/[\r\n|]/g, ' ');
  return [`# 求职日报 · ${day}`, '', `- 投递成功：${stats?.success ?? rows.filter(x => x.status === 'success').length}`,
    `- 跳过：${stats?.skip ?? rows.filter(x => /skip/.test(x.status)).length}`,
    `- 失败：${stats?.fail ?? rows.filter(x => /fail/.test(x.status)).length}`,
    `- AI 已评分：${rated.length}`,
    `- 自动回复 / 简历发送成功：${chats.filter(x => x.status === 'sent').length}`,
    `- 待确认 / 待核对：${chats.filter(x => ['review', 'uncertain', 'sending'].includes(x.status)).length}`,
    '', '## 投递记录', '', '| 公司 | 职位 | 结果 |', '| --- | --- | --- |',
    ...rows.map(x => `| ${clean(x.company)} | ${clean(x.title)} | ${clean(x.status)} |`),
    '', '## HR 消息处理', '',
    ...chats.map(x => `- ${clean(x.name || x.conversationKey)}：${clean(x.status)} · ${clean(x.reason)}`),
    '', '说明：成功仅表示页面出现发送回执；不代表 HR 已读或已获得面试。未确认的操作单独保留，不自动重试。', ''].join('\n');
}

export function recommendationReport(scores = []) {
  const clean = x => String(x || '').replace(/[\r\n]/g, ' ');
  return ['# 岗位推荐报告', '', ...scores.slice().sort((a,b) => b.score-a.score).flatMap(x => [
    `## ${clean(x.job?.title)} · ${clean(x.job?.company)}`, '',
    `**${x.score} 分 · ${x.recommendation}**`, '', clean(x.reason), '',
    ...Object.entries(x.dimensions).map(([k,v]) => `- ${{skill:'技能',experience:'经历',salary:'薪资',growth:'发展'}[k]}：${v.score ?? '未知'}；${clean(v.reason)}`),
    `- 待补充 / 差距：${x.gaps.map(clean).join('；') || '未列出'}`, '',
  ])].join('\n');
}
