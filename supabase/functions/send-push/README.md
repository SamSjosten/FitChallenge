# send-push Edge Function

Delivers push notifications via Expo Push API when notifications are created.

## Architecture

```
Client: inviteUser()
    → RPC: enqueue_challenge_invite_notification()
        → INSERT into notifications (push_sent_at = NULL)
            → DB Webhook triggers this function
                → Expo Push API
                    → UPDATE notifications SET push_sent_at = now()
```

## Deployment

### 1. Deploy the Edge Function

```bash
# From project root
supabase functions deploy send-push --project-ref YOUR_PROJECT_REF
```

### 2. Configure Database Webhook

In Supabase Dashboard:

1. Go to **Database → Webhooks**
2. Click **Create a new webhook**
3. Configure:

| Field         | Value                                             |
| ------------- | ------------------------------------------------- |
| Name          | `send-push-on-notification`                       |
| Table         | `notifications`                                   |
| Events        | `INSERT` only                                     |
| Type          | `Supabase Edge Function`                          |
| Edge Function | `send-push`                                       |
| HTTP Headers  | (none required - uses service role automatically) |

4. Click **Create webhook**

### 3. Environment Variables

The function automatically has access to:

- `SUPABASE_URL` - Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

No additional secrets required for Expo Push API (no authentication needed).

## Behavior

| Scenario                               | Action                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| New notification inserted              | Fetch user's push tokens, send via Expo, mark `push_sent_at` |
| No tokens registered                   | Mark `push_sent_at` (no delivery target)                     |
| Already sent (`push_sent_at` not null) | Skip (idempotency)                                           |
| Expo API error                         | Log error, still mark `push_sent_at` to prevent retry spam   |

## Testing

### Manual Test via cURL

```bash
# Get your function URL and anon key from Supabase Dashboard
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/send-push' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "type": "INSERT",
    "table": "notifications",
    "schema": "public",
    "record": {
      "id": "test-id",
      "user_id": "test-user-id",
      "type": "challenge_invite_received",
      "title": "Test Notification",
      "body": "This is a test",
      "data": {"challenge_id": "test-challenge"},
      "created_at": "2024-01-01T00:00:00Z",
      "read_at": null,
      "push_sent_at": null
    },
    "old_record": null
  }'
```

### Verify in Logs

```bash
supabase functions logs send-push --project-ref YOUR_PROJECT_REF
```

## Push Message Format

Messages sent to Expo include:

```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "New challenge invite",
  "body": "Alice invited you to \"10K Steps Challenge\"",
  "data": {
    "challenge_id": "uuid",
    "notification_id": "uuid",
    "notification_type": "challenge_invite_received"
  },
  "sound": "default",
  "channelId": "challenge-notifications"
}
```

## Android Channel Setup

The function uses `channelId: "challenge-notifications"`. Ensure your app creates this channel:

```typescript
// In app initialization
import * as Notifications from "expo-notifications";

Notifications.setNotificationChannelAsync("challenge-notifications", {
  name: "Challenge Notifications",
  importance: Notifications.AndroidImportance.HIGH,
  sound: "default",
});
```

## Error Handling

| Error                    | Handling                        |
| ------------------------ | ------------------------------- |
| Missing env vars         | 500 response, logged            |
| DB query failure         | 500 response, logged            |
| Expo API failure         | 500 response, logged            |
| Partial delivery failure | Success response, errors logged |

## Security

- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS (required to read any user's tokens)
- No user secrets in payload
- Notification `data` contains only routing IDs (no private info per contract)
