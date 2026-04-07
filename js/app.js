// Main application controller

const App = {
  currentPage: 'dashboard',

  async init() {
    await DB.init();
    this.bindNav();
    this.bindHamburger();
    this.navigate('dashboard');
  },

  bindNav() {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        this.navigate(page);
        // Close mobile sidebar
        document.querySelector('.sidebar').classList.remove('open');
      });
    });
  },

  bindHamburger() {
    const btn = document.querySelector('.hamburger');
    if (btn) {
      btn.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
      });
    }
  },

  navigate(page) {
    this.currentPage = page;
    // Update nav active state
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });
    // Render page content
    this.renderPage(page);
  },

  async renderPage(page) {
    switch (page) {
      case 'dashboard': await Dashboard.render(); break;
      case 'accounts': await Accounts.render(); break;
      case 'transactions': await Transactions.render(); break;
      case 'budget': await Budget.render(); break;
      case 'fire': await Fire.render(); break;
    }
  }
};

// === Dashboard ===
const Dashboard = {
  async render() {
    const monthKey = Utils.getCurrentMonthKey();
    const summary = await DB.getMonthSummary(monthKey);
    const netWorth = await DB.getNetWorth();
    const accounts = await DB.getAccounts();

    document.getElementById('dash-net-worth').textContent = Utils.formatCurrency(netWorth);
    document.getElementById('dash-income').textContent = Utils.formatCurrency(summary.income);
    document.getElementById('dash-expenses').textContent = Utils.formatCurrency(summary.expenses);
    document.getElementById('dash-savings-rate').textContent = summary.savingsRate.toFixed(1) + '%';

    // Color code
    const nwEl = document.getElementById('dash-net-worth');
    nwEl.className = 'card-value ' + (netWorth >= 0 ? 'positive' : 'negative');

    // Recent transactions
    const txns = await DB.getTransactionsByMonth(monthKey);
    const sorted = txns.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    const tbody = document.getElementById('dash-recent-txns');
    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">No transactions this month. Add accounts and upload statements to get started.</td></tr>';
    } else {
      tbody.innerHTML = sorted.map(t => `
        <tr>
          <td>${Utils.formatDateShort(t.date)}</td>
          <td>${t.description}</td>
          <td><span class="badge">${t.category || 'Uncategorized'}</span></td>
          <td class="${t.type === 'income' ? 'amount-positive' : 'amount-negative'}">
            ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(Math.abs(t.amount))}
          </td>
        </tr>
      `).join('');
    }

    // Account summary
    const acctList = document.getElementById('dash-accounts');
    if (accounts.length === 0) {
      acctList.innerHTML = '<div class="empty-state"><p>No accounts yet</p><button class="btn btn-primary btn-sm" onclick="App.navigate(\'accounts\')">Add Account</button></div>';
    } else {
      acctList.innerHTML = accounts.map(a => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <span class="badge badge-${a.type}">${a.type}</span>
            <span style="margin-left:8px">${a.name}</span>
          </div>
          <span style="font-weight:600">${Utils.formatCurrency(a.balance || 0)}</span>
        </div>
      `).join('');
    }
  }
};

// === Accounts ===
const Accounts = {
  async render() {
    const accounts = await DB.getAccounts();
    const container = document.getElementById('accounts-list');

    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          <p>No accounts added yet.</p>
          <button class="btn btn-primary" onclick="Accounts.openModal()">Add Your First Account</button>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Account</th><th>Type</th><th>Balance</th><th>Updated</th><th></th></tr></thead>
      <tbody>${accounts.map(a => `
        <tr>
          <td><strong>${a.name}</strong>${a.institution ? '<br><span style="color:var(--text-muted);font-size:0.8rem">' + a.institution + '</span>' : ''}</td>
          <td><span class="badge badge-${a.type}">${a.type}</span></td>
          <td style="font-weight:600" class="${a.balance >= 0 ? 'amount-positive' : 'amount-negative'}">${Utils.formatCurrency(a.balance || 0)}</td>
          <td style="color:var(--text-muted);font-size:0.8rem">${Utils.formatDate(a.updatedAt)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="Accounts.openModal('${a.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="Accounts.remove('${a.id}')">Delete</button>
          </td>
        </tr>
      `).join('')}</tbody>
    </table></div>`;
  },

  async openModal(editId) {
    const modal = document.getElementById('modal-account');
    const form = document.getElementById('form-account');
    form.reset();

    if (editId) {
      const acct = await DB.getAccount(editId);
      if (acct) {
        form.elements['account-id'].value = acct.id;
        form.elements['account-name'].value = acct.name;
        form.elements['account-type'].value = acct.type;
        form.elements['account-institution'].value = acct.institution || '';
        form.elements['account-balance'].value = acct.balance || 0;
      }
    } else {
      form.elements['account-id'].value = '';
    }

    modal.classList.add('open');
  },

  closeModal() {
    document.getElementById('modal-account').classList.remove('open');
  },

  async save() {
    const form = document.getElementById('form-account');
    const account = {
      id: form.elements['account-id'].value || undefined,
      name: form.elements['account-name'].value.trim(),
      type: form.elements['account-type'].value,
      institution: form.elements['account-institution'].value.trim(),
      balance: Utils.parseAmount(form.elements['account-balance'].value)
    };

    if (!account.name) return alert('Please enter an account name.');
    await DB.saveAccount(account);
    this.closeModal();
    this.render();
  },

  async remove(id) {
    if (!confirm('Delete this account and all its transactions?')) return;
    // Delete associated transactions
    const txns = await DB.getTransactionsByAccount(id);
    for (const t of txns) await DB.deleteTransaction(t.id);
    await DB.deleteAccount(id);
    this.render();
  }
};

// === Transactions ===
const Transactions = {
  async render() {
    const accounts = await DB.getAccounts();
    const txns = await DB.getTransactions();
    const sorted = txns.sort((a, b) => new Date(b.date) - new Date(a.date));
    const container = document.getElementById('transactions-list');

    // Update account dropdown in modal
    const sel = document.getElementById('txn-account');
    sel.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    if (sorted.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M2 12h20"/></svg>
          <p>No transactions yet. Add one manually or upload a statement.</p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="btn btn-primary" onclick="Transactions.openModal()">Add Transaction</button>
            <button class="btn btn-secondary" onclick="App.navigate('upload')">Upload Statement</button>
          </div>
        </div>`;
      return;
    }

    const catOptions = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    container.innerHTML = `
      <div style="margin-bottom:16px;display:flex;gap:10px;align-items:center">
        <button class="btn btn-sm btn-secondary" onclick="Transactions.recategorizeAll()">Auto-Categorize All</button>
        <span style="color:var(--text-muted);font-size:0.82rem">${sorted.length} transactions</span>
      </div>
      <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Amount</th><th></th></tr></thead>
      <tbody>${sorted.map(t => {
        const acct = accounts.find(a => a.id === t.accountId);
        const selected = t.category || 'Other';
        return `<tr>
          <td>${Utils.formatDateShort(t.date)}</td>
          <td>${t.description}</td>
          <td>
            <select class="cat-select" onchange="Transactions.updateCategory('${t.id}', this.value, '${t.description.replace(/'/g, "\\'")}')">${
              CATEGORIES.map(c => `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`).join('')
            }</select>
          </td>
          <td style="color:var(--text-muted)">${acct ? acct.name : '—'}</td>
          <td class="${t.type === 'income' ? 'amount-positive' : 'amount-negative'}">
            ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(Math.abs(t.amount))}
          </td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="Transactions.remove('${t.id}')">Del</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  },

  openModal() {
    document.getElementById('modal-transaction').classList.add('open');
    document.getElementById('form-transaction').reset();
    document.getElementById('txn-date').value = new Date().toISOString().split('T')[0];
  },

  closeModal() {
    document.getElementById('modal-transaction').classList.remove('open');
  },

  async save() {
    const form = document.getElementById('form-transaction');
    const txn = {
      date: form.elements['txn-date'].value,
      description: form.elements['txn-description'].value.trim(),
      amount: Utils.parseAmount(form.elements['txn-amount'].value),
      type: form.elements['txn-type'].value,
      category: form.elements['txn-category'].value,
      accountId: form.elements['txn-account'].value
    };

    if (!txn.description || !txn.amount) return alert('Please fill in all fields.');
    await DB.saveTransaction(txn);
    this.closeModal();
    this.render();
  },

  async updateCategory(id, newCategory, description) {
    const txn = await DB.getTransaction(id);
    if (txn) {
      txn.category = newCategory;
      txn._userCategorized = true;
      await DB.saveTransaction(txn);
      // Learn from user override
      await Categorizer.learnFromOverride(description, newCategory);
    }
  },

  async recategorizeAll() {
    if (!confirm('Re-categorize all transactions using auto-detection? Manual overrides you\'ve set will be preserved.')) return;
    const txns = await DB.getTransactions();
    await Categorizer.categorizeAll(txns);
    await DB.saveTransactions(txns);
    this.render();
  },

  async remove(id) {
    if (!confirm('Delete this transaction?')) return;
    await DB.deleteTransaction(id);
    this.render();
  }
};

// === Upload ===
const Upload = {
  parsedTxns: [],
  parsedResult: null,

  async openModal() {
    const accounts = await DB.getAccounts();
    const sel = document.getElementById('upload-account');
    if (accounts.length === 0) {
      alert('Please add an account first before uploading statements.');
      App.navigate('accounts');
      return;
    }
    sel.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (${a.type})</option>`).join('');
    this.reset();
    document.getElementById('modal-upload').classList.add('open');
    this._bindDropZone();
  },

  closeModal() {
    document.getElementById('modal-upload').classList.remove('open');
    this.reset();
  },

  reset() {
    this.parsedTxns = [];
    this.parsedResult = null;
    document.getElementById('upload-step1').style.display = '';
    document.getElementById('upload-step2').style.display = 'none';
    document.getElementById('upload-step-generic').style.display = 'none';
    document.getElementById('upload-file-info').style.display = 'none';
    document.getElementById('upload-import-btn').disabled = true;
    document.getElementById('upload-file').value = '';
    document.getElementById('upload-dupes').style.display = 'none';
  },

  _bindDropZone() {
    const zone = document.getElementById('upload-dropzone');
    const input = document.getElementById('upload-file');

    // Only bind once
    if (zone._bound) return;
    zone._bound = true;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.borderColor = '';
      if (e.dataTransfer.files.length) this._handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => {
      if (input.files.length) this._handleFile(input.files[0]);
    });
  },

  async _handleFile(file) {
    const isCSV = file.name.toLowerCase().endsWith('.csv') ||
                  file.type === 'text/csv' ||
                  file.type === 'application/vnd.ms-excel';
    if (!isCSV) {
      alert('Please upload a CSV file.');
      return;
    }

    document.getElementById('upload-filename').textContent = file.name;
    document.getElementById('upload-file-info').style.display = '';

    try {
      const result = await Parser.parseCSV(file);
      this.parsedResult = result;

      if (result.format) {
        document.getElementById('upload-format').textContent = 'Detected: ' + result.format.name;
        const accountId = document.getElementById('upload-account').value;
        this.parsedTxns = Parser.normalizeTransactions(result, accountId);
        this._showPreview();
      } else {
        // Show generic column mapper
        document.getElementById('upload-format').textContent = 'Unknown format';
        this._showGenericMapper(result.headers);
      }
    } catch (err) {
      alert('Error parsing CSV: ' + err.message);
    }
  },

  _showPreview() {
    document.getElementById('upload-step1').querySelector('.drop-zone').style.display = 'none';
    document.getElementById('upload-step2').style.display = '';
    document.getElementById('upload-step-generic').style.display = 'none';

    const tbody = document.getElementById('upload-preview');
    const preview = this.parsedTxns.slice(0, 15);

    document.getElementById('upload-summary').textContent =
      `${this.parsedTxns.length} transactions parsed` +
      (this.parsedTxns.length > 15 ? ` (showing first 15)` : '');

    tbody.innerHTML = preview.map(t => `
      <tr>
        <td>${Utils.formatDateShort(t.date)}</td>
        <td>${t.description}</td>
        <td class="${t.type === 'income' ? 'amount-positive' : 'amount-negative'}">
          ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount)}
        </td>
        <td>${t.type}</td>
        <td>${t.category || 'Other'}</td>
      </tr>
    `).join('');

    document.getElementById('upload-import-btn').disabled = false;
    document.getElementById('upload-import-btn').textContent = `Import ${this.parsedTxns.length} Transactions`;

    // Check for duplicates
    this._checkDuplicates();
  },

  async _checkDuplicates() {
    const existing = await DB.getTransactions();
    const existingHashes = new Set(existing.map(t => Parser.txnHash(t)));
    const dupeCount = this.parsedTxns.filter(t => existingHashes.has(Parser.txnHash(t))).length;

    if (dupeCount > 0) {
      const el = document.getElementById('upload-dupes');
      el.style.display = '';
      el.textContent = `${dupeCount} potential duplicate(s) detected — these will be skipped on import.`;
      // Filter out dupes
      this.parsedTxns = this.parsedTxns.filter(t => !existingHashes.has(Parser.txnHash(t)));
      const remaining = this.parsedTxns.length;
      document.getElementById('upload-import-btn').textContent = `Import ${remaining} Transactions`;
      if (remaining === 0) document.getElementById('upload-import-btn').disabled = true;
    }
  },

  _showGenericMapper(headers) {
    document.getElementById('upload-step1').querySelector('.drop-zone').style.display = 'none';
    document.getElementById('upload-step-generic').style.display = '';
    document.getElementById('upload-step2').style.display = 'none';

    const opts = headers.map(h => `<option value="${h}">${h}</option>`).join('');
    const optsWithNone = `<option value="">— none —</option>` + opts;

    document.getElementById('map-date').innerHTML = opts;
    document.getElementById('map-description').innerHTML = opts;
    document.getElementById('map-amount').innerHTML = opts;
    document.getElementById('map-debit').innerHTML = optsWithNone;
    document.getElementById('map-credit').innerHTML = optsWithNone;

    // Auto-select likely columns
    for (const h of headers) {
      const lc = h.toLowerCase();
      if (lc.includes('date')) document.getElementById('map-date').value = h;
      if (lc.includes('desc') || lc.includes('memo') || lc.includes('narr')) document.getElementById('map-description').value = h;
      if (lc === 'amount') document.getElementById('map-amount').value = h;
      if (lc.includes('debit')) document.getElementById('map-debit').value = h;
      if (lc.includes('credit')) document.getElementById('map-credit').value = h;
    }
  },

  applyGenericMapping() {
    const dateCol = document.getElementById('map-date').value;
    const descCol = document.getElementById('map-description').value;
    const amountCol = document.getElementById('map-amount').value;
    const debitCol = document.getElementById('map-debit').value;
    const creditCol = document.getElementById('map-credit').value;
    const accountId = document.getElementById('upload-account').value;

    if (!dateCol || !descCol || (!amountCol && !debitCol)) {
      alert('Please map at least Date, Description, and Amount (or Debit) columns.');
      return;
    }

    this.parsedTxns = [];
    for (const row of this.parsedResult.rawData) {
      let amount, type;
      if (debitCol && creditCol) {
        const debit = Utils.parseAmount(row[debitCol]);
        const credit = Utils.parseAmount(row[creditCol]);
        amount = debit || credit;
        type = credit > 0 ? 'income' : 'expense';
      } else {
        amount = Utils.parseAmount(row[amountCol]);
        type = amount > 0 ? 'income' : 'expense';
        amount = Math.abs(amount);
      }

      const date = Parser.normalizeDate(row[dateCol]);
      const description = (row[descCol] || '').trim();
      if (!date || !description || !amount) continue;

      this.parsedTxns.push({ date, description, amount, type, category: 'Other', accountId });
    }

    this._showPreview();
  },

  async importTransactions() {
    if (this.parsedTxns.length === 0) return;

    const btn = document.getElementById('upload-import-btn');
    btn.disabled = true;
    btn.textContent = 'Categorizing & importing...';

    // Auto-categorize all transactions before saving
    await Categorizer.categorizeAll(this.parsedTxns);
    await DB.saveTransactions(this.parsedTxns);

    this.closeModal();
    await Transactions.render();
  }
};

// === Budget / Category Spend Tracker ===
const Budget = {
  CHART_COLORS: ['#6366f1','#22c55e','#ef4444','#eab308','#3b82f6','#a855f7','#f97316','#14b8a6','#ec4899','#84cc16','#06b6d4','#f43f5e','#8b5cf6'],

  async render() {
    const container = document.getElementById('page-budget').querySelector('.page-content');
    const allMonths = await DB.getAllMonthSummaries();
    const monthKeys = Object.keys(allMonths).sort();

    if (monthKeys.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No transaction data yet. Upload statements to see spending breakdowns.</p></div>';
      return;
    }

    // Aggregate totals across all time
    const aggByCategory = {};
    let aggTotal = 0;
    for (const mk of monthKeys) {
      const m = allMonths[mk];
      for (const [cat, amt] of Object.entries(m.byCategory)) {
        aggByCategory[cat] = (aggByCategory[cat] || 0) + amt;
        aggTotal += amt;
      }
    }

    // Sort categories by total spend
    const sortedCats = Object.entries(aggByCategory).sort((a, b) => b[1] - a[1]);
    const expenseCategories = CATEGORIES.filter(c => c !== 'Income' && c !== 'Transfers' && c !== 'Investments');

    // Build monthly table data
    const currentMK = Utils.getCurrentMonthKey();

    container.innerHTML = `
      <h3 style="margin-bottom:16px;font-size:1rem">Aggregate Spend Breakdown (All Time)</h3>
      <div class="cards-grid" style="margin-bottom:28px">
        ${sortedCats.map(([cat, amt], i) => {
          const pct = aggTotal > 0 ? (amt / aggTotal * 100).toFixed(1) : 0;
          const color = this.CHART_COLORS[i % this.CHART_COLORS.length];
          return `<div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span class="card-label" style="margin:0">${cat}</span>
              <span style="font-size:0.85rem;font-weight:600;color:${color}">${pct}%</span>
            </div>
            <div style="background:var(--bg);border-radius:6px;height:8px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:6px;transition:width .3s"></div>
            </div>
            <div style="font-size:0.85rem;margin-top:6px;color:var(--text-muted)">${Utils.formatCurrency(amt)}</div>
          </div>`;
        }).join('')}
      </div>

      <h3 style="margin-bottom:16px;font-size:1rem">Monthly Breakdown</h3>
      <div class="table-wrap" style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              ${expenseCategories.map(c => `<th style="text-align:right">${c}</th>`).join('')}
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${monthKeys.slice().reverse().map(mk => {
              const m = allMonths[mk];
              const total = m.expenses;
              return `<tr>
                <td style="font-weight:600">${Utils.formatMonth(mk + '-01')}</td>
                ${expenseCategories.map(c => {
                  const amt = m.byCategory[c] || 0;
                  const pct = total > 0 ? (amt / total * 100).toFixed(1) : 0;
                  return `<td style="text-align:right;font-size:0.82rem">
                    ${amt > 0 ? `${Utils.formatCurrency(amt)}<br><span style="color:var(--text-muted)">${pct}%</span>` : '—'}
                  </td>`;
                }).join('')}
                <td style="text-align:right;font-weight:600">${Utils.formatCurrency(total)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <h3 style="margin:28px 0 16px;font-size:1rem">Aggregate % by Category</h3>
      <div class="card" style="padding:24px">
        <canvas id="chart-category-pie" height="300"></canvas>
      </div>
    `;

    // Render pie chart
    this._renderPieChart(sortedCats, aggTotal);
  },

  _renderPieChart(sortedCats, total) {
    const canvas = document.getElementById('chart-category-pie');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this._chart) this._chart.destroy();
    this._chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: sortedCats.map(([c]) => c),
        datasets: [{
          data: sortedCats.map(([, a]) => a),
          backgroundColor: this.CHART_COLORS.slice(0, sortedCats.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: '#e4e4e7', padding: 12, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${Utils.formatCurrency(ctx.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
};

// === FIRE Calculator ===
const Fire = {
  defaults: {
    currentAge: 29,
    fireAge: 40,
    returnRate: 7,
    inflationRate: 3,
    safeWithdrawalRate: 4,
    expenseGrowth: 7.5 // midpoint of 5-10% increase from current spending
  },

  async render() {
    const container = document.getElementById('page-fire').querySelector('.page-content');
    const allMonths = await DB.getAllMonthSummaries();
    const monthKeys = Object.keys(allMonths).sort();
    const netWorth = await DB.getNetWorth();

    // Load saved settings or defaults
    const settings = (await DB.getSetting('fire')) || this.defaults;

    // Derive spending from data
    const { monthlyExpenses, monthlyIncome, bonusIncome, regularIncome } = this._deriveFromData(allMonths, monthKeys);

    // Calculate annualized values
    const annualExpenses = monthlyExpenses * 12;
    const annualExpensesRetirement = annualExpenses * (1 + settings.expenseGrowth / 100);
    const annualRegularIncome = regularIncome * 12; // semi-monthly pay × 2 paychecks × 12
    const annualBonusIncome = bonusIncome; // already annual
    const totalAnnualIncome = annualRegularIncome + annualBonusIncome;
    const annualSavings = totalAnnualIncome - annualExpenses;
    const monthlySavings = annualSavings / 12;

    // FIRE number
    const fireNumber = annualExpensesRetirement / (settings.safeWithdrawalRate / 100);
    const realReturn = (settings.returnRate - settings.inflationRate) / 100;

    // Years to FIRE (using future value of annuity formula)
    let yearsToFire = 0;
    let projected = netWorth;
    while (projected < fireNumber && yearsToFire < 100) {
      projected = projected * (1 + realReturn) + annualSavings;
      yearsToFire++;
    }

    const fireYear = new Date().getFullYear() + yearsToFire;
    const fireDate = new Date(fireYear, new Date().getMonth(), 1);
    const fireAgeCalc = settings.currentAge + yearsToFire;

    // Build projection data for chart
    const projectionYears = Math.max(yearsToFire + 5, 15);
    const projLabels = [];
    const projData = [];
    const fireLine = [];
    let pv = netWorth;
    for (let y = 0; y <= projectionYears; y++) {
      const yr = new Date().getFullYear() + y;
      projLabels.push(yr.toString());
      projData.push(Math.round(pv));
      fireLine.push(Math.round(fireNumber));
      pv = pv * (1 + realReturn) + annualSavings;
    }

    // Historical net worth (approximate from monthly data)
    const histLabels = [];
    const histData = [];
    let runningNW = netWorth;
    // Walk backwards from current month to estimate past net worth
    for (let i = monthKeys.length - 1; i >= 0; i--) {
      const mk = monthKeys[i];
      const m = allMonths[mk];
      histLabels.unshift(mk);
      histData.unshift(Math.round(runningNW));
      runningNW -= m.net; // subtract that month's net to estimate previous month
    }

    container.innerHTML = `
      <div class="cards-grid">
        <div class="card">
          <div class="card-label">FIRE Number</div>
          <div class="card-value" style="color:var(--accent)">${Utils.formatCurrency(fireNumber)}</div>
          <div class="card-sub">${annualExpensesRetirement > annualExpenses ? 'Based on projected retirement expenses (+' + settings.expenseGrowth + '%)' : 'Based on current annual expenses'}</div>
        </div>
        <div class="card">
          <div class="card-label">Current Net Worth</div>
          <div class="card-value ${netWorth >= 0 ? 'positive' : 'negative'}">${Utils.formatCurrency(netWorth)}</div>
          <div class="card-sub">${((netWorth / fireNumber) * 100).toFixed(1)}% of FIRE goal</div>
        </div>
        <div class="card">
          <div class="card-label">Years to FIRE</div>
          <div class="card-value" style="color:var(--yellow)">${yearsToFire}</div>
          <div class="card-sub">Target: ${fireYear} (age ${fireAgeCalc})</div>
        </div>
        <div class="card">
          <div class="card-label">Monthly Savings</div>
          <div class="card-value positive">${Utils.formatCurrency(monthlySavings)}</div>
          <div class="card-sub">Savings rate: ${totalAnnualIncome > 0 ? (annualSavings / totalAnnualIncome * 100).toFixed(1) : 0}%</div>
        </div>
      </div>

      <div class="cards-grid" style="grid-template-columns: 1fr 1fr 1fr">
        <div class="card">
          <div class="card-label">Annual Expenses (Current)</div>
          <div class="card-value" style="font-size:1.2rem;color:var(--red)">${Utils.formatCurrency(annualExpenses)}</div>
          <div class="card-sub">Derived from ${monthKeys.length} months of data</div>
        </div>
        <div class="card">
          <div class="card-label">Annual Regular Income</div>
          <div class="card-value" style="font-size:1.2rem;color:var(--green)">${Utils.formatCurrency(annualRegularIncome)}</div>
          <div class="card-sub">Semi-monthly pay (2x/month)</div>
        </div>
        <div class="card">
          <div class="card-label">Annual Bonus (Annualized)</div>
          <div class="card-value" style="font-size:1.2rem;color:var(--green)">${Utils.formatCurrency(annualBonusIncome)}</div>
          <div class="card-sub">From March 2026 bonus, annualized</div>
        </div>
      </div>

      <div class="card" style="margin-top:20px;padding:24px">
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:16px">Net Worth: Historical & Projected to FIRE</h3>
        <canvas id="chart-fire" height="120"></canvas>
      </div>

      <div class="card" style="margin-top:20px;padding:20px">
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:16px">FIRE Settings</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
          <div class="form-group">
            <label>Current Age</label>
            <input type="number" id="fire-age" value="${settings.currentAge}" onchange="Fire.saveSettings()">
          </div>
          <div class="form-group">
            <label>Target FIRE Age</label>
            <input type="number" id="fire-target-age" value="${settings.fireAge}" onchange="Fire.saveSettings()">
          </div>
          <div class="form-group">
            <label>Expected Return (%)</label>
            <input type="number" id="fire-return" value="${settings.returnRate}" step="0.5" onchange="Fire.saveSettings()">
          </div>
          <div class="form-group">
            <label>Inflation Rate (%)</label>
            <input type="number" id="fire-inflation" value="${settings.inflationRate}" step="0.5" onchange="Fire.saveSettings()">
          </div>
          <div class="form-group">
            <label>Safe Withdrawal Rate (%)</label>
            <input type="number" id="fire-swr" value="${settings.safeWithdrawalRate}" step="0.25" onchange="Fire.saveSettings()">
          </div>
          <div class="form-group">
            <label>Expense Growth for Retirement (%)</label>
            <input type="number" id="fire-expense-growth" value="${settings.expenseGrowth}" step="0.5" onchange="Fire.saveSettings()">
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:20px;padding:20px;background:var(--surface)">
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:8px">FIRE Countdown</h3>
        <div id="fire-countdown" style="font-size:2rem;font-weight:700;color:var(--accent);text-align:center;padding:16px"></div>
      </div>
    `;

    this._renderChart(histLabels, histData, projLabels, projData, fireLine);
    this._startCountdown(fireDate);
  },

  _deriveFromData(allMonths, monthKeys) {
    if (monthKeys.length === 0) {
      return { monthlyExpenses: 4000, monthlyIncome: 6000, bonusIncome: 0, regularIncome: 6000 };
    }

    // Calculate average monthly expenses (excluding transfers/investments)
    let totalExpenses = 0;
    let expenseMonths = 0;

    // Separate regular income from bonus income
    // March 2026 has a bonus — identify it as an outlier
    let totalRegularIncome = 0;
    let regularIncomeMonths = 0;
    let bonusAmount = 0;

    for (const mk of monthKeys) {
      const m = allMonths[mk];
      totalExpenses += m.expenses;
      expenseMonths++;

      if (mk === '2026-03') {
        // March 2026 has bonus — find the median income of other months to isolate it
        // We'll handle this after the loop
      }
    }

    // Calculate median income for non-March months to find regular pay
    const nonBonusIncomes = [];
    for (const mk of monthKeys) {
      if (mk === '2026-03') continue;
      const m = allMonths[mk];
      if (m.income > 0) nonBonusIncomes.push(m.income);
    }
    nonBonusIncomes.sort((a, b) => a - b);
    const medianIncome = nonBonusIncomes.length > 0
      ? nonBonusIncomes[Math.floor(nonBonusIncomes.length / 2)]
      : 0;

    // Regular monthly income = median (represents 2 semi-monthly paychecks)
    const regularMonthly = medianIncome;

    // March 2026 bonus = March income minus regular monthly income
    const marchIncome = allMonths['2026-03'] ? allMonths['2026-03'].income : 0;
    bonusAmount = Math.max(0, marchIncome - regularMonthly);

    const monthlyExpenses = expenseMonths > 0 ? totalExpenses / expenseMonths : 0;

    return {
      monthlyExpenses,
      monthlyIncome: regularMonthly,
      bonusIncome: bonusAmount, // This IS the annual bonus (one-time in March)
      regularIncome: regularMonthly
    };
  },

  _renderChart(histLabels, histData, projLabels, projData, fireLine) {
    const canvas = document.getElementById('chart-fire');
    if (!canvas || typeof Chart === 'undefined') return;

    // Combine historical + projected
    const allLabels = [...histLabels, ...projLabels];
    const historicalLine = [...histData, ...new Array(projLabels.length).fill(null)];
    const projectedLine = [...new Array(histLabels.length).fill(null), ...projData];
    // Overlap at the junction
    if (histData.length > 0 && projData.length > 0) {
      projectedLine[histLabels.length - 1] = histData[histData.length - 1];
    }
    const fireTarget = [...fireLine.slice(0, histLabels.length).map(() => fireLine[0]), ...fireLine];

    if (this._chart) this._chart.destroy();
    this._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Historical Net Worth',
            data: historicalLine,
            borderColor: '#6366f1',
            backgroundColor: '#6366f120',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 2
          },
          {
            label: 'Projected Net Worth',
            data: projectedLine,
            borderColor: '#22c55e',
            backgroundColor: '#22c55e10',
            borderDash: [6, 3],
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
          },
          {
            label: 'FIRE Target',
            data: fireTarget.slice(0, allLabels.length),
            borderColor: '#ef4444',
            borderDash: [10, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { color: '#8b8fa3', maxTicksLimit: 15 }, grid: { color: '#2a2e3d' } },
          y: {
            ticks: { color: '#8b8fa3', callback: v => Utils.formatCurrency(v) },
            grid: { color: '#2a2e3d' }
          }
        },
        plugins: {
          legend: { labels: { color: '#e4e4e7', padding: 16 } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${Utils.formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  },

  _countdownInterval: null,
  _startCountdown(fireDate) {
    if (this._countdownInterval) clearInterval(this._countdownInterval);
    const el = document.getElementById('fire-countdown');
    const update = () => {
      const now = new Date();
      const diff = fireDate - now;
      if (diff <= 0) { el.textContent = 'You\'ve reached FIRE!'; return; }
      const days = Math.floor(diff / 86400000);
      const years = Math.floor(days / 365);
      const remDays = days % 365;
      const months = Math.floor(remDays / 30);
      const d = remDays % 30;
      el.textContent = `${years}y ${months}m ${d}d to Financial Independence`;
    };
    update();
    this._countdownInterval = setInterval(update, 60000);
  },

  async saveSettings() {
    const settings = {
      currentAge: parseInt(document.getElementById('fire-age').value) || 29,
      fireAge: parseInt(document.getElementById('fire-target-age').value) || 40,
      returnRate: parseFloat(document.getElementById('fire-return').value) || 7,
      inflationRate: parseFloat(document.getElementById('fire-inflation').value) || 3,
      safeWithdrawalRate: parseFloat(document.getElementById('fire-swr').value) || 4,
      expenseGrowth: parseFloat(document.getElementById('fire-expense-growth').value) || 7.5
    };
    await DB.saveSetting('fire', settings);
    this.render();
  }
};

// === Categories list ===
const CATEGORIES = [
  'Housing', 'Utilities', 'Groceries', 'Dining', 'Transportation',
  'Subscriptions', 'Shopping', 'Healthcare', 'Entertainment',
  'Income', 'Transfers', 'Investments', 'Other'
];

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());
