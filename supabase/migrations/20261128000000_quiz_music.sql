-- Background music per quiz (questions carry their own optional audioUrl inside the jsonb).
alter table public.quizzes add column if not exists music_url text;

-- The media bucket now also takes .mp3 files (up to 8MB). Images stay capped at 5MB client-side.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg'],
    file_size_limit = 8388608
where id = 'quiz-images';
