// home.js — synced with sidepanel via chrome.storage.local
// No Gemini/API key mentions to user. Railway proxy silent fallback.

const PROXY_URL = "https://quanty-proxy-production.up.railway.app";
const TK = "quanty_learning_tasks";
const SETTINGS_KEY = "settings";
const LOCAL_STATE_KEY = "quanty_home_local";
const VIEW_STORAGE_KEY = "quanty_active_view";
const VIEW_TITLES = { focus:"Focus", lists:"My Lists", inbox:"Inbox", completed:"Completed", reports:"Reports", restrictions:"Restrictions", settings:"Settings" };

const state = {
  goal:"", tasks:[], isActive:false, remainingTime:0, totalTime:3600,
  streak:0, successfulDays:0, focusSessions:0,
  lastActiveDate:new Date().toISOString().split("T")[0],
  dailyDeadline:"18:00", websiteBlocklist:[], programBlocklist:[],
  breakMinutes:15, activityByDay:{},
};

// ── Local fallback plans ──────────────────────────────────
const LOCAL_PLANS = {
  python:[
    {title:"Install Python and VS Code",explanation:"Your dev environment is your workbench. Python is the language, VS Code is where you write. Install both, run `print('Hello')` — you're already a programmer."},
    {title:"Variables and data types",explanation:"A variable is a named box. `name = 'Alice'` is a string, `age = 20` is a number. Python figures out the type automatically."},
    {title:"Conditions (if/else) and loops",explanation:"if/else is a fork: if it rains, take an umbrella. A for loop repeats N times. This is the backbone of all logic."},
    {title:"Functions: def, arguments, return",explanation:"A function is a recipe. Write once, call as many times as you need. `return` gives back the result. Without functions, code turns to chaos."},
    {title:"Lists and dictionaries",explanation:"A list `[1,2,3]` is numbered slots. A dict `{'name':'Alice'}` is like a phone book: look up by name, get the value."},
    {title:"Files and exceptions",explanation:"Open a file, read it, close it. try/except is your safety net when things go wrong. Essential for real programs."},
    {title:"Modules and pip",explanation:"A module is a ready-made toolkit. pip is the module store. `import requests` — now you can make HTTP calls."},
    {title:"Mini-project: automate a real task",explanation:"Write a script that actually helps you: rename files, fetch data, calculate something. A real project builds real understanding."},
  ],
  javascript:[
    {title:"DevTools and editor setup",explanation:"DevTools is in your browser (F12). The console lets you run JS right now. VS Code is your main editor. Set up both before moving on."},
    {title:"let, const and data types",explanation:"let is a variable you can change. const you can't. Types: string `'hello'`, number `42`, boolean `true/false`. Everything builds on this."},
    {title:"Functions and scope",explanation:"A function is a named code block. Scope: a variable inside a function only exists there. Like a secret in a locked room."},
    {title:"Arrays and objects",explanation:"Array `[1,2,3]` is a list. `.push()` adds, `.map()` transforms. Object `{name:'Alice'}` is a record with fields. No real project works without them."},
    {title:"DOM and events",explanation:"`document.querySelector('.btn')` finds a button. `.addEventListener('click', fn)` reacts to a click. That's how sites become interactive."},
    {title:"fetch and async/await",explanation:"fetch makes a network request. It's async — JS doesn't wait. async/await makes it readable: `const data = await fetch(url)`."},
    {title:"ES6 modules and npm",explanation:"Modules split code into files. npm is the library store. `npm install react` downloads React. `import` connects it."},
    {title:"Mini-project: interactive page",explanation:"Build a todo list or calculator in the browser. Data in an array, rendering via DOM. This ties everything together."},
  ],
  react:[
    {title:"Vite and first project",explanation:"Vite is a fast build tool. `npm create vite@latest` creates a project in a minute. Run `npm run dev` to see your first page."},
    {title:"JSX and markup",explanation:"JSX is HTML inside JavaScript. `return <h1>Hello</h1>` looks like HTML but it's JS. React turns it into real DOM automatically."},
    {title:"Components and props",explanation:"A component is a building block. Props are its parameters. `<Button color='green' />` passes color. Inside you read `props.color`."},
    {title:"useState",explanation:"`const [count, setCount] = useState(0)` — count is the value, setCount changes it. When you change it, React re-renders. That's the magic."},
    {title:"useEffect",explanation:"useEffect runs when a component mounts or data changes. Perfect for fetching from a server. No real apps without it."},
    {title:"React Router",explanation:"Multiple pages without page reloads. `<Route path='/about'>` shows AboutPage on navigation. The user thinks they moved — they didn't."},
    {title:"Forms in React",explanation:"Controlled input: every keystroke → setState → re-render → value updated. Full control over what's typed."},
    {title:"Mini-project: todo list",explanation:"useState for the list, a form to add, map to display, filter to delete. The perfect final project — ties everything together."},
  ],
  english:[
    {title:"Determine your level A1–C2",explanation:"Take a test on Cambridge or British Council. Without an honest level, you'll study the wrong things. 15 minutes saves months."},
    {title:"10 words a day with Anki",explanation:"Anki uses spaced repetition. A word appears right when your brain is about to forget it. 10 words = 3600 per year."},
    {title:"15-minute podcast with no subtitles",explanation:"BBC 6 Minute English (B1), All Ears English (B2). First without subtitles — train your ear. Then check what you understood."},
    {title:"Present Tenses",explanation:"Simple — facts and habits. Continuous — happening right now. Perfect — connection between past and present. The foundation."},
    {title:"5 sentences about your day",explanation:"Every evening: 5 sentences about what you did. Simple and correct beats complex and wrong. The writing habit changes everything."},
    {title:"A show with English subtitles",explanation:"English subtitles, not translated ones! Watch an episode, look up unfamiliar words after. Context helps you remember better."},
    {title:"2 minutes of recorded speech",explanation:"Talk 2 minutes on any topic — record yourself. Listen back: you'll hear mistakes you never notice when writing."},
    {title:"Article + new words to Anki",explanation:"BBC Learning English or VOA — plain-language articles. 5–10 new words → into Anki. Reading and vocabulary at the same time."},
  ],
  default:[
    {title:"Define a measurable outcome",explanation:"A goal without a number is a dream. 'Learn to code' is bad. 'Build 3 working projects in 2 months' is good. Be that specific."},
    {title:"Break into 30-minute steps",explanation:"30 minutes a day = 182 hours a year. Break your big goal into single-session actions. Small wins every day build big results."},
    {title:"Remove your main distraction",explanation:"One thing steals 80% of your time. Phone, YouTube, social media. Remove it physically during work: another room, blocked, silenced."},
    {title:"Build the minimum version in a day",explanation:"MVP — minimum working version. Not perfect, just functional. Show it to someone. Real feedback beats any plan in your head."},
    {title:"Get your first real feedback",explanation:"Show your work to a real person — a friend, someone online. Their honest reaction tells you more than any inner critic."},
    {title:"Fix the top 3 weaknesses",explanation:"From feedback, pick 3 most important problems. Only 3 — not 10. Solve them fully. Focus on what matters most."},
    {title:"Explain the topic to someone else",explanation:"Feynman method: if you can explain it simply, you understand it. If not, there are gaps. Explain to a friend or write it out."},
    {title:"Set the next goal",explanation:"Once you reach your result, immediately set the next one. Momentum dies in pauses. The next step should be ready before you finish."},
  ],
}
function getLocalPlan(goal) {
  const g = goal.toLowerCase();
  const map = { python:["python"], javascript:["javascript","js"], react:["react"], english:["english"] };
  for (const [key, words] of Object.entries(map)) {
    if (words.some(w => g.includes(w))) return LOCAL_PLANS[key];
  }
  return LOCAL_PLANS.default;
}

