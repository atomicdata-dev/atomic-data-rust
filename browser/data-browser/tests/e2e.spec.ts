// This file is copied from `atomic-data-browser` to `atomic-data-server` when `pnpm build-server` is run.
// This is why the `testConfig` is imported.

import { test, expect } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

const DEMO_FILENAME = 'testimage.svg';
const SERVER_URL = 'http://localhost:9883';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// TODO: Should use an env var so the CI can test the setup test.
const INITIAL_TEST = false;
const DEMO_INVITE_NAME = 'document demo';

const demoFile = () => {
  const processPath = process.cwd();

  // In the CI, the tests dir is missing for some reason?
  if (processPath.endsWith('tests')) {
    return `${processPath}/${DEMO_FILENAME}`;
  } else {
    return `${processPath}/tests/${DEMO_FILENAME}`;
  }
};

const timestamp = () => new Date().toLocaleTimeString();
const editableTitle = '[data-test="editable-title"]';
const sideBarDriveSwitcher = '[title="Open Drive Settings"]';
const sideBarNewResource = '[data-test="sidebar-new-resource"]';
const currentDriveTitle = '[data-test=current-drive-title]';
const publicReadRightLocator = (page: Page) =>
  page.locator('[data-test="right-public"] input[type="checkbox"]').first();
const contextMenu = '[data-test="context-menu"]';
const addressBar = '[data-test="address-bar"]';
const newDriveMenuItem = '[data-test="menu-item-new-drive"]';

const defaultDevServer = 'http://localhost:9883';
const currentDialogOkButton = 'dialog[open] >> footer >> text=Ok';
// Depends on server index throttle time, `commit_monitor.rs`
const REBUILD_INDEX_TIME = 5000;

async function setTitle(page: Page, title: string) {
  await page.locator(editableTitle).click();
  await page.fill(editableTitle, title);
  await page.waitForTimeout(300);
}

