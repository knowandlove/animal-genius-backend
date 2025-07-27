CREATE TABLE "class_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'viewer' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"invited_by" uuid NOT NULL,
	"invitation_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"invitation_token" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "class_collaborators_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE "class_values_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"cluster_number" integer NOT NULL,
	"value_code" varchar(50) NOT NULL,
	"value_name" varchar(100) NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "class_values_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"started_by" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '24 hours',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "class_values_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"cluster_number" integer NOT NULL,
	"value_code" varchar(50) NOT NULL,
	"value_name" varchar(100) NOT NULL,
	"vote_rank" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discussion_tags" (
	"discussion_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discussions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"battery_level" integer,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"discussion_id" uuid,
	"reply_id" uuid,
	"type" varchar(20) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lesson_activity_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_progress_id" uuid NOT NULL,
	"activity_number" integer NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"lesson_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'not_started' NOT NULL,
	"current_activity" integer DEFAULT 1,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"surface_type" varchar(50) NOT NULL,
	"pattern_type" varchar(20) DEFAULT 'css' NOT NULL,
	"pattern_value" text NOT NULL,
	"theme" varchar(100),
	"thumbnail_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "patterns_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "pet_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_pet_id" uuid NOT NULL,
	"interaction_type" varchar(50) NOT NULL,
	"hunger_before" integer NOT NULL,
	"happiness_before" integer NOT NULL,
	"hunger_after" integer NOT NULL,
	"happiness_after" integer NOT NULL,
	"coins_cost" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"asset_url" text NOT NULL,
	"cost" integer DEFAULT 100 NOT NULL,
	"rarity" varchar(20) DEFAULT 'common',
	"base_stats" jsonb DEFAULT '{"hungerDecayRate":0.42,"happinessDecayRate":0.625}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" uuid NOT NULL,
	"parent_reply_id" uuid,
	"teacher_id" uuid NOT NULL,
	"body" text NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"is_accepted_answer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_guestbook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_owner_student_id" uuid NOT NULL,
	"visitor_student_id" uuid NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'visible' NOT NULL,
	"visitor_name" varchar(255) NOT NULL,
	"visitor_animal_type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_student_id" uuid NOT NULL,
	"visited_student_id" uuid NOT NULL,
	"first_visit_at" timestamp with time zone DEFAULT now(),
	"last_visit_at" timestamp with time zone DEFAULT now(),
	"visit_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"achievement_code" varchar(50) NOT NULL,
	"achievement_name" varchar(255) NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now(),
	"progress_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"pet_id" uuid NOT NULL,
	"custom_name" varchar(50) NOT NULL,
	"hunger" integer DEFAULT 80 NOT NULL,
	"happiness" integer DEFAULT 80 NOT NULL,
	"last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	"position" jsonb DEFAULT '{"x":200,"y":200}'::jsonb NOT NULL,
	"variant_data" jsonb DEFAULT '{}'::jsonb,
	"acquired_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "purchase_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_players" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_questions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_answers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "purchase_requests" CASCADE;--> statement-breakpoint
