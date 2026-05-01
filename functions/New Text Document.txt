export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  
  try {
    const { items, brand, startDate, endDate } = await context.request.json();

    // 1. Build the query for sales_history
    let query = `${url}/rest/v1/sales_history?select=bill_no,item_name,brand,bill_date`;
    
    // Add filters
    if (items && items.length > 0) query += `&item_name=in.(${items.join(',')})`;
    if (brand) query += `&brand=eq.${brand}`;
    if (startDate) query += `&bill_date=gte.${startDate}`;
    if (endDate) query += `&bill_date=lte.${endDate}`;

    const salesRes = await fetch(query, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const salesData = await salesRes.json();

    // 2. Extract unique Bill Numbers from filtered sales
    const billNumbers = [...new Set(salesData.map(s => s.bill_no))];

    if (billNumbers.length === 0) {
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
    }

    // 3. Fetch Customer details (mobile_no) for these specific Bill Numbers
    // We use a POST request with a filter to handle potentially long lists of bill numbers
    const customerRes = await fetch(`${url}/rest/v1/customers?bill_no=in.(${billNumbers.join(',')})&select=mobile_no,customer_name,bill_no`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const customerData = await customerRes.json();

    // 4. Return unique mobile numbers
    const uniqueMobiles = [...new Set(customerData.map(c => c.mobile_no))].filter(m => m);
    
    return new Response(JSON.stringify(uniqueMobiles), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}