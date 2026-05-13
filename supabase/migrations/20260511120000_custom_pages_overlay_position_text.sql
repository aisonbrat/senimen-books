-- CRITICAL: overlay UI persists "vertical:bgType" (e.g. bottom:gradient).
-- Base schema used enum photo_overlay_position (top|center|bottom only) → Postgres rejected updates → console errors.
-- Also ensure photo_dpi exists for the transparency slider.

alter table custom_pages add column if not exists photo_dpi int default 60;

alter table custom_pages
  alter column overlay_position drop default;

alter table custom_pages
  alter column overlay_position type text using (
    case
      when overlay_position is null then 'bottom:gradient'
      when overlay_position::text like '%:%' then overlay_position::text
      else overlay_position::text || ':gradient'
    end
  );

alter table custom_pages
  alter column overlay_position set default 'bottom:gradient';

comment on column custom_pages.overlay_position is 'Composite vertical:bg — top|center|bottom plus none|gradient|solid';
comment on column custom_pages.photo_dpi is 'Overlay layer opacity 0–100 for photo pages';
