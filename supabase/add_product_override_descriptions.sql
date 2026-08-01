-- Let admin edit a product's descriptions, not just its name and price.
--
-- Add Product has always taken a short description and a full one; Edit could
-- not touch either, so the text explaining what is in a product could only be
-- set once, at creation, and never corrected. For catalog products shipped in
-- code there was no way to set it from the admin at all.
--
-- Same rule as every other column here: null falls back to the catalog value,
-- so an untouched product keeps the copy it ships with.
alter table public.product_overrides
  add column if not exists excerpt text,
  add column if not exists description text;