// ── DOM refs ──────────────────────────────────────────────
const headerGoal=document.getElementById("headerGoal"),headerGoalText=document.getElementById("headerGoalText"),currentTaskTitle=document.getElementById("currentTaskTitle"),currentTaskDesc=document.getElementById("currentTaskDesc"),startFocusBtn=document.getElementById("startFocusBtn"),focusButtonText=document.getElementById("focusButtonText"),timerEl=document.getElementById("timer"),timerProgressFill=document.getElementById("timerProgressFill"),statusBadge=document.getElementById("statusBadge"),statusDot=document.getElementById("statusDot"),statusText=document.getElementById("statusText"),progressText=document.getElementById("progressText"),progressBarFill=document.getElementById("progressBarFill"),goalInput=document.getElementById("goalInput"),generateBtn=document.getElementById("generateBtn"),hoursInput=document.getElementById("hoursInput"),minutesInput=document.getElementById("minutesInput"),taskList=document.getElementById("taskList"),newTaskInput=document.getElementById("newTaskInput"),addTaskBtn=document.getElementById("addTaskBtn"),todayPlan=document.getElementById("todayPlan"),deadlineInput=document.getElementById("deadlineInput"),websiteInput=document.getElementById("websiteInput"),addWebsiteBtn=document.getElementById("addWebsiteBtn"),websiteTagList=document.getElementById("websiteTagList"),programInput=document.getElementById("programInput"),addProgramBtn=document.getElementById("addProgramBtn"),programTagList=document.getElementById("programTagList"),breakInput=document.getElementById("breakInput"),loginBtn=document.getElementById("loginBtn"),bcPage=document.getElementById("bcPage"),subDate=document.getElementById("subDate"),badgeLists=document.getElementById("badgeLists"),badgeInbox=document.getElementById("badgeInbox"),inboxInput=document.getElementById("inboxInput"),inboxAddBtn=document.getElementById("inboxAddBtn"),inboxEmpty=document.getElementById("inboxEmpty"),inboxList=document.getElementById("inboxList"),completedEmpty=document.getElementById("completedEmpty"),completedList=document.getElementById("completedList"),repTasksDone=document.getElementById("repTasksDone"),repSessions=document.getElementById("repSessions"),repStreak=document.getElementById("repStreak"),repDays=document.getElementById("repDays"),chartBars=document.getElementById("chartBars"),metaWorkTasks=document.getElementById("metaWorkTasks"),listCardWorkPreview=document.getElementById("listCardWorkPreview"),themeBtn=document.getElementById("themeBtn"),themeIcon=document.getElementById("themeIcon"),reportBugBtn=document.getElementById("reportBugBtn"),notifBtn=document.getElementById("notifBtn"),newListBtn=document.getElementById("newListBtn"),createListCard=document.getElementById("createListCard"),focusOverlay=document.getElementById("focusOverlay"),taskDetailModal=document.getElementById("taskDetailModal"),taskDetailTitle=document.getElementById("taskDetailTitle"),taskDetailExpl=document.getElementById("taskDetailExpl"),taskDetailClose=document.getElementById("taskDetailClose");

