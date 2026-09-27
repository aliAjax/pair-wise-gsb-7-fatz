import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

const FIELDS={title:'标题',room:'展厅',type:'类型',desc:'介绍',audio:'语音'};
const COLORS=['#e6b45d','#ef8f84','#83b9b1','#9ba7dc'];
const BLANK={title:'',room:'',type:'装置',desc:'',audio:''};
const STATUS_CLS={'已发布':'live','待发布':'pending','暂未开放':'closed'};
const now=()=>new Date().toLocaleString('zh-CN',{hour12:false});

const seed={
 exhibits:[{id:1,color:'#e6b45d'},{id:2,color:'#ef8f84'},{id:3,color:'#83b9b1'}],
 batches:[{id:1,no:1,time:'2026-09-21 10:00',active:true,items:{
  1:{title:'潮汐之后',room:'A01 · 主展厅',type:'装置',desc:'一件记录海岸线变化的沉浸式影像装置。',audio:'https://example.com/audio.mp3'},
  3:{title:'柔软的边界',room:'C01 · 新媒介',type:'互动',desc:'观众的移动会改变墙面上的光影。',audio:''}}}],
 pending:{2:{title:'未寄出的信',room:'B02 · 纸上时间',type:'档案',desc:'来自三代人的手写信件与声音档案。',audio:''}},
};
const load=()=>{try{const s=JSON.parse(localStorage.getItem('guide-state-v2'));if(s&&Array.isArray(s.exhibits)&&Array.isArray(s.batches)&&s.pending)return s;}catch(e){}return seed;};
const mergeActive=batches=>{const m={};batches.filter(b=>b.active).forEach(b=>Object.assign(m,b.items));return m;};

