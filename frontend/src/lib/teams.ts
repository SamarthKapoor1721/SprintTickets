export const TEAMS = [
  "Tech Team",
  "Growth & Strategy",
  "Product Manager",
  "Product Marketing",
  "Projects Team",
  "HR Team",
] as const

export type Team = (typeof TEAMS)[number]
