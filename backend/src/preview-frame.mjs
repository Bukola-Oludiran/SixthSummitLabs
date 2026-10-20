// Only forwards an Escape gesture. The host accepts it from its own active
// preview frame; no credentials, parent access or navigation are granted.
export const previewFrameScript = `addEventListener('keydown', event => {
  if (event.key === 'Escape') setTimeout(() => {
    if (!event.defaultPrevented) parent.postMessage({ type: 'sixsummit-preview:escape' }, '*');
  }, 0);
});`
export const previewFrameTag = Buffer.from('\n<script src="/prospect-api/preview-frame.js"></script>\n')
