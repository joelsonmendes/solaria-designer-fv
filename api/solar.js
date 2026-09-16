const PVGIS = 'https://re.jrc.ec.europa.eu/api/v5_3/MRcalc';

function daysInMonth(m) {
  return [31,28.25,31,30,31,30,31,31,30,31,30,31][m - 1] || 30.4375;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findOptimalSlope(inputs) {
  const candidates = [
    inputs?.plane?.['fixed(i_opt)']?.slope?.value,
    inputs?.plane?.fixed_inclined_optimal?.slope?.value,
    inputs?.plane?.fixed?.slope?.value
  ];
  for (const c of candidates) {
    const n = safeNum(c);
    if (n !== null) return n;
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Latitude/longitude inválidas.' });
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      horirrad: '1',
      optrad: '1',
      avtemp: '1',
      outputformat: 'json'
    });

    const r = await fetch(`${PVGIS}?${params}`);
    const text = await r.text();
    if (!r.ok) {
      let msg = `PVGIS indisponível (${r.status}).`;
      try { msg = JSON.parse(text).message || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = JSON.parse(text);
    const rows = Array.isArray(data?.outputs?.monthly) ? data.outputs.monthly : [];
    if (!rows.length) throw new Error('PVGIS não retornou série mensal para este ponto.');

    const grouped = Array.from({ length: 12 }, () => []);
    for (const row of rows) {
      const m = Number(row.month);
      if (m >= 1 && m <= 12) grouped[m - 1].push(row);
    }

    const monthly = grouped.map((arr, i) => {
      const mean = (field) => {
        const vals = arr.map(x => safeNum(x[field])).filter(x => x !== null);
        return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null;
      };
      const opt = mean('H(i_opt)_m');
      const hor = mean('H(h)_m');
      const temp = mean('T2m');
      const irradiation = opt ?? hor ?? 0;
      const hsp = irradiation / daysInMonth(i + 1);
      return {
        month: i + 1,
        irradiation: Number(irradiation.toFixed(2)),
        horizontal: hor === null ? null : Number(hor.toFixed(2)),
        optimal: opt === null ? null : Number(opt.toFixed(2)),
        hsp: Number(hsp.toFixed(3)),
        temperature: temp === null ? null : Number(temp.toFixed(1))
      };
    });

    const annualIrradiation = monthly.reduce((s, m) => s + (m.irradiation || 0), 0);
    const avgHsp = annualIrradiation / 365.25;
    const validHsp = monthly.map(m => m.hsp).filter(v => v > 0);
    const worstHsp = validHsp.length ? Math.min(...validHsp) : null;
    const bestHsp = validHsp.length ? Math.max(...validHsp) : null;
    const years = [...new Set(rows.map(r => Number(r.year)).filter(Number.isFinite))].sort((a,b)=>a-b);

    return res.status(200).json({
      source: 'PVGIS 5.3 / JRC European Commission',
      lat,
      lon,
      radiationDatabase: data?.inputs?.meteo_data?.radiation_db || null,
      yearMin: years[0] || data?.inputs?.meteo_data?.year_min || null,
      yearMax: years.at(-1) || data?.inputs?.meteo_data?.year_max || null,
      optimalSlope: findOptimalSlope(data?.inputs),
      annualIrradiation: Number(annualIrradiation.toFixed(1)),
      avgHsp: Number(avgHsp.toFixed(3)),
      worstHsp: worstHsp === null ? null : Number(worstHsp.toFixed(3)),
      bestHsp: bestHsp === null ? null : Number(bestHsp.toFixed(3)),
      monthly
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Falha ao consultar PVGIS.' });
  }
};