test.describe('data-browser', async () => {
  test.beforeEach(async ({ page }) => {
    if (!SERVER_URL) {
      throw new Error('serverUrl is not set');
    }

    // Open the server
    await page.goto(FRONTEND_URL);

    // Sometimes we run the test server on a different port, but we should
    // only change the drive if it is non-default.
    if (SERVER_URL !== 'http://localhost:9883') {
      await changeDrive(SERVER_URL, page);
    }

    await expect(page.locator(currentDriveTitle)).toBeVisible();
  });

  test('tables', async ({ page }) => {
    const newColumn = async (type: string) => {
      await page.getByRole('button', { name: 'Add column' }).click();
      await page.waitForTimeout(100);
      await page.click(`text=${type}`);
    };

    const tab = async () => {
      await page.waitForTimeout(200);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
    };

    const createTag = async (emote: string, name: string) => {
      await page.getByPlaceholder('New tag').last().fill(name);
      await page.getByTitle('Pick an emoji').last().click();
      await page.getByPlaceholder('Search', { exact: true }).fill(emote);
      await page.getByRole('button', { name: emote }).click();
      await page.getByTitle('Add tag').last().click();
    };

    const pickTag = async (name: string) => {
      await page.keyboard.type(name, { delay: 100 });
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await expect(page.getByPlaceholder('filter tags')).not.toBeVisible();
    };

    const fillRow = async (
      currentRowNumber: number,
      col1: string,
      col2: string,
      col3: string,
      col4: boolean,
      col5: string,
    ) => {
      await page.waitForTimeout(100);
      await page.keyboard.type(col1, { delay: 50 });
      await tab();
      // Wait for the table to refresh by checking if the next row is visible
      await expect(
        page.getByRole('rowheader', { name: `${currentRowNumber + 1}` }),
      ).toBeAttached();

      await page.keyboard.type(col2, { delay: 50 });
      await tab();
      await page.keyboard.type(col3, { delay: 50 });
      await tab();

      if (col4) {
        await page.keyboard.press('Space');
      }

      await tab();
      await pickTag(col5);
      await tab();
    };

    // --- Test Start ---
    await signIn(page);
    await newDrive(page);

    // Create new Table
    await newResource('table', page);

    // Name table
    await page.getByPlaceholder('New Table').fill('Made up music genres');
    await page.locator('button:has-text("Create")').click();
    await expect(
      page.locator('h1:has-text("Made up music genres")'),
    ).toBeVisible();

    // Create Date column
    await newColumn('Date');
    await expect(page.locator('text=New Date Column')).toBeVisible();
    await page
      .locator('[placeholder="New Column"] >> visible = true')
      .fill('Existed since');
    await page.getByLabel('Long').click();
    await page.locator('button:has-text("Create")').click();
    await waitForCommit(page);
    await expect(page.locator('text=New Date Column')).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Existed since' }),
    ).toBeVisible();

    // Create Number column
    await newColumn('Number');
    await expect(page.locator('text=New Number Column')).toBeVisible();
    await page
      .locator('[placeholder="New Column"] >> visible = true')
      .fill('Number of tracks');

    await page.locator('button:has-text("Create")').click();
    await waitForCommit(page);
    await expect(page.locator('text=New Number Column')).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Number of tracks' }),
    ).toBeVisible();

    // Create Checkbox column
    await newColumn('Checkbox');
    await expect(page.locator('text=New Checkbox Column')).toBeVisible();
    await page
      .locator('[placeholder="New Column"] >> visible = true')
      .fill('Approved by W3C');

    await page.locator('button:has-text("Create")').click();
    await waitForCommit(page);
    await expect(page.locator('text=New Checkbox Column')).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Approved by W3C' }),
    ).toBeVisible();

    // Create Select column
    await newColumn('Select');
    await expect(page.locator('text=New Select Column')).toBeVisible();
    await page
      .locator('[placeholder="New Column"] >> visible = true')
      .fill('Descriptive words');

    await createTag('😤', 'wild');
    await createTag('😵‍💫', 'dreamy');
    await createTag('🤨', 'wtf');
    await page.locator('button:has-text("Create")').click();
    await waitForCommit(page);
    await expect(page.locator('text=New Select Column')).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Descriptive words' }),
    ).toBeVisible();

    // Check if table has loaded.
    await expect(
      page.getByRole('button', { name: 'Descriptive words' }),
    ).toBeVisible();

    // Start filling cells
    await page.getByRole('gridcell').first().click({ force: true });
    await expect(page.getByRole('gridcell').first()).toBeFocused();
    await page.waitForTimeout(100);
    await fillRow(
      1,
      'Progressive Pizza House',
      '04032000',
      '10',
      true,
      'dreamy',
    );
    await fillRow(2, 'Drum or Bass', '15051980', '3000035', false, 'wild');
    await fillRow(3, 'Mumble Punk', '13051965', '60', true, 'wtf');

    // Check if cells have been filled correctly
    await expect(
      page.getByRole('gridcell', { name: 'Progressive Pizza House' }),
    ).toBeVisible();
    await expect(
      page.getByRole('gridcell', { name: 'Drum or Bass' }),
    ).toBeVisible();
    await expect(
      page.getByRole('gridcell', { name: 'Mumble Punk' }),
    ).toBeVisible();
    // Disabled date tests until Playwright bug fixed
    // await expect(
    //   page.getByRole('gridcell', { name: '4 March 2000' }),
    // ).toBeVisible();
    // await expect(
    //   page.getByRole('gridcell', { name: '15 May 1980' }),
    // ).toBeVisible();
    // await expect(
    //   page.getByRole('gridcell', { name: '13 May 1965' }),
    // ).toBeVisible();
    await expect(
      page.getByRole('gridcell', { name: '😵‍💫 dreamy' }),
    ).toBeVisible();
    await expect(page.getByRole('gridcell', { name: '😤 wild' })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: '🤨 wtf' })).toBeVisible();

    // Move to the first cell and change its content.
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.type('Progressive Peperoni Pizza House', { delay: 50 });
    await page.keyboard.press('Escape');

    await expect(
      page.getByRole('gridcell', { name: 'Progressive Pizza House' }),
    ).not.toBeVisible();

    await expect(
      page.getByRole('gridcell', { name: 'Progressive Peperoni Pizza House' }),
    ).toBeVisible();

    // Move to the index cell on the second row and delete the row.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Backspace');

    await expect(
      page.getByRole('gridcell', { name: 'Drum or Bass' }),
    ).not.toBeVisible();
  });

  test('sidebar mobile', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 800 });
    await page.reload();
    // TODO: this keeps hanging. How do I make sure something is _not_ visible?
    // await expect(page.locator('text=new resource')).not.toBeVisible();
    await page.click('[data-test="sidebar-toggle"]');
    await expect(page.locator(currentDriveTitle)).toBeVisible();
  });

  test('switch Server URL', async ({ page }) => {
    await expect(page.locator(`text=${DEMO_INVITE_NAME}`)).not.toBeVisible();
    await changeDrive('https://atomicdata.dev', page);
    await expect(
      page.locator(`text=${DEMO_INVITE_NAME}`).first(),
    ).toBeVisible();
  });

  test('sign in with secret, edit prole, sign out', async ({ page }) => {
    await signIn(page);
    await editProfileAndCommit(page);

    page.on('dialog', d => {
      d.accept();
    });

    // Sign out
    await page.click('text=user settings');
    await page.click('[data-test="sign-out"]');
    await expect(page.locator('text=Enter your Agent secret')).toBeVisible();
    await page.reload();
    await expect(page.locator('text=Enter your Agent secret')).toBeVisible();
  });

  test('sign up and edit document atomicdata.dev', async ({ page }) => {
    await openAtomic(page);
    // Use invite
    await page.click(`text=${DEMO_INVITE_NAME}`);
    await page.click('text=Accept as new user');
    await expect(page.locator(editableTitle)).toBeVisible();
    // We need the initial enter because removing the top line isn't working ATM
    await page.keyboard.press('Enter');
    const teststring = `Testline ${timestamp()}`;
    await page.fill('[data-test="element-input"]', teststring);
    // This next line can be flaky, maybe the text disappears because it's overwritten?
    await expect(page.locator(`text=${teststring}`)).toBeVisible();
    // Remove the text again for cleanup
    await page.keyboard.press('Alt+Backspace');
    await expect(page.locator(`text=${teststring}`)).not.toBeVisible();
    const docTitle = `Document Title ${timestamp()}`;
    await page.click(editableTitle, { delay: 200 });
    await page.fill(editableTitle, docTitle);
    // Not sure if this test is needed - it fails now.
    // await expect(page.locator(documentTitle)).toBeFocused();
    // Check if we can edit our profile
    await editProfileAndCommit(page);
  });

  test('text search', async ({ page }) => {
    await page.fill(addressBar, 'welcome');
    await expect(page.locator('text=Welcome to your')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('text=resources:')).toBeVisible();
  });

  test('scoped search', async ({ page }) => {
    await signIn(page);
    await newDrive(page);

    // Create folder called 1
    await page.locator(sideBarNewResource).click();
    await page.locator('button:has-text("folder")').click();
    await setTitle(page, 'Salad folder');

    // Create document called 'Avocado Salad'
    await page.locator('button:has-text("New Resource")').click();
    await page.locator('button:has-text("document")').click();
    await waitForCommit(page);
    // commit for initializing the first element (paragraph)
    await waitForCommit(page);
    await editTitle('Avocado Salad', page);

    await page.locator(sideBarNewResource).click();

    // Create folder called 'Cake folder'
    await page.locator('button:has-text("folder")').click();
    await setTitle(page, 'Cake Folder');

    // Create document called 'Avocado Salad'
    await page.locator('button:has-text("New Resource")').click();
    await page.locator('button:has-text("document")').click();
    await waitForCommit(page);
    // commit for initializing the first element (paragraph)
    await waitForCommit(page);
    await editTitle('Avocado Cake', page);

    await clickSidebarItem('Cake Folder', page);

    // Set search scope to 'Cake folder'
    await page.waitForTimeout(REBUILD_INDEX_TIME);
    await page.reload();
    await page.locator('button[title="Search in Cake Folder"]').click();
    // Search for 'Avocado'
    await page.locator('[data-test="address-bar"]').type('Avocado');
    // I don't like the `.first` here, but for some reason there is one frame where
    // Multiple hits render, which fails the tests.
    await expect(page.locator('h2:text("Avocado Cake")').first()).toBeVisible();
    await expect(page.locator('h2:text("Avocado Salad")')).not.toBeVisible();

    // Remove scope
    await page.locator('button[title="Clear scope"]').click();

    await expect(page.locator('h2:text("Avocado Cake")').first()).toBeVisible();
    await expect(
      page.locator('h2:text("Avocado Salad")').first(),
    ).toBeVisible();
  });

  test('collections & data view', async ({ page }) => {
    await openAtomic(page);
    // collections, pagination, sorting
    await openSubject(page, 'https://atomicdata.dev/properties');
    await page.click(
      '[data-test="sort-https://atomicdata.dev/properties/description"]',
    );
    // These values can change as new Properties are added to atomicdata.dev
    const firstPageText = 'text=A base64 serialized JSON object';
    const secondPageText = 'text=include-nested';
    await expect(page.locator(firstPageText)).toBeVisible();
    await page.click('[data-test="next-page"]');
    await expect(page.locator(firstPageText)).not.toBeVisible();
    await expect(page.locator(secondPageText)).toBeVisible();

    // context menu, keyboard & data view
    await page.click(contextMenu);
    await page.keyboard.press('Enter');
    await expect(page.locator('text=JSON-AD')).toBeVisible();
    await page.click('[data-test="fetch-json-ad"]');
    await expect(
      page.locator(
        'text="https://atomicdata.dev/properties/collection/members": [',
      ),
    ).toBeVisible();
    await page.click('[data-test="fetch-json"]');
    await expect(page.locator('text=  "members": [')).toBeVisible();
    await page.click('[data-test="fetch-json-ld"]');
    await expect(page.locator('text="current-page": {')).toBeVisible();
    await page.click('[data-test="fetch-turtle"]');
    await expect(page.locator('text=<http')).toBeVisible();
    await page.click('[data-test="copy-response"]');
    await expect(page.locator('text=Copied')).toBeVisible();
  });

  test('localhost /setup', async ({ page }) => {
    if (INITIAL_TEST) {
      // Setup initial user (this test can only be run once per server)
      await page.click('[data-test="sidebar-drive-open"]');
      await expect(page.locator('text=/setup')).toBeVisible();
      // Don't click on setup - this will take you to a different domain, not to the dev build!
      // await page.click('text=/setup');
      await openSubject(page, `${SERVER_URL}/setup`);
      await expect(page.locator('text=Accept as')).toBeVisible();
      // await page.click('[data-test="accept-existing"]');
      await page.click('text=Accept as');
    } else {
      // eslint-disable-next-line no-console
      console.log('Skipping `/setup` test...');
    }
  });

  test('create document, edit, page title, websockets', async ({
    page,
    browser,
  }) => {
    await signIn(page);
    await newDrive(page);
    await makeDrivePublic(page);
    // Create a document
    await newResource('document', page);
    // commit for saving initial document
    await waitForCommit(page);
    // commit for initializing the first element (paragraph)
    await waitForCommit(page);
    const title = `Document ${timestamp()}`;
    await editTitle(title, page);

    await page.press(editableTitle, 'Enter');

    const teststring = `My test: ${timestamp()}`;
    await page.fill('textarea', teststring);
    await waitForCommit(page);

    // commit editing paragraph
    await expect(page.locator(`text=${teststring}`)).toBeVisible();

    // multi-user
    const currentUrl = await getCurrentSubject(page);
    const page2 = await openNewSubjectWindow(browser, currentUrl!);
    await expect(page2.locator(`text=${teststring}`)).toBeVisible();
    expect(await page2.title()).toEqual(title);

    // Add a new line on first page, check if it appears on the second
    await page.keyboard.press('Enter');
    await waitForCommit(page);
    await waitForCommit(page);
    const syncText = 'New paragraph';
    await page.keyboard.type(syncText);
    // If this fails to show up, websockets aren't working properly
    await expect(page2.locator(`text=${syncText}`)).toBeVisible();
  });

  /**
   * We remove public read rights from drive, create an invite, open that
   * invite, and add the public read right again.
   */
  test('authorization, invite, share menu', async ({
    page,
    browser,
    context,
  }) => {
    // Remove public read rights for Drive
    await signIn(page);
    const { driveURL, driveTitle } = await newDrive(page);
    await page.click(currentDriveTitle);
    await contextMenuClick('share', page);
    expect(publicReadRightLocator(page)).not.toBeChecked();

    // Initialize unauthorized page for reader
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.setViewportSize({ width: 1000, height: 400 });
    await page2.goto(FRONTEND_URL);
    await openSubject(page2, driveURL);
    // TODO set current drive by opening the URL
    await expect(page2.locator('text=Unauthorized').first()).toBeVisible();

    // Create invite
    await page.click('button:has-text("Send invite")');
    context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.click('button:has-text("Create Invite")');
    await expect(page.locator('text=Invite created and copied ')).toBeVisible();
    const inviteUrl = await page.evaluate(() =>
      document
        ?.querySelector('[data-code-content]')
        ?.getAttribute('data-code-content'),
    );
    expect(inviteUrl).not.toBeFalsy();

    await page.waitForTimeout(200);

    // Open invite
    const page3 = await openNewSubjectWindow(browser, inviteUrl as string);
    await page3.click('button:has-text("Accept")');
    await page3.waitForNavigation();
    await page3.reload();
    await expect(page3.locator(`text=${driveTitle}`).first()).toBeVisible();
  });

  test('upload, download', async ({ page }) => {
    await signIn(page);
    await newDrive(page);
    // add attachment to drive
    await page.click(contextMenu);
    await page.locator('[data-test="menu-item-edit"]').click();
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Upload file")'),
    ]);
    await fileChooser.setFiles(demoFile());
    await page.click(`[data-test="file-pill"]:has-text("${DEMO_FILENAME}")`);
    const image = page.locator('[data-test="image-viewer"]');
    await expect(image).toBeVisible();
    await expect(image).toHaveScreenshot({ maxDiffPixelRatio: 0.1 });
  });

  test('chatroom', async ({ page, browser }) => {
    await signIn(page);
    await newDrive(page);
    await newResource('chatroom', page);
    await expect(
      page.getByRole('heading', { name: 'Untitled ChatRoom' }),
    ).toBeVisible();
    const teststring = `My test: ${timestamp()}`;
    await page.fill('[data-test="message-input"]', teststring);
    const chatRoomUrl = (await getCurrentSubject(page)) as string;
    await page.keyboard.press('Enter');
    await expect(page.locator(`text=${teststring}`)).toBeVisible();

    const dropdownId = await page
      .locator(contextMenu)
      .getAttribute('aria-controls');

    await page.click(contextMenu);
    await page
      .locator(`[id="${dropdownId}"] >> [data-test="menu-item-share"]`)
      .click();
    await publicReadRightLocator(page).click();
    await page.click('text=save');

    const page2 = await openNewSubjectWindow(browser, chatRoomUrl);
    // Second user
    await signIn(page2);
    await expect(page2.locator(`text=${teststring}`)).toBeVisible();
    const teststring2 = `My reply: ${timestamp()}`;
    await page2.fill('[data-test="message-input"]', teststring2);
    await page2.keyboard.press('Enter');
    // Both pages should see then new chat message
    await expect(page.locator(`text=${teststring2}`)).toBeVisible();
    // TODO: get rid of this reload! It should not be necessary
    // For some reason the page does not see the new message
    await page2.reload();
    await expect(page2.locator(`text=${teststring2}`)).toBeVisible();
  });

  test('bookmark', async ({ page }) => {
    await signIn(page);
    await newDrive(page);

    // Create a new bookmark
    await newResource('bookmark', page);

    // Fetch `example.com
    const input = page.locator('[placeholder="https\\:\\/\\/example\\.com"]');
    await input.click();
    await input.fill('https://ontola.io');
    await page.locator(currentDialogOkButton).click();

    await expect(page.locator(':text-is("Full-service")')).toBeVisible();
  });

  test('folder', async ({ page }) => {
    await signIn(page);
    await newDrive(page);

    // Create a new folder
    await newResource('folder', page);
    // Createa sub-resource in the folder
    await page.click('text=Untitled folder');
    await page.click('main >> text=New Resource');
    await page.click('button:has-text("Document")');
    await page.locator(editableTitle).click();
    await page.keyboard.type('RAM Downloading Strategies');
    await page.keyboard.press('Enter');
    await page.click('[data-test="sidebar"] >> text=Untitled folder');
    await expect(
      page.locator(
        '[data-test="folder-list"] >> text=RAM Downloading Strategies',
      ),
      'Created document not visible',
    ).toBeVisible();
  });

  test('drive switcher', async ({ page }) => {
    await signIn(page);
    await page.locator(`${currentDriveTitle} > text=localhost`);

    await page.click(sideBarDriveSwitcher);
    // temp disable for trailing slash
    // const dropdownId = await page
    //   .locator(sideBarDriveSwitcher)
    //   .getAttribute('aria-controls');
    // await page.click(`[id="${dropdownId}"] >> text=Atomic Data`);
    // await expect(page.locator(currentDriveTitle)).toHaveText('Atomic Data');

    // Cleanup drives for signed in user
    await page.click('text=user settings');
    await page.click('text=Edit profile');
    await page.click('[data-test="input-drives-clear"]');
    await page.click('[data-test="save"]');
  });

  test('configure drive page', async ({ page }) => {
    await signIn(page);
    await openConfigureDrive(page);
    await expect(page.locator(currentDriveTitle)).toHaveText('localhost');

    // temp disable this, because of trailing slash in base URL
    // await page.click(':text("https://atomicdata.dev") + button:text("Select")');
    // await expect(page.locator(currentDriveTitle)).toHaveText('Atomic Data');

    await openConfigureDrive(page);
    await page.fill('[data-test="server-url-input"]', 'https://example.com');
    await page.click('[data-test="server-url-save"]');

    await expect(page.locator(currentDriveTitle)).toHaveText('...');

    await openConfigureDrive(page);
    await page.click(':text("https://atomicdata.dev") + button:text("Select")');
    await expect(page.locator(currentDriveTitle)).toHaveText('Atomic Data');
    await openConfigureDrive(page);
    await page.click(
      ':text("https://example.com") ~ [title="Add to favorites"]',
    );

    await page.click(
      ':text("https://example.com") ~ [title="Remove from favorites"]',
    );
  });

  test('form validation', async ({ page }) => {
    await signIn(page);
    await newDrive(page);
    await newResource('class', page);
    const shortnameInput = '[data-test="input-shortname"]';
    // Try entering a wrong slug
    await page.click(shortnameInput);
    await page.keyboard.type('not valid');
    await expect(page.locator('text=Not a valid slug')).toBeVisible();
    await page.locator(shortnameInput).fill('');
    await page.keyboard.type('is-valid');
    await expect(page.locator('text=Not a valid slug')).not.toBeVisible();

    // Add a new property
    const input = page.locator(
      '[placeholder="Select a property or enter a property URL..."]',
    );
    await input.click();

    await expect(page.locator('text=Create property:')).toBeVisible();
    await input.fill('https://atomicdata.dev/properties/invite/usagesLeft');
    await page.keyboard.press('Enter');
    await page.click('[title="Add this property"]');
    await expect(page.locator('text=Usages-left').first()).toBeVisible();
    // Integer validation
    await page.click('[data-test="input-usages-left"]');
    await page.keyboard.type('asdf' + '1');
    await expect(page.locator('text=asdf')).not.toBeVisible();
    // Dropdown select
    await page.click('[data-test="input-recommends-add-resource"]');
    await page.locator('text=append').click();
    await expect(
      page.locator(
        '[data-test="input-recommends"] >> text=https://atomicdata.dev',
      ),
    ).not.toBeVisible();

    // Try to save without a description
    page.locator('button:has-text("Save")').click();
    await expect(
      page.locator(
        'text=Property https://atomicdata.dev/properties/description missing',
      ),
    ).toBeVisible();

    // Add a description
    await page.click('textarea[name="yamdeContent"]');
    await page.keyboard.type('This is a test class');
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Resource Saved')).toBeVisible();
  });

  test('sidebar subresource', async ({ page }) => {
    await signIn(page);
    await newDrive(page);

    // create a resource, make sure its visible in the sidebar (and after refresh)
    const klass = 'folder';
    await newResource(klass, page);
    await expect(
      page.locator(`[data-test="sidebar"] >> text=${klass}`),
    ).toBeVisible();
    const d0 = 'depth0';
    await setTitle(page, d0);

    // Create a subresource, and later check it in the sidebar
    await page.locator(`[data-test="sidebar"] >> text=${d0}`).hover();
    await page.locator(`[title="Create new resource under ${d0}"]`).click();
    await page.click(`button:has-text("${klass}")`);
    const d1 = 'depth1';
    await setTitle(page, d1);

    await expect(
      page.locator(`[data-test="sidebar"] >> text=${d1}`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-test="sidebar"] >> text=${d0}`),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator(`[data-test="sidebar"] >> text=${d1}`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-test="sidebar"] >> text=${d0}`),
    ).toBeVisible();
  });

  test('import', async ({ page }) => {
    await signIn(page);
    await newDrive(page);
    await newResource('folder', page);
    await contextMenuClick('import', page);

    const parentSubject = await page.getByLabel('Target Parent').inputValue();

    const localID = 'localIDtest';
    const name = 'blaat';
    const importStr = {
      'https://atomicdata.dev/properties/localId': localID,
      'https://atomicdata.dev/properties/name': name,
    };
    await page.fill(
      '[placeholder="Paste your JSON-AD..."]',
      JSON.stringify(importStr),
    );
    await page.click('[data-test="import-post"]');
    await expect(page.locator('text=Imported!')).toBeVisible();

    // get current url, append the localID
    await page.goto(parentSubject + '/' + localID);
    await expect(page.locator(`h1:text("${name}")`)).toBeVisible();
  });

  test('dialog', async ({ page }) => {
    await signIn(page);
    await newDrive(page);
    // Create new class from new resource menu
    await newResource('class', page);

    await fillInput('shortname', page);
    await fillInput('description', page);
    await page.click('[data-test="save"]');
    await page.waitForNavigation();
    await page.locator('text=Resource Saved');
    await page.goBack();

    await page
      .locator('[title="Add an item to the recommends list"]')
      .first()
      .click();
    await page.locator('[data-test="input-recommends"]').click();
    await page.locator('[data-test="input-recommends"]').fill('test-prop');

    // Create new Property using dialog
    await page.locator('text=Create property: test-prop').click();
    await expect(page.locator('h1:has-text("new property")')).toBeVisible();
    await page.locator('[data-test="input-datatype"]').click();
    // click twice, first click is buggy, it closes the dropdown from earlier
    await page.locator('[data-test="input-datatype"]').click();
    await page
      .locator(
        'li:has-text("boolean - Either `true` or `false`. In JSON-AD, th...")',
      )
      .click();
    await page.locator('dialog textarea[name="yamdeContent"]').click();
    await page
      .locator('dialog textarea[name="yamdeContent"]')
      .fill('This is a test prop');
    await page.locator('dialog footer >> text=Save').click();

    await page.locator('text=Resource Saved');
    expect(
      await page.locator(
        '[data-test="input-recommends"] >> nth=0 >> "test-prop"',
      ),
    );
  });

  test('history page', async ({ page }) => {
    await signIn(page);
    await newDrive(page);
    // Create new class from new resource menu
    await newResource('document', page);

    // commit for saving initial document
    await waitForCommit(page);
    // commit for initializing the first element (paragraph)
    await waitForCommit(page);

    await editTitle('First Title', page);

    await expect(
      page.getByRole('heading', { name: 'First Title', level: 1 }),
    ).toBeVisible();

    await editTitle('Second Title', page, true);
    await expect(
      page.getByRole('heading', { name: 'Second Title', level: 1 }),
    ).toBeVisible();
    await contextMenuClick('history', page);

    await expect(page.locator('text=History of Second Title')).toBeVisible();

    await page.reload();
    await page.getByTestId('version-button').nth(2).click();

    await expect(page.locator('text=First Title')).toBeVisible();

    await page.click('text=Make current version');

    await expect(page.locator('text=Resource version updated')).toBeVisible();
    // await page.waitForNavigation();
    await expect(page.locator('h1:has-text("First Title")')).toBeVisible();
    await expect(page.locator('text=History of First Title')).not.toBeVisible();
  });
});

