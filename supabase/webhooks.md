# Supabase Webhook Configuration

This document defines the required webhook configurations for FitChallenge.
These webhooks must be configured in the Supabase Dashboard.

> **Note:** Webhook configuration is not yet fully automatable via Supabase CLI.
> This file serves as the source of truth for manual configuration.

---

## Required Webhooks

### 1. send-push-on-notification

Triggers push notification delivery when a notification record is created.

| Field             | Value                                      |
| ----------------- | ------------------------------------------ |
| **Name**          | `send-push-on-notification`                |
| **Schema**        | `public`                                   |
| **Table**         | `notifications`                            |
| **Events**        | `INSERT` only                              |
| **Type**          | `Supabase Edge Function`                   |
| **Edge Function** | `send-push`                                |
| **HTTP Headers**  | None (service role injected automatically) |
| **Timeout**       | 5000ms (default)                           |

#### Purpose

When a notification is inserted (e.g., via `enqueue_challenge_invite_notification` RPC),
this webhook triggers the `send-push` Edge Function to:

1. Fetch the user's registered push tokens
2. Send push notifications via Expo Push API
3. Update `notifications.push_sent_at` to prevent duplicate delivery

#### Configuration Steps

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Database** → **Webhooks**
3. Click **Create a new webhook**
4. Enter the configuration values from the table above
5. Click **Create webhook**

---

## Verification

### Manual Verification

1. Open Supabase Dashboard → Database → Webhooks
2. Verify the webhook exists with correct configuration
3. Check the webhook is **Enabled**

### Test the Webhook

```sql
-- Insert a test notification (use a real user_id from your profiles table)
INSERT INTO notifications (user_id, type, title, body, data)
VALUES (
  'YOUR_TEST_USER_UUID',
  'challenge_invite_received',
  'Test Notification',
  'This is a test push notification',
  '{"challenge_id": "test-123"}'::jsonb
);
```

Then verify:

1. Check Edge Function logs: `supabase functions logs send-push`
2. Verify `push_sent_at` is populated in the notifications row

### CI Verification

Run the verification script:

```bash
node scripts/verify-webhook-config.js
```

---

## Troubleshooting

### Webhook Not Triggering

| Symptom            | Possible Cause               | Solution                                  |
| ------------------ | ---------------------------- | ----------------------------------------- |
| No function logs   | Webhook disabled             | Enable webhook in Dashboard               |
| No function logs   | Wrong table/event            | Verify configuration matches above        |
| Function error 500 | Missing env vars             | Check SUPABASE_URL and SERVICE_ROLE_KEY   |
| No push received   | No tokens registered         | User must grant notification permission   |
| Duplicate pushes   | Missing `push_sent_at` check | Edge Function should check before sending |

### Viewing Webhook Logs

1. Dashboard → Database → Webhooks
2. Click on the webhook name
3. View recent invocations and their status

### Edge Function Logs

```bash
# View recent logs
supabase functions logs send-push --project-ref YOUR_PROJECT_REF

# Stream logs in real-time
supabase functions logs send-push --project-ref YOUR_PROJECT_REF --scroll
```

---

## Environment Parity

When setting up new environments (staging, production), ensure:

1. ✅ Edge Function `send-push` is deployed
2. ✅ Webhook `send-push-on-notification` is configured
3. ✅ `push_tokens` table exists with RLS policies
4. ✅ `notifications` table has `push_sent_at` column

---

## Future Automation

When Supabase CLI supports webhook configuration, this file can be converted to:

```toml
# supabase/config.toml (future)
[webhooks.send-push-on-notification]
table = "public.notifications"
events = ["INSERT"]
function = "send-push"
```

Until then, manual configuration is required per environment.
