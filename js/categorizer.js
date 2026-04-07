// Auto-categorization engine using keyword matching

const Categorizer = {
  // Keyword → category rules (checked in order, first match wins)
  rules: [
    // Housing
    { keywords: ['rent', 'mortgage', 'hoa', 'property tax', 'home depot', 'lowes', 'lowe\'s', 'zillow', 'realtor', 'apartment', 'lease', 'lemonade insurance'], category: 'Housing' },

    // Utilities
    { keywords: ['electric', 'gas bill', 'water bill', 'sewage', 'trash', 'waste', 'comcast', 'xfinity', 'spectrum', 'at&t', 'att', 'verizon', 'tmobile', 't-mobile', 'sprint', 'internet', 'utility', 'utilities', 'pgande', 'pg&e', 'con edison', 'duke energy', 'power bill'], category: 'Utilities' },

    // Groceries
    { keywords: ['walmart', 'costco', 'kroger', 'safeway', 'trader joe', 'whole foods', 'aldi', 'publix', 'heb', 'h-e-b', 'meijer', 'grocery', 'groceries', 'sprouts', 'food lion', 'giant eagle', 'wegmans', 'target', 'sam\'s club', 'bj\'s', 'market basket', 'piggly', 'winn dixie', 'stop & shop', 'shoprite', 'albertsons', 'food mart', 'fresh market', 'instacart', 'dawa'], category: 'Groceries' },

    // Dining
    { keywords: ['starbucks', 'mcdonald', 'chipotle', 'chick-fil-a', 'taco bell', 'wendy', 'burger king', 'subway', 'dunkin', 'domino', 'pizza', 'grubhub', 'doordash', 'uber eat', 'ubereats', 'postmates', 'restaurant', 'cafe', 'coffee', 'diner', 'bistro', 'grill', 'sushi', 'ramen', 'thai', 'korean', 'japanese', 'mexican', 'italian', 'mediterranean', 'vietnamese', 'chinese food', 'indian food', 'cuisine', 'panda express', 'panera', 'five guys', 'shake shack', 'popeyes', 'kfc', 'arby', 'sonic drive', 'waffle house', 'ihop', 'denny', 'applebee', 'olive garden', 'outback', 'cheesecake factory', 'buffalo wild', 'wingstop', 'jack in the box', 'in-n-out', 'chili\'s', 'cracker barrel', 'red lobster', 'texas roadhouse', 'sweetgreen', 'cava', 'noodles', 'bakery', 'bar ', 'pub ', 'tavern', 'brewery', 'toast tab', 'square meal', 'eatery', 'savoy', 'convenience', 'deli', 'chunnu', 'pret'], category: 'Dining' },

    // Travel (must be BEFORE Transportation so flights/travel match here first)
    { keywords: ['delta air', 'indigo', 'flight', 'airline', 'airways', 'united air', 'american air', 'southwest', 'jetblue', 'spirit air', 'frontier air', 'chase travel', 'grab', 'njt', 'hotel', 'marriott', 'hilton', 'hyatt', 'airbnb', 'vrbo', 'booking.com', 'expedia', 'kayak', 'hopper', 'hostel', 'resort'], category: 'Travel' },

    // Transportation
    { keywords: ['uber', 'lyft', 'taxi', 'gas station', 'shell', 'chevron', 'exxon', 'mobil', 'bp ', 'sunoco', 'marathon', 'speedway', 'wawa', 'parking', 'toll', 'ez pass', 'ezpass', 'metro', 'transit', 'mta', 'bart', 'caltrain', 'amtrak', 'greyhound', 'car wash', 'jiffy lube', 'autozone', 'advance auto', 'o\'reilly', 'tire', 'mechanic', 'car repair', 'dmv', 'registration', 'path', 'faridabad'], category: 'Transportation' },

    // Subscriptions
    { keywords: ['netflix', 'spotify', 'hulu', 'disney+', 'disney plus', 'hbo', 'max', 'apple music', 'apple tv', 'apple one', 'youtube premium', 'youtube tv', 'amazon prime', 'audible', 'kindle', 'adobe', 'microsoft 365', 'office 365', 'google storage', 'google one', 'icloud', 'dropbox', 'notion', 'slack', 'zoom', 'linkedin premium', 'gym', 'planet fitness', 'la fitness', 'equinox', 'peloton', 'crossfit', 'headspace', 'calm', 'nytimes', 'new york times', 'wall street journal', 'wsj', 'washington post', 'substack', 'patreon', 'twitch', 'crunchyroll', 'paramount', 'peacock', 'espn', 'sling', 'fubo', 'sirius', 'pandora', 'tidal', 'deezer', 'membership', 'subscription', 'recurring', 'monthly fee', 'annual fee'], category: 'Subscriptions' },

    // Shopping
    { keywords: ['amazon', 'ebay', 'etsy', 'wish', 'shein', 'zara', 'h&m', 'uniqlo', 'nike', 'adidas', 'footlocker', 'nordstrom', 'macy', 'jcpenney', 'kohl', 'tj maxx', 'marshalls', 'ross', 'burlington', 'gap', 'old navy', 'banana republic', 'forever 21', 'urban outfitters', 'anthropologie', 'best buy', 'apple store', 'gamestop', 'ikea', 'wayfair', 'pottery barn', 'crate & barrel', 'bed bath', 'williams sonoma', 'staples', 'office depot', 'michaels', 'hobby lobby', 'joann', 'sephora', 'ulta', 'bath & body', 'victoria', 'lululemon', 'rei', 'dick\'s sporting', 'academy sports', 'pet smart', 'petco', 'chewy', 'temu', 'aliexpress', 'pickle', 'aritzia'], category: 'Shopping' },

    // Healthcare
    { keywords: ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'doctor', 'hospital', 'clinic', 'medical', 'dental', 'dentist', 'optom', 'vision', 'eye care', 'urgent care', 'labcorp', 'quest diag', 'insurance premium', 'health insurance', 'copay', 'prescription', 'therapy', 'therapist', 'psycholog', 'psychiatr', 'dermatolog', 'pediatr', 'obgyn', 'orthoped', 'chiropract', 'physical therapy', 'kaiser', 'united health', 'aetna', 'cigna', 'blue cross', 'anthem', 'humana'], category: 'Healthcare' },

    // Entertainment
    { keywords: ['movie', 'cinema', 'amc', 'regal', 'theater', 'theatre', 'concert', 'ticketmaster', 'stubhub', 'seatgeek', 'live nation', 'event', 'museum', 'zoo', 'aquarium', 'amusement', 'theme park', 'disneyland', 'disney world', 'universal', 'six flags', 'bowling', 'arcade', 'golf', 'ski', 'spa', 'massage', 'game', 'steam', 'playstation', 'xbox', 'nintendo', 'book', 'barnes', 'hobby'], category: 'Entertainment' },

    // Income
    { keywords: ['payroll', 'direct dep', 'direct deposit', 'salary', 'wage', 'ach credit', 'employer', 'paycheck', 'tax refund', 'irs treas', 'interest paid', 'dividend', 'bonus', 'commission', 'freelance', 'venmo from', 'zelle from', 'cashapp from', 'grosvenor', 'gcm'], category: 'Income' },

    // Investments (must be BEFORE Transfers so "fidelity transfer" matches here first)
    { keywords: ['fidelity', 'schwab', 'vanguard', 'robinhood', 'e*trade', 'etrade', 'td ameritrade', 'merrill', 'morgan stanley', 'wealthfront', 'betterment', 'acorns', 'stash', 'coinbase', 'binance', 'kraken', 'gemini', 'crypto', 'bitcoin', 'ethereum', 'stock', 'mutual fund', '401k', 'ira', 'roth', 'brokerage', 'investment', 'dividend reinv'], category: 'Investments' },

    // Transfers
    { keywords: ['transfer', 'xfer', 'ach', 'wire', 'zelle', 'venmo', 'cashapp', 'cash app', 'paypal', 'internal', 'savings transfer', 'checking transfer', 'payment thank', 'autopay', 'online payment', 'bill pay'], category: 'Transfers' },
  ],

  // Categorize a single transaction
  categorize(description, amount, type) {
    const lower = description.toLowerCase();

    // Special rule: $1,000 transfers to another bank = rent (~3 per month)
    if ((type === 'transfer' || type === 'expense') && Math.abs(amount) === 1000 && !lower.includes('invest') && !lower.includes('saving')) {
      return 'Housing';
    }

    for (const rule of this.rules) {
      for (const keyword of rule.keywords) {
        if (lower.includes(keyword)) {
          return rule.category;
        }
      }
    }
    return 'Other';
  },

  // Categorize an array of transactions (modifies in place)
  async categorizeAll(transactions) {
    // Load user-defined rules first (they take priority)
    const userRules = await DB.getCategoryRules();
    const userRuleMap = {};
    for (const r of userRules) {
      userRuleMap[r.pattern] = r.category;
    }

    for (const txn of transactions) {
      // Skip if already categorized by user
      if (txn._userCategorized) continue;

      const upper = txn.description.toUpperCase();

      // Check user rules first
      let matched = false;
      for (const [pattern, category] of Object.entries(userRuleMap)) {
        if (upper.includes(pattern)) {
          txn.category = category;
          matched = true;
          break;
        }
      }

      // Fall back to built-in rules
      if (!matched) {
        txn.category = this.categorize(txn.description, txn.amount, txn.type);
      }
    }

    return transactions;
  },

  // Learn from a user override: save the merchant name as a rule
  async learnFromOverride(description, newCategory) {
    // Extract a meaningful pattern (first 2-3 words, uppercased)
    const words = description.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/);
    const pattern = words.slice(0, 3).join(' ');
    if (pattern.length >= 3) {
      await DB.saveCategoryRule(pattern, newCategory);
    }
  }
};
