import test from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './dom';
import { boot, fixture } from './fixture';
import { renderDashboardView } from '../src/finance/views/dashboard-view';

test('finance charts treat a stored currency symbol as text in every SVG amount', async () => {
  const dom = installDOM();
  try {
    const { plugin, root } = await boot(fixture());
    const symbol = '<img src="x" onerror="alert(1)"><svg onload="alert(1)">';
    root.data.finance.settings.currencySymbol = symbol;
    const now = new Date();
    const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    root.data.finance.ledgers.personal.transactions.push({
      id: 'synthetic-transaction', date, type: '支出', amount: 12,
      cat1: 'test', cat2: 'test', cat3: 'test', note: '',
    } as any);
    const host = document.createElement('div');
    renderDashboardView(host, { store: plugin.stores.finance } as any);
    const amounts = [...host.querySelectorAll('.fl-chart-total,.fl-chart-summary')];
    assert.equal(amounts.length, 2);
    for (const amount of amounts) assert(amount.textContent?.includes(symbol));
    assert.equal(host.querySelector('img,[onerror],[onload],script,foreignObject'), null);
  } finally {
    dom.window.close();
  }
});
