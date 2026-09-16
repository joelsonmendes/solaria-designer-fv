const $ = id => document.getElementById(id);
const state = { mode:'ongrid', solar:null, calc:null, diagramPos:{}, selectedAddress:'' };
const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const n = id => Number($(id).value);
const fmt = (v,d=2) => Number.isFinite(v) ? Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
const ceilStd = (v, step=0.5) => Math.ceil(v/step)*step;

function setStatus(msg, type='') { $('locationStatus').className = `status ${type}`; $('locationStatus').textContent = msg; }
function setMode(mode){
  state.mode=mode;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $('batteryFields').classList.toggle('hide',mode==='ongrid');
  $('resultTitle').textContent=`Resultado • ${mode==='ongrid'?'On-grid':mode==='offgrid'?'Off-grid':'Híbrido'}`;
  $('batteryMetricLabel').textContent=mode==='ongrid'?'Geração estimada':'Banco de baterias';
  $('rExtraUnit').textContent=mode==='ongrid'?'kWh/mês':'kWh';
  calculate(); renderDiagram(true);
}

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('solarCriterion').addEventListener('change',()=> $('manualHspWrap').classList.toggle('hide',$('solarCriterion').value!=='manual'));

async function searchAddress(){
  const q=$('address').value.trim(); if(!q) return setStatus('Digite um endereço, cidade ou CEP.','warn');
  const btn=$('searchAddressBtn'); btn.disabled=true; btn.textContent='Buscando...';
  try{
    const r=await fetch(`/api/geocode?q=${encodeURIComponent(q)}`); const data=await r.json();
    if(!r.ok) throw new Error(data.error||'Falha na busca.'); if(!Array.isArray(data)||!data.length) throw new Error('Endereço não encontrado.');
    const p=data[0]; $('lat').value=Number(p.lat).toFixed(6); $('lon').value=Number(p.lon).toFixed(6); state.selectedAddress=p.display_name||q;
    setStatus(`Local encontrado: ${state.selectedAddress}`,'ok'); await fetchSolar();
  }catch(e){setStatus(e.message,'bad')}finally{btn.disabled=false;btn.textContent='Buscar endereço'}
}

async function useLocation(){
  if(!navigator.geolocation) return setStatus('Geolocalização não suportada neste navegador.','bad');
  setStatus('Solicitando localização do dispositivo...');
  navigator.geolocation.getCurrentPosition(async pos=>{
    $('lat').value=pos.coords.latitude.toFixed(6); $('lon').value=pos.coords.longitude.toFixed(6);
    try{
      const r=await fetch(`/api/geocode?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`); const d=await r.json();
      if(r.ok&&d?.display_name){$('address').value=d.display_name;state.selectedAddress=d.display_name;}
    }catch(_){ }
    setStatus('Localização obtida. Consultando irradiação...','ok'); await fetchSolar();
  },err=>setStatus(`Não foi possível obter a localização: ${err.message}`,'bad'),{enableHighAccuracy:true,timeout:12000,maximumAge:300000});
}

