const PVGIS='https://re.jrc.ec.europa.eu/api/v5_3/PVcalc';
function n(v){ const x=Number(v); return Number.isFinite(x)?x:null; }
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  try{
    const lat=n(req.query.lat), lon=n(req.query.lon), peak=n(req.query.peakpower), loss=n(req.query.loss);
    const angle=n(req.query.angle) ?? 20, aspect=n(req.query.aspect) ?? 0;
    if(lat===null||lon===null||peak===null||peak<=0) return res.status(400).json({error:'Informe lat, lon e peakpower válidos.'});
    const p=new URLSearchParams({lat:String(lat),lon:String(lon),peakpower:String(peak),loss:String(Math.max(0,loss??14)),pvtechchoice:'crystSi',mountingplace:String(req.query.mountingplace||'free'),angle:String(angle),aspect:String(aspect),outputformat:'json'});
    const r=await fetch(`${PVGIS}?${p}`); const text=await r.text();
    if(!r.ok){ let msg=`PVGIS PVcalc indisponível (${r.status}).`; try{msg=JSON.parse(text).message||msg}catch{}; throw new Error(msg); }
    const d=JSON.parse(text), out=d?.outputs||{};
    let rows=out?.monthly?.fixed || out?.monthly || [];
    if(!Array.isArray(rows)) rows=[];
    const monthly=rows.map((x,i)=>({month:n(x.month)??i+1,energy:n(x.E_m)??n(x.E_d)*30.4375??0,irradiation:n(x['H(i)_m'])??n(x['H(i)_d'])*30.4375??null,sd:n(x.SD_m)}));
    const t=out?.totals?.fixed || out?.totals || {};
    const annualEnergy=n(t.E_y) ?? monthly.reduce((s,x)=>s+(x.energy||0),0);
    const annualIrradiation=n(t['H(i)_y']) ?? monthly.reduce((s,x)=>s+(x.irradiation||0),0);
    return res.status(200).json({source:'PVGIS 5.3 PVcalc',annualEnergy:Number((annualEnergy||0).toFixed(1)),annualIrradiation:annualIrradiation===null?null:Number(annualIrradiation.toFixed(1)),systemLossPct:n(t.l_total),monthly,inputs:d?.inputs||null});
  }catch(err){return res.status(500).json({error:err.message||'Falha na simulação PVGIS.'});}
};
