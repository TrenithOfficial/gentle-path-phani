Full Stack Project Overview
=========================================

90-Day Healing is a wellness-focused application built with a **React web frontend** and a **Go (Gin) backend**, using **Firebase Authentication**, **PostgreSQL**, and deployed on **Google Cloud Run (GCP)**.

The backend is complete and live.  
The iOS team will consume the same backend APIs to build a native iOS app.

This document explains:
- What the project does
- Project structure
- How to run frontend and backend
- Backend APIs (what exists and what they do)
- Database schema
- Cloud deployment details
- What the iOS team needs to know

---

1. High-Level Architecture
--------------------------

**Frontend (Web)**
- React + Vite
- Firebase Authentication (email/password)
- Calls backend APIs using Firebase ID token

**Backend (API)**
- Go (Gin framework)
- Firebase Admin SDK for auth verification
- PostgreSQL database
- File storage for PDFs (healing sheets) Bofore we used to have this but later we upgraded to GCS
- Google Cloud Storage (GCS)
- Accessed through a storage abstraction layer (upload_store)
- Deployed on Google Cloud Run

**Auth Flow**
1. User logs in via Firebase (frontend or iOS)
2. Firebase returns ID token
3. Token is sent to backend in `Authorization: Bearer <token>`
4. Backend verifies token and extracts user ID
5. Backend processes request

---

2. Project Structure
--------------------

