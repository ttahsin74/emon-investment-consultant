const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
const schema = fs.readFileSync('lib/db-schema.ts', 'utf8').match(/`([\s\S]*?)`/)[1];
db.exec(schema);
db.exec('PRAGMA foreign_keys = ON');
db.transaction = async work => {
 db.exec('BEGIN IMMEDIATE');
 try { const result = await work(); db.exec('COMMIT'); return result; }
 catch(error) { db.exec('ROLLBACK'); throw error; }
};
let authenticated = true;
const followupModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/followups.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:followupModule.exports, module:followupModule, FormData, Date});
const moduleObject = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('app/actions.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
vm.runInNewContext(code, {
 exports: moduleObject.exports, module: moduleObject, FormData, File, Buffer, process,
 require(name) {
  if(name==='@/lib/db') return db;
  if(name==='@/lib/followups') return followupModule.exports;
  if(name==='@/lib/auth') return {isAuthenticated:async()=>authenticated,expectedAuthToken:()=> 'test'};
  if(name==='next/cache') return {revalidatePath:()=>{}};
  if(name==='next/navigation') return {redirect:(url)=>{throw new Error('REDIRECT:'+url)}};
  if(name==='next/headers') return {cookies:async()=>({set(){},delete(){}})};
  return require(name);
 }
});
const actions=moduleObject.exports;
const data=values=>{const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,String(v));return f;};
const redirectOk=async fn=>{try{await fn();}catch(e){if(!e.message.startsWith('REDIRECT:'))throw e;}};
async function testPageDataBoundary(clientId, followupId) {
 const markers = new Map();
 const utilsModule = {exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/utils.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {module:utilsModule,exports:utilsModule.exports,Date,Intl});
 function loadPage(filename) {
  const local = {exports:{}};
  const output = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(output, {module:local,exports:local.exports,require(name) {
   if(name==='@/lib/db') return db;
   if(name==='@/lib/utils') return utilsModule.exports;
   if(name==='@/lib/followups') return followupModule.exports;
   if(name==='@/app/actions') return actions;
   if(name==='next/navigation') return {notFound(){throw new Error('Not found');}};
   if(name.startsWith('@/components/')) {
    if(!markers.has(name)) markers.set(name,()=>null);
    return markers.get(name);
   }
   return require(name);
  }});
  return local.exports.default;
 }
 function assertPlain(record) {
  assert.ok(record && Object.getPrototypeOf(record), 'SQLite rows must be converted before passing to a Client Component');
  assert.equal(Object.getPrototypeOf(record).constructor.name,'Object');
  assert.equal(Object.getPrototypeOf(Object.getPrototypeOf(record)),null);
 }
 // Real node:sqlite rows have null prototypes: direct props caused the page crash.
 assert.equal(Object.getPrototypeOf(db.prepare('SELECT * FROM clients WHERE id=?').get(clientId)),null);
 for (const filename of ['app/(admin)/clients/[id]/page.tsx','app/(admin)/clients/[id]/edit/page.tsx','app/(admin)/clients/[id]/followups/[followupId]/edit/page.tsx']) {
  const Page = loadPage(filename);
  const tree = await Page({params:Promise.resolve({id:String(clientId),followupId:String(followupId)})});
  let checked = false;
  function visit(node) {
   if(Array.isArray(node)) return node.forEach(visit);
   if(!node || typeof node !== 'object') return;
   if(node.type===markers.get('@/components/FollowupWorkspace') || node.type===markers.get('@/components/EditClientWorkspace')) {
    assertPlain(node.props.client);
    assert.ok(node.props.followups.length);
    node.props.followups.forEach(assertPlain);
    if(node.props.editing) assertPlain(node.props.editing);
    checked = true;
   }
   if(node.props) visit(node.props.children);
  }
  visit(tree);
  assert.ok(checked, 'Expected a workspace boundary in '+filename);
 }
 const Followups = loadPage('app/(admin)/followups/page.tsx');
 for (const view of ['all','closed','today','overdue']) {
  const tree = await Followups({searchParams:Promise.resolve({view})});
  let rows = 0;
  function countRows(node) {
   if(Array.isArray(node)) return node.forEach(countRows);
   if(!node || typeof node !== 'object') return;
   if(node.type === 'tr' && node.key !== null) rows++;
   if(node.props) countRows(node.props.children);
  }
  countRows(tree);
  assert.equal(rows, view === 'all' || view === 'closed' ? 1 : 0, 'List one row per client and exclude closed leads from reminders');
 }
 console.log('PASS: all three client/follow-up pages send plain records across the Server/Client Component boundary.');
}
function testFollowupRendering() {
 const React = require('react');
 const { renderToStaticMarkup } = require('react-dom/server');
 const cache = new Map();
 function loadLocal(name) {
  if (name === '@/app/actions') return actions;
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name);
  const base = name.replace('@/', '');
  const filename = fs.existsSync(base+'.tsx') ? base+'.tsx' : base+'.ts';
  const local = {exports:{}};
  cache.set(name, local.exports);
  const output = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(output, {module:local,exports:local.exports,require:loadLocal,Date,Intl,FormData});
  return local.exports;
 }
 const Workspace = loadLocal('@/components/FollowupWorkspace').default;
 const client = {id:1,status:'Negotiation'};
 const record = {id:1,client_id:1,followup_date:'2026-09-14',type:'Call',discussion:'Original conversation context',result:'Requested a site visit',next_followup_date:'2026-09-18',status:'Pending'};
 const render = (overrides={}) => renderToStaticMarkup(React.createElement(Workspace,{client,followups:[record],currentDate:'2026-09-15',...overrides}));
 const open = render();
 assert.match(open,/name="followup_date"[^>]*value="2026-09-15"/);
 assert.match(open,/name="next_followup_date"/);
 assert.match(open,/Original conversation context/);
 assert.match(open,/Requested a site visit/);
 assert.match(open,/Follow-up history/);
 assert.ok(open.indexOf('Follow-up history') < open.indexOf('New follow-up'));
 const outcomes = open.match(/<select[^>]*name="status"[^>]*>([\s\S]*?)<\/select>/)[1];
 assert.equal((outcomes.match(/<option /g)||[]).length,3);
 assert.match(open,/name="type"/);
 assert.match(open,/>Call<|>Meeting</);
 assert.match(open,/name="result"/);
 assert.match(open,/Save Follow-up/);
 assert.doesNotMatch(open,/Edit entry|Conversation complete/);
 const archived = render({followups:[{...record,status:'Completed'}]});
 assert.match(archived,/Original conversation context/);
 assert.match(archived,/New follow-up/);
 assert.match(archived,/name="followup_date"[^>]*value="2026-09-15"/);
 for (const status of ['Closed Won','Closed Lost','Converted']) {
  const closed = render({client:{...client,status}});
  assert.match(closed,/Lead closed/);
  assert.match(closed,/Original conversation context/);
  assert.doesNotMatch(closed,/<form|<input|<textarea|<select/);
 }
 const selectingClosed = render({selectedLeadStatus:'Closed Won'});
 assert.match(selectingClosed,/Closing this lead/);
 assert.doesNotMatch(selectingClosed,/<form|<input|<textarea|<select/);
 const empty = render({followups:[]});
 assert.match(empty,/No follow-ups yet/);
 console.log('PASS: follow-up UI rendering for simple three-outcome form, history order, closed, unsaved closure and empty states; history remains visible and closed forms are absent.');
}
(async()=>{
 await redirectOk(()=>actions.createClient(data({name:'Test Client',phone:'01712345678',budget:1000})));
 const client=db.prepare('SELECT * FROM clients').get(); assert.equal(client.name,'Test Client');
 await assert.rejects(actions.createClient(data({name:'',phone:'1'})),/required/);
 await assert.rejects(actions.addSale(data({client_id:client.id,service:'Test',sale_date:'2026-09-15',amount:100,discount:101})),/Discount/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM sales').get().n,0);
 await redirectOk(()=>actions.addSale(data({client_id:client.id,service:'Test',sale_date:'2026-09-15',amount:100,paid_amount:20})));
 const sale=db.prepare('SELECT * FROM sales').get();
 await actions.recordPayment(sale.id,data({payment:30}));
 assert.equal(db.prepare('SELECT paid_amount FROM sales').get().paid_amount,50);
 await assert.rejects(actions.recordPayment(sale.id,data({payment:51})),/outstanding/);
 await assert.rejects(actions.recordPayment(sale.id,data({payment:-1})),/non-negative/);
 await actions.recordPayment(sale.id,data({payment:50}));
 assert.equal(db.prepare('SELECT payment_status FROM sales').get().payment_status,'Paid');
 await redirectOk(()=>actions.addFollowup(data({client_id:client.id,followup_date:'2026-09-15',type:'Call',discussion:'Test conversation',next_followup_date:'2026-09-15'})));
 const followup=db.prepare("SELECT *, COALESCE(NULLIF(next_followup_date,''),followup_date) due FROM followups").get();
 assert.equal(followup.due,'2026-09-15');
 await actions.completeFollowup(followup.id,client.id);
 assert.equal(db.prepare('SELECT status FROM followups').get().status,'Completed');
 assert.equal(db.prepare('SELECT status FROM clients').get().status,client.status);

 // New conversations archive the old reminder without losing its notes or planned date.
 const log = (values={}) => actions.addFollowup(data({client_id:client.id,followup_date:'2026-09-15',type:'Call',discussion:'New conversation',status:'Pending',next_followup_date:'2026-09-17',...values}));
 const entries = () => db.prepare('SELECT * FROM followups WHERE client_id=? ORDER BY id').all(client.id);
 const latest = () => entries().at(-1);
 await redirectOk(()=>log({discussion:'Original notes'}));
 const originalId=latest().id;
 await redirectOk(()=>log({discussion:'Second conversation'}));
 assert.equal(entries().find(f=>f.id===originalId).discussion,'Original notes');
 assert.equal(entries().find(f=>f.id===originalId).next_followup_date,'2026-09-17');
 assert.equal(entries().find(f=>f.id===originalId).status,'Completed');
 assert.equal(entries().filter(f=>f.status==='Pending').length,1);
 await assert.rejects(log({next_followup_date:'2026-09-14'}),/on or after/);
 await assert.rejects(log({next_followup_date:''}),/next follow-up date/);
 await assert.rejects(log({followup_date:'2026-02-30'}),/valid follow-up date/);
 await assert.rejects(log({status:'Unknown'}),/valid follow-up status/);
 await assert.rejects(log({type:'Unknown'}),/valid contact type/);
 assert.equal(latest().status,'Pending');
 const otherId=Number(db.prepare("INSERT INTO clients (name,phone) VALUES ('Other client','01800000000')").run().lastInsertRowid);
 await assert.rejects(actions.completeFollowup(latest().id,otherId),/not found/);
 await assert.rejects(actions.deleteFollowup(latest().id,otherId),/not found/);
 await assert.rejects(actions.updateFollowup(latest().id,otherId,data(latest())),/not found/);
 assert.equal(latest().status,'Pending');
 // Fail after the conversation insert: the transaction must restore the previous reminder.
 db.exec("CREATE TRIGGER reject_close BEFORE UPDATE OF status ON clients WHEN NEW.status='Closed Won' BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
 const beforeFailure=entries().length;
 await assert.rejects(log({status:'Converted'}),/test rollback/);
 assert.equal(entries().length,beforeFailure);
 assert.equal(latest().status,'Pending');
 db.exec('DROP TRIGGER reject_close');
 await redirectOk(()=>log({status:'Converted',discussion:'Signed contract'}));
 assert.equal(latest().status,'Closed Won');
 assert.equal(latest().next_followup_date,'');
 assert.equal(db.prepare('SELECT status FROM clients WHERE id=?').get(client.id).status,'Closed Won');
 assert.equal(entries().filter(f=>f.status==='Pending').length,0);
 assert.equal(db.prepare(`SELECT COUNT(*) n FROM followups f JOIN clients c ON c.id=f.client_id WHERE ${followupModule.exports.activeFollowupSql}`).get().n,0);
 await assert.rejects(log(),/lead is closed/);
 await assert.rejects(actions.updateFollowup(latest().id,client.id,data(latest())),/lead is closed/);
 await assert.rejects(actions.completeFollowup(latest().id,client.id),/lead is closed/);
 await assert.rejects(actions.deleteFollowup(latest().id,client.id),/lead is closed/);
 assert.equal(latest().discussion,'Signed contract');
 // Reopening is explicit through Edit Client and never revives archived reminders.
 await redirectOk(()=>actions.updateClient(client.id,data({...client,status:'Negotiation'})));
 assert.equal(entries().filter(f=>f.status==='Pending').length,0);
 await assert.rejects(actions.updateFollowup(originalId,client.id,data(entries().find(f=>f.id===originalId))),/archived/);
 await redirectOk(()=>log());
 await redirectOk(()=>actions.updateFollowup(latest().id,client.id,data({...latest(),status:'Closed Lost',discussion:'Chose a different property'})));
 assert.equal(latest().status,'Closed Lost');
 assert.equal(latest().next_followup_date,'');
 assert.equal(db.prepare('SELECT status FROM clients WHERE id=?').get(client.id).status,'Closed Lost');
 await redirectOk(()=>actions.updateClient(client.id,data({...client,status:'Negotiation'})));
 await redirectOk(()=>log());
 const countBeforeClose=entries().length;
 await redirectOk(()=>actions.updateClient(client.id,data({...client,status:'Closed Won'})));
 assert.equal(entries().length,countBeforeClose);
 assert.equal(latest().status,'Completed');
 await assert.rejects(log(),/lead is closed/);
 // Legacy closed leads with pending rows must not leak into action queues.
 db.prepare("INSERT INTO followups (client_id,followup_date,discussion,status) VALUES (?,'2026-09-15','Legacy reminder','Pending')").run(otherId);
 db.prepare("UPDATE clients SET status='Converted' WHERE id=?").run(otherId);
 assert.equal(db.prepare(`SELECT COUNT(*) n FROM followups f JOIN clients c ON c.id=f.client_id WHERE ${followupModule.exports.activeFollowupSql}`).get().n,0);
 for (const alias of ['Converted','Deal Won','Deal Closed','Closed Won']) assert.equal(followupModule.exports.closedLeadStatus(alias),'Closed Won');
 await redirectOk(()=>actions.deleteClient(otherId));
 await testPageDataBoundary(client.id,latest().id);
 authenticated=false;
 await assert.rejects(actions.deleteClient(client.id),/REDIRECT:\/login/);
 await assert.rejects(log(),/REDIRECT:\/login/);
 await assert.rejects(actions.completeFollowup(latest().id,client.id),/REDIRECT:\/login/);
 await assert.rejects(actions.recordPayment(sale.id,data({payment:1})),/REDIRECT:\/login/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM clients').get().n,1);
 authenticated=true;
 await redirectOk(()=>actions.deleteClient(client.id));
 for(const table of ['clients','sales','followups','activities']) assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 testFollowupRendering();
 db.close();
 console.log('PASS: client creation, validation, sale totals, partial/full payments, overpayment rejection, follow-up history, closure/reopening, stale-write protection, ownership, transaction rollback, queue filtering, date validation, authentication and cascade deletion (isolated in-memory database).');
})().catch(e=>{console.error(e);process.exitCode=1;});
