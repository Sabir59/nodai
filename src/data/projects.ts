export interface CaseStudy {
  slug: string
  number: string
  category: string
  year: string
  title: string
  summary: string
  role: string
  href: string
}

export const caseStudies: CaseStudy[] = [
  {
    slug: "matw",
    number: "01 / 02",
    category: "Donation platform",
    year: "Ongoing",
    title: "MATW",
    summary: "Engineering a donation checkout that stays coherent across three payment providers.",
    role: "Engineering partner",
    href: "/work/matw",
  },
  {
    slug: "teekpay",
    number: "02 / 02",
    category: "Fintech product",
    year: "In progress",
    title: "TeekPay",
    summary: "The engineering principles guiding a new payments product, from the ground up.",
    role: "Engineering partner",
    href: "/work/teekpay",
  },
]
