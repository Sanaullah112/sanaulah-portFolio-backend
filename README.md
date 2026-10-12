# Portfolio Admin Backend (MERN — ES6 Modules)

Express + MongoDB (Mongoose) backend for the Admin Panel frontend. Matches every endpoint the frontend's `src/config/endpoints.js` expects out of the box.

## Setup

```bash
npm install
cp .env.example .env   # edit MONGO_URI, JWT_SECRET, CLIENT_URL, ADMIN_EMAIL/PASSWORD
npm run seed:admin     # creates the first admin login from .env values
npm run dev            # nodemon, http://localhost:5000
```

## Folder Structure

```
config/       db.js, constants.js
models/       Admin, Resume, Project, Testimonial, LastWork (Mongoose schemas)
controllers/  business logic per resource
middleware/   authMiddleware (JWT), uploadMiddleware (multer), errorMiddleware, rateLimiter
routes/       Express routers, one per resource
utils/        generateToken, fileHelper (URL building + file cleanup), apiResponse
seed/         seedAdmin.js — creates the first admin account
uploads/      multer disk storage (resume/, projects/, testimonials/, lastwork/), served at /uploads/...
server.js     app entry point
```

## Auth

JWT-based. `POST /api/auth/login` returns `{ token, user }`. Send `Authorization: Bearer <token>` on all other routes (all are `protect`-guarded except login).

## Endpoints

| Resource | Method | Path | Body |
|---|---|---|---|
| Auth | POST | /api/auth/login | `{ email, password }` |
| Auth | POST | /api/auth/logout | — |
| Auth | GET | /api/auth/me | — |
| Resume | GET | /api/resume | — |
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
