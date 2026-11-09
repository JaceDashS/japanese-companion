# Responsive Layout

## Requirements
- Use the same Expo React Native screens in browser and Android. Keep platform session and storage adapters.
- Automatic desktop layout requires available width at least 1024 and the shorter available dimension at least 600 logical pixels. Existing manual phone and PC preferences remain explicit overrides.
- Restore Japanese ink and sakura colors, desktop top navigation, dashboard columns and phone bottom tabs. The other products follow their own repositories.
- Rebuild the former web parts, not only the colors: stat tiles, chips, tinted Day cards, Day tiles, queue actions, the session top and bottom bars, numbered choices, verdicts, item tiles, sheets, switches, segments and the login card. Browser and Android use the same parts.
- Keep navigation, account actions, study, quizzes, source writes and saved progress functional. Rotation and window resizing must not reset study state.
- Background colors cover the viewport and scrolling content without a repeating gradient or visible rectangular seam.
- Mobile forms show a labelled book dropdown above today, Day and progress content, including when only one book exists. Desktop keeps its existing segmented book selector and layout.
- Design: [Responsive Layout](../../design/app/30-responsive-layout.md)

## Example
- Input: A tablet with 1280 by 800 available logical pixels and a phone with 915 by 412.
- Steps: Open home, then rotate or resize the available window.
- Expected result: The tablet uses desktop layout, the landscape phone stays compact, and the active tab and study state survive resizing.
