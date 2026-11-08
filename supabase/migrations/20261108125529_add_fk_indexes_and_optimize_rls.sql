-- ALMORA: add indexes for unindexed foreign keys and cache auth.uid() in RLS policies.
-- These changes preserve authorization logic while reducing row-by-row policy evaluation.

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id_fk ON public.announcement_reads USING btree (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by_fk ON public.announcements USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id_fk ON public.audit_log USING btree (actor_id);
CREATE INDEX IF NOT EXISTS idx_chapter_notifications_chapter_id_fk ON public.chapter_notifications USING btree (chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_notifications_work_id_fk ON public.chapter_notifications USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_chapter_reactions_chapter_id_fk ON public.chapter_reactions USING btree (chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_releases_created_by_fk ON public.chapter_releases USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_comments_chapter_id_fk ON public.comments USING btree (chapter_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id_fk ON public.comments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_work_id_fk ON public.favorites USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_follow_notifications_follower_id_fk ON public.follow_notifications USING btree (follower_id);
CREATE INDEX IF NOT EXISTS idx_library_work_id_fk ON public.library USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_page_bookmarks_work_id_fk ON public.page_bookmarks USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_progress_chapter_id_fk ON public.progress USING btree (chapter_id);
CREATE INDEX IF NOT EXISTS idx_progress_work_id_fk ON public.progress USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_ratings_work_id_fk ON public.ratings USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_reading_activity_chapter_id_fk ON public.reading_activity USING btree (chapter_id);
CREATE INDEX IF NOT EXISTS idx_reading_activity_work_id_fk ON public.reading_activity USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_chapter_id_fk ON public.reading_progress USING btree (chapter_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_work_id_fk ON public.reading_progress USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_reports_comment_id_fk ON public.reports USING btree (comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id_fk ON public.reports USING btree (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_work_id_fk ON public.reports USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_assigned_by_fk ON public.staff_roles USING btree (assigned_by);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id_fk ON public.user_achievements USING btree (achievement_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_work_id_fk ON public.wishlists USING btree (work_id);
CREATE INDEX IF NOT EXISTS idx_works_created_by_fk ON public.works USING btree (created_by);

-- Supabase recommends wrapping stable auth helpers in SELECT so PostgreSQL can
-- evaluate them once per statement instead of once per candidate row.
ALTER POLICY "chapter_notifications_delete_own" ON public."chapter_notifications" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "chapter_notifications_select_own" ON public."chapter_notifications" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "chapter_notifications_update_own" ON public."chapter_notifications" USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "chapter_reactions_delete_own" ON public."chapter_reactions" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "chapter_reactions_insert_own" ON public."chapter_reactions" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM chapters c
  WHERE ((c.id = chapter_reactions.chapter_id) AND (c.status = 'published'::text) AND can_read_work(c.work_id))))));
ALTER POLICY "chapter_reactions_update_own" ON public."chapter_reactions" USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM chapters c
  WHERE ((c.id = chapter_reactions.chapter_id) AND (c.status = 'published'::text) AND can_read_work(c.work_id))))));
ALTER POLICY "chapter_releases_staff_insert" ON public."chapter_releases" WITH CHECK ((is_staff() AND ((created_by IS NULL) OR (created_by = ( SELECT auth.uid() AS uid)))));
ALTER POLICY "favorites_delete_own" ON public."favorites" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "favorites_insert_own" ON public."favorites" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND can_read_work(work_id)));
ALTER POLICY "favorites_select_own" ON public."favorites" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "profile_privacy_insert_own" ON public."profile_privacy" WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "profile_privacy_update_own" ON public."profile_privacy" USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reader_preferences_delete_own" ON public."reader_preferences" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reader_preferences_insert_own" ON public."reader_preferences" WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reader_preferences_select_own" ON public."reader_preferences" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reader_preferences_update_own" ON public."reader_preferences" USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reading_activity_delete_own" ON public."reading_activity" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reading_activity_select_own" ON public."reading_activity" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reading_days_select_own" ON public."reading_days" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reading_progress_delete_own" ON public."reading_progress" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "reading_progress_select_own" ON public."reading_progress" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "wishlist_delete" ON public."wishlists" USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "wishlist_insert" ON public."wishlists" WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "wishlist_read" ON public."wishlists" USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_wishlist_public(user_id)));