DROP TABLE "game_players" CASCADE;--> statement-breakpoint
DROP TABLE "game_questions" CASCADE;--> statement-breakpoint
DROP TABLE "game_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "player_answers" CASCADE;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "currency_balance" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "has_values_set" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "values_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "phone_number" varchar(50);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "asset_type" varchar(50) DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "pattern_id" uuid;--> statement-breakpoint
ALTER TABLE "class_collaborators" ADD CONSTRAINT "class_collaborators_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_collaborators" ADD CONSTRAINT "class_collaborators_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_collaborators" ADD CONSTRAINT "class_collaborators_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_values_results" ADD CONSTRAINT "class_values_results_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_values_results" ADD CONSTRAINT "class_values_results_session_id_class_values_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_values_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_values_sessions" ADD CONSTRAINT "class_values_sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_values_sessions" ADD CONSTRAINT "class_values_sessions_started_by_profiles_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_values_votes" ADD CONSTRAINT "class_values_votes_session_id_class_values_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_values_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_values_votes" ADD CONSTRAINT "class_values_votes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_tags" ADD CONSTRAINT "discussion_tags_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_tags" ADD CONSTRAINT "discussion_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_reply_id_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_activity_progress" ADD CONSTRAINT "lesson_activity_progress_lesson_progress_id_lesson_progress_id_fk" FOREIGN KEY ("lesson_progress_id") REFERENCES "public"."lesson_progress"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_interactions" ADD CONSTRAINT "pet_interactions_student_pet_id_student_pets_id_fk" FOREIGN KEY ("student_pet_id") REFERENCES "public"."student_pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_guestbook" ADD CONSTRAINT "room_guestbook_room_owner_student_id_students_id_fk" FOREIGN KEY ("room_owner_student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_guestbook" ADD CONSTRAINT "room_guestbook_visitor_student_id_students_id_fk" FOREIGN KEY ("visitor_student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_visits" ADD CONSTRAINT "room_visits_visitor_student_id_students_id_fk" FOREIGN KEY ("visitor_student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_visits" ADD CONSTRAINT "room_visits_visited_student_id_students_id_fk" FOREIGN KEY ("visited_student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_pets" ADD CONSTRAINT "student_pets_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_pets" ADD CONSTRAINT "student_pets_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_class_teacher" ON "class_collaborators" USING btree ("class_id","teacher_id");--> statement-breakpoint
CREATE INDEX "idx_class_collaborators_class_id" ON "class_collaborators" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_class_collaborators_teacher_id" ON "class_collaborators" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_class_collaborators_invitation_token" ON "class_collaborators" USING btree ("invitation_token");--> statement-breakpoint
CREATE INDEX "idx_class_collaborators_status" ON "class_collaborators" USING btree ("invitation_status");--> statement-breakpoint
CREATE INDEX "idx_class_collaborators_active" ON "class_collaborators" USING btree ("class_id","teacher_id") WHERE invitation_status = 'accepted' AND revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_class_cluster_value" ON "class_values_results" USING btree ("class_id","cluster_number","value_code");--> statement-breakpoint
CREATE INDEX "idx_class_values_results_class_id" ON "class_values_results" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_class_values_results_winners" ON "class_values_results" USING btree ("class_id","is_winner") WHERE is_winner = true;--> statement-breakpoint
CREATE INDEX "idx_class_values_sessions_class_id" ON "class_values_sessions" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_class_values_sessions_status" ON "class_values_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_class_values_sessions_active" ON "class_values_sessions" USING btree ("class_id","status") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "unique_session_student_cluster_rank" ON "class_values_votes" USING btree ("session_id","student_id","cluster_number","vote_rank");--> statement-breakpoint
CREATE INDEX "idx_class_values_votes_session_id" ON "class_values_votes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_class_values_votes_student_id" ON "class_values_votes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_class_values_votes_counting" ON "class_values_votes" USING btree ("session_id","cluster_number","value_code");--> statement-breakpoint
CREATE INDEX "idx_discussion_tags_discussion" ON "discussion_tags" USING btree ("discussion_id");--> statement-breakpoint
CREATE INDEX "idx_discussion_tags_tag" ON "discussion_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_discussions_teacher_id" ON "discussions" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_discussions_category" ON "discussions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_discussions_created_at" ON "discussions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_discussions_status" ON "discussions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_interactions_teacher_discussion" ON "interactions" USING btree ("teacher_id","discussion_id");--> statement-breakpoint
CREATE INDEX "idx_interactions_teacher_reply" ON "interactions" USING btree ("teacher_id","reply_id");--> statement-breakpoint
CREATE INDEX "idx_interactions_type" ON "interactions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_interaction" ON "interactions" USING btree ("teacher_id","discussion_id","reply_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_lesson_activity" ON "lesson_activity_progress" USING btree ("lesson_progress_id","activity_number");--> statement-breakpoint
CREATE INDEX "idx_lesson_activity_progress_lesson_id" ON "lesson_activity_progress" USING btree ("lesson_progress_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_class_lesson" ON "lesson_progress" USING btree ("class_id","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_progress_class_id" ON "lesson_progress" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_progress_status" ON "lesson_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_patterns_code" ON "patterns" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_patterns_surface_type" ON "patterns" USING btree ("surface_type");--> statement-breakpoint
CREATE INDEX "idx_patterns_theme" ON "patterns" USING btree ("theme");--> statement-breakpoint
CREATE INDEX "idx_patterns_is_active" ON "patterns" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_patterns_created_at" ON "patterns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_patterns_type_active" ON "patterns" USING btree ("surface_type","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_pet_interactions_student_pet_id" ON "pet_interactions" USING btree ("student_pet_id");--> statement-breakpoint
CREATE INDEX "idx_pet_interactions_created_at" ON "pet_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pets_active" ON "pets" USING btree ("is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_replies_discussion" ON "replies" USING btree ("discussion_id");--> statement-breakpoint
CREATE INDEX "idx_replies_parent" ON "replies" USING btree ("parent_reply_id");--> statement-breakpoint
CREATE INDEX "idx_replies_teacher" ON "replies" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_guestbook_room_owner" ON "room_guestbook" USING btree ("room_owner_student_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_guestbook_visitor" ON "room_guestbook" USING btree ("visitor_student_id");--> statement-breakpoint
CREATE INDEX "idx_guestbook_status" ON "room_guestbook" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_room_visits_visitor" ON "room_visits" USING btree ("visitor_student_id");--> statement-breakpoint
CREATE INDEX "idx_room_visits_visited" ON "room_visits" USING btree ("visited_student_id");--> statement-breakpoint
CREATE INDEX "idx_room_visits_last_visit" ON "room_visits" USING btree ("last_visit_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_visitor_visited" ON "room_visits" USING btree ("visitor_student_id","visited_student_id");--> statement-breakpoint
CREATE INDEX "idx_achievements_student" ON "student_achievements" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_achievements_code" ON "student_achievements" USING btree ("achievement_code");--> statement-breakpoint
CREATE INDEX "idx_achievements_earned" ON "student_achievements" USING btree ("earned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_student_achievement" ON "student_achievements" USING btree ("student_id","achievement_code");--> statement-breakpoint
CREATE INDEX "idx_student_pets_student_id" ON "student_pets" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_student_pet" ON "student_pets" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tags_slug" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_tags_category" ON "tags" USING btree ("category");--> statement-breakpoint
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_pattern_id_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_store_items_pattern_id" ON "store_items" USING btree ("pattern_id");--> statement-breakpoint
ALTER TABLE "store_settings" DROP COLUMN "auto_approval_threshold";