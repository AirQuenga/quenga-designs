import { FMRDashboard } from "@/components/calculator/fmr-dashboard"

export const metadata = {
  title: "2026 FMR Calculator | Butte County Rental Atlas",
  description: "Calculate Fair Market Rent and utility allowances for Butte County Section 8 housing",
}

export default function CalculatorPage() {
  return <FMRDashboard />
}
