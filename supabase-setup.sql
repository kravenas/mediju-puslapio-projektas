-- ============================================
-- ARTIFEX - Supabase Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. CREATE TABLES
-- ============================================

-- Categories
create table categories (
  id bigint generated always as identity primary key,
  name text not null,
  emoji text,
  slug text unique not null
);

-- Creators
create table creators (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  name text not null,
  role text not null,
  location text,
  bio text,
  price_from integer default 0,
  price_label text,
  rating numeric(2,1) default 0,
  review_count integer default 0,
  image_url text,
  is_rising_star boolean default false,
  portfolio_current integer default 0,
  portfolio_target integer default 10,
  looking_for text[],
  created_at timestamptz default now()
);

-- Creator-Category junction
create table creator_categories (
  creator_id uuid references creators(id) on delete cascade,
  category_id bigint references categories(id) on delete cascade,
  primary key (creator_id, category_id)
);

-- Reviews
create table reviews (
  id bigint generated always as identity primary key,
  creator_id uuid references creators(id) on delete cascade,
  author_name text not null,
  author_location text,
  rating integer check (rating between 1 and 5),
  content text,
  created_at timestamptz default now()
);

-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================

alter table categories enable row level security;
alter table creators enable row level security;
alter table creator_categories enable row level security;
alter table reviews enable row level security;

-- 3. CREATE PUBLIC READ POLICIES
-- ============================================

create policy "Anyone can view categories"
  on categories for select
  using (true);

create policy "Anyone can view creators"
  on creators for select
  using (true);

create policy "Anyone can view creator_categories"
  on creator_categories for select
  using (true);

create policy "Anyone can view reviews"
  on reviews for select
  using (true);

-- 4. SEED DATA - Categories
-- ============================================

insert into categories (name, emoji, slug) values
  ('Vestuvės', '💍', 'vestuves'),
  ('Corporate', '🏢', 'corporate'),
  ('Produktai', '📦', 'produktai'),
  ('Maistas', '🍔', 'maistas'),
  ('Video', '🎥', 'video'),
  ('Nekilnojamas Turtas', '🏠', 'nekilnojamas-turtas'),
  ('Portretai', '👨‍👩‍👧', 'portretai'),
  ('Dronas', '🚁', 'dronas');

-- 5. SEED DATA - Professional Creators
-- ============================================

