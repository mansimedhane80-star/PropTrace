# PropTrace handover reports

## Services

The API requires MongoDB before it starts. Set `MONGO_URI`, `JWT_SECRET`, and `PORT` in `server/.env`. The backend exits with a startup error when MongoDB cannot be reached; `/api/health` reports database readiness after startup.

## Evidence storage

Uploaded handover photos are validated, compressed by the browser, and stored as private files under `server/uploads/evidence`. MongoDB stores each file's metadata and randomized storage key. Back up this directory together with the MongoDB database, and restore both to preserve report photos. For multi-instance or hosted deployments, mount a durable private volume at this location or adapt the upload controller to the configured private object-storage service.

Evidence is served only through the authenticated inspection evidence endpoint after verifying that the requester is the inspection's assigned tenant or landlord. The upload limit is 8 MB per image after browser compression.

## Start locally

1. Start the MongoDB service and confirm the URI in `server/.env` points to it.
2. In `server`, run `npm install` once and `npm run dev`.
3. In `client`, run `npm install` once and `npm run dev`.

## Password reset email

Forgot-password links are delivered through Resend. Configure these server environment variables to enable delivery:

- `RESEND_API_KEY`: Resend API key.
- `PASSWORD_RESET_FROM`: sender address verified with Resend.
- `CLIENT_URL`: public PropTrace frontend origin (for example, the deployed app URL or local Vite URL).

Reset tokens are stored as hashes and expire after 30 minutes. When delivery is not configured, the request page reports the missing server configuration instead of pretending an email was sent.

Final reports use the browser print dialog's “Save as PDF” option. Approval is an in-app acknowledgment and is not represented as a legally binding electronic signature.
