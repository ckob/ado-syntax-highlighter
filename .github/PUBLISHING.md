# Automated Store Publishing Setup

Pushing a version tag (`vX.Y.Z`) triggers [`.github/workflows/release.yml`](./workflows/release.yml), which builds, validates, creates a GitHub Release, deploys the bookmarklet page, and submits the extension to both the **Chrome Web Store** and **Firefox Add-ons (AMO)**.

---

## 1. Chrome Web Store (GCP OIDC / Workload Identity Federation)

### A. One-time Google Cloud setup

Run these commands once (replace `YOUR_GCP_PROJECT_ID` with your Google Cloud project ID):

```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
gcloud config set project "$PROJECT_ID"

export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

# 1. Enable required APIs
gcloud services enable \
  chromewebstore.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com

# (If creating a brand-new project, also grant yourself Workload Identity Pool Admin)
# gcloud projects add-iam-policy-binding "$PROJECT_ID" \
#   --member="user:YOUR_EMAIL" \
#   --role="roles/iam.workloadIdentityPoolAdmin"

# 2. Create a Service Account (no GCP IAM roles required)
gcloud iam service-accounts create cws-publisher \
  --display-name="Chrome Web Store Publisher"

export SA_EMAIL="cws-publisher@${PROJECT_ID}.iam.gserviceaccount.com"

# 3. Create a Workload Identity Pool & GitHub OIDC Provider
gcloud iam workload-identity-pools create "github" \
  --location="global" \
  --display-name="GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc "github-actions" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment" \
  --attribute-condition="assertion.repository == 'ckob/ado-syntax-highlighter' && assertion.environment == 'chrome-web-store'"

# 4. Allow the GitHub environment to impersonate the Service Account
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/ckob/ado-syntax-highlighter"

# 5. Print the values to copy into GitHub Variables
echo "CWS_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-actions"
echo "CWS_SERVICE_ACCOUNT=${SA_EMAIL}"
```

### B. Link the Service Account in the Chrome Web Store

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Go to **Account** (left sidebar) and paste `cws-publisher@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com` into the **Service account** / API access field, then save.
3. Note your **Publisher ID** (shown on the **Account** page and in the dashboard URL `.../devconsole/<PUBLISHER_ID>`).

### C. GitHub Actions Variables

In your GitHub repository (**Settings → Secrets and variables → Actions → Variables**), add:

| Name | Value |
| :--- | :--- |
| `CWS_WIF_PROVIDER` | `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/github-actions` |
| `CWS_SERVICE_ACCOUNT` | `cws-publisher@<PROJECT_ID>.iam.gserviceaccount.com` |
| `CWS_PUBLISHER_ID` | Your Chrome Web Store Publisher ID |
| `CWS_ITEM_ID` *(optional)* | Defaults to `lclohacjbfchomeeopaffkedfnbjicdn` |

---

## 2. Firefox Add-ons (AMO API v5)

1. Go to [Manage API Credentials on AMO](https://addons.mozilla.org/developers/addon/api/key/).
2. Generate a new key pair (**JWT issuer** and **JWT secret**).
3. In your GitHub repository (**Settings → Secrets and variables → Actions → Secrets**), add:

| Name | Value |
| :--- | :--- |
| `AMO_API_KEY` | Your AMO JWT issuer (e.g. `user:12345678:90`) |
| `AMO_API_SECRET` | Your AMO JWT secret |

`publish-firefox.mjs` automatically reads the add-on ID (`ado-syntax-highlighter@ckob.github.io`) from `manifest.firefox.json`, uploads `dist/firefox-extension.zip`, attaches `dist/firefox-source.zip` (created via `git archive`), and includes build reproducibility notes for AMO reviewers.

---

## 3. GitHub Environments (Optional Protection Rules)

The workflow uses two GitHub Environments: `chrome-web-store` and `firefox-add-ons`.
- Both automatically inherit repository-level Actions Variables and Secrets.
- Under **Settings → Environments**, you can optionally add deployment protection rules (for example, requiring manual approval before publishing or restricting deployments to `v*.*.*` tags).

---

## 4. Publishing a New Release

1. Update `"version"` in both `manifest.chrome.json` and `manifest.firefox.json` to `X.Y.Z`.
2. Commit the version bump to `main`.
3. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```
