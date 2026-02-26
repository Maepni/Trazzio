import { getCompanyColorClass } from "@/lib/company-colors"

interface CompanyBadgeProps {
  companyName: string
  colorKey: string
  className?: string
}

export function CompanyBadge({ companyName, colorKey, className }: CompanyBadgeProps) {
  return (
    <span
      aria-label={`Empresa ${companyName}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getCompanyColorClass(colorKey)} ${className ?? ""}`}
    >
      <span className="font-semibold">EMP</span>
      <span>{companyName}</span>
    </span>
  )
}
