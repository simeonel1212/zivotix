-- Create the public bucket for event cover images
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;

-- Anyone can view cover images (bucket is public, but RLS still gates the API)
create policy "event_covers_public_read"
on storage.objects for select
to public
using (bucket_id = 'event-covers');

-- Logged-in users can upload into their own folder (path starts with their user id)
create policy "event_covers_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Logged-in users can replace/delete only their own files
create policy "event_covers_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'event-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "event_covers_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);
