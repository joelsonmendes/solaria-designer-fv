# Relatório de validação — SolarIA Designer FV V2

Data: 16/09/2026

## Testes de interface

- Smartphone: 390 × 844 — sem overflow horizontal, sem erro de JavaScript.
- Tablet: 768 × 1024 — sem overflow horizontal, sem erro de JavaScript.
- Notebook/Desktop: 1440 × 1000 — sem overflow horizontal, sem erro de JavaScript.
- Controle HSP manual criado corretamente.
- Cálculo inicial renderizado corretamente.

## Teste integrado do modo Híbrido

- Navegação até Resultados: OK.
- Potência FV: renderizada.
- Banco de baterias: renderizado.
- Diagnóstico: 8 alertas/regras no cenário padrão.
- BOM: 11 linhas no cenário padrão.
- Unifilar: renderizado.
- ViewBox mobile: 0 0 360 650.
- ViewBox desktop: 0 0 1120 470.

## Testes unitários de parsing das APIs

Com respostas simuladas, foram validados:

- PVGIS MRcalc: 12 meses + HSP anual.
- NASA POWER Climatology: 12 meses + irradiação anual.
- PVGIS PVcalc: geração anual e mensal.
- PVGIS SHScalc: percentual de bateria vazia/cheia e energia faltante.

## Sintaxe

`node --check` aprovado para:

- app.js
- api/geocode.js
- api/solar.js
- api/nasa.js
- api/pvcalc.js
- api/offgrid.js

## Observação

A validação acima verifica integridade da interface, fluxo e parsers. A disponibilidade de serviços externos (PVGIS, NASA POWER, Nominatim) depende da internet e das políticas/rate limits de cada provedor no momento da consulta.
