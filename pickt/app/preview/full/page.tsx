"use client";

import { useCallback, useState } from "react";

/* ================================================================
   pickt — Full interactive preview
   Multi-page app: Discovery → Marketplace → Profile → Unlock
   Light theme, self-contained, no auth required.
   ================================================================ */

// ── CSS tokens ──────────────────────────────────────────────

const tokens = `
:root {
  --bg: #f5f7f2; --surface: #ffffff; --surface2: #f0f4eb; --surface3: #e8edde;
  --border: #dde5d0; --border2: #c8d4b8;
  --text: #1a2010; --text2: #3d5026; --muted: #7a8f6a;
  --accent: #7ab830; --accent-bright: #c8f060;
  --accent-dim: rgba(122,184,48,0.1); --accent-border: rgba(122,184,48,0.28);
  --green: #2d7d46; --green-dim: rgba(45,125,70,0.08); --green-border: rgba(45,125,70,0.22);
  --amber: #b45309; --amber-dim: rgba(180,83,9,0.07); --amber-border: rgba(180,83,9,0.2);
  --red: #dc2626; --red-dim: rgba(220,38,38,0.07); --red-border: rgba(220,38,38,0.2);
  --blue: #1d6fb8; --blue-dim: rgba(29,111,184,0.08); --blue-border: rgba(29,111,184,0.2);
  --purple: #6d28d9; --purple-dim: rgba(109,40,217,0.08); --purple-border: rgba(109,40,217,0.2);
}
body,.bg-background { margin:0; background:var(--bg)!important; color:var(--text)!important; font-family:"DM Sans",system-ui,sans-serif; font-size:13px; }
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes shimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
.fade-up { animation: fadeUp 0.3s ease forwards; }
`;

// ── Discovery data ──────────────────────────────────────────

const INDUSTRIES = ["Technology","Sales & Revenue","Finance & FinTech","Marketing & Growth","Product & Design","Operations","Data & Analytics","People & HR","Customer Success","Legal & Compliance"];

const ROLES: Record<string,string[]> = {
  "Technology":["Software Engineer","Solutions Architect","DevOps/Cloud Engineer","Security Engineer","Mobile Engineer","Frontend Engineer","Backend Engineer","ML/AI Engineer","Platform Engineer","QA/Test Engineer"],
  "Sales & Revenue":["Account Executive","SDR/BDR","Head of Sales","Enterprise Sales","Partnerships Manager","Sales Operations","Revenue Operations"],
  "Finance & FinTech":["Financial Analyst","CFO/Finance Director","Finance Manager","FP&A","Risk & Compliance","FinTech Product","Accountant"],
  "Marketing & Growth":["Growth Marketer","Performance Marketing","Content/SEO","Social Media","Brand Manager","CRM/Email","Head of Marketing"],
  "Product & Design":["Product Manager","UX/UI Designer","UX Researcher","Product Designer","Head of Product","Design Lead"],
  "Operations":["Operations Manager","COO","Supply Chain","Project Manager","Process Improvement"],
  "Data & Analytics":["Data Analyst","Data Scientist","Data Engineer","Analytics Engineer","ML Engineer","BI Developer","Head of Data"],
  "People & HR":["Talent Acquisition","HR Business Partner","People Ops","L&D Manager","Chief People Officer"],
  "Customer Success":["Customer Success Manager","Account Manager","Head of CS","Support Lead","Renewals Manager"],
  "Legal & Compliance":["General Counsel","Legal Counsel","Compliance Manager","Contract Manager","Privacy/GDPR"],
};

const SENIORITY = ["Junior (0\u20132 yrs)","Mid-level (3\u20135 yrs)","Senior (5\u20138 yrs)","Lead/Principal","Head of/Director","VP/C-suite","Any level"];
const LOCATIONS = ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra","Remote","Any location"];
const SALARY_BANDS = ["$80k \u2013 $120k","$120k \u2013 $160k","$160k \u2013 $200k","$200k \u2013 $250k","$250k+","Any range"];

// ── Mock candidates ─────────────────────────────────────────

const MOCK = [
  { id:"1", role:"Senior Backend Engineer", sen:"Senior", city:"Sydney", co:"Canva", skills:["Go","PostgreSQL","Kubernetes"], int:4, fee:8, sL:170000, sH:195000, yrs:7, days:2, pop:true, avail:"available" as const },
  { id:"2", role:"Product Manager", sen:"Mid-level", city:"Melbourne", co:"Atlassian", skills:["Product Strategy","SQL","Figma"], int:3, fee:8, sL:140000, sH:160000, yrs:5, days:5, pop:false, avail:"available" as const },
  { id:"3", role:"Staff Frontend Engineer", sen:"Staff/Lead", city:"Brisbane", co:"SafetyCulture", skills:["React","TypeScript","GraphQL"], int:5, fee:8, sL:190000, sH:220000, yrs:9, days:1, pop:true, avail:"interviewing_elsewhere" as const },
  { id:"4", role:"Data Engineer", sen:"Senior", city:"Sydney", co:"Zip Co", skills:["Python","Spark","Airflow","dbt"], int:3, fee:10, sL:155000, sH:175000, yrs:6, days:14, pop:false, avail:"available" as const },
];

