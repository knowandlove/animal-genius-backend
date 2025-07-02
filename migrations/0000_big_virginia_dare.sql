CREATE TABLE "admin_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" uuid,
	"target_user_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "animal_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"personality_type" varchar(4),
	"genius_type" varchar(100),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "animal_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"category" varchar(50),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(100),
	"grade_level" varchar(50),
	"class_code" varchar(20) NOT NULL,
	"school_name" varchar(255),
	"icon" varchar(50) DEFAULT 'book',
	"background_color" varchar(7) DEFAULT '#829B79',
	"number_of_students" integer,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "classes_class_code_unique" UNIQUE("class_code")
);
--> statement-breakpoint
CREATE TABLE "currency_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid,
	"amount" integer NOT NULL,
	"transaction_type" varchar(20) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "genius_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "genius_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "item_animal_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_type_id" uuid NOT NULL,
	"animal_type_id" uuid NOT NULL,
	"x_position" numeric(5, 2) DEFAULT '50',
	"y_position" numeric(5, 2) DEFAULT '50',
	"scale" numeric(3, 2) DEFAULT '1.0',
	"rotation" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "item_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "item_types_code_unique" UNIQUE("code")
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
	"is_admin" boolean DEFAULT false,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"store_item_id" uuid NOT NULL,
	"item_type" varchar(50),
	"cost" integer,
	"status" varchar(20) DEFAULT 'pending',
	"requested_at" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	"processed_by" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "quiz_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"animal_type_id" uuid NOT NULL,
	"genius_type_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"coins_earned" integer DEFAULT 0,
	"completed_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"item_type_id" uuid NOT NULL,
	"cost" integer NOT NULL,
	"rarity" varchar(20) DEFAULT 'common',
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid,
	"is_open" boolean DEFAULT false,
	"opened_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"auto_approval_threshold" integer,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "store_settings_teacher_id_unique" UNIQUE("teacher_id")
);
--> statement-breakpoint
CREATE TABLE "student_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"store_item_id" uuid NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now(),
	"is_equipped" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"passport_code" varchar(20) NOT NULL,
	"student_name" varchar(255),
	"grade_level" varchar(50),
	"personality_type" varchar(20),
	"animal_type_id" uuid,
	"genius_type_id" uuid,
	"learning_style" varchar(50),
	"currency_balance" integer DEFAULT 0,
	"avatar_data" jsonb DEFAULT '{}'::jsonb,
	"room_data" jsonb DEFAULT '{"furniture":[]}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "students_passport_code_unique" UNIQUE("passport_code")
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
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_profiles_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_target_user_id_profiles_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_animal_positions" ADD CONSTRAINT "item_animal_positions_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_animal_positions" ADD CONSTRAINT "item_animal_positions_animal_type_id_animal_types_id_fk" FOREIGN KEY ("animal_type_id") REFERENCES "public"."animal_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_store_item_id_store_items_id_fk" FOREIGN KEY ("store_item_id") REFERENCES "public"."store_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_processed_by_profiles_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_animal_type_id_animal_types_id_fk" FOREIGN KEY ("animal_type_id") REFERENCES "public"."animal_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_genius_type_id_genius_types_id_fk" FOREIGN KEY ("genius_type_id") REFERENCES "public"."genius_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_inventory" ADD CONSTRAINT "student_inventory_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_inventory" ADD CONSTRAINT "student_inventory_store_item_id_store_items_id_fk" FOREIGN KEY ("store_item_id") REFERENCES "public"."store_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_animal_type_id_animal_types_id_fk" FOREIGN KEY ("animal_type_id") REFERENCES "public"."animal_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_genius_type_id_genius_types_id_fk" FOREIGN KEY ("genius_type_id") REFERENCES "public"."genius_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_answers" ADD CONSTRAINT "player_answers_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_answers" ADD CONSTRAINT "player_answers_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_logs_admin_id" ON "admin_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_logs_target_user_id" ON "admin_logs" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_classes_teacher_id" ON "classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_classes_active" ON "classes" USING btree ("teacher_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_currency_transactions_student_id" ON "currency_transactions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_currency_transactions_teacher_id" ON "currency_transactions" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_item_animal" ON "item_animal_positions" USING btree ("item_type_id","animal_type_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_student_id" ON "purchase_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_store_item_id" ON "purchase_requests" USING btree ("store_item_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_processed_by" ON "purchase_requests" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_status" ON "purchase_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_student_status" ON "purchase_requests" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_quiz_submissions_student_id" ON "quiz_submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_store_items_asset_id" ON "store_items" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_store_items_active" ON "store_items" USING btree ("is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_store_settings_class_id" ON "store_settings" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_student_item" ON "student_inventory" USING btree ("student_id","store_item_id");--> statement-breakpoint
CREATE INDEX "idx_student_inventory_student_id" ON "student_inventory" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_student_inventory_store_item_id" ON "student_inventory" USING btree ("store_item_id");--> statement-breakpoint
CREATE INDEX "idx_students_class_id" ON "students" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_students_passport_code" ON "students" USING btree ("passport_code");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_class_student" ON "students" USING btree ("class_id","student_name");--> statement-breakpoint
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