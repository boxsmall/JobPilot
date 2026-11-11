import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
const root=process.cwd(), extension=path.join(root,'extension');
const work=process.env.AUTOCAST_TEST_WORK || path.join(root,'work');
await fs.mkdir(work,{recursive:true});
const profile=await fs.mkdtemp(path.join(work,'career-browser-'));
const context=await chromium.launchPersistentContext(profile,{
  channel:'chromium', headless:true, args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:440,height:1000},
});
let passed=0;
const errors=[];
try{
  let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host;
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER ERROR',msg.text());});
  await worker.evaluate(async()=>{
    await chrome.storage.local.set({bht_usage_notice:{dismissed:true},bht_onboarding:{done:true}});
    // Only the AI transport is mocked. Real extension messaging, storage and parsers run.
    globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({intro:'测试候选人，商业化产品方向',skills:'广告产品与需求分析',experience:'五年广告产品经验',education:'',location:''})}}]})});
  });
  await page.goto(`chrome-extension://${id}/sidepanel/index.html#career`);
  await page.locator('#career_endpoint').waitFor();
  await page.waitForFunction(()=>document.querySelector('#careerKeyStatus').textContent.includes('未设置'));
  // Dismiss upstream first-run dialogs without affecting live browser settings.
  await page.evaluate(()=>{for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();document.querySelector('[data-tab="career"]').click();});
  await page.locator('#careerKey').fill('mock-key-for-browser-test');
  await page.locator('#careerFile').setInputFiles(path.join(root,'tests/fixtures/fixture.docx'));
  await page.waitForFunction(()=>document.querySelector('#career_resumeText').value.includes('需求分析'));
  assert.match(await page.locator('#career_resumeText').inputValue(),/技能/);passed++;console.log('PASS DOCX text and table parsing in extension');
  await page.locator('#careerFile').setInputFiles(path.join(root,'tests/fixtures/fixture.pdf'));
  await page.waitForFunction(()=>document.querySelector('#career_resumeText').value.includes('TEST CANDIDATE'),{},{timeout:12000}).catch(async e=>{console.log('PDF STATUS',await page.locator('#careerStatus').innerText());console.log('PAGE ERRORS',errors);throw e;});
  passed++;console.log('PASS PDF worker and text extraction under MV3 CSP');
  await page.locator('#career_resumeText').fill('测试候选人，商业化产品经理，五年广告产品与产品运营经验。负责广告策略、需求分析和商业化落地。');
  await page.locator('#career_resumeConfirmed').check();
  await page.locator('#careerSave').click();
  await page.waitForFunction(()=>document.querySelector('#careerKeyStatus').textContent.includes('已设置'));
  const stored=await worker.evaluate(async()=>({local:await chrome.storage.local.get('bht_career_v1'),session:await chrome.storage.session.get('bht_career_api_key')}));
  assert.equal(stored.session.bht_career_api_key,'mock-key-for-browser-test');assert.ok(!JSON.stringify(stored.local).includes('mock-key'));passed++;console.log('PASS real settings message and session-only secret');
  await page.locator('#careerExtract').click();
  await page.waitForFunction(()=>document.querySelector('#career_fact_skills').value.includes('广告'));
  assert.equal(await page.locator('#careerFactsConfirmed').isChecked(),false);passed++;console.log('PASS extracted facts remain unconfirmed drafts');
  await page.locator('#careerFactsConfirmed').check();
  await page.locator('#careerSave').click();
  await page.locator('#careerDaily').click();await page.waitForFunction(()=>document.querySelector('#careerReport').textContent.includes('求职日报'));
  passed++;console.log('PASS daily report preview');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  assert.equal(overflow,false);passed++;console.log('PASS 440px panel has no horizontal overflow');
  await page.locator('#careerReportBox').evaluate(el=>el.open=false);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(root,'AI求职面板.png'),fullPage:true});

  // Exercise the actual DOM adapter against a controlled conversation fixture.
  const dom=await context.newPage();await dom.goto(`chrome-extension://${id}/sidepanel/image-preview.html`);
  const result=await dom.evaluate(async()=>{
    const{createCareerChat}=await import('../shared/career-chat.js');
    const setup=()=>{document.body.innerHTML='<div class="user-list"><div class="friend-content active" data-id="hr1"><span class="badge">1</span></div></div><div class="chat-conversation"><div class="chat-message-list"><div class="message-item item-friend" data-msg-id="m1"><span class="text-content">请问您的学历是什么？</span></div></div><textarea id="chat-input"></textarea></div>';};
    setup();let current='id:hr1',sent=0,guarded=false;
    const adapter=createCareerChat({document,snapshot:()=>({isChatPage:true,items:[{key:'id:hr1',name:'HR'}]}),rows:()=>({nodes:[document.querySelector('.friend-content')]}),keyOf:()=> 'id:hr1',active:()=>({key:current}),sleep:async()=>{},click:el=>el.click(),input:()=>document.querySelector('#chat-input'),sendText:async(t,c)=>{guarded=c.careerGuard();sent++;return{ok:true};}});
    const listed=adapter.list().items.length;
    const read=await adapter.read({conversationKey:'id:hr1'});
    const base={conversationKey:'id:hr1',messageId:'m1',expectedText:'请问您的学历是什么？',action:'text',text:'本科'};
    document.querySelector('#chat-input').value='用户草稿';const draft=await adapter.send(base);
    document.querySelector('#chat-input').value='';
    document.querySelector('.text-content').textContent='消息已变化';const changed=await adapter.send(base);
    document.querySelector('.text-content').textContent=base.expectedText;
    const ok=await adapter.send(base);
    const noResume=await adapter.send({...base,action:'resume',resumeName:'指定简历.pdf'});
    return{listed,read,draft,changed,ok,noResume,sent,guarded};
  });
  assert.equal(result.listed,1);assert.equal(result.read.messageId,'m1');assert.equal(result.draft.ok,false);assert.equal(result.changed.ok,false);assert.equal(result.ok.ok,true);assert.equal(result.noResume.ok,false);assert.equal(result.sent,1);assert.equal(result.guarded,true);passed++;console.log('PASS DOM identity, unread selection, user draft and attachment guards');
  const attachment = await dom.evaluate(async()=>{
    const {createCareerChat}=await import('../shared/career-chat.js');
    document.body.innerHTML='<div class="friend-content active" data-id="hr1"></div><div class="chat-conversation"><div class="chat-message-list"><div class="message-item item-friend" data-msg-id="r1"><span class="text-content">想要一份您的附件简历 sample.pdf</span><button>同意</button></div></div><textarea id="chat-input"></textarea></div>';
    let clicked=0;
    const card=document.querySelector('.message-item');
    card.querySelector('button').onclick=()=>{clicked++;card.querySelector('button').textContent='已同意';};
    const adapter=createCareerChat({document,snapshot:()=>({}),rows:()=>({nodes:[document.querySelector('.friend-content')]}),keyOf:()=> 'id:hr1',active:()=>({key:'id:hr1'}),sleep:async()=>{},click:el=>el.click(),input:()=>document.querySelector('#chat-input'),sendText:async()=>{throw Error('unexpected text');}});
    const receipt=await adapter.send({conversationKey:'id:hr1',messageId:'r1',expectedText:'想要一份您的附件简历 sample.pdf',action:'resume',resumeName:'sample.pdf'});
    return{clicked,receipt};
  });
  assert.equal(attachment.clicked,1);assert.equal(attachment.receipt.ok,true);assert.equal(attachment.receipt.receipt.type,'ATTACHMENT_SENT');passed++;console.log('PASS named attachment request and rendered approval receipt');
  assert.deepEqual(errors,[]);
  console.log(`All ${passed} browser checks passed.`);
}finally{await context.close();await fs.rm(profile,{recursive:true,force:true});}
