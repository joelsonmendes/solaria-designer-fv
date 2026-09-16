const NOMINATIM = 'https://nominatim.openstreetmap.org';
const APP_UA = 'SolarIA-Designer-FV/1.0 (educational photovoltaic sizing tool)';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  try {
    const { q, lat, lon } = req.query;
    let url;
    if (q) {
      const p = new URLSearchParams({ q: String(q), format: 'jsonv2', addressdetails: '1', limit: '5' });
      url = `${NOMINATIM}/search?${p}`;
    } else if (lat && lon) {
      const p = new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'jsonv2', addressdetails: '1', zoom: '18' });
      url = `${NOMINATIM}/reverse?${p}`;
    } else {
      return res.status(400).json({ error: 'Informe q (endereço) ou lat/lon.' });
    }

    const r = await fetch(url, {
      headers: {
        'User-Agent': APP_UA,
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7'
      }
    });
    if (!r.ok) throw new Error(`Geocodificação indisponível (${r.status}).`);
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Falha na geocodificação.' });
  }
};
