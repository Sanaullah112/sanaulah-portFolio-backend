# Portfolio Admin Backend (MERN — ES6 Modules)

Express + MongoDB (Mongoose) backend for the Admin Panel frontend. Matches every endpoint the frontend's `src/config/endpoints.js` expects out of the box.

## Setup

```bash
npm install
cp .env.example .env   # set MONGO_URI, JWT_SECRET, CLIENT_URL, ADMIN_EMAIL/PASSWORD
npm run seed:admin     # creates or resets the configured admin account
npm run dev            # nodemon, http://localhost:5000
```

To sign in, use the exact `ADMIN_EMAIL` and `ADMIN_PASSWORD` values configured in the backend `.env`. Running `npm run seed:admin` updates that account's password to the configured value; keep `ADMIN_PASSWORD` private and use a unique password (at least 6 characters).

## Render and Vercel deployment

- Deploy the Express backend on Render and the Vite frontend on Vercel. Set Vercel's `VITE_API_BASE_URL` to the Render backend URL ending in `/api` (for example, `https://your-backend.onrender.com/api`), then redeploy the frontend. Do not use `localhost` for this production variable. The local URL is kept in `frontend/.env.development`, so it is not baked into production builds.
- Uploaded image URLs are served by the Render backend. Keep Vercel's `VITE_API_BASE_URL` pointed at that backend URL so the frontend resolves them correctly. Resume PDFs are stored in MongoDB Atlas and served from `/api/resume/:id/file`, so they persist across Render restarts and redeploys.
- Multer stores image uploads on disk. Attach a Render persistent disk mounted at `/var/data`, then set the backend's `UPLOADS_DIR` environment variable to `/var/data/uploads`. Without the persistent disk, uploaded images can disappear when the service restarts or redeploys. Vercel's serverless filesystem is not suitable for these uploads.
- Resume records uploaded before database-backed file storage only contain file metadata and a local file path. If an old resume returns 404 after deployment, replace/re-upload it once from the admin panel to store its PDF in MongoDB Atlas.
- Set Render's `CLIENT_URL` to the deployed Vercel site origin and configure `MONGO_URI`, `JWT_SECRET`, and the mail and WhatsApp settings described below.

## Contact email and WhatsApp delivery

Set these environment variables in Render's backend service settings; never put provider credentials in frontend code or commit them. Contact form submissions are saved first, then email and WhatsApp notifications are attempted concurrently before the API responds. The response includes `notifications.emailSent` and `notifications.whatsappSent`; a failed notification does not undo the saved contact.

- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `OWNER_EMAIL` for the portfolio notification and visitor confirmation email. Use a Google app password for Gmail SMTP. Render Free blocks outbound SMTP ports, so configure `RESEND_API_KEY` and a verified `RESEND_FROM` for reliable delivery from a free Render service. The message still arrives at `OWNER_EMAIL` (your Gmail inbox). Paid Render services can use Gmail SMTP.
- `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` from your Meta WhatsApp Business app.
- `WHATSAPP_RECIPIENT_PHONE` to the destination number in international digits (defaults to `923099369195`).
- `WHATSAPP_TEMPLATE_NAME` and `WHATSAPP_TEMPLATE_LANGUAGE` to an approved Meta message template and its language code. The template must have five body placeholders, in order: visitor name, email, phone, budget, and message.
- `WHATSAPP_GRAPH_API_VERSION` to a currently supported Graph API version (defaults to `v26.0`).

For example, the approved template could say: `New portfolio inquiry from {{1}}. Email: {{2}}. Phone: {{3}}. Budget: {{4}}. Message: {{5}}. Please follow up promptly.` Meta may require an approved template when the visitor has not opened a WhatsApp service window. Email delivery is independent: if WhatsApp is not configured or its API call fails, the contact form still saves the message and attempts email delivery. If either provider fails, the saved contact is preserved, the failure is logged, and the API response reports that channel as unsuccessful.

The WhatsApp sender phone-number ID must be registered with Meta, and the recipient must be an eligible WhatsApp number different from the sender. Automatic WhatsApp delivery requires a Meta WhatsApp Business Cloud API setup and approved template; a normal personal WhatsApp account or `wa.me` link cannot send a message automatically from the server. Until those values are added in Render, WhatsApp delivery is logged as unavailable while email and message storage continue independently.

## Folder Structure

```
config/       db.js, constants.js
models/       Admin, Resume, Project, Testimonial, LastWork (Mongoose schemas)
controllers/  business logic per resource
middleware/   authMiddleware (JWT), uploadMiddleware (multer), errorMiddleware, rateLimiter
routes/       Express routers, one per resource
utils/        generateToken, fileHelper (URL building + file cleanup), apiResponse
seed/         seedAdmin.js — creates the first admin account
uploads/      multer disk storage for images (projects/, testimonials/, lastwork/), served at /uploads/...
server.js     app entry point
```

## Auth

JWT-based. `POST /api/auth/login` returns `{ token, user }`. Send `Authorization: Bearer <token>` on all other routes (all are `protect`-guarded except login).

## Endpoints

`GET /` returns a simple API status response, and `GET /api/health` is available as the Render health-check path.

| Resource | Method | Path | Body |
|---|---|---|---|
| Auth | POST | /api/auth/login | `{ email, password }` |
| Auth | POST | /api/auth/logout | — |
| Auth | GET | /api/auth/me | — |
| Resume | GET | /api/resume | — |
| Resume | GET | /api/resume/:id/file | — |
| Resume | POST | /api/resume/upload | `multipart: resume (pdf)` |
| Resume | PUT | /api/resume/:id | `multipart: resume (pdf)` |
| Resume | DELETE | /api/resume/:id | — |
| Projects | GET | /api/projects?search=&category=&page=&limit= | — |
| Projects | POST | /api/projects | `multipart: image + name, category, description, technologies, githubUrl, liveUrl, featured, displayOrder` |
| Projects | PUT | /api/projects/:id | same as create (image optional) |
| Projects | DELETE | /api/projects/:id | — |
| Testimonials | GET | /api/testimonials?search=&page=&limit= | — |
| Testimonials | POST | /api/testimonials | `multipart: image + name, jobTitle, company, review, rating, linkedin` |
| Testimonials | PUT | /api/testimonials/:id | same as create (image optional) |
| Testimonials | DELETE | /api/testimonials/:id | — |
| Last Work | GET | /api/last-work?search=&page=&limit= | — |
| Last Work | POST | /api/last-work | `multipart: image + title, category, description` |
| Last Work | PUT | /api/last-work/:id | same as create (image optional) |
| Last Work | DELETE | /api/last-work/:id | — |
| Dashboard | GET | /api/dashboard/stats | — |

## Notes

- All list endpoints return `{ success, data, page, totalPages, totalCount }` — matches the admin panel's `useCrud` hook parsing (`payload.data`, `payload.totalPages`).
- All create/update messages exactly match the voice-feedback / toast strings the admin frontend expects (e.g. "Project added successfully").
- File uploads are validated server-side too (type + size) in `middleware/uploadMiddleware.js`, in addition to the frontend's own validation.
- Old files are deleted from disk automatically when a record is replaced or removed.
- Swap local disk storage for S3/Cloudinary later by only editing `uploadMiddleware.js` and the `imageUrl`/`fileUrl` assignment in controllers — nothing else needs to change.


To check provider credentials after deployment, sign in as an admin and send an authenticated `POST /api/contact/test-notifications` request. The response reports email and WhatsApp results separately, and Render logs include failures for real contact submissions. A successful contact response confirms the message was saved; inspect its `notifications` fields or the admin test endpoint to confirm delivery.
