# SCHOLARLOGIC DEPLOYMENT & EXTERNAL INTEGRATION GUIDE

## 🎥 Zoho Meeting Integration Setup

ScholarLogic integrates with official Zoho Meeting APIs (`ZohoMeeting.meeting.READ`) for associating live and recorded sessions with LMS course lessons.

### Step-by-Step Zoho OAuth Setup Instructions

1. **Create & Register Zoho OAuth Application**:
   - Navigate to the [Zoho Developer Console](https://api-console.zoho.in/) (or regional domain e.g. `https://api-console.zoho.com`).
   - Click **Add Client** and select **Server-based Applications**.
   - Enter your Client Name (e.g. `ScholarLogic LMS Integration`) and Authorized Redirect URIs.

2. **Configure Required OAuth Scopes**:
   - In Zoho Developer Console, grant scope `ZohoMeeting.meeting.READ` for Meeting resources.

3. **Obtain Client Credentials & Refresh Token**:
   - Copy `Client ID` and `Client Secret`.
   - Generate an initial Authorization Code and exchange it for a `Refresh Token` via Zoho OAuth token API.

4. **Configure Server-Side Environment Variables**:
   Update `backend/.env` (DO NOT expose these in frontend code or Git!):
   ```env
   ZOHO_REGION=IN
   ZOHO_CLIENT_ID=your_zoho_client_id
   ZOHO_CLIENT_SECRET=your_zoho_client_secret
   ZOHO_REFRESH_TOKEN=your_zoho_refresh_token
   ZOHO_API_DOMAIN=https://meeting.zoho.in
   ```

5. **Restart ScholarLogic Backend**:
   ```bash
   cd backend
   npm run dev
   ```

6. **Trainer Workflow Verification**:
   - Log in as Trainer (`trainer@scholarlogic.edu` / `Trainer@123`).
   - Navigate to **Course Content Editor** -> Select Course/Module/Lesson.
   - Click **+ Upload Video**.
   - Toggle Video Source to **Zoho Meeting**.
   - Paste a valid Zoho Meeting recording URL (e.g. `https://meeting.zoho.in/meeting/public/videoprv?recordingId=...`).
   - Click **[ Validate ]** -> Click **[ Add Recording ]**.

7. **Student Playback Verification**:
   - Log in as Student (`student@scholarlogic.edu` / `Student@123`).
   - Navigate to Course -> Select the Zoho Recording lesson.
   - Click **Watch Zoho Recording ↗** to launch video playback.
