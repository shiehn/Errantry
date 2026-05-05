/**
 * @errantry/playwright — first-class Playwright extension for Errantry.
 *
 * Usage in an Electron-TS app under test:
 *
 *   import { test, expect } from '@errantry/playwright';
 *
 *   test('agent creates a scene', async ({ errantry, app }) => {
 *     await app.bindFixture('blank-project');
 *     const result = await errantry.run({
 *       surface: 'cli',
 *       goal: 'Create a scene called "Verse".',
 *     });
 *     await expect(result).toolCalled({ contains: 'scene' });
 *     await expect(app.db).toHaveRow(
 *       "SELECT name FROM scenes WHERE name = 'Verse'",
 *     );
 *     await expect(result).budgetRespected({ turns: 6, errors: 2 });
 *   });
 */
export { test, expect } from './fixtures.js';
export type { ErrantryFixture, AppFixture, ErrantryRunOptions } from './fixtures.js';
