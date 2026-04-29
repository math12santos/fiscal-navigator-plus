# Reformulação do Controle de Férias (CLT)

## Problema atual
Hoje `DPFerias.tsx` usa só `admission_date` para calcular um único "período corrente" e classifica em Regular / Urgente / Vencida. Isso ignora a CLT:
- Cada 12 meses gera **um novo período aquisitivo** (PA).
- O empregador tem **12 meses concessivos** após o fim do PA para conceder o gozo. Passou disso → férias em dobro (multa).
- Um colaborador pode ter **vários PAs em aberto** (até 2 já é alerta máximo).
- Faltam: registrar gozos efetivos, venda de até 1/3 (abono pecuniário), e tempo até o próximo PA vencer.

A tabela `employee_vacations` já tem `periodo_aquisitivo_inicio/fim`, `dias_gozados`, `dias_vendidos` — mas o componente não consome esses dados.

## O que vamos entregar

### 1. Engine de cálculo CLT (novo `src/lib/vacationCalculations.ts`)
Para cada colaborador ativo (CLT), gerar a lista de períodos aquisitivos desde a admissão até hoje:
- PA `n`: início = `admissão + (n-1) anos`, fim = `admissão + n anos`.
- Limite concessivo (deadline para gozo) = `fim do PA + 12 meses`.
- Para cada PA, agregar de `employee_vacations`: `dias_gozados`, `dias_vendidos`, saldo restante (`30 - gozados - vendidos`).
- Status do PA:
  - `gozado` — saldo = 0 e há gozo registrado.
  - `agendado` — existe vacation com `data_inicio` futura.
  - `em_dia` — PA ainda dentro do prazo concessivo, sem urgência.
  - `proximo_vencimento` — faltam ≤ 3 meses para o limite concessivo.
  - `vencido_em_dobro` — passou do limite concessivo sem gozo → multa (dobra).
- Próximo PA a vencer: PA aberto mais antigo + sua `limitDate`.
- Tempo até próximo PA: meses entre hoje e o fim do próximo PA ainda não adquirido.

### 2. UI de `DPFerias.tsx` reformulada
**Coluna "Meses Trabalhados" → "Meses com Férias Acumuladas"** (saldo de dias não gozados convertido em meses-equivalente, ou mostrar `dias acumulados`).

Nova tabela "Controle de Férias" por colaborador (uma linha por colaborador, colunas):
1. Colaborador
2. Períodos em aberto (badge contador, ex.: `2 PA abertos`)
3. Dias acumulados não gozados
4. Próximo PA — data limite concessivo
5. **Tempo até vencer** (ex.: "em 4 meses", "vencido há 2 meses")
6. **Tempo até próximas férias** (quando se completa o próximo PA ainda não adquirido)
7. Status (badges):
   - `Em dia`
   - `Próximo do vencimento` (≤ 3 meses)
   - `Vencido — pagamento em dobro` (vermelho)
   - `2+ PAs em aberto` (vermelho — risco de multa iminente)
8. Provisão acumulada (R$)
9. Ações: **Registrar gozo** / **Registrar venda (abono)**

Linha expansível (Accordion) mostrando cada PA do colaborador com: período, dias gozados, vendidos, saldo, status individual.

### 3. Diálogo "Registrar Gozo / Venda" (novo `RegisterVacationDialog.tsx`)
Campos:
- Período aquisitivo (select dos PAs em aberto do colaborador)
- Tipo: **Gozo** (data início + dias, máx. 30 - já usados) **ou** **Venda — abono pecuniário** (dias, máx. **1/3** = 10 dias por PA, conforme CLT art. 143)
- Data início (gozo) / data referência (venda)
- Cálculo automático de `valor_ferias`, `valor_terco`, `valor_total` baseado em `salary_base`
- Validações:
  - `dias_gozados + dias_vendidos ≤ 30` por PA
  - `dias_vendidos ≤ 10` por PA
  - Gozo mínimo de 14 dias contínuos (alerta, não bloqueio — fracionamento permitido pela Reforma Trabalhista)

Persiste em `employee_vacations` (insert ou update do registro do PA).

### 4. Migration leve
Adicionar (nullable, defaults):
- `employee_vacations.tipo` text default `'gozo'` — valores: `gozo`, `abono_venda`, `programado`.
- `employee_vacations.observacoes` text.
- Constraint check: `dias_vendidos <= 10` e `(dias_gozados + dias_vendidos) <= 30` por linha.
- Index `(organization_id, employee_id, periodo_aquisitivo_inicio)`.

### 5. Exports atualizados
PDF/Excel passam a refletir as novas colunas (Meses Acumulados, Tempo até vencer, Status CLT, PAs abertos).

## Detalhes técnicos
- `differenceInMonths` de `date-fns` para todos os cálculos de tempo.
- Toda a lógica nova fica em `src/lib/vacationCalculations.ts` com testes unitários (`*.test.ts`) cobrindo: 1 PA em dia, 1 PA próximo, 1 PA vencido (dobra), 2 PAs simultâneos, gozo parcial, venda 10 dias.
- `useVacations` continua igual; a agregação por PA é feita no client (volume baixo).
- Memória atualizada: criar `mem://features/vacation-clt-engine`.

## Fora do escopo
- Geração automática de evento de pagamento na folha quando o gozo é registrado (pode entrar em segunda iteração via `payroll_events`).
- Abono de 1/3 constitucional na rescisão (já existe em `terminationCalculations`).