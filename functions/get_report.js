export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  
  try {
    const { items, brand, startDate, endDate } = await context.request.json();

    // 1. Build the query for sales_history
    // We use quotes around values to handle spaces in names like "BABY PRODUCTS"
    let query = `${url}/rest/v1/sales_history?select=bill_no`;
    
    if (items && items.length > 0) {
      const formattedItems = items.map(i => `"${i}"`).join(',');
      query += `&item_name=in.(${formattedItems})`;
    }
    
    if (brand) {
      query += `&brand=eq."${brand}"`;
    }
    
    if (startDate) query += `&bill_date=gte.${startDate}`;
    if (endDate) query += `&bill_date=lte.${endDate}`;

    const salesRes = await fetch(query, {
      headers: { 
        "apikey": key, 
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    });

    if (!salesRes.ok) {
      const errorText = await salesRes.text();
      throw new Error(`Supabase Sales Error: ${errorText}`);
    }

    const salesData = await salesRes.json();

    // 2. Extract unique Bill Numbers
    const billNumbers = [...new Set(salesData.map(s => s.bill_no))].filter(b => b);

    if (billNumbers.length === 0) {
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
    }

    // 3. Fetch Customer details
    // Wrap bill numbers in quotes to ensure they are treated as strings if needed
    const formattedBills = billNumbers.map(b => `"${b}"`).join(',');
    const customerQuery = `${url}/rest/v1/customers?bill_no=in.(${formattedBills})&select=mobile_no`;

    const customerRes = await fetch(customerQuery, {
      headers: { 
        "apikey": key, 
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    });

    if (!customerRes.ok) {
      const errorText = await customerRes.text();
      throw new Error(`Supabase Customer Error: ${errorText}`);
    }

    const customerData = await customerRes.json();

    // 4. Return unique mobile numbers
    const uniqueMobiles = [...new Set(customerData.map(c => c.mobile_no))].filter(m => m && m.trim() !== "");
    
    return new Response(JSON.stringify(uniqueMobiles), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    // This will now show up in your Cloudflare dashboard logs
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}