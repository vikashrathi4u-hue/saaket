export async function onRequestGet(context) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = context.env;

  try {
    // Fetch unique customers from the customers table
    // We order by name to make the dashboard easier to navigate
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?select=customer_name,mobile_no&order=customer_name.asc`, 
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.statusText}`);
    }

    const data = await response.json();

    // Format the data to match the keys used in your dashboard_7.html
    const formattedData = data.map(c => ({
      name: c.customer_name || "Unknown",
      mobile: c.mobile_no || "N/A",
      last_note: "No history",
      last_note_date: ""
    }));

    return new Response(JSON.stringify(formattedData), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache" 
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}