import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Butte County Rental Map",
  description:
    "Interactive rental market map for Butte County, CA with 5,700+ properties and real-time availability tracking.",
}

export default function RentalMapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