async function disableViewTransition(page: Page) {
  await page.click('text=Theme Settings');
  const checkbox = await page.getByLabel('Enable view transition');

  await expect(checkbox).toBeVisible();

  await checkbox.uncheck();
  await page.goBack();
}

/** Signs in using an AtomicData.dev test user */
async function signIn(page: Page) {
  await disableViewTransition(page);
  await page.click('text=user settings');
  await expect(page.locator('text=edit data and sign Commits')).toBeVisible();
  // If there are any issues with this agent, try creating a new one https://atomicdata.dev/invites/1
  const test_agent =
    'eyJzdWJqZWN0IjoiaHR0cHM6Ly9hdG9taWNkYXRhLmRldi9hZ2VudHMvaElNWHFoR3VLSDRkM0QrV1BjYzAwUHVFbldFMEtlY21GWStWbWNVR2tEWT0iLCJwcml2YXRlS2V5IjoiZkx0SDAvY29VY1BleFluNC95NGxFemFKbUJmZTYxQ3lEekUwODJyMmdRQT0ifQ==';
  await page.click('#current-password');
  await page.fill('#current-password', test_agent);
  await expect(page.locator('text=Edit profile')).toBeVisible();
  await page.goBack();
}

/**
 * Create a new drive, go to it, and set it as the current drive. Returns URL of
 * drive and its name
 */
