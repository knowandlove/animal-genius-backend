CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."rarity" AS ENUM('common', 'rare', 'epic', 'legendary');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('earn', 'spend', 'grant', 'deduct');--> statement-breakpoint
CREATE TABLE "activations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"class_id" uuid NOT NULL,
	"activation_code" varchar(20) NOT NULL,
	"is_activated" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"activated_by_student_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activations_activation_code_unique" UNIQUE("activation_code")
);
--> statement-breakpoint
CREATE TABLE "admin_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" uuid,
	"target_user_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"personality_type" varchar(20),
	"genius_type" varchar(50),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "animal_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"category" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(100),
	"grade_level" varchar(50),
	"school_name" varchar(255),
	"icon" varchar(50) DEFAULT 'book',
	"background_color" varchar(7) DEFAULT '#829B79',
	"number_of_students" integer,
	"fun_code" varchar(50) NOT NULL,
	"session_active" boolean DEFAULT false,
	"session_started_at" timestamp with time zone,
	"max_students" integer DEFAULT 50,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_student_count" integer DEFAULT 0,
	"stripe_subscription_id" text,
	"payment_link_id" varchar(255),
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "classes_fun_code_unique" UNIQUE("fun_code")
);
--> statement-breakpoint
CREATE TABLE "classroom_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"class_id" uuid NOT NULL,
	"session_code" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "classroom_sessions_session_code_unique" UNIQUE("session_code")
);
--> statement-breakpoint
CREATE TABLE "currency_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid,
	"amount" integer NOT NULL,
	"transaction_type" varchar(20) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genius_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "genius_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "item_animal_positions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"item_type_id" uuid NOT NULL,
	"animal_type_id" uuid NOT NULL,
	"x_position" numeric(5, 2) DEFAULT '50' NOT NULL,
	"y_position" numeric(5, 2) DEFAULT '50' NOT NULL,
	"scale" numeric(3, 2) DEFAULT '1.0' NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"score" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"teacher_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"subject" varchar(100),
	"grade_level" varchar(50),
	"duration_minutes" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"school_organization" varchar(255),
	"role_title" varchar(255),
	"how_heard_about" varchar(255),
	"personality_animal" varchar(50),
	"is_admin" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"student_id" uuid NOT NULL,
	"store_item_id" uuid NOT NULL,
	"item_type" varchar(50),
	"cost" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answer_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answer_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quiz_submissions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"student_id" uuid NOT NULL,
	"animal_type_id" uuid NOT NULL,
	"genius_type_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"coins_earned" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_items" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"item_type_id" uuid NOT NULL,
	"cost" integer NOT NULL,
	"rarity" varchar(20) DEFAULT 'common',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid,
	"is_open" boolean DEFAULT false NOT NULL,
	"opened_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"auto_approval_threshold" integer,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_settings_teacher_id_unique" UNIQUE("teacher_id")
);
--> statement-breakpoint
CREATE TABLE "student_inventory" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"student_id" uuid NOT NULL,
	"store_item_id" uuid NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"class_id" uuid NOT NULL,
	"funcode" varchar(50) NOT NULL,
	"avatar_id" varchar(50),
	"activation_id" uuid,
	"student_name" varchar(255),
	"grade_level" varchar(50),
	"personality_type" varchar(20),
	"animal_type_id" uuid,
	"genius_type_id" uuid,
	"learning_style" varchar(50),
	"currency_balance" integer DEFAULT 0 NOT NULL,
	"avatar_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"room_data" jsonb DEFAULT '{"furniture":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_funcode_unique" UNIQUE("funcode")
);
--> statement-breakpoint
CREATE TABLE "teacher_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"student_count" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"status" varchar(50) DEFAULT 'pending',
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" varchar(50) NOT NULL,
	"socket_id" varchar(50),
	"name" varchar(100) NOT NULL,
	"animal" varchar(50) NOT NULL,
	"avatar_customization" jsonb DEFAULT '{}' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"current_answer" varchar(1),
	"answer_time" integer,
	"connected" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" varchar(50) NOT NULL,
	"question_id" integer NOT NULL,
	"question_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"code" varchar(6) NOT NULL,
	"teacher_id" uuid NOT NULL,
	"teacher_socket_id" varchar(50),
	"mode" varchar(20) NOT NULL,
	"question_count" integer NOT NULL,
	"time_per_question" integer DEFAULT 20 NOT NULL,
	"status" varchar(20) DEFAULT 'lobby' NOT NULL,
	"current_question_index" integer DEFAULT -1 NOT NULL,
	"current_question_start_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	CONSTRAINT "game_sessions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "player_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" varchar(50) NOT NULL,
	"player_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"answer" varchar(1) NOT NULL,
	"time_remaining" integer NOT NULL,
	"points_earned" integer NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_profiles_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_target_user_id_profiles_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_sessions" ADD CONSTRAINT "classroom_sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_sessions" ADD CONSTRAINT "classroom_sessions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_animal_positions" ADD CONSTRAINT "item_animal_positions_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_animal_positions" ADD CONSTRAINT "item_animal_positions_animal_type_id_animal_types_id_fk" FOREIGN KEY ("animal_type_id") REFERENCES "public"."animal_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_store_item_id_store_items_id_fk" FOREIGN KEY ("store_item_id") REFERENCES "public"."store_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_processed_by_profiles_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_animal_type_id_animal_types_id_fk" FOREIGN KEY ("animal_type_id") REFERENCES "public"."animal_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_genius_type_id_genius_types_id_fk" FOREIGN KEY ("genius_type_id") REFERENCES "public"."genius_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_inventory" ADD CONSTRAINT "student_inventory_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_inventory" ADD CONSTRAINT "student_inventory_store_item_id_store_items_id_fk" FOREIGN KEY ("store_item_id") REFERENCES "public"."store_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_activation_id_activations_id_fk" FOREIGN KEY ("activation_id") REFERENCES "public"."activations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_animal_type_id_animal_types_id_fk" FOREIGN KEY ("animal_type_id") REFERENCES "public"."animal_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_genius_type_id_genius_types_id_fk" FOREIGN KEY ("genius_type_id") REFERENCES "public"."genius_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payments" ADD CONSTRAINT "teacher_payments_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payments" ADD CONSTRAINT "teacher_payments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_answers" ADD CONSTRAINT "player_answers_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_answers" ADD CONSTRAINT "player_answers_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activations_class_id" ON "activations" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_activations_activation_code" ON "activations" USING btree ("activation_code");--> statement-breakpoint
