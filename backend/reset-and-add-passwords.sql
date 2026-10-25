-- !!! THIS DELETES ALL DATA: every player, every personal top-10 score and every leaderboard entry. !!!
-- Run it once, by hand, against the existing database before deploying the password version of the API.
-- Existing players have no password, so they cannot be kept; they sign up again after this.
-- Safe to run again (it just empties the tables again).

-- Truncating players cascades to scores_* and leaderboard_*, because they reference it.
truncate players restart identity cascade;

-- The table is empty now, so a NOT NULL column with no default can be added.
alter table players add column if not exists password_hash text not null;
