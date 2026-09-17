# SolarIA Designer FV V2 — Benchmark de concorrentes

Data do levantamento: 17/09/2026.

Este documento registra as referências usadas para orientar a V2. O objetivo não é copiar interfaces, mas identificar padrões de produto maduros e adaptá-los ao fluxo de profissionais brasileiros, com prioridade para smartphone, pré-projeto rápido e engenharia elétrica verificável.

## 1. Plataformas analisadas

### Aurora Solar
Fonte oficial: https://aurorasolar.com/design-mode/

Recursos observados: ambiente CAD/3D, modelagem assistida por IA, análise de sombreamento baseada em LiDAR, preenchimento automático de módulos, pré-stringing, componentes BOS, relatórios de validação elétrica e integração entre projeto, simulação e fluxo comercial.

**Lição incorporada na V2:** reduzir etapas manuais, calcular e validar em tempo real e apresentar um diagnóstico de compatibilidade antes de o usuário chegar ao relatório.

### OpenSolar
Fonte oficial de stringing: https://support.opensolar.com/hc/en-us/articles/4406931180313-Stringing-Micro-Inverters-and-Power-Optimizers
Site: https://www.opensolar.com/

Recursos observados: stringing manual/automático, MPPT, microinversores/otimizadores, integração com modelos PVWatts/SAM, propostas, hardware, múltiplas opções de sistema e automações de projeto.

**Lição incorporada na V2:** auto-stringing considerando tensão, corrente, MPPT e temperaturas; cenários de porte; projeto salvo/importável.

### HelioScope
Fonte oficial: https://helioscope.aurorasolar.com/product-2/

Recursos observados: projeto comercial rápido, layout, sombreamento, sistemas de cobertura/solo/carport, armazenamento e simulações de produção em fluxo integrado.

**Lição incorporada na V2:** cálculo contínuo e feedback imediato, evitando depender de um processo CAD pesado para o pré-projeto.

### PVsyst
Fonte oficial: https://www.pvsyst.com/en/products/pvsyst/

Recursos observados: perdas detalhadas, múltiplas fontes meteorológicas, bifacialidade, trackers, envelhecimento, cenários, análises econômicas e banco técnico de componentes.

**Lição incorporada na V2:** motor explícito de perdas, PR calculável, fonte meteorológica selecionável, simulação detalhada PVGIS e indicadores econômicos editáveis.

### PV*SOL premium
Fonte oficial: https://valentin-software.com/en/products/pvsol-premium/

Recursos observados: modelagem 3D, sombreamento, sistemas com baterias/cargas, tarifas e relatórios técnicos.

**Lição incorporada na V2:** fluxo solar + carga + armazenamento + economia no mesmo projeto e preparação para uma futura camada 3D.

### Solarius PV — ACCA
Fonte oficial: https://www.accasoftware.com/en/solar-design-software

Recursos observados: projeto FV/BIM/3D, PVGIS/Meteonorm, sombreamento, armazenamento, dimensionamento de cabos, queda de tensão, proteções, esquema unifilar automático/editável, análise econômica, quantitativos e relatórios.

**Lição incorporada na V2:** dar mais peso à engenharia elétrica: cabos por queda de tensão, proteção preliminar, Icc informada pelo usuário, DPS, unifilar e BOM.

### Scanifly
Fonte oficial: https://scanifly.com/

Recursos observados: levantamento por drone, modelo 3D fotorealista, sombreamento, checklists de campo, exportações CAD/racking e integração entre levantamento, projeto e instalação.

**Lição incorporada na V2:** interface de campo mobile-first e arquitetura preparada para futura importação de levantamento/ortofoto/DSM. A V2 NÃO afirma realizar levantamento por drone ou LiDAR.

### PVcase
Fonte oficial: https://pvcase.com/ground-mount/pricing-plans

Recursos observados: projetos utility-scale, terreno, declividade, sombreamento, cabos 3D, yield, BESS, BOM e integração de engenharia.

**Lição incorporada na V2:** resultados estruturados para futura expansão a projetos maiores. A V2 atual é orientada a pré-projeto residencial/comercial e não substitui ferramentas de engenharia de usinas utility-scale.

## 2. Matriz de recursos

