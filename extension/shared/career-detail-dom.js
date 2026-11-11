import { isBossHostname } from './boss-url.js';

const normalize = value => String(value || '').normalize('NFKC').replace(/\s+/g, '').trim();
// Verified list-only travel/benefit badges; never strip job-specialism suffixes.
export const careerTitlesMatch = (scanned, actual) => normalize(scanned) === normalize(actual)
  || normalize(scanned).replace(/[-—](?:出差|双休|五险一金|包吃住)$/, '') === normalize(actual);
export function careerDetailURL(job) {
  const url = new URL(job.href);
  const id = url.pathname.match(/^\/job_detail\/([^/]+)\.html$/)?.[1];
  // The scanner historically omits a terminal ~ from website-provided IDs.
  // Accept that exact legacy representation while retaining the original URL.
  const matchesId = id === String(job.jobId) || (id?.endsWith('~') && id.slice(0, -1) === String(job.jobId));
  if (url.protocol !== 'https:' || !isBossHostname(url.hostname) || url.username || url.password || !id || !matchesId) {
    throw new Error('职位链接与岗位 ID 不一致，请重新扫描岗位');
  }
  // Navigate the website-provided link, preserving its own navigation context.
  // Do not manufacture or refresh any session/security parameters.
  url.hash = '';
  return url.href;
}

export function readCareerDetailDocument(job, document, href) {
  const body = document.body?.innerText || '';
  const visible = el => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const challenge = [...document.querySelectorAll('iframe[src*="captcha"], .geetest_panel, .verify-dialog, .captcha-dialog')].some(visible);
  if (challenge || /\/web\/passport\//.test(new URL(href).pathname) || /您的环境存在异常|请完成安全验证|访问行为异常|请进行安全验证|请先完成验证/.test(body)) {
    return { ok: false, halt: true, needsUser: true, error: 'BOSS 页面要求安全验证，请在保留的职位页手动完成后继续' };
  }
  if (/\/web\/user\//.test(new URL(href).pathname) || [...document.querySelectorAll('.login-dialog, .login-register-dialog')].some(visible)) {
    return { ok: false, halt: true, needsUser: true, error: 'BOSS 页面要求登录，请在保留的职位页登录后继续' };
  }
  if (/职位已关闭|该职位已下线|职位已停止招聘/.test(body)) return { ok: false, jobFailure: true, error: '职位已关闭或下线' };
  let expected;
  try { expected = careerDetailURL(job); } catch (e) { return { ok: false, jobFailure: true, error: e.message }; }
  const actual = new URL(href);
  const expectedURL = new URL(expected);
  if (actual.origin !== expectedURL.origin || actual.pathname !== expectedURL.pathname) return { ok: false, error: '详情页地址与岗位 ID 不一致', expectedPath: expectedURL.pathname, actualPath: actual.pathname };
  const titles = [...document.querySelectorAll('.job-banner h1, .job-name, h1')].filter(visible);
  if (!titles.some(el => careerTitlesMatch(job.title, el.innerText))) return { ok: false, pending: true, jobFailure: true, error: '职位标题尚未加载或与扫描岗位不一致' };
  const descriptions = [...document.querySelectorAll('.job-sec-text, .job-detail-description, .job-description')].filter(visible);
  // A long company introduction must never win over the actual job duties.
  const labelled = descriptions.filter(el => {
    const section = el.parentElement;
    return [...(section?.querySelectorAll('h2, h3, h4') || [])].some(h => /^(职位描述|岗位描述|岗位职责|职位详情)$/.test(normalize(h.innerText)));
  });
  const choices = labelled.length ? labelled : descriptions;
  if (choices.length > 1) return { ok: false, jobFailure: true, error: '页面有多个描述区，无法确认完整职位正文' };
  const jd = choices[0]?.innerText.trim() || '';
  // A labelled, fully rendered JD can genuinely be shorter than 30 characters.
  // Its evidence sufficiency is decided by scoring, not by inventing more text.
  const placeholder = /^(?:(?:正在)?加载中[.。…]*|loading[.\s]*|暂无(?:职位)?(?:描述|信息))$/i.test(jd);
  if (document.readyState !== 'complete' || !jd || placeholder || (!labelled.length && jd.length < 30)) return { ok: false, pending: true, jobFailure: true, error: '职位正文尚未完整显示' };
  return { ok: true, detailVerified: true, jobId: String(job.jobId), jd, source: 'normal-detail-page' };
}
