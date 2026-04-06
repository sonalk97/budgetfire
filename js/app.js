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

    container.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Amount</th><th></th></tr></thead>
      <tbody>${sorted.map(t => {
        const acct = accounts.find(a => a.id === t.accountId);
        return `<tr>
          <td>${Utils.formatDateShort(t.date)}</td>
          <td>${t.description}</td>
          <td><span class="badge">${t.category || 'Uncategorized'}</span></td>
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

  async remove(id) {
    if (!confirm('Delete this transaction?')) return;
    await DB.deleteTransaction(id);
    this.render();
  }
};

// === Budget (placeholder for Phase 4) ===
const Budget = {
  async render() {
    document.getElementById('page-budget').querySelector('.page-content').innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 6v6l4 2"/></svg>
        <p>Budget tracking coming soon. Add transactions first to see spending insights.</p>
      </div>`;
  }
};

// === FIRE Calculator (placeholder for Phase 6) ===
const Fire = {
  async render() {
    document.getElementById('page-fire').querySelector('.page-content').innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
        <p>FIRE Calculator coming in a later phase. We'll build this after budgeting is in place.</p>
      </div>`;
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
