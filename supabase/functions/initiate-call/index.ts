const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CallRequest {
  phoneNumber: string;
  emergencyContactNumber: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { phoneNumber, emergencyContactNumber }: CallRequest = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Twilio credentials from environment variables
    const twilioSid = Deno.env.get("TWILIO_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!twilioSid || !twilioAuthToken || !twilioPhoneNumber || !supabaseUrl) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create the webhook URL for Twilio to call
    const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;

    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", phoneNumber);
    formData.append("From", twilioPhoneNumber);
    formData.append("Url", webhookUrl);
    formData.append("Method", "POST");
    formData.append("StatusCallback", `${supabaseUrl}/functions/v1/handle-call`);
    formData.append("StatusCallbackMethod", "POST");
    formData.append("StatusCallbackEvent", "initiated,ringing,answered,completed");

    // Make the call to Twilio API
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to initiate call" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const callData = await twilioResponse.json();

    console.log("Call initiated successfully:", callData.sid);

    return new Response(
      JSON.stringify({
        success: true,
        callSid: callData.sid,
        status: callData.status,
        phoneNumber: phoneNumber,
        emergencyContact: emergencyContactNumber,
        message: "Call initiated successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in initiate-call function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});