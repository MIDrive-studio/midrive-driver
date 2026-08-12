export type PayrollWeeklyStatus = "draft" | "submitted_to_master" | "confirmed";

export type PayrollWeeklyDriver = {
  id: string;
  driver_id: string;
  year: number;
  week: number;

  paid_routes_count: number;
  base_pay: number;
  stops_bonus: number;
  additional_amount: number;
  deductions_amount: number;
  gross_pay: number;
  net_pay: number;

  status: PayrollWeeklyStatus;
};

export type DriverPayslip = {
  id: string;
  driver_id: string;
  year: number;
  week: number;
  total_routes: number;
  gross_pay: number;
  admin_fee: number;
  net_pay: number;
  pdf_path: string | null;
  created_at: string;
};
