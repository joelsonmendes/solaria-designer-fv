const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];

const state = {
  step: 0,
  mode: 'ongrid',
  solar: null,
  pvSim: null,
  pvSimSig: null,
  offgridSim: null,
  calc: null,
  diagramPos: {},
  selectedAddress: '',
  alerts: [],
  savingTimer: null
};

const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const monthLong = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const stdCable = [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300,400];
const stdCurrent = [2,4,6,10,12,16,20,25,32,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000];
const stdBreaking = [3,4.5,6,10,15,18,25,36,50,70,100];
const lossDefs = [
  ['lossTemp','Temperatura',6],
  ['lossSoiling','Sujeira',3],
  ['lossMismatch','Mismatch',2],
  ['lossDc','Cabos CC',1.5],
  ['lossInverter','Conversão/inversor',2],
  ['lossAc','Cabos CA',1],
  ['lossAvailability','Disponibilidade',0.5],
  ['lossOther','Outras',1]
];

const num = id => Number($(id)?.value ?? 0);
const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
const fmt = (v,d=2) => Number.isFinite(v) ? Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
const fmt0 = v => fmt(v,0);
const ceilStep = (v,step=.5) => Math.ceil(v/step)*step;
const nextStd = (v,list) => list.find(x=>x>=v) ?? Math.ceil(v/10)*10;
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function toast(message){
  const el=$('toast'); if(!el) return;
  el.textContent=message; el.classList.add('show');
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2400);
}

function setStatus(message,type=''){
  const el=$('locationStatus');
  el.className=`status ${type}`.trim();
  el.textContent=message;
}

function buildConsumptionGrid(){
  $('consumptionGrid').innerHTML=monthNames.map((m,i)=>`<div class="month-input"><label>${m}</label><input id="cons${i}" class="consumption-month" type="number" min="0" step="1" value="600" aria-label="Consumo de ${monthLong[i]} em kWh"/></div>`).join('');
}

function buildLossFields(){
  $('lossFields').innerHTML=lossDefs.map(([id,label,val])=>`<div class="loss-card"><label for="${id}">${label}</label><div class="loss-input"><input id="${id}" type="number" min="0" max="50" step="0.1" value="${val}"/><span>%</span></div></div>`).join('');
}

function buildMobileSteps(){
  const names=['Projeto','Energia','Layout','Equipamentos','Bateria','Elétrico','Financeiro','Resultados'];
  $('mobileSteps').innerHTML=names.map((x,i)=>`<button class="mobile-step ${i===0?'active':''}" data-step="${i}">${i+1}. ${x}</button>`).join('');
}

function setStep(step,scroll=true){
  state.step=clamp(Number(step)||0,0,7);
  $$('.step-panel').forEach(p=>p.classList.toggle('active',Number(p.dataset.stepPanel)===state.step));
  $$('.step-link').forEach((b,i)=>{b.classList.toggle('active',i===state.step);b.classList.toggle('done',i<state.step)});
  $$('.mobile-step').forEach((b,i)=>{b.classList.toggle('active',i===state.step);b.classList.toggle('done',i<state.step)});
  const pct=Math.round((state.step+1)/8*100);
  $('progressText').textContent=`Etapa ${state.step+1} de 8`;
  $('progressPct').textContent=`${pct}%`;
  $('progressBar').style.width=`${pct}%`;
  $('prevStep').disabled=state.step===0;
  $('nextStep').textContent=state.step===7?'Voltar ao início':'Próxima etapa';
  if(state.step===7){ calculate(); renderDiagram(); }
  if(scroll) window.scrollTo({top:0,behavior:'smooth'});
}

function setMode(mode){
  state.mode=mode;
  $$('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const ongrid=mode==='ongrid';
  $('batteryNotice').textContent=ongrid
    ? 'No modo on-grid puro, o banco de baterias não entra no dimensionamento principal. Troque para Híbrido para considerar backup/autoconsumo com armazenamento.'
    : mode==='offgrid'
      ? 'No off-grid, o cálculo considera atendimento integral da carga de projeto, autonomia, DoD e potência mínima do banco.'
      : 'No híbrido, o banco atende a parcela definida como cargas essenciais durante o período de autonomia.';
  $('offgridSimBtn').disabled=ongrid;
  invalidateDetailedSimulation();
  calculate();
}

function invalidateDetailedSimulation(){
  state.pvSim=null; state.pvSimSig=null;
  $('simulationSource').textContent='estimativa interna';
}

function getConsumption(){
  return monthNames.map((_,i)=>Math.max(0,num(`cons${i}`)));
}

function getPR(){
  if(!$('advancedLosses').checked) return clamp(num('manualPr')||.8,.4,.98);
  let pr=1;
  lossDefs.forEach(([id])=>{ pr*=1-clamp(num(id),0,80)/100; });
  pr*=1-clamp(num('shadeLoss'),0,80)/100;
  return clamp(pr,.4,.98);
}

function getLossTotalEquivalent(){
  return (1-getPR())*100;
}

function getPvgisAdditionalLoss(){
  // PVGIS já trata efeitos físicos de temperatura/irradiância. Para evitar dupla contagem,
  // enviamos apenas perdas adicionais de projeto informadas pelo usuário.
  const ids=['lossSoiling','lossMismatch','lossDc','lossAc','lossAvailability','lossOther'];
  const vals=ids.map(id=>clamp(num(id),0,50));
  vals.push(clamp(num('shadeLoss'),0,50));
  const product=vals.reduce((p,l)=>p*(1-l/100),1);
  return clamp((1-product)*100,0,60);
}

function compassToPvgisAspect(compass){
  let a=((Number(compass)%360)+360)%360;
  let p=a-180;
  if(p>180)p-=360;
  if(p<-180)p+=360;
  return p;
}

function selectedSolarValues(){
  const manual=Math.max(.1,num('manualHsp')||4.5);
  if(!state.solar){
    const irradiation=manual*365.25;
    return {annualIrradiation:irradiation,avgHsp:manual,worstHsp:manual*.82,monthly:null};
  }
  return state.solar;
}

async function searchAddress(){
  const q=$('address').value.trim();
  if(!q) return setStatus('Digite um endereço, cidade ou CEP.','warn');
  const btn=$('searchAddressBtn'); btn.disabled=true; btn.textContent='Buscando…';
  try{
    const r=await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||'Falha na geocodificação.');
    if(!Array.isArray(data)||!data.length) throw new Error('Nenhum endereço encontrado.');
    renderCandidates(data);
    const p=data[0];
    selectAddressCandidate(p,false);
    setStatus(`${data.length} resultado(s) encontrado(s). Confirme o local ou escolha uma alternativa abaixo.`,'ok');
  }catch(e){setStatus(e.message,'bad')}
  finally{btn.disabled=false;btn.textContent='Buscar'}
}

function renderCandidates(list){
  const el=$('addressCandidates');
  el.innerHTML=list.slice(0,5).map((p,i)=>`<button class="candidate" data-candidate="${i}">${esc(p.display_name||'Local encontrado')}</button>`).join('');
  el.classList.remove('hide');
  el._data=list.slice(0,5);
  el.querySelectorAll('[data-candidate]').forEach(b=>b.addEventListener('click',()=>{
    const p=el._data[Number(b.dataset.candidate)]; selectAddressCandidate(p,true);
  }));
}

function selectAddressCandidate(p,fetchNow=true){
  $('lat').value=Number(p.lat).toFixed(6); $('lon').value=Number(p.lon).toFixed(6);
  $('address').value=p.display_name||$('address').value;
  state.selectedAddress=p.display_name||$('address').value;
  $('addressCandidates').classList.add('hide');
  if(fetchNow) fetchSolar();
}

