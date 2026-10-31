# HospitalMS Frontend

React + Vite frontend for the supplied HospitalMS Spring Boot backend.

## Features mapped to the current backend

### Authentication
- Patient registration: `POST /auth/signup`
- Sign in / JWT: `POST /auth/login`
- Sign out clears the browser session.
- The login form asks you to select the role assigned to the account because the current login response returns only `{ "token": "..." }`, not the user's role. Spring Security remains authoritative and will reject mismatched roles.

### Patient portal
- Read/update patient name: `GET/PUT /patient/profile`
- Public-to-authenticated-patient doctor directory: `GET /doctors`
- Book/list/cancel appointments: `POST /appointments`, `GET /appointments/my`, `PUT /appointments/{appointmentId}/cancel`
- List paginated personal medical records: `GET /medical-records/my`

### Doctor portal
- Read/update doctor profile: `GET/PUT /doctor/profile`
- List appointments and update status: `GET /doctor/appointments`, `PUT /doctor/appointment/{appointmentId}/status`
- List patients connected through appointments: `GET /doctor/patients`
- Create a medical record: `POST /medical-records`
- List records created by the doctor: `GET /medical-records/doctor`

### Admin portal
- Create doctor accounts: `POST /admin/doctor`

## Requirements
- Node.js LTS (includes npm)
- HospitalMS backend running at `http://localhost:8080`

## Run on Windows
1. Extract this folder to `C:\Users\ACER\Desktop\HospitalMS-frontend` (or any folder outside the Java project).
2. Open PowerShell in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the URL Vite prints (usually `http://localhost:5173`).

Vite proxies requests from `/api/...` to `http://localhost:8080/...` and strips the `/api` prefix. This avoids needing browser CORS configuration during local development. Keep the Spring Boot backend running separately.

## Important backend behavior
- Patient signup creates a PATIENT account. Doctor accounts are created by an administrator.
- Role selection in the UI is not a security control; the backend's JWT filter and `SecurityConfig` enforce the real role permissions.
- The backend login token does not include a role claim and there is no current endpoint to discover the current user's role. Select the correct role on the sign-in form.
- Patient and doctor appointment/record lists use Spring `Page` responses; this UI requests pages with `size=100` for appointment summaries and pages of 10 for medical records.
- The current backend does not expose a medicine management API, password reset, email notifications, payment workflow, or appointment rescheduling endpoint. These are not added as fake frontend features.
- `POST /medical-records` uses the backend's appointment relationship check. The frontend offers patients from `/doctor/patients`, but backend authorization remains the final check.

## API base URL
For local development, leave `VITE_API_BASE_URL` empty and use the Vite proxy. For a hosted frontend, set `VITE_API_BASE_URL` to your deployed backend URL. A deployed backend must allow the deployed frontend origin through CORS; configure this in the backend before hosting the frontend.

## Build
Run `npm run build`. The static production output is generated in `dist/`.
