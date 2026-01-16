// supabase/functions/send-push/index.ts
// Edge Function: Send push notifications via Expo Push API
//
// TRIGGER: Database webhook on INSERT into notifications table
// CONTRACT: Updates push_sent_at to prevent duplicate delivery (Rule 18)
//
// @ts-nocheck - Deno runtime types not available in Node.js editor

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// TYPES
// =============================================================================

interface WebhookPayload {
  type: "INSERT";
  table: "notifications";
  record: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    created_at: string;
    read_at: string | null;
    push_sent_at: string | null;
  };
  schema: "public";
  old_record: null;
}

interface PushToken {
  token: string;
  platform: string | null;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Send push notifications via Expo Push API
 */
async function sendExpoPush(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) {
    return [];
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Expo Push API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.data as ExpoPushTicket[];
}

/**
 * Build push message from notification data
 */
function buildPushMessage(
  token: string,
  notification: WebhookPayload["record"]
): ExpoPushMessage {
  return {
    to: token,
    title: notification.title,
    body: notification.body,
    data: {
      ...notification.data,
      notification_id: notification.id,
      notification_type: notification.type,
    },
    sound: "default",
    // Android channel for challenge notifications
    channelId: "challenge-notifications",
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse webhook payload
    const payload: WebhookPayload = await req.json();

    // Validate payload
    if (payload.type !== "INSERT" || payload.table !== "notifications") {
      return new Response(
        JSON.stringify({ error: "Invalid webhook payload" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const notification = payload.record;

    // Skip if already sent (idempotency check)
    if (notification.push_sent_at !== null) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Already sent",
          notification_id: notification.id,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active push tokens for the user
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", notification.user_id)
      .is("disabled_at", null);

    if (tokensError) {
      throw new Error(`Failed to fetch push tokens: ${tokensError.message}`);
    }

    // No tokens registered - mark as sent anyway (no target device)
    if (!tokens || tokens.length === 0) {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", notification.id);

      if (updateError) {
        console.error("Failed to update push_sent_at:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "No push tokens registered",
          notification_id: notification.id,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Build push messages for all user's devices
    const messages: ExpoPushMessage[] = (tokens as PushToken[]).map((t) =>
      buildPushMessage(t.token, notification)
    );

    // Send via Expo Push API
    const tickets = await sendExpoPush(messages);

    // Log any errors but don't fail the whole operation
    const errors = tickets.filter((t) => t.status === "error");
    if (errors.length > 0) {
      console.error("Some push deliveries failed:", errors);
    }

    // Mark notification as sent (prevents duplicate delivery)
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", notification.id);

    if (updateError) {
      console.error("Failed to update push_sent_at:", updateError);
      // Don't throw - push was already sent
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification.id,
        devices_targeted: tokens.length,
        tickets_ok: tickets.filter((t) => t.status === "ok").length,
        tickets_error: errors.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-push error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