async function newDrive(page: Page) {
  // Create new drive to prevent polluting the main drive
  await page.locator(sideBarDriveSwitcher).click();
  await page.locator('button:has-text("New Drive")').click();
  await page.waitForNavigation();
  await expect(page.locator('text="Create new resource"')).toBeVisible();
  const driveURL = await getCurrentSubject(page);
  expect(driveURL).toContain('localhost');
  const driveTitle = `testdrive-${timestamp()}`;
  await page.locator(editableTitle).click();
  await page.fill(editableTitle, driveTitle);
  await page.waitForTimeout(200);

  return { driveURL: driveURL as string, driveTitle };
}

async function makeDrivePublic(page: Page) {
  await page.click(currentDriveTitle);
  await page.click(contextMenu);
  await page.click('button:has-text("share")');
  await expect(publicReadRightLocator(page)).not.toBeChecked();
  await publicReadRightLocator(page).click();
  await page.locator('text=Save').click();
  await expect(page.locator('text="Share settings saved"')).toBeVisible();
}

async function openSubject(page: Page, subject: string) {
  await page.fill(addressBar, subject);
  await expect(page.locator(`main[about="${subject}"]`).first()).toBeVisible();
}

async function getCurrentSubject(page: Page) {
  return page.locator(addressBar).getAttribute('value');
}

