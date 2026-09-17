# SolarIA Designer FV V2 Pro

Ferramenta web/PWA mobile-first para pré-dimensionamento de sistemas fotovoltaicos **on-grid, off-grid e híbridos**.

## O que mudou na V2

- fluxo guiado em 8 etapas;
- endereço, coordenadas e GPS;
- PVGIS 5.3 + NASA POWER;
- 12 meses de consumo;
- cenários 80/100/120% (ou equivalentes no off-grid);
- motor de perdas e Performance Ratio;
- pré-layout geométrico 2D;
- auto-stringing por Voc/Vmp, temperatura, corrente e MPPT;
- bateria por energia, potência, DoD e eficiência;
- validação off-grid via PVGIS SHScalc;
- cabos CC/CA por queda de tensão;
- proteções preliminares, Icc e DPS;
- CAPEX, economia, payback, VPL, TIR e LCOE;
- PVGIS PVcalc para produção detalhada;
- diagnóstico técnico automático;
- BOM;
- unifilar SVG editável e responsivo;
- exportação/importação JSON;
- impressão/PDF pelo navegador;
- PWA e autosave local.

Leia também `BENCHMARK_CONCORRENTES.md` e `ARQUITETURA_E_DESEMPENHO.md`.

## Publicar no Vercel

1. Envie todo o conteúdo desta pasta para a raiz do repositório GitHub.
2. No Vercel, importe/conecte o repositório.
3. Framework Preset: **Other** (ou autodetectado).
4. Não defina Output Directory.
5. Faça o deploy.

O `vercel.json` não força um runtime customizado; as funções JavaScript em `/api` usam o runtime Node.js do projeto. O `package.json` fixa Node 24.x.

## APIs

- `/api/geocode` — Nominatim/OpenStreetMap, busca/reversa.
- `/api/solar` — PVGIS 5.3 MRcalc.
- `/api/nasa` — NASA POWER Climatology.
- `/api/pvcalc` — PVGIS 5.3 PVcalc.
- `/api/offgrid` — PVGIS 5.3 SHScalc.

## Convenção de azimute na interface

A interface utiliza azimute de bússola:
- 0° = Norte
- 90° = Leste
- 180° = Sul
- 270° = Oeste

Ao chamar o PVGIS, a aplicação converte automaticamente para a convenção da API PVGIS.

## Segurança e responsabilidade técnica

Os resultados de cabo e proteção são **pré-dimensionamentos**. A seleção executiva deve conferir capacidade de condução, método de instalação, temperatura, agrupamento, curto-circuito, seletividade, coordenação, DPS, aterramento, SPDA, documentação dos fabricantes e requisitos da distribuidora.

Referências indicativas: ABNT NBR 16690, ABNT NBR 5410, ABNT NBR 5419, IEC 60364, ANEEL/PRODIST e INMETRO. Confirme sempre a edição vigente e os requisitos locais.
