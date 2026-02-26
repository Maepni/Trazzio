const COLOR_CLASSES: Record<string, string> = {
  default: "bg-blue-100 text-blue-800",
}

const PRESET_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
  "bg-orange-100 text-orange-800",
]

function hashKey(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % PRESET_COLORS.length
  }
  return hash
}

export function getCompanyColorClass(colorKey: string): string {
  if (COLOR_CLASSES[colorKey]) return COLOR_CLASSES[colorKey]
  return PRESET_COLORS[hashKey(colorKey)]
}