| Capacidade | Líderes do mercado | SolarIA V2 |
|---|---|---|
| Endereço / coordenadas | Sim | Sim |
| GPS do smartphone | Em várias plataformas | Sim |
| Irradiação automática | Sim | Sim — PVGIS 5.3 / NASA POWER |
| Consumo mensal | Sim | Sim, 12 meses |
| Cenários de porte | Sim | Sim — 3 cenários rápidos |
| Motor de perdas | Sim | Sim — perdas editáveis e PR |
| Layout preliminar | Sim | Sim — geometria 2D por área disponível |
| 3D/LiDAR real | Aurora/PV*SOL/Scanifly | **Ainda não** — planejado para V3+ |
| Auto-stringing | OpenSolar/Aurora | Sim — tensão, temperatura, corrente e MPPT |
| Simulação energética detalhada | Sim | Sim — PVGIS PVcalc + estimativa interna |
| Bateria | Sim | Sim — energia, DoD, eficiência, potência e autonomia |
| Validação off-grid temporal | Algumas | Sim — PVGIS SHScalc |
| Cabos | Solarius/PVcase | Sim — pré-dimensionamento por ΔV |
| Capacidade de condução Iz completa | Ferramentas elétricas especializadas | **Não automatizada na V2**; exige método de instalação/fatores |
| Proteções | Algumas | Sim — pré-seleção, com Icc opcional |
| Unifilar | Solarius/PVcase e outros | Sim — SVG responsivo, editável e exportável |
| BOM | Sim | Sim |
| VPL/TIR/LCOE/payback | Sim | Sim |
| PWA / smartphone | Variável | Sim — mobile-first |
| Exportar/importar projeto | Sim | Sim — JSON |
| Proposta comercial / assinatura | Aurora/OpenSolar/Solargraf | **Não na V2** — roadmap |
| CRM / pipeline | OpenSolar/Solargraf | **Não na V2** — roadmap |
| Base homologada de equipamentos | PVsyst e ecossistemas | **Não na V2** — roadmap com INMETRO/fabricantes |

## 3. Diferenciais buscados para o SolarIA

1. **Campo primeiro:** todo o pré-projeto pode ser iniciado pelo smartphone.
2. **Engenharia visível:** o usuário enxerga Voc frio, Vmp quente, corrente/MPPT, DC/AC, bateria, queda de tensão e hipóteses.
3. **Sem caixa-preta:** premissas de perdas e financeiro são editáveis.
4. **Brasil:** alertas de MMGD, referências ANEEL/PRODIST/INMETRO e normas brasileiras no fluxo de validação.
5. **Unifilar leve:** SVG editável sem exigir CAD para o pré-projeto.
6. **Duas camadas de simulação:** cálculo instantâneo interno + validação em APIs oficiais/consagradas.
7. **Projeto portátil:** JSON para continuar em outro dispositivo e PWA para uso em campo.

## 4. Limites técnicos declarados

A V2 é uma ferramenta de pré-projeto e apoio à engenharia. Ela não substitui, sem validação do responsável técnico:

- levantamento estrutural;
- análise mecânica de cobertura/estrutura;
- estudo completo de sombreamento 3D;
- capacidade de condução de corrente com método de instalação e fatores de correção;
- estudo de curto-circuito da instalação;
- seletividade/coordenação completa;
- projeto de SPDA/aterramento;
- parecer de acesso e exigências específicas da distribuidora;
- homologação/registro de equipamentos;
- projeto executivo assinado.

## 5. Roadmap recomendado

### V2.1
- biblioteca de módulos/inversores/baterias com importação por CSV/JSON;
- campo para registro INMETRO;
- relatório PDF próprio com capa, premissas, memória de cálculo e BOM;
- tarifas brasileiras por distribuidora (quando houver fonte/API autorizada).

### V3
- editor de planta/telhado com polígonos;
- obstáculos e áreas de exclusão;
- mapa/satélite e orientação real do telhado;
- sombreamento geométrico;
- múltiplos subarranjos/orientações;
- stringing visual por MPPT.

### V4
- fotogrametria/DSM/LiDAR/drone;
- proposta comercial/CRM/assinatura;
- colaboração multiusuário;
- Supabase, organizações e planos pagos;
- motor de regras por distribuidora;
- API pública/integrações.


## 6. Atualização de benchmark — 17/09/2026

A revisão mais recente das fontes oficiais reforçou os seguintes pontos:

- Aurora Solar mantém AutoStringer, simulação/sombreamento, armazenamento integrado ao design, BOM e propostas/plan sets.
- OpenSolar documenta SLD gerado a partir do projeto, com edição de componentes, formas e textos, além de Auto 3D, bateria/retrofit e perfis de consumo.
- PVsyst 8 trabalha com múltiplas orientações, armazenamento, sombreamento 3D/detalhado e modelos bifaciais.
- PV*SOL premium 2026 inclui 3D, análise de sombreamento, bateria, perfis de carga, relatórios e exportação JSON.
- HelioScope prioriza layout automático, sombreamento e solar-plus-storage comercial.
- Solarius PV mantém forte integração entre dimensionamento elétrico, cabos, proteções e unifilar automático.
- PVcase QuickYield evidencia uma tendência importante: cálculo de yield rápido, baseado em geometria + equipamentos + TMY/PVGIS, antes de análises mais pesadas.
- Scanifly separa claramente pré-design remoto de levantamento de precisão por drone, abordagem que também orienta o roadmap da SolarIA.

A V2, portanto, permanece deliberadamente leve no pré-projeto e transfere recursos de alto custo computacional/dados (3D real, LiDAR e drone) para versões futuras.