CREATE INDEX "idx_activations_expires_at" ON "activations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_activations_is_activated" ON "activations" USING btree ("is_activated");--> statement-breakpoint
CREATE INDEX "idx_admin_logs_admin_id" ON "admin_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_logs_target_user_id" ON "admin_logs" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_classes_teacher_id" ON "classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_classes_active" ON "classes" USING btree ("teacher_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_classes_payment_status" ON "classes" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_classes_fun_code" ON "classes" USING btree ("fun_code");--> statement-breakpoint
CREATE INDEX "idx_classroom_sessions_class_id" ON "classroom_sessions" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_classroom_sessions_session_code" ON "classroom_sessions" USING btree ("session_code");--> statement-breakpoint
CREATE INDEX "idx_classroom_sessions_expires_at" ON "classroom_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_classroom_sessions_is_active" ON "classroom_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_currency_transactions_student_id" ON "currency_transactions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_currency_transactions_teacher_id" ON "currency_transactions" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_item_animal" ON "item_animal_positions" USING btree ("item_type_id","animal_type_id");--> statement-breakpoint
CREATE INDEX "idx_item_animal_positions_item_type" ON "item_animal_positions" USING btree ("item_type_id");--> statement-breakpoint
CREATE INDEX "idx_item_animal_positions_animal_type" ON "item_animal_positions" USING btree ("animal_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_student_lesson" ON "lesson_progress" USING btree ("student_id","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_progress_student_id" ON "lesson_progress" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_progress_teacher_id" ON "lesson_progress" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_progress_lesson_id" ON "lesson_progress" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_student_id" ON "purchase_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_store_item_id" ON "purchase_requests" USING btree ("store_item_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_processed_by" ON "purchase_requests" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_status" ON "purchase_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_student_status" ON "purchase_requests" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_quiz_submissions_student_id" ON "quiz_submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_submissions_genius_type" ON "quiz_submissions" USING btree ("genius_type_id");--> statement-breakpoint
CREATE INDEX "idx_store_items_asset_id" ON "store_items" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_store_items_active" ON "store_items" USING btree ("is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_store_items_item_type" ON "store_items" USING btree ("item_type_id");--> statement-breakpoint
CREATE INDEX "idx_store_settings_class_id" ON "store_settings" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_student_item" ON "student_inventory" USING btree ("student_id","store_item_id");--> statement-breakpoint
CREATE INDEX "idx_student_inventory_student_id" ON "student_inventory" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_student_inventory_store_item_id" ON "student_inventory" USING btree ("store_item_id");--> statement-breakpoint
CREATE INDEX "idx_students_class_id" ON "students" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_students_animal_type" ON "students" USING btree ("animal_type_id");--> statement-breakpoint
CREATE INDEX "idx_students_genius_type" ON "students" USING btree ("genius_type_id");--> statement-breakpoint
CREATE INDEX "idx_students_fun_code" ON "students" USING btree ("funcode");--> statement-breakpoint
CREATE INDEX "idx_students_activation_id" ON "students" USING btree ("activation_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_payments_teacher_id" ON "teacher_payments" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_payments_class_id" ON "teacher_payments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_payments_status" ON "teacher_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_players_game_id_idx" ON "game_players" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_players_socket_id_idx" ON "game_players" USING btree ("socket_id");--> statement-breakpoint
CREATE INDEX "game_players_game_socket_idx" ON "game_players" USING btree ("game_id","socket_id");--> statement-breakpoint
CREATE INDEX "game_questions_game_id_idx" ON "game_questions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_questions_game_order_idx" ON "game_questions" USING btree ("game_id","question_order");--> statement-breakpoint
CREATE INDEX "game_sessions_teacher_id_idx" ON "game_sessions" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_sessions_created_at_idx" ON "game_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "player_answers_game_id_idx" ON "player_answers" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "player_answers_player_id_idx" ON "player_answers" USING btree ("player_id");