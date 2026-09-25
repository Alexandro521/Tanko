CREATE TABLE IF NOT EXISTS mangainfo(
id text PRIMARY KEY NOT NULL,
title text NOT NULL,
status text DEFAULT "reading",
anilist_id integer,
mal_id integer,
create_at date DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS  userlists(
id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
name text UNIQUE NOT NULL,
visibility text DEFAULT "public",
create_at datetime DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS userlistlink(
id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
userlist_id integer NOT NULL,
mangainfo_id text NOT NULL,
alias text,
reference_type text DEFAULT "manga",
added_at datetime DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(userlist_id) REFERENCES USERLISTS(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE,
FOREIGN KEY(mangainfo_id) REFERENCES MANGAINFO(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE,
CONSTRAINT unique_entry UNIQUE (userlist_id, mangainfo_id)
);

CREATE INDEX IF NOT EXISTS userlist_index ON userlistlink(userlist_id);
CREATE INDEX IF NOT EXISTS mangainfo_index ON userlistlink(mangainfo_id);

CREATE TABLE IF NOT EXISTS sessiontracker (
id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
date date NOT NULL DEFAULT CURRENT_DATE,
start_time time NOT NULL DEFAULT CURRENT_TIME,
end_time time DEFAULT CURRENT_TIME,
enlapsed_time time,
pages_read_count integer DEFAULT 0,
mangainfo_id text NOT NULL,
FOREIGN KEY(mangainfo_id) REFERENCES MANGAINFO(id)
ON DELETE SET NULL
ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS track_mangainfo_index ON sessiontracker(mangainfo_id);

CREATE TABLE IF NOT EXISTS read_history(
id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
pages_read integer NOT NULL,
page_index integer NOT NULL,
chapter_index integer NOT NULL,
sort_order text NOT NULL DEFAULT "desc",
lang_iso text NOT NULL,
read_progress float NOT NULL,
read_time time NOT NULL DEFAULT CURRENT_TIME,
read_date date NOT NULL DEFAULT CURRENT_DATE,
chapter_src text NOT NULL,
manga_provider text NOT NULL,
chapter_title text NOT NULL,
mangainfo_id text NOT NULL,
FOREIGN key(mangainfo_id) REFERENCES mangainfo(id)
ON UPDATE CASCADE 
ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS history_mangainfo_index ON read_history(mangainfo_id);