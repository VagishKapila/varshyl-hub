# Varshyl Hub - React Frontend

A modern React + Vite frontend for the Varshyl Business Hub CEO Command Center dashboard.

## Features

- **Dashboard**: Real-time overview of all products and metrics
- **Revenue Management**: Detailed revenue analytics with MRR, ARR, DRR tracking
- **Alerts**: System alerts with severity filtering and bulk resolution
- **Product Details**: Per-product health metrics, charts, activity logs, and user management
- **Activity Log**: Full audit trail with search and filtering
- **Admin Management**: Create, delete, and manage administrator accounts
- **Product Management**: Add, edit, toggle, and manage products with API key regeneration

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router DOM v6** - Client-side routing
- **Chart.js 4** - Data visualization
- **React ChartJS-2** - Chart wrapper components

## Project Structure

```
client/
├── index.html                  # HTML entry point
├── vite.config.js             # Vite configuration
├── package.json               # Dependencies
└── src/
    ├── main.jsx               # React entry point
    ├── App.jsx                # Main app component with routing
    ├── styles/
    │   └── globals.css        # Global styles and CSS variables
    ├── context/
    │   └── AuthContext.jsx    # Authentication state management
    ├── hooks/
    │   ├── useApi.js          # Data fetching hook
    │   └── useToast.js        # Toast notification system
    ├── services/
    │   └── api.js             # API client with auth
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.jsx     # Main layout wrapper
    │   │   ├── Sidebar.jsx    # Navigation sidebar
    │   │   └── Toast.jsx      # Toast notifications
    │   ├── common/
    │   │   ├── KpiCard.jsx    # KPI metric card
    │   │   ├── ChartCard.jsx  # Chart container
    │   │   ├── Badge.jsx      # Status badge
    │   │   ├── Button.jsx     # Button variants
    │   │   ├── Modal.jsx      # Reusable modal
    │   │   ├── DataTable.jsx  # Data table
    │   │   ├── EmptyState.jsx # Empty state
    │   │   └── PageHeader.jsx # Page title/actions
    │   └── charts/
    │       ├── LineChart.jsx  # Line/area charts
    │       ├── BarChart.jsx   # Bar charts
    │       └── DoughnutChart.jsx # Pie/donut charts
    └── pages/
        ├── Login.jsx          # Authentication
        ├── Dashboard.jsx      # Main dashboard
        ├── Revenue.jsx        # Revenue analytics
        ├── Alerts.jsx         # Alerts management
        ├── ProductDetail.jsx  # Product metrics & users
        ├── ActivityLog.jsx    # Audit trail
        ├── ManageAdmins.jsx   # Admin management
        └── ManageProducts.jsx # Product management
```

## Setup & Development

### Installation

```bash
cd client
npm install
```

### Development Server

```bash
npm run dev
```

Starts Vite dev server at http://localhost:5173 with hot reload. API requests proxy to http://localhost:3001 during development.

### Build for Production

```bash
npm run build
```

Creates optimized build in `../public/client` directory (automatically configured in vite.config.js).

## API Integration

### Authentication

- Token stored in localStorage as `vhub_token`
- Bearer token automatically attached to all requests
- 401 responses redirect to login
- Use `useAuth()` hook to access user data and login/logout functions

### Data Fetching

- Use `useApi(path)` hook for simple GET requests
- Use `api` service directly for POST/PUT/DELETE operations
- All API responses expected to have `{ data, message, error }` structure

### Key Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/setup` - Create first admin account
- `GET /api/dashboard` - Dashboard metrics
- `GET /api/revenue` - Revenue data
- `GET /api/alerts` - System alerts
- `GET /api/products` - Product list
- `GET /api/products/{slug}/metrics` - Product metrics
- `POST /api/admins` - Create admin
- `GET /api/admins` - List admins

## Design System

### Colors
- Primary: `#6366f1` (Indigo)
- Secondary: `#8b5cf6` (Purple)
- Success: `#059669`
- Warning: `#d97706`
- Danger: `#dc2626`
- Info: `#0284c7`

### Typography
- Font: Inter, system-ui
- Sizes: 11px (small), 12px (base), 13px (body), 14px (label), 16px (heading), 22px (h1)

### Spacing
- 4px base grid
- Cards: 16px gap, 20-24px padding
- 240px fixed sidebar

### Components

All styled through CSS classes defined in `globals.css`:
- `.kpi-card` - Metric cards with colored top border
- `.chart-card` - Chart containers
- `.alert-item` - Alert items with left border status
- `.modal` - Modal dialogs
- `.data-table` - Data tables with striped rows
- `.btn-primary`, `.btn-sm`, `.btn-xs` - Button variants
- `.badge` - Status badges
- `.toast` - Toast notifications

## State Management

### Auth Context
- Manages user session and token
- Provides `login(userData, token)` and `logout()` methods
- Persists to localStorage

### Toast Context
- Toast notifications with auto-dismiss (3s default)
- Types: `success`, `warning`, `danger`, `info`
- Use `useToast()` hook to trigger notifications

## Component Patterns

### Page Components
```jsx
export const Dashboard = () => {
  const { data, loading } = useApi('/api/endpoint');
  // Render with data
};
```

### Common Components
Reusable, styled components with className props:
```jsx
<KpiCard label="Title" value={123} icon="📊" variant="highlight" />
<ChartCard title="Chart" subtitle="Subtitle"><LineChart ... /></ChartCard>
<Modal isOpen={true} title="Modal" onClose={handler}>Content</Modal>
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ JavaScript
- CSS Grid and Flexbox

## Building & Deployment

The build output goes to `../public/client`:
1. Run `npm run build` in the client directory
2. Files are optimized and ready for production
3. Serve from the Varshyl Hub backend's static file handler

## Notes

- No build step required for development (Vite)
- All CSS in single `globals.css` file (no CSS-in-JS)
- Functional components with hooks throughout
- API client handles token refresh and auth errors automatically
- Charts use Chart.js 4.x with react-chartjs-2 wrapper