const WH = [
  { co:"Canva", tenure:"3 yrs", dates:"Jan 2022 \u2013 Present", ach:"Led migration of 2.4M user accounts to microservices, reducing p99 latency by 68%." },
  { co:"Atlassian", tenure:"2 yrs", dates:"Mar 2020 \u2013 Dec 2021", ach:"Built real-time collaboration backend handling 50k concurrent connections." },
  { co:"Zip Co", tenure:"1.5 yrs", dates:"Jul 2018 \u2013 Feb 2020", ach:"Designed payment pipeline processing $2M+ daily transactions." },
];
const SK = [
  { name:"Backend Systems", tags:["Go","PostgreSQL","gRPC"] },
  { name:"Cloud Infrastructure", tags:["AWS","Terraform","Kubernetes"] },
  { name:"Data Pipeline", tags:["Kafka","Redis","Spark"] },
];

// ── Shared helpers ──────────────────────────────────────────

type Route = "dashboard" | "discovery" | "marketplace" | "profile" | "reviewing";

function chip(bg:string,bd:string,c:string) {
  return { display:"inline-flex" as const, alignItems:"center" as const, padding:"3px 11px", borderRadius:99, fontSize:11, fontWeight:500, background:bg, border:`1px solid ${bd}`, color:c, whiteSpace:"nowrap" as const, gap:4 };
}
function Dot({f}:{f:boolean}) { return <div style={{width:8,height:8,borderRadius:"50%",background:f?"var(--accent)":"var(--border2)"}}/> }

const discoveryChip: React.CSSProperties = {
  padding:"10px 22px", borderRadius:99, fontSize:14, fontWeight:500,
  background:"var(--surface)", border:"1px solid var(--border)",
  color:"var(--text)", cursor:"pointer",
  boxShadow:"0 2px 8px rgba(0,0,0,0.06)",
  transition:"all 0.2s ease",
};

function hoverOn(e:React.MouseEvent<HTMLButtonElement>) { const t=e.currentTarget; t.style.borderColor="var(--accent)"; t.style.background="var(--accent-dim)"; t.style.color="var(--accent)"; t.style.transform="translateY(-2px)"; t.style.boxShadow="0 4px 16px rgba(122,184,48,0.15)"; }
function hoverOff(e:React.MouseEvent<HTMLButtonElement>) { const t=e.currentTarget; t.style.borderColor="var(--border)"; t.style.background="var(--surface)"; t.style.color="var(--text)"; t.style.transform="translateY(0)"; t.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; }

// ── SIDEBAR ─────────────────────────────────────────────────

