const string = (name, title, extra = {}) => ({ name, type: 'string', interface: 'input', uiSchema: { title, type: 'string', 'x-component': 'Input' }, ...extra })
const text = (name, title) => ({ name, type: 'text', interface: 'textarea', uiSchema: { title, type: 'string', 'x-component': 'Input.TextArea' } })
const json = (name, title) => ({ name, type: 'json', interface: 'json', uiSchema: { title, 'x-component': 'Input.JSON' } })
const date = (name, title) => ({ name, type: 'date', interface: 'datetime', uiSchema: { title, type: 'string', 'x-component': 'DatePicker', 'x-component-props': { showTime: true } } })
const number = (name, title, extra = {}) => ({ name, type: 'integer', interface: 'integer', uiSchema: { title, type: 'number', 'x-component': 'InputNumber' }, ...extra })
const boolean = (name, title) => ({ name, type: 'boolean', interface: 'checkbox', defaultValue: false, uiSchema: { title, type: 'boolean', 'x-component': 'Checkbox' } })
const select = (name, title, values, defaultValue) => ({ name, type: 'string', interface: 'select', defaultValue, uiSchema: { title, type: 'string', 'x-component': 'Select', enum: values.map((value) => ({ value, label: value.replaceAll('_', ' ') })) } })
const lead = () => ({ name: 'lead', type: 'belongsTo', interface: 'm2o', target: 'six_leads', foreignKey: 'leadId', uiSchema: { title: 'Business', 'x-component': 'AssociationField', 'x-component-props': { fieldNames: { label: 'businessName', value: 'id' } } } })

const collection = (name, title, fields, titleField = 'id') => ({ name, title, titleField, template: 'general', autoGenId: true, createdAt: true, updatedAt: true, fields })

export const collections = [
  collection('six_leads', 'Leads', [
    string('fingerprint', 'Deduplication key', { unique: true, allowNull: false }),
    string('businessName', 'Business name', { allowNull: false }),
    string('phone', 'Phone'), string('email', 'Email'), string('category', 'Category'),
    string('city', 'City'), string('province', 'Province'), string('country', 'Country'), text('address', 'Address'),
    select('websiteStatus', 'Website check', ['not_checked', 'none_found', 'social_only', 'platform_only', 'website_found', 'uncertain'], 'not_checked'),
    date('websiteCheckedAt', 'Website checked at'), json('websiteEvidence', 'Website evidence'),
    json('socialLinks', 'Social profiles'), json('services', 'Observed services'),
    json('motifs', 'Brand motifs and evidence'), json('brandPalette', 'Observed brand colours'),
    select('logoStatus', 'Existing logo', ['not_checked', 'found', 'not_found', 'unusable'], 'not_checked'),
    string('logoAssetPath', 'Original logo asset'), text('businessNotes', 'Business notes'),
    date('qualifiedAt', 'Qualified at'), number('priority', 'Priority', { defaultValue: 0 }),
    select('contactStatus', 'Pipeline stage', ['new', 'assigned', 'called', 'follow_up', 'interested', 'meeting_booked', 'proposal_sent', 'won', 'lost', 'invalid_contact', 'do_not_call'], 'new'),
    string('assignedTo', 'Assigned caller'), date('nextFollowUpAt', 'Next follow-up'),
    number('assignedToUserId', 'Assigned caller ID'), string('lastDisposition', 'Last call outcome'), date('lastContactAt', 'Last activity'),
    date('meetingAt', 'Scheduled meeting'), date('firstMeetingAt', 'First meeting booked at'),
    date('wonAt', 'Project won at'), number('wonValueCents', 'Won value in cents'), string('currency', 'Currency', { defaultValue: 'CAD' }),
    date('lostAt', 'Closed lost at'), text('lossReason', 'Loss reason'), date('optedOutAt', 'Opted out at'), boolean('isDemo', 'Demonstration record'),
    select('designStatus', 'Design status', ['not_queued', 'queued', 'generating', 'needs_review', 'ready', 'failed'], 'not_queued'),
    number('briefVersion', 'Brief version', { defaultValue: 1 }),
  ], 'businessName'),
  collection('six_sources', 'Lead evidence', [
    lead(), string('sourceKey', 'Source record key', { unique: true }),
    string('sourceName', 'Source'), string('sourceUrl', 'Source URL'), date('observedAt', 'Observed at'),
    json('facts', 'Observed facts'), text('attribution', 'Source attribution'), text('retentionNotes', 'Retention terms'),
  ]),
  collection('six_brand_assets', 'Brand assets', [
    lead(), select('kind', 'Asset type', ['original_logo', 'brand_reference', 'proposed_logo'], 'original_logo'),
    string('path', 'Local asset path'), string('sourceUrl', 'Original source'), string('sha256', 'Content checksum'),
    json('colours', 'Observed colours'), text('notes', 'Asset notes'),
  ]),
  collection('six_concepts', 'Homepage concepts', [
    lead(), string('jobKey', 'Design job key', { unique: true, allowNull: false }),
    number('conceptNumber', 'Concept number'), number('briefVersion', 'Brief version'),
    string('direction', 'Design direction'), string('archetype', 'ASA identity'), string('register', 'ASA register'),
    select('status', 'Status', ['queued', 'awaiting_author', 'running', 'needs_review', 'ready', 'failed'], 'queued'),
    json('brief', 'Design brief'), json('palette', 'Colour palette'),
    string('htmlPath', 'Homepage file'), string('desktopPath', 'Desktop preview'), string('mobilePath', 'Mobile preview'),
    json('findings', 'Quality checks'), text('error', 'Last error'),
  ]),
  collection('six_activities', 'Calls and follow-ups', [
    lead(), select('kind', 'Activity', ['call', 'stage_update', 'note', 'follow_up', 'opt_out', 'reopen', 'assignment'], 'note'),
    string('caller', 'Caller'), date('occurredAt', 'When'), text('notes', 'Notes'), date('followUpAt', 'Follow-up date'),
    number('callerId', 'Caller ID'), string('city', 'City at time of activity'), string('disposition', 'Outcome'),
    string('requestId', 'Request ID', { unique: true }), string('payloadHash', 'Request checksum'),
    string('fromStage', 'Previous stage'), string('toStage', 'Resulting stage'), date('meetingAt', 'Meeting date'),
    number('valueCents', 'Project value in cents'), string('currency', 'Currency'), text('lossReason', 'Loss reason'), boolean('isDemo', 'Demonstration record'),
  ]),
  collection('six_runs', 'Daily lead runs', [
    string('runKey', 'Run key', { unique: true, allowNull: false }),
    string('budgetDate', 'Budget date'), number('target', 'Lead target'), number('qualifiedCount', 'Qualified leads'),
    select('status', 'Status', ['running', 'finished', 'failed'], 'running'),
    date('startedAt', 'Started at'), date('finishedAt', 'Finished at'), json('summary', 'Run summary'),
  ]),
]

export const leadRelations = [
  ['sources', 'Lead evidence', 'six_sources'],
  ['brandAssets', 'Brand assets', 'six_brand_assets'],
  ['concepts', 'Homepage concepts', 'six_concepts'],
  ['activities', 'Calls and follow-ups', 'six_activities'],
].map(([name, title, target]) => ({ name, type: 'hasMany', interface: 'o2m', target, foreignKey: 'leadId', uiSchema: { title, 'x-component': 'AssociationField' } }))
