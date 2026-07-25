-- Organizers can currently insert event_staff rows fine, but couldn't SEE
-- the staff member's name/email afterward: the profiles table only allowed
-- users to read their own row (or admins to read all), so the embedded
-- `profiles(email, full_name)` join in the staff list silently dropped
-- every row it couldn't join, making it look like nothing was added.
-- This lets an organizer read the profile of anyone registered as their
-- own door staff.
create policy "profiles_visible_to_employing_organizer" on profiles for select using (
  exists (
    select 1 from event_staff es
    join organizers o on o.id = es.organizer_id
    where es.profile_id = profiles.id and o.profile_id = auth.uid()
  )
);