// ── Focus animation ───────────────────────────────────────
function playFocusAnimation() {
  if (!focusOverlay) return;
  focusOverlay.style.pointerEvents = "all";
  focusOverlay.style.opacity = "1";
  setTimeout(() => {
    focusOverlay.style.opacity = "0";
    setTimeout(() => { focusOverlay.style.pointerEvents = "none"; }, 700);
  }, 900);
}

function refreshLucide() { if(typeof lucide!=="undefined"&&lucide.createIcons) lucide.createIcons(); }
function todayISO() { return new Date().toISOString().split("T")[0]; }
function bumpActivityDay() { const d=todayISO(); state.activityByDay[d]=(state.activityByDay[d]||0)+1; }
function escapeHtml(text) { const div=document.createElement("div"); div.textContent=text; return div.innerHTML; }

// ── Storage ───────────────────────────────────────────────
async function saveTasks() {
  try {
    await chrome.storage.local.set({[TK]:state.tasks});
    const active=state.tasks.find(t=>!t.completed);
    await chrome.runtime.sendMessage({type:"quanty:setSettings",settings:{goal:state.goal,currentTask:active?.title||active?.text||""}}).catch(()=>{});
  } catch {}
}
async function loadTasks() {
  try {
    const got=await chrome.storage.local.get([TK,SETTINGS_KEY]);
    if(Array.isArray(got[TK])) state.tasks=got[TK];
    if(got[SETTINGS_KEY]?.goal) state.goal=got[SETTINGS_KEY].goal;
    if(got[SETTINGS_KEY]?.dailyLimitMinutes) state.totalTime=got[SETTINGS_KEY].dailyLimitMinutes*60;
  } catch {}
}
function saveLocalState() {
  try {
    localStorage.setItem(LOCAL_STATE_KEY,JSON.stringify({isActive:state.isActive,remainingTime:state.remainingTime,totalTime:state.totalTime,streak:state.streak,successfulDays:state.successfulDays,focusSessions:state.focusSessions,lastActiveDate:state.lastActiveDate,dailyDeadline:state.dailyDeadline,websiteBlocklist:state.websiteBlocklist,programBlocklist:state.programBlocklist,breakMinutes:state.breakMinutes,activityByDay:state.activityByDay}));
  } catch {}
}
function loadLocalState() {
  try {
    const raw=localStorage.getItem(LOCAL_STATE_KEY); if(!raw) return;
    const p=JSON.parse(raw);
    if(typeof p.isActive==="boolean") state.isActive=p.isActive;
    if(typeof p.remainingTime==="number") state.remainingTime=p.remainingTime;
    if(typeof p.totalTime==="number") state.totalTime=p.totalTime;
    if(typeof p.streak==="number") state.streak=p.streak;
    if(typeof p.successfulDays==="number") state.successfulDays=p.successfulDays;
    if(typeof p.focusSessions==="number") state.focusSessions=p.focusSessions;
    if(p.lastActiveDate) state.lastActiveDate=p.lastActiveDate;
    if(typeof p.dailyDeadline==="string") state.dailyDeadline=p.dailyDeadline;
    if(Array.isArray(p.websiteBlocklist)) state.websiteBlocklist=p.websiteBlocklist;
    if(Array.isArray(p.programBlocklist)) state.programBlocklist=p.programBlocklist;
    if(typeof p.breakMinutes==="number") state.breakMinutes=p.breakMinutes;
    if(p.activityByDay&&typeof p.activityByDay==="object") state.activityByDay=p.activityByDay;
  } catch {}
}