async function useLocation(){
  if(!navigator.geolocation) return setStatus('Este navegador não disponibiliza geolocalização.','bad');
  setStatus('Solicitando a localização do dispositivo…');
  navigator.geolocation.getCurrentPosition(async pos=>{
    $('lat').value=pos.coords.latitude.toFixed(6); $('lon').value=pos.coords.longitude.toFixed(6);
    try{
      const r=await fetch(`/api/geocode?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      const d=await r.json();
      if(r.ok&&d?.display_name){$('address').value=d.display_name;state.selectedAddress=d.display_name;}
    }catch(_){ }
    setStatus('Localização obtida. Carregando dados solares…','ok');
    await fetchSolar();
  },err=>setStatus(`Não foi possível obter a localização: ${err.message}`,'bad'),{enableHighAccuracy:true,timeout:12000,maximumAge:300000});
}

async function fetchSolar(){
  const lat=num('lat'),lon=num('lon');
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180) return setStatus('Latitude/longitude inválidas.','bad');
  const source=$('solarSource').value;
  const endpoint=source==='nasa'?'/api/nasa':'/api/solar';
  const btn=$('solarBtn'); btn.disabled=true; btn.textContent=source==='nasa'?'Consultando NASA POWER…':'Consultando PVGIS…';
  setStatus(`Consultando ${source==='nasa'?'NASA POWER':'PVGIS 5.3'}…`);
  try{
    const r=await fetch(`${endpoint}?lat=${lat}&lon=${lon}`);
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'Falha na base solar.');
    state.solar=d; invalidateDetailedSimulation();
    $('sourcePill').textContent=`${d.source}${d.radiationDatabase?' • '+d.radiationDatabase:''}`;
    $('solarAvg').textContent=fmt(d.avgHsp,2); $('solarWorst').textContent=fmt(d.worstHsp,2); $('solarAnnual').textContent=fmt0(d.annualIrradiation); $('solarTilt').textContent=d.optimalSlope==null?'—':fmt(d.optimalSlope,0);
    $('meteoRange').textContent=d.yearMin&&d.yearMax?`${d.yearMin}–${d.yearMax}`:(d.period||d.source);
    setStatus(`Dados carregados. HSP média ${fmt(d.avgHsp,2)} e pior mês ${fmt(d.worstHsp,2)} kWh/m².dia.`,'ok');
    renderSolarChart(); calculate(); scheduleSave();
  }catch(e){
    setStatus(`${e.message} Você pode continuar com a HSP manual.`,'bad');
  }finally{btn.disabled=false;btn.textContent='Carregar dados solares'}
}

function calcRoof(requiredModules=0){
  const rw=Math.max(.1,num('roofWidth')),rh=Math.max(.1,num('roofHeight')),set=Math.max(0,num('roofSetback')),gap=Math.max(0,num('moduleGap'));
  let mw=Math.max(.1,num('moduleWidth')),mh=Math.max(.1,num('moduleHeight'));
  if($('moduleOrientation').value==='landscape') [mw,mh]=[mh,mw];
  const uw=Math.max(0,rw-2*set),uh=Math.max(0,rh-2*set);
  const cols=Math.max(0,Math.floor((uw+gap)/(mw+gap))),rows=Math.max(0,Math.floor((uh+gap)/(mh+gap)));
  const geom=cols*rows,manual=Math.max(0,Math.floor(num('manualRoofLimit')));
  const maxModules=manual>0?manual:geom;
  const area=rw*rh, moduleArea=num('moduleWidth')*num('moduleHeight');
  return {rw,rh,set,gap,mw,mh,uw,uh,cols,rows,geom,maxModules,area,moduleArea,requiredModules,fit:requiredModules<=maxModules};
}

function autoString(minModules){
  const voc=Math.max(.1,num('moduleVoc')),vmp=Math.max(.1,num('moduleVmp')),imp=Math.max(.01,num('moduleImp'));
  const vocCoeff=num('vocCoeff')/100,vmpCoeff=num('vmpCoeff')/100,tmin=num('tmin'),tmax=num('tcellMax');
  const vmax=Math.max(1,num('invVmax')),mpptMin=Math.max(1,num('mpptMin')),mpptMax=Math.max(mpptMin,num('mpptMax'));
  const mpptCurrent=Math.max(.1,num('mpptCurrent')),mpptCount=Math.max(1,Math.floor(num('mpptCount')));
  const vocCold=voc*(1+vocCoeff*(tmin-25));
  const vmpCold=vmp*(1+vmpCoeff*(tmin-25));
  const vmpHot=vmp*(1+vmpCoeff*(tmax-25));
  const maxSeriesVdc=Math.floor(vmax/vocCold);
  const maxSeriesMppt=Math.floor(mpptMax/vmpCold);
  const maxSeries=Math.max(1,Math.min(maxSeriesVdc,maxSeriesMppt));
  const minSeries=Math.max(1,Math.ceil(mpptMin/vmpHot));
  const maxParPerMppt=Math.max(1,Math.floor(mpptCurrent/imp));
  let best=null, fallback=null;
  const searchLimit=Math.max(maxSeries*2,30);
  for(let extra=0;extra<=searchLimit;extra++){
    const m=Math.max(1,Math.ceil(minModules)+extra);
    for(let s=minSeries;s<=maxSeries;s++){
      if(m%s!==0) continue;
      const strings=m/s,perMppt=Math.ceil(strings/mpptCount),current=perMppt*imp;
      const score=extra*100+Math.abs(s-(minSeries+maxSeries)/2)+perMppt*.1;
      const cand={modules:m,extra,series:s,strings,perMppt,current,currentOk:perMppt<=maxParPerMppt};
      if(!fallback||score<fallback.score) fallback={...cand,score};
      if(cand.currentOk&&(!best||score<best.score)) best={...cand,score};
    }
    if(best&&extra>best.extra+2) break;
  }
  const chosen=best||fallback||{modules:minModules,extra:0,series:Math.min(Math.max(minSeries,1),Math.max(maxSeries,1)),strings:1,perMppt:1,current:imp,currentOk:false};
  return {
    ...chosen,vocCold,vmpCold,vmpHot,minSeries,maxSeries,maxSeriesVdc,maxSeriesMppt,maxParPerMppt,
    stringVmp:chosen.series*vmp,stringVocCold:chosen.series*vocCold,stringVmpHot:chosen.series*vmpHot,stringVmpCold:chosen.series*vmpCold
  };
}

function computeBattery(annualConsumption,peakKw){
  if(state.mode==='ongrid') return {requiredNominal:0,units:0,actualNominal:0,usable:0,ah:0,backupHours:0,powerUnits:0,loadPct:0,criticalDaily:0};
  const daily=annualConsumption/365.25;
  const loadPct=state.mode==='offgrid'?1:clamp(num('essentialPct')/100,.01,1);
  const criticalDaily=daily*loadPct;
  const autonomy=Math.max(1,num('autonomyHours'));
  const dod=clamp(num('dod'),.1,1),eff=clamp(num('batteryEff'),.5,1),margin=1+Math.max(0,num('batteryMargin'))/100;
  const requiredNominal=criticalDaily*(autonomy/24)/(dod*eff)*margin;
  const unitKwh=Math.max(.1,num('batteryUnitKwh')),unitKw=Math.max(.1,num('batteryUnitKw'));
  const energyUnits=Math.ceil(requiredNominal/unitKwh);
  const criticalPeak=peakKw*loadPct;
  const powerUnits=Math.ceil(criticalPeak/unitKw);
  const units=Math.max(energyUnits,powerUnits,1);
  const actualNominal=units*unitKwh,usable=actualNominal*dod*eff;
  const backupHours=criticalDaily>0?usable/criticalDaily*24:0;
  const ah=actualNominal*1000/Math.max(12,num('bankVoltage'));
  return {requiredNominal,energyUnits,powerUnits,units,actualNominal,usable,backupHours,ah,loadPct,criticalDaily,criticalPeak};
}

function computeElectrical(calc){
  const phases=Math.max(1,Number($('phases').value)),v=Math.max(1,num('acVoltage')),pf=clamp(num('acPf'),.5,1),invEff=clamp(num('invEff'),.8,1);
  const acI=phases===3?(calc.invKw*1000)/(Math.sqrt(3)*v*pf*invEff):(calc.invKw*1000)/(v*pf*invEff);
  const factor=clamp(num('protectionFactor'),1,2);
  const breaker=nextStd(acI*factor,stdCurrent);
  const rho=$('conductor').value==='aluminum'?0.0282:0.0175;
  const dcI=Math.max(.1,num('moduleIsc'))*1.25;
  const dcV=Math.max(1,calc.str.stringVmp);
  const dcDropV=dcV*clamp(num('dcDropPct'),.1,10)/100;
  const dcSectionCalc=(2*rho*Math.max(1,num('dcLength'))*dcI)/dcDropV;
  const dcSection=nextStd(dcSectionCalc,stdCable);
  const acDropV=v*clamp(num('acDropPct'),.1,10)/100;
  const acFactor=phases===3?Math.sqrt(3):2;
  const acSectionCalc=(acFactor*rho*Math.max(1,num('acLength'))*acI)/acDropV;
  const acSection=nextStd(acSectionCalc,stdCable);
  const stringFuse=nextStd(num('moduleIsc')*1.25,stdCurrent);
  const moduleMaxFuse=Math.max(1,num('moduleMaxFuse'));
  const perMpptStrings=calc.str.perMppt;
  const dcSwitch=nextStd(num('moduleIsc')*1.25*perMpptStrings,stdCurrent);
  const icc=Math.max(0,num('availableIcc'));
  const breaking=icc>0?nextStd(icc,stdBreaking):null;
  const spd=$('hasSpda').value==='yes'?'Tipo 1+2 (avaliar coordenação com SPDA)':'Tipo 2 (confirmar análise de risco/instalação)';
  return {phases,v,pf,acI,breaker,rho,dcI,dcV,dcSectionCalc,dcSection,acSectionCalc,acSection,stringFuse,moduleMaxFuse,dcSwitch,icc,breaking,spd};
}

function computeFinance(calc){
  const pvCost=calc.pvInstalled*Math.max(0,num('costPerKwp'));
  const batteryCost=calc.battery.actualNominal*Math.max(0,num('costPerBatteryKwh'));
  const capex=pvCost+batteryCost+Math.max(0,num('fixedBos'));
  const tariff=Math.max(0,num('energyTariff')),self=clamp(num('selfConsumptionPct')/100,0,1),exportVal=clamp(num('exportValuePct')/100,0,1);
  const escalation=num('tariffEscalation')/100,degradation=clamp(num('degradation')/100,0,.1),discount=num('discountRate')/100,omPct=Math.max(0,num('omPct'))/100;
  const life=clamp(Math.round(num('projectLife')||25),5,40),minBill=Math.max(0,num('minimumBill'))*12;
  const preBill=calc.annualConsumption*tariff;
  const flows=[]; let cumulative=-capex,payback=null,npv=-capex,pvEnergy=0,pvCostDisc=capex;
  for(let y=1;y<=life;y++){
    const gen=calc.annualGeneration*Math.pow(1-degradation,y-1);
    const useful=Math.min(gen,calc.annualConsumption);
    const valueFactor=state.mode==='offgrid'?1:(self+(1-self)*exportVal);
    const energyValue=useful*tariff*Math.pow(1+escalation,y-1)*valueFactor;
    const maxSaving=Math.max(0,preBill*Math.pow(1+escalation,y-1)-minBill);
    const savings=Math.min(energyValue,maxSaving||energyValue);
    const om=capex*omPct;
    const flow=savings-om;
    flows.push(flow); cumulative+=flow;
    if(payback===null&&cumulative>=0){
      const prev=cumulative-flow; payback=(y-1)+(-prev/Math.max(flow,.0001));
    }
    const disc=Math.pow(1+discount,y);
    npv+=flow/disc; pvEnergy+=gen/disc; pvCostDisc+=om/disc;
  }
  const irr=calcIRR(capex,flows);
  const lcoe=pvEnergy>0?pvCostDisc/pvEnergy:null;
  const year1=flows[0]??0;
  return {pvCost,batteryCost,capex,year1,payback,npv,irr,lcoe,flows,life,preBill};
}

function calcIRR(capex,flows){
  if(capex<=0||!flows.some(x=>x>0)) return null;
  const f=r=>-capex+flows.reduce((s,cf,i)=>s+cf/Math.pow(1+r,i+1),0);
  let lo=-.9,hi=2,fl=f(lo),fh=f(hi);
  if(fl*fh>0) return null;
  for(let i=0;i<80;i++){
    const mid=(lo+hi)/2,fm=f(mid);
    if(Math.abs(fm)<1e-6) return mid;
    if(fl*fm<=0){hi=mid;fh=fm}else{lo=mid;fl=fm}
  }
  return (lo+hi)/2;
}

function calculate(){
  const consumption=getConsumption();
  const annualConsumption=consumption.reduce((a,b)=>a+b,0);
  const avgMonthly=annualConsumption/12,daily=annualConsumption/365.25,peakKw=Math.max(.1,num('peakKw'));
  const target=clamp(num('targetOffset')/100,.2,1.3),pr=getPR(),solar=selectedSolarValues();
  const annualIrr=Math.max(1,solar.annualIrradiation||solar.avgHsp*365.25);
  let requiredPv;
  if(state.mode==='offgrid') requiredPv=(daily*target)/(Math.max(.1,solar.worstHsp)*pr);
  else requiredPv=(annualConsumption*target)/(annualIrr*pr);
  const wp=Math.max(1,num('moduleWp'));
  const baseModules=Math.max(1,Math.ceil(requiredPv*1000/wp));
  const str=autoString(baseModules);
  const modules=Math.max(baseModules,str.modules),pvInstalled=modules*wp/1000;
  let suggestedInv=ceilStep(pvInstalled/Math.max(.7,num('dcac')),.5);
  if(state.mode==='offgrid') suggestedInv=Math.max(suggestedInv,ceilStep(peakKw*1.25,.5));
  if(state.mode==='hybrid') suggestedInv=Math.max(suggestedInv,ceilStep(peakKw*1.10,.5));
  const invKw=num('invRatedKw')>0?num('invRatedKw'):suggestedInv;
  const dcacActual=pvInstalled/Math.max(.1,invKw);
  const monthlyGeneration=(solar.monthly?.length?solar.monthly:monthNames.map((_,i)=>({irradiation:(num('manualHsp')||4.5)*[31,28.25,31,30,31,30,31,31,30,31,30,31][i]}))).map(m=>pvInstalled*Math.max(0,m.irradiation||0)*pr);
  const annualGeneration=monthlyGeneration.reduce((a,b)=>a+b,0);
  const battery=computeBattery(annualConsumption,peakKw);
  const roof=calcRoof(modules);
  const calc={consumption,annualConsumption,avgMonthly,daily,peakKw,target,pr,solar,annualIrr,requiredPv,baseModules,modules,pvInstalled,suggestedInv,invKw,dcacActual,str,monthlyGeneration,annualGeneration,battery,roof};
  calc.electrical=computeElectrical(calc);
  calc.finance=computeFinance(calc);
  state.calc=calc;
  renderAll();
  scheduleSave();
  return calc;
}

function renderAll(){
  if(!state.calc)return;
  renderHeaderSummary(); renderConsumption(); renderLosses(); renderRoof(); renderEquipment(); renderBattery(); renderElectrical(); renderFinance(); renderScenarios(); renderResults(); renderAlerts(); renderBOM(); renderTechnicalSummary(); renderEnergyChart(); renderSolarChart(); renderDiagram();
}

function renderHeaderSummary(){
  const c=state.calc;
  const name=$('projectName').value||'Projeto Solar FV';
  $('railProject').textContent=name; $('stripProject').textContent=name; $('railPv').textContent=`${fmt(c.pvInstalled,2)} kWp`; $('railModules').textContent=c.modules;
  $('rPv').textContent=fmt(c.pvInstalled,2); $('rModules').textContent=c.modules; $('rInv').textContent=fmt(c.invKw,1); $('rGeneration').textContent=fmt0(c.annualGeneration); $('rBattery').textContent=state.mode==='ongrid'?'0':fmt(c.battery.actualNominal,1); $('rPayback').textContent=c.finance.payback==null?'—':fmt(c.finance.payback,1);
  $('printMode').textContent=state.mode.toUpperCase();
  $('printProjectMeta').textContent=`${name}${$('clientName').value?' • '+$('clientName').value:''}${$('address').value?' • '+$('address').value:''}`;
}

function renderConsumption(){
  const c=state.calc;
  $('annualConsumption').textContent=fmt0(c.annualConsumption); $('avgConsumption').textContent=fmt0(c.avgMonthly); $('dailyConsumption').textContent=fmt(c.daily,1);
  $('targetOffsetOut').textContent=`${fmt0(c.target*100)}%`;
}

function renderLosses(){
  const pr=state.calc.pr,total=(1-pr)*100;
  $('prPill').textContent=`PR ${fmt(pr,3)} • perdas eq. ${fmt(total,1)}%`;
  $('prPill').className=`score-pill ${pr>=.78?'good':pr>=.68?'warn':'bad'}`;
  $('lossFields').classList.toggle('hide',!$('advancedLosses').checked); $('manualPrWrap').classList.toggle('hide',$('advancedLosses').checked);
  const chips=lossDefs.map(([id,label])=>`<span class="loss-chip">${label}: <strong>${fmt(num(id),1)}%</strong></span>`);
  chips.push(`<span class="loss-chip">Sombra: <strong>${fmt(num('shadeLoss'),1)}%</strong></span>`);
  chips.push(`<span class="loss-chip">PR resultante: <strong>${fmt(pr,3)}</strong></span>`);
  $('lossSummary').innerHTML=chips.join('');
}

function renderRoof(){
  const c=state.calc,r=c.roof,svg=$('roofSvg');
  const W=760,H=410,pad=38,scale=Math.min((W-2*pad)/r.rw,(H-2*pad)/r.rh),rw=r.rw*scale,rh=r.rh*scale,x=(W-rw)/2,y=(H-rh)/2;
  let html=`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="12" fill="#d7e1ec" stroke="#8091a5" stroke-width="2"/><rect x="${x+r.set*scale}" y="${y+r.set*scale}" width="${Math.max(0,r.uw*scale)}" height="${Math.max(0,r.uh*scale)}" rx="8" fill="#eef5fb" stroke="#9aabbf" stroke-dasharray="6 5"/>`;
  const drawCount=Math.min(r.geom,160),mw=r.mw*scale,mh=r.mh*scale,g=r.gap*scale,startX=x+r.set*scale,startY=y+r.set*scale;
  for(let i=0;i<drawCount;i++){
    const row=Math.floor(i/r.cols),col=i%r.cols;if(row>=r.rows)break;
    const px=startX+col*(mw+g),py=startY+row*(mh+g);
    const needed=i<c.modules;
    html+=`<rect x="${px}" y="${py}" width="${mw}" height="${mh}" rx="2" fill="${needed?'#153d6b':'#94a9bf'}" stroke="${needed?'#f58220':'#e5edf5'}" stroke-width="${needed?'1.2':'.6'}" opacity="${needed?1:.32}"/>`;
  }
  html+=`<text x="${W/2}" y="24" text-anchor="middle" fill="#53657b" font-size="12" font-weight="800">Pré-layout • ${r.cols} colunas × ${r.rows} linhas • capacidade ${r.maxModules} módulos</text>`;
  svg.innerHTML=html;
  const shortage=Math.max(0,c.modules-r.maxModules);
  $('roofFitPill').textContent=r.fit?`Área compatível • ${r.maxModules} módulos`:`Faltam ${shortage} posições`;
  $('roofFitPill').className=`score-pill ${r.fit?'good':'bad'}`;
  $('layoutMetrics').innerHTML=[
    ['Capacidade geométrica',`${r.geom} módulos`,`${fmt(r.area,1)} m² brutos`,r.fit?'good':'bad'],
    ['Limite usado',`${r.maxModules} módulos`,num('manualRoofLimit')>0?'limite manual':'pela geometria',''],
    ['Necessidade elétrica',`${c.modules} módulos`,`${fmt(c.pvInstalled,2)} kWp`,r.fit?'good':'bad'],
    ['Aproveitamento',r.maxModules?`${fmt(c.modules/r.maxModules*100,0)}%`:'—',shortage?`déficit: ${shortage}`:'há capacidade física','']
  ].map(x=>`<div class="layout-metric ${x[3]||''}"><small>${x[0]}</small><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
}

function renderEquipment(){
  const c=state.calc,s=c.str;
  let cls='good',text='Compatível';
  if(s.minSeries>s.maxSeries){cls='bad';text='Janela incompatível'} else if(!s.currentOk){cls='warn';text='Rever corrente/MPPT'}
  $('mpptPill').textContent=`${text} • ${s.series}S × ${s.strings} strings`;
  $('mpptPill').className=`score-pill ${cls}`;
  $('stringDashboard').innerHTML=[
    ['Faixa série',`${s.minSeries}–${s.maxSeries} módulos`,'considerando Vmp quente/frio e Vcc máxima',s.minSeries<=s.maxSeries?'good':'bad'],
    ['Auto-string',`${s.series}S × ${s.strings} strings`,`${s.perMppt} string(s)/MPPT em distribuição média`,s.currentOk?'good':'warn'],
    ['Voc a Tmin',`${fmt(s.stringVocCold,1)} V`,`limite inversor ${fmt(num('invVmax'),0)} V`,s.stringVocCold<=num('invVmax')?'good':'bad'],
    ['Vmp a Tmáx',`${fmt(s.stringVmpHot,1)} V`,`MPPT ${fmt0(num('mpptMin'))}–${fmt0(num('mpptMax'))} V`,s.stringVmpHot>=num('mpptMin')?'good':'bad'],
    ['Corrente / MPPT',`${fmt(s.current,1)} A`,`limite informado ${fmt(num('mpptCurrent'),1)} A`,s.currentOk?'good':'warn'],
    ['Ajuste módulos',s.extra?`+${s.extra} módulo(s)`:'sem ajuste',s.extra?'adicionados para equalizar strings':'quantidade base já compatível',s.extra>4?'warn':'good'],
    ['Relação DC/AC',fmt(c.dcacActual,2),`alvo ${fmt(num('dcac'),2)}`,c.dcacActual>=.85&&c.dcacActual<=1.5?'good':'warn'],
    ['Inversor usado',`${fmt(c.invKw,1)} kW`,num('invRatedKw')>0?'valor informado':'sugestão automática','']
  ].map(x=>`<div class="dash-card ${x[3]||''}"><small>${x[0]}</small><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
}

function renderBattery(){
  const b=state.calc.battery;
  if(state.mode==='ongrid'){
    $('batteryPill').textContent='Não aplicado no on-grid puro'; $('batteryPill').className='score-pill';
    $('batteryDashboard').innerHTML='<div class="dash-card"><small>Armazenamento</small><strong>0 kWh</strong><span>Selecione Híbrido para dimensionar backup.</span></div>';
    return;
  }
  $('batteryPill').textContent=`${b.units} unidade(s) • ${fmt(b.actualNominal,1)} kWh`;
  $('batteryPill').className='score-pill good';
  $('batteryDashboard').innerHTML=[
    ['Energia nominal requerida',`${fmt(b.requiredNominal,1)} kWh`,'antes do arredondamento comercial',''],
    ['Banco selecionado',`${fmt(b.actualNominal,1)} kWh`,`${b.units} × ${fmt(num('batteryUnitKwh'),2)} kWh`,'good'],
    ['Energia útil estimada',`${fmt(b.usable,1)} kWh`,`DoD ${fmt(num('dod')*100,0)}% • η ${fmt(num('batteryEff')*100,0)}%`,'good'],
    ['Autonomia estimada',`${fmt(b.backupHours,1)} h`,`carga diária crítica ${fmt(b.criticalDaily,1)} kWh`,'good'],
    ['Capacidade elétrica',`${fmt(b.ah,0)} Ah`,`${fmt0(num('bankVoltage'))} V nominal`,''],
    ['Unidades por energia',`${b.energyUnits}`,'critério energético',''],
    ['Unidades por potência',`${b.powerUnits}`,'critério de descarga contínua',b.powerUnits>b.energyUnits?'warn':'good'],
    ['Pico crítico',`${fmt(b.criticalPeak,1)} kW`,state.mode==='hybrid'?`${fmt(num('essentialPct'),0)}% do pico informado`:'pico integral','']
  ].map(x=>`<div class="dash-card ${x[3]||''}"><small>${x[0]}</small><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
}

function renderElectrical(){
  const e=state.calc.electrical;
  const fuseOk=e.stringFuse<=e.moduleMaxFuse;
  $('electricalPill').textContent=`Ica ${fmt(e.acI,1)} A • disjuntor prévio ${e.breaker} A`;
  $('electricalPill').className=`score-pill ${fuseOk?'good':'warn'}`;
  $('electricalDashboard').innerHTML=[
    ['Corrente CA',`${fmt(e.acI,2)} A`,`${e.phases===3?'trifásico':'monofásico'} • ${fmt0(e.v)} V`,'good'],
    ['Proteção CA preliminar',`${e.breaker} A`,'verificar curva, coordenação e Iz do cabo',''],
    ['Cabo CC por ΔV',`${e.dcSection} mm²`,`cálculo geométrico ${fmt(e.dcSectionCalc,2)} mm²`,''],
    ['Cabo CA por ΔV',`${e.acSection} mm²`,`cálculo geométrico ${fmt(e.acSectionCalc,2)} mm²`,''],
    ['Proteção string preliminar',`${e.stringFuse} A`,`máximo do módulo informado ${fmt0(e.moduleMaxFuse)} A`,fuseOk?'good':'bad'],
    ['Seccionamento CC',`${e.dcSwitch} A`,`por grupo médio de ${state.calc.str.perMppt} string(s)/MPPT`,''],
    ['DPS sugerido',e.spd,'confirmar Ucpv/Up e coordenação',''],
    ['Capacidade de interrupção',e.breaking?`≥ ${e.breaking} kA`:'Icc não informada',e.breaking?`Icc disponível: ${fmt(e.icc,1)} kA`:'não confundir Icu/Icn com a Icc do ponto',e.breaking?'good':'warn']
  ].map(x=>`<div class="dash-card ${x[3]||''}"><small>${x[0]}</small><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
}

function renderFinance(){
  const f=state.calc.finance;
  $('financePill').textContent=f.payback==null?'Payback não atingido':`Payback ${fmt(f.payback,1)} anos`;
  $('financePill').className=`score-pill ${f.payback!=null&&f.payback<=10?'good':f.payback!=null&&f.payback<=18?'warn':'bad'}`;
  $('financeDashboard').innerHTML=[
    ['CAPEX estimado',`R$ ${fmt(f.capex,0)}`,`FV R$ ${fmt(f.pvCost,0)}${f.batteryCost?` • bateria R$ ${fmt(f.batteryCost,0)}`:''}`,''],
    ['Economia líquida ano 1',`R$ ${fmt(f.year1,0)}`,'após O&M informado',''],
    ['Payback simples',f.payback==null?'—':`${fmt(f.payback,1)} anos`,'fluxo não descontado',f.payback!=null&&f.payback<=10?'good':''],
    ['VPL',`R$ ${fmt(f.npv,0)}`,`taxa de desconto ${fmt(num('discountRate'),1)}% a.a.`,f.npv>=0?'good':'bad'],
    ['TIR',f.irr==null?'—':`${fmt(f.irr*100,1)}% a.a.`,'estimativa pelo fluxo de caixa',f.irr!=null&&f.irr>num('discountRate')/100?'good':''],
    ['LCOE simplificado',f.lcoe==null?'—':`R$ ${fmt(f.lcoe,2)}/kWh`,'custos e geração descontados',''],
    ['Conta anual referência',`R$ ${fmt(f.preBill,0)}`,'antes do sistema',''],
    ['Vida analisada',`${f.life} anos`,`degradação ${fmt(num('degradation'),1)}% a.a.`,'']
  ].map(x=>`<div class="dash-card ${x[3]||''}"><small>${x[0]}</small><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
}

function estimateScenario(offsetPct){
  const c=state.calc,pr=c.pr,solar=c.solar,wp=Math.max(1,num('moduleWp'));
  const target=offsetPct/100;
  const req=state.mode==='offgrid'?(c.daily*target)/(Math.max(.1,solar.worstHsp)*pr):(c.annualConsumption*target)/(Math.max(1,c.annualIrr)*pr);
  const modules=Math.ceil(req*1000/wp),pv=modules*wp/1000,gen=pv*c.annualIrr*pr;
  return {offsetPct,modules,pv,gen};
}

function renderScenarios(){
  const offsets=state.mode==='offgrid'?[90,100,115]:[80,100,120];
  const labels=state.mode==='offgrid'?['Econômico','Autonomia base','Reserva energética']:['Econômico','Equilíbrio','Maior compensação'];
  const desc=state.mode==='offgrid'?['Menor gerador e maior risco sazonal.','Atende a meta definida como referência.','Mais margem para meses críticos.']:['Reduz investimento e importação da rede.','Próximo da compensação anual definida.','Maior geração, sujeito a excedentes.'];
  $('scenarioGrid').innerHTML=offsets.map((o,i)=>{const s=estimateScenario(o);const selected=Math.round(state.calc.target*100)===o;return `<article class="scenario-card ${selected?'selected':''}" data-offset="${o}"><span class="tag">${o}% da energia</span><h4>${labels[i]}</h4><p>${desc[i]}</p><div class="scenario-kpis"><span><small>Potência</small><b>${fmt(s.pv,2)} kWp</b></span><span><small>Módulos</small><b>${s.modules}</b></span><span><small>Geração</small><b>${fmt0(s.gen)} kWh/a</b></span><span><small>DC/AC alvo</small><b>${fmt(num('dcac'),2)}</b></span></div></article>`}).join('');
  $$('#scenarioGrid .scenario-card').forEach(card=>card.addEventListener('click',()=>{$('targetOffset').value=card.dataset.offset;calculate();toast(`Cenário ${card.dataset.offset}% aplicado.`)}));
}

function renderResults(){
  const c=state.calc;
  if(state.pvSim&&state.pvSimSig===calcSignature()){
    $('rGeneration').textContent=fmt0(state.pvSim.annualEnergy);
    $('simulationSource').textContent='PVGIS 5.3 • simulação detalhada';
  } else $('simulationSource').textContent='estimativa interna';
}

function makeAlert(severity,message){return {severity,message}}
function renderAlerts(){
  const c=state.calc,s=c.str,e=c.electrical,a=[];
  a.push(makeAlert('good',`Gerador configurado com ${c.modules} módulos de ${fmt0(num('moduleWp'))} Wp, totalizando ${fmt(c.pvInstalled,2)} kWp.`));
  if(!state.solar) a.push(makeAlert('warn',`Base climática não consultada: foi usada HSP manual de ${fmt(num('manualHsp'),2)} kWh/m².dia.`));
  if(c.roof.fit) a.push(makeAlert('good',`A área informada comporta até ${c.roof.maxModules} módulos; o sistema requer ${c.modules}.`)); else a.push(makeAlert('bad',`A área comporta ${c.roof.maxModules} módulos, mas o dimensionamento precisa de ${c.modules}. Faltam ${c.modules-c.roof.maxModules} posições.`));
  if(s.minSeries>s.maxSeries) a.push(makeAlert('bad',`A janela MPPT é incompatível: mínimo calculado ${s.minSeries} módulos/série e máximo ${s.maxSeries}.`));
  else a.push(makeAlert('good',`Auto-string: ${s.series} módulos em série × ${s.strings} strings; faixa permitida ${s.minSeries}–${s.maxSeries} módulos/série.`));
  if(!s.currentOk) a.push(makeAlert('bad',`Corrente média por MPPT ${fmt(s.current,1)} A supera o limite informado de ${fmt(num('mpptCurrent'),1)} A. Aumente MPPTs ou revise o inversor.`));
  if(c.dcacActual<.8||c.dcacActual>1.55) a.push(makeAlert('warn',`Relação DC/AC ${fmt(c.dcacActual,2)} está fora da faixa usual de projeto adotada na ferramenta; confira clipping, fabricante e objetivo do sistema.`));
  if(e.stringFuse>e.moduleMaxFuse) a.push(makeAlert('bad',`A pré-seleção de proteção de string (${e.stringFuse} A) excede o fusível máximo do módulo informado (${fmt0(e.moduleMaxFuse)} A).`));
  if(e.icc<=0) a.push(makeAlert('warn','Corrente de curto-circuito disponível no ponto não informada. Sem ela não é possível fechar a capacidade de interrupção do dispositivo.'));
  if(c.invKw>75) a.push(makeAlert('warn',`Potência CA de ${fmt(c.invKw,1)} kW supera 75 kW. No Brasil, verifique o enquadramento regulatório como minigeração distribuída, requisitos de acesso e estudos específicos da distribuidora.`));
  else a.push(makeAlert('good','Potência CA dentro da faixa de microgeração distribuída (até 75 kW); ainda é necessário validar os requisitos da distribuidora e o enquadramento do empreendimento.'));
  if(state.mode!=='ongrid') a.push(makeAlert('good',`Banco selecionado: ${fmt(c.battery.actualNominal,1)} kWh nominais e aproximadamente ${fmt(c.battery.backupHours,1)} h de autonomia para a carga de projeto.`));
  if(num('arrayTilt')===0) a.push(makeAlert('warn','Inclinação 0° informada. Verifique drenagem, sujeira e recomendação estrutural/mecânica do arranjo.'));
  a.push(makeAlert('warn','Cabos e proteções mostrados são pré-dimensionamentos. Verifique Iz, fatores de correção, curto-circuito, seletividade, DPS, aterramento e exigências da distribuidora antes do projeto executivo.'));
  state.alerts=a;
  $('alerts').innerHTML=a.map(x=>`<div class="alert ${x.severity}">${esc(x.message)}</div>`).join('');
  const bad=a.filter(x=>x.severity==='bad').length,warn=a.filter(x=>x.severity==='warn').length;
  const score=Math.max(0,100-bad*25-warn*7);
  $('healthScore').textContent=`Saúde ${score}/100`;
}

function renderTechnicalSummary(){
  const c=state.calc,s=c.str,b=c.battery,e=c.electrical,f=c.finance;
  const items=[
    ['Energia',`${fmt(c.annualConsumption,0)} kWh/ano`,`Meta ${fmt(c.target*100,0)}% • PR ${fmt(c.pr,3)}`],
    ['Gerador',`${fmt(c.pvInstalled,2)} kWp • ${c.modules} módulos`,`${s.series}S × ${s.strings} strings`],
    ['Inversor',`${fmt(c.invKw,1)} kW CA`,`DC/AC ${fmt(c.dcacActual,2)} • ${fmt0(num('mpptCount'))} MPPTs`],
    ['Tensões string',`Vmp ${fmt(s.stringVmp,0)} V`,`Voc frio ${fmt(s.stringVocCold,0)} V • Vmp quente ${fmt(s.stringVmpHot,0)} V`],
    ['CA',`${fmt(e.acI,1)} A • proteção ${e.breaker} A`,`${e.phases===3?'3φ':'1φ'} ${fmt0(e.v)} V`],
    ['Cabos por ΔV',`CC ${e.dcSection} mm² • CA ${e.acSection} mm²`,'confirmar capacidade de condução'],
    ['Armazenamento',state.mode==='ongrid'?'não aplicado':`${fmt(b.actualNominal,1)} kWh • ${b.units} un.`,state.mode==='ongrid'?'modo on-grid puro':`${fmt(b.backupHours,1)} h estimadas`],
    ['Economia',`CAPEX R$ ${fmt(f.capex,0)}`,f.payback==null?'payback não atingido':`payback ${fmt(f.payback,1)} anos`]
  ];
  $('technicalSummary').innerHTML=items.map(x=>`<div class="summary-block"><small>${x[0]}</small><b>${x[1]}</b><span>${x[2]}</span></div>`).join('');
}

function renderBOM(){
  const c=state.calc,e=c.electrical,b=c.battery;
  const rows=[
    ['Módulo fotovoltaico',c.modules,`${$('moduleBrand').value||'Fabricante não informado'} ${$('moduleModel').value||''} • ${fmt0(num('moduleWp'))} Wp`],
    [state.mode==='hybrid'?'Inversor híbrido':'Inversor',1,`${$('invBrand').value||'Fabricante não informado'} ${$('invModel').value||''} • ${fmt(c.invKw,1)} kW • ${fmt0(num('mpptCount'))} MPPTs`],
    ['String(s) FV',c.str.strings,`${c.str.series} módulos em série por string`],
    ['Seccionamento CC',1,`pré-seleção ${e.dcSwitch} A • tensão compatível com ${fmt(c.str.stringVocCold,0)} V`],
    ['DPS CC',1,e.spd],
    ['DPS CA',1,e.spd],
    ['Proteção CA',1,`${e.breaker} A • capacidade de interrupção a validar${e.breaking?` (referência ≥ ${e.breaking} kA)`:''}`],
    ['Cabo solar CC',`${fmt0(Math.max(1,num('dcLength'))*2*c.str.strings)} m`,`${e.dcSection} mm² por queda de tensão; revisar Iz`],
    ['Cabo CA',`${fmt0(Math.max(1,num('acLength'))*(e.phases===3?4:3))} m`,`${e.acSection} mm² por queda de tensão; quantidade de vias é indicativa`],
    ['Estrutura de fixação','1 conjunto',`${c.modules} módulos • orientação ${$('moduleOrientation').value==='portrait'?'retrato':'paisagem'}`]
  ];
  if(state.mode!=='ongrid') rows.splice(2,0,['Bateria / módulo de armazenamento',b.units,`${fmt(num('batteryUnitKwh'),2)} kWh/un. • ${fmt(num('batteryUnitKw'),1)} kW/un.`]);
  $('bomBody').innerHTML=rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
}

function renderEnergyChart(){
  const c=state.calc,svg=$('energyChart'),W=760,H=310,p={l:45,r:12,t:18,b:34},plotW=W-p.l-p.r,plotH=H-p.t-p.b;
  const gen=(state.pvSim&&state.pvSimSig===calcSignature())?state.pvSim.monthly.map(x=>x.energy):c.monthlyGeneration;
  const cons=c.consumption,max=Math.max(1,...cons,...gen);
  let html='';
  for(let i=0;i<=4;i++){const y=p.t+plotH*i/4,v=max*(1-i/4);html+=`<line x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}" stroke="#e3e9f0"/><text x="3" y="${y+4}">${fmt0(v)}</text>`}
  const slot=plotW/12,bw=slot*.28;
  cons.forEach((v,i)=>{const x=p.l+i*slot+slot*.17,bh=v/max*plotH,y=p.t+plotH-bh;html+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="#64748b"><title>${monthNames[i]} consumo ${fmt0(v)} kWh</title></rect>`});
  gen.forEach((v,i)=>{const x=p.l+i*slot+slot*.53,bh=v/max*plotH,y=p.t+plotH-bh;html+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="#f58220"><title>${monthNames[i]} geração ${fmt0(v)} kWh</title></rect><text x="${p.l+i*slot+slot/2}" y="${H-12}" text-anchor="middle">${monthNames[i]}</text>`});
  svg.innerHTML=html;
}

function renderSolarChart(){
  const svg=$('solarChart'),data=state.solar?.monthly||[],W=760,H=250,p={l:42,r:12,t:16,b:32},plotW=W-p.l-p.r,plotH=H-p.t-p.b;
  if(!data.length){svg.innerHTML='<text x="20" y="40">Carregue a base solar para visualizar a HSP mensal.</text>';return}
  const max=Math.max(1,...data.map(x=>x.hsp));let html='';
  for(let i=0;i<=4;i++){const y=p.t+plotH*i/4,v=max*(1-i/4);html+=`<line x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}" stroke="#e3e9f0"/><text x="3" y="${y+4}">${v.toFixed(1)}</text>`}
  const slot=plotW/12,bw=slot*.62;
  data.forEach((m,i)=>{const x=p.l+i*slot+(slot-bw)/2,bh=m.hsp/max*plotH,y=p.t+plotH-bh;html+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="#f58220"><title>${monthNames[i]} ${fmt(m.hsp,2)} HSP</title></rect><text x="${x+bw/2}" y="${H-11}" text-anchor="middle">${monthNames[i]}</text>`});
  svg.innerHTML=html;
}

function calcSignature(){
  const c=state.calc;
  return [c?.pvInstalled,num('arrayTilt'),num('arrayAzimuth'),getPvgisAdditionalLoss(),$('mountingPlace').value,num('lat'),num('lon')].join('|');
}

async function simulatePVGIS(){
  if(!state.calc)return;
  const lat=num('lat'),lon=num('lon'); if(!Number.isFinite(lat)||!Number.isFinite(lon))return toast('Defina a localização primeiro.');
  const btn=$('pvgisSimBtn'); btn.disabled=true; btn.textContent='Simulando…';
  try{
    const q=new URLSearchParams({lat,lon,peakpower:state.calc.pvInstalled,loss:getPvgisAdditionalLoss(),angle:num('arrayTilt'),aspect:compassToPvgisAspect(num('arrayAzimuth')),mountingplace:$('mountingPlace').value});
    const r=await fetch(`/api/pvcalc?${q}`),d=await r.json(); if(!r.ok)throw new Error(d.error||'Falha na simulação PVGIS.');
    state.pvSim=d; state.pvSimSig=calcSignature();
    $('simulationSource').textContent='PVGIS 5.3 • simulação detalhada'; $('rGeneration').textContent=fmt0(d.annualEnergy); renderEnergyChart();
    toast(`PVGIS: ${fmt0(d.annualEnergy)} kWh/ano simulados.`);
  }catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent='Simular produção PVGIS'}
}

async function simulateOffgrid(){
  if(state.mode==='ongrid')return toast('A validação off-grid é usada nos modos Off-grid ou Híbrido.');
  const c=state.calc,b=c.battery,btn=$('offgridSimBtn'); btn.disabled=true; btn.textContent='Validando…';
  try{
    const cutoff=(1-clamp(num('dod'),.1,1))*100;
    const q=new URLSearchParams({lat:num('lat'),lon:num('lon'),peakpower:c.pvInstalled*1000,batterysize:b.actualNominal*1000,consumptionday:b.criticalDaily*1000,cutoff,angle:num('arrayTilt'),aspect:compassToPvgisAspect(num('arrayAzimuth'))});
    const r=await fetch(`/api/offgrid?${q}`),d=await r.json();if(!r.ok)throw new Error(d.error||'Falha na validação off-grid.');
    state.offgridSim=d;
    const cls=d.emptyDaysPct<=2?'ok':d.emptyDaysPct<=10?'warn':'bad';
    const el=$('offgridSimResult'); el.className=`status ${cls}`; el.textContent=`PVGIS Off-grid: bateria atinge o limite mínimo em ${fmt(d.emptyDaysPct,1)}% dos dias e fica cheia em ${fmt(d.fullDaysPct,1)}% dos dias. Energia média faltante nos eventos: ${fmt(d.missingEnergyWh,0)} Wh.`;
  }catch(e){const el=$('offgridSimResult');el.className='status bad';el.textContent=e.message}finally{btn.disabled=false;btn.textContent='Validar autonomia no PVGIS Off-grid'}
}

const desktopLayouts={
  ongrid:{pv:[25,105],dc:[215,105],inv:[415,105],ac:[620,105],grid:[850,45],load:[850,185]},
  offgrid:{pv:[20,105],dc:[205,105],ctrl:[390,105],bat:[390,255],inv:[585,105],load:[810,105]},
  hybrid:{pv:[20,105],dc:[205,105],inv:[405,105],bat:[405,255],ac:[620,105],grid:[845,45],load:[845,185]}
};
const mobileLayouts={
  ongrid:{pv:[100,20],dc:[100,125],inv:[100,230],ac:[100,335],grid:[15,465],load:[185,465]},
  offgrid:{pv:[100,15],dc:[100,120],ctrl:[100,225],bat:[15,355],inv:[185,355],load:[100,505]},
  hybrid:{pv:[100,10],dc:[100,115],inv:[100,220],bat:[15,350],ac:[185,350],grid:[15,500],load:[185,500]}
};
function isMobileDiagram(){return matchMedia('(max-width:980px)').matches}
function node(id,x,y,w,h,title,sub){return `<g class="node" data-id="${id}" transform="translate(${x},${y})"><rect width="${w}" height="${h}"/><text x="${w/2}" y="27" text-anchor="middle">${esc(title)}</text><text x="${w/2}" y="49" text-anchor="middle" style="font-size:10px;fill:#6c7b8e;font-weight:650">${esc(sub||'')}</text></g>`}
function wire(x1,y1,x2,y2,cls=''){return `<path class="wire ${cls}" d="M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}" marker-end="url(#arrow)"/>`}
function wireV(x1,y1,x2,y2,cls=''){const my=(y1+y2)/2;return `<path class="wire ${cls}" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" marker-end="url(#arrow)"/>`}

function renderDiagram(reset=false){
  if(!state.calc)return; const svg=$('diagram'),mobile=isMobileDiagram(),mode=state.mode,key=`${mode}_${mobile?'mobile':'desktop'}`;
  if(reset||!state.diagramPos[key]) state.diagramPos[key]=JSON.parse(JSON.stringify(mobile?mobileLayouts[mode]:desktopLayouts[mode]));
  const p=state.diagramPos[key],c=state.calc,e=c.electrical,w=mobile?160:165,h=72;
  svg.setAttribute('viewBox',mobile?'0 0 360 650':'0 0 1120 470');
  let html=`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#32526f"/></marker></defs>`;
  const pvSub=`${c.str.series}S×${c.str.strings} • ${fmt(c.pvInstalled,2)} kWp`,dcSub=`DPS • secc. ${e.dcSwitch} A`,invSub=`${fmt(c.invKw,1)} kW • ${fmt(c.dcacActual,2)} DC/AC`,acSub=`DJ ${e.breaker} A • cabo ${e.acSection} mm²`,batSub=`${fmt(c.battery.actualNominal,1)} kWh • ${fmt0(num('bankVoltage'))} V`;
  if(mobile){
    if(mode==='ongrid'){
      html+=wireV(p.pv[0]+w/2,p.pv[1]+h,p.dc[0]+w/2,p.dc[1],'dc')+wireV(p.dc[0]+w/2,p.dc[1]+h,p.inv[0]+w/2,p.inv[1],'dc')+wireV(p.inv[0]+w/2,p.inv[1]+h,p.ac[0]+w/2,p.ac[1],'ac')+wireV(p.ac[0]+w/2,p.ac[1]+h,p.grid[0]+w/2,p.grid[1],'ac')+wireV(p.ac[0]+w/2,p.ac[1]+h,p.load[0]+w/2,p.load[1],'ac');
      html+=node('pv',...p.pv,w,h,$('labelPv').value,pvSub)+node('dc',...p.dc,w,h,$('labelDcProt').value,dcSub)+node('inv',...p.inv,w,h,$('labelInv').value,invSub)+node('ac',...p.ac,w,h,$('labelAcProt').value,acSub)+node('grid',...p.grid,w,h,'Medição / Rede','Distribuidora')+node('load',...p.load,w,h,'QGBT / Cargas','Consumidor');
    }else if(mode==='offgrid'){
      html+=wireV(p.pv[0]+w/2,p.pv[1]+h,p.dc[0]+w/2,p.dc[1],'dc')+wireV(p.dc[0]+w/2,p.dc[1]+h,p.ctrl[0]+w/2,p.ctrl[1],'dc')+wireV(p.ctrl[0]+w/2,p.ctrl[1]+h,p.bat[0]+w/2,p.bat[1],'bat')+wireV(p.ctrl[0]+w/2,p.ctrl[1]+h,p.inv[0]+w/2,p.inv[1],'dc')+wireV(p.bat[0]+w,p.bat[1]+h/2,p.inv[0],p.inv[1]+h/2,'bat')+wireV(p.inv[0]+w/2,p.inv[1]+h,p.load[0]+w/2,p.load[1],'ac');
      html+=node('pv',...p.pv,w,h,$('labelPv').value,pvSub)+node('dc',...p.dc,w,h,$('labelDcProt').value,dcSub)+node('ctrl',...p.ctrl,w,h,'MPPT / Controlador',`${c.str.perMppt} string(s)/MPPT`)+node('bat',...p.bat,w,h,'Banco de baterias',batSub)+node('inv',...p.inv,w,h,$('labelInv').value,invSub)+node('load',...p.load,w,h,'Quadro de cargas',acSub);
    }else{
      html+=wireV(p.pv[0]+w/2,p.pv[1]+h,p.dc[0]+w/2,p.dc[1],'dc')+wireV(p.dc[0]+w/2,p.dc[1]+h,p.inv[0]+w/2,p.inv[1],'dc')+wireV(p.inv[0]+w/2,p.inv[1]+h,p.bat[0]+w/2,p.bat[1],'bat')+wireV(p.inv[0]+w/2,p.inv[1]+h,p.ac[0]+w/2,p.ac[1],'ac')+wireV(p.ac[0]+w/2,p.ac[1]+h,p.grid[0]+w/2,p.grid[1],'ac')+wireV(p.ac[0]+w/2,p.ac[1]+h,p.load[0]+w/2,p.load[1],'ac');
      html+=node('pv',...p.pv,w,h,$('labelPv').value,pvSub)+node('dc',...p.dc,w,h,$('labelDcProt').value,dcSub)+node('inv',...p.inv,w,h,'Inversor híbrido',invSub)+node('bat',...p.bat,w,h,'Banco de baterias',batSub)+node('ac',...p.ac,w,h,'QGBT / ATS',acSub)+node('grid',...p.grid,w,h,'Rede elétrica','Bidirecional')+node('load',...p.load,w,h,'Cargas essenciais',`${fmt(num('essentialPct'),0)}% da carga`);
    }
  }else{
    if(mode==='ongrid'){
      html+=wire(p.pv[0]+w,p.pv[1]+h/2,p.dc[0],p.dc[1]+h/2,'dc')+wire(p.dc[0]+w,p.dc[1]+h/2,p.inv[0],p.inv[1]+h/2,'dc')+wire(p.inv[0]+w,p.inv[1]+h/2,p.ac[0],p.ac[1]+h/2,'ac')+wire(p.ac[0]+w,p.ac[1]+h/2,p.grid[0],p.grid[1]+h/2,'ac')+wire(p.ac[0]+w,p.ac[1]+h/2,p.load[0],p.load[1]+h/2,'ac');
      html+=node('pv',...p.pv,w,h,$('labelPv').value,pvSub)+node('dc',...p.dc,w,h,$('labelDcProt').value,dcSub)+node('inv',...p.inv,w,h,$('labelInv').value,invSub)+node('ac',...p.ac,w,h,$('labelAcProt').value,acSub)+node('grid',...p.grid,w,h,'Medição / Rede','Distribuidora')+node('load',...p.load,w,h,'QGBT / Cargas','Consumidor');
    }else if(mode==='offgrid'){
      html+=wire(p.pv[0]+w,p.pv[1]+h/2,p.dc[0],p.dc[1]+h/2,'dc')+wire(p.dc[0]+w,p.dc[1]+h/2,p.ctrl[0],p.ctrl[1]+h/2,'dc')+wire(p.ctrl[0]+w,p.ctrl[1]+h/2,p.inv[0],p.inv[1]+h/2,'dc')+wireV(p.ctrl[0]+w/2,p.ctrl[1]+h,p.bat[0]+w/2,p.bat[1],'bat')+wire(p.bat[0]+w,p.bat[1]+h/2,p.inv[0]+w/2,p.inv[1]+h,'bat')+wire(p.inv[0]+w,p.inv[1]+h/2,p.load[0],p.load[1]+h/2,'ac');
      html+=node('pv',...p.pv,w,h,$('labelPv').value,pvSub)+node('dc',...p.dc,w,h,$('labelDcProt').value,dcSub)+node('ctrl',...p.ctrl,w,h,'MPPT / Controlador',`${c.str.perMppt} string(s)/MPPT`)+node('bat',...p.bat,w,h,'Banco de baterias',batSub)+node('inv',...p.inv,w,h,$('labelInv').value,invSub)+node('load',...p.load,w,h,'Quadro de cargas',acSub);
    }else{
      html+=wire(p.pv[0]+w,p.pv[1]+h/2,p.dc[0],p.dc[1]+h/2,'dc')+wire(p.dc[0]+w,p.dc[1]+h/2,p.inv[0],p.inv[1]+h/2,'dc')+wireV(p.inv[0]+w/2,p.inv[1]+h,p.bat[0]+w/2,p.bat[1],'bat')+wire(p.inv[0]+w,p.inv[1]+h/2,p.ac[0],p.ac[1]+h/2,'ac')+wire(p.ac[0]+w,p.ac[1]+h/2,p.grid[0],p.grid[1]+h/2,'ac')+wire(p.ac[0]+w,p.ac[1]+h/2,p.load[0],p.load[1]+h/2,'ac');
      html+=node('pv',...p.pv,w,h,$('labelPv').value,pvSub)+node('dc',...p.dc,w,h,$('labelDcProt').value,dcSub)+node('inv',...p.inv,w,h,'Inversor híbrido',invSub)+node('bat',...p.bat,w,h,'Banco de baterias',batSub)+node('ac',...p.ac,w,h,'QGBT / ATS',acSub)+node('grid',...p.grid,w,h,'Rede elétrica','Bidirecional')+node('load',...p.load,w,h,'Cargas essenciais',`${fmt(num('essentialPct'),0)}% da carga`);
    }
  }
  svg.innerHTML=html; attachDrag(key);
}

function attachDrag(layoutKey){
  const svg=$('diagram');let drag=null,off={x:0,y:0};
  const point=e=>{const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(svg.getScreenCTM().inverse())};
  svg.querySelectorAll('.node').forEach(g=>g.addEventListener('pointerdown',e=>{e.preventDefault();drag=g;g.setPointerCapture(e.pointerId);const p=point(e),m=g.transform.baseVal.consolidate().matrix;off={x:p.x-m.e,y:p.y-m.f};g.classList.add('active')}));
  svg.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e),id=drag.dataset.id,maxX=isMobileDiagram()?195:940,maxY=isMobileDiagram()?560:360;state.diagramPos[layoutKey][id]=[clamp(p.x-off.x,0,maxX),clamp(p.y-off.y,0,maxY)];drag.setAttribute('transform',`translate(${state.diagramPos[layoutKey][id][0]},${state.diagramPos[layoutKey][id][1]})`)});
  const end=()=>{if(drag){drag.classList.remove('active');drag=null;renderDiagram();scheduleSave()}};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
}

function exportSvg(){
  const svg=$('diagram').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeFileName($('projectName').value||'unifilar')}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}

function projectPayload(){
  const values={};
  $$('input[id],select[id]').forEach(el=>{if(el.type==='file')return;values[el.id]=el.type==='checkbox'?el.checked:el.value});
  return {version:2,mode:state.mode,step:state.step,values,solar:state.solar,diagramPos:state.diagramPos,selectedAddress:state.selectedAddress,updatedAt:new Date().toISOString()};
}

function applyPayload(p){
  if(!p||!p.values)return;
  Object.entries(p.values).forEach(([id,v])=>{const el=$(id);if(!el)return;if(el.type==='checkbox')el.checked=Boolean(v);else el.value=v});
  state.solar=p.solar||null;state.diagramPos=p.diagramPos||{};state.selectedAddress=p.selectedAddress||'';
  setMode(p.mode||'ongrid');
  if(state.solar){$('sourcePill').textContent=`${state.solar.source}${state.solar.radiationDatabase?' • '+state.solar.radiationDatabase:''}`;$('solarAvg').textContent=fmt(state.solar.avgHsp,2);$('solarWorst').textContent=fmt(state.solar.worstHsp,2);$('solarAnnual').textContent=fmt0(state.solar.annualIrradiation);$('solarTilt').textContent=state.solar.optimalSlope==null?'—':fmt(state.solar.optimalSlope,0);}
  calculate();setStep(Number(p.step)||0,false);
}

function saveProject(){
  localStorage.setItem('solaria-project-v2',JSON.stringify(projectPayload()));
  $('autosaveStatus').textContent='Salvo neste dispositivo';toast('Projeto salvo no dispositivo.');
}
function scheduleSave(){
  clearTimeout(state.savingTimer);$('autosaveStatus').textContent='Alterações pendentes';
  state.savingTimer=setTimeout(()=>{localStorage.setItem('solaria-project-v2',JSON.stringify(projectPayload()));$('autosaveStatus').textContent='Salvo automaticamente'},900);
}
function loadProject(){
  try{const raw=localStorage.getItem('solaria-project-v2');if(raw)applyPayload(JSON.parse(raw))}catch(_){ }
}
function exportProject(){
  const blob=new Blob([JSON.stringify(projectPayload(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeFileName($('projectName').value||'projeto-solar')}.solaria.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}
async function importProject(file){
  try{const p=JSON.parse(await file.text());applyPayload(p);saveProject();toast('Projeto importado com sucesso.')}catch(e){toast('Arquivo de projeto inválido.')}
}
function safeFileName(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'projeto'}

async function shareProject(){
  const c=state.calc;if(!c)return;
  const text=`${$('projectName').value||'Projeto Solar FV'} — ${fmt(c.pvInstalled,2)} kWp, ${c.modules} módulos, inversor ${fmt(c.invKw,1)} kW, geração estimada ${fmt0(c.annualGeneration)} kWh/ano${state.mode!=='ongrid'?`, bateria ${fmt(c.battery.actualNominal,1)} kWh`:''}.`;
  try{if(navigator.share)await navigator.share({title:'SolarIA Designer FV',text});else{await navigator.clipboard.writeText(text);toast('Resumo copiado para a área de transferência.')}}catch(_){ }
}

function bindEvents(){
  $$('.step-link,.mobile-step').forEach(b=>b.addEventListener('click',()=>setStep(Number(b.dataset.step))));
  $$('.mode-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('prevStep').addEventListener('click',()=>setStep(state.step-1));
  $('nextStep').addEventListener('click',()=>setStep(state.step===7?0:state.step+1));
  $('searchAddressBtn').addEventListener('click',searchAddress);$('geoBtn').addEventListener('click',useLocation);$('solarBtn').addEventListener('click',fetchSolar);
  $('fillConsumptionBtn').addEventListener('click',()=>{const v=Math.max(0,num('consumptionQuick'));$$('.consumption-month').forEach(i=>i.value=v);invalidateDetailedSimulation();calculate()});
  $('advancedLosses').addEventListener('change',()=>{invalidateDetailedSimulation();calculate()});
  $('targetOffset').addEventListener('input',()=>{invalidateDetailedSimulation();calculate()});
  $('pvgisSimBtn').addEventListener('click',simulatePVGIS);$('offgridSimBtn').addEventListener('click',simulateOffgrid);
  $('saveBtn').addEventListener('click',saveProject);$('exportJsonBtn').addEventListener('click',exportProject);$('importJson').addEventListener('change',e=>{if(e.target.files?.[0])importProject(e.target.files[0]);e.target.value='' });$('shareBtn').addEventListener('click',shareProject);$('printBtn').addEventListener('click',()=>{calculate();window.print()});
  $('exportSvgBtn').addEventListener('click',exportSvg);$('resetDiagramBtn').addEventListener('click',()=>renderDiagram(true));
  ['labelPv','labelInv','labelDcProt','labelAcProt'].forEach(id=>$(id).addEventListener('input',()=>{renderDiagram();scheduleSave()}));
  const recalcInputs=$$('input[id],select[id]').filter(el=>!['address','projectName','clientName','labelPv','labelInv','labelDcProt','labelAcProt','importJson'].includes(el.id));
  recalcInputs.forEach(el=>el.addEventListener(el.type==='range'?'input':'change',()=>{if(['lat','lon','arrayTilt','arrayAzimuth','mountingPlace','shadeLoss','moduleWp'].includes(el.id))invalidateDetailedSimulation();calculate()}));
  // realtime para números e textos de projeto
  $$('input[type="number"]').forEach(el=>el.addEventListener('input',()=>{if(['lat','lon','arrayTilt','arrayAzimuth','moduleWp','shadeLoss'].includes(el.id))invalidateDetailedSimulation();calculate()}));
  $('projectName').addEventListener('input',()=>{renderHeaderSummary();scheduleSave()});$('clientName').addEventListener('input',scheduleSave);$('address').addEventListener('input',scheduleSave);
  let wasMobile=isMobileDiagram();window.addEventListener('resize',()=>{const now=isMobileDiagram();if(now!==wasMobile){wasMobile=now;renderDiagram(true)}});
}

function ensureManualHsp(){
  // Compatibilidade com a interface: cria o controle se a versão HTML antiga for reutilizada.
  if($('manualHsp'))return;
  const source=$('solarSource')?.closest('.form-grid');if(!source)return;
  const d=document.createElement('div');d.className='field';d.innerHTML='<label>HSP manual de contingência</label><input id="manualHsp" type="number" min="0.1" step="0.1" value="4.5"/>';source.appendChild(d);
}

function init(){
  buildConsumptionGrid();buildLossFields();buildMobileSteps();ensureManualHsp();bindEvents();
  loadProject();
  if(!state.calc)calculate();
  setStep(state.step,false);renderSolarChart();
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}

document.addEventListener('DOMContentLoaded',init);
