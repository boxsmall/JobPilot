import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const extension=path.resolve('extension');
await fs.mkdir('work',{recursive:true});
const profile=await fs.mkdtemp(path.resolve('work/detail-probe-'));
const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try {
 let privateRequests=0,detailPages=0,securityPages=0;
 const jd='Fixture full responsibilities and qualifications. Manage products, research customers, measure advertising revenue, and collaborate with engineering.';
 const serveFixture=async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/wapi/')){privateRequests++;return route.fulfill({contentType:'application/json',body:JSON.stringify({code:37,message:'environment abnormal'})});}
  let body='<h1>Fixture jobs</h1>';
  if(url.pathname==='/web/passport/zp/security.html'){
   securityPages++;
   body='<p>正在加载中...</p><script>setTimeout(()=>location.replace("/job_detail/j2.html?fixture=returned"),1500)</script>';
  }
  if(url.pathname.includes('/job_detail/')){
   detailPages++;
   const id=url.pathname.match(/\/([^/]+)\.html$/)[1];
   // A new document navigation keeps every request within the fixture router;
   // Playwright only intercepts the first URL of an HTTP redirect chain.
   if(id==='j2'&&!url.search)return route.fulfill({contentType:'text/html; charset=utf-8',body:'<script>location.replace("/web/passport/zp/security.html")</script>'});
   body=id==='challenge'?'<h1>请完成安全验证</h1>':`<div class="job-banner"><h1>Fixture PM ${id.replace(/~$/, '')}</h1></div><div class="job-sec-text">${jd}</div>`;
  }
  return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><title>Fixture</title></head><body>'+body+'</body></html>'});
 };
 await ctx.route('https://www.zhipin.com/**',serveFixture);
 const page=await ctx.newPage();await page.goto('https://www.zhipin.com/web/geek/jobs');await page.locator('#bht-fab').waitFor();
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
 // Explicit handshake: extension-created tabs must have a fixture route before
 // navigation, so no initial request can escape to the live website.
 ctx.on('page',async page=>{
  try{
   await page.waitForURL(/^about:blank#jobpilot-fixture-/,{timeout:3000});
   await page.route('https://www.zhipin.com/**',serveFixture);
   await worker.evaluate(marker=>fixtureAttached.add(marker),page.url());
  }catch{}
 });
 await worker.evaluate(()=>{
  globalThis.fixtureAttached=new Set();let next=0;
  const create=chrome.tabs.create.bind(chrome.tabs);
  chrome.tabs.create=async options=>{
   const marker='about:blank#jobpilot-fixture-'+(++next);
   const tab=await create({...options,url:marker});
   for(let i=0;i<500&&!fixtureAttached.has(marker);i++)await new Promise(r=>setTimeout(r,10));
   if(!fixtureAttached.has(marker))throw new Error('Fixture router did not attach');
   return chrome.tabs.update(tab.id,{url:options.url});
  };
 });
 const id=new URL(worker.url()).host;
 await worker.evaluate(async()=>{
  const results=['j1','j2','j3'].map(jobId=>({decision:'pass',selected:true,reasonCodes:[],reasonTexts:[],job:{jobId,title:'Fixture PM '+jobId+(jobId==='j2'?'-出差':''),href:'https://www.zhipin.com/job_detail/'+jobId+(jobId==='j3'?'~':'')+'.html'}}));
  await chrome.storage.local.set({bht_onboarding:{done:true},bht_usage_notice:{dismissed:true},bht_current_task:{id:'fixture',status:'awaiting_confirm',sourceTabId:2147483647,results,items:[]},bht_career_v1:{resumeText:'Fixture candidate with product strategy and advertising experience.'.repeat(3),resumeConfirmed:true}});
 });
 const ui=await ctx.newPage();await ui.goto(`chrome-extension://${id}/sidepanel/index.html#career`);
 const call=action=>ui.evaluate(action=>chrome.runtime.sendMessage({type:'BHT_AI_'+action,clientVersion:chrome.runtime.getManifest().version}),action);
 const stale=await ui.evaluate(()=>chrome.runtime.sendMessage({type:'BHT_AI_DETAIL_CHECK',clientVersion:'1.7.45'}));
 assert.equal(stale.ok,false);assert.match(stale.message,/版本不一致/);
 const checked=await call('DETAIL_CHECK');
 assert.equal(checked.ok,true,checked.message);assert.match(checked.message,/岗位 ID 核对通过/);assert.ok(checked.message.includes(`正文 ${jd.length} 字`));
 assert.equal(privateRequests,0);assert.equal(detailPages,1);
 assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.zhipin.com/job_detail/*'}))).length,0);
 console.log('PASS full rendered JD reaches the background without key or private API; stale source tab is irrelevant');
 await worker.evaluate(async()=>{
  await chrome.storage.session.set({bht_career_api_key:'fixture-key'});
  globalThis.fixtureModelCalls=0;
  globalThis.fetch=async()=>{fixtureModelCalls++;return{ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({dimensions:{skill:{score:80,reason:'fixture skill'},experience:{score:75,reason:'fixture experience'},salary:{score:null,reason:'unknown'},growth:{score:null,reason:'unknown'}},reason:'fixture evidence',gaps:[]})}}]})};};
 });
 assert.equal((await call('SCORE_START')).ok,true);
 let state;
 for(let i=0;i<300;i++){state=await call('STATE');if(!state.progress.running)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(state.progress.running,false);assert.match(state.progress.message,/评分成功 3，未取得评分 0，未处理 0/);
 assert.equal(await worker.evaluate(()=>fixtureModelCalls),3);assert.equal(privateRequests,0);assert.equal(detailPages,4);assert.equal(securityPages,1);
 assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.zhipin.com/job_detail/*'}))).length,0);
 console.log('PASS complete batch waits for the website-owned loading redirect, accepts a travel badge, scores all rows, and closes its owned detail tab');
 // Dismiss the isolated fixture's usage notice before exercising the real button.
 await ui.evaluate(()=>{for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();});
 await ui.locator('#tabs button[data-tab="career"]').click();
 await ui.locator('#careerRetryScore').click();
 for(let i=0;i<100;i++){
  state=await call('STATE');
  if(!state.progress.running&&state.progress.message.includes('原有 3 个有效评分'))break;
  await new Promise(r=>setTimeout(r,50));
 }
 assert.match(state.progress.message,/原有 3 个有效评分保持不变/);
 assert.equal(await worker.evaluate(()=>fixtureModelCalls),3);assert.equal(detailPages,4);
 console.log('PASS completion button retains current scores without duplicate model or detail calls');
 const parser=await ctx.newPage();await parser.goto(`chrome-extension://${id}/sidepanel/image-preview.html`);
 const safeguards=await parser.evaluate(async()=>{
  const {readCareerDetailDocument,careerDetailURL}=await import('../shared/career-detail-dom.js');
  const job={jobId:'j1',title:'Fixture PM j1',href:'https://www.zhipin.com/job_detail/j1.html?lid=fixture-navigation'};
  document.body.innerHTML='<h1>Fixture PM j1</h1><div class="job-sec-text">Complete fixture description with enough text to score.</div>';
  const normal=readCareerDetailDocument(job,document,'https://www.zhipin.com/job_detail/j1.html?lid=site-redirect');
  document.body.innerHTML='<h1>Fixture PM j1</h1><section><h3>职 位描述</h3><div class="job-sec-text">Actual job duties and qualifications, long enough for scoring.</div></section><section><h3>公司介绍</h3><div class="job-sec-text">'+ 'Company biography '.repeat(100)+'</div></section>';
  const correctSection=readCareerDetailDocument(job,document,job.href).jd.startsWith('Actual job duties');
  const preservesLink=careerDetailURL(job)===job.href;
  document.body.innerHTML='<h1>Fixture PM j1</h1><section><h3>职 位描述</h3><div class="job-sec-text">具体面试后定位\n任职资格：1-3年产品经理工作经验</div></section>';
  const shortDescription=readCareerDetailDocument(job,document,job.href);
  document.querySelector('.job-sec-text').innerText='正在加载中...';
  const placeholder=readCareerDetailDocument(job,document,job.href);
  document.querySelector('.job-sec-text').innerText='';
  const emptyDescription=readCareerDetailDocument(job,document,job.href);
  const mismatch=readCareerDetailDocument(job,document,'https://www.zhipin.com/job_detail/j2.html');
  document.body.insertAdjacentHTML('afterbegin','<div>请完成安全验证</div>');
  const challenge=readCareerDetailDocument(job,document,job.href);
  let externalRejected=false;try{careerDetailURL({...job,href:'https://example.com/job_detail/j1.html'});}catch{externalRejected=true;}
  return{normal,correctSection,preservesLink,shortDescription,placeholder,emptyDescription,mismatch,challenge,externalRejected};
 });
 assert.equal(safeguards.mismatch.ok,false);assert.equal(safeguards.challenge.needsUser,true);assert.equal(safeguards.externalRejected,true);
 assert.equal(safeguards.normal.ok,true);assert.equal(safeguards.preservesLink,true);
 assert.equal(safeguards.correctSection,true);
 assert.equal(safeguards.shortDescription.ok,true);assert.ok(safeguards.shortDescription.jd.length<30);
 assert.equal(safeguards.placeholder.ok,false);assert.equal(safeguards.emptyDescription.ok,false);
 console.log('PASS wrong job identity, foreign links, and security challenges cannot become valid JD');
 await worker.evaluate(async()=>{
  const job={jobId:'challenge',title:'Fixture PM challenge',href:'https://www.zhipin.com/job_detail/challenge.html'};
  await chrome.storage.local.set({bht_current_task:{id:'challenge',status:'stopped',results:[{decision:'pass',job}]}});
 });
 const challenge=await call('DETAIL_CHECK');
 assert.match(challenge.message,/安全验证/);
 assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.zhipin.com/job_detail/challenge.html'}))).length,1);
 assert.equal(privateRequests,0);
 console.log('PASS security challenge page is kept for the user; no automatic challenge retries');
} finally { await ctx.close(); }