// ── chrome.storage sync (listen for sidepanel/other view changes) ───
try {
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=="local") return;
    if(changes[TK]?.newValue){ state.tasks=changes[TK].newValue; updateUI(); }
    if(changes[SETTINGS_KEY]?.newValue?.goal){ state.goal=changes[SETTINGS_KEY].newValue.goal; updateUI(); }
    // Sync focus timer across views
    const foc=changes["quanty_focus_end"]?.newValue;
    if(foc){
      const wasActive=state.isActive;
      state.isActive=!!foc.active;
      if(foc.active&&foc.focusEndTime>0){
        state.remainingTime=Math.max(0,Math.round((foc.focusEndTime-Date.now())/1000));
      } else if(!foc.active&&wasActive){
        state.remainingTime=foc.totalTime||state.totalTime;
      }
      applyFocusButtonUi(state.isActive);
      updateTimerDisplay();
    }
  });
} catch {}

// ── Events ────────────────────────────────────────────────
generateBtn.addEventListener("click",generatePlan);
startFocusBtn.addEventListener("click",toggleFocus);
addTaskBtn.addEventListener("click",addTask);
newTaskInput.addEventListener("keydown",e=>{ if(e.key==="Enter") addTask(); });
hoursInput.addEventListener("change",updateDeadline);
minutesInput.addEventListener("change",updateDeadline);
deadlineInput.addEventListener("change",()=>{ state.dailyDeadline=deadlineInput.value||"18:00"; saveLocalState(); });
addWebsiteBtn.addEventListener("click",addWebsiteChip);
websiteInput.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addWebsiteChip(); } });
addProgramBtn.addEventListener("click",addProgramChip);
programInput.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addProgramChip(); } });
breakInput.addEventListener("change",()=>{ state.breakMinutes=Math.min(120,Math.max(0,parseInt(breakInput.value,10)||0)); breakInput.value=String(state.breakMinutes); saveLocalState(); });
loginBtn?.addEventListener("click",()=>{ const n=window.prompt("Demo login:",localStorage.getItem("quanty_user")||""); if(n!==null){ const t=n.trim(); if(t) localStorage.setItem("quanty_user",t); else localStorage.removeItem("quanty_user"); } });
inboxAddBtn.addEventListener("click",addInboxTask);
inboxInput.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addInboxTask(); } });
reportBugBtn?.addEventListener("click",()=>{ window.location.href="mailto:support@quanty.app?subject=Quanty%20bug%20report"; });
notifBtn?.addEventListener("click",()=>alert("Notifications: coming soon."));
newListBtn?.addEventListener("click",()=>alert("New list: coming soon."));
createListCard?.addEventListener("click",()=>alert("Create list: coming soon."));
taskDetailClose?.addEventListener("click",()=>taskDetailModal?.classList.add("hidden"));
taskDetailModal?.addEventListener("click",e=>{ if(e.target===taskDetailModal) taskDetailModal.classList.add("hidden"); });
let themeAlt=false;
themeBtn?.addEventListener("click",()=>{ themeAlt=!themeAlt; document.documentElement.classList.toggle("theme-dawn",themeAlt); if(themeIcon){ themeIcon.setAttribute("data-lucide",themeAlt?"moon":"sun"); refreshLucide(); } });

