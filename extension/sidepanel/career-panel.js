import { endpointURL, dayKey } from '../shared/career-policy.js';
const $ = id => document.getElementById(id);
const CAREER_UI_VERSION = '1.7.51';
let loaded = false, dirty = false, lastState, lastReport = '', reportName = '', pollBusy = false;
const fields = ['endpoint', 'model', 'enabled', 'minScore', 'resumeText', 'resumeConfirmed', 'preferences', 'monitorEnabled', 'autoReply', 'autoResume', 'dailyReplyLimit', 'resumeName'];
const facts = ['intro', 'skills', 'experience', 'education', 'location'];
const labels = { intro: '个人介绍', skills: '主要技能', experience: '工作 / 项目经历', education: '学历', location: '现居城市' };
const status = message => { $('careerStatus').textContent = message; };
async function call(action, payload = {}) {
  const result = await chrome.runtime.sendMessage({ type: 'BHT_AI_' + action, payload, clientVersion: CAREER_UI_VERSION });
  if (!result?.ok) throw new Error(result?.message || result?.error || '操作失败');
  return result;
}
function configFromForm() {
  const config = {};
  for (const name of fields) { const el = $('career_' + name); config[name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim(); }
  config.facts = Object.fromEntries(facts.map(k => [k, $('career_fact_' + k).value.trim()]));
  if (Object.values(config.facts).some(Boolean) && !$('careerFactsConfirmed').checked) throw new Error('请核对个人信息并勾选确认，才可保存为自动回复内容');
  if (config.enabled && !config.resumeConfirmed) throw new Error('请先核对简历正文并勾选确认');
  return config;
}
async function save() {
  const config = configFromForm();
  const origin = new URL(endpointURL(config.endpoint)).origin + '/*';
  if (!await chrome.permissions.request({ origins: [origin] })) throw new Error('未允许访问所选 AI 服务');
  await call('SAVE', { config, apiKey: $('careerKey').value });
  $('careerKey').value = ''; dirty = false;
  status('设置已保存'); await refresh();
}
function populate(state) {
  for (const name of fields) { const el = $('career_' + name); if (el.type === 'checkbox') el.checked = !!state[name]; else el.value = state[name] ?? ''; }
  for (const k of facts) $('career_fact_' + k).value = state.facts?.[k] || '';
  $('careerFactsConfirmed').checked = Object.values(state.facts || {}).some(Boolean);
}
function element(tag, content, className = '') { const e = document.createElement(tag); e.textContent = content; e.className = className; return e; }
function renderInteractions(items) {
  const box = $('careerInbox');
  // Keep edits and focus stable during polling.
  if (box.contains(document.activeElement)) return;
  const signature = JSON.stringify(items);
  if (box.dataset.signature === signature) return;
  box.dataset.signature = signature; box.replaceChildren();
  const pending = items.filter(x => ['review', 'uncertain', 'sending'].includes(x.status)).reverse();
  $('careerPendingCount').textContent = `${pending.length} 条待处理`;
  if (!pending.length) box.append(element('p', '暂无待确认消息。自动处理结果会计入日报。', 'hint'));
  for (const entry of pending.slice(0, 50)) {
    const card = element('div', '', 'career-inbox-item');
    card.append(element('strong', entry.name), element('p', entry.text), element('p', entry.reason, 'hint'));
    if (entry.status === 'review') {
      const area = element('textarea', ''); area.value = entry.reply || ''; area.rows = 3; area.setAttribute('aria-label', '回复 ' + entry.name);
      if (entry.kind !== 'resume') card.append(area);
      const actions = element('div', '', 'btn-row');
      const draft = element('button', '生成回复草稿', 'btn');
      draft.onclick = () => run(draft, async () => { area.value = (await call('HR_DRAFT', { id: entry.id })).reply; });
      const send = element('button', entry.kind === 'resume' ? '确认发送指定简历' : '确认发送', 'btn primary');
      send.onclick = () => run(send, async () => { await call('HR_APPROVE', { id: entry.id, text: area.value }); box.dataset.signature = ''; await refresh(); status('发送已有页面回执'); });
      if (entry.kind !== 'resume') actions.append(draft); actions.append(send); card.append(actions);
    } else card.append(element('p', '回执不明，请到 BOSS 核对。为避免重复发送，此处不提供自动重试。', 'hint'));
    const dismiss = element('button', '标记已手动处理', 'btn tiny');
    dismiss.onclick = () => run(dismiss, async () => { await call('HR_DISMISS', { id: entry.id }); box.dataset.signature = ''; await refresh(); });
    card.append(dismiss); box.append(card);
  }
}
async function refresh() {
  if (pollBusy) return; pollBusy = true;
  try {
    const data = await call('STATE'); lastState = data.state;
    if (!loaded) { populate(data.state); loaded = true; }
    $('careerKeyStatus').textContent = data.hasKey ? '已设置；仅保留在本次浏览器会话' : '未设置；重启浏览器后请重新填写';
    $('careerProgress').textContent = data.progress.message || '先在任务页扫描岗位，再运行 AI 评分';
    $('careerScore').disabled = data.progress.running;
    $('careerRetryScore').disabled = data.progress.running;
    $('careerDetailCheck').disabled = data.progress.running;
    $('careerScoreStop').disabled = !data.progress.running;
    $('careerScoreProgress').max = Math.max(1, data.progress.total); $('careerScoreProgress').value = data.progress.done;
    renderInteractions(data.state.interactions || []);
  } finally { pollBusy = false; }
}
async function run(button, work) {
  button.disabled = true;
  try { await work(); } catch (error) { status(error.message); } finally { button.disabled = false; }
}
async function parseFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) throw new Error('请上传不超过 10 MB 的简历');
  const extension = file.name.split('.').at(-1).toLowerCase();
  let text = '';
  if (['txt', 'md'].includes(extension)) text = await file.text();
  else if (extension === 'docx') {
    if (!globalThis.mammoth) await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = chrome.runtime.getURL('vendor/mammoth.browser.min.js'); script.onload = resolve; script.onerror = () => reject(new Error('DOCX 解析器加载失败')); document.head.append(script);
    });
    text = (await globalThis.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (extension === 'pdf') {
    const pdfjs = await import('../vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.mjs');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    const pdf = await loadingTask.promise;
    try {
      if (pdf.numPages > 30) throw new Error('简历超过 30 页，请提供精简版本');
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        text += content.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n';
      }
    } finally { await loadingTask.destroy(); }
  } else throw new Error('支持 PDF、DOCX、TXT、Markdown；旧版 DOC 请先另存为 DOCX');
  if (text.trim().length < 30) throw new Error('未提取到足够文字；扫描版 PDF 请先转为可复制的文本');
  if (text.length > 60000) throw new Error('简历正文超过 60000 字，请精简');
  $('career_resumeText').value = text.trim(); $('career_resumeConfirmed').checked = false; dirty = true;
  status(`已在本地解析 ${file.name}（${text.trim().length} 字），请核对正文后保存`);
}
function showReport(text, name) {
  lastReport = text; reportName = name; $('careerReport').textContent = text; $('careerReportBox').open = true;
}
for (const k of facts) {
  const label = element('label', labels[k]); label.htmlFor = 'career_fact_' + k;
  const input = element('textarea', ''); input.id = label.htmlFor; input.rows = k === 'experience' ? 3 : 2;
  $('careerFacts').append(label, input);
  input.oninput = () => { $('careerFactsConfirmed').checked = false; dirty = true; };
}
$('tab-career').addEventListener('input', () => { dirty = true; });
$('career_resumeText').oninput = () => { $('career_resumeConfirmed').checked = false; };
$('careerSave').onclick = e => run(e.currentTarget, save);
$('careerTest').onclick = e => run(e.currentTarget, async () => { await save(); status((await call('TEST')).message); });
$('careerClearKey').onclick = e => run(e.currentTarget, async () => { await call('CLEAR_KEY'); await refresh(); status('密钥已清除'); });
$('careerFile').onchange = e => run($('careerExtract'), () => parseFile(e.target.files[0]));
$('careerExtract').onclick = e => run(e.currentTarget, async () => {
  await save(); const result = await call('EXTRACT');
  for (const k of facts) $('career_fact_' + k).value = result.profile[k] || '';
  $('careerFactsConfirmed').checked = false; $('careerFacts').closest('details').open = true; dirty = true; status('已提取个人信息草稿；核对并确认后保存，才会用于自动回复');
});
$('careerScore').onclick = e => run(e.currentTarget, async () => { if (dirty) throw new Error('请先保存修改'); await call('SCORE_START'); await refresh(); });
$('careerRetryScore').onclick = e => run(e.currentTarget, async () => { if (dirty) throw new Error('请先保存修改'); await call('SCORE_START', { retryOnly: true }); await refresh(); });
$('careerDetailCheck').onclick = e => run(e.currentTarget, async () => { status((await call('DETAIL_CHECK')).message); });
$('careerScoreStop').onclick = e => run(e.currentTarget, () => call('SCORE_STOP'));
$('careerRecommend').onclick = e => run(e.currentTarget, async () => showReport((await call('RECOMMEND')).report, '岗位推荐报告.md'));
$('careerDailyDate').value = dayKey();
$('careerDaily').onclick = e => run(e.currentTarget, async () => showReport((await call('DAILY', { day: $('careerDailyDate').value })).report, `求职日报-${$('careerDailyDate').value}.md`));
$('careerPoll').onclick = e => run(e.currentTarget, async () => { if (dirty) throw new Error('请先保存修改'); status((await call('HR_POLL')).message || '检查完成'); await refresh(); });
$('careerDownload').onclick = () => {
  if (!lastReport) return;
  const url = URL.createObjectURL(new Blob([lastReport], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = reportName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
};
document.querySelector('[data-tab="career"]').addEventListener('click', () => refresh().catch(e => status(e.message)));
setInterval(() => { if ($('tab-career').classList.contains('active')) refresh().catch(e => status(e.message)); }, 3000);
refresh().catch(e => status(e.message));

if (location.hash === '#career') document.querySelector('[data-tab="career"]').click();
