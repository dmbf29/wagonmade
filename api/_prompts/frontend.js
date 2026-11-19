export default `
FRONT-END CONSISTENCY: Bootstrap 5 only, SCSS structure, color/font variables, Le Wagon components, simple_form, Font Awesome, one consistent look across pages.

Look for:
- Bootstrap 5 classes only. Tailwind classes, Bootstrap 3/4 classes (ml-*, mr-*, form-group, badge-*, data-toggle…) or a second CSS framework are mismatches.
- SCSS structure: each component in components/_name.scss imported in components/_index.scss; page styles in pages/; colors only as variables from config/_colors.scss; fonts only via config/_fonts.scss variables; no stray .css files; little !important; no <style> tags or lots of inline styles in views.
- Reuse of the Le Wagon UI kit (.banner, .card-category, .card-product, .avatar, navbar, alerts, .cards grid) is a win.
- Forms with simple_form_for / f.input / f.association, not form_with or hand-written HTML inputs.
- Icons from font-awesome-sass (fa-solid fa-…), not a CDN.
- Visual consistency across pages: do views use the same containers, spacing helpers, button styles, card markup? Do similar things look the same?
- In pull-request mode: does the PR use the colors, fonts and components the app already defines (see config/_colors.scss, _fonts.scss and components/)?
Do not judge visual taste, only consistency with the course stack and with the rest of their app.
`.trim()
