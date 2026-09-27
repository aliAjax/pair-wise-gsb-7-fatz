import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

// 展项只保留身份与外观，内容全部放在批次里
const seedExhibits=[{id:1,color:'#e6b45d'},{id:2,color:'#ef8f84'},{id:3,color:'#83b9b1'}];
const seedConfirmed=[{id:'B-1',label:'第 1 批',time:'2024-03-02 10:00',items:{
  1:{title:'潮汐之后',room:'A01 · 主展厅',type:'装置',desc:'一件记录海岸线变化的沉浸式影像装置。',audio:'https://example.com/audio.mp3'},
  3:{title:'柔软的边界',room:'C01 · 新媒介',type:'互动',desc:'观众的移动会改变墙面上的光影。',audio:''}}}];
const seedPending={items:{
  2:{title:'未寄出的信',room:'B02 · 纸上时间',type:'档案',desc:'来自三代人的手写信件与声音档案。',audio:''}}};

const blank={title:'',room:'',type:'装置',desc:'',audio:''};
const fieldNames={title:'标题',room:'展厅',type:'类型',desc:'介绍',audio:'语音地址'};
const load=()=>{try{const d=JSON.parse(localStorage.getItem('guide-batches-v1'));if(d&&d.confirmed)return d}catch{}return{exhibits:seedExhibits,confirmed:seedConfirmed,pending:seedPending}};
// 某件展项在给定批次序列中最近确认的内容
const confirmedOf=(batches,id)=>{for(let i=batches.length-1;i>=0;i--){const c=batches[i].items[id];if(c)return c}return null};

