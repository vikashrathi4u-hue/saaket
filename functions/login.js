export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  try {
    const { username, password } = await context.request.json();
    const response = await fetch(`${url}/rest/v1/user_access?username=eq.${username}&password=eq.${password}&select=role`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const users = await response.json();
    if (users.length > 0) {
      return new Response(JSON.stringify({ success: true, role: users[0].role }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ success: false }), { status: 401 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
