# SolarIA Designer FV — V1

Ferramenta web/PWA para pré-dimensionamento de sistemas fotovoltaicos **on-grid, off-grid e híbridos**.

## Recursos da V1

- Busca de endereço com geocodificação OpenStreetMap/Nominatim.
- Uso da localização do dispositivo pelo navegador.
- Consulta server-side ao PVGIS 5.3 (JRC/Comissão Europeia), evitando o bloqueio CORS do PVGIS no navegador.
- HSP média anual, pior mês, tabela e gráfico mensal.
- Dimensionamento preliminar de potência FV, quantidade de módulos e inversor.
- Off-grid/híbrido: energia nominal do banco, Ah e quantidade de baterias modulares.
- Checagem preliminar de janela MPPT, Voc corrigida por temperatura e paralelismo por corrente.
- Unifilar SVG editável: valores atualizados automaticamente e blocos arrastáveis.
- Exportação do unifilar em SVG.
- Impressão/geração de PDF pelo navegador.
- Salvamento local do projeto.
- PWA básica.

## Deploy no Vercel

1. Envie esta pasta para um repositório GitHub.
2. No Vercel, importe o repositório.
3. Framework Preset: **Other**.
4. Não é necessário Build Command.
5. Node.js: **24.x** (também fixado em `package.json`).
6. Faça o deploy.

As rotas `/api/geocode.js` e `/api/solar.js` serão publicadas como Vercel Functions Node.js. O `vercel.json` não declara `runtime`, pois esse campo é reservado a runtimes customizados; a versão do Node é definida por `engines.node` em `package.json`.

## Arquitetura de dados

- Endereço → `/api/geocode` → Nominatim → latitude/longitude.
- Latitude/longitude → `/api/solar` → PVGIS 5.3 MRcalc → série mensal de irradiação.
- Front-end → algoritmo de dimensionamento → análise elétrica preliminar → unifilar SVG.

## Observação técnica

Esta versão é uma ferramenta de pré-dimensionamento. O projeto executivo deve considerar os dados exatos dos módulos, inversores, baterias, temperaturas de projeto, capacidade de condução de corrente, queda de tensão, curto-circuito, proteção, equipotencialização, aterramento, DPS/SPDA e requisitos da distribuidora, além das normas técnicas aplicáveis.
