# Design object storage

Generated client designs belong in a private S3-compatible bucket. The repository contains application code and storage configuration templates. Temporary authoring takes place outside the checkout; CRM records retain object references and prospect links. There is no local publication fallback.

No provider or bucket has been selected. This integration is prepared, but no cloud account, bucket, credentials, billing or cloud upload has been configured or tested.

## Configure once a provider is chosen

From `backend`, run `npm run storage:dependencies` to install the independently locked AWS SDK. This keeps the storage worker's dependencies separate from the pinned NocoBase installation. Add these server-only settings to `backend/.env` or the deployment's secret/environment configuration:

```dotenv
DESIGN_S3_BUCKET=YOUR_PRIVATE_BUCKET
DESIGN_S3_REGION=YOUR_REGION
DESIGN_S3_PREFIX=sixsummit
DESIGN_S3_ENDPOINT=
DESIGN_S3_FORCE_PATH_STYLE=false
DESIGN_S3_ACCESS_KEY_ID=
DESIGN_S3_SECRET_ACCESS_KEY=
DESIGN_S3_SESSION_TOKEN=
DESIGN_WORK_ROOT=
```

AWS S3 normally leaves the endpoint empty. For another S3-compatible service, use its HTTPS endpoint, region and path-style setting. For AWS deployments, prefer an instance/task role: empty explicit keys use the SDK's default credential chain. Explicit credentials can instead be supplied in the `DESIGN_S3_*` fields. Never add these to Vite environment variables, source files, generated pages or Git.

Keep public bucket access disabled. The worker needs `s3:PutObject` and `s3:GetObject` on the chosen prefix; HEAD verification uses the read permission. The prospect service needs read access to `published/*` only if publication is run separately with `designs:publish` (the combined development service also runs publication and therefore needs the worker permissions). Bucket creation, listing and deletion permissions are not required by this integration. Configure encryption, retention/versioning and lifecycle policies at the chosen provider. Keep objects needed by active CRM records; only orphaned uploads and `checks/` can expire without affecting those records.

Run `npm run storage:check` for a signed PUT, HEAD and GET round trip. It leaves one tiny object under `checks/`. Run `npm run crm:bootstrap` to add `artifactManifest` and `publicationManifest` fields without dropping legacy fields, then restart the prospect service. With no configured bucket, the gallery service can show preparation states but serves no local design files.

The adapter uses the official [AWS SDK S3 operations](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html). Its local wire test validates signing, request serialization and streaming; actual provider credentials and compatibility require the configured-bucket check.

## Automation workflow

`designs:run` prepares stable per-concept folders below the operating system's temporary directory, by default `sixsummit-design-work/lead-ID/vN/concept-N`. Set `DESIGN_WORK_ROOT` to another private scratch location outside the repository when needed. The author reads `brief.json` and `authored/AUTHORING.txt`, uses ASA and VectorCraft, and writes the page, assets and editable logo master there. Temporary files can be lost; upload completed work before relying on it in CRM.

When an existing business logo is found, upload its original bytes first:

```sh
npm run assets:upload -- LEAD_ID /absolute/outside/checkout/original-logo.svg
```

This stores the logo privately and writes its S3 URI to the lead and a brand-asset record. Queue or rebrief concepts after that update so each brief references the uploaded original. All concepts must preserve the original bytes; concept one uses observed colours.

An authored concept has `authored/index.html`, its local assets and editable masters, plus `review/wide.png`, `review/narrow.png` and passing `review/findings.json` from the ASA preview helper. Keep `REVIEW.txt` for human visual-review notes. The worker runs the browser helper before uploading automatically. A Codex automation that authors directly can run that helper and then:

```sh
npm run designs:upload -- CONCEPT_RECORD_ID /absolute/outside/checkout/job-folder
```

The folder is the concept job folder containing `authored/` and `review/`, not the authored folder itself. Omitting it uses the standard temporary working folder. The upload includes editable masters, private briefs and review material. Symlinks are rejected; hidden files and `node_modules` are excluded. Limits are 64 MiB per file, 512 MiB and 2,000 files per bundle.

Every object is verified with a remote HEAD size/checksum check. The manifest is written last; only a complete verified bundle updates CRM with `artifactManifest`, S3 URIs in the legacy path fields, and `needs_review`. A failed upload cannot mark a concept completed or approved. Interrupted uploads may leave unreferenced objects; they remain private. Do not delete the only local copy after an upload failure.

Restore an uploaded bundle for staff review or further work:

```sh
npm run designs:restore -- CONCEPT_RECORD_ID /absolute/outside/checkout/empty-folder
```

Restoration verifies file hashes and requires an empty destination. After staff inspect the designs and mark a concept `ready`, `designs:publish` or the prospect service makes an immutable approved snapshot entirely through S3. It copies only site assets and the two preview images, then saves `publicationKey`, `publicationManifest`, `publishedAt` and `previewUrl`. Public access cannot retrieve the private bundle or masters. Approved concepts require a new brief version for revisions.

## Object layout and prospect delivery

```text
sixsummit/
  brands/lead-ID/UPLOAD_ID/original.svg
  drafts/lead-ID/vN/concept-N/UPLOAD_ID/
    manifest.json
    brief.json
    authored/index.html
    authored/identity.vectorcraft
    review/wide.png
    review/narrow.png
  published/SNAPSHOT_ID/
    manifest.json
    files/index.html
    files/assets/...
    desktop.png
    mobile.png
```

All objects stay private, including `published/`. Prospects still use `/designs/<token>` on the main website. The backend checks the live token, sharing switch, current brief version and approval state before reading approved objects and proxying their bytes. It never redirects visitors to an S3 URL or exposes storage credentials. Generated HTML keeps its sandbox and cannot access CRM browser storage. Disabling the lead's design link revokes subsequent file requests as well as gallery requests.

## Existing local demo files

Existing files have not been deleted or silently uploaded to an unchosen provider. After configuration, run `npm run designs:migrate`. It uploads legacy completed concepts and preserves the exact previously approved snapshots, updates CRM references only after successful uploads, and leaves local originals for verification. It also migrates referenced original logos from private legacy storage. Incomplete authoring folders remain local until completed or manually archived; migration does not call them completed.

Restore a migrated bundle and check its prospect link before removing its old local originals. Future generation and publication use temporary folders and S3 exclusively. Back up the CRM database separately; S3 is the design artifact store, not a database backup.
