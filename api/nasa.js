const NASA = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
const MONTH_KEYS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAYS = [31,28.25,31,30,31,30,31,31,30,31,30,31];

function finite(v){ const n=Number(v); return Number.isFinite(n) && n > -900 ? n : null; }
function readMonth(obj, i){
  if (!obj) return null;
  const keys=[MONTH_KEYS[i], String(i+1), String(i+1).padStart(2,'0')];
  for (const k of keys){ const n=finite(obj[k]); if(n!==null) return n; }
  return null;
}

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  try{
    const lat=Number(req.query.lat), lon=Number(req.query.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180){
      return res.status(400).json({error:'Latitude/longitude inválidas.'});
    }
    const p=new URLSearchParams({
      parameters:'ALLSKY_SFC_SW_DWN,T2M',
      community:'RE', longitude:String(lon), latitude:String(lat), format:'JSON'
    });
    const r=await fetch(`${NASA}?${p}`,{headers:{Accept:'application/json'}});
    const text=await r.text();
    if(!r.ok){ throw new Error(`NASA POWER indisponível (${r.status}).`); }
    const data=JSON.parse(text);
    const pars=data?.properties?.parameter || {};
    const sw=pars.ALLSKY_SFC_SW_DWN || {};
    const t2=pars.T2M || {};
    const monthly=MONTH_KEYS.map((_,i)=>{
      const hsp=readMonth(sw,i) ?? 0;
      const temp=readMonth(t2,i);
      return {month:i+1, hsp:Number(hsp.toFixed(3)), irradiation:Number((hsp*DAYS[i]).toFixed(2)), temperature:temp===null?null:Number(temp.toFixed(1))};
    });
    const annualIrradiation=monthly.reduce((s,m)=>s+m.irradiation,0);
    const valid=monthly.map(m=>m.hsp).filter(v=>v>0);
    return res.status(200).json({
      source:'NASA POWER Climatology', lat, lon,
      radiationDatabase:'NASA POWER / ALLSKY_SFC_SW_DWN',
      yearMin:null, yearMax:null, optimalSlope:null,
      annualIrradiation:Number(annualIrradiation.toFixed(1)),
      avgHsp:Number((annualIrradiation/365.25).toFixed(3)),
      worstHsp:valid.length?Number(Math.min(...valid).toFixed(3)):null,
      bestHsp:valid.length?Number(Math.max(...valid).toFixed(3)):null,
      monthly
    });
  }catch(err){
    return res.status(500).json({error:err.message||'Falha ao consultar NASA POWER.'});
  }
};
