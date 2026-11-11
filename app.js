const membersEl = document.getElementById('members');
const countEl = document.getElementById('memberCount');
const hintEl = document.getElementById('memberHint');

function memberInputs() {
  return [...membersEl.querySelectorAll('input')].map(x => x.value.trim()).filter(Boolean);
}
function updateMembers() {
  const n = memberInputs().length;
  countEl.textContent = n;
  hintEl.textContent = `${n} ${n === 1 ? 'person' : 'people'}`;
  membersEl.querySelectorAll('.member-row').forEach(row => {
    const input = row.querySelector('input');
    row.querySelector('.person-dot').textContent = (input.value.trim()[0] || '?').toUpperCase();
  });
}
membersEl.addEventListener('input', updateMembers);
membersEl.addEventListener('click', e => {
  if (e.target.classList.contains('remove')) {
    if (membersEl.querySelectorAll('.member-row').length > 1) e.target.closest('.member-row').remove();
    updateMembers();
  }
});
document.getElementById('addMember').addEventListener('click', () => {
  if (membersEl.querySelectorAll('.member-row').length >= 20) return alert('Maximum 20 members in this prototype.');
  const row = document.createElement('div');
  row.className = 'member-row';
  row.innerHTML = '<span class="person-dot">?</span><input aria-label="Member name" placeholder="Name"><button class="remove" title="Remove member">×</button>';
  membersEl.appendChild(row);
  row.querySelector('input').focus();
  updateMembers();
});
document.getElementById('calculate').addEventListener('click', async () => {
  const total = Number(document.getElementById('total').value);
  const members = memberInputs();
  const category = document.getElementById('category').value;
  if (!Number.isFinite(total) || total <= 0) return alert('Enter an amount greater than zero.');
  if (!members.length) return alert('Add at least one member name.');
  try {
    console.log("Selected category:", category);
    const response = await fetch('/api/split', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({total, members, category})
    });
    if (!response.ok) throw new Error('API request failed');
    const splitData = await response.json();
    document.getElementById('resultTotal').textContent = `₹${splitData.total.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('resultSubtitle').textContent =
      `${document.getElementById('expenseName').value || 'Shared expense'} · ${category} · ${splitData.count} people`;
    document.getElementById('results').innerHTML = splitData.shares.map(s =>
      `<div class="result-row"><span><i class="mini-avatar">${escapeHtml(s.name[0].toUpperCase())}</i>${escapeHtml(s.name)}</span><b>₹${s.amount.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>`
    ).join('');
    // Save expense to history
const historyResponse = await fetch('/api/history', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: document.getElementById('expenseName').value || 'Shared Expense',
    total: splitData.total,
    category: category,
    members: members
  })
});

if (historyResponse.ok) {
  await loadExpenseHistory();
} else {
  console.error('Could not save expense history.');
}
  } catch (err) {
    alert('Could not reach the backend. Check that the FastAPI server is running.');
  }
});
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
document.getElementById('billFile').addEventListener('change', event => {
  const file = event.target.files[0];
  const area = document.getElementById('previewArea');
  if (!file) return;
  if (!file.type.startsWith('image/')) { area.textContent = 'Please select an image file.'; return; }
  const url = URL.createObjectURL(file);
  area.innerHTML = '';
  const img = document.createElement('img');
  img.src = url; img.alt = 'Selected bill preview';
  area.appendChild(img);
});
updateMembers();

// SplitMate Expense Insights
const insightsBtn = document.createElement('button');
insightsBtn.textContent = '✨ Generate Expense Insights';
insightsBtn.type = 'button';
insightsBtn.style.cssText =
  'margin:15px 0;padding:12px 20px;border:0;border-radius:10px;background:#7657e8;color:white;cursor:pointer;font-weight:bold;';

const insightsOutput = document.createElement('div');
insightsOutput.style.cssText =
  'margin:10px 0;padding:15px;border-radius:10px;background:#20243a;color:white;';

const calculateBtn = document.getElementById('calculate');
calculateBtn.insertAdjacentElement('afterend', insightsBtn);
insightsBtn.insertAdjacentElement('afterend', insightsOutput);

insightsBtn.addEventListener('click', async () => {
  const total = Number(document.getElementById('total').value);
  const members = memberInputs();
  const category = document.getElementById('category').value;


  if (!Number.isFinite(total) || total <= 0) {
    alert('Please enter a valid expense amount.');
    return;
  }

  if (!members.length) {
    alert('Please add at least one member.');
    return;
  }

  insightsBtn.disabled = true;
  insightsBtn.textContent = 'Analyzing...';

  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({total, members, category})
    });

    if (!response.ok) throw new Error('Request failed');

    const data = await response.json();
    insightsOutput.innerHTML = `
  <h3>✨ Expense Insights</h3>

  <p>${escapeHtml(data.message)}</p>

  <p>Total expense: ₹${data.total_expense}</p>
  <p>Category: ${escapeHtml(category)}</p>

  <p>People sharing: ${data.member_count}</p>

  <p>Average contribution: ₹${data.average_share}</p>

  <p>${escapeHtml(data.insight)}</p>

  <hr>

  <h3>💡 Smart Recommendations</h3>

  <ul>
    ${data.recommendations.map(item =>
      `<li>${escapeHtml(item)}</li>`
    ).join('')}
  </ul>
`;

 
  } catch (error) {
    insightsOutput.textContent =
      'Could not generate insights. Check your server.';
  } finally {
    insightsBtn.disabled = false;
    insightsBtn.textContent = '✨ Generate Expense Insights';
  }
});

// =================================
// SPLITMATE AI - EXPENSE HISTORY
// =================================

let allExpenses = [];

async function loadExpenseHistory() {

  try {

    const response = await fetch('/api/history');

    if (!response.ok) {
      throw new Error('History loading failed');
    }

    const data = await response.json();

    allExpenses = data.expenses || [];

    document.getElementById('historyCount').textContent =
      allExpenses.length;

    const total = allExpenses.reduce(
      (sum, expense) => sum + Number(expense.total), 0
    );

    document.getElementById('historyTotal').textContent =
      '₹' + total.toLocaleString('en-IN');

    filterHistory();

  } catch (error) {

    console.error(error);

    document.getElementById('historyList').textContent =
      'Unable to load expense history.';

  }

}


// FILTER HISTORY

function filterHistory() {

  const search = document.getElementById('historySearch')
    .value.toLowerCase();

  const category = document.getElementById('historyCategory').value;

  const filtered = allExpenses.filter(expense => {

    const title = String(expense.title || '').toLowerCase();

    const matchesSearch = title.includes(search);

    const matchesCategory =
      category === 'All' || expense.category === category;

    return matchesSearch && matchesCategory;

  });

  displayHistory(filtered);

}


// DISPLAY HISTORY

function displayHistory(expenses) {

  const container = document.getElementById('historyList');

  if (!expenses.length) {

    container.innerHTML =
      '<p class="empty-history">No expenses found.</p>';

    return;

  }

  container.innerHTML = expenses.slice().reverse().map(expense => {

    const date = new Date(expense.date).toLocaleDateString('en-IN');

    return `

      <div class="history-card">

        <div class="history-card-top">

          <div>
            <h3>${escapeHtml(String(expense.title))}</h3>
            <span class="history-category">
              ${escapeHtml(String(expense.category))}
            </span>
          </div>

          <h2>
            ₹${Number(expense.total).toLocaleString('en-IN')}
            <button class="delete-expense"
  onclick="deleteExpense('${expense.id}')">
  🗑️ Delete
</button>
          </h2>

        </div>

        <div class="history-details">

          <span>👥 ${expense.member_count} Members</span>

          <span>
            ₹${Number(expense.average_share).toLocaleString('en-IN')}
            / person
          </span>

          <span>📅 ${date}</span>

        </div>

      </div>

    `;

  }).join('');

}


// SEARCH AND CATEGORY FILTER

document.getElementById('historySearch')
  .addEventListener('input', filterHistory);

document.getElementById('historyCategory')
  .addEventListener('change', filterHistory);


// INITIAL LOAD

loadExpenseHistory();
// DELETE EXPENSE
async function deleteExpense(expenseId) {

  if (!confirm('Are you sure you want to delete this expense?')) {
    return;
  }

  try {
    const response = await fetch(`/api/history/${expenseId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Delete failed');
    }

    await loadExpenseHistory();

    alert('Expense deleted successfully!');

  } catch (error) {
    alert('Could not delete expense.');
    console.error(error);
  }
}

// =================================
// SPLITMATE AI - EXPENSE ANALYTICS
// =================================

async function loadAnalytics() {

  try {

    const response = await fetch('/api/analytics');

    if (!response.ok) {
      throw new Error('Analytics loading failed');
    }

    const data = await response.json();

    const formatMoney = amount =>
      '₹' + Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

    document.getElementById('analyticsTotal').textContent =
      formatMoney(data.total_spending);

    document.getElementById('analyticsCount').textContent =
      data.total_transactions;

    document.getElementById('analyticsAverage').textContent =
      formatMoney(data.average_expense);

    document.getElementById('analyticsHighest').textContent =
      data.highest_expense
        ? formatMoney(data.highest_expense.total)
        : '₹0';

    document.getElementById('highestExpenseName').textContent =
      data.highest_expense
        ? data.highest_expense.title
        : 'No expenses yet';

    const categoryContainer =
      document.getElementById('categoryBreakdown');

    const categories = Object.entries(data.category_totals);
    // Monthly spending breakdown
const monthlyContainer =
  document.getElementById('monthlyBreakdown');

const months = Object.entries(data.monthly_totals || {})
  .sort((a, b) => a[0].localeCompare(b[0]));

if (!months.length) {
  monthlyContainer.textContent = 'No monthly data available.';
} else {

  const maxMonthlyAmount = Math.max(
    ...months.map(item => Number(item[1]))
  );

  monthlyContainer.innerHTML = months.map(([month, amount]) => {

    const percentage = maxMonthlyAmount > 0
      ? (Number(amount) / maxMonthlyAmount) * 100
      : 0;

    return `
      <div class="category-row">
        <div class="category-info">
          <span>${escapeHtml(month)}</span>
          <b>₹${Number(amount).toLocaleString('en-IN')}</b>
        </div>

        <div class="category-bar">
          <div class="category-fill"
            style="width:${percentage}%">
          </div>
        </div>
      </div>
    `;
  }).join('');
}

    if (!categories.length) {
      categoryContainer.textContent = 'No expenses available yet.';
      return;
    }

    const maxAmount = Math.max(
      ...categories.map(item => Number(item[1]))
    );

    categoryContainer.innerHTML = categories.map(([category, amount]) => {

      const percentage = maxAmount > 0
        ? (Number(amount) / maxAmount) * 100
        : 0;

      return `
        <div class="category-row">

          <div class="category-info">
            <span>${escapeHtml(category)}</span>
            <b>${formatMoney(amount)}</b>
          </div>

          <div class="category-bar">
            <div class="category-fill"
              style="width:${percentage}%">
            </div>
          </div>

        </div>
      `;

    }).join('');

  } catch (error) {

    console.error(error);

    document.getElementById('categoryBreakdown').textContent =
      'Unable to load analytics.';

  }

}

// Load analytics when the page opens
loadAnalytics();