async function fetchSolar(){
  const lat=n('lat'),lon=n('lon'); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return setStatus('Latitude e longitude inválidas.','bad');
  const btn=$('solarBtn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>Consultando PVGIS';
  setStatus('Consultando base solar PVGIS 5.3...');
  try{
    const r=await fetch(`/api/solar?lat=${lat}&lon=${lon}`); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Falha no PVGIS.');
    state.solar=d; $('sourcePill').textContent=`${d.source}${d.radiationDatabase?' • '+d.radiationDatabase:''}`;
    setStatus(`Irradiação carregada. HSP média: ${fmt(d.avgHsp,2)} | pior mês: ${fmt(d.worstHsp,2)} kWh/m².dia${d.optimalSlope!=null?` | inclinação ótima PVGIS: ${fmt(d.optimalSlope,0)}°`:''}`,'ok');
    renderSolar(); calculate();
  }catch(e){setStatus(e.message,'bad')}finally{btn.disabled=false;btn.textContent='Buscar irradiação PVGIS'}
}

function renderSolar(){
  const data=state.solar?.monthly||[]; const svg=$('chart'); svg.innerHTML=''; const W=720,H=250,pad={l:42,r:12,t:18,b:34};
  if(!data.length){svg.innerHTML='<text x="20" y="40">Consulte a irradiação para visualizar o gráfico.</text>'; $('monthBody').innerHTML=''; return}
  const max=Math.max(...data.map(x=>x.hsp),1); const plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b; const bw=plotW/data.length*0.62;
  for(let i=0;i<=4;i++){const y=pad.t+plotH*(i/4); const val=max*(1-i/4); svg.insertAdjacentHTML('beforeend',`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="#e2e8f0"/><text x="4" y="${y+4}">${val.toFixed(1)}</text>`)}
  data.forEach((m,i)=>{const slot=plotW/data.length;const x=pad.l+i*slot+(slot-bw)/2;const bh=(m.hsp/max)*plotH;const y=pad.t+plotH-bh;svg.insertAdjacentHTML('beforeend',`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="5" fill="#f58220"><title>${monthNames[i]}: ${m.hsp} HSP</title></rect><text x="${x+bw/2}" y="${H-12}" text-anchor="middle">${monthNames[i]}</text>`)});
  $('monthBody').innerHTML=data.map((m,i)=>`<tr><td>${monthNames[i]}</td><td>${fmt(m.irradiation,1)} kWh/m².mês</td><td>${fmt(m.hsp,2)}</td><td>${m.temperature==null?'—':fmt(m.temperature,1)+' °C'}</td></tr>`).join('');
}

function selectedHsp(){
  const c=$('solarCriterion').value; if(c==='manual') return Math.max(.1,n('manualHsp'));
  if(!state.solar) return Math.max(.1,n('manualHsp'));
  return c==='worst' ? state.solar.worstHsp : state.solar.avgHsp;
}

function calcStrings(modules){
  const voc=n('moduleVoc'),vmp=n('moduleVmp'),isc=n('moduleIsc'),coeff=n('vocCoeff')/100,tmin=n('tmin'),vmax=n('invVmax'),mpptMin=n('mpptMin'),mpptMax=n('mpptMax'),iMax=n('mpptCurrent');
  const vocCold=voc*(1+coeff*(tmin-25));
  const maxSeriesByVdc=Math.floor(vmax/Math.max(vocCold,1));
  const maxSeriesByMppt=Math.floor(mpptMax/Math.max(vmp,1));
  const maxSeries=Math.max(1,Math.min(maxSeriesByVdc,maxSeriesByMppt));
  const minSeries=Math.max(1,Math.ceil(mpptMin/Math.max(vmp,1)));
  let series=Math.min(maxSeries,Math.max(minSeries,Math.ceil(Math.sqrt(modules))));
  if(series>modules) series=modules;
  let parallel=Math.ceil(modules/Math.max(series,1));
  const maxParallelByCurrent=Math.max(1,Math.floor(iMax/Math.max(isc*1.25,0.1)));
  return {vocCold,maxSeries,minSeries,series,parallel,maxParallelByCurrent,stringVoltage:series*vmp,stringVocCold:series*vocCold,stringCurrent:parallel*isc};
}

function calculate(){
  const monthly=Math.max(1,n('monthlyKwh')), daily=monthly/30.4375, pr=Math.min(.99,Math.max(.5,n('pr'))), margin=1+Math.max(0,n('margin'))/100, hsp=Math.max(.1,selectedHsp()), moduleWp=Math.max(1,n('moduleWp')), peak=Math.max(.1,n('peakKw'));
  let pvKw=(daily/(hsp*pr))*margin; let modules=Math.ceil(pvKw*1000/moduleWp); const actualPv=modules*moduleWp/1000;
  let invKw=ceilStd(Math.max(peak,actualPv/Math.max(.7,n('dcac'))),.5); let batteryKwh=0,batteryAh=0,batteryUnits=0;
  if(state.mode==='offgrid'){
    const autonomyDays=Math.max(1,n('autonomyHours'))/24; const dod=Math.max(.1,n('dod')),eff=Math.max(.5,n('batteryEff'));
    batteryKwh=daily*autonomyDays/(dod*eff)*margin; batteryAh=batteryKwh*1000/Math.max(12,n('bankVoltage')); batteryUnits=Math.ceil(batteryKwh/Math.max(.1,n('batteryUnitKwh')));
    pvKw=(daily/(hsp*pr))*margin; modules=Math.ceil(pvKw*1000/moduleWp); invKw=ceilStd(peak*1.25,.5);
  }
  if(state.mode==='hybrid'){
    const essential=daily*Math.min(1,Math.max(.01,n('essentialPct')/100)); const fraction=Math.min(1,Math.max(1,n('autonomyHours'))/24); const dod=Math.max(.1,n('dod')),eff=Math.max(.5,n('batteryEff'));
    batteryKwh=essential*fraction/(dod*eff)*margin; batteryAh=batteryKwh*1000/Math.max(12,n('bankVoltage')); batteryUnits=Math.ceil(batteryKwh/Math.max(.1,n('batteryUnitKwh')));
    invKw=ceilStd(Math.max(peak*1.15,actualPv/Math.max(.7,n('dcac'))),.5);
  }
  const pvInstalled=modules*moduleWp/1000; const generation=pvInstalled*hsp*pr*30.4375; const str=calcStrings(modules);
  state.calc={monthly,daily,pr,margin,hsp,modules,pvInstalled,invKw,batteryKwh,batteryAh,batteryUnits,generation,str};
  $('rPv').textContent=fmt(pvInstalled,2); $('rModules').textContent=modules; $('rInv').textContent=fmt(invKw,1);
  if(state.mode==='ongrid') $('rExtra').textContent=fmt(generation,0); else $('rExtra').textContent=fmt(batteryKwh,1);
  $('resultSubtitle').textContent=`HSP adotada: ${fmt(hsp,2)} kWh/m².dia • PR: ${fmt(pr,2)} • Consumo: ${fmt(monthly,0)} kWh/mês`;
  renderAlerts(); renderDiagram();
}

function renderAlerts(){
  const c=state.calc;if(!c)return;const a=[];const s=c.str;
  a.push({t:'ok',m:`Gerador calculado em ${fmt(c.pvInstalled,2)} kWp com ${c.modules} módulos de ${fmt(n('moduleWp'),0)} Wp.`});
  if(!state.solar&&$('solarCriterion').value!=='manual') a.push({t:'warn',m:'PVGIS ainda não foi consultado; o cálculo está usando a HSP manual como contingência.'});
  if(s.minSeries>s.maxSeries) a.push({t:'bad',m:`Janela MPPT incompatível com os dados informados: mínimo calculado ${s.minSeries} módulos/série e máximo ${s.maxSeries}.`});
  else a.push({t:'ok',m:`Faixa preliminar por string: ${s.minSeries} a ${s.maxSeries} módulos em série. Configuração automática atual: ${s.series}S × ${s.parallel}P.`});
  if(s.parallel>s.maxParallelByCurrent) a.push({t:'warn',m:`A configuração ${s.parallel} strings em paralelo pode exceder a corrente de entrada informada. Limite preliminar pela corrente: ${s.maxParallelByCurrent} string(s) por entrada/MPPT; distribua entre MPPTs.`});
  if(state.mode!=='ongrid') a.push({t:'ok',m:`Banco nominal estimado: ${fmt(c.batteryKwh,1)} kWh (${fmt(c.batteryAh,0)} Ah em ${n('bankVoltage')} V), aproximadamente ${c.batteryUnits} unidade(s) de ${fmt(n('batteryUnitKwh'),2)} kWh.`});
  a.push({t:'warn',m:'Proteções, cabos, DPS, aterramento e conexão à rede devem ser fechados com os dados reais de curto-circuito, temperatura, método de instalação e exigências da distribuidora.'});
  $('alerts').innerHTML=a.map(x=>`<div class="alert ${x.t}">${x.m}</div>`).join('');
  $('electricalSummary').innerHTML=[
    `<b>Configuração FV:</b> ${s.series} módulos em série × ${s.parallel} string(s) em paralelo`,
    `<b>Vmpp estimada da string:</b> ${fmt(s.stringVoltage,1)} V`,
    `<b>Voc corrigida a ${fmt(n('tmin'),0)} °C:</b> ${fmt(s.stringVocCold,1)} V`,
    `<b>Corrente total preliminar:</b> ${fmt(s.stringCurrent,1)} A`,
    `<b>Inversor sugerido:</b> ${fmt(c.invKw,1)} kW`,
    state.mode==='ongrid'?`<b>Geração mensal estimada:</b> ${fmt(c.generation,0)} kWh/mês`:`<b>Banco de baterias:</b> ${fmt(c.batteryKwh,1)} kWh`
  ].join('<br>');
}

const layouts={
  ongrid:{pv:[60,145],prot:[240,145],inv:[430,145],ac:[620,145],grid:[810,75],load:[810,230]},
  offgrid:{pv:[55,110],prot:[230,110],charger:[410,110],bat:[410,260],inv:[610,110],load:[810,110]},
  hybrid:{pv:[55,110],prot:[230,110],inv:[430,110],bat:[430,270],ac:[630,110],grid:[820,55],load:[820,210]}
};
function node(id,x,y,w,h,title,sub){return `<g class="node" data-id="${id}" transform="translate(${x},${y})"><rect width="${w}" height="${h}"/><text x="${w/2}" y="27" text-anchor="middle">${esc(title)}</text><text x="${w/2}" y="49" text-anchor="middle" style="font-size:11px;fill:#66758a;font-weight:600">${esc(sub||'')}</text></g>`}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function wire(x1,y1,x2,y2,cls=''){return `<path class="wire ${cls}" d="M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}" marker-end="url(#arrow)"/>`}
function renderDiagram(reset=false){
  if(!state.calc) return; const c=state.calc,svg=$('diagram'); const mode=state.mode; if(reset||!state.diagramPos[mode]) state.diagramPos[mode]=JSON.parse(JSON.stringify(layouts[mode])); const p=state.diagramPos[mode];
  const labels={pv:$('labelPv').value,inv:$('labelInv').value,prot:$('labelProt').value};
  let html=`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#314b6b"/></marker></defs>`;
  if(mode==='ongrid'){
    html+=wire(p.pv[0]+145,p.pv[1]+35,p.prot[0],p.prot[1]+35,'dc')+wire(p.prot[0]+150,p.prot[1]+35,p.inv[0],p.inv[1]+35,'dc')+wire(p.inv[0]+155,p.inv[1]+35,p.ac[0],p.ac[1]+35,'ac')+wire(p.ac[0]+150,p.ac[1]+35,p.grid[0],p.grid[1]+35,'ac')+wire(p.ac[0]+150,p.ac[1]+35,p.load[0],p.load[1]+35,'ac');
    html+=node('pv',...p.pv,145,70,labels.pv,`${c.modules}×${n('moduleWp')} W • ${fmt(c.pvInstalled,2)} kWp`)+node('prot',...p.prot,150,70,labels.prot,$('spdLabel').value)+node('inv',...p.inv,155,70,labels.inv,`${fmt(c.invKw,1)} kW • ${c.str.series}S×${c.str.parallel}P`)+node('ac',...p.ac,150,70,'Quadro CA',$('breakerAc').value)+node('grid',...p.grid,145,70,'Medição / Rede','Concessionária')+node('load',...p.load,145,70,'QGBT / Cargas',$('cableLabel').value);
  } else if(mode==='offgrid'){
    html+=wire(p.pv[0]+145,p.pv[1]+35,p.prot[0],p.prot[1]+35,'dc')+wire(p.prot[0]+150,p.prot[1]+35,p.charger[0],p.charger[1]+35,'dc')+wire(p.charger[0]+150,p.charger[1]+35,p.inv[0],p.inv[1]+35,'dc')+wire(p.charger[0]+75,p.charger[1]+70,p.bat[0]+75,p.bat[1],'bat')+wire(p.bat[0]+150,p.bat[1]+35,p.inv[0]+75,p.inv[1]+70,'bat')+wire(p.inv[0]+155,p.inv[1]+35,p.load[0],p.load[1]+35,'ac');
    html+=node('pv',...p.pv,145,70,labels.pv,`${c.modules}×${n('moduleWp')} W`)+node('prot',...p.prot,150,70,'Proteção CC',$('spdLabel').value)+node('charger',...p.charger,150,70,'Controlador MPPT',`${c.str.series}S×${c.str.parallel}P`)+node('bat',...p.bat,150,70,'Banco de baterias',`${fmt(c.batteryKwh,1)} kWh • ${n('bankVoltage')} V`)+node('inv',...p.inv,155,70,labels.inv,`${fmt(c.invKw,1)} kW`)+node('load',...p.load,145,70,'Quadro de cargas',$('breakerAc').value);
  } else {
    html+=wire(p.pv[0]+145,p.pv[1]+35,p.prot[0],p.prot[1]+35,'dc')+wire(p.prot[0]+150,p.prot[1]+35,p.inv[0],p.inv[1]+35,'dc')+wire(p.bat[0]+75,p.bat[1],p.inv[0]+75,p.inv[1]+70,'bat')+wire(p.inv[0]+155,p.inv[1]+35,p.ac[0],p.ac[1]+35,'ac')+wire(p.ac[0]+150,p.ac[1]+35,p.grid[0],p.grid[1]+35,'ac')+wire(p.ac[0]+150,p.ac[1]+35,p.load[0],p.load[1]+35,'ac');
    html+=node('pv',...p.pv,145,70,labels.pv,`${c.modules}×${n('moduleWp')} W • ${fmt(c.pvInstalled,2)} kWp`)+node('prot',...p.prot,150,70,'Proteções CC',$('spdLabel').value)+node('inv',...p.inv,155,70,'Inversor híbrido',`${fmt(c.invKw,1)} kW • ${c.str.series}S×${c.str.parallel}P`)+node('bat',...p.bat,150,70,'Banco de baterias',`${fmt(c.batteryKwh,1)} kWh • ${n('bankVoltage')} V`)+node('ac',...p.ac,150,70,'QGBT / ATS',$('breakerAc').value)+node('grid',...p.grid,145,70,'Rede elétrica','Bidirecional')+node('load',...p.load,145,70,'Cargas críticas',$('cableLabel').value);
  }
  svg.innerHTML=html; attachDrag();
}

function attachDrag(){
  const svg=$('diagram');let drag=null,offset={x:0,y:0};
  const point=e=>{const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(svg.getScreenCTM().inverse())};
  svg.querySelectorAll('.node').forEach(g=>g.addEventListener('pointerdown',e=>{e.preventDefault();drag=g;g.setPointerCapture(e.pointerId);const p=point(e);const t=g.transform.baseVal.consolidate().matrix;offset={x:p.x-t.e,y:p.y-t.f};g.classList.add('active')}));
  svg.addEventListener('pointermove',e=>{if(!drag)return;const q=point(e);const id=drag.dataset.id;state.diagramPos[state.mode][id]=[Math.max(0,q.x-offset.x),Math.max(0,q.y-offset.y)];drag.setAttribute('transform',`translate(${state.diagramPos[state.mode][id][0]},${state.diagramPos[state.mode][id][1]})`)});
  svg.addEventListener('pointerup',()=>{if(drag){drag.classList.remove('active');drag=null;renderDiagram()}});
}

function saveProject(){
  const ids=['projectName','address','lat','lon','monthlyKwh','peakKw','pr','margin','solarCriterion','manualHsp','moduleWp','moduleVoc','moduleVmp','moduleIsc','moduleImp','vocCoeff','invVmax','mpptMin','mpptMax','mpptCurrent','tmin','dcac','autonomyHours','essentialPct','dod','batteryEff','bankVoltage','batteryUnitKwh','labelPv','labelInv','labelProt','breakerAc','spdLabel','cableLabel'];
  const payload={version:1,mode:state.mode,values:Object.fromEntries(ids.map(id=>[id,$(id).value])),solar:state.solar,diagramPos:state.diagramPos};
  localStorage.setItem('solaria-project',JSON.stringify(payload)); setStatus('Projeto salvo neste dispositivo.','ok');
}
function loadProject(){
  try{const raw=localStorage.getItem('solaria-project');if(!raw)return;const p=JSON.parse(raw);Object.entries(p.values||{}).forEach(([id,v])=>{if($(id))$(id).value=v});state.solar=p.solar||null;state.diagramPos=p.diagramPos||{};setMode(p.mode||'ongrid');renderSolar();if(state.solar)$('sourcePill').textContent=`${state.solar.source}${state.solar.radiationDatabase?' • '+state.solar.radiationDatabase:''}`;}catch(_){ }
}
function exportSvg(){
  const svg=$('diagram').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${($('projectName').value||'unifilar').replace(/[^a-z0-9_-]+/gi,'_')}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

['monthlyKwh','peakKw','pr','margin','manualHsp','moduleWp','moduleVoc','moduleVmp','moduleIsc','moduleImp','vocCoeff','invVmax','mpptMin','mpptMax','mpptCurrent','tmin','dcac','autonomyHours','essentialPct','dod','batteryEff','bankVoltage','batteryUnitKwh'].forEach(id=>$(id).addEventListener('input',calculate));
['labelPv','labelInv','labelProt','breakerAc','spdLabel','cableLabel'].forEach(id=>$(id).addEventListener('input',()=>renderDiagram()));
$('searchAddressBtn').addEventListener('click',searchAddress);$('geoBtn').addEventListener('click',useLocation);$('solarBtn').addEventListener('click',fetchSolar);$('calcBtn').addEventListener('click',calculate);$('saveBtn').addEventListener('click',saveProject);$('printBtn').addEventListener('click',()=>window.print());$('exportSvgBtn').addEventListener('click',exportSvg);$('resetDiagramBtn').addEventListener('click',()=>renderDiagram(true));
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
loadProject();calculate();renderSolar();
