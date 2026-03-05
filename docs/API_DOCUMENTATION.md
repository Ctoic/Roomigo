# Roomigo API Documentation

## Base URL
- Local backend: `http://localhost:5051`

## Auth Model
- Authentication is session-cookie based (`Flask-Login`).
- Frontend calls protected endpoints with `withCredentials: true`.
- Most business endpoints require an authenticated admin session.

## Response Conventions
- Success responses often return `success: true` and payload fields.
- Error responses generally return `{"success": false, "message": "..."}` or `{"error": "..."}`.

## Public Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | API root check |
| GET | `/test` | Basic test endpoint |
| GET | `/health` | Health check |
| GET | `/api/csrf-token` | Returns CSRF token |
| POST | `/login` | Admin login |
| GET | `/check-auth` | Current auth/session check |
| POST | `/api/registration` | Public hostel registration submission |

### `POST /login`
Request body:
```json
{
  "username": "admin",
  "password": "secret"
}
```
Success response:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "System Admin",
    "email": "admin@example.com",
    "username": "admin"
  }
}
```

### `POST /api/registration`
Required fields:
- `name`
- `email`
- `phone`
- `address`
- `emergency_contact`
- `emergency_contact_name`
- `university`
- `course`
- `year_of_study`
- `expected_duration`

Optional field:
- `special_requirements`

Success returns `201` with `registration_id`.

## Protected Endpoints
All endpoints below require a logged-in admin session.

| Method | Path | Description |
|---|---|---|
| POST | `/logout` | Logout current admin |
| GET | `/api/dashboard` | Dashboard analytics |
| GET | `/api/rooms` | Rooms with occupancy + student mini-list |
| GET | `/api/rooms/availability` | Room availability summary |
| GET | `/api/expenses` | Expenses + monthly/previous comparison |
| POST | `/api/expenses` | Create expense entry |
| DELETE | `/api/expenses?id={id}` | Delete expense |
| GET | `/api/export_pdf/{year}/{month}` | Download monthly expense report PDF |
| GET | `/api/fees` | Fee records and totals |
| GET | `/api/fees/quick-collection` | Per-student monthly collection status |
| POST | `/api/fees/quick-collection` | Mark fee quick status (`paid`/`not_paid`) |
| GET | `/api/students` | Paginated student list |
| POST | `/api/students` | Add student |
| PUT | `/api/students/{student_id}` | Update student |
| DELETE | `/api/students/{student_id}` | Delete student and fee records |
| POST | `/api/students/bulk-upload` | Bulk upload students via Excel |
| GET | `/api/students/download-template` | Download student bulk template |
| GET | `/api/employees` | List employees with current month salary status |
| POST | `/api/employees` | Add employee |
| PUT | `/api/employees/{employee_id}` | Update employee |
| DELETE | `/api/employees/{employee_id}` | Delete employee + salary records |
| GET | `/api/employees/{employee_id}/salaries` | Employee salary history |
| POST | `/api/employees/{employee_id}/salaries` | Add salary payment (also logs expense) |
| PUT | `/api/salaries/{salary_id}` | Update salary payment |
| DELETE | `/api/salaries/{salary_id}` | Delete salary payment |
| GET | `/api/salaries/summary/{month_year}` | Monthly salary summary |
| GET | `/api/salaries/yearly-summary/{year}` | Yearly salary summary |
| GET | `/api/salaries/available-months` | Distinct months/years with salary records |
| GET | `/api/admin/registrations` | Paginated registration list |
| PUT | `/api/admin/registrations/{registration_id}` | Update registration status/notes |
| DELETE | `/api/admin/registrations/{registration_id}` | Delete registration |
| GET | `/api/admin/registrations/stats` | Registration statistics |

## Key Query Parameters

### `GET /api/expenses`
- `month` (int, default current month)
- `year` (int, default current year)

### `GET /api/fees`
- `month` (int, default current month)
- `year` (int, default current year)

### `GET /api/fees/quick-collection`
- `month` (1..12)
- `year`

### `GET /api/students`
- `page` (default `1`)
- `per_page` (default `10`, max `100`)

### `GET /api/admin/registrations`
- `page` (default `1`)
- `per_page` (default `10`, max `100`)
- `status` (`all`, `pending`, `contacted`, `approved`, `rejected`)

## Key Request Bodies

### `POST /api/expenses`
```json
{
  "item_name": "Electricity Bill",
  "price": 12500,
  "date": "2026-03-01"
}
```

### `POST /api/fees/quick-collection`
```json
{
  "student_id": 10,
  "status": "paid",
  "month": 3,
  "year": 2026
}
```

### `POST /api/students`
```json
{
  "name": "Ali Khan",
  "fee": 5000,
  "room_id": 3
}
```

### `PUT /api/students/{student_id}`
```json
{
  "name": "Ali Khan",
  "fee": 5500,
  "room_id": 4,
  "status": "active"
}
```

### `POST /api/students/bulk-upload`
- Content-Type: `multipart/form-data`
- Field: `file` (`.xlsx` or `.xls`)
- Required sheet columns: `name`, `fee`, `room_id`

### `POST /api/employees`
```json
{
  "name": "John Doe",
  "position": "Cook",
  "base_salary": 30000
}
```

### `POST /api/employees/{employee_id}/salaries`
```json
{
  "month_year": "2026-03",
  "amount_paid": 30000,
  "payment_method": "cash",
  "notes": "Paid on time"
}
```

### `PUT /api/admin/registrations/{registration_id}`
```json
{
  "status": "contacted",
  "admin_notes": "Spoke with applicant on phone."
}
```

## Legacy Endpoints (Backward Compatibility)
These are still present but are not the preferred interface for new clients.

| Method | Path | Description |
|---|---|---|
| GET | `/students` | Legacy student list |
| POST | `/enroll` | Legacy student enroll |
| POST | `/collect-fee` | Legacy fee collect |
| GET | `/fee-records` | Legacy fee records list |

## Curl Example (Session Login + Protected Call)
```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}' \
  http://localhost:5051/login

curl -b cookies.txt http://localhost:5051/api/dashboard
```