```text
gentle-path-main/
├── .env
├── .env.local
├── backend/
│   ├── .env
│   ├── .gcloudignore
│   ├── admin_checkins_routes.go
│   ├── admin_user_invite_routes.go
│   ├── admin_users_routes.go
│   ├── admin_users_types.go
│   ├── chat_routes.go
│   ├── checkins_routes.go
│   ├── content_routes.go
│   ├── db.go
│   ├── Dockerfile
│   ├── env.yaml
│   ├── errors.go
│   ├── firebase-admin.example.json
│   ├── firebase-admin.json
│   ├── firebase.go
│   ├── gentle-path-backend.exe
│   ├── go.mod
│   ├── go.sum
│   ├── healing_sheets_routes.go
│   ├── main.go
│   ├── messages_routes.go
│   ├── middleware_auth.go
│   ├── protocol_ack_routes.go
│   ├── protocol_item_ack_routes.go
│   ├── protocols_routes.go
│   ├── schema.sql
│   ├── uploads/
│   │   └── healing-sheets/
│   │       ├── 04daabf7-649e-4717-a191-0a823a10444e.pdf
│   │       ├── 0d1a526e-7e04-440e-bc76-528247165e73.tsx
│   │       ├── 1a0cdf7a-46d1-46bd-812d-bf5b234b54d6.pdf
│   │       ├── 259b4c61-60e6-4071-9cb4-0aeee76ba71f.pdf
│   │       ├── 872dc238-2856-418f-880e-c17905ccddf5.pdf
│   │       └── 8eb3b330-9d4f-4a1e-8009-88f415ac3eca.pdf
│   ├── uploads_store.go
│   ├── user_lookup.go
│   └── user_repo.go
├── bun.lockb
├── capacitor.config.ts
├── components.json
├── dist/
│   ├── assets/
│   │   ├── index-BecBp2s4.css
│   │   └── index-BIMfehOR.js
│   ├── favicon.ico
│   ├── index.html
│   ├── placeholder.svg
│   └── robots.txt
├── eslint.config.js
├── index.html
├── ios/
│   ├── .gitignore
│   ├── App/
│   │   ├── App/
│   │   │   ├── AppDelegate.swift
│   │   │   ├── Assets.xcassets/
│   │   │   │   ├── AccentColor.colorset/
│   │   │   │   │   └── Contents.json
│   │   │   │   ├── AppIcon.appiconset/
│   │   │   │   │   └── Contents.json
│   │   │   │   └── Contents.json
│   │   │   ├── Base.lproj/
│   │   │   │   ├── LaunchScreen.storyboard
│   │   │   │   └── Main.storyboard
│   │   │   ├── Info.plist
│   │   │   └── ViewController.swift
│   │   ├── App.xcodeproj/
│   │   │   ├── project.pbxproj
│   │   │   ├── project.xcworkspace/
│   │   │   │   ├── contents.xcworkspacedata
│   │   │   │   └── xcshareddata/
│   │   │   │       └── IDEWorkspaceChecks.plist
│   │   │   └── xcshareddata/
│   │   │       └── xcschemes/
│   │   │           └── App.xcscheme
│   │   ├── AppTests/
│   │   │   ├── AppTests.swift
│   │   │   └── Info.plist
│   │   └── AppUITests/
│   │       ├── AppUITests.swift
│   │       └── Info.plist
│   ├── Podfile
│   ├── Podfile.lock
│   └── Pods/
│       ├── Headers/
│       │   ├── Private/
│       │   │   ├── Capacitor/
│       │   │   │   ├── CAPBridgeViewController.h
│       │   │   │   ├── CAPConfig.h
│       │   │   │   ├── CAPInstanceConfiguration.h
│       │   │   │   ├── CAPLog.h
│       │   │   │   ├── CAPPluginCall.h
│       │   │   │   ├── CAPPlugin.h
│       │   │   │   ├── CAPPluginMethod.h
│       │   │   │   ├── CAPPluginResult.h
│       │   │   │   ├── CAPPlugin+Load.h
│       │   │   │   ├── CAPPlugin+JSON.h
│       │   │   │   ├── CAPPlugin+Tools.h
│       │   │   │   ├── CAPPlugin+CAPBridgedPlugin.h
│       │   │   │   └── CAPDefinitions.h
│       │   │   └── CapacitorCordova/
│       │   │       ├── CAPCordovaPlugin.h
│       │   │       ├── CAPCordovaViewController.h
│       │   │       └── CapacitorCordova.h
│       │   └── Public/
│       │       ├── Capacitor/
│       │       │   ├── Capacitor.h
│       │       │   └── CAPBridgedPlugin.h
│       │       └── CapacitorCordova/
│       │           └── CapacitorCordova.h
│       ├── Local Podspecs/
│       │   ├── Capacitor.podspec.json
│       │   ├── CapacitorApp.podspec.json
│       │   ├── CapacitorCordova.podspec.json
│       │   └── CapacitorDevice.podspec.json
│       ├── Manifest.lock
│       ├── Pods.xcodeproj/
│       │   ├── project.pbxproj
│       │   └── project.xcworkspace/
│       │       ├── contents.xcworkspacedata
│       │       └── xcshareddata/
│       │           └── IDEWorkspaceChecks.plist
│       ├── Target Support Files/
│       │   ├── Capacitor/
│       │   │   ├── Capacitor-Info.plist
│       │   │   ├── Capacitor-dummy.m
│       │   │   ├── Capacitor-prefix.pch
│       │   │   ├── Capacitor-umbrella.h
│       │   │   ├── Capacitor.modulemap
│       │   │   └── Capacitor.xcconfig
│       │   ├── CapacitorApp/
│       │   │   ├── CapacitorApp-Info.plist
│       │   │   ├── CapacitorApp-dummy.m
│       │   │   ├── CapacitorApp-prefix.pch
│       │   │   ├── CapacitorApp-umbrella.h
│       │   │   ├── CapacitorApp.modulemap
│       │   │   └── CapacitorApp.xcconfig
│       │   ├── CapacitorCordova/
│       │   │   ├── CapacitorCordova-Info.plist
│       │   │   ├── CapacitorCordova-dummy.m
│       │   │   ├── CapacitorCordova-prefix.pch
│       │   │   ├── CapacitorCordova-umbrella.h
│       │   │   ├── CapacitorCordova.modulemap
│       │   │   └── CapacitorCordova.xcconfig
│       │   ├── CapacitorDevice/
│       │   │   ├── CapacitorDevice-Info.plist
│       │   │   ├── CapacitorDevice-dummy.m
│       │   │   ├── CapacitorDevice-prefix.pch
│       │   │   ├── CapacitorDevice-umbrella.h
│       │   │   ├── CapacitorDevice.modulemap
│       │   │   └── CapacitorDevice.xcconfig
│       │   ├── Pods-App/
│       │   │   ├── Pods-App-Info.plist
│       │   │   ├── Pods-App-dummy.m
│       │   │   ├── Pods-App-frameworks.sh
│       │   │   ├── Pods-App-resources.sh
│       │   │   └── Pods-App.debug.xcconfig
│       │   ├── Pods-AppTests/
│       │   │   ├── Pods-AppTests-Info.plist
│       │   │   ├── Pods-AppTests-dummy.m
│       │   │   └── Pods-AppTests.debug.xcconfig
│       │   └── Pods-AppUITests/
│       │       ├── Pods-AppUITests-Info.plist
│       │       ├── Pods-AppUITests-dummy.m
│       │       └── Pods-AppUITests.debug.xcconfig
│       └── _CodeSignature/
│           └── CodeResources
├── package-lock.json
├── package.json
├── postcss.config.js
├── public/
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── AdminInviteUser.tsx
│   │   ├── AdminUsers.tsx
│   │   ├── BackButton.tsx
│   │   ├── Chat.tsx
│   │   ├── ContentManager.tsx
│   │   ├── HealingSheets.tsx
│   │   ├── ProtocolDay.tsx
│   │   ├── ProtocolItemAck.tsx
│   │   ├── ProtocolProgress.tsx
│   │   ├── SiteHeader.tsx
│   │   └── ui/
│   │       ├── alert-dialog.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       └── toast.tsx
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── index.css
│   ├── lib/
│   │   ├── api.ts
│   │   ├── apiBase.ts
│   │   ├── auth.ts
│   │   ├── firebase.ts
│   │   ├── protocolAcksApi.ts
│   │   ├── protocolItemAcksApi.ts
│   │   └── utils.ts
│   ├── main.tsx
│   ├── pages/
│   │   ├── Admin.tsx
│   │   ├── CheckIn.tsx
│   │   ├── Login.tsx
│   │   ├── Protocol.tsx
│   │   └── Protocols.tsx
│   └── vite-env.d.ts
├── tailwind.config.js
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
---

```

---

3. Backend Details
------------------

