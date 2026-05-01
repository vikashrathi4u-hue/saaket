export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;

  try {
    const { username, password } = await context.request.json();
    
    // Checks the user_access table in Supabase for a match
    const response = await fetch(`${url}/rest/v1/user_access?username=eq.${username}&password=eq.${password}&select=role`, {
      headers: { 
        "apikey": key, 
        "Authorization": `Bearer ${key}` 
      }
    });

    const users = await response.json();

    if (users.length > 0) {
      // Returns success and the user's role (admin/staff)
      return new Response(JSON.stringify({ success: true, role: users[0].role }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ success: false }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}