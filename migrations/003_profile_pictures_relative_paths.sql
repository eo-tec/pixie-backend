-- Migration: Convert profile picture URLs to relative paths
-- Before: "bucket.frame64.fun/photos/profile-pictures/1-1234567890.jpg"
-- After:  "profile-pictures/1-1234567890.jpg"

UPDATE users
SET picture = regexp_replace(picture, '^(https?://)?[^/]+/photos/', '')
WHERE picture IS NOT NULL
  AND picture LIKE '%profile-pictures/%'
  AND picture LIKE '%/%/%';  -- only match full URLs, not already-relative paths
