import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { useFlowContext } from '@nocobase/flow-engine';

const NS = '@nocobase/plugin-sixsummit-crm';
interface Business {
  id: number;
  businessName: string;
  phone: string;
  city: string;
  contactStatus: string;
  assignedTo?: string;
  nextFollowUpAt?: string;
}
interface Summary {
  callerNames: Record<string, string>;
  metrics: {
    callAttempts: number;
    connectedCalls: number;
    meetingsBooked: number;
    projectsWon: number;
    wonValueCents: number;
    overdueFollowUps: number;
    connectionRate: number | null;
    meetingToWinConversion: number | null;
  };
  outcomes: Record<string, number>;
  byCity: Record<string, number>;
  byCaller: Record<string, number>;
  byDay: Record<string, number>;
}
interface OutcomeForm {
  disposition: string;
  kind: string;
  notes?: string;
  followUpAt?: string;
  meetingAt?: string;
  lossReason?: string;
  valueDollars?: number;
}
const label = (value: string) => value.replaceAll('_', ' ');

export default function CrmWorkspace() {
  const ctx = useFlowContext();
  const t = useCallback((key: string) => ctx.t(key, { ns: NS }), [ctx]);
  const [leads, setLeads] = useState<Business[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [city, setCity] = useState<string>();
  const [days, setDays] = useState(30);
  const [callerId, setCallerId] = useState<number>();
  const [callers, setCallers] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<OutcomeForm>();
  const outcome = Form.useWatch('disposition', form);
  const requestId = useRef<string>();
  const load = useCallback(async () => {
    try {
      const params = {
        city,
        callerId,
        from: new Date(Date.now() - days * 86400000).toISOString(),
        to: new Date().toISOString(),
      };
      const [work, metrics, dispositions, people] = await Promise.all([
        ctx.api.request({ url: 'six_crm:worklist', params: { city } }),
        ctx.api.request({ url: 'six_crm:summary', params }),
        ctx.api.request({ url: 'six_crm:dispositions' }),
        ctx.api.request({ url: 'six_crm:callers' }),
      ]);
      setLeads(work.data.data);
      setSummary(metrics.data.data);
      setCallers(people.data.data);
      setOptions(dispositions.data.data.map((entry: { value: string }) => entry.value));
      setError(undefined);
    } catch {
      setError(t('Could not load the CRM. Check your role and try again.'));
    }
  }, [ctx, city, days, callerId, t]);
  useEffect(() => {
    load();
  }, [load]);
  const open = (business: Business) => {
    setSelected(business);
    form.resetFields();
    form.setFieldsValue({ disposition: 'no_answer', kind: 'call' });
    requestId.current = crypto.randomUUID();
  };
  const save = async (values: OutcomeForm) => {
    if (!selected) return;
    setSaving(true);
    try {
      await ctx.api.request({
        url: 'six_crm:recordOutcome',
        method: 'post',
        data: {
          ...values,
          requestId: requestId.current,
          leadId: selected.id,
          valueCents: values.valueDollars === undefined ? null : Math.round(values.valueDollars * 100),
          followUpAt: values.followUpAt ? new Date(values.followUpAt).toISOString() : null,
          meetingAt: values.meetingAt ? new Date(values.meetingAt).toISOString() : null,
        },
      });
      message.success(t('Outcome saved'));
      setSelected(null);
      await load();
    } catch {
      message.error(
        t(
          'Could not save. Check the required fields, assignment and lead status. You can retry without creating a duplicate.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  const claim = async (lead: Business) => {
    try {
      await ctx.api.request({
        url: 'six_crm:assign',
        method: 'post',
        data: { leadId: lead.id },
      });
      await load();
    } catch {
      message.error(t('This lead could not be assigned. Refresh the list.'));
    }
  };
  const breakdown = (data: Record<string, number> = {}, callerLabels = false) => (
    <Table
      size="small"
      rowKey="label"
      pagination={false}
      dataSource={Object.entries(data).map(([key, count]) => ({
        label: callerLabels
          ? summary?.callerNames?.[key] ||
            callers.find((person) => String(person.id) === key)?.name ||
            t('Former caller')
          : t(label(key)),
        count,
      }))}
      columns={[
        { title: t('Group'), dataIndex: 'label' },
        { title: t('Call attempts'), dataIndex: 'count' },
      ]}
    />
  );
  return (
    <div style={{ padding: 24, maxWidth: 1500, margin: 'auto' }}>
      <Typography.Title level={2}>{t('6ixSummit CRM')}</Typography.Title>
      <Space wrap style={{ marginBottom: 24 }}>
        <Select
          aria-label={t('City')}
          placeholder={t('All cities')}
          allowClear
          value={city}
          onChange={setCity}
          style={{ width: 180 }}
          options={['Regina', 'Edmonton', 'Calgary'].map((value) => ({
            value,
            label: value,
          }))}
        />
        <Select
          aria-label={t('Reporting period')}
          value={days}
          onChange={setDays}
          style={{ width: 180 }}
          options={[7, 30, 90].map((value) => ({
            value,
            label: t(`Last ${value} days`),
          }))}
        />
        <Select
          aria-label={t('Caller')}
          placeholder={t('All callers')}
          allowClear
          style={{ width: 180 }}
          value={callerId}
          onChange={setCallerId}
          options={callers.map((person) => ({
            value: person.id,
            label: person.name,
          }))}
        />
        <Button onClick={load}>{t('Refresh')}</Button>
      </Space>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 20 }} />}
      <Tabs
        items={[
          {
            key: 'calls',
            label: t('Call workspace'),
            children: (
              <Card title={t('Qualified businesses ready for a conversation')}>
                <Table<Business>
                  rowKey="id"
                  dataSource={leads}
                  locale={{
                    emptyText: (
                      <Empty
                        description={t(
                          'No qualified businesses are waiting. Unverified discoveries remain in Leads for research.',
                        )}
                      />
                    ),
                  }}
                  scroll={{ x: 1000 }}
                  columns={[
                    { title: t('Business'), dataIndex: 'businessName' },
                    {
                      title: t('Phone'),
                      dataIndex: 'phone',
                      render: (phone: string) => <a href={`tel:${phone}`}>{phone}</a>,
                    },
                    { title: t('City'), dataIndex: 'city' },
                    {
                      title: t('Stage'),
                      dataIndex: 'contactStatus',
                      render: (value: string) => <Tag>{t(label(value))}</Tag>,
                    },
                    { title: t('Caller'), dataIndex: 'assignedTo' },
                    {
                      title: t('Next action'),
                      dataIndex: 'nextFollowUpAt',
                      render: (value: string) => (value ? new Date(value).toLocaleString() : '—'),
                    },
                    {
                      title: t('Actions'),
                      render: (_, business) => (
                        <Space>
                          <Button onClick={() => claim(business)}>{t('Assign to me')}</Button>
                          <Button type="primary" onClick={() => open(business)}>
                            {t('Record outcome')}
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'analytics',
            label: t('Analytics'),
            children: summary ? (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  {[
                    ['Call attempts', summary.metrics.callAttempts],
                    ['Connected calls', summary.metrics.connectedCalls],
                    ['Meetings booked', summary.metrics.meetingsBooked],
                    ['Projects won', summary.metrics.projectsWon],
                    ['Won project value (CAD)', (summary.metrics.wonValueCents / 100).toFixed(2)],
                    ['Overdue follow-ups', summary.metrics.overdueFollowUps],
                  ].map(([title, value]) => (
                    <Col xs={24} sm={12} lg={8} key={String(title)}>
                      <Card>
                        <Statistic title={t(String(title))} value={value} />
                      </Card>
                    </Col>
                  ))}
                </Row>
                <Alert
                  type="info"
                  message={t(
                    'Meetings and wins count distinct businesses in this period. Calls keep their original caller. Follow-ups use current ownership.',
                  )}
                />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card title={t('Connection rate')}>
                      <Statistic
                        value={
                          summary.metrics.connectionRate === null
                            ? '—'
                            : `${(summary.metrics.connectionRate * 100).toFixed(1)}%`
                        }
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card title={t('Meeting cohort to won project')}>
                      <Statistic
                        value={
                          summary.metrics.meetingToWinConversion === null
                            ? '—'
                            : `${(summary.metrics.meetingToWinConversion * 100).toFixed(1)}%`
                        }
                      />
                      <Typography.Paragraph>
                        {t(
                          'Businesses first booked in the period that have won by now. Caller filters use current ownership.',
                        )}
                      </Typography.Paragraph>
                    </Card>
                  </Col>
                </Row>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card title={t('Call outcomes')}>{breakdown(summary.outcomes)}</Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card title={t('Calls by city')}>{breakdown(summary.byCity)}</Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card title={t('Calls by caller')}>{breakdown(summary.byCaller, true)}</Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card title={t('Calls by day (Edmonton time)')}>{breakdown(summary.byDay)}</Card>
                  </Col>
                </Row>
              </Space>
            ) : (
              <Empty />
            ),
          },
        ]}
      />
      <Drawer
        title={`${t('Record outcome')} · ${selected?.businessName || ''}`}
        open={Boolean(selected)}
        onClose={() => {
          if (!saving) setSelected(null);
        }}
        width={520}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={save}
          onValuesChange={() => {
            requestId.current = crypto.randomUUID();
          }}
        >
          <Form.Item name="kind" label={t('Activity type')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'call', label: t('Call attempt') },
                {
                  value: 'stage_update',
                  label: t('Sales update without a call'),
                },
              ]}
            />
          </Form.Item>
          <Form.Item name="disposition" label={t('Outcome')} rules={[{ required: true }]}>
            <Select
              options={options.map((value) => ({
                value,
                label: t(label(value)),
              }))}
            />
          </Form.Item>
          <Form.Item name="notes" label={t('Notes')}>
            <Input.TextArea rows={4} maxLength={10000} />
          </Form.Item>
          {!['won', 'lost', 'wrong_number', 'do_not_call', 'meeting_booked'].includes(outcome) && (
            <Form.Item
              name="followUpAt"
              label={t('Next follow-up')}
              rules={[{ required: outcome === 'callback_requested' }]}
            >
              <Input type="datetime-local" />
            </Form.Item>
          )}
          {outcome === 'meeting_booked' && (
            <Form.Item name="meetingAt" label={t('Meeting time')} rules={[{ required: true }]}>
              <Input type="datetime-local" />
            </Form.Item>
          )}
          {outcome === 'lost' && (
            <Form.Item name="lossReason" label={t('Loss reason')} rules={[{ required: true }]}>
              <Input.TextArea maxLength={500} />
            </Form.Item>
          )}
          {outcome === 'won' && (
            <Form.Item name="valueDollars" label={t('Project value (CAD)')} rules={[{ required: true }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          )}
          {outcome === 'do_not_call' && (
            <Alert
              type="warning"
              message={t('This removes the business from the calling queue and cancels its next action.')}
              style={{ marginBottom: 16 }}
            />
          )}
          <Button htmlType="submit" type="primary" loading={saving}>
            {t('Save outcome')}
          </Button>
        </Form>
      </Drawer>
    </div>
  );
}
