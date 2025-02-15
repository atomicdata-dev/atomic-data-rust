import { test, expect, Locator } from '@playwright/test';
import {
  signIn,
  newDrive,
  newResource,
  before,
  currentDialog,
  REBUILD_INDEX_TIME,
} from './test-utils';

test.describe('Ontology', async () => {
  test.beforeEach(before);

  test('Create and edit ontology', async ({ page }) => {
    test.slow();

    const pickOption = async (query: Locator, keyboardSteps?: number) => {
      await page.waitForTimeout(100);

      // Sometimes when the page moves after the dropdown opens, part of the dropdown falls outside the viewport.
      // In this case we have to use the keyboard because scrolling doesn't seem to work.
      if (keyboardSteps !== undefined) {
        for (let i = 0; i < keyboardSteps; i++) {
          await page.keyboard.press('ArrowDown');
        }

        await page.keyboard.press('Enter');

        return;
      }

      // Use the mouse if we can.
      await query.hover();
      await query.click();
    };

    const classCard = (name: string) =>
      page.getByTestId(`class-card-write-${name}`);

    // --- Test Start ---
    await signIn(page);
    await newDrive(page);

    // Create new Table
    await newResource('ontology', page);

    // Name ontology
    const ontologyName = 'youtube-thumbnail-editor';
    await page.getByPlaceholder('my-ontology').fill(ontologyName);
    await page.locator('dialog[open] button:has-text("Create")').click();
    await expect(page.locator(`h1:has-text("${ontologyName}")`)).toBeVisible();

    await page
      .getByTestId('markdown-editor')
      .fill('Data model for youtube thumbnail editor');
    await page.getByRole('button', { name: 'Read', exact: true }).click();

    await expect(
      page.getByText('Data model for youtube thumbnail editor'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Add class', exact: true }).click();
    await page.getByPlaceholder('shortname').fill('thumbnail');
    await page.getByRole('button', { name: 'Save' }).click();

    // Thumbnail class

    await expect(page.locator('input[value="thumbnail"]')).toBeVisible();
    await page.getByText('Change me').fill('Thumbnail of a youtube video');
    await page.getByRole('button', { name: 'add required property' }).click();
    await page
      .getByPlaceholder('Search for a property or enter a URL')
      .fill('arrows');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('input[value="arrows"]')).toBeVisible();
    await expect(page.locator('input[value="a property"]')).toBeVisible();

    await page
      .locator('input[value="a property"]')
      .fill('The arrows on a thumbnail');

    // Arrows property

    await page.getByRole('button', { name: 'Configure arrows' }).click();

    await expect(currentDialog(page).getByLabel('Classtype')).toBeDisabled();

    await currentDialog(page)
      .getByLabel('Datatype')
      .selectOption('https://atomicdata.dev/datatypes/resourceArray');

    await expect(
      currentDialog(page).getByLabel('Classtype'),
    ).not.toBeDisabled();
    await currentDialog(page).getByLabel('Classtype').click();

    await currentDialog(page)
      .getByPlaceholder('Search for a class')
      .fill('arrow');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Arrow class

    await expect(
      classCard('arrow').locator('input[value="arrow"]'),
    ).toBeVisible();
    await expect(page.getByText('Change me')).toBeVisible();
    await page.getByText('Change me').fill('An arrow in a thumbnail');

    await page
      .getByRole('button', { name: 'add recommended property' })
      .nth(1)
      .click();

    await expect(
      page.getByText('A textual description of something'),
    ).toBeVisible();

    await page.getByText('A textual description of something').click();

    await page
      .getByRole('button', { name: 'add required property' })
      .nth(1)
      .click();

    await page.getByPlaceholder('Search for a property').fill('arrow-kind');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.getByTitle('Configure arrow-kind').click();

    await expect(
      currentDialog(page).locator('input[value="arrow-kind"]'),
    ).toBeVisible();

    await currentDialog(page)
      .getByLabel('Datatype')
      .selectOption('https://atomicdata.dev/datatypes/atomicURL');

    await expect(
      currentDialog(page).getByLabel('Classtype'),
    ).not.toBeDisabled();
    await currentDialog(page).getByLabel('Classtype').click();

    await currentDialog(page)
      .getByPlaceholder('Search for a class')
      .fill('arrow-kind');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // arrow-kind class

    const arrowKindCard = classCard('arrow-kind');
    await expect(
      arrowKindCard.locator('input[value="arrow-kind"]'),
    ).toBeVisible();

    // add name property to arrow-kind
    await arrowKindCard.getByTitle('add required property').click();

    await expect(
      page.getByText('nameThe name of a thing or person'),
    ).toBeVisible();

    await pickOption(page.getByText('nameThe name'), 1);

    // add line-type property to arrow-kind
    await arrowKindCard.getByTitle('add recommended property').click();
    await page.getByPlaceholder('Search for a property').fill('line-type');

    await expect(page.getByText('Create line-type')).toBeVisible();

    await pickOption(page.getByText('Create line-type'));

    await page.getByTitle('Configure line-type').click();

    await expect(
      currentDialog(page).locator('input[value="line-type"]'),
    ).toBeVisible();

    await expect(
      currentDialog(page).getByRole('button', { name: 'Enum' }),
    ).not.toBeVisible();

    await currentDialog(page)
      .getByLabel('Datatype')
      .selectOption('https://atomicdata.dev/datatypes/resourceArray');

    await expect(
      currentDialog(page).getByRole('tab', { name: 'Enum' }),
    ).toBeVisible();

    // Create two tags: dashed and solid
    await currentDialog(page).getByPlaceholder('New tag').fill('dashed');
    await currentDialog(page).getByRole('button', { name: 'Add tag' }).click();

    await expect(currentDialog(page).getByPlaceholder('New tag')).toHaveValue(
      '',
    );

    await expect(currentDialog(page).getByText('dashed')).toBeVisible();

    await currentDialog(page).getByPlaceholder('New tag').fill('solid');
    await currentDialog(page).getByRole('button', { name: 'Add tag' }).click();

    await expect(currentDialog(page).getByPlaceholder('New tag')).toHaveValue(
      '',
    );

    await expect(currentDialog(page).getByText('solid')).toBeVisible();

    await currentDialog(page).getByRole('button', { name: 'close' }).click();
    // Create arrow-kind instances

    await page.waitForTimeout(REBUILD_INDEX_TIME);

    const createInstance = async (name: string) => {
      await page.getByRole('button', { name: 'New Instance' }).click();
      await expect(
        currentDialog(page).getByRole('heading', { name: 'Select a class' }),
      ).toBeVisible();

      await currentDialog(page)
        .getByRole('button', { name: 'arrow-kind' })
        .click();

      await expect(
        currentDialog(page).getByRole('heading', { name: 'new arrow-kind' }),
      ).toBeVisible();

      await expect(currentDialog(page).getByLabel('name')).toBeVisible();
      await currentDialog(page).getByLabel('name').fill(name);
      await currentDialog(page).getByRole('button', { name: 'Save' }).click();

      await expect(page.getByText('Resource loading...')).not.toBeVisible();
      await expect(page.getByRole('heading', { name })).toBeVisible();
    };

    await createInstance('Red arrow with circle');
    await createInstance('Green arrow with black border');

    await page.waitForTimeout(REBUILD_INDEX_TIME);

    await page
      .getByRole('button', { name: 'add an item to the allows-only list' })
      .nth(0)
      .click();
    await page.getByRole('button', { name: 'Search for a arrow-kind' }).click();
    await page
      .getByPlaceholder('Search for a arrow-kind ')
      .fill('red arrow with circle');
    await pickOption(
      page.getByRole('dialog').getByText('Red arrow with circle').nth(1),
    );

    await page
      .getByRole('button', { name: 'add an item to the allows-only list' })
      .nth(0)
      .click();
    await page.getByRole('button', { name: 'Search for a arrow-kind' }).click();
    await page
      .getByPlaceholder('Search for a arrow-kind ')
      .fill('green arrow with black border');
    await pickOption(
      page
        .getByRole('dialog')
        .getByText('Green arrow with black border')
        .nth(1),
    );

    expect(await page.getByText('Red arrow with circle').count()).toBe(3);
    expect(await page.getByText('Green arrow with black border').count()).toBe(
      3,
    );
  });
});