### Tech Stack
- Language: Go
- Framework: Gin
- Auth: Firebase Admin SDK
- DB: PostgreSQL
- Storage: Local (`/tmp`) on Cloud Run
- Hosting: Google Cloud Run

### Environment Variables

```ini
DATABASE_URL=postgres://user:pass@host:5432/dbname
FIREBASE_PROJECT_ID=xxxxx
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GIN_MODE=release
```

---

4. Backend API Reference (Complete & Sorted)
=========================================

Base URL
--------
All APIs are served from the Cloud Run backend.

[https://gentle-path-api-xxxxx-uc.a.run.ap](https://gentle-path-api-883951071472.us-central1.run.app/)

All `/api/*` routes require:
Authorization: Bearer <Firebase ID Token>

---

Health & System
---------------

GET /health  
Purpose:
- Health check for uptime monitoring
- Used by Cloud Run and manual checks

---

Authentication & User Context
-----------------------------

Authentication is handled via Firebase.
There are no custom login/logout APIs.

Backend responsibilities:
- Verify Firebase ID token
- Extract user UID
- Enforce access control

---

User Check-ins
--------------

POST /api/checkins  
Purpose:
- Create a daily wellness check-in for the logged-in user

GET /api/checkins  
Purpose:
- Fetch check-ins for the logged-in user

GET /api/admin/checkins  
Purpose:
- Admin-only
- Fetch all user check-ins across the system

---

Protocols (Healing Programs)
----------------------------

GET /api/protocols  
Purpose:
- Fetch all available healing protocols

GET /api/protocols/:id  
Purpose:
- Fetch a single protocol with its structure

---

Protocol Day Acknowledgement
----------------------------

POST /api/protocols/ack  
Purpose:
- Mark a full protocol day as completed by the user

---

Protocol Item Acknowledgement
-----------------------------

GET /api/protocols/item-acks  
Purpose:
- Fetch item-level acknowledgements for the logged-in user

POST /api/protocols/item-acks  
Purpose:
- Acknowledge completion of a specific protocol item

---

Healing Sheets (PDFs / Files)
-----------------------------

POST /api/uploads  
Purpose:
- Upload healing sheet PDFs (admin/content use)
- Files stored in persistent cloud storage

GET /uploads/:file  
Purpose:
- Serve uploaded healing sheet files publicly

---

Content Management
------------------

GET /api/content  
Purpose:
- Fetch dynamic content used in the app (guidance, messages)

POST /api/content  
Purpose:
- Admin-only
- Create or update content

---

Chat / Messages
---------------

POST /api/chat  
Purpose:
- Send user message to backend
- Used for guided chat or AI-assisted responses

GET /api/messages  
Purpose:
- Fetch user message history

---

Admin – Users
-------------

GET /api/admin/users  
Purpose:
- Admin-only
- Fetch all registered users

POST /api/admin/users/invite  
Purpose:
- Admin-only
- Invite a new user into the system

GET /api/admin/users/:id  
Purpose:
- Admin-only
- Fetch details for a specific user

---

Summary
-------

Total API Categories:
- Health
- Check-ins
- Protocols
- Protocol Acknowledgements
- Healing Sheets
- Content
- Chat / Messages
- Admin Users

All APIs:
- Use Firebase Authentication
- Return JSON
- Are shared by Web and iOS apps
- Are production-ready and deployed on Google Cloud Run


---

5. Database Schema (Simplified)
-------------------------------

```text
users:
- id (uuid)
- firebase_uid
- email
- created_at

checkins:
- id
- user_id
- mood
- notes
- created_at

protocols:
- id
- title
- description

protocol_days:
- id
- protocol_id
- day_number

protocol_item_acks:
- id
- protocol_item_id
- user_id
- confirmed_at
```

---

6. Frontend Details
-------------------

### Tech Stack
- React
- Vite
- TypeScript
- Firebase Web SDK

### Pages
| Page | Purpose |
|-----|--------|
| Login | User authentication |
| Dashboard | Daily guidance + check-in |
| Protocol | Healing protocol progress |
| Admin | Admin-only views |

### Running Frontend
```bash
cd /project_root
npm install
npm run dev
```

```ini
VITE_API_BASE_URL=https://gentle-path-api-883951071472.us-central1.run.app
```

---

7. Cloud Deployment (Backend)
-----------------------------

- Google Cloud Run
- Dockerized deployment

Backend URL example:
```text
https://gentle-path-api-883951071472.us-central1.run.app
```

---

8. What iOS Team Needs to Know
------------------------------

- Use Firebase iOS SDK
- Send Firebase ID token with every API call
- Same backend as web
- No iOS-specific APIs required

---

9. Common Gotchas
-----------------

- Always refresh Firebase ID token before API calls
- Cloud Run containers are stateless; persistent files are stored in Google Cloud Storage (GCS)
- Do not rely on local filesystem for long-term storage
- All protected APIs require `Authorization: Bearer <Firebase ID Token>`


---

10. Contact / Ownership
-----------------------

Backend completed and maintained by:  
**Kalyan**

Frontend Web: Complete  
iOS App: Implemented by iOS team using existing APIs