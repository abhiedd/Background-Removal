# RMBG-2.0 Background Removal API (Cloud Run) + Apps Script (Option B)

Endpoints:
- `GET /health`
- `GET /rmbg_url?url=<img>&crop=true` → PNG (for Google Sheets `=IMAGE()`)
- `POST /rmbg?url=<img>&crop=true` → PNG

## Deploy
```bash
PROJECT_ID=$(gcloud config get-value project)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
gcloud builds submit --tag gcr.io/$PROJECT_ID/rembg-api
gcloud run deploy hello   --image gcr.io/$PROJECT_ID/rembg-api   --platform managed   --region africa-south1   --allow-unauthenticated   --max-instances 2
# optional warm instance:
gcloud run services update hello --region africa-south1 --min-instances 1
```

## Apps Script
Open your Sheet → Extensions → Apps Script, paste `apps_script_option_b.gs`.
Use **RMBG → Run (ask sheet name)**.
Headers must be: `Img1`, `Img2`, `Img3`, ... in row 1.