// ── Init ──────────────────────────────────────────────────
async function init() {
  loadLocalState(); await loadTasks();
  // Restore timestamp-based focus state
  try {
    const got=await chrome.storage.local.get(["quanty_focus_end"]);
    const foc=got["quanty_focus_end"];
    if(foc&&foc.active&&foc.focusEndTime>Date.now()){
      state.isActive=true;
      state.remainingTime=Math.max(0,Math.round((foc.focusEndTime-Date.now())/1000));
      if(foc.totalTime) state.totalTime=foc.totalTime;
    } else if(foc&&!foc.active){ state.isActive=false; }
  } catch {}
  hoursInput.value=String(Math.floor(state.totalTime/3600));
  minutesInput.value=String(Math.floor((state.totalTime%3600)/60));
  deadlineInput.value=state.dailyDeadline||"18:00";
  breakInput.value=String(state.breakMinutes??15);
  if(!state.isActive&&state.remainingTime===0&&state.totalTime>0) state.remainingTime=state.totalTime;
  if(!state.activityByDay||typeof state.activityByDay!=="object") state.activityByDay={};
  updateSubDate(); startTimerInterval(); updateUI(); setupViewNav();
  document.querySelectorAll(".list-add-btn[data-focus-lists]").forEach(btn=>btn.addEventListener("click",()=>window.setView("lists")));
  document.querySelector(".list-add-btn[data-list-add]")?.addEventListener("click",()=>{ window.setView("lists"); setTimeout(()=>newTaskInput?.focus(),200); });
  document.querySelectorAll(".settings-row[data-settings]").forEach(row=>row.addEventListener("click",()=>alert(`Settings "${row.getAttribute("data-settings")}": coming soon.`)));
  document.getElementById("homeLogo")?.addEventListener("error",e=>{ e.target.style.display="none"; });
  refreshLucide();
}

function setupViewNav() {
  const navBtns=document.querySelectorAll(".nav-item[data-view]"),views=document.querySelectorAll(".view[id^='view-']");
  function setView(name) {
    navBtns.forEach(b=>{ const on=b.dataset.view===name; b.classList.toggle("active",on); b.setAttribute("aria-current",on?"page":"false"); });
    views.forEach(v=>v.classList.toggle("active",v.id.replace("view-","")===name));
    if(bcPage&&VIEW_TITLES[name]) bcPage.textContent=VIEW_TITLES[name];
    try{ sessionStorage.setItem(VIEW_STORAGE_KEY,name); }catch{}
    refreshLucide();
  }
  window.setView=setView;
  navBtns.forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  let initial="focus";
  try{ const s=sessionStorage.getItem(VIEW_STORAGE_KEY); if(s&&[...navBtns].some(b=>b.dataset.view===s)) initial=s; }catch{}
  setView(initial);
}

function updateSubDate() { if(!subDate) return; subDate.textContent=new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date()); }

// ── Timer (timestamp-based, synced via chrome.storage) ──────
const FOCUS_KEY = "quanty_focus_end";