function Sidebar({ active, onNav }: { active: string; onNav:(id:string)=>void }) {
  const sections: { heading:string|null; items:{ id:string; label:string; badge?:number }[] }[] = [
    { heading:"Dashboard", items:[{ id:"dashboard", label:"Dashboard" },{ id:"reviewing", label:"Reviewing", badge:3 }] },
    { heading:"Discover", items:[{ id:"marketplace", label:"Marketplace" },{ id:"shortlist", label:"Shortlist" }] },
    { heading:"Manage", items:[{ id:"my-candidates", label:"My candidates" },{ id:"placements", label:"Placements" },{ id:"earnings", label:"Earnings" }] },
    { heading:null, items:[{ id:"settings", label:"Settings" }] },
  ];

  return (
    <aside style={{ width:214, flexShrink:0, display:"flex", flexDirection:"column", height:"100vh", background:"var(--surface)", borderRight:"1px solid var(--border)", overflowY:"auto" }}>
      <div style={{ padding:"20px 20px 4px" }}>
        <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:21, color:"var(--text)" }}>pick<span style={{ fontStyle:"italic", color:"var(--accent)" }}>t</span></div>
        <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.12em", marginTop:4 }}>Talent marketplace</div>
      </div>
      <nav style={{ flex:1, paddingTop:16 }}>
        {sections.map((sec,si) => (
          <div key={si} style={{ marginBottom:8 }}>
            {sec.heading && <div style={{ fontSize:10, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", padding:"8px 20px 4px" }}>{sec.heading}</div>}
            {sec.items.map((it) => (
              <button key={it.id} onClick={()=>onNav(it.id)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"8px 16px", border:"none", borderLeft:active===it.id?"2px solid var(--accent)":"2px solid transparent", background:active===it.id?"var(--surface2)":"transparent", color:active===it.id?"var(--text)":"var(--text2)", fontSize:13, fontWeight:active===it.id?500:400, cursor:"pointer", textAlign:"left" }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:active===it.id?"var(--accent)":"var(--border2)", flexShrink:0 }}/>
                <span style={{ flex:1 }}>{it.label}</span>
                {it.badge!=null && <span style={{ fontSize:11, fontWeight:600, background:"var(--accent-dim)", color:"var(--accent)", border:"1px solid var(--accent-border)", borderRadius:99, padding:"1px 8px" }}>{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:10, background:"linear-gradient(135deg,var(--accent) 0%,#5a9020 100%)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:600 }}>A</div>
        <div><div style={{ fontSize:13, fontWeight:500 }}>Acme Recruiting</div><div style={{ fontSize:11, color:"var(--muted)" }}>Free plan</div></div>
      </div>
    </aside>
  );
}

// ── TOPBAR ──────────────────────────────────────────────────

function Topbar({ title }:{ title:string }) {
  return (
    <header style={{ height:52, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px", background:"var(--surface)", borderBottom:"1px solid var(--border)", position:"sticky", top:0, zIndex:10 }}>
      <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:20, fontWeight:400, margin:0 }}>{title}</h1>
      <div style={{ position:"relative", width:34, height:34, borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text2)", cursor:"pointer" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span style={{ position:"absolute", top:-3, right:-3, minWidth:16, height:16, borderRadius:99, background:"var(--accent)", color:"#fff", fontSize:8, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" }}>5</span>
      </div>
    </header>
  );
}

// ── STEP DOTS ───────────────────────────────────────────────

function StepDots({ current, total }:{ current:number; total:number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:8 }}>
      {Array.from({ length:total }).map((_,i) => (
        <div key={i} style={{ height:6, borderRadius:99, transition:"all 0.3s ease", background:i+1===current?"var(--accent)":i+1<current?"var(--green)":"var(--border2)", width:i+1===current?28:6 }}/>
      ))}
    </div>
  );
}

// ── DISCOVERY PAGE ──────────────────────────────────────────

function DiscoveryPage({ onComplete }:{ onComplete:(f:{role:string;industry:string;seniority:string;location:string;salary:string})=>void }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [industry, setIndustry] = useState("");
  const [seniority, setSeniority] = useState("");
  const [location, setLocation] = useState("");
  const [animKey, setAnimKey] = useState(0);

  function advance(n:number) { setAnimKey(k=>k+1); setStep(n); }

  const allRoles = Array.from(new Set(Object.values(ROLES).flat())).sort();

  const crumbs: string[] = [];
  if (role) crumbs.push(role);
  if (industry) crumbs.push(industry);
  if (seniority) crumbs.push(seniority);
  if (location) crumbs.push(location);
  const labels = ["Role","Industry","Seniority","Location","Salary"];

  const inputStyle: React.CSSProperties = {
    width:"100%", maxWidth:400, padding:"12px 16px", borderRadius:12,
    border:"1px solid var(--border)", background:"var(--surface)",
    color:"var(--text)", fontSize:15, outline:"none", textAlign:"center",
    transition:"border-color 0.2s ease",
  };

  return (
    <div style={{ display:"flex", minHeight:"calc(100vh - 52px)", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
      <div key={animKey} className="fade-up" style={{ maxWidth:640, width:"100%", textAlign:"center" }}>
        <StepDots current={step} total={5} />

        {crumbs.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"center", gap:6, marginBottom:16, fontSize:12, color:"var(--muted)" }}>
            {crumbs.map((b,i) => (
              <span key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ padding:"3px 12px", borderRadius:99, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:12 }}>{b}</span>
                {i<crumbs.length-1 && <span>{"\u203A"}</span>}
              </span>
            ))}
            <span>{"\u203A"}</span><span>{labels[step-1]}</span>
          </div>
        )}

        <p style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.2em", color:"var(--muted)", marginBottom:12 }}>Step {step} of 5</p>

        {/* Step 1: ROLE (first) */}
        {step===1 && (<>
          <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:32, color:"var(--text)", margin:"0 0 8px", lineHeight:1.2 }}>What <span style={{ fontStyle:"italic", color:"var(--accent)" }}>role</span> are you filling?</h2>
          <p style={{ fontSize:14, color:"var(--muted)", marginBottom:32 }}>Pick a role or type your own below.</p>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:10, marginBottom:24 }}>
            {allRoles.slice(0,16).map(r=><button key={r} style={discoveryChip} onMouseOver={hoverOn} onMouseOut={hoverOff} onClick={()=>{setRole(r);setCustomRole("");advance(2)}}>{r}</button>)}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:12, color:"var(--muted)", marginBottom:4 }}>Don&apos;t see your role? Type it here:</div>
            <input
              type="text"
              placeholder="e.g. Solutions Consultant, Revenue Analyst..."
              value={customRole}
              onChange={e=>setCustomRole(e.target.value)}
              onFocus={e=>{e.currentTarget.style.borderColor="var(--accent)"}}
              onBlur={e=>{e.currentTarget.style.borderColor="var(--border)"}}
              style={inputStyle}
            />
            {customRole.trim().length>=2 && (
              <button onClick={()=>{setRole(customRole.trim());advance(2)}} style={{ padding:"10px 28px", borderRadius:10, border:"none", background:"var(--accent)", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", marginTop:4 }}>
                Continue with &ldquo;{customRole.trim()}&rdquo;
              </button>
            )}
          </div>
        </>)}

        {/* Step 2: INDUSTRY */}
        {step===2 && (<>
          <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:32, color:"var(--text)", margin:"0 0 8px", lineHeight:1.2 }}>What <span style={{ fontStyle:"italic", color:"var(--accent)" }}>industry</span> are you hiring for?</h2>
          <p style={{ fontSize:14, color:"var(--muted)", marginBottom:32 }}>Choose the sector that best matches your open role.</p>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:10 }}>
            {INDUSTRIES.map(ind=><button key={ind} style={discoveryChip} onMouseOver={hoverOn} onMouseOut={hoverOff} onClick={()=>{setIndustry(ind);advance(3)}}>{ind}</button>)}
          </div>
        </>)}

        {/* Step 3: SENIORITY */}
        {step===3 && (<>
          <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:32, color:"var(--text)", margin:"0 0 8px", lineHeight:1.2 }}>What <span style={{ fontStyle:"italic", color:"var(--accent)" }}>seniority</span> level?</h2>
          <p style={{ fontSize:14, color:"var(--muted)", marginBottom:32 }}>We match this to candidate experience bands.</p>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:10 }}>
            {SENIORITY.map(s=><button key={s} style={discoveryChip} onMouseOver={hoverOn} onMouseOut={hoverOff} onClick={()=>{setSeniority(s);advance(4)}}>{s}</button>)}
          </div>
        </>)}

        {/* Step 4: LOCATION */}
        {step===4 && (<>
          <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:32, color:"var(--text)", margin:"0 0 8px", lineHeight:1.2 }}>Where are they <span style={{ fontStyle:"italic", color:"var(--accent)" }}>based</span>?</h2>
          <p style={{ fontSize:14, color:"var(--muted)", marginBottom:32 }}>Select a city or choose any location.</p>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:10 }}>
            {LOCATIONS.map(loc=><button key={loc} style={discoveryChip} onMouseOver={hoverOn} onMouseOut={hoverOff} onClick={()=>{setLocation(loc);advance(5)}}>{loc}</button>)}
          </div>
        </>)}

        {/* Step 5: SALARY */}
        {step===5 && (<>
          <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:32, color:"var(--text)", margin:"0 0 8px", lineHeight:1.2 }}>What&apos;s the <span style={{ fontStyle:"italic", color:"var(--accent)" }}>salary</span> range?</h2>
          <p style={{ fontSize:14, color:"var(--muted)", marginBottom:32 }}>This helps us match candidates to your budget.</p>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:10 }}>
            {SALARY_BANDS.map(band=><button key={band} style={discoveryChip} onMouseOver={hoverOn} onMouseOut={hoverOff} onClick={()=>onComplete({role,industry,seniority,location,salary:band})}>{band}</button>)}
          </div>
        </>)}

        {step>1 && <button onClick={()=>advance(step-1)} style={{ marginTop:32, border:"none", background:"none", color:"var(--muted)", fontSize:13, cursor:"pointer" }}>{"\u2190"} Back</button>}
      </div>
    </div>
  );
}

