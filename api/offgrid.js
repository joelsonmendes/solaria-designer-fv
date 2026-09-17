const PVGIS='https://re.jrc.ec.europa.eu/api/v5_3/SHScalc';
function n(v){ const x=Number(v); return Number.isFinite(x)?x:null; }
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  try{
    const lat=n(req.query.lat),lon=n(req.query.lon),peak=n(req.query.peakpower),battery=n(req.query.batterysize),cons=n(req.query.consumptionday);
    const cutoff=n(req.query.cutoff)??20, angle=n(req.query.angle)??20, aspect=n(req.query.aspect)??0;
    if([lat,lon,peak,battery,cons].some(x=>x===null)||peak<=0||battery<=0||cons<=0) return res.status(400).json({error:'Parâmetros off-grid inválidos.'});
    const p=new URLSearchParams({lat:String(lat),lon:String(lon),peakpower:String(peak),batterysize:String(battery),consumptionday:String(cons),cutoff:String(cutoff),angle:String(angle),aspect:String(aspect),outputformat:'json'});
    const r=await fetch(`${PVGIS}?${p}`); const text=await r.text();
    if(!r.ok){let msg=`PVGIS SHScalc indisponível (${r.status}).`;try{msg=JSON.parse(text).message||msg}catch{};throw new Error(msg)}
    const d=JSON.parse(text),o=d?.outputs||{};
    const totals=Array.isArray(o.totals)?(o.totals[0]||{}):(o.totals||{});
    let monthly=o.monthly||[]; if(!Array.isArray(monthly)) monthly=[];
    const get=(...ks)=>{for(const k of ks){const v=n(totals[k]);if(v!==null)return v}return null};
    return res.status(200).json({
      source:'PVGIS 5.3 SHScalc',
      emptyDaysPct:get('f_e','f_empty','percentage_days_empty'),
      fullDaysPct:get('f_f','f_full','percentage_days_full'),
      missingEnergyWh:get('E_miss','E_miss_y','missing_energy'),
      lostEnergyWh:get('E_lost','E_lost_y','lost_energy'),
      monthly,
      totals,
      inputs:d?.inputs||null
    });
  }catch(err){return res.status(500).json({error:err.message||'Falha na validação off-grid PVGIS.'});}
};