function App(){
 const [data,setData]=useState(load);
 const {exhibits,confirmed,pending}=data;
 const [selected,setSelected]=useState(1);
 const [view,setView]=useState('edit');
 const [filter,setFilter]=useState('全部');
 const [form,setForm]=useState({title:'',room:'',type:'装置',desc:'',audio:''});
 const [notice,setNotice]=useState('');
 const [modal,setModal]=useState(null); // 'submit' | 'rollback'
 useEffect(()=>localStorage.setItem('guide-batches-v1',JSON.stringify(data)),[data]);

 const statusOf=id=>pending.items[id]?'待发布':confirmedOf(confirmed,id)?'已发布':'暂未开放';
 const working=id=>pending.items[id]||confirmedOf(confirmed,id)||blank;
 const current=exhibits.find(x=>x.id===selected)||exhibits[0];
 const currentLive=current?confirmedOf(confirmed,current.id):null;
 const pendingIds=Object.keys(pending.items);
 const visible=useMemo(()=>filter==='全部'?exhibits:exhibits.filter(x=>statusOf(x.id)===filter),[exhibits,filter,confirmed,pending]);

 // 编辑只写入待发布批次，访客读不到
 const update=(k,v)=>{const base=pending.items[current.id]||confirmedOf(confirmed,current.id)||blank;
  setData(d=>({...d,pending:{items:{...d.pending.items,[current.id]:{...base,[k]:v}}}}));};
 const add=()=>{if(!form.title.trim())return;const id=Date.now();
  const item={id,color:['#e6b45d','#ef8f84','#83b9b1','#9ba7dc'][exhibits.length%4]};
  setData(d=>({...d,exhibits:[...d.exhibits,item],pending:{items:{...d.pending.items,[id]:{...blank,...form}}}}));
  setSelected(id);setForm({title:'',room:'',type:'装置',desc:'',audio:''});setNotice('已保存到待发布批次，提交并确认后访客可见');};

 // 提交批次：整批成为访客当前内容
 const submitBatch=()=>{const batch={id:'B-'+Date.now(),label:`第 ${confirmed.length+1} 批`,time:new Date().toLocaleString('zh-CN',{hour12:false}),items:pending.items};
  setData(d=>({...d,confirmed:[...d.confirmed,batch],pending:{items:{}}}));
  setModal(null);setNotice(`${batch.label}已确认，${pendingIds.length} 件展项对访客生效`);};
 // 撤回当前批次：整批回退，不能只退一件
 const rollback=()=>{const last=confirmed[confirmed.length-1];
  setData(d=>({...d,confirmed:d.confirmed.slice(0,-1)}));
  setModal(null);setNotice(`已撤回${last.label}，访客内容恢复为上一批`);};

 const exportData=()=>{const live=exhibits.map(x=>({id:x.id,...confirmedOf(confirmed,x.id)})).filter(x=>x.title);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({batches:confirmed,visitorContent:live},null,2)],{type:'application/json'}));a.download='exhibition-guide.json';a.click();setNotice('已导出当前访客可见内容');};

 // 提交确认清单：每件展项列出将变化的字段
 const changeList=pendingIds.map(id=>{const prev=confirmedOf(confirmed,id),next=pending.items[id];
  const fields=prev?Object.keys(fieldNames).filter(k=>prev[k]!==next[k]).map(k=>fieldNames[k]):['新增展项'];
  return{id,title:next.title||'（未命名）',fields};});
 // 撤回影响清单：上一批没有该展项的，撤回后显示暂未开放
 const lastBatch=confirmed[confirmed.length-1];
 const rollbackList=lastBatch?Object.keys(lastBatch.items).map(id=>{const hasPrev=!!confirmedOf(confirmed.slice(0,-1),id);
  return{id,title:lastBatch.items[id].title,hasPrev};}):[];

 const statusBadge=s=><span className={'status '+(s==='已发布'?'live':s==='待发布'?'pending':'closed')}>{s}</span>;

 if(view==='visitor') return <div className="visitor"><header><div className="brand"><span className="mark">M</span><span>潮汐美术馆</span></div><button className="ghost" onClick={()=>setView('edit')}>返回编辑</button></header><main className="visitor-main"><span className="eyebrow">VISITOR GUIDE / 2024</span><h1>沿着作品，<em>走进</em>另一种时间。</h1><p className="lead">当你靠近一件作品，它的故事就开始流动。选择一个展项开始探索。</p><div className="visitor-grid">{exhibits.map(x=>{const live=confirmedOf(confirmed,x.id);
  if(!live)return <article className="visitor-card closed" key={x.id}><div className="art" style={{background:x.color}}><span>{String(x.id).padStart(2,'0')}</span></div><div className="card-meta"><small>暂未开放</small><h3>敬请期待</h3><p>该展项内容尚未发布。</p></div></article>;
  return <article className="visitor-card" key={x.id} onClick={()=>{setSelected(x.id);setView('detail')}}><div className="art" style={{background:x.color}}><span>{String(x.id).padStart(2,'0')}</span><i>↗</i></div><div className="card-meta"><small>{live.room}</small><h3>{live.title}</h3><p>{live.desc}</p></div></article>})}</div></main></div>;

 if(view==='detail'&&current)return <div className="visitor"><header><div className="brand"><span className="mark">M</span><span>潮汐美术馆 · 导览</span></div><button className="ghost" onClick={()=>setView('visitor')}>← 全部展项</button></header>{currentLive?<main className="detail"><div className="detail-art" style={{background:current.color}}><span>{String(current.id).padStart(2,'0')}</span></div><div className="detail-copy"><span className="eyebrow">{currentLive.room} / {currentLive.type}</span><h1>{currentLive.title}</h1><p>{currentLive.desc}</p>{currentLive.audio&&<button className="audio" onClick={()=>setNotice('正在播放导览音频…')}>▶ 播放语音导览</button>}<div className="qr"><div className="qr-box">▦</div><div><strong>分享这个展项</strong><small>扫描二维码，在手机上继续阅读</small></div></div></div></main>:<main className="detail"><div className="detail-copy"><span className="eyebrow">NOT AVAILABLE</span><h1>暂未开放</h1><p>该展项内容尚未发布，请稍后再来。</p></div></main>}{notice&&<div className="toast">{notice}</div>}</div>;

 return <div className="app"><aside><div className="brand"><span className="mark">M</span><span>展览工作台</span></div><div className="side-label">当前项目</div><div className="project"><span className="project-dot"></span><div><strong>潮汐之后</strong><small>2024 春季展</small></div><span>⌄</span></div><nav><button className="active">▧ <span>展项内容</span><b>{exhibits.length}</b></button><button>⌁ <span>展厅动线</span></button><button>◉ <span>二维码</span></button></nav><div className="side-foot"><button>⚙ 设置</button><small>已自动保存 · 刚刚</small></div></aside><main className="workspace"><header className="topbar"><div><span className="eyebrow">EXHIBITION BUILDER</span><h1>展项内容</h1><div className="batch-info"><span>访客当前：{lastBatch?`${lastBatch.label} · ${lastBatch.time}`:'尚未发布任何批次'}</span><span className="dot">·</span><span>待发布批次：{pendingIds.length} 件展项</span></div></div><div className="top-actions"><button className="secondary" onClick={exportData}>↓ 导出 JSON</button><button className="secondary" onClick={()=>setView('visitor')}>◉ 访客预览</button><button className="secondary danger" disabled={!confirmed.length} onClick={()=>setModal('rollback')}>↩ 撤回当前批次</button><button className="primary" disabled={!pendingIds.length} onClick={()=>setModal('submit')}>提交批次{pendingIds.length?`（${pendingIds.length}）`:''} <span>↗</span></button></div></header><div className="content"><section className="list-pane"><div className="list-head"><div><h2>全部展项</h2><span>{exhibits.length} 个展项</span></div><button className="add-btn" onClick={()=>document.querySelector('.form-panel').scrollIntoView({behavior:'smooth'})}>＋ 添加展项</button></div><div className="filters">{['全部','已发布','待发布','暂未开放'].map(x=><button className={filter===x?'selected':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div><div className="exhibit-list">{visible.map(x=><button className={'exhibit-row '+(selected===x.id?'chosen':'')} key={x.id} onClick={()=>setSelected(x.id)}><span className="thumb" style={{background:x.color}}>{String(x.id).padStart(2,'0')}</span><span className="row-copy"><strong>{working(x.id).title||'（未命名）'}</strong><small>{working(x.id).room||'未设置展厅'} · {working(x.id).type}</small></span>{statusBadge(statusOf(x.id))}<span className="chev">›</span></button>)}</div></section><section className="form-panel"><div className="panel-title"><div><span className="eyebrow">EDIT EXHIBIT</span><h2>编辑展项</h2></div>{current&&statusBadge(statusOf(current.id))}</div><div className="banner">修改会先存入<strong>待发布批次</strong>，提交批次并确认后，访客扫码才能看到。</div>{current&&<div className="editor"><label>展项标题<input value={working(current.id).title} onChange={e=>update('title',e.target.value)}/></label><div className="two"><label>所在展厅<input value={working(current.id).room} onChange={e=>update('room',e.target.value)}/></label><label>内容类型<select value={working(current.id).type} onChange={e=>update('type',e.target.value)}><option>装置</option><option>档案</option><option>互动</option><option>绘画</option></select></label></div><label>展项介绍<textarea rows="5" value={working(current.id).desc} onChange={e=>update('desc',e.target.value)}/></label><label>语音导览 URL<input value={working(current.id).audio} placeholder="https://…" onChange={e=>update('audio',e.target.value)}/><small className="hint">访客扫描二维码后可播放</small></label><div className="preview-block"><div className="preview-heading"><span>二维码预览</span><button onClick={()=>setNotice('二维码链接已复制')}>复制链接</button></div><div className="qr-preview"><div className="qr-box big">▦</div><div><strong>展项-{String(current.id).padStart(3,'0')}</strong><small>/guide/{current.id}</small></div></div></div></div>}<div className="new-form"><div className="panel-title"><div><span className="eyebrow">NEW ENTRY</span><h2>快速添加展项</h2></div></div><div className="two"><input placeholder="展项标题" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="展厅编号" value={form.room} onChange={e=>setForm({...form,room:e.target.value})}/></div><textarea placeholder="一句话介绍…" rows="2" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/><button className="primary full" onClick={add}>存入待发布批次</button></div></section></div></main>

 {modal==='submit'&&<div className="modal-mask" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}><span className="eyebrow">CONFIRM BATCH</span><h2>确认提交第 {confirmed.length+1} 批？</h2><p className="modal-sub">确认后，以下 {changeList.length} 件展项将整批成为访客当前内容：</p><ul className="change-list">{changeList.map(c=><li key={c.id}><span className="thumb small" style={{background:(exhibits.find(x=>x.id===c.id)||{}).color}}>{String(c.id).padStart(2,'0')}</span><div><strong>{c.title}</strong><small>{c.fields.join('、')}</small></div></li>)}</ul><div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)}>再检查一下</button><button className="primary" onClick={submitBatch}>确认发布整批</button></div></div></div>}

 {modal==='rollback'&&lastBatch&&<div className="modal-mask" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}><span className="eyebrow">ROLLBACK BATCH</span><h2>撤回{lastBatch.label}？</h2><p className="modal-sub">将整批恢复为上一批内容，不能只退回其中一件。涉及 {rollbackList.length} 件展项：</p><ul className="change-list">{rollbackList.map(c=><li key={c.id}><span className="thumb small" style={{background:(exhibits.find(x=>x.id===c.id)||{}).color}}>{String(c.id).padStart(2,'0')}</span><div><strong>{c.title}</strong><small>{c.hasPrev?'恢复为上一批内容':'上一批没有该展项，撤回后显示「暂未开放」'}</small></div></li>)}</ul><div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)}>取消</button><button className="primary danger-solid" onClick={rollback}>确认撤回整批</button></div></div></div>}

 {notice&&<div className="toast">{notice}</div>}</div>}
createRoot(document.getElementById('root')).render(<App/>);
