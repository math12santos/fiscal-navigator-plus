export interface ITEquipment {
  id: string;
  organization_id: string;
  tag?: string | null;
  modelo?: string | null;
  status?: string | null;
  data_compra?: string | null;
  valor_compra?: number | null;
  cost_center_id?: string | null;
  created_at: string;
}
