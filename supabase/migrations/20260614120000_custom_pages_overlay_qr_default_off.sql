-- New custom pages: overlay/QR off in the book until the editor opts in.
alter table custom_pages alter column overlay_in_book set default false;
alter table custom_pages alter column qr_in_book set default false;
