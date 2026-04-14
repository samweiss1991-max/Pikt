/** @typedef {typeof INDUSTRIES[number]} Industry */
/** @typedef {typeof SENIORITY[number]} SeniorityOption */

export const INDUSTRIES = [
  "Technology", "Sales & Revenue", "Finance & FinTech", "Marketing & Growth",
  "Product & Design", "Operations", "Data & Analytics", "People & HR",
  "Customer Success", "Legal & Compliance",
]

export const ROLES = {
  "Technology": ["Software Engineer","Solutions Architect","DevOps/Cloud Engineer","Security Engineer","Mobile Engineer","Frontend Engineer","Backend Engineer","ML/AI Engineer","Platform Engineer","QA/Test Engineer"],
  "Sales & Revenue": ["Account Executive","SDR/BDR","Head of Sales","Enterprise Sales","Partnerships Manager","Sales Operations","Revenue Operations"],
  "Finance & FinTech": ["Financial Analyst","CFO/Finance Director","Finance Manager","FP&A","Risk & Compliance","FinTech Product","Accountant"],
  "Marketing & Growth": ["Growth Marketer","Performance Marketing","Content/SEO","Social Media","Brand Manager","CRM/Email","Head of Marketing"],
  "Product & Design": ["Product Manager","UX/UI Designer","UX Researcher","Product Designer","Head of Product","Design Lead"],
  "Operations": ["Operations Manager","COO","Supply Chain","Project Manager","Process Improvement"],
  "Data & Analytics": ["Data Analyst","Data Scientist","Data Engineer","Analytics Engineer","ML Engineer","BI Developer","Head of Data"],
  "People & HR": ["Talent Acquisition","HR Business Partner","People Ops","L&D Manager","Chief People Officer"],
  "Customer Success": ["Customer Success Manager","Account Manager","Head of CS","Support Lead","Renewals Manager"],
  "Legal & Compliance": ["General Counsel","Legal Counsel","Compliance Manager","Contract Manager","Privacy/GDPR"],
}

export const ALL_ROLES = [...new Set(Object.values(ROLES).flat())].sort()

export const SENIORITY = [
  "Junior (0\u20132 yrs)", "Mid-level (3\u20135 yrs)", "Senior (5\u20138 yrs)",
  "Lead/Principal", "Head of/Director", "VP/C-suite", "Any level \u2014 show all",
]

export const SENIORITY_OPTIONS = SENIORITY

export const LOCATIONS = [
  "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Remote", "Any location",
]

export const SALARY_BANDS = [
  "$80k \u2013 $120k", "$120k \u2013 $160k", "$160k \u2013 $200k",
  "$200k \u2013 $250k", "$250k+", "Any range",
]

export const CANDIDATES = [
  { id: "1", role: "Senior Backend Engineer", seniority: "Senior", city: "Sydney", company: "Canva", skills: ["Go","PostgreSQL","Kubernetes"], interviews: 4, fee: 8, salaryLow: 170000, salaryHigh: 195000, years: 7, daysAgo: 2, popular: true },
  { id: "2", role: "Product Manager", seniority: "Mid-level", city: "Melbourne", company: "Atlassian", skills: ["Product Strategy","SQL","Figma"], interviews: 3, fee: 8, salaryLow: 140000, salaryHigh: 160000, years: 5, daysAgo: 5, popular: false },
  { id: "3", role: "Staff Frontend Engineer", seniority: "Staff/Lead", city: "Brisbane", company: "SafetyCulture", skills: ["React","TypeScript","GraphQL"], interviews: 5, fee: 8, salaryLow: 190000, salaryHigh: 220000, years: 9, daysAgo: 1, popular: true },
  { id: "4", role: "Data Engineer", seniority: "Senior", city: "Sydney", company: "Zip Co", skills: ["Python","Spark","Airflow","dbt"], interviews: 3, fee: 10, salaryLow: 155000, salaryHigh: 175000, years: 6, daysAgo: 14, popular: false },
]

export const WORK_HISTORY = [
  { company: "Canva", tenure: "3 yrs", dates: "Jan 2022 \u2013 Present", achievement: "Led migration of 2.4M user accounts to microservices, reducing p99 latency by 68%." },
  { company: "Atlassian", tenure: "2 yrs", dates: "Mar 2020 \u2013 Dec 2021", achievement: "Built real-time collaboration backend handling 50k concurrent connections." },
  { company: "Zip Co", tenure: "1.5 yrs", dates: "Jul 2018 \u2013 Feb 2020", achievement: "Designed payment pipeline processing $2M+ daily transactions." },
]

export const SKILL_CLUSTERS = [
  { name: "Backend Systems", tags: ["Go","PostgreSQL","gRPC"] },
  { name: "Cloud Infrastructure", tags: ["AWS","Terraform","Kubernetes"] },
  { name: "Data Pipeline", tags: ["Kafka","Redis","Spark"] },
]
