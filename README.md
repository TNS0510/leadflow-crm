
# LeadFlow CRM (Customer & Follow-up Management System)

A secure, role-based Customer Relationship Management (CRM) web application built for multi-tier sales organizations. Designed around a strict security model using **PostgreSQL Row Level Security (RLS)**, **Supabase Auth**, **TypeScript**, and **React**.

---

## Technical Stack & Infrastructure

*   **Frontend**: React 18 (SPA), TypeScript, Vite, Tailwind CSS
*   **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Auth / JWT)
*   **Database Procedures**: PostgreSQL PL/pgSQL Atomic Functions (`RPC`)
*   **Version Control & CI**: Git, GitHub

---

## Architecture & Security Boundary

```text
Sales Representative / Team Lead
              |
              v
     React + TypeScript (Vite SPA)
              |
              v
       DashboardLayout (Shared Navigation & Session Shell)
              |
     +--------+--------+
     |                 |
     v                 v
SalesRepDashboard   TeamLeadDashboard
     |                 |
     +--------+--------+
              |
              v
       Supabase Client
              |
     +--------+--------+
     |                 |
     v                 v
 Supabase Auth   PostgreSQL Database
                       |
              Row Level Security (RLS)
                       |
              Application Data Tables

```

### Security Principle

Frontend route guards only manage user experience; **PostgreSQL RLS policies define the hard security boundary**. Hiding UI components does not replace database security. Every read, write, and update request is evaluated by PostgreSQL against the authenticated user's JWT claim (`auth.uid()`).

---

## Core Features & Verified Capabilities

### 1. Unified Routing & Dynamic RBAC

* Centralized protected route (`/dashboard`) wrapped in `<DashboardLayout>`.
* Dynamically inspects `public.users.role` to render either `<TeamLeadDashboard />` or `<SalesRepDashboard />`.

### 2. Team Lead Oversight & Inline Reassignment

* Full visibility across all company leads.
* Filter leads by assigned representative using memoized state.
* Database-first inline reassignment with request locks (`updatingLeadId`) to prevent race conditions during updates.

### 3. Sales Representative Workspace & Interaction Tracking

* Restricted work queue displaying only leads assigned to `auth.uid()`.
* **Atomic Interaction Logging**: Uses a stored database procedure (`update_lead_status_with_interaction`) to simultaneously update lead status and record an immutable audit note in `public.lead_interactions`.
* Mandatory validation for loss reasons when marking a lead as `Lost`.

---

## Database Design

### `public.users`

Extends `auth.users` with role-based attributes.

* `id` (UUID, Primary Key, references `auth.users.id`)
* `email` (Text)
* `role` (Text: `'team_lead'` | `'sales_rep'`)

### `public.leads`

Stores lead records and pipeline states.

* `id` (UUID, Primary Key)
* `customer_name` (Text)
* `contact_info` (Text)
* `inquiry_source` (Text)
* `product_of_interest` (Text)
* `status` (Text: `'new'` | `'contacted'` | `'follow_up_scheduled'` | `'won'` | `'lost'`)
* `loss_reason` (Text, Nullable)
* `assigned_to` (UUID, Foreign Key referencing `public.users.id`)

### `public.lead_interactions`

Audit trail for follow-up activities.

* `id` (UUID, Primary Key)
* `lead_id` (UUID, Foreign Key referencing `public.leads.id`)
* `created_by` (UUID, Foreign Key referencing `public.users.id`)
* `interaction_type` (Text: `'call'` | `'email'` | `'meeting'` | `'note'` | `'status_change'`)
* `notes` (Text)
* `created_at` (Timestamp)

---

## Getting Started

### Prerequisites

* Node.js (v18+ recommended)
* Git
* A Supabase project with configured tables and RLS policies

### Setup Instructions

1. **Clone the repository**:
```bash
git clone [https://github.com/TNS0510/leadflow-crm.git](https://github.com/TNS0510/leadflow-crm.git)
cd leadflow-crm

```


2. **Install dependencies**:
```bash
npm install

```


3. **Configure Environment Variables**:
Create a `.env` file in the root folder based on `.env.example`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

```


4. **Run Development Server**:
```bash
npm run dev

```


5. **Verify Production Build**:
```bash
npm run build

```



---

## Engineering Quality Verification

Before committing changes to main, the codebase passed the following quality gates:

* [x] **TypeScript Compilation**: `tsc -b` passes without errors.
* [x] **Production Bundle**: Vite build completes under 1s with clean chunking.
* [x] **RLS Verification**: Tested cross-role isolation (`sales_rep` cannot view or mutate unauthorized leads).
* [x] **Session Persistence**: Checked session survival across browser refreshes and tab navigations.

---

## Author

**Abubakar Jibrin Muhammad**

* **GitHub**: [github.com/TNS0510](https://github.com/TNS0510)
* **Portfolio**: [portfolio-compiler.vercel.app](https://portfolio-compiler.vercel.app/)
