---
name: TI Equipment Kits & Lifecycle (Fase 2)
description: Kits templates de equipamentos, alocação automática a colaboradores, view consolidada por pessoa e alertas de fim de vida útil
type: feature
---

## Estrutura

- **it_equipment_kits**: templates (Kit Dev, Kit Vendedor) — name, description, active
- **it_equipment_kit_items**: composição (equipment_type, equipment_subtype, quantity, suggested_specs jsonb)
- **it_employee_kit_assignments**: histórico de atribuições (kit, employee, status: ativo|parcial|devolvido)

## RPCs

- `it_assign_kit_to_employee(p_kit_id, p_employee_id, p_notes)` → SECURITY DEFINER. Aloca it_equipment disponíveis (status=disponivel, sem responsável) marcando-os como em_uso para o colaborador. Itens não disponíveis viram `missing[]` e a atribuição fica `parcial`.
- `it_get_lifecycle_alerts(p_org_id)` → STABLE. Calcula end_of_life_date = acquisition_date + useful_life_economic_months (default 48). alert_level: expired|critical(≤6m)|warning(≤12m)|ok|unknown. Marca review_overdue se next_replacement_review_date < hoje.

## View

- `it_equipment_by_employee` (security_invoker): agrupa equipamentos ativos por colaborador com total_acquisition_value, home_office_count, next_review_date e jsonb dos equipamentos.

## UI (TI page)

- Aba **Por colaborador**: consumo de `useEquipmentByEmployee`
- Aba **Kits**: CRUD via `KitFormDialog` + atribuição via `AssignKitDialog`
- Aba **Ciclo de vida**: `useITLifecycleAlerts` ordenado por severidade

## Hooks

- `useITKits`: list/upsertKit/removeKit/assign
- `useEquipmentByEmployee`
- `useITLifecycleAlerts`
