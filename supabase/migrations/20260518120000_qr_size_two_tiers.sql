-- Collapse legacy three QR sizes into two (lg = smaller tier, xl = larger tier).
-- Former largest code was `lg`; new schema uses `lg` for the smaller tier and `xl` for the larger,
-- so migrate old `lg` rows to `xl` first, then fold sm/md into `lg`.
update custom_pages set qr_size = 'xl' where qr_size = 'lg';
update custom_pages set qr_size = 'lg' where qr_size in ('sm', 'md');

alter table custom_pages alter column qr_size set default 'lg';

comment on column custom_pages.qr_size is 'QR placement box: lg | xl (mm from QR_SIZE_MM)';