function App(){
 const [state,setState]=useState(load);
 const {exhibits,batches,pending}=state;
 const [selected,setSelected]=useState(1);
 const [view,setView]=useState('edit');
 const [filter,setFilter]=useState('全部');
 const [form,setForm]=useState({title:'',room:'',desc:''});
 const [notice,setNotice]=useState('');
 const [confirming,setConfirming]=useState(false);
 const [withdrawing,setWithdrawing]=useState(false);
 const [showHistory,setShowHistory]=useState(false);

 useEffect(()=>{localStorage.setItem('guide-state-v2',JSON.stringify(state));},[state]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return()=>clearTimeout(t);},[notice]);

 // 访客当前内容：所有生效批次按确认顺序合并，后确认的覆盖先确认的
 const published=useMemo(()=>mergeActive(batches),[batches]);
 // 进入过任意批次的展项才对访客可见；只存在于待发布批次的内容访客看不到
 const known=useMemo(()=>{const s=new Set();batches.forEach(b=>Object.keys(b.items).forEach(k=>s.add(+k)));return s;},[batches]);
 const currentBatch=useMemo(()=>[...batches].reverse().find(b=>b.active)||null,[batches]);
 const statusOf=id=>pending[id]?'待发布':published[id]?'已发布':'暂未开放';

 // 待发布批次与访客当前内容的差异，提交时据此生成确认清单
 const changes=useMemo(()=>exhibits.map(e=>{
  const p=pending[e.id];if(!p)return null;
  const cur=published[e.id];
  const fields=Object.keys(FIELDS).filter(k=>(p[k]||'')!==((cur&&cur[k])||''));
  if(cur&&!fields.length)return null;
  return{id:e.id,kind:cur?'修改':'新增',fields,next:p};
 }).filter(Boolean),[exhibits,pending,published]);

 const current=exhibits.find(x=>x.id===selected)||exhibits[0];
 const draft=current?(pending[current.id]||published[current.id]||BLANK):BLANK;
 const visible=exhibits.filter(x=>filter==='全部'||statusOf(x.id)===filter);
 const colorOf=id=>(exhibits.find(e=>e.id===id)||{}).color||'#c9cfc9';

 // 编辑只写入待发布批次，不影响访客当前内容
 const edit=(k,v)=>{if(!current)return;setState(s=>{const base=s.pending[current.id]||mergeActive(s.batches)[current.id]||BLANK;return{...s,pending:{...s.pending,[current.id]:{...base,[k]:v}}}});};
 const add=()=>{
  if(!form.title.trim())return;
  const id=Date.now();
  setState(s=>({...s,exhibits:[...s.exhibits,{id,color:COLORS[s.exhibits.length%4]}],pending:{...s.pending,[id]:{title:form.title,room:form.room,type:'装置',desc:form.desc,audio:''}}}));
  setSelected(id);setForm({title:'',room:'',desc:''});
  setNotice('已保存到待发布批次，提交后访客才可见');
 };
 const revertOne=id=>{
  setState(s=>{
   const p={...s.pending};delete p[id];
   const ever=s.batches.some(b=>b.items[id]!=null);
   return{...s,pending:p,exhibits:ever?s.exhibits:s.exhibits.filter(e=>e.id!==id)};
  });
  setNotice('已撤销该展项的未发布更改');
 };
 // 确认后整批生效：待发布批次整体成为最新一批访客内容
 const confirmPublish=()=>{
  if(!changes.length)return;
  const batch={id:Date.now(),no:batches.length+1,time:now(),active:true,items:Object.fromEntries(changes.map(c=>[c.id,c.next]))};
  setState(s=>({...s,batches:[...s.batches,batch],pending:{}}));
  setConfirming(false);
  setNotice(`批次 #${batch.no} 已确认，访客内容已整批更新`);
 };
 // 撤回当前批次：整批撤回，访客内容自动回落到上一批
 const confirmWithdraw=()=>{
  setState(s=>{
   const actives=s.batches.map((b,i)=>i).filter(i=>s.batches[i].active);
   if(!actives.length)return s;
   const idx=actives[actives.length-1];
   return{...s,batches:s.batches.map((b,i)=>i===idx?{...b,active:false}:b)};
  });
  setWithdrawing(false);
  setNotice('已撤回当前批次，访客内容恢复为上一批');
 };
 const exportData=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='exhibition-guide.json';a.click();setNotice('已导出展项数据');};

 if(view==='visitor'){
  const cards=exhibits.filter(e=>known.has(e.id));
  return <div className="visitor">
   <header><div className="brand"><span className="mark">M</span><span>潮汐美术馆</span></div><button className="ghost" onClick={()=>setView('edit')}>返回编辑</button></header>
   <main className="visitor-main">
    <span className="eyebrow">VISITOR GUIDE / 2024</span>
    <h1>沿着作品，<em>走进</em>另一种时间。</h1>
    <p className="lead">当你靠近一件作品，它的故事就开始流动。选择一个展项开始探索。</p>
    <div className="visitor-grid">
     {cards.map(x=>{const c=published[x.id];
      return c?
       <article className="visitor-card" key={x.id} onClick={()=>{setSelected(x.id);setView('detail');}}>
        <div className="art" style={{background:x.color}}><span>{String(x.id).padStart(2,'0')}</span><i>↗</i></div>
        <div className="card-meta"><small>{c.room}</small><h3>{c.title}</h3><p>{c.desc}</p></div>
       </article>:
       <article className="visitor-card closed" key={x.id}>
        <div className="art"><span>{String(x.id).padStart(2,'0')}</span></div>
        <div className="card-meta"><small>NOT AVAILABLE</small><h3>暂未开放</h3><p>该展项内容尚未开放，敬请期待。</p></div>
       </article>;})}
    </div>
    {!cards.length&&<p className="lead">暂无开放中的展项。</p>}
   </main>
   {notice&&<div className="toast">{notice}</div>}
  </div>;
 }

 if(view==='detail'&&current){
  const c=published[current.id];
  return <div className="visitor">
   <header><div className="brand"><span className="mark">M</span><span>潮汐美术馆 · 导览</span></div><button className="ghost" onClick={()=>setView('visitor')}>← 全部展项</button></header>
   {c?<main className="detail">
    <div className="detail-art" style={{background:current.color}}><span>{String(current.id).padStart(2,'0')}</span></div>
    <div className="detail-copy">
     <span className="eyebrow">{c.room} / {c.type}</span>
     <h1>{c.title}</h1>
     <p>{c.desc}</p>
     {c.audio&&<button className="audio" onClick={()=>setNotice('正在播放导览音频…')}>▶ 播放语音导览</button>}
     <div className="qr"><div className="qr-box">▦</div><div><strong>分享这个展项</strong><small>扫描二维码，在手机上继续阅读</small></div></div>
    </div>
   </main>:<main className="detail"><div className="detail-copy"><span className="eyebrow">NOT AVAILABLE</span><h1>暂未开放</h1><p>该展项内容尚未开放，敬请期待。</p></div></main>}
   {notice&&<div className="toast">{notice}</div>}
  </div>;
 }

 return <div className="app">
  <aside>
   <div className="brand"><span className="mark">M</span><span>展览工作台</span></div>
   <div className="side-label">当前项目</div>
   <div className="project"><span className="project-dot"></span><div><strong>潮汐之后</strong><small>2024 春季展</small></div><span>⌄</span></div>
   <nav><button className="active">▧ <span>展项内容</span><b>{exhibits.length}</b></button><button>⌁ <span>展厅动线</span></button><button>◉ <span>二维码</span></button></nav>
   <div className="side-foot"><button>⚙ 设置</button><small>更改暂存于待发布批次</small></div>
  </aside>
  <main className="workspace">
   <header className="topbar">
    <div><span className="eyebrow">EXHIBITION BUILDER</span><h1>展项内容</h1></div>
    <div className="top-actions">
     <button className="secondary" onClick={exportData}>↓ 导出 JSON</button>
     <button className="secondary" onClick={()=>setView('visitor')}>◉ 访客预览</button>
     <button className="primary" disabled={!changes.length} onClick={()=>setConfirming(true)}>提交待发布批次{changes.length?`（${changes.length}）`:''} <span>↗</span></button>
    </div>
   </header>
   <div className="batch-bar">
    <div className="batch-info">
     <span className={'dot '+(currentBatch?'on':'off')}></span>
     {currentBatch?<span>访客当前内容 <strong>批次 #{currentBatch.no}</strong><small>{currentBatch.time} · {Object.keys(currentBatch.items).length} 项更新</small></span>:<span>暂无生效批次，访客端显示「暂未开放」</span>}
    </div>
    <div className="batch-actions">
     <span className="pending-hint">{changes.length?`待发布批次 · ${changes.length} 项更改`:'待发布批次为空'}</span>
     <button className="link" onClick={()=>setShowHistory(v=>!v)}>发布记录</button>
     <button className="danger" disabled={!currentBatch} onClick={()=>setWithdrawing(true)}>撤回当前批次</button>
    </div>
   </div>
   {showHistory&&<div className="history">
    {[...batches].reverse().map(b=><div className="history-row" key={b.id}>
     <strong>批次 #{b.no}</strong><span>{b.time}</span><span>{Object.keys(b.items).length} 项更新</span>
     <span className={'tag '+(b.active?'on':'off')}>{b.active?'生效中':'已撤回'}</span>
    </div>)}
    {!batches.length&&<div className="history-row">暂无发布记录</div>}
   </div>}
   <div className="content">
    <section className="list-pane">
     <div className="list-head"><div><h2>全部展项</h2><span>{exhibits.length} 个展项</span></div><button className="add-btn" onClick={()=>document.querySelector('.form-panel').scrollIntoView({behavior:'smooth'})}>＋ 添加展项</button></div>
     <div className="filters">{['全部','待发布','已发布','暂未开放'].map(x=><button className={filter===x?'selected':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div>
     <div className="exhibit-list">
      {visible.map(x=>{const d=pending[x.id]||published[x.id];const st=statusOf(x.id);
       return <button className={'exhibit-row '+(selected===x.id?'chosen':'')} key={x.id} onClick={()=>setSelected(x.id)}>
        <span className="thumb" style={{background:x.color}}>{String(x.id).padStart(2,'0')}</span>
        <span className="row-copy"><strong>{d&&d.title?d.title:'（未命名）'}</strong><small>{d?`${d.room||'未设置展厅'} · ${d.type}`:'暂无内容'}</small></span>
        <span className={'status '+STATUS_CLS[st]}>{st}</span>
        <span className="chev">›</span>
       </button>;})}
      {!visible.length&&<p className="empty">该状态下暂无展项。</p>}
     </div>
    </section>
    <section className="form-panel">
     <div className="panel-title">
      <div><span className="eyebrow">EDIT EXHIBIT</span><h2>编辑展项</h2></div>
      {current&&<span className={'status '+STATUS_CLS[statusOf(current.id)]}>{statusOf(current.id)}</span>}
     </div>
     {current&&<div className="editor">
      {pending[current.id]&&<div className="dirty-note"><span>● 有未发布的更改，仅保存在待发布批次中</span><button className="undo" onClick={()=>revertOne(current.id)}>撤销更改</button></div>}
      <label>展项标题<input value={draft.title} onChange={e=>edit('title',e.target.value)}/></label>
      <div className="two">
       <label>所在展厅<input value={draft.room} onChange={e=>edit('room',e.target.value)}/></label>
       <label>内容类型<select value={draft.type} onChange={e=>edit('type',e.target.value)}><option>装置</option><option>档案</option><option>互动</option><option>绘画</option></select></label>
      </div>
      <label>展项介绍<textarea rows="5" value={draft.desc} onChange={e=>edit('desc',e.target.value)}/></label>
      <label>语音导览 URL<input value={draft.audio} placeholder="https://…" onChange={e=>edit('audio',e.target.value)}/><small className="hint">修改先存入待发布批次；访客扫码看到的是最近确认批次的内容</small></label>
      <div className="preview-block">
       <div className="preview-heading"><span>二维码预览</span><button onClick={()=>setNotice('二维码链接已复制')}>复制链接</button></div>
       <div className="qr-preview"><div className="qr-box big">▦</div><div><strong>展项-{String(current.id).padStart(3,'0')}</strong><small>/guide/{current.id}</small></div></div>
      </div>
     </div>}
     <div className="new-form">
      <div className="panel-title"><div><span className="eyebrow">NEW ENTRY</span><h2>快速添加展项</h2></div></div>
      <div className="two"><input placeholder="展项标题" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="展厅编号" value={form.room} onChange={e=>setForm({...form,room:e.target.value})}/></div>
      <textarea placeholder="一句话介绍…" rows="2" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/>
      <button className="primary full" onClick={add}>保存到待发布批次</button>
     </div>
    </section>
   </div>
  </main>
  {confirming&&<div className="overlay" onClick={()=>setConfirming(false)}>
   <div className="modal" onClick={e=>e.stopPropagation()}>
    <span className="eyebrow">PUBLISH BATCH</span>
    <h2>确认发布批次 #{batches.length+1}？</h2>
    <p className="modal-sub">以下 {changes.length} 个展项将发生变化，确认后整批成为访客当前内容：</p>
    <div className="diff-list">
     {changes.map(c=><div className="diff-row" key={c.id}>
      <span className="thumb" style={{background:colorOf(c.id)}}>{String(c.id).padStart(2,'0')}</span>
      <div className="diff-copy">
       <strong>{c.next.title||'（未命名）'}</strong>
       <small>{c.kind==='新增'?'新展项，发布后访客可见':`修改 ${c.fields.map(f=>FIELDS[f]).join('、')}`}</small>
      </div>
      <span className={'kind '+(c.kind==='新增'?'new':'mod')}>{c.kind}</span>
     </div>)}
    </div>
    <div className="modal-actions">
     <button className="secondary" onClick={()=>setConfirming(false)}>继续编辑</button>
     <button className="primary" onClick={confirmPublish}>确认发布，整批生效</button>
    </div>
   </div>
  </div>}
  {withdrawing&&currentBatch&&<div className="overlay" onClick={()=>setWithdrawing(false)}>
   <div className="modal" onClick={e=>e.stopPropagation()}>
    <span className="eyebrow">WITHDRAW BATCH</span>
    <h2>撤回批次 #{currentBatch.no}？</h2>
    <p className="modal-sub">将整批撤回（{Object.keys(currentBatch.items).length} 个展项），不能只撤回其中一件。访客内容恢复为上一批；没有上一批版本的展项将显示「暂未开放」。</p>
    <div className="modal-actions">
     <button className="secondary" onClick={()=>setWithdrawing(false)}>取消</button>
     <button className="danger-solid" onClick={confirmWithdraw}>确认撤回整批</button>
    </div>
   </div>
  </div>}
  {notice&&<div className="toast">{notice}</div>}
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
