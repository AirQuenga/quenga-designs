-- Create community_services table for Butte County community resources
create table if not exists public.community_services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null, -- e.g., 'mental_health', 'food_bank', 'legal_aid', 'job_training', 'housing_support'
  description text,
  address text,
  phone_number text,
  website text,
  email text,
  service_area text, -- e.g., 'Chico', 'Paradise', 'Magalia', 'Butte County'
  hours text, -- e.g., 'Mon-Fri 9AM-5PM'
  is_accessible boolean default false,
  accepts_walk_ins boolean default false,
  requires_appointment boolean default false,
  languages text[], -- array of language codes, e.g., ['en', 'es']
  tags text[], -- searchable tags, e.g., ['mental health', 'crisis support']
  contact_person text,
  cost_per_service text, -- e.g., 'Free', '$10-20', 'Sliding scale'
  notes text,
  data_source text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.community_services enable row level security;

-- Policy: Everyone can view services
create policy "Services are viewable by everyone"
  on public.community_services for select
  using (true);

-- Policy: Allow inserts (for admin imports)
create policy "Allow insert for all"
  on public.community_services for insert
  with check (true);

-- Policy: Allow updates (for admin edits)
create policy "Allow update for all"
  on public.community_services for update
  using (true);

-- Create index on category for faster filtering
create index if not exists idx_community_services_category on public.community_services(category);

-- Create index on service_area for filtering by location
create index if not exists idx_community_services_service_area on public.community_services(service_area);

-- Create GIN index on tags for fast array queries
create index if not exists idx_community_services_tags on public.community_services using gin(tags);

-- Create updated_at trigger
create or replace function update_community_services_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger community_services_updated_at
before update on public.community_services
for each row
execute function update_community_services_timestamp();
