export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  
  try {
    const { customer_name, mobile_no, notes } = await context.request.json();

    const response = await fetch(`${url}/rest/v1/customer_communication`, {
      method: 'POST',
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        customer_name,
        mobile_no,
        notes,
        interaction_type: 'Call'
      })
    });

    if (!response.ok) throw new Error('Supabase insert failed');

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}