// ── MARKETPLACE PAGE ────────────────────────────────────────

function MarketplacePage({ filters, onSelect, onStartOver }:{ filters:{industry:string;role:string;seniority:string;location:string;salary:string}; onSelect:(c:typeof MOCK[0])=>void; onStartOver:()=>void }) {
  return (
    <div style={{ padding:"24px 32px", maxWidth:880, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6, fontSize:12, color:"var(--muted)" }}>
          {[filters.industry,filters.role,filters.seniority,filters.location,filters.salary].filter(Boolean).map((b,i,a)=>(
            <span key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ padding:"3px 12px", borderRadius:99, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:12 }}>{b}</span>
              {i<a.length-1&&<span>\u203A</span>}
            </span>
          ))}
        </div>
        <button onClick={onStartOver} style={{ border:"none", background:"none", color:"var(--accent)", fontSize:13, fontWeight:500, cursor:"pointer" }}>Start over</button>
      </div>

      <div style={{ position:"relative", marginBottom:16 }}>
        <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--muted)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
        <input type="text" placeholder="Search roles, skills, locations\u2026" style={{ width:"100%", height:42, padding:"0 16px 0 40px", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:14, outline:"none" }} />
      </div>

      <div style={{ fontSize:13, color:"var(--text2)", marginBottom:16 }}>Showing <strong>{MOCK.length}</strong> candidates</div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {MOCK.map(c=>{
          const s=Math.round(((0.22-c.fee/100)*(c.sL+c.sH)/2)/1000);
          const ring=c.days<=7?"0 0 0 2.5px var(--green)":c.days<=30?"0 0 0 2.5px var(--amber)":"none";
          return (
            <div key={c.id} onClick={()=>onSelect(c)} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.04),0 1px 8px rgba(0,0,0,.03)", padding:18, position:"relative", cursor:"pointer", transition:"box-shadow 0.15s ease" }}
              onMouseOver={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.1)"}
              onMouseOut={e=>e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,.04),0 1px 8px rgba(0,0,0,.03)"}>
              {c.pop&&<div style={{position:"absolute",top:10,right:10,...chip("var(--amber-dim)","var(--amber-border)","var(--amber)"),fontSize:10,fontWeight:600}}>{"\uD83D\uDD25"} Popular</div>}
              {c.days<=7&&!c.pop&&<div style={{position:"absolute",top:10,right:10,...chip("var(--green-dim)","var(--green-border)","var(--green)"),fontSize:10,fontWeight:600}}>New this week</div>}
              <div style={{ display:"flex", gap:12 }}>
                <div style={{ width:42, height:42, borderRadius:10, background:"linear-gradient(135deg,var(--accent) 0%,#5a9020 100%)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:16, fontWeight:600, boxShadow:ring, flexShrink:0 }}>{c.role[0]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:16, color:"var(--text)" }}>{c.role}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
                    <span style={chip("var(--accent-dim)","var(--accent-border)","var(--accent)")}>{c.sen}</span>
                    <span style={chip("var(--surface2)","var(--border)","var(--text2)")}>{c.city}</span>
                    <span style={chip("var(--green-dim)","var(--green-border)","var(--green)")}>{c.int} interviews</span>
                    <span style={chip("var(--purple-dim)","var(--purple-border)","var(--purple)")}>{c.yrs} yrs</span>
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:12 }}>{c.skills.map(sk=><span key={sk} style={{ padding:"2px 8px", borderRadius:6, fontSize:10, background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text2)" }}>{sk}</span>)}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:14, paddingTop:12, borderTop:"1px solid var(--border)", fontSize:12 }}>
                <span><span style={{ color:"var(--text2)" }}>{c.fee}% fee</span>{s>0&&<span style={{ color:"var(--muted)" }}> \u00B7 <span style={{ color:"var(--green)", fontWeight:700 }}>saves ~${s}k</span></span>}</span>
                <div style={{ display:"flex", gap:3 }}>{Array.from({length:5}).map((_,i)=><Dot key={i} f={i<c.int}/>)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LOCKED PROFILE PAGE ─────────────────────────────────────

function ProfilePage({ candidate:c, onBack, onUnlock }:{ candidate:typeof MOCK[0]; onBack:()=>void; onUnlock:()=>void }) {
  const saving=Math.round(((0.22-c.fee/100)*(c.sL+c.sH)/2)/1000);
  return (
    <div style={{ padding:"24px 32px", maxWidth:880, margin:"0 auto", paddingBottom:90 }}>
      <button onClick={onBack} style={{ border:"none", background:"none", color:"var(--muted)", fontSize:13, cursor:"pointer", marginBottom:16 }}>{"\u2190"} Back to marketplace</button>

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.06)", padding:22, position:"relative", marginBottom:16 }}>
        <div style={{ position:"absolute", top:22, right:22, textAlign:"right" }}>
          <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, color:"var(--accent)" }}>{c.fee}%</div>
          <div style={{ fontSize:11, color:"var(--muted)" }}>vs 20\u201325% agency</div>
          {saving>0&&<div style={{ fontSize:12, fontWeight:500, color:"var(--green)", marginTop:4 }}>saves ~${saving}k</div>}
        </div>
        <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, color:"var(--text)", margin:0 }}>{c.role}</h2>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10, paddingRight:120 }}>
          <span style={chip("var(--accent-dim)","var(--accent-border)","var(--accent)")}>{c.sen}</span>
          <span style={chip("var(--accent-dim)","var(--accent-border)","var(--accent)")}>{c.city}</span>
          <span style={chip("var(--green-dim)","var(--green-border)","var(--green)")}>{c.int} interviews</span>
          <span style={chip("var(--surface2)","var(--border)","var(--muted)")}>Currently at {c.co}</span>
          <span style={chip("var(--amber-dim)","var(--amber-border)","var(--amber)")}>Seeking ${Math.round(c.sL/1000)}k \u2013 ${Math.round(c.sH/1000)}k</span>
          <span style={chip("var(--purple-dim)","var(--purple-border)","var(--purple)")}>{c.yrs} yrs experience</span>
        </div>
        <div style={{ marginTop:18, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ width:"45%", height:18, borderRadius:8, background:"linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%)", backgroundSize:"400px 100%", animation:"shimmer 1.5s ease-in-out infinite" }}/>
          <div style={{ width:"55%", height:14, borderRadius:6, background:"linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%)", backgroundSize:"400px 100%", animation:"shimmer 1.5s ease-in-out infinite" }}/>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:16 }}>{Array.from({length:5}).map((_,i)=><Dot key={i} f={i<c.int}/>)}<span style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginLeft:8 }}>{c.int} interviews</span></div>
      </div>

      <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:16, padding:"12px 18px", borderRadius:10, background:"rgba(122,184,48,.06)", border:"1px solid var(--accent-border)", fontSize:12, color:"var(--text2)", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontWeight:700, color:"var(--accent)" }}>8</span> viewed this week</div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontWeight:700, color:"var(--accent)" }}>3</span> saved</div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 12px", borderRadius:99, background:"var(--amber-dim)", border:"1px solid var(--amber-border)" }}><span style={{ fontWeight:700, color:"var(--amber)" }}>2</span><span style={{ color:"var(--amber)" }}>reviewing now</span></div>
        <div style={{ marginLeft:"auto", fontWeight:500 }}>{c.co} <span style={{ color:"var(--amber)" }}>{"\u2605"} 4.6</span> <span style={{ color:"var(--muted)" }}>{"\u00B7"} 6 placements</span></div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, padding:18 }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--muted)", marginBottom:12 }}>Career history</div>
          {WH.map((w,i)=>(<div key={i}>{i>0&&<div style={{ height:1, background:"var(--border)", margin:"10px 0" }}/>}<div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>{w.co}</span><span style={{ fontSize:10, color:"var(--muted)" }}>{w.tenure}</span></div><div style={{ fontSize:10, fontWeight:500, color:"var(--accent)", marginTop:1 }}>{w.dates}</div><div style={{ fontSize:10, color:"var(--muted)", lineHeight:1.4, marginTop:3 }}>{w.ach}</div></div>))}
        </div>
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, padding:18 }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--muted)", marginBottom:12 }}>Top skill sets</div>
          {SK.map((cl,i)=>(<div key={i} style={{ marginBottom:12 }}><div style={{ fontSize:11, fontWeight:500, color:"var(--text2)" }}>{cl.name}</div><div style={{ display:"flex", gap:4, marginTop:5 }}>{cl.tags.map(t=><span key={t} style={{ padding:"2px 8px", borderRadius:6, fontSize:10, background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text2)" }}>{t}</span>)}</div></div>))}
        </div>
      </div>

      <div style={{ position:"relative", borderRadius:12, overflow:"hidden", border:"1px solid var(--border)", marginBottom:16 }}>
        <div style={{ background:"#fff", padding:"28px 24px", fontSize:12, lineHeight:1.6, minHeight:200 }}>
          <div style={{ fontWeight:500 }}>{c.city}, Australia</div>
          <div style={{ filter:"blur(5px)", userSelect:"none" }}>jane.doe@email.com | +61 4XX XXX XXX</div>
          <div style={{ filter:"blur(5px)", userSelect:"none" }}>linkedin.com/in/janedoe</div>
          <br/><div style={{ filter:"blur(5px)", userSelect:"none" }}>PROFESSIONAL EXPERIENCE</div>
          <div style={{ fontWeight:500 }}>{c.co}</div>
          <div style={{ filter:"blur(5px)", userSelect:"none" }}>{c.role} | Jan 2022 {"\u2013"} Present</div>
          <div style={{ filter:"blur(5px)", userSelect:"none" }}>Led cross-functional team of 12 to deliver high-impact platform improvements...</div>
        </div>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"60%", background:"linear-gradient(to bottom,transparent 0%,var(--bg) 90%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", paddingBottom:28 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:"var(--surface)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8, boxShadow:"0 2px 8px rgba(0,0,0,.08)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <span style={{ fontSize:14, fontWeight:500, color:"var(--text2)" }}>CV locked</span>
        </div>
      </div>

      <div style={{ position:"fixed", bottom:0, left:214, right:0, zIndex:40, background:"var(--surface)", borderTop:"1px solid var(--border)", boxShadow:"0 -2px 12px rgba(0,0,0,.06)", padding:"12px 0" }}>
        <div style={{ maxWidth:880, margin:"0 auto", padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:13, color:"var(--text)" }}><strong>{c.fee}%</strong> placement fee</div>
            {saving>0&&<div style={{ fontSize:12, fontWeight:600, color:"var(--green)", marginTop:2 }}>saves ~${saving}k vs agency</div>}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ padding:"10px 18px", borderRadius:10, border:"1px solid var(--border)", background:"transparent", color:"var(--text2)", fontSize:13, fontWeight:500, cursor:"pointer" }}>{"\u2661"} Save</button>
            <button onClick={onUnlock} style={{ padding:"10px 24px", borderRadius:10, border:"none", background:"var(--accent)", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer" }}>Unlock profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── UNLOCK MODAL ────────────────────────────────────────────

function UnlockModal({ candidate:c, onClose, onSuccess }:{ candidate:typeof MOCK[0]; onClose:()=>void; onSuccess:()=>void }) {
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const sv=Math.round(((0.22-c.fee/100)*(c.sL+c.sH)/2)/1000);

  if (done) return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(26,32,16,.55)", backdropFilter:"blur(6px)" }}>
      <div style={{ width:380, background:"var(--surface)", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,.15)", padding:"32px 24px", textAlign:"center" }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"var(--green-dim)", border:"2px solid var(--green-border)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg></div>
        <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, color:"var(--text)", margin:"0 0 8px" }}>Profile unlocked</h2>
        <p style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>You now have full access to this candidate&apos;s contact details and CV.</p>
        <button onClick={onSuccess} style={{ padding:"11px 28px", borderRadius:12, border:"none", background:"var(--accent)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>View unlocked profile</button>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(26,32,16,.55)", backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div style={{ width:380, background:"var(--surface)", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,.15)", padding:"28px 24px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:52, height:52, borderRadius:"50%", background:"var(--accent-dim)", border:"1.5px solid var(--accent-border)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:21, color:"var(--text)", textAlign:"center", margin:"16px 0 0" }}>Unlock <span style={{ fontStyle:"italic", color:"var(--accent)" }}>profile</span></h2>
        <p style={{ fontSize:11, color:"var(--muted)", textAlign:"center", lineHeight:1.65, margin:"8px 0 0" }}>You&apos;re about to unlock full access {"\u2014"} including name, email, LinkedIn, and employer history.</p>
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, marginTop:20, overflow:"hidden" }}>
          {([["Placement fee",`${c.fee}% of first-year salary`,true,false],["When charged","On successful hire only",false,false],["Desired salary",`$${Math.round(c.sL/1000)}k \u2013 $${Math.round(c.sH/1000)}k`,false,true],["Referred by",`${c.co} \u00B7 4.6 \u2605`,false,false],["Interviews",`${c.int} interviews`,false,false]] as [string,string,boolean,boolean][]).map(([l,v,acc,amb],i)=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"9px 16px", fontSize:12, borderTop:i>0?"1px solid var(--border)":"none" }}><span style={{ color:"var(--muted)" }}>{l}</span><span style={{ fontWeight:acc?600:400, color:acc?"var(--accent)":amb?"var(--amber)":"var(--text)" }}>{v}</span></div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, background:"rgba(45,125,70,.08)", border:"1px solid rgba(45,125,70,.2)", marginTop:12, fontSize:12 }}>
          <span style={{ color:"var(--muted)" }}>vs. typical agency (20{"\u2013"}25%)</span>
          <span style={{ fontWeight:700, color:"var(--green)" }}>Save ~${sv}k</span>
        </div>
        <label style={{ display:"flex", alignItems:"flex-start", gap:10, marginTop:16, fontSize:12, color:"var(--text2)", cursor:"pointer" }}>
          <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ width:16, height:16, marginTop:2, accentColor:"var(--accent)" }}/>
          <span>By unlocking I agree to the <span style={{ color:"var(--accent)" }}>Terms &amp; Conditions</span>.</span>
        </label>
        <div style={{ display:"flex", gap:8, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, padding:"11px 0", borderRadius:12, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:13, fontWeight:500, cursor:"pointer" }}>Cancel</button>
          <button disabled={!agreed} onClick={()=>setDone(true)} style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", background:"var(--accent)", color:"#fff", fontSize:13, fontWeight:600, cursor:agreed?"pointer":"default", opacity:agreed?1:0.35 }}>Confirm &amp; unlock</button>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD PAGE ──────────────────────────────────────────

function DashboardPage({ onGoToMarketplace }:{ onGoToMarketplace:()=>void }) {
  return (
    <div style={{ padding:"24px 32px", maxWidth:880, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, fontWeight:400, margin:"0 0 4px" }}>
            Good morning
          </h1>
          <p style={{ fontSize:13, color:"var(--muted)" }}>Here&apos;s your agency overview.</p>
        </div>
        <button onClick={onGoToMarketplace} style={{ padding:"10px 20px", borderRadius:10, border:"none", background:"var(--accent)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          Discover candidates
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:24 }}>
        {([
          { label:"Candidates referred", value:"12", sub:"3 this month", color:"var(--accent)" },
          { label:"Active unlocks", value:"5", sub:"2 interviewing", color:"var(--green)" },
          { label:"Earnings", value:"$18.4k", sub:"From 3 placements", color:"var(--accent)" },
        ]).map(stat=>(
          <div key={stat.label} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.04)", padding:"20px 22px" }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>{stat.label}</div>
            <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:32, color:stat.color, lineHeight:1 }}>{stat.value}</div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:6 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent referrals */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.04)", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h2 style={{ fontSize:14, fontWeight:600, color:"var(--text)", margin:0 }}>Recent referrals</h2>
          <span style={{ fontSize:12, color:"var(--muted)" }}>Last 30 days</span>
        </div>

        {/* Header row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 100px 100px", gap:8, padding:"10px 20px", fontSize:10, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid var(--border)", background:"var(--surface2)" }}>
          <span>Candidate</span><span>Views</span><span>Unlocks</span><span>Status</span>
        </div>

        {MOCK.map(c=>(
          <div key={c.id} style={{ display:"grid", gridTemplateColumns:"1fr 120px 100px 100px", gap:8, padding:"12px 20px", borderBottom:"1px solid var(--border)", alignItems:"center", fontSize:13 }}>
            <div>
              <div style={{ fontWeight:500, color:"var(--text)" }}>{c.role}</div>
              <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{c.sen} {"\u00B7"} {c.city}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontWeight:500, color:"var(--text2)" }}>{Math.floor(Math.random()*20+5)}</span>
              <span style={{ fontSize:10, color:"var(--muted)" }}>views</span>
            </div>
            <div style={{ display:"flex", gap:3, alignItems:"center" }}>
              {Array.from({length:5}).map((_,i)=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:i<Math.min(c.int-1,3)?"var(--accent)":"var(--border2)" }}/>)}
            </div>
            <span style={chip(
              c.days<=3?"var(--green-dim)":c.days<=7?"var(--amber-dim)":"var(--surface2)",
              c.days<=3?"var(--green-border)":c.days<=7?"var(--amber-border)":"var(--border)",
              c.days<=3?"var(--green)":c.days<=7?"var(--amber)":"var(--muted)"
            )}>{c.days<=3?"Active":c.days<=7?"Interviewing":"Listed"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REVIEWING PAGE ──────────────────────────────────────────

function ReviewingPage() {
  return (
    <div style={{ padding:"24px 32px", maxWidth:880, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, fontWeight:400, margin:"0 0 20px" }}>Reviewing</h1>
      <p style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>Candidates you&apos;re currently reviewing.</p>
      {MOCK.slice(0,2).map(c=>(
        <div key={c.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:18, marginBottom:12, display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,var(--accent) 0%,#5a9020 100%)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14, fontWeight:600, flexShrink:0 }}>{c.role[0]}</div>
          <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:500, color:"var(--text)" }}>{c.role}</div><div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{c.sen} {"\u00B7"} {c.city} {"\u00B7"} {c.co}</div></div>
          <span style={chip("var(--amber-dim)","var(--amber-border)","var(--amber)")}>Interviewing</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ────────────────────────────────────────────────

export default function FullPreview() {
  const [route, setRoute] = useState<Route>("dashboard");
  const [filters, setFilters] = useState({ industry:"", role:"", seniority:"", location:"", salary:"" });
  const [selected, setSelected] = useState<typeof MOCK[0]|null>(null);
  const [showModal, setShowModal] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  const nav = useCallback((r:Route)=>{ setFadeKey(k=>k+1); setRoute(r); },[]);

  const sidebarActive = route==="dashboard"?"dashboard":route==="discovery"||route==="marketplace"||route==="profile"?"marketplace":route==="reviewing"?"reviewing":"dashboard";

  function handleSidebarNav(id:string) {
    if (id==="dashboard") nav("dashboard");
    else if (id==="reviewing") nav("reviewing");
    else if (id==="marketplace") { if(filters.industry) nav("marketplace"); else nav("discovery"); }
  }

  const title = route==="dashboard"?"Dashboard":route==="discovery"?"Discover":route==="marketplace"?"Marketplace":route==="profile"?(selected?.role||"Profile"):route==="reviewing"?"Reviewing":"pickt";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: tokens }}/>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet"/>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
        <Sidebar active={sidebarActive} onNav={handleSidebarNav}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <Topbar title={title}/>
          <main key={fadeKey} style={{ flex:1, overflowY:"auto", animation:"fadeUp 0.15s ease" }}>
            {route==="dashboard"&&<DashboardPage onGoToMarketplace={()=>nav("discovery")}/>}
            {route==="discovery"&&<DiscoveryPage onComplete={f=>{setFilters(f);nav("marketplace")}}/>}
            {route==="marketplace"&&<MarketplacePage filters={filters} onSelect={c=>{setSelected(c);nav("profile")}} onStartOver={()=>{setFilters({industry:"",role:"",seniority:"",location:"",salary:""});nav("discovery")}}/>}
            {route==="profile"&&selected&&<ProfilePage candidate={selected} onBack={()=>nav("marketplace")} onUnlock={()=>setShowModal(true)}/>}
            {route==="reviewing"&&<ReviewingPage/>}
          </main>
        </div>
      </div>
      {showModal&&selected&&<UnlockModal candidate={selected} onClose={()=>setShowModal(false)} onSuccess={()=>{setShowModal(false);nav("marketplace")}}/>}
    </>
  );
}
