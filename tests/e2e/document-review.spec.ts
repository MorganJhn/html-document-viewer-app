import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const workspacePath = path.resolve('tests/fixtures/workspace')
const statePath = path.resolve('tests/fixtures/state')
const documentPath = path.join(workspacePath, 'sample.html')
const secondDocumentPath = path.join(workspacePath, 'second.html')

test.beforeEach(async () => {
  await fs.rm(workspacePath, { recursive: true, force: true })
  await fs.rm(statePath, { recursive: true, force: true })
  await fs.mkdir(workspacePath, { recursive: true })
  await fs.writeFile(
    documentPath,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fixture</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    main { min-height: 260mm; break-after: page; }
    h1 { font-size: 44px; color: #10233f; }
  </style>
</head>
<body>
  <main data-component="Cover">
    <h1 data-component="Headline">Original headline</h1>
    <p data-component="Summary">Original summary</p>
  </main>
  <section data-component="Second page">
    <h2>Page two</h2>
  </section>
</body>
</html>`,
    'utf8',
  )
  await fs.writeFile(
    secondDocumentPath,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Second fixture</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    section { min-height: 220mm; }
    .target { padding: 24px; border: 1px solid #ccd4df; }
  </style>
</head>
<body>
  <section data-component="Target page">
    <p class="target" data-component="Insertion target">Drop reusable components here.</p>
  </section>
</body>
</html>`,
    'utf8',
  )
})

test('selects, edits, saves, and exports a document', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'sample.html sample.html' })).toBeVisible()

  const frame = page.frameLocator('iframe[title="Document preview"]')
  await expect(frame.locator('[data-component="Headline"]').first()).toContainText('Original headline')
  await frame.locator('[data-component="Headline"]').first().click()

  await expect(page.getByText('Headline').first()).toBeVisible()
  await expect(page.locator('.selection-popover code')).toContainText('HDV_REF file="sample.html"')
  await expect(page.locator('.selection-popover code')).toContainText('component="Headline"')
  await page.locator('.inspector textarea').fill('Edited headline')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Saved').last()).toBeVisible()
  await expect(frame.locator('[data-component="Headline"]').first()).toContainText('Edited headline')

  await page.getByTitle('Export HTML').click()
  await expect(page.getByText(/HTML export:/)).toBeVisible()

  await page.getByTitle('Export PDF').click()
  await expect(page.getByText(/PDF export:/)).toBeVisible()

  const savedSource = await fs.readFile(documentPath, 'utf8')
  expect(savedSource).toContain('Edited headline')
})

test('saves selected HTML as a component and inserts it into another document', async ({ page }) => {
  await page.goto('/')

  const frame = page.frameLocator('iframe[title="Document preview"]')
  await frame.locator('[data-component="Headline"]').first().click()

  await page.getByRole('tab', { name: 'Component library' }).click()
  await page.getByLabel('Component name').fill('Reusable headline')
  await page.getByRole('button', { name: 'Save as component' }).click()
  await expect(page.getByText('Component saved.')).toBeVisible()

  await page.getByRole('button', { name: 'second.html second.html' }).click()
  await expect(frame.locator('[data-component="Insertion target"]').first()).toContainText('Drop reusable components here.')
  await frame.locator('[data-component="Insertion target"]').first().click()

  await page.getByRole('tab', { name: 'Component library' }).click()
  const libraryCard = page.locator('.component-card', { hasText: 'Reusable headline' })
  await expect(libraryCard).toBeVisible()
  await libraryCard.click()
  await page.getByRole('button', { name: 'Insert component' }).click()
  await expect(page.getByText('Component inserted.')).toBeVisible()

  const targetSource = await fs.readFile(secondDocumentPath, 'utf8')
  expect(targetSource).toContain('Reusable headline')
  expect(targetSource).toContain('Original headline')
})

test('creates a new document via the New Document modal and generates prompt', async ({ page }) => {
  await page.goto('/')

  // Open modal
  await page.getByTitle('New Document').click()
  await expect(page.getByText('New Document Prompt Builder')).toBeVisible()

  // Fill in fields
  await page.getByLabel('Document Name').fill('created-via-modal.html')
  await page.getByLabel('Document Type').selectOption('slides')
  await page.getByLabel('Instructions for AI Agent').fill('Design some nice sales slides for my company')

  // Generate & Create
  await page.getByRole('button', { name: 'Generate & Create Document' }).click()

  // Verify success screen
  await expect(page.getByText('✓ Document created in workspace!')).toBeVisible()
  const textarea = page.locator('textarea[readonly]')
  await expect(textarea).toBeVisible()
  await expect(textarea).toContainText('You are Antigravity')
  await expect(textarea).toContainText('created-via-modal.html')
  await expect(textarea).toContainText('Design some nice sales slides for my company')

  // Copy prompt
  await page.getByRole('button', { name: 'Copy' }).click()
  // Close modal
  await page.getByRole('button', { name: 'Go to Document Editor' }).click()
  await expect(page.getByText('New Document Prompt Builder')).not.toBeVisible()

  // Verify new document is loaded in sidebar
  await expect(page.getByRole('button', { name: 'created-via-modal.html created-via-modal.html' })).toBeVisible()

  // Check if file is written to workspace
  const newFilePath = path.join(workspacePath, 'created-via-modal.html')
  const content = await fs.readFile(newFilePath, 'utf8')
  expect(content).toContain('created-via-modal')
  expect(content).toContain('data-hdv-document-settings')
})

test('saves multiple selected elements as a grouped component in the library', async ({ page }) => {
  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()))
  await page.goto('/')

  const frame = page.frameLocator('iframe[title="Document preview"]')
  // Click first element
  await frame.locator('[data-component="Headline"]').first().click()
  // Shift+Click second element to multi-select
  await frame.locator('[data-component="Summary"]').first().click({ modifiers: ['Shift'] })

  // Right-click the second element to open element context menu
  await frame.locator('[data-component="Summary"]').first().click({ button: 'right' })

  // Context menu should offer Grouped save option
  const groupedOption = page.getByText('Save as Component (Grouped)...')
  await expect(groupedOption).toBeVisible()
  await groupedOption.click()

  // Enter grouped template name in prompt
  await page.locator('.modal-prompt-input').fill('My Grouped Card')
  await page.locator('.modal-actions button', { hasText: 'Save' }).click()

  // Verify component is saved
  await expect(page.getByText('Component saved.')).toBeVisible()

  // Check component library tab to see if it is listed
  await page.getByRole('tab', { name: 'Component library' }).click()
  await expect(page.locator('.component-card', { hasText: 'My Grouped Card' })).toBeVisible()

  // Verify the saved template file actually contains both components in its HTML
  const templatePath = path.join(workspacePath, '_hdv', 'templates')
  const files = await fs.readdir(templatePath)
  let foundGroup = false
  for (const file of files) {
    const raw = await fs.readFile(path.join(templatePath, file), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed.name === 'My Grouped Card') {
      expect(parsed.html).toContain('Original headline')
      expect(parsed.html).toContain('Original summary')
      foundGroup = true
      break
    }
  }
  expect(foundGroup).toBe(true)
})


