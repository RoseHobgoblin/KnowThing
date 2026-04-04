CREATE TABLE "calendars" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '',
	"is_primary" boolean DEFAULT false NOT NULL,
	"static_data" jsonb NOT NULL,
	"planet_id" integer,
	"content_record_id" integer,
	CONSTRAINT "calendars_name_unique" UNIQUE("name"),
	CONSTRAINT "calendars_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_categories" (
	"content_record_id" integer NOT NULL,
	"category" text NOT NULL,
	CONSTRAINT "content_categories_content_record_id_category_pk" PRIMARY KEY("content_record_id","category")
);
--> statement-breakpoint
CREATE TABLE "content_links" (
	"source_id" integer NOT NULL,
	"target_domain" text NOT NULL,
	"target_slug" text NOT NULL,
	"target_id" integer,
	CONSTRAINT "content_links_source_id_target_domain_target_slug_pk" PRIMARY KEY("source_id","target_domain","target_slug")
);
--> statement-breakpoint
CREATE TABLE "content_media_usage" (
	"content_record_id" integer NOT NULL,
	"filename" text NOT NULL,
	CONSTRAINT "content_media_usage_content_record_id_filename_pk" PRIMARY KEY("content_record_id","filename")
);
--> statement-breakpoint
CREATE TABLE "content_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"slug" text NOT NULL,
	"parent_path" text,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"parsed_ast" jsonb,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_record_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"edit_summary" text DEFAULT '',
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"sense_number" integer DEFAULT 1 NOT NULL,
	"part_of_speech" text,
	"definition" text NOT NULL,
	"usage_example" text,
	"usage_translation" text,
	"dialect_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inflected_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"form" text NOT NULL,
	"cell_key" text NOT NULL,
	"is_override" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "inflection_dimensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"language_id" integer NOT NULL,
	"part_of_speech" text NOT NULL,
	"name" text NOT NULL,
	"dim_values" text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language_dialects" (
	"id" serial PRIMARY KEY NOT NULL,
	"language_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"region" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"native_name" text,
	"script" text DEFAULT 'Latin',
	"family" text,
	"color" text DEFAULT '#d97706',
	"description" text,
	"page_slug" text,
	"parent_language_id" integer,
	"language_type" text DEFAULT 'language' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "languages_name_unique" UNIQUE("name"),
	CONSTRAINT "languages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lexicon" (
	"id" serial PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"language_id" integer NOT NULL,
	"pronunciation" text,
	"etymology" text,
	"notes" text,
	"page_slug" text,
	"tags" text[] DEFAULT '{}',
	"homograph_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexicon_inflections" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"class_id" integer,
	"stem" text,
	"overrides" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "lexicon_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"relation_type" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexicon_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"edit_summary" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexicon_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"dialect_id" integer NOT NULL,
	"pronunciation" text,
	"spelling" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"ip_address" text,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"filepath" text NOT NULL,
	"mime_type" text,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"hash" text,
	"description" text,
	"uploaded_by" integer,
	"original_filename" text,
	"has_thumb_150" boolean DEFAULT false,
	"has_thumb_300" boolean DEFAULT false,
	"has_thumb_600" boolean DEFAULT false,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_filename_unique" UNIQUE("filename")
);
--> statement-breakpoint
CREATE TABLE "media_categories" (
	"filename" text NOT NULL,
	"category" text NOT NULL,
	CONSTRAINT "media_categories_filename_category_pk" PRIMARY KEY("filename","category")
);
--> statement-breakpoint
CREATE TABLE "media_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paradigm_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"language_id" integer NOT NULL,
	"part_of_speech" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "paradigm_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"cell_key" text NOT NULL,
	"pattern" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planetary_bodies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"body_type" text DEFAULT 'planet' NOT NULL,
	"star_id" integer,
	"parent_id" integer,
	"content_record_id" integer,
	"page_slug" text,
	"mass" text,
	"mass_kg" double precision,
	"radius" text,
	"radius_m" double precision,
	"density" text,
	"surface_gravity" text,
	"escape_velocity" text,
	"temperature" text,
	"age" text,
	"composition" text,
	"atmosphere" text,
	"surface_pressure" text,
	"orbital_period" text,
	"orbital_period_days" double precision,
	"semi_major_axis" text,
	"semi_major_axis_au" double precision,
	"eccentricity" double precision,
	"inclination" double precision,
	"rotation_period" text,
	"rotation_period_s" double precision,
	"axial_tilt" double precision,
	"apparent_magnitude" text,
	"angular_diameter" text,
	"albedo" text,
	"satellites" integer,
	"has_rings" boolean DEFAULT false,
	"epoch_phase" double precision DEFAULT 0,
	"extra" jsonb DEFAULT '{}'::jsonb,
	"description" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planetary_bodies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "registration_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by" integer,
	"used_by" integer,
	"role" text DEFAULT 'editor' NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "star_systems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"page_slug" text,
	"system_type" text DEFAULT 'single',
	"content_record_id" integer,
	"description" text DEFAULT '',
	"extra" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "star_systems_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "stars" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"page_slug" text,
	"spectral_type" text,
	"mass" text,
	"mass_kg" double precision,
	"radius" text,
	"radius_m" double precision,
	"luminosity" text,
	"luminosity_w" double precision,
	"luminosity_visual" text,
	"temperature" text,
	"temperature_k" double precision,
	"age" text,
	"color" text,
	"density" text,
	"surface_gravity" text,
	"escape_velocity" text,
	"rotation_period" text,
	"rotation_period_s" double precision,
	"axial_tilt" double precision,
	"orbital_period" text,
	"orbital_period_days" double precision,
	"semi_major_axis" text,
	"semi_major_axis_au" double precision,
	"eccentricity" double precision,
	"periastron" text,
	"apastron" text,
	"apparent_magnitude" text,
	"absolute_magnitude" text,
	"angular_diameter" text,
	"metallicity" text,
	"companion" text,
	"parent_star_id" integer,
	"system_id" integer,
	"content_record_id" integer,
	"epoch_phase" double precision DEFAULT 0,
	"extra" jsonb DEFAULT '{}'::jsonb,
	"description" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stars_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"description" text DEFAULT '',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_planet_id_planetary_bodies_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planetary_bodies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_content_record_id_content_records_id_fk" FOREIGN KEY ("content_record_id") REFERENCES "public"."content_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_categories" ADD CONSTRAINT "content_categories_content_record_id_content_records_id_fk" FOREIGN KEY ("content_record_id") REFERENCES "public"."content_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_links" ADD CONSTRAINT "content_links_source_id_content_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_links" ADD CONSTRAINT "content_links_target_id_content_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."content_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_usage" ADD CONSTRAINT "content_media_usage_content_record_id_content_records_id_fk" FOREIGN KEY ("content_record_id") REFERENCES "public"."content_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_content_record_id_content_records_id_fk" FOREIGN KEY ("content_record_id") REFERENCES "public"."content_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definitions" ADD CONSTRAINT "definitions_entry_id_lexicon_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."lexicon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definitions" ADD CONSTRAINT "definitions_dialect_id_language_dialects_id_fk" FOREIGN KEY ("dialect_id") REFERENCES "public"."language_dialects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inflected_forms" ADD CONSTRAINT "inflected_forms_entry_id_lexicon_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."lexicon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inflection_dimensions" ADD CONSTRAINT "inflection_dimensions_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_dialects" ADD CONSTRAINT "language_dialects_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon" ADD CONSTRAINT "lexicon_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_inflections" ADD CONSTRAINT "lexicon_inflections_entry_id_lexicon_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."lexicon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_inflections" ADD CONSTRAINT "lexicon_inflections_class_id_paradigm_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."paradigm_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_relations" ADD CONSTRAINT "lexicon_relations_source_id_lexicon_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lexicon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_relations" ADD CONSTRAINT "lexicon_relations_target_id_lexicon_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."lexicon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_revisions" ADD CONSTRAINT "lexicon_revisions_entry_id_lexicon_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."lexicon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_revisions" ADD CONSTRAINT "lexicon_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_variants" ADD CONSTRAINT "lexicon_variants_entry_id_lexicon_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."lexicon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon_variants" ADD CONSTRAINT "lexicon_variants_dialect_id_language_dialects_id_fk" FOREIGN KEY ("dialect_id") REFERENCES "public"."language_dialects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_history" ADD CONSTRAINT "media_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paradigm_classes" ADD CONSTRAINT "paradigm_classes_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paradigm_rules" ADD CONSTRAINT "paradigm_rules_class_id_paradigm_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."paradigm_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planetary_bodies" ADD CONSTRAINT "planetary_bodies_star_id_stars_id_fk" FOREIGN KEY ("star_id") REFERENCES "public"."stars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planetary_bodies" ADD CONSTRAINT "planetary_bodies_content_record_id_content_records_id_fk" FOREIGN KEY ("content_record_id") REFERENCES "public"."content_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_codes" ADD CONSTRAINT "registration_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_codes" ADD CONSTRAINT "registration_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_systems" ADD CONSTRAINT "star_systems_content_record_id_content_records_id_fk" FOREIGN KEY ("content_record_id") REFERENCES "public"."content_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_system_id_star_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."star_systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_content_record_id_content_records_id_fk" FOREIGN KEY ("content_record_id") REFERENCES "public"."content_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ccat_cat" ON "content_categories" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_clinks_target" ON "content_links" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_clinks_target_slug" ON "content_links" USING btree ("target_domain","target_slug");--> statement-breakpoint
