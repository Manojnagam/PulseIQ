# 🔌 PulseIQ — API Specification

## Authentication & Identity APIs (Supabase Auth)

### 1. `POST /auth/v1/signup`
- **Description**: Registers a new user profile and creates a new default tenant organisation.
- **Request Body**:
  ```json
  {
    "email": "owner@pulsezen.in",
    "password": "Password123!",
    "options": {
      "data": {
        "full_name": "Manoj Nagam",
        "organisation_name": "PulseZen Main Org"
      }
    }
  }
  ```
- **Response**: `200 OK` with JWT Auth Session Token.

### 2. `POST /auth/v1/token?grant_type=password`
- **Description**: Authenticates user credentials and returns JWT access & refresh tokens.
- **Request Body**:
  ```json
  {
    "email": "supervisor@pulsezen.in",
    "password": "Password123!"
  }
  ```

### 3. `POST /auth/v1/recover`
- **Description**: Sends a password recovery email link.
- **Request Body**:
  ```json
  {
    "email": "supervisor@pulsezen.in"
  }
  ```

---

## Multi-Tenant & RBAC REST APIs

### 1. `GET /rest/v1/user_memberships?select=*,organisations(*),branches(*)`
- **Headers**: `Authorization: Bearer <JWT>`
- **Description**: Returns all tenant memberships and branch assignments for the authenticated user.

### 2. `POST /rest/v1/organisations`
- **Headers**: `Authorization: Bearer <JWT>`, `Prefer: return=representation`
- **Required Permission**: `org:manage`
- **Request Body**:
  ```json
  {
    "name": "Apex Wellness Club",
    "slug": "apex-wellness"
  }
  ```

### 3. `POST /rest/v1/branches`
- **Headers**: `Authorization: Bearer <JWT>`, `Prefer: return=representation`
- **Required Permission**: `branch:manage`
- **Request Body**:
  ```json
  {
    "organisation_id": "org-001",
    "name": "Gachibowli Branch",
    "code": "GCB-01",
    "address": "Gachibowli, Hyderabad"
  }
  ```
