// DOM adapter kept separate so identity changes and receipts can be regression-tested.
export function createCareerChat(api) {
  let generation = 0;
  const { document: doc, snapshot, rows, keyOf, active, sleep, sendText, input, click } = api;
  const text = el => String(el?.innerText || el?.textContent || '').trim();
  const visible = el => Boolean(el && el.getClientRects().length && el.getAttribute('aria-hidden') !== 'true');
  const own = el => el.matches('.item-myself, .myself, .mine, .message-mine') || Boolean(el.closest('.item-myself, .message-mine'));
  const messages = () => [...doc.querySelectorAll('.chat-dialog-message-list .message-item, .chat-message-list .message-item, .chat-conversation .message-item')];
  const messageId = el => String(el?.getAttribute('data-msg-id') || el?.getAttribute('data-message-id') || el?.getAttribute('data-mid') || el?.getAttribute('data-id') || el?.id || '');
  const messageText = el => text(el?.querySelector('.text-content, .message-content, .text') || el);
  const latest = () => messages().filter(el => !el.matches('.system, .system-message, .item-system')).at(-1);
  const fail = message => ({ ok: false, message });
  function matches(p) {
    const last = latest();
    return active().key === p.conversationKey && last && !own(last) && messageId(last) === p.messageId && messageText(last) === p.expectedText;
  }
  async function open(conversationKey) {
    if (!/^id:/.test(conversationKey)) return false;
    const row = rows().nodes.find(el => keyOf(el) === conversationKey);
    if (!row) return false;
    if (active().key !== conversationKey) {
      const editor = input();
      if (text(editor) || editor?.value) return false; // Never discard a user's unfinished reply.
      const previousMessage = messageId(latest());
      click(row);
      let loaded = false;
      for (let i = 0; i < 20; i++) {
        await sleep(150);
        const nextMessage = messageId(latest());
        if (active().key === conversationKey && nextMessage && nextMessage !== previousMessage) { loaded = true; break; }
      }
      if (!loaded) return false;
      await sleep(200);
    }
    return active().key === conversationKey;
  }
  async function read(p) {
    if (!await open(p.conversationKey)) return fail('无法确认会话身份，或当前输入框有未发送草稿');
    const last = latest();
    if (!last || own(last)) return { ok: true, incoming: false };
    const id = messageId(last);
    if (!id) return fail('消息没有稳定 ID，请手动处理');
    return { ok: true, incoming: true, messageId: id, text: messageText(last) };
  }
  function list() {
    const data = snapshot(), nodes = rows().nodes;
    if (!data.isChatPage) return fail('请打开 BOSS 消息页');
    const items = data.items.filter(item => {
      if (!/^id:/.test(item.key)) return false;
      const row = nodes.find(el => keyOf(el) === item.key);
      if (!row) return false;
      const container = row.closest('.friend-content-warp') || row;
      const badges = [...container.querySelectorAll('.badge, .red-dot, .unread, .unread-count, .notice-badge')];
      return (visible(row) && row.matches('.unread')) || badges.some(el => visible(el) && (text(el) === '' || /[1-9]/.test(text(el))));
    });
    return { ok: true, items, total: data.items.length };
  }
  async function send(p) {
    const ticket = generation;
    const isCurrent = () => ticket === generation && matches(p);
    if (!await open(p.conversationKey)) return fail('会话无法打开或存在未发送草稿');
    if (!isCurrent()) return fail('会话或最新消息已变化，请重新核对');
    const editor = input();
    if (text(editor) || editor?.value) return fail('输入框已有草稿，本次未发送');
    if (p.action === 'text') return sendText(p.text, { careerGuard: isCurrent });
    if (p.action !== 'resume' || !p.resumeName?.trim()) return fail('请配置要发送的附件简历名称');
    const beforeOwn = messages().filter(own).map(messageText);
    const card = latest();
    // Approve a native request only if the requested attachment is explicitly identified.
    let agreed = false;
    const nativeAgree = [...card.querySelectorAll('button,a,span')].find(el => visible(el) && text(el) === '同意');
    const escapedName = p.resumeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const identifiedName = [...card.querySelectorAll('.resume-name, .file-name, [download]')].some(el => text(el) === p.resumeName) ||
      new RegExp('(^|[\\s（(：:，,])' + escapedName + '(?=$|[\\s）)。，,])', 'u').test(messageText(card));
    if (nativeAgree && identifiedName) {
      if (!isCurrent()) return fail('发送前会话已变化');
      click(nativeAgree); agreed = true;
    } else {
      const toolbar = doc.querySelector('.chat-conversation .chat-op, .chat-conversation .chat-toolbar, .chat-conversation .chat-editor, .chat-conversation');
      const trigger = [...(toolbar?.querySelectorAll('button,a,span') || [])].find(el => visible(el) && text(el) === '发简历');
      if (!trigger) return fail('未找到发简历入口，可能尚未获得平台发送权限');
      if (!isCurrent()) return fail('发送前会话已变化');
      click(trigger);
      let dialog;
      for (let i = 0; i < 15; i++) {
        await sleep(200);
        if (!isCurrent()) return fail('选择简历时会话已变化，未继续操作');
        dialog = [...doc.querySelectorAll('[role="dialog"], .dialog-wrap, .boss-dialog, .resume-dialog')].find(el => visible(el) && text(el).includes(p.resumeName));
        if (dialog) break;
      }
      if (!dialog) return fail('未找到指定名称的简历，请手动选择');
      const label = [...dialog.querySelectorAll('label, .resume-name, .file-name, .name')].find(el => text(el) === p.resumeName);
      if (!label) return fail('无法准确匹配附件简历名称');
      click(label);
      await sleep(200);
      const confirm = [...dialog.querySelectorAll('button,a')].find(el => visible(el) && /^(发送|确定发送|确认发送)$/.test(text(el)) && !el.disabled && !el.classList.contains('disabled'));
      if (!confirm || !isCurrent()) return fail('无法确认发送按钮或会话已变化');
      click(confirm);
    }
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      if (active().key !== p.conversationKey) return fail('等待回执时会话已变化，请手动核对');
      const afterOwn = messages().filter(own).map(messageText);
      const newAttachment = afterOwn.length > beforeOwn.length && afterOwn.slice(beforeOwn.length).some(t => t.includes(p.resumeName));
      if (newAttachment || (agreed && /已同意|已发送/.test(text(card)))) return { ok: true, receipt: { type: 'ATTACHMENT_SENT', conversationKey: p.conversationKey, resumeName: p.resumeName, at: Date.now() } };
    }
    return fail('已执行简历发送操作，但未出现明确回执；请手动核对，系统不会自动重发');
  }
  return { list, read, send, cancel: () => { generation++; } };
}