insert into creators (name, role, location, bio, price_from, price_label, rating, review_count, image_url, is_rising_star) values
  ('Jonas Kazlauskas', 'Fotografas', 'Vilnius', 'Profesionalus fotografas su 10+ metų patirtimi. Specializuojuosi vestuvių ir portretų fotografijoje.', 150, 'Nuo €150', 4.9, 127, 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&h=400&fit=crop', false),
  ('Ieva Petraitė', 'Videografė', 'Kaunas', 'Kinu kokybės videografija vestuvėms, eventams ir korporatyviniams projektams.', 300, 'Nuo €300', 5.0, 89, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=400&fit=crop', false),
  ('Karolis Venckus', 'Video montuotojas', 'Kaunas', 'Greitai ir kokybiškai montuoju video projektus. Premiere Pro, DaVinci Resolve, After Effects.', 50, 'Nuo €50', 4.8, 134, 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&h=400&fit=crop', false),
  ('Rūta Kazlauskienė', 'Grafikos dizainerė', 'Vilnius', 'Kuriu vizualinę tapatybę, logotipus, pakuočių dizainą ir socialinių tinklų turinį.', 60, 'Nuo €60', 4.9, 189, 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&h=400&fit=crop', false),
  ('Vytautas Mockus', 'Motion designer', 'Vilnius', 'Animacija ir motion graphics reklaminiam ir korporatyviniam turiniui.', 90, 'Nuo €90', 4.8, 78, 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop', false),
  ('Eglė Mockutė', 'UI/UX dizainerė', 'Vilnius', 'Kuriu naudotojams draugiškas sąsajas svetainėms ir programėlėms. Figma, Sketch.', 80, 'Nuo €80', 5.0, 92, 'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=600&h=400&fit=crop', false);

-- 6. SEED DATA - Rising Stars
-- ============================================

insert into creators (name, role, location, bio, price_from, price_label, rating, review_count, image_url, is_rising_star, portfolio_current, portfolio_target, looking_for) values
  ('Simona Kazlauskaitė', 'Fotografė', 'Vilnius', 'Studijuoju fotografiją VDA. Ieškau vestuvių ir portretų projektų portfolio kūrimui.', 0, 'Nemokamai', 4.8, 3, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=400&fit=crop', true, 3, 10, ARRAY['vestuvės', 'portretai']),
  ('Matas Jankauskas', 'Videografas', 'Kaunas', 'Turiu profesionalią įrangą (Sony A7III). Kuriu trumpus promo video ir eventų coverage.', 30, '~€30', 5.0, 5, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=400&fit=crop', true, 5, 10, ARRAY['promo video', 'eventai']),
  ('Gabrielė Mockutė', 'Fotografė', 'Vilnius', 'Specializuojuosi produktų ir maisto fotografijoje. Turiu mini studiją namuose.', 0, 'Nemokamai', 4.9, 7, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=400&fit=crop', true, 7, 10, ARRAY['produktai', 'maistas']);

-- 7. SEED DATA - Creator-Category associations
-- ============================================

-- Jonas Kazlauskas -> Vestuvės, Portretai
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Jonas Kazlauskas' and cat.slug in ('vestuves', 'portretai');

-- Ieva Petraitė -> Vestuvės, Video, Corporate
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Ieva Petraitė' and cat.slug in ('vestuves', 'video', 'corporate');

-- Karolis Venckus -> Video, Corporate
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Karolis Venckus' and cat.slug in ('video', 'corporate');

-- Rūta Kazlauskienė -> Corporate, Produktai
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Rūta Kazlauskienė' and cat.slug in ('corporate', 'produktai');

-- Vytautas Mockus -> Video, Corporate
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Vytautas Mockus' and cat.slug in ('video', 'corporate');

-- Eglė Mockutė -> Corporate
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Eglė Mockutė' and cat.slug = 'corporate';

-- Simona Kazlauskaitė -> Vestuvės, Portretai
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Simona Kazlauskaitė' and cat.slug in ('vestuves', 'portretai');

-- Matas Jankauskas -> Video
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Matas Jankauskas' and cat.slug = 'video';

-- Gabrielė Mockutė -> Produktai, Maistas
insert into creator_categories (creator_id, category_id)
select c.id, cat.id from creators c, categories cat
where c.name = 'Gabrielė Mockutė' and cat.slug in ('produktai', 'maistas');

-- 8. SEED DATA - Reviews
-- ============================================

insert into reviews (creator_id, author_name, author_location, rating, content)
select c.id, 'Laura M.', 'Vilnius', 5, 'Per 3 valandas gavau 5 pasiūlymus vestuvėms. Fotografas kurį pasirinkau buvo nuostabus – profesionalus ir draugiškas.'
from creators c where c.name = 'Jonas Kazlauskas';

insert into reviews (creator_id, author_name, author_location, rating, content)
select c.id, 'Tomas K.', 'Kaunas', 5, 'Mūsų startupo produktų foto reikėjo skubiai. Kylančios Žvaigždės skiltyje radau talentą, kainavo tik 50€. Rezultatas – įspūdingas!'
from creators c where c.name = 'Gabrielė Mockutė';

insert into reviews (creator_id, author_name, author_location, rating, content)
select c.id, 'Rita P.', 'Klaipėda', 5, 'Ieškojau 2 savaites kitur. Artifex per dieną suorganizavo viską. Corporate video + foto paketas. Greita, profesionalu.'
from creators c where c.name = 'Ieva Petraitė';
