# Orgânia Design System

## Design Tokens
- **Colors**: `--brand`, `--bg`, `--surface`, `--text`, `--muted`, `--success`, `--warning`, `--error`.
- **Spacing**: `--space-0` .. `--space-10` (0–80px).
- **Radius**: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`.
- **Typography**: sans-serif stack with sizes `--fs-xs` .. `--fs-4xl`.

## Components
- **Buttons**: `.btn--primary`, `.btn--secondary`, `.btn--ghost`, `.btn--danger`.
- **Inputs**: `.input` plus semantic `<label>`.
- **Cards**: `.card` for generic containers, `.card--kpi` with `.kpi-value` and `.kpi-change`.
- **Badges**: `.badge`, status modifiers `.badge--success`, `.badge--warning`, `.badge--error`.
- **Table**: `.table` inside `.table-responsive` for horizontal scroll on small screens.
- **Tabs**: `.tabs` + `.tab-panels`.
- **Accordion**: `.accordion` with `[data-open]` sections.
- **Modal**: `.modal` with `.modal__content`.
- **Toast**: `showToast('Mensagem')`.

## Layout helpers
- `.container` centers content.
- `.grid` 12-column layout, stacks to single column below 768px.
- `.stack-4` etc for vertical rhythm.
- `.cluster` for horizontal grouping.

## QA Checklist
- Contraste AA para texto e ícones.
- Dark mode e toggle funcionando.
- Responsividade em 360x640, 768x1024 e ≥1280.
- Navegação completa via teclado com foco visível.
- Estados de loading, vazio e erro cobertos.