# SolarIA Designer FV V2 Pro — Arquitetura e desempenho

Data: 17/09/2026

## Objetivo de produto

A V2 foi desenhada como uma ferramenta mobile-first de pré-projeto e apoio à engenharia para sistemas on-grid, off-grid e híbridos. A estratégia é entregar resposta rápida no campo e permitir aprofundamento técnico no notebook, sem obrigar o profissional a abrir um CAD pesado para cada estudo preliminar.

## Estratégia de desempenho

1. **Cálculo local imediato** — consumo, PR, potência FV, módulos, stringing, bateria, cabos por queda de tensão, proteções preliminares e financeiro são recalculados no navegador.
2. **APIs externas somente quando agregam precisão** — PVGIS/NASA/geocodificação são chamadas sob demanda; a interface continua utilizável com HSP manual em contingência.
3. **Arquitetura serverless** — as rotas `/api` isolam CORS, timeout e integração com serviços externos, mantendo o front-end leve.
4. **SVG em vez de canvas pesado** — unifilar e gráficos permanecem vetoriais, editáveis e leves em smartphone.
5. **PWA e autosave** — projeto fica disponível no dispositivo e pode ser exportado em JSON para continuidade em outro equipamento.
6. **Responsividade real** — o fluxo usa etapas, grids adaptativos e unifilar vertical em telas menores.

## Diferenciais de engenharia da V2

- cálculo por três arquiteturas: on-grid, off-grid e híbrido;
- PVGIS 5.3 e NASA POWER;
- consumo mensal de 12 meses;
- perdas editáveis e Performance Ratio;
- geometria de telhado/área disponível;
- auto-stringing por Voc, Vmp, temperatura, faixa MPPT e corrente;
- armazenamento por energia, potência, DoD, eficiência e autonomia;
- validação off-grid por PVGIS SHScalc;
- cabos CC/CA por queda de tensão;
- pré-seleção de disjuntores/fusíveis/DPS e entrada opcional de Icc;
- CAPEX, payback, VPL, TIR e LCOE;
- BOM;
- unifilar SVG editável;
- exportação/importação do projeto em JSON.

## Benchmark — decisão de produto

O mercado avançado converge para quatro blocos: modelagem do local, simulação energética, engenharia elétrica e proposta/comercial. A V2 prioriza os três últimos no fluxo leve. Modelagem 3D/LiDAR/drone fica fora da promessa atual porque depende de dados e infraestrutura específicos.

### Recursos observados nas referências oficiais

- **Aurora Solar:** modelagem do local, sombreamento, AutoStringer, armazenamento integrado, BOM, propostas e plan sets.
- **OpenSolar:** Auto 3D, baterias/retrofit, perfis de consumo, payback, propostas e SLD editável.
- **HelioScope:** layout automático, sombreamento e projetos comercial + storage.
- **PVsyst:** múltiplas orientações, armazenamento, sombreamento detalhado, bifacialidade, perdas e análises econômicas.
- **PV*SOL premium:** 3D, sombreamento, armazenamento, perfis de carga, relatórios e JSON.
- **Solarius PV:** cabos, proteções, queda de tensão e unifilar automático/editável.
- **PVcase:** fluxo integrado de design/yield e cálculo rápido apoiado em dados PVGIS.
- **Scanifly:** pré-design remoto, LiDAR/drone, sombreamento e proposta.

## O que NÃO está sendo afirmado na V2

A V2 não afirma possuir:

- LiDAR, fotogrametria ou voo de drone;
- sombreamento 3D por obstáculos reais;
- cálculo estrutural de cobertura;
- modelo bifacial físico detalhado;
- cálculo completo de Iz com método de instalação e todos os fatores de correção;
- seletividade/coordenação completa;
- banco homologado automático de equipamentos;
- parecer de acesso ou aprovação de distribuidora;
- CRM/assinatura eletrônica.

Esses blocos devem entrar apenas quando houver dados, regras e testes suficientes para uma implementação confiável.

## Próxima evolução recomendada

### V2.1 — comercializável
- biblioteca de equipamentos por fabricante + importação CSV/JSON;
- dados de registro/certificação INMETRO quando disponíveis por fonte autorizada;
- relatório PDF próprio, sem depender da impressão do navegador;
- proposta comercial resumida;
- perfis de carga residencial/comercial/industrial;
- múltiplas opções de sistema no mesmo cliente.

### V3 — geometria e sombreamento
- polígonos de telhado;
- obstáculos/keepouts;
- múltiplos subarranjos/orientações;
- mapa/satélite;
- stringing visual por MPPT;
- sombreamento geométrico.

### V4 — SaaS completo
- Supabase multiempresa/multiusuário;
- clientes, projetos e pipeline;
- propostas e assinatura;
- regras por distribuidora;
- integrações com inversores, monitoramento e APIs externas;
- camada opcional de drone/LiDAR/DSM.
