export interface Location {
  id: string;
  name: string;
  pod_count: number;
  has_landfill_dumpster: boolean;
  has_recycling_dumpster: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon_name: string | null;
  is_accepted: boolean;
  sort_order: number;
  created_at: string;
}

export interface Coordinator {
  id: string;
  user_id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Pod {
  id: string;
  location_id: string;
  pod_number: string;
  pod_type: "receiving" | "storage";
  status: "active" | "filling" | "full" | "closed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  category_id: string;
  location_id: string;
  coordinator_id: string;
  pod_id: string | null;
  item_description: string | null;
  quantity: number;
  is_accepted: boolean;
  rejection_reason: string | null;
  created_at: string;
}

export interface DonationSummary {
  location_name: string;
  category_name: string;
  color: string;
  item_count: number;
  total_quantity: number;
}

export interface LocationTotal {
  location_id: string;
  location_name: string;
  total_donations: number;
  total_items: number;
  coordinators_active: number;
}

export interface Visitor {
  id: string;
  name: string;
  email: string;
  affiliation: string;
  created_at: string;
}

export interface DepotInventory {
  category_id: string;
  category_name: string;
  in_stock: number;
  total_in: number;
  total_out: number;
}