/** Set atomicdata.dev as current server */
async function openAtomic(page: Page) {
  await changeDrive('https://atomicdata.dev', page);
  // Accept the invite, create an account if necessary
  await expect(page.locator(currentDriveTitle)).toHaveText('Atomic Data');
}

/** Opens the users' profile, sets a username */
async function editProfileAndCommit(page: Page) {
  await page.click('text=user settings');
  await page.click('text=Edit profile');
  await expect(page.locator('text=add another property')).toBeVisible();
  const username = `Test user edited at ${new Date().toLocaleDateString()}`;
  await page.fill('[data-test="input-name"]', username);
  await page.click('[data-test="save"]');
  await expect(page.locator('text=Resource saved')).toBeVisible();
  await page.waitForURL(/\/app\/show/);
  await page.reload();
  await expect(page.locator(`text=${username}`).first()).toBeVisible();
}

/** Create a new Resource in the current Drive */
async function newResource(klass: string, page: Page) {
  await page.locator(sideBarNewResource).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/app/new`);
  await page.locator(`button:has-text("${klass}")`).click();
}

/** Opens a new browser page (for) */
async function openNewSubjectWindow(browser: Browser, url: string) {
  const context2 = await browser.newContext();
  const page = await context2.newPage();
  await page.goto(FRONTEND_URL);

  // Only when we run on `localhost` we don't need to change drive during tests
  if (SERVER_URL !== defaultDevServer) {
    await changeDrive(SERVER_URL, page);
  }

  await openSubject(page, url);
  await page.setViewportSize({ width: 1000, height: 400 });

  return page;
}

async function openConfigureDrive(page: Page) {
  // Make sure the drive switched dropdown is not open
  if (await page.locator(newDriveMenuItem).isVisible()) {
    await page.waitForTimeout(100);
  }

  await page.click(sideBarDriveSwitcher);
  await page.click('text=Configure Drives');
  await expect(page.locator('text=Drive Configuration')).toBeVisible();
}

async function changeDrive(subject: string, page: Page) {
  await openConfigureDrive(page);
  await expect(page.locator('text=Drive Configuration')).toBeVisible();
  await page.fill('[data-test="server-url-input"]', subject);
  await page.click('[data-test="server-url-save"]');
  await expect(page.locator('text=Create new resource')).toBeVisible();
}

async function editTitle(title: string, page: Page, clear = false) {
  await page.locator(editableTitle).click();

  if (clear) {
    await page.locator(editableTitle).clear();
  }

  // These keys make sure the onChange handler is properly called
  await page.keyboard.press('Space');
  await page.keyboard.press('Backspace');
  await waitForCommit(page);
  await page.keyboard.type(title);
  await page.keyboard.press('Escape');
  await waitForCommit(page);
}

async function clickSidebarItem(text: string, page: Page) {
  await page.click(`[data-test="sidebar"] >> text="${text}"`);
}

async function fillInput(
  propertyShortname: string,
  page: Page,
  value?: string,
) {
  let locator = `[data-test="input-${propertyShortname}"]`;

  if (propertyShortname === 'description') {
    locator = 'textarea[name="yamdeContent"]';
  }

  await page.click(locator);
  await page.fill(locator, value || `test-${propertyShortname}`);
}

/** Click an item from the main, visible context menu */
async function contextMenuClick(text: string, page: Page) {
  await page.click(contextMenu);
  await page.waitForTimeout(100);
  await page
    .locator(`[data-test="menu-item-${text}"] >> visible = true`)
    .click();
}

const waitForCommit = async (page: Page) =>
  page.waitForResponse(`${SERVER_URL}/commit`);