CREATE INDEX "idx_cmu_filename" ON "content_media_usage" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "idx_cr_domain_slug" ON "content_records" USING btree ("domain","slug");--> statement-breakpoint
CREATE INDEX "idx_cr_domain" ON "content_records" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_cr_updated" ON "content_records" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_crev_record" ON "content_revisions" USING btree ("content_record_id");--> statement-breakpoint
CREATE INDEX "idx_crev_date" ON "content_revisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_definitions_entry" ON "definitions" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_inflected_forms_form" ON "inflected_forms" USING btree ("form");--> statement-breakpoint
CREATE INDEX "idx_inflected_forms_entry" ON "inflected_forms" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_infl_dim_lang" ON "inflection_dimensions" USING btree ("language_id","part_of_speech");--> statement-breakpoint
CREATE INDEX "idx_dialects_language" ON "language_dialects" USING btree ("language_id");--> statement-breakpoint
CREATE INDEX "idx_languages_slug" ON "languages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_languages_parent" ON "languages" USING btree ("parent_language_id");--> statement-breakpoint
CREATE INDEX "idx_lexicon_word" ON "lexicon" USING btree ("word");--> statement-breakpoint
CREATE INDEX "idx_lexicon_language" ON "lexicon" USING btree ("language_id");--> statement-breakpoint
CREATE INDEX "idx_lex_infl_entry" ON "lexicon_inflections" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_lexrel_source" ON "lexicon_relations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_lexrel_target" ON "lexicon_relations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_lexrev_entry" ON "lexicon_revisions" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_variants_entry" ON "lexicon_variants" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_username" ON "login_attempts" USING btree ("username","created_at");--> statement-breakpoint
CREATE INDEX "idx_media_categories_cat" ON "media_categories" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_media_history_filename" ON "media_history" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "idx_paradigm_rules_class" ON "paradigm_rules" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_planetary_bodies_slug" ON "planetary_bodies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_planetary_bodies_star" ON "planetary_bodies" USING btree ("star_id");--> statement-breakpoint
CREATE INDEX "idx_planetary_bodies_parent" ON "planetary_bodies" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_star_systems_slug" ON "star_systems" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_stars_slug" ON "stars" USING btree ("slug");