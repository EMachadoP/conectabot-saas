import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const normalizeRecipient = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/html": "html",
};

function extractBase64Payload(raw: string) {
  const match = raw.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return {
      mimeType: match[1] || "application/octet-stream",
      payload: match[2],
    };
  }

  return {
    mimeType: "application/octet-stream",
    payload: raw,
  };
}

function sanitizeFileName(fileName: string | null | undefined) {
  const fallback = `arquivo-${Date.now()}`;
  if (!fileName) return fallback;
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || fallback;
}

function splitFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) {
    return { baseName: fileName, extension: null };
  }

  return {
    baseName: fileName.slice(0, lastDot),
    extension: fileName.slice(lastDot + 1).toLowerCase() || null,
  };
}

function detectMessageType(fileType: string | null | undefined, extension: string) {
  if (fileType?.startsWith("image/")) return { endpoint: "send-image", messageType: "image" as const };
  if (fileType?.startsWith("video/")) return { endpoint: "send-video", messageType: "video" as const };
  if (fileType?.startsWith("audio/")) return { endpoint: "send-audio", messageType: "audio" as const };
  return { endpoint: `send-document/${extension}`, messageType: "document" as const };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization");
    const isServiceKey = authHeader?.includes(supabaseServiceKey);

    let senderUserId: string | null = null;
    if (!isServiceKey) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado: Sessão ausente" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !authData.user) {
        return new Response(JSON.stringify({ error: "Sessão expirada ou inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      senderUserId = authData.user.id;
    }

    const requireBillingAccess = async (workspaceId: string, actionType: string, quantity = 1) => {
      const { data, error } = await supabase.rpc("can_perform_action", {
        p_workspace_id: workspaceId,
        p_action_type: actionType,
        p_quantity: quantity,
      });

      if (error) {
        throw new Error(`Falha ao validar billing: ${error.message}`);
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.allowed) {
        const message = result?.reason === "subscription_inactive"
          ? "Assinatura pendente. Regularize o pagamento para continuar usando."
          : "Limite do plano atingido. Faça upgrade para continuar.";

        return new Response(JSON.stringify({
          error: message,
          reason: result?.reason ?? "billing_blocked",
          plan_name: result?.plan_name ?? null,
          usage: result?.current_usage ?? null,
          limit: result?.usage_limit ?? null,
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return null;
    };

    const {
      conversation_id,
      file_url,
      file_name,
      file_type,
      file_base64,
      caption,
      sender_id,
    } = await req.json();

    if (!conversation_id || (!file_url && !file_base64)) {
      return new Response(JSON.stringify({ error: "conversation_id e arquivo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveSenderId = senderUserId || sender_id || "system";

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select(`
        id,
        workspace_id,
        contacts (
          id,
          phone,
          lid,
          chat_lid,
          is_group
        )
      `)
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = (conversation as any).workspace_id;
    const contact = (conversation as any).contacts;
    const recipientPhone = normalizeRecipient(contact.chat_lid) || normalizeRecipient(contact.lid) || normalizeRecipient(contact.phone);

    const billingBlock = await requireBillingAccess(workspaceId, "outbound_message", 1);
    if (billingBlock) return billingBlock;

    if (!recipientPhone) {
      return new Response(JSON.stringify({ error: "Contato sem identificador válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let publicFileUrl = file_url as string | null;
    let resolvedFileType = file_type as string | null;
    const sanitizedOriginalName = sanitizeFileName(file_name);
    const { baseName, extension: originalExtension } = splitFileName(sanitizedOriginalName);

    if (!publicFileUrl && typeof file_base64 === "string") {
      const { mimeType, payload } = extractBase64Payload(file_base64);
      const effectiveMime = resolvedFileType || mimeType;
      const extension = effectiveMime ? (extensionByMime[effectiveMime] || effectiveMime.split("/")[1] || "bin") : "bin";
      const effectiveFileName = originalExtension === extension ? sanitizedOriginalName : `${baseName}.${extension}`;
      const objectPath = `${workspaceId}/${conversation_id}/outbound/${crypto.randomUUID()}-${effectiveFileName}`;
      const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(objectPath, bytes, {
          contentType: effectiveMime || "application/octet-stream",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Falha ao armazenar arquivo: ${uploadError.message}`);
      }

      const { data: publicData } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(objectPath);

      publicFileUrl = publicData.publicUrl;
      resolvedFileType = effectiveMime;
    }

    if (!publicFileUrl) {
      throw new Error("Não foi possível gerar uma URL pública para o arquivo.");
    }

    const resolvedExtension = resolvedFileType
      ? (extensionByMime[resolvedFileType] || resolvedFileType.split("/")[1] || "bin")
      : (originalExtension || "bin");
    const resolvedFileName = originalExtension === resolvedExtension
      ? sanitizedOriginalName
      : `${baseName}.${resolvedExtension}`;

    const { data: zapiSettings } = await supabase
      .from("zapi_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    const instanceId = zapiSettings?.zapi_instance_id || Deno.env.get("ZAPI_INSTANCE_ID");
    const token = zapiSettings?.zapi_token || Deno.env.get("ZAPI_TOKEN");
    const clientToken = zapiSettings?.zapi_security_token || Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !token) {
      return new Response(JSON.stringify({ error: "Credenciais Z-API não configuradas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { endpoint, messageType } = detectMessageType(resolvedFileType, resolvedExtension);
    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
    const zapiPayload: Record<string, string> = {
      phone: recipientPhone,
    };

    if (messageType === "image") {
      zapiPayload.image = publicFileUrl;
      if (caption) zapiPayload.caption = caption;
    } else if (messageType === "video") {
      zapiPayload.video = publicFileUrl;
      if (caption) zapiPayload.caption = caption;
    } else if (messageType === "audio") {
      zapiPayload.audio = publicFileUrl;
    } else {
      zapiPayload.document = publicFileUrl;
      zapiPayload.fileName = resolvedFileName;
    }

    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify(zapiPayload),
    });

    const zapiResult = await zapiResponse.json();
    console.log("[zapi-send-file] Z-API response", JSON.stringify(zapiResult));

    if (!zapiResponse.ok) {
      return new Response(JSON.stringify({ error: "Falha ao enviar via Z-API", details: zapiResult }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerMessageId = zapiResult.messageId || zapiResult.zapiMessageId || zapiResult.id || null;
    if (!providerMessageId) {
      return new Response(JSON.stringify({
        error: "A Z-API aceitou a requisição, mas não confirmou o envio do arquivo.",
        details: zapiResult,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message, error: msgError } = await supabase
      .from("messages")
      .insert({
        workspace_id: workspaceId,
        conversation_id,
        sender_type: "agent",
        sender_id: effectiveSenderId,
        message_type: messageType,
        content: caption || resolvedFileName || null,
        media_url: publicFileUrl,
        provider: "zapi",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        direction: "outbound",
      })
      .select()
      .single();

    if (msgError) {
      throw msgError;
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    await supabase.rpc("record_usage", {
      p_workspace_id: workspaceId,
      p_metric_name: "messages_sent",
      p_quantity: 1,
    });

    return new Response(JSON.stringify({
      success: true,
      message_id: message.id,
      zapi_message_id: providerMessageId,
      public_url: publicFileUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[zapi-send-file]", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