function updateDeadline() {
  const h=Math.min(24,Math.max(0,parseInt(hoursInput.value,10)||0)),m=Math.min(59,Math.max(0,parseInt(minutesInput.value,10)||0));
  hoursInput.value=String(h); minutesInput.value=String(m);
  state.totalTime=h*3600+m*60; if(!state.isActive) state.remainingTime=state.totalTime;
  saveLocalState(); updateTimerDisplay();
}
let timerInterval;
function startTimerInterval() {
  if(timerInterval) clearInterval(timerInterval);
  timerInterval=setInterval(async ()=>{
    if(!state.isActive) return;
    try {
      const got=await chrome.storage.local.get([FOCUS_KEY]);
      const foc=got[FOCUS_KEY];
      if(foc&&foc.active&&foc.focusEndTime>0){
        const remaining=Math.max(0,Math.round((foc.focusEndTime-Date.now())/1000));
        state.remainingTime=remaining;
        if(remaining<=0){
          state.isActive=false; state.focusSessions+=1;
          await chrome.storage.local.set({[FOCUS_KEY]:{focusEndTime:0,totalTime:state.totalTime,active:false}});
          saveLocalState(); updateUI(); return;
        }
      } else if(foc&&!foc.active&&state.isActive){
        state.isActive=false; applyFocusButtonUi(false);
      }
    } catch {
      if(state.remainingTime>0){ state.remainingTime-=1; saveLocalState(); }
      else { setFocusRunning(false); state.focusSessions+=1; saveLocalState(); updateUI(); return; }
    }
    updateTimerDisplay();
  },1000);
}
function updateTimerDisplay() {
  const t=Math.max(0,state.remainingTime);
  timerEl.textContent=`${String(Math.floor(t/3600)).padStart(2,"0")}:${String(Math.floor((t%3600)/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
  timerProgressFill.style.width=`${state.totalTime>0?(t/state.totalTime)*100:100}%`;
}
function applyFocusButtonUi(r) { focusButtonText.textContent=r?"Stop Focus Session":"Start Focus Session"; startFocusBtn.classList.toggle("is-stop",r); }
function setFocusRunning(r) { state.isActive=r; applyFocusButtonUi(r); }
async function toggleFocus() {
  if(state.tasks.length===0){ alert("Add tasks first."); return; }
  if(state.isActive){
    setFocusRunning(false);
    await chrome.storage.local.set({[FOCUS_KEY]:{focusEndTime:0,totalTime:state.totalTime,active:false}});
    try{ chrome.runtime.sendMessage({type:"quanty:focusStop"}); }catch{}
    saveLocalState(); updateUI(); return;
  }
  state.remainingTime=state.totalTime;
  const focusEndTime=Date.now()+state.totalTime*1000;
  await chrome.storage.local.set({[FOCUS_KEY]:{focusEndTime,totalTime:state.totalTime,active:true}});
  try{ chrome.runtime.sendMessage({type:"quanty:focusStart"}); }catch{}
  updateStreak(); setFocusRunning(true); saveLocalState(); updateUI(); playFocusAnimation();
  try{ chrome.runtime.sendMessage({type:"quanty:setSettings",settings:{blocklistDomains:state.websiteBlocklist,currentTask:state.tasks.find(t=>!t.completed)?.title||state.tasks.find(t=>!t.completed)?.text||""}}); }catch{}
}

// ── Plan generation ───────────────────────────────────────
async function generatePlan() {
  const goal=goalInput.value.trim(); if(!goal){ alert("Enter a goal"); return; }
  const dh=Math.min(24,Math.max(0,parseInt(hoursInput.value,10)||0)),dm=Math.min(59,Math.max(0,parseInt(minutesInput.value,10)||0));
  generateBtn.disabled=true; const prev=generateBtn.textContent; generateBtn.textContent="…";
  let tasks=null;
  try {
    const ctrl=new AbortController(),tid=setTimeout(()=>ctrl.abort(),9000);
    const r=await fetch(`${PROXY_URL}/api/generate-plan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal,deadlineHours:dh,deadlineMinutes:dm}),signal:ctrl.signal});
    clearTimeout(tid);
    if(r.ok){ const d=await r.json(); if(Array.isArray(d.tasks)&&d.tasks.length>0){ tasks=d.tasks.map((text,i)=>({id:Date.now()+i,day:i+1,minutes:30,title:String(text).trim(),text:String(text).trim(),explanation:`Day ${i+1}: ${String(text).trim()}. Break it into small steps and complete fully in this session.`,status:"todo",active:i===0,completed:false})); } }
  } catch {}
  if(!tasks){ const plan=getLocalPlan(goal); tasks=plan.map((item,i)=>({id:Date.now()+i,day:i+1,minutes:30,title:item.title,text:item.title,explanation:item.explanation,status:"todo",active:i===0,completed:false})); }
  state.tasks=tasks; state.goal=goal; goalInput.value=""; generateBtn.disabled=false; generateBtn.textContent=prev;
  await saveTasks(); updateUI();
}

// ── Tasks ─────────────────────────────────────────────────
async function addTask() {
  const text=newTaskInput.value.trim(); if(!text) return;
  state.tasks.push({id:Date.now(),day:state.tasks.length+1,minutes:30,title:text,text,explanation:"Complete this task fully in one session.",status:"todo",active:state.tasks.length===0,completed:false});
  newTaskInput.value=""; await saveTasks(); updateUI();
}
async function addInboxTask() {
  const text=inboxInput.value.trim(); if(!text) return;
  state.tasks.push({id:Date.now(),day:state.tasks.length+1,minutes:30,title:text,text,explanation:"Task from Inbox. Complete it fully.",status:"todo",active:false,completed:false,fromInbox:true});
  inboxInput.value=""; await saveTasks(); updateUI();
}
async function toggleTask(id) {
  const task=state.tasks.find(t=>t.id===id); if(!task) return;
  const was=task.completed; task.completed=!task.completed; task.status=task.completed?"done":"todo";
  if(!was&&task.completed) bumpActivityDay(); await saveTasks(); updateUI();
}
async function deleteTask(id) { state.tasks=state.tasks.filter(t=>t.id!==id); await saveTasks(); updateUI(); }
function updateStreak() {
  const today=todayISO(),yesterday=new Date(Date.now()-86400000).toISOString().split("T")[0];
  if(state.lastActiveDate===today) return;
  state.streak=state.lastActiveDate===yesterday?state.streak+1:1; state.successfulDays+=1; state.lastActiveDate=today;
}
function openTaskDetail(task) {
  if(!taskDetailModal) return;
  if(taskDetailTitle) taskDetailTitle.textContent=task.title||task.text;
  if(taskDetailExpl) taskDetailExpl.textContent=task.explanation||"Complete the task fully.";
  taskDetailModal.classList.remove("hidden");
}

