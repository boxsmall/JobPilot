import { careerDetailURL } from '../shared/career-detail-dom.js';

// Read the ordinary website document. No private API calls, cookie extraction,
// signature generation or security-challenge retries belong in this reader.
export function createCareerDetailReader({ chrome, version, inject, waitReady, sleep }) {
  let owned = null, generation = 0, lastStarted = 0;
  const cache = new Map();
  const identity = href => { try { const u = new URL(href); return u.origin + u.pathname; } catch { return ''; } };
  const cancel = () => { generation++; };
  async function close() {
    const target = owned; owned = null;
    if (!target) return;
    const tab = await chrome.tabs.get(target.id).catch(() => null);
    if (tab && identity(tab.url) === target.url) await chrome.tabs.remove(target.id).catch(() => {});
  }
  async function read(job) {
    const token = generation;
    const cancelled = () => generation !== token;
    let url;
    try { url = careerDetailURL(job); } catch (e) { return { ok: false, jobFailure: true, error: e.message }; }
    const cacheKey = identity(url) + '\n' + job.title;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) return { ...cached.result, cached: true };
    await sleep(Math.max(0, 2000 - (Date.now() - lastStarted)));
    if (cancelled()) return { ok: false, halt: true, error: '详情读取已取消' };
    lastStarted = Date.now();
    let tab = owned ? await chrome.tabs.get(owned.id).catch(() => null) : null;
    if (tab && identity(tab.url) !== owned.url) {
      owned = null;
      return { ok: false, halt: true, needsUser: true, error: '详情检查页已跳转，请先核对该页面；未覆盖或关闭它' };
    }
    const previousURL = tab?.url || 'about:blank';
    tab = tab ? await chrome.tabs.update(tab.id, { url, active: false }) : await chrome.tabs.create({ url, active: false });
    owned = { id: tab.id, url: identity(url) };
    const started = Date.now(), deadline = started + 45000;
    let result, previousText = '', stable = 0, injectedURL = '', bridgeFailures = 0, securityLoading = false;
    const preserve = error => { owned = null; return { ok: false, halt: true, needsUser: true, error }; };
    while (Date.now() < deadline && !cancelled()) {
      const current = await chrome.tabs.get(tab.id).catch(() => null);
      if (!current) return { ok: false, error: '职位检查页已关闭，请重试该岗位' };
      const currentURL = current.url || '';
      // tabs.update can resolve before the old document starts navigating.
      if (current.pendingUrl || ((currentURL === previousURL || currentURL.startsWith('about:blank')) && identity(currentURL) !== identity(url) && Date.now() - started < 5000)) {
        await sleep(500); continue;
      }
      let pathname = '';
      try { pathname = new URL(currentURL).pathname; } catch {}
      securityLoading = /\/web\/passport\/.*security\.html$/.test(pathname);
      if (securityLoading) {
        // This is the website's normal loading interstitial. Let the website
        // finish its own navigation; never inject scripts or solve a challenge here.
        injectedURL = ''; previousText = ''; stable = 0;
        await sleep(500); continue;
      }
      if (/\/web\/passport\//.test(pathname)) return preserve('BOSS 页面要求安全验证，请在保留的职位页手动完成后继续');
      if (/\/web\/user\//.test(pathname)) return preserve('BOSS 页面要求登录，请在保留的职位页登录后继续');
      if (current.status !== 'complete') { await sleep(500); continue; }
      if (identity(currentURL) !== identity(url)) return preserve('职位页跳转到其他地址，请核对保留的页面后继续');
      if (injectedURL !== currentURL) {
        const ready = await waitReady(tab.id, Math.min(5000, Math.max(0, deadline - Date.now())), { requireComplete: true, shouldStop: cancelled });
        if (!ready) { await sleep(500); continue; }
        // Recheck after navigation settles before touching the document.
        if (identity(ready.url) !== identity(url)) continue;
        if (!await inject(tab.id)) return { ok: false, error: '职位页读取脚本未就绪' };
        injectedURL = ready.url;
      }
      try { result = await chrome.tabs.sendMessage(tab.id, { type: 'BHT_CAREER_RENDERED_DETAIL', payload: { job } }); }
      catch {
        injectedURL = ''; previousText = ''; stable = 0;
        if (++bridgeFailures >= 3) return { ok: false, error: '职位页面切换后读取连接未恢复，请重试该岗位' };
        await sleep(500); continue;
      }
      if (result?.contentVersion !== version) return { ok: false, halt: true, error: '职位页代码版本不一致，请重新加载扩展' };
      if (result.needsUser || result.halt) { owned = null; return result; }
      if (result.ok) {
        stable = result.jd === previousText ? stable + 1 : 0;
        previousText = result.jd;
        if (stable >= 2) {
          cache.set(cacheKey, { at: Date.now(), result });
          if (cache.size > 1000) cache.delete(cache.keys().next().value);
          return result;
        }
      } else if (!result.pending) return result;
      await sleep(500);
    }
    if (securityLoading && !cancelled()) return preserve('BOSS 安全检查页持续未返回职位，请在保留的页面手动确认后继续');
    return cancelled() ? { ok: false, halt: true, error: '详情读取已取消' } : { ok: false, jobFailure: result?.jobFailure === true, error: result?.error || '职位正文未稳定加载' };
  }
  return { read, close, cancel };
}
