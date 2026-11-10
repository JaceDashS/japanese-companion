# Responsive Layout Scenarios

- Design: [Responsive Layout](../../../design/app/30-responsive-layout.md)

## Automatic Layout Boundary
- Input: Portrait phone 390x844, landscape phones 915x412 and 1280x450, tablet 1280x800, portrait tablet 800x1280, desktop 1440x900, boundary 1024x600, nearby 1023x800 and 1024x599.
- Steps: Evaluate automatic layout using available logical dimensions.
- Expected result: Desktop only for 1280x800, 1440x900 and 1024x600; all others compact.
- Test: `mobile/tests/study.test.ts` responsive layout excludes landscape phones but admits wide tablets and desktop windows.

## Manual Preference
- Input: Phone preference on a large window, PC preference on a small window.
- Steps: Evaluate the explicit preference with the same layout policy.
- Expected result: Manual preferences override automatic detection where the product exposes the setting.
- Test: The same boundary regression verifies explicit policy overrides.

## Former UI Parity
- Input: The former web build (8fa4351 parent) and the current web export, both against the same local synthetic API and JLPT N1 data.
- Steps: Capture home, Day, settings, study, quiz, word data sheet, login and the light theme at 1440x900 and 390x844, and compare them side by side.
- Expected result: Layout, colors, sizes and parts match; native controls may differ. Mobile book selection uses a dropdown, PC keeps its previous segments, and text date fields remain in place of date pickers.
- Observed 2026-11-09: All listed screens matched. Gaps found during the comparison were fixed: note text size and table cells, raw `<br>` in tables, full-width quiz buttons and account value size.

## Resize And Study
- Input: An authenticated test account with sample content, desktop and compact viewports.
- Steps: Navigate home and settings, begin study, resize or rotate, use the existing quiz and return controls, and scroll to the bottom.
- Expected result: State remains intact, desktop columns and compact tabs stay usable, text is readable, no horizontal page overflow or background seams appear, and account and study actions retain their existing API behavior.
- Observed 2026-11-09 in Chrome with local synthetic API data: desktop top navigation and dashboard columns, compact header and bottom tabs at 390x844 and 915x412, desktop at 1280x800, Day grid navigation and account settings. Day 1 study remained active when resized from tablet to landscape phone; the desktop item panel disappeared and page width matched viewport width. The restored dark screen was visually inspected. Web and Android JavaScript exports passed, along with 19 regressions and type checking.
- Limit: Synthetic browser responses do not verify production persistence. Android JavaScript exports do not establish APK or physical-device behavior.

## Mobile Book Dropdown
- Input: Two book options at 390x844, a long selected title and the existing desktop HomeScreen.
- Steps: Change the mobile dropdown, inspect width, then inspect the desktop render branch.
- Expected result: Mobile selection invokes the existing switchBook callback, remains disabled during the operation and reports failures. Today, Day and progress share the selector. Desktop keeps the existing multiple-book Segment without a dropdown.
- Verified 2026-11-10: The actual BookSelect component changed JLPT N1 to JLPT N2 in a local synthetic browser harness. Its mobile width stayed within 390 pixels. Desktop branch preservation was checked in the HomeScreen diff. Production persistence and physical Android interaction were not exercised.
- Validation: Type checking, 19 existing regressions and web and Android JavaScript exports passed. Android export required running outside the Windows sandbox after Hermes compilation failed within it; no code change was needed for that retry.

## Themed Browser Controls
- Input: Actual BookSelect and BrowserTheme components in a local browser harness, both product palettes and dark and light schemes.
- Steps: Read select arrow position and padding, switch the theme, and inspect computed scrollbar colors on an overflowing nested panel.
- Expected result: Chevron position is right 14px center, right padding is 40px, and the thumb and track use the active dim and panel tokens. Color scheme changes with the theme; select interaction remains native and desktop composition is unchanged.
- Verified 2026-11-10: Both products' dark and light computed scrollbar colors matched their palette, with the expected arrow position and padding. Type checks passed. Operating-system popup appearance and physical Android rendering were not validated.
