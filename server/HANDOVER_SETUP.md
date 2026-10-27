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

## Handover status workflow

Handover inspections use the `Inspection` model and their own status history. Tenant maintenance reports use the separate `Report` model and `Pending`, `Acknowledged`, `In Progress`, and `Resolved` statuses; those status values do not apply to handovers.

Maintenance status changes are landlord-only and advance one step at a time: `Pending` → `Acknowledged` → `In Progress` → `Resolved`. The landlord's property ownership is checked for each update, the update uses the prior status as a concurrency condition, and an optional resolution note is saved when the report is resolved. The current maintenance model does not retain a separate status history.

| Current status | Action | Responsible role | Requirements | Result |
| --- | --- | --- | --- | --- |
| Draft | Start inspection | Landlord | Must own the inspection | Inspection in Progress |
| Inspection in Progress | Submit for review | Landlord | Report revision must match | Awaiting Tenant Review |
| Submitted for Review | Route to tenant review | Landlord | Legacy compatibility | Awaiting Tenant Review |
| Awaiting Tenant Review | Acknowledge review | Tenant | Assigned tenant; comment required | Awaiting Landlord Review; tenant acknowledgment recorded |
| Awaiting Landlord Review | Approve | Landlord | Owning landlord; comment required | Agreed / Approved; landlord acknowledgment recorded |
| Review or agreed state | Request changes | Current responsible reviewer | Comment required; cannot be Draft, Disputed, or Finalized | Changes Requested; other party becomes responsible; both acknowledgments reset |
| Changes Requested | Address changes | Responsible party | Comment required | Landlord returns to Inspection in Progress; tenant response goes to Awaiting Landlord Review |
| Active, non-draft state | Raise dispute | Either assigned party | Comment required | Disputed; other party becomes responsible |
| Disputed | Respond | Responsible party | Comment required | Changes Requested; dispute response is timestamped and responsibility returns to the dispute raiser |
| Agreed / Approved | Finalize | Owning landlord | Matching revision and both separate acknowledgments | Finalized; immutable report snapshot and history entry are appended |
| Finalized | Open revision | Owning landlord | Explanation and matching revision required | Inspection in Progress; prior finalized snapshot remains preserved |

Every workflow update checks the caller's resource access and expected inspection revision. Successful transitions append status history and activity entries containing the actor, role, timestamp, action/status, and note. Concurrent updates return `409 Conflict`. Finalization is a separate endpoint and is rejected unless the report is agreed and both acknowledgments are present. Acknowledgments record in-app actions only; they do not claim an electronic signature or identity verification.

## Verification notes

Run the backend unit tests with `cd server && node test/handoverWorkflow.test.js` if the host's Node test runner cannot spawn child processes. The usual `npm test` command uses `node --test`. Frontend checks are `cd client && npm run build` and `npm run lint`; install dependencies first with `npm install` in `client` and `server` as needed. The frontend API base can be configured with `VITE_API_URL`; when unset, local development uses `http://localhost:5000/api`.
