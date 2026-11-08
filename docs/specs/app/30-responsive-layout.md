# Responsive Layout

## Requirements
- Use the same Expo React Native screens in browser and Android. Keep platform session and storage adapters.
- Automatic desktop layout requires available width at least 1024 and the shorter available dimension at least 600 logical pixels. Existing manual phone and PC preferences remain explicit overrides.
- Restore Japanese ink and sakura colors, desktop top navigation, dashboard columns and phone bottom tabs. Restore Certificate midnight and orange colors, desktop rail and phone bottom tabs. Give English a distinct ink and mint identity, responsive dashboard, progress cards and compact navigation.
- Keep navigation, account actions, study, quizzes, source writes and saved progress functional. Rotation and window resizing must not reset study state.
- Background colors cover the viewport and scrolling content without a repeating gradient or visible rectangular seam.
- Design: [Responsive Layout](../../design/app/30-responsive-layout.md)

## Example
- Input: A tablet with 1280 by 800 available logical pixels and a phone with 915 by 412.
- Steps: Open home, then rotate or resize the available window.
- Expected result: The tablet uses desktop layout, the landscape phone stays compact, and the active tab and study state survive resizing.