// ── Blocklist ─────────────────────────────────────────────
function normalizeWebsite(raw) { let s=(raw||"").trim().toLowerCase(); if(!s) return ""; s=s.replace(/^https?:\/\//,"").replace(/^www\./,""); return s.split("/")[0].split("?")[0].replace(/:\d+$/,"").replace(/\.$/,""); }
function addWebsiteChip() { const v=normalizeWebsite(websiteInput.value); if(!v||state.websiteBlocklist.includes(v)) return; state.websiteBlocklist.push(v); websiteInput.value=""; saveLocalState(); renderChips(); }
function addProgramChip() { const v=(programInput.value||"").trim(); if(!v) return; if(!state.programBlocklist.some(p=>p.toLowerCase()===v.toLowerCase())) state.programBlocklist.push(v); programInput.value=""; saveLocalState(); renderChips(); }
function renderChips() {
  websiteTagList.innerHTML=state.websiteBlocklist.map((s,i)=>`<span class="tag">${escapeHtml(s)}<button type="button" class="tag-remove" data-wi="${i}">×</button></span>`).join("");
  websiteTagList.querySelectorAll("[data-wi]").forEach(btn=>btn.addEventListener("click",()=>{ state.websiteBlocklist.splice(Number(btn.getAttribute("data-wi")),1); saveLocalState(); renderChips(); }));
  programTagList.innerHTML=state.programBlocklist.map((s,i)=>`<span class="tag">${escapeHtml(s)}<button type="button" class="tag-remove" data-pi="${i}">×</button></span>`).join("");
  programTagList.querySelectorAll("[data-pi]").forEach(btn=>btn.addEventListener("click",()=>{ state.programBlocklist.splice(Number(btn.getAttribute("data-pi")),1); saveLocalState(); renderChips(); }));
}

// ── UI ────────────────────────────────────────────────────
function updateUI() {
  if(state.goal){ headerGoal.hidden=false; headerGoalText.textContent=state.goal; }else{ headerGoal.hidden=true; }
  const cur=state.tasks.find(t=>!t.completed);
  if(cur){ currentTaskTitle.textContent=cur.title||cur.text; if(currentTaskDesc) currentTaskDesc.style.display="none"; }
  else{ currentTaskTitle.textContent=state.tasks.length>0?"All tasks completed 🎉":"No task yet"; if(currentTaskDesc) currentTaskDesc.style.display=state.tasks.length>0?"none":"block"; }
  const completed=state.tasks.filter(t=>t.completed).length,total=state.tasks.length;
  progressText.textContent=`${completed} / ${total} tasks`; progressBarFill.style.width=total>0?`${(completed/total)*100}%`:"0%";
  if(badgeLists) badgeLists.textContent=String(state.tasks.filter(t=>!t.completed).length);
  updateStatus(completed,total); updateTaskList(); updateTodayPlan(); updateTimerDisplay();
  updateInboxView(); updateCompletedView(); updateReportsView(); updateListCardPreview(); renderChips();
  startFocusBtn.disabled=state.tasks.length===0; applyFocusButtonUi(state.isActive);
}
function updateStatus(completed,total) {
  statusBadge.classList.remove("status-ready","status-locked","status-unlocked");
  if(total===0){ statusDot.textContent="●"; statusText.textContent="Ready"; statusBadge.classList.add("status-ready"); }
  else if(completed===total){ statusDot.textContent="✓"; statusText.textContent="Unlocked"; statusBadge.classList.add("status-unlocked"); }
  else{ statusDot.textContent="●"; statusText.textContent=`Locked · ${completed}/${total}`; statusBadge.classList.add("status-locked"); }
}
function updateTaskList() {
  if(state.tasks.length===0){ taskList.innerHTML='<p class="empty-message">No tasks yet — generate a plan or add one.</p>'; return; }
  taskList.innerHTML=state.tasks.map(task=>`
    <div class="task-row ${task.completed?"completed":""}">
      <div class="task-row__check ${task.completed?"checked":""}" role="button" tabindex="0" data-task-toggle="${task.id}">${task.completed?"✓":""}</div>
      <span class="task-row__text task-clickable" data-task-detail="${task.id}">${escapeHtml(task.title||task.text)}</span>
      <button type="button" class="task-row__del" data-task-delete="${task.id}" aria-label="Delete">×</button>
    </div>`).join("");
  taskList.querySelectorAll("[data-task-toggle]").forEach(el=>{ const id=Number(el.getAttribute("data-task-toggle")); el.addEventListener("click",()=>toggleTask(id)); el.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggleTask(id); } }); });
  taskList.querySelectorAll("[data-task-delete]").forEach(el=>el.addEventListener("click",()=>deleteTask(Number(el.getAttribute("data-task-delete")))));
  taskList.querySelectorAll("[data-task-detail]").forEach(el=>el.addEventListener("click",e=>{ e.stopPropagation(); const task=state.tasks.find(t=>t.id===Number(el.getAttribute("data-task-detail"))); if(task) openTaskDetail(task); }));
}
function updateTodayPlan() {
  const slice=state.tasks.slice(0,3);
  if(slice.length===0){ todayPlan.innerHTML='<p class="empty-message">No plan for today yet</p>'; return; }
  todayPlan.innerHTML=slice.map(task=>`<div class="today-row"><span class="today-row__icon">${task.completed?"✓":"→"}</span><span>${escapeHtml(task.title||task.text)}</span></div>`).join("");
}
function updateInboxView() {
  const items=state.tasks.filter(t=>t.fromInbox&&!t.completed);
  if(badgeInbox) badgeInbox.textContent=String(items.length);
  if(!inboxList||!inboxEmpty) return;
  if(items.length===0){ inboxEmpty.style.display=""; inboxList.style.display="none"; inboxList.innerHTML=""; return; }
  inboxEmpty.style.display="none"; inboxList.style.display="flex";
  inboxList.innerHTML=items.map(task=>`<div class="task-row"><div class="task-row__check" role="button" tabindex="0" data-inbox-toggle="${task.id}"></div><span class="task-row__text">${escapeHtml(task.title||task.text)}</span><button type="button" class="task-row__del" data-inbox-del="${task.id}">×</button></div>`).join("");
  inboxList.querySelectorAll("[data-inbox-toggle]").forEach(el=>el.addEventListener("click",()=>toggleTask(Number(el.getAttribute("data-inbox-toggle")))));
  inboxList.querySelectorAll("[data-inbox-del]").forEach(el=>el.addEventListener("click",()=>deleteTask(Number(el.getAttribute("data-inbox-del")))));
}
function updateCompletedView() {
  const done=state.tasks.filter(t=>t.completed);
  if(!completedList||!completedEmpty) return;
  if(done.length===0){ completedEmpty.style.display=""; completedList.style.display="none"; completedList.innerHTML=""; return; }
  completedEmpty.style.display="none"; completedList.style.display="flex";
  completedList.innerHTML=done.map(task=>`<div class="task-row completed"><div class="task-row__check checked" role="button" tabindex="0" data-done-toggle="${task.id}">✓</div><span class="task-row__text">${escapeHtml(task.title||task.text)}</span><button type="button" class="task-row__del" data-done-del="${task.id}">×</button></div>`).join("");
  completedList.querySelectorAll("[data-done-toggle]").forEach(el=>el.addEventListener("click",()=>toggleTask(Number(el.getAttribute("data-done-toggle")))));
  completedList.querySelectorAll("[data-done-del]").forEach(el=>el.addEventListener("click",()=>deleteTask(Number(el.getAttribute("data-done-del")))));
}
function updateReportsView() {
  const totalDone=state.tasks.filter(t=>t.completed).length;
  if(repTasksDone) repTasksDone.textContent=String(totalDone);
  if(repSessions) repSessions.textContent=String(state.focusSessions);
  if(repStreak) repStreak.textContent=String(state.streak);
  if(repDays) repDays.textContent=String(state.successfulDays);
  if(!chartBars) return;
  const days=[]; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toISOString().split("T")[0]); }
  const counts=days.map(d=>state.activityByDay[d]||0),max=Math.max(1,...counts);
  chartBars.innerHTML=counts.map(c=>`<div class="chart-bar ${c>0?"has-data":""}" style="height:${Math.max(6,Math.round((c/max)*80))}px" title="${c}"></div>`).join("");
}
function updateListCardPreview() {
  const open=state.tasks.filter(t=>!t.completed);
  if(metaWorkTasks) metaWorkTasks.textContent=`${open.length} active`;
  if(!listCardWorkPreview) return;
  const preview=open.slice(0,2);
  if(preview.length===0&&state.tasks.length===0){ listCardWorkPreview.innerHTML=`<div class="list-empty__icon"><i data-lucide="clipboard"></i></div><p>No tasks yet</p><span>Nothing here yet.</span>`; }
  else if(preview.length===0){ listCardWorkPreview.innerHTML=`<div class="list-empty__icon"><i data-lucide="check-circle"></i></div><p>All caught up</p>`; }
  else{ listCardWorkPreview.innerHTML=preview.map(t=>`<p style="font-size:11.5px;color:var(--tx-md);text-align:center;width:100%;">${escapeHtml(t.title||t.text)}</p>`).join(""); }
  refreshLucide();
}
init();