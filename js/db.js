// IndexedDB wrapper for all app data

const DB = {
  _db: null,
  DB_NAME: 'BudgetApp',
  DB_VERSION: 1,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Accounts: checking, savings, credit, investment, crypto
        if (!db.objectStoreNames.contains('accounts')) {
          const accounts = db.createObjectStore('accounts', { keyPath: 'id' });
          accounts.createIndex('type', 'type');
        }

        // Transactions
        if (!db.objectStoreNames.contains('transactions')) {
          const txns = db.createObjectStore('transactions', { keyPath: 'id' });
          txns.createIndex('accountId', 'accountId');
          txns.createIndex('date', 'date');
          txns.createIndex('category', 'category');
          txns.createIndex('monthKey', 'monthKey');
        }

        // Budgets (per category per month)
        if (!db.objectStoreNames.contains('budgets')) {
          const budgets = db.createObjectStore('budgets', { keyPath: 'id' });
          budgets.createIndex('monthKey', 'monthKey');
          budgets.createIndex('category', 'category');
        }

        // FIRE settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Category overrides (for learning from user corrections)
        if (!db.objectStoreNames.contains('categoryRules')) {
          const rules = db.createObjectStore('categoryRules', { keyPath: 'pattern' });
          rules.createIndex('category', 'category');
        }
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };
      req.onerror = () => reject(req.error);
    });
  },

  // Generic CRUD helpers
  async _getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async _get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async _put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async _delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async _getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readonly');
      const idx = tx.objectStore(storeName).index(indexName);
      const req = idx.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // Accounts
  async getAccounts() { return this._getAll('accounts'); },
  async getAccount(id) { return this._get('accounts', id); },
  async saveAccount(account) {
    if (!account.id) account.id = Utils.generateId();
    account.updatedAt = new Date().toISOString();
    if (!account.createdAt) account.createdAt = account.updatedAt;
    return this._put('accounts', account);
  },
  async deleteAccount(id) { return this._delete('accounts', id); },

  // Transactions
  async getTransactions() { return this._getAll('transactions'); },
  async getTransaction(id) { return this._get('transactions', id); },
  async getTransactionsByAccount(accountId) {
    return this._getAllByIndex('transactions', 'accountId', accountId);
  },
  async getTransactionsByMonth(monthKey) {
    return this._getAllByIndex('transactions', 'monthKey', monthKey);
  },
  async saveTransaction(txn) {
    if (!txn.id) txn.id = Utils.generateId();
    txn.monthKey = Utils.getMonthKey(txn.date);
    txn.updatedAt = new Date().toISOString();
    if (!txn.createdAt) txn.createdAt = txn.updatedAt;
    return this._put('transactions', txn);
  },
  async saveTransactions(txns) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      for (const txn of txns) {
        if (!txn.id) txn.id = Utils.generateId();
        txn.monthKey = Utils.getMonthKey(txn.date);
        txn.updatedAt = new Date().toISOString();
        if (!txn.createdAt) txn.createdAt = txn.updatedAt;
        store.put(txn);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteTransaction(id) { return this._delete('transactions', id); },

  // Budgets
  async getBudgets() { return this._getAll('budgets'); },
  async getBudgetsByMonth(monthKey) {
    return this._getAllByIndex('budgets', 'monthKey', monthKey);
  },
  async saveBudget(budget) {
    if (!budget.id) budget.id = `${budget.monthKey}_${budget.category}`;
    return this._put('budgets', budget);
  },
  async deleteBudget(id) { return this._delete('budgets', id); },

  // Settings
  async getSetting(key) {
    const result = await this._get('settings', key);
    return result ? result.value : null;
  },
  async saveSetting(key, value) {
    return this._put('settings', { key, value });
  },

  // Category Rules
  async getCategoryRules() { return this._getAll('categoryRules'); },
  async saveCategoryRule(pattern, category) {
    return this._put('categoryRules', { pattern: pattern.toUpperCase(), category });
  },

  // Aggregate helpers
  async getMonthSummary(monthKey) {
    const txns = await this.getTransactionsByMonth(monthKey);
    let income = 0, expenses = 0;
    const byCategory = {};
    for (const t of txns) {
      if (t.type === 'income') {
        income += Math.abs(t.amount);
      } else if (t.type === 'expense') {
        expenses += Math.abs(t.amount);
        const cat = t.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
      }
    }
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    return { income, expenses, net: income - expenses, savingsRate, transactionCount: txns.length, byCategory };
  },

  async getNetWorth() {
    const accounts = await this.getAccounts();
    let total = 0;
    for (const a of accounts) {
      // Credit card balances are debts — subtract from net worth
      if (a.type === 'credit') {
        total -= Math.abs(a.balance || 0);
      } else {
        total += (a.balance || 0);
      }
    }
    return total;
  },

  // Get all monthly summaries across all time
  async getAllMonthSummaries() {
    const txns = await this.getTransactions();
    const months = {};
    for (const t of txns) {
      const mk = t.monthKey;
      if (!months[mk]) months[mk] = { income: 0, expenses: 0, byCategory: {} };
      if (t.type === 'income') {
        months[mk].income += Math.abs(t.amount);
      } else if (t.type === 'expense') {
        months[mk].expenses += Math.abs(t.amount);
        const cat = t.category || 'Other';
        months[mk].byCategory[cat] = (months[mk].byCategory[cat] || 0) + Math.abs(t.amount);
      }
    }
    // Add derived fields
    for (const [mk, m] of Object.entries(months)) {
      m.monthKey = mk;
      m.net = m.income - m.expenses;
      m.savingsRate = m.income > 0 ? ((m.income - m.expenses) / m.income) * 100 : 0;
    }
    return months;
  }
};
