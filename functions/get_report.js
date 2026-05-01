export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  
  try {
    const { items, brand, startDate, endDate } = await context.request.json();

    // 1. Get unique Bill Numbers from sales_history[cite: 6]
    let salesQuery = `${url}/rest/v1/sales_history?select=bill_no`;
    
    if (items && items.length > 0) {
      const formattedItems = items.map(i => `"${i}"`).join(',');
      salesQuery += `&item_name=in.(${formattedItems})`;
    }
    
    if (brand) salesQuery += `&brand=eq."${brand}"`;
    if (startDate) salesQuery += `&bill_date=gte.${startDate}`;
    if (endDate) salesQuery += `&bill_date=lte.${endDate}`;

    const salesRes = await fetch(salesQuery, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const salesData = await salesRes.json();
    const billNumbers = [...new Set(salesData.map(s => s.bill_no))].filter(b => b);

    if (billNumbers.length === 0) {
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Get Mobile and Name from bill_summaries[cite: 6]
    const formattedBills = billNumbers.map(b => `"${b}"`).join(',');
    const summaryQuery = `${url}/rest/v1/bill_summaries?bill_no=in.(${formattedBills})&select=mobile_no,customer_name`;
    
    const summaryRes = await fetch(summaryQuery, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const summaryData = await summaryRes.json();

    // 3. Filter for unique Customer + Mobile combinations[cite: 6]
    const uniqueList = [];
    const seen = new Set();

    summaryData.forEach(row => {
      if (row.mobile_no && row.mobile_no.trim() !== "") {
        const identifier = `${row.mobile_no}-${row.customer_name}`;
        if (!seen.has(identifier)) {
          seen.add(identifier);
          uniqueList.push(`${row.customer_name || 'Walk-in'} (${row.mobile_no})`);
        }
      }
    });
    
    return new Response(JSON.stringify(uniqueList), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}