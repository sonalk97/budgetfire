// CSV parser with bank format auto-detection

const Parser = {
  // Bank format profiles — each defines how to map CSV columns to transaction fields
  formats: [
    {
      name: 'Chase Credit',
      match: headers => headers.includes('Transaction Date') && headers.includes('Post Date') && headers.includes('Type'),
      parse: row => ({
        date: row['Transaction Date'],
        description: row['Description'],
        amount: Math.abs(Utils.parseAmount(row['Amount'])),
        type: Utils.parseAmount(row['Amount']) > 0 ? 'income' : 'expense',
        category: row['Category'] || 'Other'
      })
    },
    {
      name: 'Chase Checking',
      match: headers => headers.includes('Details') && headers.includes('Posting Date') && headers.includes('Balance'),
      parse: row => ({
        date: row['Posting Date'],
        description: row['Description'],
        amount: Math.abs(Utils.parseAmount(row['Amount'])),
        type: Utils.parseAmount(row['Amount']) > 0 ? 'income' : 'expense',
        category: 'Other'
      })
    },
    {
      name: 'Bank of America',
      match: headers => headers.includes('Date') && headers.includes('Description') && headers.includes('Amount') && headers.includes('Running Bal.'),
      parse: row => ({
        date: row['Date'],
        description: row['Description'],
        amount: Math.abs(Utils.parseAmount(row['Amount'])),
        type: Utils.parseAmount(row['Amount']) > 0 ? 'income' : 'expense',
        category: 'Other'
      })
    },
    {
      name: 'Wells Fargo',
      match: headers => headers.length >= 5 && !headers[0] && !headers[2] && !headers[3],
      matchRaw: (firstRow) => firstRow.length === 5 && /^\d{2}\/\d{2}\/\d{4}$/.test(firstRow[0]),
      noHeader: true,
      parse: (row, rawRow) => ({
        date: rawRow[0],
        description: rawRow[4],
        amount: Math.abs(Utils.parseAmount(rawRow[1])),
        type: Utils.parseAmount(rawRow[1]) > 0 ? 'income' : 'expense',
        category: 'Other'
      })
    },
    {
      name: 'Capital One',
      match: headers => headers.includes('Transaction Date') && headers.includes('Posted Date') && headers.includes('Debit') && headers.includes('Credit'),
      parse: row => {
        const debit = Utils.parseAmount(row['Debit']);
        const credit = Utils.parseAmount(row['Credit']);
        return {
          date: row['Transaction Date'],
          description: row['Description'],
          amount: debit || credit,
          type: credit > 0 ? 'income' : 'expense',
          category: row['Category'] || 'Other'
        };
      }
    },
    {
      name: 'Citi',
      match: headers => headers.includes('Status') && headers.includes('Date') && headers.includes('Debit') && headers.includes('Credit'),
      parse: row => {
        const debit = Utils.parseAmount(row['Debit']);
        const credit = Utils.parseAmount(row['Credit']);
        return {
          date: row['Date'],
          description: row['Description'],
          amount: debit || credit,
          type: credit > 0 ? 'income' : 'expense',
          category: 'Other'
        };
      }
    },
    {
      name: 'Coinbase',
      match: headers => headers.includes('Timestamp') && headers.includes('Transaction Type') && headers.includes('Asset'),
      parse: row => ({
        date: row['Timestamp'].split('T')[0],
        description: `${row['Transaction Type']} ${row['Quantity Transacted']} ${row['Asset']}`,
        amount: Math.abs(Utils.parseAmount(row['Total'] || row['Subtotal'])),
        type: ['Receive', 'Buy'].includes(row['Transaction Type']) ? 'expense' : 'income',
        category: 'Investments'
      })
    },
    {
      name: 'Fidelity',
      match: headers => headers.includes('Run Date') && headers.includes('Action') && headers.includes('Symbol') && headers.includes('Settlement Date'),
      parse: row => ({
        date: row['Run Date'],
        description: `${row['Action']} ${row['Symbol'] || ''} — ${row['Description']}`.trim(),
        amount: Math.abs(Utils.parseAmount(row['Amount'])),
        type: Utils.parseAmount(row['Amount']) > 0 ? 'income' : 'expense',
        category: 'Investments'
      })
    },
    {
      name: 'Schwab',
      match: headers => headers.includes('Date') && headers.includes('Action') && headers.includes('Symbol') && headers.includes('Fees & Comm'),
      parse: row => ({
        date: row['Date'],
        description: `${row['Action']} ${row['Symbol'] || ''} — ${row['Description']}`.trim(),
        amount: Math.abs(Utils.parseAmount(row['Amount'])),
        type: Utils.parseAmount(row['Amount']) > 0 ? 'income' : 'expense',
        category: 'Investments'
      })
    },
    {
      name: 'Vanguard',
      match: headers => headers.includes('Trade Date') && headers.includes('Settlement Date') && headers.includes('Investment Name'),
      parse: row => ({
        date: row['Trade Date'],
        description: `${row['Transaction Type']} ${row['Symbol'] || ''} — ${row['Investment Name']}`.trim(),
        amount: Math.abs(Utils.parseAmount(row['Net Amount'] || row['Principal Amount'])),
        type: Utils.parseAmount(row['Net Amount'] || row['Principal Amount']) > 0 ? 'income' : 'expense',
        category: 'Investments'
      })
    }
  ],

  // Detect format from parsed CSV headers
  detectFormat(headers, firstDataRow) {
    const cleaned = headers.map(h => h.trim());
    for (const fmt of this.formats) {
      if (fmt.matchRaw && firstDataRow) {
        if (fmt.matchRaw(firstDataRow)) return fmt;
      }
      if (fmt.match(cleaned)) return fmt;
    }
    return null;
  },

  // Parse a CSV file and return normalized transactions
  parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            return reject(new Error('CSV file is empty or could not be parsed.'));
          }

          const headers = results.meta.fields || [];
          const format = this.detectFormat(headers, results.data[0] ? Object.values(results.data[0]) : null);

          resolve({
            format,
            headers,
            rawData: results.data,
            rowCount: results.data.length
          });
        },
        error: (err) => reject(err)
      });
    });
  },

  // Parse without headers (for Wells Fargo style)
  parseCSVRaw(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (err) => reject(err)
      });
    });
  },

  // Normalize parsed data into transaction objects
  normalizeTransactions(parsedResult, accountId) {
    const { format, rawData } = parsedResult;
    if (!format) return [];

    const transactions = [];
    for (const row of rawData) {
      try {
        const txn = format.parse(row, Object.values(row));
        if (!txn.date || !txn.description) continue;

        // Normalize date to YYYY-MM-DD
        txn.date = this.normalizeDate(txn.date);
        if (!txn.date) continue;

        txn.accountId = accountId;
        txn.description = txn.description.trim();
        if (!txn.amount || txn.amount === 0) continue;

        transactions.push(txn);
      } catch (e) {
        // Skip malformed rows
      }
    }
    return transactions;
  },

  // Try multiple date formats
  normalizeDate(str) {
    if (!str) return null;
    str = str.trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

    // MM/DD/YYYY or M/D/YYYY
    let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;

    // MM-DD-YYYY
    m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;

    // Try native parsing as fallback
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);

    return null;
  },

  // Generate a hash for duplicate detection
  txnHash(txn) {
    return `${txn.date}|${txn.description}|${txn.amount}`.toLowerCase();
  }
};
