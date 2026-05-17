# AlignX — Goal Setting & Tracking Portal

A digital Goal Setting & Tracking Portal supporting the full lifecycle of employee goals — from creation and approval to quarterly check-ins and performance analytics.

##  Live Demo
**https://align-x-six.vercel.app**

##  Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Employee | employee@demo.com | employee123 |
| Manager | manager@demo.com | manager123 |
| Admin / HR | admin@demo.com | admin123 |

##  Features
- **Employee** — Create goals (max 8, total 100% weightage, min 10% each), submit for approval, log quarterly actuals, view auto-computed progress scores, handle rework feedback
- **Manager** — Review & approve goals with inline editing, lock goals, return for rework with comments, quarterly check-in review (planned vs actual), push shared KPIs to team
- **Admin** — Manage goal cycles & windows, add/remove users, unlock goals, export Excel achievement report, full audit trail
- **Analytics** — QoQ trends, employee heatmap, completion rates, thrust area breakdown, radar chart
- **All 4 UoM types** — Numeric Min, Numeric Max, Timeline, Zero-based with auto-computed scores
- **Check-in window enforcement** — quarters locked outside active cycle window

##  Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Charts | Recharts |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Export | SheetJS (client-side Excel) |

##  Total Infrastructure Cost — $0/month
Vercel free tier + Supabase free tier. All score computation and Excel export run client-side — no server costs.

##  Run Locally
```bash
git clone https://github.com/YOURUSERNAME/alignx.git
cd alignx
npm install
npm run dev
```
