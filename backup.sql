--
-- PostgreSQL database dump
--

\restrict 3wd26Tt1snUEQxprxJvC4mP9iRO6dCYfIZCtdSL5Wpm5vsmysnvIykJZIloWh75

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: definitions_touch_parent(); Type: FUNCTION; Schema: public; Owner: knowthing
--

CREATE FUNCTION public.definitions_touch_parent() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE lexicon SET updated_at = NOW() WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.definitions_touch_parent() OWNER TO knowthing;

--
-- Name: lexicon_search_update(); Type: FUNCTION; Schema: public; Owner: knowthing
--

CREATE FUNCTION public.lexicon_search_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.word, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.etymology, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(
            (SELECT string_agg(definition, ' ') FROM definitions WHERE entry_id = NEW.id), ''
        )), 'B');
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.lexicon_search_update() OWNER TO knowthing;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public._migrations (
    id integer NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public._migrations OWNER TO knowthing;

--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public._migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._migrations_id_seq OWNER TO knowthing;

--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- Name: calendars; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.calendars (
    id integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    is_primary boolean DEFAULT false NOT NULL,
    static_data jsonb NOT NULL,
    planet_id integer,
    slug text NOT NULL,
    content_record_id integer
);


ALTER TABLE public.calendars OWNER TO knowthing;

--
-- Name: calendars_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.calendars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendars_id_seq OWNER TO knowthing;

--
-- Name: calendars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.calendars_id_seq OWNED BY public.calendars.id;


--
-- Name: content_categories; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.content_categories (
    content_record_id integer NOT NULL,
    category text NOT NULL
);


ALTER TABLE public.content_categories OWNER TO knowthing;

--
-- Name: content_links; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.content_links (
    source_id integer NOT NULL,
    target_domain text NOT NULL,
    target_slug text NOT NULL,
    target_id integer
);


ALTER TABLE public.content_links OWNER TO knowthing;

--
-- Name: content_media_usage; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.content_media_usage (
    content_record_id integer NOT NULL,
    filename text NOT NULL
);


ALTER TABLE public.content_media_usage OWNER TO knowthing;

--
-- Name: content_records; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.content_records (
    id integer NOT NULL,
    domain text NOT NULL,
    slug text NOT NULL,
    parent_path text,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    plain_text text DEFAULT ''::text NOT NULL,
    parsed_ast jsonb,
    size_bytes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(plain_text, ''::text)), 'B'::"char"))) STORED
);


ALTER TABLE public.content_records OWNER TO knowthing;

--
-- Name: content_records_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.content_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.content_records_id_seq OWNER TO knowthing;

--
-- Name: content_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.content_records_id_seq OWNED BY public.content_records.id;


--
-- Name: content_revisions; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.content_revisions (
    id integer NOT NULL,
    content_record_id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    size_bytes integer DEFAULT 0 NOT NULL,
    edit_summary text DEFAULT ''::text,
    user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.content_revisions OWNER TO knowthing;

--
-- Name: content_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.content_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.content_revisions_id_seq OWNER TO knowthing;

--
-- Name: content_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.content_revisions_id_seq OWNED BY public.content_revisions.id;


--
-- Name: definitions; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.definitions (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    sense_number integer DEFAULT 1 NOT NULL,
    part_of_speech text,
    definition text NOT NULL,
    usage_example text,
    usage_translation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english'::regconfig, COALESCE(definition, ''::text)), 'A'::"char")) STORED,
    dialect_id integer
);


ALTER TABLE public.definitions OWNER TO knowthing;

--
-- Name: definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.definitions_id_seq OWNER TO knowthing;

--
-- Name: definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.definitions_id_seq OWNED BY public.definitions.id;


--
-- Name: inflected_forms; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.inflected_forms (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    form text NOT NULL,
    cell_key text NOT NULL,
    is_override boolean DEFAULT false
);


ALTER TABLE public.inflected_forms OWNER TO knowthing;

--
-- Name: inflected_forms_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.inflected_forms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inflected_forms_id_seq OWNER TO knowthing;

--
-- Name: inflected_forms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.inflected_forms_id_seq OWNED BY public.inflected_forms.id;


--
-- Name: inflection_dimensions; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.inflection_dimensions (
    id integer NOT NULL,
    language_id integer NOT NULL,
    part_of_speech text NOT NULL,
    name text NOT NULL,
    dim_values text[] NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.inflection_dimensions OWNER TO knowthing;

--
-- Name: inflection_dimensions_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.inflection_dimensions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inflection_dimensions_id_seq OWNER TO knowthing;

--
-- Name: inflection_dimensions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.inflection_dimensions_id_seq OWNED BY public.inflection_dimensions.id;


--
-- Name: language_dialects; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.language_dialects (
    id integer NOT NULL,
    language_id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    region text,
    description text
);


ALTER TABLE public.language_dialects OWNER TO knowthing;

--
-- Name: language_dialects_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.language_dialects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.language_dialects_id_seq OWNER TO knowthing;

--
-- Name: language_dialects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.language_dialects_id_seq OWNED BY public.language_dialects.id;


--
-- Name: languages; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.languages (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    native_name text,
    script text DEFAULT 'Latin'::text,
    family text,
    color text DEFAULT '#d97706'::text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    page_slug text,
    parent_language_id integer,
    language_type text DEFAULT 'language'::text NOT NULL
);


ALTER TABLE public.languages OWNER TO knowthing;

--
-- Name: languages_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.languages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.languages_id_seq OWNER TO knowthing;

--
-- Name: languages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.languages_id_seq OWNED BY public.languages.id;


--
-- Name: lexicon; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.lexicon (
    id integer NOT NULL,
    word text NOT NULL,
    language_id integer NOT NULL,
    pronunciation text,
    etymology text,
    notes text,
    page_slug text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector,
    homograph_number integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.lexicon OWNER TO knowthing;

--
-- Name: lexicon_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.lexicon_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lexicon_id_seq OWNER TO knowthing;

--
-- Name: lexicon_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.lexicon_id_seq OWNED BY public.lexicon.id;


--
-- Name: lexicon_inflections; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.lexicon_inflections (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    class_id integer,
    stem text,
    overrides jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.lexicon_inflections OWNER TO knowthing;

--
-- Name: lexicon_inflections_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.lexicon_inflections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lexicon_inflections_id_seq OWNER TO knowthing;

--
-- Name: lexicon_inflections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.lexicon_inflections_id_seq OWNED BY public.lexicon_inflections.id;


--
-- Name: lexicon_relations; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.lexicon_relations (
    id integer NOT NULL,
    source_id integer NOT NULL,
    target_id integer NOT NULL,
    relation_type text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lexicon_relations OWNER TO knowthing;

--
-- Name: lexicon_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.lexicon_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lexicon_relations_id_seq OWNER TO knowthing;

--
-- Name: lexicon_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.lexicon_relations_id_seq OWNED BY public.lexicon_relations.id;


--
-- Name: lexicon_revisions; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.lexicon_revisions (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    snapshot jsonb NOT NULL,
    edit_summary text,
    user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lexicon_revisions OWNER TO knowthing;

--
-- Name: lexicon_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.lexicon_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lexicon_revisions_id_seq OWNER TO knowthing;

--
-- Name: lexicon_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.lexicon_revisions_id_seq OWNED BY public.lexicon_revisions.id;


--
-- Name: lexicon_variants; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.lexicon_variants (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    dialect_id integer NOT NULL,
    pronunciation text,
    spelling text,
    notes text
);


ALTER TABLE public.lexicon_variants OWNER TO knowthing;

--
-- Name: lexicon_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.lexicon_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lexicon_variants_id_seq OWNER TO knowthing;

--
-- Name: lexicon_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.lexicon_variants_id_seq OWNED BY public.lexicon_variants.id;


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.login_attempts (
    id integer NOT NULL,
    username text NOT NULL,
    ip_address text,
    success boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.login_attempts OWNER TO knowthing;

--
-- Name: login_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.login_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_attempts_id_seq OWNER TO knowthing;

--
-- Name: login_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.media (
    id integer NOT NULL,
    filename text NOT NULL,
    filepath text NOT NULL,
    mime_type text,
    width integer,
    height integer,
    size_bytes integer,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    hash text,
    description text,
    uploaded_by integer,
    original_filename text,
    has_thumb_150 boolean DEFAULT false,
    has_thumb_300 boolean DEFAULT false,
    has_thumb_600 boolean DEFAULT false,
    search_vector tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, COALESCE(filename, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char"))) STORED
);


ALTER TABLE public.media OWNER TO knowthing;

--
-- Name: media_categories; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.media_categories (
    filename text NOT NULL,
    category text NOT NULL
);


ALTER TABLE public.media_categories OWNER TO knowthing;

--
-- Name: media_history; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.media_history (
    id integer NOT NULL,
    filename text NOT NULL,
    user_id integer,
    action text NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_history OWNER TO knowthing;

--
-- Name: media_history_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.media_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_history_id_seq OWNER TO knowthing;

--
-- Name: media_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.media_history_id_seq OWNED BY public.media_history.id;


--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_id_seq OWNER TO knowthing;

--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: paradigm_classes; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.paradigm_classes (
    id integer NOT NULL,
    language_id integer NOT NULL,
    part_of_speech text NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.paradigm_classes OWNER TO knowthing;

--
-- Name: paradigm_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.paradigm_classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.paradigm_classes_id_seq OWNER TO knowthing;

--
-- Name: paradigm_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.paradigm_classes_id_seq OWNED BY public.paradigm_classes.id;


--
-- Name: paradigm_rules; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.paradigm_rules (
    id integer NOT NULL,
    class_id integer NOT NULL,
    cell_key text NOT NULL,
    pattern text NOT NULL
);


ALTER TABLE public.paradigm_rules OWNER TO knowthing;

--
-- Name: paradigm_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.paradigm_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.paradigm_rules_id_seq OWNER TO knowthing;

--
-- Name: paradigm_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.paradigm_rules_id_seq OWNED BY public.paradigm_rules.id;


--
-- Name: phonemes; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.phonemes (
    id integer NOT NULL,
    language_id integer NOT NULL,
    ipa text NOT NULL,
    type text NOT NULL,
    place text,
    manner text,
    subtype text,
    voicing text,
    height text,
    backness text,
    rounded boolean DEFAULT false,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.phonemes OWNER TO knowthing;

--
-- Name: phonemes_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.phonemes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.phonemes_id_seq OWNER TO knowthing;

--
-- Name: phonemes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.phonemes_id_seq OWNED BY public.phonemes.id;


--
-- Name: planetary_bodies; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.planetary_bodies (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    body_type text DEFAULT 'planet'::text NOT NULL,
    star_id integer,
    parent_id integer,
    page_slug text,
    mass text,
    radius text,
    density text,
    surface_gravity text,
    escape_velocity text,
    temperature text,
    age text,
    composition text,
    atmosphere text,
    surface_pressure text,
    orbital_period text,
    orbital_period_days double precision,
    semi_major_axis text,
    semi_major_axis_au double precision,
    eccentricity double precision,
    inclination double precision,
    rotation_period text,
    rotation_period_s double precision,
    axial_tilt double precision,
    apparent_magnitude text,
    angular_diameter text,
    albedo text,
    satellites integer,
    has_rings boolean DEFAULT false,
    extra jsonb DEFAULT '{}'::jsonb,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content_record_id integer,
    epoch_phase double precision DEFAULT 0,
    mass_kg double precision,
    radius_m double precision
);


ALTER TABLE public.planetary_bodies OWNER TO knowthing;

--
-- Name: planetary_bodies_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.planetary_bodies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.planetary_bodies_id_seq OWNER TO knowthing;

--
-- Name: planetary_bodies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.planetary_bodies_id_seq OWNED BY public.planetary_bodies.id;


--
-- Name: registration_codes; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.registration_codes (
    id integer NOT NULL,
    code text NOT NULL,
    created_by integer,
    used_by integer,
    role text DEFAULT 'editor'::text NOT NULL,
    used_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.registration_codes OWNER TO knowthing;

--
-- Name: registration_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.registration_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.registration_codes_id_seq OWNER TO knowthing;

--
-- Name: registration_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.registration_codes_id_seq OWNED BY public.registration_codes.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO knowthing;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO knowthing;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.site_settings OWNER TO knowthing;

--
-- Name: star_systems; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.star_systems (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    page_slug text,
    system_type text DEFAULT 'single'::text,
    description text DEFAULT ''::text,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content_record_id integer
);


ALTER TABLE public.star_systems OWNER TO knowthing;

--
-- Name: star_systems_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.star_systems_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.star_systems_id_seq OWNER TO knowthing;

--
-- Name: star_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.star_systems_id_seq OWNED BY public.star_systems.id;


--
-- Name: stars; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.stars (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    page_slug text,
    spectral_type text,
    mass text,
    radius text,
    luminosity text,
    luminosity_visual text,
    temperature text,
    age text,
    color text,
    orbital_period text,
    semi_major_axis text,
    semi_major_axis_au double precision,
    eccentricity double precision,
    periastron text,
    apastron text,
    apparent_magnitude text,
    angular_diameter text,
    companion text,
    parent_star_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    system_id integer,
    content_record_id integer,
    epoch_phase double precision DEFAULT 0,
    mass_kg double precision,
    radius_m double precision,
    luminosity_w double precision,
    temperature_k double precision,
    density text,
    surface_gravity text,
    escape_velocity text,
    rotation_period text,
    rotation_period_s double precision,
    axial_tilt double precision,
    orbital_period_days double precision,
    absolute_magnitude text,
    metallicity text
);


ALTER TABLE public.stars OWNER TO knowthing;

--
-- Name: stars_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.stars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stars_id_seq OWNER TO knowthing;

--
-- Name: stars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.stars_id_seq OWNED BY public.stars.id;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    name text NOT NULL,
    source text NOT NULL,
    description text DEFAULT ''::text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.templates OWNER TO knowthing;

--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.templates_id_seq OWNER TO knowthing;

--
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: knowthing
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'editor'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO knowthing;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: knowthing
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO knowthing;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: knowthing
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: calendars id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.calendars ALTER COLUMN id SET DEFAULT nextval('public.calendars_id_seq'::regclass);


--
-- Name: content_records id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_records ALTER COLUMN id SET DEFAULT nextval('public.content_records_id_seq'::regclass);


--
-- Name: content_revisions id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_revisions ALTER COLUMN id SET DEFAULT nextval('public.content_revisions_id_seq'::regclass);


--
-- Name: definitions id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.definitions ALTER COLUMN id SET DEFAULT nextval('public.definitions_id_seq'::regclass);


--
-- Name: inflected_forms id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflected_forms ALTER COLUMN id SET DEFAULT nextval('public.inflected_forms_id_seq'::regclass);


--
-- Name: inflection_dimensions id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflection_dimensions ALTER COLUMN id SET DEFAULT nextval('public.inflection_dimensions_id_seq'::regclass);


--
-- Name: language_dialects id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.language_dialects ALTER COLUMN id SET DEFAULT nextval('public.language_dialects_id_seq'::regclass);


--
-- Name: languages id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.languages ALTER COLUMN id SET DEFAULT nextval('public.languages_id_seq'::regclass);


--
-- Name: lexicon id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon ALTER COLUMN id SET DEFAULT nextval('public.lexicon_id_seq'::regclass);


--
-- Name: lexicon_inflections id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_inflections ALTER COLUMN id SET DEFAULT nextval('public.lexicon_inflections_id_seq'::regclass);


--
-- Name: lexicon_relations id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_relations ALTER COLUMN id SET DEFAULT nextval('public.lexicon_relations_id_seq'::regclass);


--
-- Name: lexicon_revisions id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_revisions ALTER COLUMN id SET DEFAULT nextval('public.lexicon_revisions_id_seq'::regclass);


--
-- Name: lexicon_variants id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_variants ALTER COLUMN id SET DEFAULT nextval('public.lexicon_variants_id_seq'::regclass);


--
-- Name: login_attempts id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: media_history id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media_history ALTER COLUMN id SET DEFAULT nextval('public.media_history_id_seq'::regclass);


--
-- Name: paradigm_classes id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_classes ALTER COLUMN id SET DEFAULT nextval('public.paradigm_classes_id_seq'::regclass);


--
-- Name: paradigm_rules id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_rules ALTER COLUMN id SET DEFAULT nextval('public.paradigm_rules_id_seq'::regclass);


--
-- Name: phonemes id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.phonemes ALTER COLUMN id SET DEFAULT nextval('public.phonemes_id_seq'::regclass);


--
-- Name: planetary_bodies id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.planetary_bodies ALTER COLUMN id SET DEFAULT nextval('public.planetary_bodies_id_seq'::regclass);


--
-- Name: registration_codes id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.registration_codes ALTER COLUMN id SET DEFAULT nextval('public.registration_codes_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: star_systems id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.star_systems ALTER COLUMN id SET DEFAULT nextval('public.star_systems_id_seq'::regclass);


--
-- Name: stars id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.stars ALTER COLUMN id SET DEFAULT nextval('public.stars_id_seq'::regclass);


--
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _migrations; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public._migrations (id, name, applied_at) FROM stdin;
1	0001_initial.sql	2026-03-19 17:31:26.482022+00
2	0002_wordbook.sql	2026-03-20 13:50:54.516384+00
3	0003_language_page_link.sql	2026-03-20 14:25:45.252657+00
4	0004_lexicon_relations.sql	2026-03-20 14:25:45.281737+00
5	0005_media_overhaul.sql	2026-03-20 14:39:44.835371+00
6	0006_polysemy.sql	2026-03-20 16:00:19.910573+00
7	0007_revisions_homographs.sql	2026-03-20 16:00:19.943907+00
8	0008_language_ancestry_dialects.sql	2026-03-20 16:37:01.481953+00
9	0009_inflections.sql	2026-03-20 16:44:20.184376+00
10	0010_phonemes.sql	2026-03-25 10:07:50.800428+00
11	0010_ast_cache.sql	2026-03-29 04:12:05.446953+00
12	0011_site_settings.sql	2026-03-29 05:34:07.860556+00
13	0012_celestial_bodies.sql	2026-03-29 10:33:52.462615+00
14	0013_seed_sunly_system.sql	2026-03-29 10:37:27.969343+00
15	0014_star_systems.sql	2026-03-29 10:49:28.978975+00
16	0015_rename_sun.sql	2026-03-29 11:14:51.644077+00
17	0016_content_records.sql	2026-03-29 12:17:28.85987+00
18	0017_domain_content_records.sql	2026-03-29 12:29:30.003367+00
19	0018_drop_legacy_tables.sql	2026-03-29 12:35:08.792002+00
20	0019_performance_improvements.sql	2026-03-30 07:15:56.751824+00
21	0020_celestial_calendar.sql	2026-03-30 08:21:00.67399+00
22	0021_auth_upgrades.sql	2026-03-30 10:11:00.071704+00
23	0022_calendar_content_records.sql	2026-03-30 18:07:23.57307+00
24	0023_celestial_numeric_fields.sql	2026-04-01 03:23:15.433735+00
\.


--
-- Data for Name: calendars; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.calendars (id, name, description, is_primary, static_data, planet_id, slug, content_record_id) FROM stdin;
1	Republican Calendar		t	{"eras": [], "moons": [], "months": [{"name": "Month 1", "length": 30, "month_type": "regular"}], "seasons": [], "weekdays": [{"name": "Monday", "abbreviation": "Mon"}, {"name": "Tuesday", "abbreviation": "Tue"}, {"name": "Wednesday", "abbreviation": "Wed"}, {"name": "Thursday", "abbreviation": "Thu"}, {"name": "Friday", "abbreviation": "Fri"}, {"name": "Saturday", "abbreviation": "Sat"}, {"name": "Sunday", "abbreviation": "Sun"}], "leap_days": [], "year_offset": 0, "epoch_offset": 0, "display_moons": false, "first_week_day": 0, "day_length_seconds": 86400}	\N	republican-calendar	42
3	Rose Calendar		f	{"eras": [], "moons": [], "months": [{"name": "Month 1", "length": 30, "month_type": "regular"}], "seasons": [], "weekdays": [{"name": "Monday"}, {"name": "Tuesday"}, {"name": "Wednesday"}, {"name": "Thursday"}, {"name": "Friday"}, {"name": "Saturday"}, {"name": "Sunday"}], "leap_days": [], "year_offset": 0, "epoch_offset": 0, "display_moons": false, "first_week_day": 0}	\N	rose-calendar	43
4	Gregorian Calendar		f	{"eras": [{"name": "BCE", "format": "{{year}} {{era_name}}", "end_year": 0, "start_year": -9999, "reverse_numbering": true}, {"name": "CE", "format": "{{year}} {{era_name}}", "end_year": null, "start_year": 1, "reverse_numbering": false}], "moons": [{"name": "Luna", "cycle": 29.5306, "offset": 0, "face_color": "#F5F5DC", "shadow_color": "#2B2B2B"}], "months": [{"name": "January", "length": 31, "month_type": "regular"}, {"name": "February", "length": 28, "month_type": "regular"}, {"name": "March", "length": 31, "month_type": "regular"}, {"name": "April", "length": 30, "month_type": "regular"}, {"name": "May", "length": 31, "month_type": "regular"}, {"name": "June", "length": 30, "month_type": "regular"}, {"name": "July", "length": 31, "month_type": "regular"}, {"name": "August", "length": 31, "month_type": "regular"}, {"name": "September", "length": 30, "month_type": "regular"}, {"name": "October", "length": 31, "month_type": "regular"}, {"name": "November", "length": 30, "month_type": "regular"}, {"name": "December", "length": 31, "month_type": "regular"}], "seasons": [{"kind": "winter", "name": "Winter", "color": "#87CEEB", "timing": {"day": 21, "type": "dated", "month": 11}}, {"kind": "spring", "name": "Spring", "color": "#90EE90", "timing": {"day": 20, "type": "dated", "month": 2}}, {"kind": "summer", "name": "Summer", "color": "#FFD700", "timing": {"day": 21, "type": "dated", "month": 5}}, {"kind": "autumn", "name": "Autumn", "color": "#FF8C00", "timing": {"day": 22, "type": "dated", "month": 8}}], "weekdays": [{"name": "Monday", "abbreviation": "Mon"}, {"name": "Tuesday", "abbreviation": "Tue"}, {"name": "Wednesday", "abbreviation": "Wed"}, {"name": "Thursday", "abbreviation": "Thu"}, {"name": "Friday", "abbreviation": "Fri"}, {"name": "Saturday", "abbreviation": "Sat"}, {"name": "Sunday", "abbreviation": "Sun"}], "leap_days": [{"name": "Leap Day", "ignore": [100], "offset": 0, "interval": 4, "after_day": 28, "exclusive": [400], "intercalary": false, "month_index": 1}], "year_offset": 0, "epoch_offset": 0, "display_moons": true, "first_week_day": 0, "day_length_seconds": 86400}	\N	gregorian-calendar	44
\.


--
-- Data for Name: content_categories; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.content_categories (content_record_id, category) FROM stdin;
1	Countries
1	Monarchies
\.


--
-- Data for Name: content_links; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.content_links (source_id, target_domain, target_slug, target_id) FROM stdin;
35	know	Star	\N
35	know	Sunly_system	36
35	know	Plasma	\N
35	know	Nuclear_fusion	\N
35	know	Visible_light	\N
35	know	Infrared_radiation	\N
12	know	vola	\N
12	know	kirathara	14
12	know	Krelitser	16
35	know	Spectral_classification	\N
34	know	Star	\N
34	know	Sun	35
35	know	Hydrogen	\N
35	know	Helium	\N
8	know	rabekareta	9
8	know	onchera	1
8	know	aranbu	\N
8	know	maxeta	\N
8	know	bizeta	\N
8	know	zabala	\N
8	know	etxeterroa	\N
8	know	baa	\N
8	know	izaro_the_great	10
8	know	city_of_rabkareta	\N
8	know	sugaar_river	\N
8	know	araun_(clan)	7
8	know	gaizka_araun	\N
8	know	nesrab_issaka	\N
8	know	fort_araun	\N
35	know	Oxygen	\N
35	know	Carbon	\N
35	know	Iron	\N
35	know	Gravitational_collapse	\N
35	know	Molecular_cloud	\N
35	know	Therne	34
35	know	Orbital_eccentricity	\N
35	know	Insolation	\N
34	know	Red_dwarf	\N
34	know	Spectral_classification	\N
34	know	Astronomical_unit	\N
34	know	Full_moon	\N
7	know	araun_(ward)	8
34	celestial	Sunly_system	\N
31	know	Capital_of_Onchera	\N
31	know	Onchera	1
31	know	Lureta	\N
31	know	High_Priestess	\N
31	know	Aidegani	32
31	know	Tambuli	\N
31	know	Rabkareta	\N
31	know	Trumoia_period	\N
31	know	Rabeaneta_period	\N
31	know	Araun_(Clan)	7
41	know	Oncheran_archipelago	\N
35	know	Earth	\N
12	know	Kiranshelokism	15
35	know	Celestial_mechanics	\N
6	know	University_of_Almisan	24
15	know	Krelitser	16
15	know	Vola	\N
7	know	rabeaneta	26
7	know	holy_oncheran_army	\N
7	know	ibarra_araun	\N
35	know	Arcminute	\N
35	know	Sunspot	\N
35	know	Sunset	\N
35	know	Rayleigh_scattering	\N
35	know	Habitable_zone	\N
10	know	Onchera	1
10	know	Later_Bazambide_era	\N
10	know	Araun_period	\N
10	know	Rabeaneta	26
10	know	Rabeaneta_period	\N
35	know	Frost_line	\N
35	know	Asteroid_belt	\N
35	know	Holman-Wiegert_limit	\N
37	know	Onchera	1
32	know	Onchera	1
32	know	Elekoneta	39
9	know	Capital_of_Onchera	\N
9	know	List_of_cities_in_Onchera	\N
9	know	Onchera	1
1	know	West_Hashir	\N
1	know	Ouken_Ocean	\N
1	know	Iparaleroa	\N
1	know	Ossela	\N
1	know	Maera	\N
1	know	Lureta	\N
1	know	Tarkolur	\N
1	know	Kizgar	\N
1	know	Nasseta	\N
1	know	Tssabura	\N
1	know	Ouken_blood_algae	\N
1	know	West_Onchera_Reef	\N
1	know	Iratssoat	\N
1	know	Batea_people	41
1	know	Mira_people	\N
1	know	Mira_languages	\N
1	know	Oncheran_language	23
1	know	Tambuli	\N
1	know	Elekoneta	39
1	know	Aide_the_Sun	30
1	know	Amalur	31
1	know	Hadashule_dynasty	\N
1	know	Ouken_Algae_Flood_(2259)	\N
1	know	Melcharia	\N
1	know	Rabeaneta	26
30	know	Elekoneta	39
30	know	Onchera	1
30	know	Batea_people	\N
1	know	Mitale_Tiguzo	33
1	know	Izaro_the_Great	10
1	know	Aidegani	32
1	know	Tanism	\N
1	know	Havimism	\N
16	know	Thentey	\N
16	know	Lower_kys_era	\N
16	know	Kronthey	\N
16	know	Principality_of_Kirathara	\N
16	know	Dynastic_conflicts_in_the_23th_century	\N
16	know	Krelitser_League	\N
16	know	Third_Krelitser-Otse_war	\N
\.


--
-- Data for Name: content_media_usage; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.content_media_usage (content_record_id, filename) FROM stdin;
37	red_algae.jpg
15	Тхост._дзуар.jpg
\.


--
-- Data for Name: content_records; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.content_records (id, domain, slug, parent_path, title, content, plain_text, parsed_ast, size_bytes, created_at, updated_at) FROM stdin;
5	know	leoddin_i	\N	Leoddin I	{{infobox royalty\r\n}}\r\n		\N	23	2026-03-19 23:17:41.931357+00	2026-03-19 23:17:41.931357+00
8	know	araun_(ward)	\N	Araun (ward)	{{Infobox settlement\r\n|image=AraunCity.jpg\r\n}}\r\n\r\nAraun is a special ward in the [[Rabekareta|Rabekareta Federal Metropolis]] in [[Onchera]]. It is one of the eleven central wards of the Rabkareta Federal Metropolis. Located in the southern area of Rabkareta, Araun is bordered by the wards of [[Aranbu]], [[Maxeta]], and [[Bizeta]] in the north and [[Zabala]], [[Etxeterroa]], and [[Baña]] in the south. \r\n\r\nThe ward was founded on 30 Rotting Wood 3152 with the establishment of the Rabkareta Federal Metropolis. The total land area of Araun is 11.01 km^2, sitting on the largest plateau with a difference of 50 m between the ward's highest and lowest points. Approximately 47% of Araun's land is residential, and 20% is commercial and public areas.\r\n\r\nThe ward is named after, and is the site of the old town of Araun, that formed the city of Rabkareta under the rule of [[Izaro the Great]] after the turn of the third millennium.\r\n\r\n== History ==\r\n\r\nAraun was founded as a ward in 3152 by the designation of the [[City of Rabkareta]] as a "federal metropolis". The borders were drawn slightly larger than the bounds of the old town of Araun, encompassing the [[Sugaar river]]'s inlet, notably.\r\n\r\nThe area itself was the ancestral home of the [[Araun (Clan)|Araun clan]] and their ancestors, being founded in the 26th century. During the conquests of [[Gaizka Araun]], Araun expanded in size. In 2998, the forces of the Araun clan captured the town of Masseta from [[Nesrab Issaka]], and the Araun clan moved to Masseta. Over the decade, the small distance between Araun and Masseta caused the towns to fuse, as both towns expanded towards each other. In 3008, Izaro the Great would declare the City of Rabkareta as the administrative capital of Onchera, with the new city encompassing the area.\r\n\r\nAreas of the old town of Araun still exist within the ward, and are mostly preserved. Efforts began on restoring [[Fort Araun]] as of the establishment of the ward, but were halted over concerns of the reversibility of the work.	Araun is a special ward in the Rabekareta Federal Metropolis in Onchera. It is one of the eleven central wards of the Rabkareta Federal Metropolis. Located in the southern area of Rabkareta, Araun is bordered by the wards of Aranbu, Maxeta, and Bizeta in the north and Zabala, Etxeterroa, and Baña in the south. The ward was founded on 30 Rotting Wood 3152 with the establishment of the Rabkareta Federal Metropolis. The total land area of Araun is 11.01 km^2, sitting on the largest plateau with a difference of 50 m between the ward's highest and lowest points. Approximately 47% of Araun's land is residential, and 20% is commercial and public areas. The ward is named after, and is the site of the old town of Araun, that formed the city of Rabkareta under the rule of Izaro the Great after the turn of the third millennium. History Araun was founded as a ward in 3152 by the designation of the City of Rabkareta as a "federal metropolis". The borders were drawn slightly larger than the bounds of the old town of Araun, encompassing the Sugaar river's inlet, notably. The area itself was the ancestral home of the Araun clan and their ancestors, being founded in the 26th century. During the conquests of Gaizka Araun, Araun expanded in size. In 2998, the forces of the Araun clan captured the town of Masseta from Nesrab Issaka, and the Araun clan moved to Masseta. Over the decade, the small distance between Araun and Masseta caused the towns to fuse, as both towns expanded towards each other. In 3008, Izaro the Great would declare the City of Rabkareta as the administrative capital of Onchera, with the new city encompassing the area. Areas of the old town of Araun still exist within the ward, and are mostly preserved. Efforts began on restoring Fort Araun as of the establishment of the ward, but were halted over concerns of the reversibility of the work.	\N	2031	2026-03-20 14:21:18.934608+00	2026-03-20 14:21:18.934608+00
7	know	araun_(clan)	\N	Araun (Clan)	The Araun clan is a Ontsseran clan originating from the old town of [[Araun (ward)|Araun]]. According to the clan's genealogy, the clan was founded by a priestess known as Mureta, who founded the town with youth from the crowded temple she served at, in an unknown town. The clan currently hereditarily holds the rank of ''[[Rabeaneta]]'' (Supreme Commander) of the [[Holy Oncheran Army]], and is headed by [[Ibarra Araun]].	The Araun clan is a Ontsseran clan originating from the old town of Araun. According to the clan's genealogy, the clan was founded by a priestess known as Mureta, who founded the town with youth from the crowded temple she served at, in an unknown town. The clan currently hereditarily holds the rank of Rabeaneta (Supreme Commander) of the Holy Oncheran Army, and is headed by Ibarra Araun.	\N	424	2026-03-20 14:21:02.72141+00	2026-03-20 14:32:11.537+00
22	know	krelitseran_language	\N	Krelitseran language	{| class="wikitable" style="text-align:center;"\r\n|-\r\n! !! Bilabial !! Labiodental !! Dental !! Alveolar !! Retroflex !! Palatal !! Velar !! Glottal\r\n|-\r\n! Plosive\r\n| p b ||  ||  || t d ||  ||  || k g || \r\n|-\r\n! Nasal\r\n| m ||  ||  || n ||  ||  ||  || \r\n|-\r\n! Fricative\r\n|  || f v || θ ð || s z || ʂ ʐ ||  ||  || h\r\n|-\r\n! Approximant\r\n| w ||  ||  ||  ||  || j ||  || \r\n|-\r\n! Lateral\r\n|  ||  ||  || ɫ ||  ||  ||  || \r\n|-\r\n! Tap/Flap\r\n|  ||  ||  || ɾ ||  ||  ||  || \r\n|}\r\n\r\n{| class="wikitable" style="text-align:center;"\r\n|-\r\n! !! Front !! Central !! Back\r\n|-\r\n! Close\r\n| i || ɨ || u\r\n|-\r\n! Close-mid\r\n| e ||  || \r\n|-\r\n! Mid\r\n|  || ə || \r\n|-\r\n! Open\r\n|  || a || \r\n|}		\N	685	2026-03-20 18:20:18.721672+00	2026-03-22 09:04:33.72+00
11	know	kraar	\N	Kıraŧar	'''Kirathar''' is the ''[[vola]]'' of the sun. She is prominent in southern [[Krelit]] and [[Otse]] culture. Being invoked as the watchful deliverer of light and ''[[bogu]]'', and officiator of pacts and contracts. She is the sister of [[Ževra]].	Kirathar is the vola of the sun. She is prominent in southern Krelit and Otse culture. Being invoked as the watchful deliverer of light and bogu, and officiator of pacts and contracts. She is the sister of Ževra.	\N	247	2026-03-20 15:12:57.89593+00	2026-03-20 15:23:24.465+00
14	know	kirathara	\N	Kirathara			\N	0	2026-03-20 15:25:04.858634+00	2026-03-20 15:25:04.858634+00
12	know	Ževra	\N	Ževra	'''Ževra''' is the Lord of Heaven and Men, and Sovereign of Thunder. Ževra is the central ''[[vola]]'' in [[Kiranshelokism]]. They are interpreted as a female in [[Kirathara]], and a male in most other communities in [[Krelitser]].	Ževra is the Lord of Heaven and Men, and Sovereign of Thunder. Ževra is the central vola in Kiranshelokism. They are interpreted as a female in Kirathara, and a male in most other communities in Krelitser.	\N	233	2026-03-20 15:23:43.675684+00	2026-03-21 10:09:42.865+00
27	know	Classical_Myreni	\N	Classical Myreni			\N	0	2026-03-22 09:06:43.448559+00	2026-03-22 09:06:43.448559+00
32	know	Aidegani	\N	Aidegani	{{infobox religion\n| title=Aidegani\n| founder=[[Aide the Sun]]\n}}\n\n'''Aidegani'''  is the native and ethnic religion of [[Onchera]]. As polytheistic and naturalistic religion, Aidegani expresses belief and worship in physical and immanent deities within this realm and others. Aidegani does not regard souls to exist, and reincarnation is believed to happen in the form of physical transfer. Central authority in Aidegani exists solely in the institution of the [[Elekoneta]] and by extension, the State of Onchera, however, this is not excercised. There is much diversity of belief and practice evident among practitioners. \n\n== Etymology ==\n\n== See also ==\n\n== Notes ==\n\n== References ==\n	Aidegani is the native and ethnic religion of Onchera. As polytheistic and naturalistic religion, Aidegani expresses belief and worship in physical and immanent deities within this realm and others. Aidegani does not regard souls to exist, and reincarnation is believed to happen in the form of physical transfer. Central authority in Aidegani exists solely in the institution of the Elekoneta and by extension, the State of Onchera, however, this is not excercised. There is much diversity of belief and practice evident among practitioners. Etymology See also Notes References	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "title", "value": "Aidegani"}, {"name": "founder", "value": "[[Aide the Sun]]"}], "name": "infobox religion", "type": "template"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Aidegani", "type": "text"}]}, {"text": "  is the native and ethnic religion of ", "type": "text"}, {"type": "internal_link", "target": "Onchera", "display": null}, {"text": ". As polytheistic and naturalistic religion, Aidegani expresses belief and worship in physical and immanent deities within this realm and others. Aidegani does not regard souls to exist, and reincarnation is believed to happen in the form of physical transfer. Central authority in Aidegani exists solely in the institution of the ", "type": "text"}, {"type": "internal_link", "target": "Elekoneta", "display": null}, {"text": " and by extension, the State of Onchera, however, this is not excercised. There is much diversity of belief and practice evident among practitioners. ", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Etymology", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "See also", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Notes", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "References", "type": "text"}]}]}	690	2026-03-23 00:04:43.048583+00	2026-03-31 13:37:41.185+00
1	know	onchera	\N	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official_languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[Elekoneta]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mira people|Mira]] in origin, and brought with them a form of the [[Mira languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Elekoneta]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n	Onchera, officially the State of Onchera, is an archipelagic country in West Hashir. Located in the Ouken Ocean, it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: Iparaleroa, Ossela, Maera, Lureta, Tarkolur, Kizgar, Nasseta, and Tssabura. The archipelago is protected from Ouken blood algae by the West Onchera Reef. With a population of 100 million, it is the world's thirteenth-most-populous country. Waves of early Iratssoat settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the Batea people. The Batea were Mira in origin, and brought with them a form of the Mira languages that would later develop into Oncheran. Around the 15th century EC, Batea societies started regularly trading with Tambuli merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states. In 1821, the various kingdoms of Onchera were unified under the first Elekoneta, Aide the Sun, in Amalur. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian Hadashule dynasty. Natural disasters such as the Ouken Algae Flood (2259), rebellion in Melcharia, and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state. The growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the Rabeaneta (Supreme Commander), who resided in the theocratic capital of Amalur. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by Mitale Tiguzo in 2994. Contact was made with the outside world in 3005, after Taranman circumnavigation through the Ouken Ocean with iron-hulled ships. The immense upheaval this caused in Onchera led to Izaro the Great, at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state. History Early settlement to classical history The first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting. The first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices. Tambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. In 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo. Imperial era Feudal era Modern era Geography Onchera is an archipelago of 3,213 islands situated in the Ouken Ocean in West Hashir. The islands are grouped into provinces centred on the seven largest islands: Iparaleroa, Ossela, Maera, Lureta, Tarkolur, Kizgar, Nasseta, and Tssabura. The West Onchera Reef protects the archipelago from the toxic Ouken blood algae prevalent in the open ocean. Government and politics Demographics Religion The predominant faith is the Aidegani, practised by approximately 72.1% of the population. Tanism accounts for 20.0%, Havimism for 5.9%, with the remaining 2% following other traditions.	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "name", "value": "State of Onchera"}, {"name": "native_name", "value": "Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])"}, {"name": "flag", "value": "Ontsseraflag.png"}, {"name": "capital", "value": "[[Amalur]]"}, {"name": "official_languages", "value": "[[Oncheran language|Oncheran]], [[Great Tambuli]]"}, {"name": "religion", "value": "72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others"}, {"name": "government_type", "value": "Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship"}, {"name": "leader_title1", "value": "[[Elekoneta]]"}, {"name": "leader_name1", "value": "[[Taneta]]"}, {"name": "legislature", "value": "[[Batzar Nagusia]]"}, {"name": "area", "value": "~361,321"}, {"name": "Population", "value": "~100,000,000"}, {"name": "Currency", "value": "[[Oncheran tssanpon|Tssanpon]]"}, {"name": "Calling code", "value": "+67"}, {"name": "Internet TLD", "value": ".on"}], "name": "Infobox country", "type": "template"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Onchera", "type": "text"}]}, {"text": ", officially the ", "type": "text"}, {"type": "bold", "children": [{"text": "State of Onchera", "type": "text"}]}, {"text": ", is an archipelagic country in ", "type": "text"}, {"type": "internal_link", "target": "West Hashir", "display": null}, {"text": ". Located in the ", "type": "text"}, {"type": "internal_link", "target": "Ouken Ocean", "display": null}, {"text": ", it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: ", "type": "text"}, {"type": "internal_link", "target": "Iparaleroa", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Ossela", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Maera", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Lureta", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Tarkolur", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Kizgar", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Nasseta", "display": null}, {"text": ", and ", "type": "text"}, {"type": "internal_link", "target": "Tssabura", "display": null}, {"text": ". The archipelago is protected from ", "type": "text"}, {"type": "internal_link", "target": "Ouken blood algae", "display": null}, {"text": " by the ", "type": "text"}, {"type": "internal_link", "target": "West Onchera Reef", "display": null}, {"text": ". With a population of 100 million, it is the world's thirteenth-most-populous country.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Waves of early ", "type": "text"}, {"type": "internal_link", "target": "Iratssoat", "display": null}, {"text": " settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the ", "type": "text"}, {"type": "internal_link", "target": "Batea people", "display": null}, {"text": ". The Batea were ", "type": "text"}, {"type": "internal_link", "target": "Mira people", "display": [{"text": "Mira", "type": "text"}]}, {"text": " in origin, and brought with them a form of the ", "type": "text"}, {"type": "internal_link", "target": "Mira languages", "display": null}, {"text": " that would later develop into ", "type": "text"}, {"type": "internal_link", "target": "Oncheran language", "display": [{"text": "Oncheran", "type": "text"}]}, {"text": ". Around the 15th century EC, Batea societies started regularly trading with ", "type": "text"}, {"type": "internal_link", "target": "Tambuli", "display": null}, {"text": " merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "In 1821, the various kingdoms of Onchera were unified under the first ", "type": "text"}, {"type": "internal_link", "target": "Elekoneta", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Aide the Sun", "display": null}, {"text": ", in ", "type": "text"}, {"type": "internal_link", "target": "Amalur", "display": null}, {"text": ". This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian ", "type": "text"}, {"type": "internal_link", "target": "Hadashule dynasty", "display": null}, {"text": ". Natural disasters such as the ", "type": "text"}, {"type": "internal_link", "target": "Ouken Algae Flood (2259)", "display": null}, {"text": ", rebellion in ", "type": "text"}, {"type": "internal_link", "target": "Melcharia", "display": null}, {"text": ", and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ", "type": "text"}, {"type": "italic", "children": [{"type": "internal_link", "target": "Rabeaneta", "display": null}]}, {"text": " (Supreme Commander), who resided in the theocratic capital of ", "type": "text"}, {"type": "internal_link", "target": "Amalur", "display": null}, {"text": ". After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by ", "type": "text"}, {"type": "internal_link", "target": "Mitale Tiguzo", "display": null}, {"text": " in 2994.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Contact was made with the outside world in 3005, after Taranman circumnavigation through the ", "type": "text"}, {"type": "internal_link", "target": "Ouken Ocean", "display": null}, {"text": " with iron-hulled ships. The immense upheaval this caused in Onchera led to ", "type": "text"}, {"type": "internal_link", "target": "Izaro the Great", "display": null}, {"text": ", at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\\r", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "History", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Early settlement to classical history", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Tambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "In 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\\r", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Imperial era", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Feudal era", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Modern era", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Geography", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Onchera is an archipelago of 3,213 islands situated in the ", "type": "text"}, {"type": "internal_link", "target": "Ouken Ocean", "display": null}, {"text": " in ", "type": "text"}, {"type": "internal_link", "target": "West Hashir", "display": null}, {"text": ". The islands are grouped into provinces centred on the seven largest islands: ", "type": "text"}, {"type": "internal_link", "target": "Iparaleroa", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Ossela", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Maera", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Lureta", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Tarkolur", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Kizgar", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Nasseta", "display": null}, {"text": ", and ", "type": "text"}, {"type": "internal_link", "target": "Tssabura", "display": null}, {"text": ". The ", "type": "text"}, {"type": "internal_link", "target": "West Onchera Reef", "display": null}, {"text": " protects the archipelago from the toxic ", "type": "text"}, {"type": "internal_link", "target": "Ouken blood algae", "display": null}, {"text": " prevalent in the open ocean.\\r", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Government and politics", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Demographics", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Religion", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The predominant faith is the ", "type": "text"}, {"type": "internal_link", "target": "Aidegani", "display": null}, {"text": ", practised by approximately 72.1% of the population. ", "type": "text"}, {"type": "internal_link", "target": "Tanism", "display": null}, {"text": " accounts for 20.0%, ", "type": "text"}, {"type": "internal_link", "target": "Havimism", "display": null}, {"text": " for 5.9%, with the remaining 2% following other traditions.\\r", "type": "text"}]}, {"name": "Countries", "type": "category"}, {"name": "Monarchies", "type": "category"}, {"type": "paragraph", "children": [{"text": "\\r ", "type": "text"}, {"text": "\\r", "type": "text"}]}]}	6077	2026-03-19 18:06:38.360525+00	2026-03-31 20:10:37.134+00
2	know	tornamm	\N	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Tornamm na Kaçeratt''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Maenn, Çodd ann Damm"<br/>("By Sun and By Soil")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}		\N	2103	2026-03-19 18:13:15.72816+00	2026-03-22 08:54:16.715+00
18	know	proposed_origin_for_humanity	\N	Proposed origin for humanity			\N	0	2026-03-20 15:32:17.266441+00	2026-03-20 15:32:17.266441+00
19	know	nilscodd	\N	Nilscodd			\N	0	2026-03-20 15:32:34.498483+00	2026-03-20 15:32:34.498483+00
24	know	university_of_almisan	\N	University of Almisan			\N	0	2026-03-20 18:55:23.365363+00	2026-03-20 18:55:23.365363+00
25	know	Nilscoddi_language	\N	Nilscoddi language			\N	0	2026-03-20 19:27:04.605011+00	2026-03-20 19:27:04.605011+00
26	know	Rabeaneta	\N	Rabeaneta			\N	0	2026-03-21 15:09:30.568175+00	2026-03-21 15:09:30.568175+00
23	know	Oncheran_language	\N	Oncheran language	\r\n\r\n\r\n{| class="wikitable" style="text-align:center;"\r\n|-\r\n! !! Front !! Central !! Back\r\n|-\r\n! High\r\n| <br>i<br>IPA: /i/\r\n| \r\n| <br>u<br>IPA: /u/\r\n|-\r\n! Mid\r\n| <br>e<br>IPA: /e/\r\n| \r\n| <br>o<br>IPA: /o/\r\n|-\r\n! Low\r\n| \r\n| <br>a<br>IPA: /a/\r\n| \r\n|}		\N	247	2026-03-20 18:39:55.918015+00	2026-03-22 08:59:44.344+00
29	know	Kingdom_of_Nilscodd	\N	Kingdom of Nilscodd	{{Infobox country\r\n| common_name = Kingdom of Nilscodd\r\n| official_name = Kingdom of Nilscodd\r\n| native_name = ''Nilscodd na Mattmon''\r\n| image_flag = Flag_of_Nilscodd.png\r\n}}\r\n\r\nThe '''Kingdom of Nilscodd''' was a 	The Kingdom of Nilscodd was a	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "common_name", "value": "Kingdom of Nilscodd"}, {"name": "official_name", "value": "Kingdom of Nilscodd"}, {"name": "native_name", "value": "''Nilscodd na Mattmon''"}, {"name": "image_flag", "value": "Flag_of_Nilscodd.png"}], "name": "Infobox country", "type": "template"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The ", "type": "text"}, {"type": "bold", "children": [{"text": "Kingdom of Nilscodd", "type": "text"}]}, {"text": " was a ", "type": "text"}]}]}	215	2026-03-22 09:48:15.557133+00	2026-03-30 17:56:03.882+00
16	know	Krelitser	\N	Krelitser	{{Infobox country\n|name = Republic of Krelitser\n|native_name = Krėlıtse Tsıda ([[Krelitseran language|Krelitseran]])\n|image = Krelitflag.png\n|Capital = [[Kirathara]]\n|Official languages = [[Krelitseran language|Krelitseran]]\n|Recognised regional languages = 22 regional official languages\n|Ethnic groups = 65% [[Krelits|Krelit]] <br> 5.7% [[Otse people|Otse]] <br> 3.2% [[Aris]] <br> 13.1% other <br> 13% not reported\n|Religion = 85.8% [[Kiranshelokism]] <br> 7.3% no religion <br> 3.9% [[Remanism]] <br> 3% others\n|Demonym = Krelitseran\n|Government = Federal hereditary republic\n|Queen = [[Šerėnta]]\n|Legislature = [[Realm Council]]\n|Formation = [[Kingdom of Krelitser]]: 1703 <br> [[Kingdom of Kirathara]]: 1945\n|Currency = Krelit shara (KS)\n|Calling code = +91\n|Internet TLD = .kr\n}}\n\n'''Krelitser''', officially the '''Republic of Krelitser''' is a country in the central and northern area of [[Thentey]]. With over 120 million people, Krelitser is the largest and most populous country in Thentey, and eleventh most in the world. It is a moderately urbanised country, with population mostly concentrated in regional capitals in the southern areas, and extremely concetrated in a few cities in the northern areas.\n\nHuman settlement on the territory of modern Krelitser dates back to the [[Lower kys era]]. The [[Kronthey]] emerged as a distinct group in [[Thentey]] between the 11th and 12th centuries EC. The early Kronthey tribes centralised into early states in the periphery of the Negewians. \n\n\n\nThe [[Principality of Kirathara]] would go on to unite most of the region by the 20th century, eventually taking the title of kingdom. [[Dynastic conflicts in the 23th century]] tore the kingdom to pieces, and invited several partitions of the kingdom's former territory. Several states left in the wake of the dissolution came to recognise a shared leader, and formed the [[Krelitser League]], which by the 25th century, had taken control over most of the former territory of the kingdom. In 2490, the league would formally centralise into the Republic of Krelitser. By the early 27th century, Krelitser had vastly expanded through conquest, annexation, and the efforts of Krelit explorers, becoming and remaining the third-largest empire in history.\n\nKrelitser began industrialising in the mid 30th century, becoming a major exporter of raw minerals. After disasterous failure in the [[Third Krelitser-Otse war]], Krelitser introduced labour reforms to quell domestic unrest. Internal pressure over the loss led to a large reform and centralisation of the Krelitserian military.\n\n== Etymology ==\n\n''Krelitser'' is a scholasticisation of the Krelit word name, Krėlıtse. Usage of the name dates back to before the Kingdom of Krelitser. Etymologically, ''Krėlıtse'' comes from the Proto-Dardnish '''krols₁''', meaning "heart". The Mazarean region of Rulšam is etymologically related, meaning "heartland".\n\n== History ==\n\n=== Prehistory ===\n\n=== Early history ===\n\n=== Kingdom of Krelitser ===\nThe establishment of the first Krelit states in the\n\n=== Kingdom of Kirathara ===\n\n=== Unification ===\n\n=== Early realm ===\n\n=== Industrialisation ===\n\n== Government and politics ==\nKrelitser is an absolute monarchy with a federal system, ruled by a queen as head of state, and an appointed prime minister a \n\n=== Political divisions ===\n\n=== Military ===\n\n== Economy ==\n\nKrelitser's\n	Krelitser, officially the Republic of Krelitser is a country in the central and northern area of Thentey. With over 120 million people, Krelitser is the largest and most populous country in Thentey, and eleventh most in the world. It is a moderately urbanised country, with population mostly concentrated in regional capitals in the southern areas, and extremely concetrated in a few cities in the northern areas. Human settlement on the territory of modern Krelitser dates back to the Lower kys era. The Kronthey emerged as a distinct group in Thentey between the 11th and 12th centuries EC. The early Kronthey tribes centralised into early states in the periphery of the Negewians. The Principality of Kirathara would go on to unite most of the region by the 20th century, eventually taking the title of kingdom. Dynastic conflicts in the 23th century tore the kingdom to pieces, and invited several partitions of the kingdom's former territory. Several states left in the wake of the dissolution came to recognise a shared leader, and formed the Krelitser League, which by the 25th century, had taken control over most of the former territory of the kingdom. In 2490, the league would formally centralise into the Republic of Krelitser. By the early 27th century, Krelitser had vastly expanded through conquest, annexation, and the efforts of Krelit explorers, becoming and remaining the third-largest empire in history. Krelitser began industrialising in the mid 30th century, becoming a major exporter of raw minerals. After disasterous failure in the Third Krelitser-Otse war, Krelitser introduced labour reforms to quell domestic unrest. Internal pressure over the loss led to a large reform and centralisation of the Krelitserian military. Etymology Krelitser is a scholasticisation of the Krelit word name, Krėlıtse. Usage of the name dates back to before the Kingdom of Krelitser. Etymologically, Krėlıtse comes from the Proto-Dardnish krols₁, meaning "heart". The Mazarean region of Rulšam is etymologically related, meaning "heartland". History Prehistory Early history Kingdom of Krelitser The establishment of the first Krelit states in the Kingdom of Kirathara Unification Early realm Industrialisation Government and politics Krelitser is an absolute monarchy with a federal system, ruled by a queen as head of state, and an appointed prime minister a Political divisions Military Economy Krelitser's	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "name", "value": "Republic of Krelitser"}, {"name": "native_name", "value": "Krėlıtse Tsıda ([[Krelitseran language|Krelitseran]])"}, {"name": "image", "value": "Krelitflag.png"}, {"name": "Capital", "value": "[[Kirathara]]"}, {"name": "Official languages", "value": "[[Krelitseran language|Krelitseran]]"}, {"name": "Recognised regional languages", "value": "22 regional official languages"}, {"name": "Ethnic groups", "value": "65% [[Krelits|Krelit]] <br> 5.7% [[Otse people|Otse]] <br> 3.2% [[Aris]] <br> 13.1% other <br> 13% not reported"}, {"name": "Religion", "value": "85.8% [[Kiranshelokism]] <br> 7.3% no religion <br> 3.9% [[Remanism]] <br> 3% others"}, {"name": "Demonym", "value": "Krelitseran"}, {"name": "Government", "value": "Federal hereditary republic"}, {"name": "Queen", "value": "[[Šerėnta]]"}, {"name": "Legislature", "value": "[[Realm Council]]"}, {"name": "Formation", "value": "[[Kingdom of Krelitser]]: 1703 <br> [[Kingdom of Kirathara]]: 1945"}, {"name": "Currency", "value": "Krelit shara (KS)"}, {"name": "Calling code", "value": "+91"}, {"name": "Internet TLD", "value": ".kr"}], "name": "Infobox country", "type": "template"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Krelitser", "type": "text"}]}, {"text": ", officially the ", "type": "text"}, {"type": "bold", "children": [{"text": "Republic of Krelitser", "type": "text"}]}, {"text": " is a country in the central and northern area of ", "type": "text"}, {"type": "internal_link", "target": "Thentey", "display": null}, {"text": ". With over 120 million people, Krelitser is the largest and most populous country in Thentey, and eleventh most in the world. It is a moderately urbanised country, with population mostly concentrated in regional capitals in the southern areas, and extremely concetrated in a few cities in the northern areas.", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Human settlement on the territory of modern Krelitser dates back to the ", "type": "text"}, {"type": "internal_link", "target": "Lower kys era", "display": null}, {"text": ". The ", "type": "text"}, {"type": "internal_link", "target": "Kronthey", "display": null}, {"text": " emerged as a distinct group in ", "type": "text"}, {"type": "internal_link", "target": "Thentey", "display": null}, {"text": " between the 11th and 12th centuries EC. The early Kronthey tribes centralised into early states in the periphery of the Negewians. ", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The ", "type": "text"}, {"type": "internal_link", "target": "Principality of Kirathara", "display": null}, {"text": " would go on to unite most of the region by the 20th century, eventually taking the title of kingdom. ", "type": "text"}, {"type": "internal_link", "target": "Dynastic conflicts in the 23th century", "display": null}, {"text": " tore the kingdom to pieces, and invited several partitions of the kingdom's former territory. Several states left in the wake of the dissolution came to recognise a shared leader, and formed the ", "type": "text"}, {"type": "internal_link", "target": "Krelitser League", "display": null}, {"text": ", which by the 25th century, had taken control over most of the former territory of the kingdom. In 2490, the league would formally centralise into the Republic of Krelitser. By the early 27th century, Krelitser had vastly expanded through conquest, annexation, and the efforts of Krelit explorers, becoming and remaining the third-largest empire in history.", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Krelitser began industrialising in the mid 30th century, becoming a major exporter of raw minerals. After disasterous failure in the ", "type": "text"}, {"type": "internal_link", "target": "Third Krelitser-Otse war", "display": null}, {"text": ", Krelitser introduced labour reforms to quell domestic unrest. Internal pressure over the loss led to a large reform and centralisation of the Krelitserian military.", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Etymology", "type": "text"}]}, {"type": "paragraph", "children": [{"type": "italic", "children": [{"text": "Krelitser", "type": "text"}]}, {"text": " is a scholasticisation of the Krelit word name, Krėlıtse. Usage of the name dates back to before the Kingdom of Krelitser. Etymologically, ", "type": "text"}, {"type": "italic", "children": [{"text": "Krėlıtse", "type": "text"}]}, {"text": " comes from the Proto-Dardnish ", "type": "text"}, {"type": "bold", "children": [{"text": "krols₁", "type": "text"}]}, {"text": ", meaning \\"heart\\". The Mazarean region of Rulšam is etymologically related, meaning \\"heartland\\".", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "History", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Prehistory", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Early history", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Kingdom of Krelitser", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The establishment of the first Krelit states in the", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Kingdom of Kirathara", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Unification", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Early realm", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Industrialisation", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Government and politics", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Krelitser is an absolute monarchy with a federal system, ruled by a queen as head of state, and an appointed prime minister a ", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Political divisions", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Military", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Economy", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Krelitser's", "type": "text"}]}]}	3393	2026-03-20 15:26:57.141477+00	2026-04-04 10:52:23.216+00
6	know	almisan	\N	Almisan	{{Infobox country\r\n| name = City of Almisan\r\n| native_name = ''Bolia nà Almisàn'' ([[Classical Myreni]])\r\n| image_flag=FlagofAlmisan.png\r\n| Official languages=[[Classical Myreni]], [[Almisani language|Almisani]]\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''', is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	Almisan, officially the City of Almisan, is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the University of Almisan. Almisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.	\N	1016	2026-03-20 03:02:13.935968+00	2026-03-23 00:25:50.429+00
3	know	asyltas	\N	Asyltas	{{Infobox country\r\n| common_name = Asyltas\r\n| official_name = Tribal Union of Asyltas\r\n| native_name = ''Asyltas Ru Doãg''\r\n| image_flag = Asyltas.svg\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Ķanl Dog"<br/>("Unity in Blood")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Üksik]]\r\n| largest_city = [[Tassik]]\r\n| official_languages = [[Mangurt language|Mangurt]]\r\n| ethnic_groups = 88% [[Sedentary Mangurt|Sedentary Mangurt]]<br/>12% [[Nomadic Mangurt|]] (According to official sources, true distribution challenged)\r\n| demonym = Tornammi\r\n| government_type = [[Asyltas Consularity|Consular Republic]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Supreme Director\r\n| leader_name1 = [[Edil]]\r\n| leader_title2 = Tribal Council Chairman\r\n| leader_name2 = [[Merke]]\r\n| legislature = [[Supreme Tribal Council]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Krelitser|Krelitser]]\r\n| established_date1 = c. 1830s EC\r\n| established_event2 = [[Asyltas Slave Rebellion|Proclamation of Independence]]\r\n| established_date2 = 1895 EC\r\n| established_event3 = [[Unification of the North|First Union Drafted]]\r\n| established_date3 = 1901 EC\r\n| established_event4 = [[Great Patriotic War|Krelitser Occupation]]\r\n| established_date4 = 1913 EC\r\n| established_event5 = [[Reunification of the North|Second Union Established]]\r\n| established_date5 = 1931 EC\r\n| area_km2 = ~4,400,000\r\n| population_estimate = ~31,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 7.8\r\n| GDP_PPP = ʓ 745.2 trillion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ʓ 21 000 000\r\n| currency = [[Asyltas Zom]] (ʓ)\r\n| time_zone = NPST\r\n| drives_on = right\r\n| calling_code = +88\r\n| internet_tld = .at\r\n}}\r\n'''Asyltas,''' also known as	Asyltas, also known as	\N	1954	2026-03-19 18:13:24.71611+00	2026-03-23 17:20:09.493+00
33	know	Mitale_Tiguzo	\N	Mitale Tiguzo			\N	0	2026-03-25 16:39:01.319645+00	2026-03-25 16:39:01.319645+00
31	know	Amalur	\N	Amalur	{{Infobox settlement\r\n|name = Amalur\r\n\r\n}}\r\n\r\n'''Amalur''' is the [[Capital of Onchera|de-jure capital city]] of [[Onchera]]. As of 3280, the city had a population of 10.21 million, making it the second-most populous city in Ontssera. Nearly three-fourths (72.8%) of [[Lureta|Lureta Circuit]]'s population resides in the city. \r\n\r\nAmalur is the oldest municipality in Onchera, having been traditional home of the [[High Priestess]], and many of the sacred mystery groups of [[Aidegani]]. The city was originally founded as a [[Tambuli]] merchant outpost, but became the centre of a new society, as Oncheran tribes began settling in the area. The High Priestess of Onchera continues to reside in Amalur, even though state and military functions are held in [[Rabkareta]]. \r\n\r\nThe city was the scene of many events of the [[Trumoia period]] and the [[Rabeaneta period]]. When the modern Oncheran state was established by the [[Araun (Clan)|Araun clan]], they chose to centre it in their traditional home, which was in the same declaration, named Rabkareta.\r\n\r\n	Amalur is the de-jure capital city of Onchera. As of 3280, the city had a population of 10.21 million, making it the second-most populous city in Ontssera. Nearly three-fourths (72.8%) of Lureta Circuit's population resides in the city. Amalur is the oldest municipality in Onchera, having been traditional home of the High Priestess, and many of the sacred mystery groups of Aidegani. The city was originally founded as a Tambuli merchant outpost, but became the centre of a new society, as Oncheran tribes began settling in the area. The High Priestess of Onchera continues to reside in Amalur, even though state and military functions are held in Rabkareta. The city was the scene of many events of the Trumoia period and the Rabeaneta period. When the modern Oncheran state was established by the Araun clan, they chose to centre it in their traditional home, which was in the same declaration, named Rabkareta.	\N	1058	2026-03-22 16:45:28.29413+00	2026-03-25 17:02:39.14+00
30	know	Aide_the_Sun	\N	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|succession= Elekoneta of Onchera\r\n|title=[[Elekoneta|Elekoneta of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Aidegani]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''', was the founder and first [[Elekoneta]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state.\r\n \r\n	Suda Aidema Tssera (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as Aide the Sun, was the founder and first Elekoneta of the unified State of Onchera. A Batea priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state.	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "name", "value": "Aide the Sun"}, {"name": "native_name", "value": "Mizeko Aide ([[Oncheran language|Oncheran]])"}, {"name": "image", "value": "Mizeko_Aide_temple_mosaic.png"}, {"name": "caption", "value": "Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC"}, {"name": "succession", "value": "Elekoneta of Onchera"}, {"name": "title", "value": "[[Elekoneta|Elekoneta of Onchera]]"}, {"name": "reign", "value": "1821 EC – 1834 EC"}, {"name": "predecessor", "value": "Title created"}, {"name": "successor", "value": "[[Aidetz I]]"}, {"name": "birth_date", "value": "14th day of Suda, 1784 EC"}, {"name": "birth_place", "value": "[[Amalur]], [[Lureta]]"}, {"name": "death_date", "value": "9th day of Negu, 1834 EC (aged 50)"}, {"name": "death_place", "value": "[[Amalur]], [[Lureta]]"}, {"name": "burial_place", "value": "[[Great Temple Palace]], [[Amalur]]"}, {"name": "full_name", "value": "Suda Aidema Tssera"}, {"name": "house", "value": "[[House of Tssera]]"}, {"name": "religion", "value": "[[Aidegani]]"}, {"name": "spouse", "value": ""}, {"name": "children", "value": ""}], "name": "Infobox royalty", "type": "template"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Suda Aidema Tssera", "type": "text"}]}, {"text": " (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as ", "type": "text"}, {"type": "bold", "children": [{"text": "Aide the Sun", "type": "text"}]}, {"text": ", was the founder and first ", "type": "text"}, {"type": "internal_link", "target": "Elekoneta", "display": null}, {"text": " of the unified ", "type": "text"}, {"type": "internal_link", "target": "Onchera", "display": [{"text": "State of Onchera", "type": "text"}]}, {"text": ". A ", "type": "text"}, {"type": "internal_link", "target": "Batea people", "display": [{"text": "Batea", "type": "text"}]}, {"text": " priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state.\\r", "type": "text"}]}]}	1109	2026-03-22 16:17:03.677794+00	2026-03-30 11:25:40.798+00
34	celestial	Therne	sunly	Therne	{{Infobox star|from=therne}}\r\n\r\n'''Therne''', historically known as '''the Follower''', is the second [[star]] of the [[celestial:Sunly system]] and the binary companion to [[Sun|the Sun]]. It is a [[red dwarf]] of [[spectral classification]] M3V, orbiting the Sun at a mean distance of 30 [[Astronomical unit|AU]] with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a [[full moon]] depending on its orbital phase.\r\n	Therne, historically known as the Follower, is the second star of the celestial:Sunly system and the binary companion to the Sun. It is a red dwarf of spectral classification M3V, orbiting the Sun at a mean distance of 30 AU with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a full moon depending on its orbital phase.	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "from", "value": "therne"}], "name": "Infobox star", "type": "template"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Therne", "type": "text"}]}, {"text": ", historically known as ", "type": "text"}, {"type": "bold", "children": [{"text": "the Follower", "type": "text"}]}, {"text": ", is the second ", "type": "text"}, {"type": "internal_link", "target": "star", "display": null}, {"text": " of the ", "type": "text"}, {"type": "domain_link", "domain": "celestial", "target": "Sunly system", "display": null}, {"text": " and the binary companion to ", "type": "text"}, {"type": "internal_link", "target": "Sun", "display": [{"text": "the Sun", "type": "text"}]}, {"text": ". It is a ", "type": "text"}, {"type": "internal_link", "target": "red dwarf", "display": null}, {"text": " of ", "type": "text"}, {"type": "internal_link", "target": "spectral classification", "display": null}, {"text": " M3V, orbiting the Sun at a mean distance of 30 ", "type": "text"}, {"type": "internal_link", "target": "Astronomical unit", "display": [{"text": "AU", "type": "text"}]}, {"text": " with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a ", "type": "text"}, {"type": "internal_link", "target": "full moon", "display": null}, {"text": " depending on its orbital phase.\\r", "type": "text"}]}]}	533	2026-03-26 15:45:04.832426+00	2026-03-30 13:59:06.667+00
41	know	Batea_people	\N	Batea people	The Batea people  were an ancient people who immigrated to the [[Oncheran archipelago]] during the Batea period 100EC and are characterized by the existence of Batea material culture. \r\n\r\n	The Batea people were an ancient people who immigrated to the Oncheran archipelago during the Batea period 100EC and are characterized by the existence of Batea material culture.	{"type": "document", "children": [{"type": "paragraph", "children": [{"text": "The Batea people  were an ancient people who immigrated to the ", "type": "text"}, {"type": "internal_link", "target": "Oncheran archipelago", "display": null}, {"text": " during the Batea period 100EC and are characterized by the existence of Batea material culture. \\r", "type": "text"}]}]}	188	2026-03-30 15:51:54.499854+00	2026-03-30 15:54:12.975+00
36	celestial	Sunly_system	\N	Sunly system	hi	hi	{"type": "document", "children": [{"type": "paragraph", "children": [{"text": "hi", "type": "text"}]}]}	2	2026-03-29 08:37:59.404579+00	2026-03-31 12:12:23.554+00
37	know	Odolagozo	\N	Odolagozo	[[Image:red_algae.jpg|thumb|200px|Rooted Tssabura blood-algae.]]\r\n\r\nOdolagozo (pronounced [ˈo̞dola.ɡo.s̻o]) is a sweet algae wine with high acidity and moderate alcohol content produced in the southern coasts of [[Onchera]]. Chaburra blood-algae is the definining component of Odolagozo, setting it aside from other Hashiran algae wines.\r\n\r\nWhile commonly brewed with a pale red variety, pink varieties exist in some breweries. It is usually served during daytime as an accompaniment to raxetas, and during evening and nighttime celeberations, to moliras. It typically has between 9.5 and 11.5 ABV.\r\n\r\n	Odolagozo (pronounced [ˈo̞dola.ɡo.s̻o]) is a sweet algae wine with high acidity and moderate alcohol content produced in the southern coasts of Onchera. Chaburra blood-algae is the definining component of Odolagozo, setting it aside from other Hashiran algae wines. While commonly brewed with a pale red variety, pink varieties exist in some breweries. It is usually served during daytime as an accompaniment to raxetas, and during evening and nighttime celeberations, to moliras. It typically has between 9.5 and 11.5 ABV.	{"type": "document", "children": [{"type": "paragraph", "children": [{"type": "image", "options": [{"type": "thumb"}, {"type": "width", "value": 200}, {"text": "Rooted Tssabura blood-algae.", "type": "caption"}], "filename": "red_algae.jpg"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Odolagozo (pronounced [ˈo̞dola.ɡo.s̻o]) is a sweet algae wine with high acidity and moderate alcohol content produced in the southern coasts of ", "type": "text"}, {"type": "internal_link", "target": "Onchera", "display": null}, {"text": ". Chaburra blood-algae is the definining component of Odolagozo, setting it aside from other Hashiran algae wines.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "While commonly brewed with a pale red variety, pink varieties exist in some breweries. It is usually served during daytime as an accompaniment to raxetas, and during evening and nighttime celeberations, to moliras. It typically has between 9.5 and 11.5 ABV.\\r", "type": "text"}]}]}	606	2026-03-29 12:59:59.886011+00	2026-03-29 13:07:55.474+00
9	know	rabekareta	\N	Rabekareta	{{infobox settlement\r\n|name= Rabekareta\r\n|image=photo-1496823407868-80f47c7453b5.jpg.webp\r\n}}\r\n\r\n'''Rabekareta''', officially the '''Rabekareta Federal Metropolis''' is the [[Capital of Onchera|de-facto capital]] and [[List of cities in Onchera|most populous city]] of [[Onchera]]. 	Rabekareta, officially the Rabekareta Federal Metropolis is the de-facto capital and most populous city of Onchera.	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "name", "value": "Rabekareta"}, {"name": "image", "value": "photo-1496823407868-80f47c7453b5.jpg.webp"}], "name": "infobox settlement", "type": "template"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Rabekareta", "type": "text"}]}, {"text": ", officially the ", "type": "text"}, {"type": "bold", "children": [{"text": "Rabekareta Federal Metropolis", "type": "text"}]}, {"text": " is the ", "type": "text"}, {"type": "internal_link", "target": "Capital of Onchera", "display": [{"text": "de-facto capital", "type": "text"}]}, {"text": " and ", "type": "text"}, {"type": "internal_link", "target": "List of cities in Onchera", "display": [{"text": "most populous city", "type": "text"}]}, {"text": " of ", "type": "text"}, {"type": "internal_link", "target": "Onchera", "display": null}, {"text": ". ", "type": "text"}]}]}	282	2026-03-20 14:22:55.823162+00	2026-03-30 10:13:00.813+00
39	know	Elekoneta	\N	Elekoneta			{"type": "document", "children": []}	0	2026-03-30 11:24:17.785244+00	2026-03-30 11:24:17.785244+00
40	know	Metric_system	\N	Metric system			{"type": "document", "children": []}	0	2026-03-30 15:30:46.50303+00	2026-03-30 15:30:46.50303+00
42	calendar	republican-calendar	\N	Republican Calendar			\N	0	2026-03-30 18:07:23.547406+00	2026-03-30 18:07:23.547406+00
43	calendar	rose-calendar	\N	Rose Calendar			\N	0	2026-03-31 01:00:26.33747+00	2026-03-31 01:00:26.33747+00
15	know	Kiranshelokism	\N	Kiranshelokism	[[File:Тхост._дзуар.jpg|thumb|Dhoqo (Đoko) Temple, dedicated to Ževra, in the Ŧovum Gorge, Kroŧ, Mowum Republic]]\n\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\n\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a ''volavont'', which can include temples, shrines, altars, and any physical structure accociated with worship.\n\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \n\n\n\n== Status ==\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \n\n\n== Beliefs ==\n=== Vola ===\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \n\n\n== History ==\n=== Early roots ===\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \n\n	Kiranshelokism (Verėli Kıranšelok, "Ardent Celestialism") is the state religion of Krelitser. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion. Kiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as vola. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The vola are worshipped at any structure classified as a volavont, which can include temples, shrines, altars, and any physical structure accociated with worship. Kiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised volavont, although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. Status Kiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. Beliefs Vola Kiranshelokism is polytheistic, involving the veneration of many deities known as vola. Officially, there is no agreed number of vola, as they vary between regional Kiranshelokist pratices, with some vola having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. Vola are not regarded as omnipotent, omniscient, or necessarily immortal. History Early roots Kiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion	{"type": "document", "children": [{"type": "paragraph", "children": [{"type": "image", "options": [{"type": "thumb"}, {"text": "Dhoqo (Đoko) Temple, dedicated to Ževra, in the Ŧovum Gorge, Kroŧ, Mowum Republic", "type": "caption"}], "filename": "Тхост._дзуар.jpg"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Kiranshelokism", "type": "text"}]}, {"text": " (", "type": "text"}, {"type": "italic", "children": [{"text": "Verėli Kıranšelok", "type": "text"}]}, {"text": ", \\"Ardent Celestialism\\") is the state religion of ", "type": "text"}, {"type": "internal_link", "target": "Krelitser", "display": null}, {"text": ". Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Kiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ", "type": "text"}, {"type": "italic", "children": [{"type": "internal_link", "target": "vola", "display": null}]}, {"text": ". There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ", "type": "text"}, {"type": "italic", "children": [{"text": "vola", "type": "text"}]}, {"text": " are worshipped at any structure classified as a ", "type": "text"}, {"type": "italic", "children": [{"text": "volavont", "type": "text"}]}, {"text": ", which can include temples, shrines, altars, and any physical structure accociated with worship.", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Kiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ", "type": "text"}, {"type": "italic", "children": [{"text": "volavont", "type": "text"}]}, {"text": ", although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. ", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Status", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Kiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. ", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "Beliefs", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Vola", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Kiranshelokism is polytheistic, involving the veneration of many deities known as ", "type": "text"}, {"type": "italic", "children": [{"text": "vola", "type": "text"}]}, {"text": ". Officially, there is no agreed number of ", "type": "text"}, {"type": "italic", "children": [{"text": "vola", "type": "text"}]}, {"text": ", as they vary between regional Kiranshelokist pratices, with some ", "type": "text"}, {"type": "italic", "children": [{"text": "vola", "type": "text"}]}, {"text": " having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ", "type": "text"}, {"type": "italic", "children": [{"text": "Vola", "type": "text"}]}, {"text": " are not regarded as omnipotent, omniscient, or necessarily immortal. ", "type": "text"}]}, {"type": "heading", "level": 2, "children": [{"text": "History", "type": "text"}]}, {"type": "heading", "level": 3, "children": [{"text": "Early roots", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Kiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion ", "type": "text"}]}]}	2423	2026-03-20 15:25:44.11398+00	2026-04-03 16:44:34.756+00
10	know	izaro_the_great	\N	Izaro the Great	{{Infobox officeholder\r\n|name=Izaro the Great\r\n|office= Rabeaneta of Onchera\r\n|term_start = 8 Bleeding Stone 3010\r\n|term_end = 25 Radiant Fire 3057\r\n|predecessor=[[Mitale Tiguzo]]|successor=[[Arizia Araun]]\r\n|office2= Head of the [[Araun (clan)|Araun clan]]\r\n|term_start2 = 11 Bleeding Stone 2995\r\n|term_end2 = 25 Radiant Fire 3057\r\n|predecessor2=[[Gaizka Araun]]\r\n|successor2=[[Arizia Araun]]\r\n|Born=7 Waning Iron 2979\r\n|Died=25 Radiant Fire 3057\r\n|Burial=5 Rotting Wood 3057\r\n|Spouse=[[Miren]]\r\n|Clan=[[Araun clan]]\r\n|Father=[[Gaizka Araun|Gaizka]]\r\n|Mother=[[Isturitze]]\r\n|Religion=[[Oncheran religion]]\r\n}}\r\n\r\n'''Izaro Araun''', later known as '''Izaro the Great''' (''Izaro Handia''), was an [[Onchera|Oncheran]] noble and stateswoman who rose to prominence in the closing days of the [[Later Bazambide era]], and was the focal point and leader during the early [[Araun period]]. She led the [[Onchera|State of Onchera]] as ''[[Rabeaneta]]'' (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the [[Rabeaneta period]] and transformed Onchera from a feudal state into an industrialised empire and world power.\r\n\r\n\r\n	Izaro Araun, later known as Izaro the Great (Izaro Handia), was an Oncheran noble and stateswoman who rose to prominence in the closing days of the Later Bazambide era, and was the focal point and leader during the early Araun period. She led the State of Onchera as Rabeaneta (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the Rabeaneta period and transformed Onchera from a feudal state into an industrialised empire and world power.	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "name", "value": "Izaro the Great"}, {"name": "office", "value": "Rabeaneta of Onchera"}, {"name": "term_start", "value": "8 Bleeding Stone 3010"}, {"name": "term_end", "value": "25 Radiant Fire 3057"}, {"name": "predecessor", "value": "[[Mitale Tiguzo]]"}, {"name": "successor", "value": "[[Arizia Araun]]"}, {"name": "office2", "value": "Head of the [[Araun (clan)|Araun clan]]"}, {"name": "term_start2", "value": "11 Bleeding Stone 2995"}, {"name": "term_end2", "value": "25 Radiant Fire 3057"}, {"name": "predecessor2", "value": "[[Gaizka Araun]]"}, {"name": "successor2", "value": "[[Arizia Araun]]"}, {"name": "Born", "value": "7 Waning Iron 2979"}, {"name": "Died", "value": "25 Radiant Fire 3057"}, {"name": "Burial", "value": "5 Rotting Wood 3057"}, {"name": "Spouse", "value": "[[Miren]]"}, {"name": "Clan", "value": "[[Araun clan]]"}, {"name": "Father", "value": "[[Gaizka Araun|Gaizka]]"}, {"name": "Mother", "value": "[[Isturitze]]"}, {"name": "Religion", "value": "[[Oncheran religion]]"}], "name": "Infobox officeholder", "type": "template"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "Izaro Araun", "type": "text"}]}, {"text": ", later known as ", "type": "text"}, {"type": "bold", "children": [{"text": "Izaro the Great", "type": "text"}]}, {"text": " (", "type": "text"}, {"type": "italic", "children": [{"text": "Izaro Handia", "type": "text"}]}, {"text": "), was an ", "type": "text"}, {"type": "internal_link", "target": "Onchera", "display": [{"text": "Oncheran", "type": "text"}]}, {"text": " noble and stateswoman who rose to prominence in the closing days of the ", "type": "text"}, {"type": "internal_link", "target": "Later Bazambide era", "display": null}, {"text": ", and was the focal point and leader during the early ", "type": "text"}, {"type": "internal_link", "target": "Araun period", "display": null}, {"text": ". She led the ", "type": "text"}, {"type": "internal_link", "target": "Onchera", "display": [{"text": "State of Onchera", "type": "text"}]}, {"text": " as ", "type": "text"}, {"type": "italic", "children": [{"type": "internal_link", "target": "Rabeaneta", "display": null}]}, {"text": " (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the ", "type": "text"}, {"type": "internal_link", "target": "Rabeaneta period", "display": null}, {"text": " and transformed Onchera from a feudal state into an industrialised empire and world power.\\r", "type": "text"}]}]}	1195	2026-03-20 14:23:32.287968+00	2026-03-31 04:21:17.089+00
44	calendar	gregorian-calendar	\N	Gregorian Calendar			\N	0	2026-03-31 13:03:58.685267+00	2026-03-31 13:03:58.685267+00
46	celestial	ltoile-brillante-misa	\N	l'étoile brillante Misa			\N	0	2026-04-01 04:19:00.677589+00	2026-04-01 04:19:00.677589+00
48	celestial	seaxnēat	sunly	Seaxnēat			\N	0	2026-04-01 15:52:21.566637+00	2026-04-01 15:57:49.88+00
35	celestial	the-sun	sunly	Sun	{{Infobox star|from=the-sun}}\r\n\r\n'''The Sun''' is the [[star]] at the centre of the [[Sunly system]]. It is a massive sphere of hot [[plasma]], heated to incandescence by [[nuclear fusion]] reactions in its core, radiating energy from its surface mainly as [[visible light]] and [[infrared radiation]]. It is the primary source of energy for life on [[Earth]] and the dominant gravitational body around which all inner system objects orbit.\r\n\r\nThe Sun is a main-sequence star of [[spectral classification]] G2V, with a surface temperature of approximately 5,778 K and a yellow-white colour. It contains roughly 73% [[hydrogen]] and 25% [[helium]] by mass, with trace quantities of heavier elements including [[oxygen]], [[carbon]], and [[iron]]. It formed approximately 4.6 billion years ago from the [[gravitational collapse]] of a region within a large [[molecular cloud]], alongside its binary companion [[Therne]].\r\n\r\nThe Sun is one of two stars in the Sunly system. Its companion, the red dwarf [[Therne]], orbits at a mean distance of 30 AU on a moderately [[Orbital eccentricity|eccentric]] orbit (''e'' = 0.3), completing one circuit every 140.9 years. Despite Therne's prominence in the night sky, it contributes less than 0.004% of Earth's total [[insolation]] and has no measurable effect on surface climate. The stability of planetary orbits around the Sun, including Earth's, is well understood through [[Celestial mechanics|orbital mechanics]]; the critical stability boundary lies at approximately 6.9 AU, far beyond Earth's orbit of 1.02 AU.\r\n\r\nFrom Earth, the Sun appears as a disc roughly 31.4 [[arcminute]]s across — large enough to observe [[sunspot]]s during atmospheric dimming near the horizon. Its apparent brightness of magnitude −26.7 overwhelms all other celestial objects by many orders of magnitude, including Therne at its closest approach (magnitude −13.3). At [[sunset]], [[Rayleigh scattering]] through the atmosphere shifts the Sun's apparent colour from white through yellow and orange to deep red, a phenomenon that is particularly striking during the decades-long periods when Therne is visible near the same horizon, offering a direct colour contrast between the two stars.\r\n\r\nThe Sun's [[habitable zone]] extends from approximately 0.95 to 1.68 AU. Earth, at 1.02 AU, sits comfortably within the conservative inner boundary. The [[frost line]] lies at roughly 2.7 AU, bisecting the [[asteroid belt]], and the Sun's gravitational dominance over planetary orbits extends to the [[Holman-Wiegert limit]] at 6.9 AU, beyond which Therne's perturbations render orbits unstable.\r\n	The Sun is the star at the centre of the Sunly system. It is a massive sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core, radiating energy from its surface mainly as visible light and infrared radiation. It is the primary source of energy for life on Earth and the dominant gravitational body around which all inner system objects orbit. The Sun is a main-sequence star of spectral classification G2V, with a surface temperature of approximately 5,778 K and a yellow-white colour. It contains roughly 73% hydrogen and 25% helium by mass, with trace quantities of heavier elements including oxygen, carbon, and iron. It formed approximately 4.6 billion years ago from the gravitational collapse of a region within a large molecular cloud, alongside its binary companion Therne. The Sun is one of two stars in the Sunly system. Its companion, the red dwarf Therne, orbits at a mean distance of 30 AU on a moderately eccentric orbit (e = 0.3), completing one circuit every 140.9 years. Despite Therne's prominence in the night sky, it contributes less than 0.004% of Earth's total insolation and has no measurable effect on surface climate. The stability of planetary orbits around the Sun, including Earth's, is well understood through orbital mechanics; the critical stability boundary lies at approximately 6.9 AU, far beyond Earth's orbit of 1.02 AU. From Earth, the Sun appears as a disc roughly 31.4 arcminutes across — large enough to observe sunspots during atmospheric dimming near the horizon. Its apparent brightness of magnitude −26.7 overwhelms all other celestial objects by many orders of magnitude, including Therne at its closest approach (magnitude −13.3). At sunset, Rayleigh scattering through the atmosphere shifts the Sun's apparent colour from white through yellow and orange to deep red, a phenomenon that is particularly striking during the decades-long periods when Therne is visible near the same horizon, offering a direct colour contrast between the two stars. The Sun's habitable zone extends from approximately 0.95 to 1.68 AU. Earth, at 1.02 AU, sits comfortably within the conservative inner boundary. The frost line lies at roughly 2.7 AU, bisecting the asteroid belt, and the Sun's gravitational dominance over planetary orbits extends to the Holman-Wiegert limit at 6.9 AU, beyond which Therne's perturbations render orbits unstable.	{"type": "document", "children": [{"type": "paragraph", "children": [{"args": [{"name": "from", "value": "the-sun"}], "name": "Infobox star", "type": "template"}, {"text": "\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"type": "bold", "children": [{"text": "The Sun", "type": "text"}]}, {"text": " is the ", "type": "text"}, {"type": "internal_link", "target": "star", "display": null}, {"text": " at the centre of the ", "type": "text"}, {"type": "internal_link", "target": "Sunly system", "display": null}, {"text": ". It is a massive sphere of hot ", "type": "text"}, {"type": "internal_link", "target": "plasma", "display": null}, {"text": ", heated to incandescence by ", "type": "text"}, {"type": "internal_link", "target": "nuclear fusion", "display": null}, {"text": " reactions in its core, radiating energy from its surface mainly as ", "type": "text"}, {"type": "internal_link", "target": "visible light", "display": null}, {"text": " and ", "type": "text"}, {"type": "internal_link", "target": "infrared radiation", "display": null}, {"text": ". It is the primary source of energy for life on ", "type": "text"}, {"type": "internal_link", "target": "Earth", "display": null}, {"text": " and the dominant gravitational body around which all inner system objects orbit.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The Sun is a main-sequence star of ", "type": "text"}, {"type": "internal_link", "target": "spectral classification", "display": null}, {"text": " G2V, with a surface temperature of approximately 5,778 K and a yellow-white colour. It contains roughly 73% ", "type": "text"}, {"type": "internal_link", "target": "hydrogen", "display": null}, {"text": " and 25% ", "type": "text"}, {"type": "internal_link", "target": "helium", "display": null}, {"text": " by mass, with trace quantities of heavier elements including ", "type": "text"}, {"type": "internal_link", "target": "oxygen", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "carbon", "display": null}, {"text": ", and ", "type": "text"}, {"type": "internal_link", "target": "iron", "display": null}, {"text": ". It formed approximately 4.6 billion years ago from the ", "type": "text"}, {"type": "internal_link", "target": "gravitational collapse", "display": null}, {"text": " of a region within a large ", "type": "text"}, {"type": "internal_link", "target": "molecular cloud", "display": null}, {"text": ", alongside its binary companion ", "type": "text"}, {"type": "internal_link", "target": "Therne", "display": null}, {"text": ".\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The Sun is one of two stars in the Sunly system. Its companion, the red dwarf ", "type": "text"}, {"type": "internal_link", "target": "Therne", "display": null}, {"text": ", orbits at a mean distance of 30 AU on a moderately ", "type": "text"}, {"type": "internal_link", "target": "Orbital eccentricity", "display": [{"text": "eccentric", "type": "text"}]}, {"text": " orbit (", "type": "text"}, {"type": "italic", "children": [{"text": "e", "type": "text"}]}, {"text": " = 0.3), completing one circuit every 140.9 years. Despite Therne's prominence in the night sky, it contributes less than 0.004% of Earth's total ", "type": "text"}, {"type": "internal_link", "target": "insolation", "display": null}, {"text": " and has no measurable effect on surface climate. The stability of planetary orbits around the Sun, including Earth's, is well understood through ", "type": "text"}, {"type": "internal_link", "target": "Celestial mechanics", "display": [{"text": "orbital mechanics", "type": "text"}]}, {"text": "; the critical stability boundary lies at approximately 6.9 AU, far beyond Earth's orbit of 1.02 AU.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "From Earth, the Sun appears as a disc roughly 31.4 ", "type": "text"}, {"type": "internal_link", "target": "arcminute", "display": null}, {"text": "s across — large enough to observe ", "type": "text"}, {"type": "internal_link", "target": "sunspot", "display": null}, {"text": "s during atmospheric dimming near the horizon. Its apparent brightness of magnitude −26.7 overwhelms all other celestial objects by many orders of magnitude, including Therne at its closest approach (magnitude −13.3). At ", "type": "text"}, {"type": "internal_link", "target": "sunset", "display": null}, {"text": ", ", "type": "text"}, {"type": "internal_link", "target": "Rayleigh scattering", "display": null}, {"text": " through the atmosphere shifts the Sun's apparent colour from white through yellow and orange to deep red, a phenomenon that is particularly striking during the decades-long periods when Therne is visible near the same horizon, offering a direct colour contrast between the two stars.\\r", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "The Sun's ", "type": "text"}, {"type": "internal_link", "target": "habitable zone", "display": null}, {"text": " extends from approximately 0.95 to 1.68 AU. Earth, at 1.02 AU, sits comfortably within the conservative inner boundary. The ", "type": "text"}, {"type": "internal_link", "target": "frost line", "display": null}, {"text": " lies at roughly 2.7 AU, bisecting the ", "type": "text"}, {"type": "internal_link", "target": "asteroid belt", "display": null}, {"text": ", and the Sun's gravitational dominance over planetary orbits extends to the ", "type": "text"}, {"type": "internal_link", "target": "Holman-Wiegert limit", "display": null}, {"text": " at 6.9 AU, beyond which Therne's perturbations render orbits unstable.\\r", "type": "text"}]}]}	2618	2026-03-26 15:48:05.952454+00	2026-04-04 13:44:34.72+00
45	celestial	earth	sunly	Earth	hi hu	hi hu	{"type": "document", "children": [{"type": "paragraph", "children": [{"text": "hi hu", "type": "text"}]}]}	5	2026-03-31 21:23:42.896114+00	2026-04-04 18:48:08.922+00
49	celestial	tesar	sunly	Tesar			\N	0	2026-04-04 18:56:11.022871+00	2026-04-04 19:19:42.014+00
\.


--
-- Data for Name: content_revisions; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.content_revisions (id, content_record_id, title, content, size_bytes, edit_summary, user_id, created_at) FROM stdin;
1	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Oncheran religion]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[High Priestess]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321 km²\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran txanpon|Txanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mirish people|Mirish]] in origin, and brought with them a form of the [[Mirish languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Oncheran high priestess|High Priestess]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Oncheran religion]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n== See also ==\r\n\r\n* [[Izaro the Great]]\r\n* [[Rabeaneta]]\r\n* [[Amalur]]\r\n* [[Oncheran religion]]\r\n* [[Oncheran language]]\r\n* [[Araun period]]\r\n* [[Later Bazambide era]]\r\n* [[Hadashule dynasty]]\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n[[Category:West Hashir]]\r\n	6360	Page created	9	2026-03-19 18:06:38.370932+00
2	2	Tornamm		0	Page created	9	2026-03-19 18:13:15.732805+00
3	3	Asyltas		0	Page created	9	2026-03-19 18:13:24.718104+00
5	2	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Kaçeratt Tornamm''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Soll, Çodd ann Damm"<br/><small>("By Sun and By Soil")</small>\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}\r\nThe Empire of Tornamm (Nilscoddi: ''Kaçeratt Tornamm''), commonly known as Tornamm, is a [[constitutional monarchy]] located on the eastern seaboard of [[Oserath]]. With a territory of approximately 2.4 million square kilometres, it is the largest state on the continent by area and the third-largest by population. The empire shares land borders with [[Krelitseria]] to the north, [[Valdesia]] and the [[Upper Meldamm Basin]] to the west, and the [[Sothric Territories]] to the south. Its eastern coastline extends roughly 4,800 kilometres along the [[Tornammi Sea]]. The capital and largest city is [[Porto Meldamm]], a major continental port and financial centre. Other significant urban areas include [[Falgodda]], [[Torkom]], [[Nova Sillçamm]], and [[Costa Serrada]].\r\n	2892		9	2026-03-19 22:08:45.000885+00
6	5	Leoddin I	{{infobox royalty\r\n}}\r\n	23	Page created	9	2026-03-19 23:17:41.937084+00
7	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Oncheran religion]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[High Priestess]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321 km²\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mirish people|Mirish]] in origin, and brought with them a form of the [[Mirish languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Oncheran high priestess|High Priestess]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Oncheran religion]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n== See also ==\r\n\r\n* [[Izaro the Great]]\r\n* [[Rabeaneta]]\r\n* [[Amalur]]\r\n* [[Oncheran religion]]\r\n* [[Oncheran language]]\r\n* [[Araun period]]\r\n* [[Later Bazambide era]]\r\n* [[Hadashule dynasty]]\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n[[Category:West Hashir]]\r\n	6362		9	2026-03-19 23:52:30.858574+00
8	2	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Tornamm na Kaçeratt''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Soll, Çodd ann Damm"<br/><small>("By Sun and By Soil")</small>\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}\r\nThe Empire of Tornamm, commonly known as Tornamm, is a [[constitutional monarchy]] located on the eastern seaboard of [[Oserath]]. With a territory of approximately 2.4 million square kilometres, it is the largest state on the continent by area and the third-largest by population. The empire shares land borders with [[Krelitseria]] to the north, [[Valdesia]] and the [[Upper Meldamm Basin]] to the west, and the [[Sothric Territories]] to the south. Its eastern coastline extends roughly 4,800 kilometres along the [[Tornammi Sea]]. The capital and largest city is [[Porto Meldamm]], a major continental port and financial centre. Other significant urban areas include [[Falgodda]], [[Torkom]], [[Nova Sillçamm]], and [[Costa Serrada]].\r\n	2860		9	2026-03-20 00:11:40.724732+00
9	6	Almisan		0	Page created	9	2026-03-20 03:02:13.943966+00
10	2	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Tornamm na Kaçeratt''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Soll, Çodd ann Damm"<br/><small>("By Sun and By Soil")</small>\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}\r\nThe Empire of Tornamm, commonly known as Tornamm, is a [[constitutional monarchy]] located on the eastern seaboard of [[Oserath]]. With a territory of approximately 2.4 million square kilometres, it is the largest state on the continent by area and the third-largest by population. The empire shares land borders with [[Krelitseria]] to the north, [[Valdesia]] and the [[Upper Meldamm Basin]] to the west, and the [[Sothric Territories]] to the south. Its eastern coastline extends roughly 4,800 kilometres along the [[Tornammi Sea]]. The capital and largest city is [[Porto Meldamm]], a major continental port and financial centre. Other significant urban areas include [[Falgodda]], [[Torkom]], [[Nova Sillçamm]], and [[Costa Serrada]].	2858		9	2026-03-20 03:36:47.198221+00
17	7	Araun (Clan)	The Araun clan is a Ontsseran clan originating from the old town of [[Araun (ward)|Araun]]. According to the clan's genealogy, the clan was founded by a priestess known as Mureta, who founded the town with youth from the crowded temple she served at, in an unknown town. The clan currently hereditarily holds the rank of ''[[Rabeaneta]]'' (Supreme Commander) of the [[Holy Oncheran Army]], and is headed by [[Ibarra Araun]].	424		9	2026-03-20 14:32:11.54623+00
47	6	Almisan	{{Infobox country\r\n| name = City of Almisan\r\n| native_name = ''Bolia nà Almisàn''\r\n| image_flag=FlagofAlmisan.png\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''' (Classical Myreni: Bolia nà Almisàn), is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	957		9	2026-03-21 14:42:55.735419+00
102	36	Sunly system	{{System map|sunly}}	20		9	2026-03-29 13:44:07.630824+00
11	2	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Tornamm na Kaçeratt''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Soll, Çodd ann Damm"<br/>("By Sun and By Soil")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}\r\nThe Empire of Tornamm, commonly known as Tornamm, is a [[constitutional monarchy]] located on the eastern seaboard of [[Oserath]]. With a territory of approximately 2.4 million square kilometres, it is the largest state on the continent by area and the third-largest by population. The empire shares land borders with [[Krelitseria]] to the north, [[Valdesia]] and the [[Upper Meldamm Basin]] to the west, and the [[Sothric Territories]] to the south. Its eastern coastline extends roughly 4,800 kilometres along the [[Tornammi Sea]]. The capital and largest city is [[Porto Meldamm]], a major continental port and financial centre. Other significant urban areas include [[Falgodda]], [[Torkom]], [[Nova Sillçamm]], and [[Costa Serrada]].	2843		9	2026-03-20 03:38:04.515098+00
12	2	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Tornamm na Kaçeratt''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Maenn, Çodd ann Damm"<br/>("By Sun and By Soil")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}\r\nThe Empire of Tornamm, commonly known as Tornamm, is a [[constitutional monarchy]] located on the eastern seaboard of [[Oserath]]. With a territory of approximately 2.4 million square kilometres, it is the largest state on the continent by area and the third-largest by population. The empire shares land borders with [[Krelitseria]] to the north, [[Valdesia]] and the [[Upper Meldamm Basin]] to the west, and the [[Sothric Territories]] to the south. Its eastern coastline extends roughly 4,800 kilometres along the [[Tornammi Sea]]. The capital and largest city is [[Porto Meldamm]], a major continental port and financial centre. Other significant urban areas include [[Falgodda]], [[Torkom]], [[Nova Sillçamm]], and [[Costa Serrada]].	2844		9	2026-03-20 07:24:56.391568+00
13	7	Araun (Clan)	The Araun clan (𐤀𐤓𐤀𐤅𐤍) is a Ontsseran clan originating from the old town of [[Araun (ward)|Araun]]. According to the clan's genealogy, the clan was founded by a priestess known as Mureta, who founded the town with youth from the crowded temple she served at, in an unknown town. The clan currently hereditarily holds the rank of ''[[Rabeaneta]]'' (Supreme Commander) of the [[Holy Oncheran Army]], and is headed by [[Ibarra Araun]].	447	Page created	9	2026-03-20 14:21:02.727816+00
14	8	Araun (ward)	{{Infobox settlement\r\n|image=AraunCity.jpg\r\n}}\r\n\r\nAraun is a special ward in the [[Rabekareta|Rabekareta Federal Metropolis]] in [[Onchera]]. It is one of the eleven central wards of the Rabkareta Federal Metropolis. Located in the southern area of Rabkareta, Araun is bordered by the wards of [[Aranbu]], [[Maxeta]], and [[Bizeta]] in the north and [[Zabala]], [[Etxeterroa]], and [[Baña]] in the south. \r\n\r\nThe ward was founded on 30 Rotting Wood 3152 with the establishment of the Rabkareta Federal Metropolis. The total land area of Araun is 11.01 km^2, sitting on the largest plateau with a difference of 50 m between the ward's highest and lowest points. Approximately 47% of Araun's land is residential, and 20% is commercial and public areas.\r\n\r\nThe ward is named after, and is the site of the old town of Araun, that formed the city of Rabkareta under the rule of [[Izaro the Great]] after the turn of the third millennium.\r\n\r\n== History ==\r\n\r\nAraun was founded as a ward in 3152 by the designation of the [[City of Rabkareta]] as a "federal metropolis". The borders were drawn slightly larger than the bounds of the old town of Araun, encompassing the [[Sugaar river]]'s inlet, notably.\r\n\r\nThe area itself was the ancestral home of the [[Araun (Clan)|Araun clan]] and their ancestors, being founded in the 26th century. During the conquests of [[Gaizka Araun]], Araun expanded in size. In 2998, the forces of the Araun clan captured the town of Masseta from [[Nesrab Issaka]], and the Araun clan moved to Masseta. Over the decade, the small distance between Araun and Masseta caused the towns to fuse, as both towns expanded towards each other. In 3008, Izaro the Great would declare the City of Rabkareta as the administrative capital of Onchera, with the new city encompassing the area.\r\n\r\nAreas of the old town of Araun still exist within the ward, and are mostly preserved. Efforts began on restoring [[Fort Araun]] as of the establishment of the ward, but were halted over concerns of the reversibility of the work.	2031	Page created	9	2026-03-20 14:21:18.938823+00
15	9	Rabekareta	'''Rabekareta''', officially the '''Rabekareta Federal Metropolis''' is the [[Capital of Onchera|de-facto capital]] and [[List of cities in Onchera|most populous city]] of [[Onchera]]. With a population of over 14 million in the [[city proper]] in 2023, it is [[List of largest cities|one of the most populous urban areas in the world]]. The [[Greater Tokyo Area]], which includes Tokyo and parts of six neighboring [[Prefectures of Japan|prefectures]], is the most populous metropolitan area in the world, with 41 million residents.	533	Page created	9	2026-03-20 14:22:55.828953+00
16	10	Izaro the Great	{{Infobox officeholder\r\n|name=Izaro the Great\r\n|image=Izaro.jpg\r\n|office= Rabeantea of Onchera\r\n|term_start = 8 Bleeding Stone 3010\r\n|term_end = 25 Radiant Fire 3057\r\n|predecessor=[[Mitale Tiguzo]]|successor=[[Arizia Araun]]\r\n|office2= Head of the [[Araun clan]]\r\n|term_start2 = 11 Bleeding Stone 2995\r\n|term_end2 = 25 Radiant Fire 3057\r\n|predecessor2=[[Gaizka Araun]]|successor2=[[Arizia Araun]]\r\n|Born=7 Waning Iron 2979\r\n|Died=25 Radiant Fire 3057\r\n|Burial=5 Rotting Wood 3057\r\n|Spouse=[[Miren]]\r\n|Clan=[[Araun clan]]\r\n|Father=[[Gaizka Araun|Gaizka]]\r\n|Mother=[[Isturitze]]\r\n|Religion=[[Oncheran religion]]\r\n}}\r\n\r\n'''Izaro Araun''', later known as '''Izaro the Great''' (''Izaro Handia''), was an [[Onchera|Oncheran]] noble and stateswoman who rose to prominence in the closing days of the [[Later Bazambide era]], and was the focal point and leader during the early [[Araun period]]. She led the [[Onchera|State of Onchera]] as ''[[Rabeaneta]]'' (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the [[Rabeaneta period]] and transformed Onchera from a feudal state into an industrialised empire and world power.\r\n	1194	Page created	9	2026-03-20 14:23:32.290294+00
18	6	Almisan	{{Infobox country\r\n| common_name = Almisan\r\n| official_name = Bolia nà Almisàn\r\n| image_flag=FlagofAlmisan.png\r\n}}	116		9	2026-03-20 14:43:05.647256+00
19	6	Almisan	{{Infobox country\r\n| common_name = Almisan\r\n| official_name = ''Bolia nà Almisàn''\r\n| image_flag=FlagofAlmisan.png\r\n}}	120		9	2026-03-20 14:43:23.515955+00
103	36	Sunly system		0		9	2026-03-29 13:50:54.757316+00
20	2	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Tornamm na Kaçeratt''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Maenn, Çodd ann Damm"<br/>("By Sun and By Soil")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}\r\nThe Empire of Tornamm, commonly known as Tornamm, is a [[constitutional monarchy]] located on the eastern seaboard of [[Oserath]]. With a territory of approximately 2.4 million square kilometres, it is the largest state on the continent by area and the third-largest by population. The empire shares land borders with [[Krelitseria]] to the north, [[Valdesia]] and the [[Upper Meldamm Basin]] to the west, and the [[Sothric Territories]] to the south. Its eastern coastline extends roughly 4,800 kilometres along the [[Tornammi Sea]]. The capital and largest city is [[Porto Meldamm]], a major continental port and financial centre. Other significant urban areas include [[Falgodda]], [[Torkom]], [[Nova Sillçamm]], and [[Costa Serrada]].	2844		9	2026-03-20 14:46:32.352704+00
21	11	Kıraŧar		0	Page created	9	2026-03-20 15:12:57.901545+00
22	11	Kıraŧar	'''Kirathar''' is the ''[[vola]]'' of the sun. She is prominent in southern [[Krelit]] and [[Otse]] culture. Being invoked as the watchful deliverer of light and ''[[bogu]]'', and officiator of pacts and contracts. She is the sister of [[Ževra]].	247		9	2026-03-20 15:23:24.469556+00
26	14	Kirathara		0	Page created	9	2026-03-20 15:25:04.860974+00
27	15	Kiranshelokism	{{infobox religion\r\n|image=Тхост. дзуар.jpg\r\n}}\r\n\r\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\r\n\r\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as *vola*. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The *vola* are worshipped at any structure classified as a *volavont*, which can include temples, shrines, altars, and any physical structure accociated with worship.\r\n\r\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised *volavont*, although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \r\n\r\n\r\n\r\n== Status ==\r\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \r\n\r\n\r\n== Beliefs ==\r\n=== Vola ===\r\nKiranshelokism is polytheistic, involving the veneration of many deities known as *vola*. Officially, there is no agreed number of *vola*, as they vary between regional Kiranshelokist pratices, with some *vola* having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. *Vola* are not regarded as omnipotent, omniscient, or necessarily immortal. \r\n\r\n\r\n\r\n\r\n\r\n\r\n== History ==\r\n=== Early roots ===\r\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \r\n\r\n	2364	Page created	9	2026-03-20 15:25:44.117673+00
30	18	Proposed origin for humanity		0	Page created	9	2026-03-20 15:32:17.268376+00
31	19	Nilscodd		0	Page created	9	2026-03-20 15:32:34.501799+00
28	16	Krelitser	{{Infobox country\r\n|name = Republic of Krelitser\r\n|native_name = Krėlıtse Tsıda ([[Krelitseran language|Krelitseran]])\r\n|image = Krelitflag.png\r\n|Capital = [[Kirathara]]\r\n|Official languages = [[Krelitseran language|Krelitseran]]\r\n|Recognised regional languages = 22 regional official languages\r\n|Ethnic groups = 65% [[Krelits|Krelit]] <br> 5.7% [[Otse people|Otse]] <br> 3.2% [[Aris]] <br> 13.1% other <br> 13% not reported\r\n|Religion = 85.8% [[Kiranshelokism]] <br> 7.3% no religion <br> 3.9% [[Remanism]] <br> 3% others\r\n|Demonym = Krelitseran\r\n|Government = Federal hereditary republic\r\n|Queen = [[Šerėnta]]\r\n|Legislature = [[Realm Council]]\r\n|Formation = [[Kingdom of Krelitser]]: 1703 <br> [[Kingdom of Kirathara]]: 1945\r\n|Currency = Krelit shara (KS)\r\n|Calling code = +91\r\n|Internet TLD = .kr\r\n}}\r\n\r\n'''Krelitser''', officially the '''Republic of Krelitser''' is a country in the central and northern area of [[Thentey]]. With over 120 million people, Krelitser is the largest and most populous country in Thentey, and eleventh most in the world. It is a moderately urbanised country, with population mostly concentrated in regional capitals in the southern areas, and extremely concetrated in a few cities in the northern areas.\r\n\r\nHuman settlement on the territory of modern Krelitser dates back to the [[Lower Tsheksi era]]. The [[Kronthey]] emerged as a distinct group in [[Thentey]] between the 11th and 12th centuries EC. From a union of several Kronthey tribes, the [[Kingdom of Krelitser]] arose in the 18th century. After the dissolution of the kingdom from the re-emergence of distinct regional identities, several states took its place. The [[Principality of Kirathara]] would go on to unite most of the region by the 20th century, eventually taking the title of kingdom. [[Dynastic conflicts in the 23th century]] tore the kingdom to pieces, and invited several partitions of the kingdom's former territory. Several states left in the wake of the dissolution came to recognise a shared leader, and formed the [[Krelitser League]], which by the 25th century, had taken control over most of the former territory of the kingdom. In 2490, the league would formally centralise into the Republic of Krelitser. By the early 27th century, Krelitser had vastly expanded through conquest, annexation, and the efforts of Krelit explorers, becoming and remaining the third-largest empire in history.\r\n\r\nKrelitser began industrialising in the mid 30th century, becoming a major exporter of raw minerals. After disasterous failure in the [[Third Krelitser-Otse war]], Krelitser introduced labour reforms to quell domestic unrest. Internal pressure over the loss led to a large reform and centralisation of the Krelitserian military.\r\n\r\n== Etymology ==\r\n\r\n''Krelitser'' is a scholasticisation of the Krelit word name, Krėlıtse. Usage of the name dates back to before the Kingdom of Krelitser. Etymologically, ''Krėlıtse'' comes from the Proto-Dardnish '''krols₁''', meaning "heart". The Mazarean region of Rulšam is etymologically related, meaning "heartland".\r\n\r\n== History ==\r\n\r\n=== Prehistory ===\r\n\r\n=== Early history ===\r\n\r\n=== Kingdom of Krelitser ===\r\nThe establishment of the first Krelit states in the\r\n\r\n=== Kingdom of Kirathara ===\r\n\r\n=== Unification ===\r\n\r\n=== Early realm ===\r\n\r\n=== Industrialisation ===\r\n\r\n== Government and politics ==\r\nKrelitser is an absolute monarchy with a federal system, ruled by a queen as head of state, and an appointed prime minister a\r\n\r\n=== Political divisions ===\r\n\r\n=== Military ===\r\n\r\n== Economy ==\r\n\r\nKrelitser's\r\n	3577	Page created	9	2026-03-20 15:26:57.144523+00
45	6	Almisan	{{Infobox country\r\n| name = City of Almisan\r\n| native_name = ''Bolia nà Almisàn''\r\n| image_flag=FlagofAlmisan.png\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''' (Classical Myreni: Bolia nà Almisàn), is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	957		9	2026-03-20 19:31:34.181505+00
23	12	Ževra		0	Page created	9	2026-03-20 15:23:43.678192+00
24	12	Ževra	'''Ževra''' is the Lord of Heaven and Men, and Sovereign of Thunder. Ževra is the central ''[[vola]]'' in [[Kiranshelokism]]. They are interpreted as a female in [[Kirathara]], and a male in most other communities in [[Krelitser]].	233		9	2026-03-20 15:24:21.414101+00
36	22	Krelitseran language		0	Page created	9	2026-03-20 18:20:18.727664+00
38	23	Oncheran language		0	Moved from "Oncheran language" (oncheran_language) to "Oncheran language" (Oncheran_language)	9	2026-03-20 18:41:19.803873+00
37	23	Oncheran language		0	Page created	9	2026-03-20 18:39:55.921146+00
39	6	Almisan	{{Infobox country\r\n| common_name = Almisan\r\n| official_name = ''Bolia nà Almisàn''\r\n| image_flag=FlagofAlmisan.png\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''' (Classical Myreni: Bolia nà Almisàn), is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	958		9	2026-03-20 18:54:59.655026+00
40	24	University of Almisan		0	Page created	9	2026-03-20 18:55:23.369274+00
41	16	Krelitser	{{Infobox country\r\n|name = Republic of Krelitser\r\n|native_name = Krėlıtse Tsıda ([[Krelitseran language|Krelitseran]])\r\n|image = Krelitflag.png\r\n|Capital = [[Kirathara]]\r\n|Official languages = [[Krelitseran language|Krelitseran]]\r\n|Recognised regional languages = 22 regional official languages\r\n|Ethnic groups = 65% [[Krelits|Krelit]] <br> 5.7% [[Otse people|Otse]] <br> 3.2% [[Aris]] <br> 13.1% other <br> 13% not reported\r\n|Religion = 85.8% [[Kiranshelokism]] <br> 7.3% no religion <br> 3.9% [[Remanism]] <br> 3% others\r\n|Demonym = Krelitseran\r\n|Government = Federal hereditary republic\r\n|Queen = [[Šerėnta]]\r\n|Legislature = [[Realm Council]]\r\n|Formation = [[Kingdom of Krelitser]]: 1703 <br> [[Kingdom of Kirathara]]: 1945\r\n|Currency = Krelit shara (KS)\r\n|Calling code = +91\r\n|Internet TLD = .kr\r\n}}\r\n\r\n'''Krelitser''', officially the '''Republic of Krelitser''' is a country in the central and northern area of [[Thentey]]. With over 120 million people, Krelitser is the largest and most populous country in Thentey, and eleventh most in the world. It is a moderately urbanised country, with population mostly concentrated in regional capitals in the southern areas, and extremely concetrated in a few cities in the northern areas.\r\n\r\nHuman settlement on the territory of modern Krelitser dates back to the [[Lower Tsheksi era]]. The [[Kronthey]] emerged as a distinct group in [[Thentey]] between the 11th and 12th centuries EC. From a union of several Kronthey tribes, the [[Kingdom of Krelitser]] arose in the 18th century. After the dissolution of the kingdom from the re-emergence of distinct regional identities, several states took its place. The [[Principality of Kirathara]] would go on to unite most of the region by the 20th century, eventually taking the title of kingdom. [[Dynastic conflicts in the 23th century]] tore the kingdom to pieces, and invited several partitions of the kingdom's former territory. Several states left in the wake of the dissolution came to recognise a shared leader, and formed the [[Krelitser League]], which by the 25th century, had taken control over most of the former territory of the kingdom. In 2490, the league would formally centralise into the Republic of Krelitser. By the early 27th century, Krelitser had vastly expanded through conquest, annexation, and the efforts of Krelit explorers, becoming and remaining the third-largest empire in history.\r\n\r\nKrelitser began industrialising in the mid 30th century, becoming a major exporter of raw minerals. After disasterous failure in the [[Third Krelitser-Otse war]], Krelitser introduced labour reforms to quell domestic unrest. Internal pressure over the loss led to a large reform and centralisation of the Krelitserian military.\r\n\r\n== Etymology ==\r\n\r\n''Krelitser'' is a scholasticisation of the Krelit word name, Krėlıtse. Usage of the name dates back to before the Kingdom of Krelitser. Etymologically, ''Krėlıtse'' comes from the Proto-Dardnish '''krols₁''', meaning "heart". The Mazarean region of Rulšam is etymologically related, meaning "heartland".\r\n\r\n== History ==\r\n\r\n=== Prehistory ===\r\n\r\n=== Early history ===\r\n\r\n=== Kingdom of Krelitser ===\r\nThe establishment of the first Krelit states in the\r\n\r\n=== Kingdom of Kirathara ===\r\n\r\n=== Unification ===\r\n\r\n=== Early realm ===\r\n\r\n=== Industrialisation ===\r\n\r\n== Government and politics ==\r\nKrelitser is an absolute monarchy with a federal system, ruled by a queen as head of state, and an appointed prime minister a\r\n\r\n=== Political divisions ===\r\n\r\n=== Military ===\r\n\r\n== Economy ==\r\n\r\nKrelitser's\r\n	3577	Moved from "Krelitser" (krelitser) to "Krelitser" (Krelitser)	9	2026-03-20 19:04:21.335149+00
42	25	Nilscoddi language		0	Page created	9	2026-03-20 19:27:04.609925+00
98	34	Therne	{{Infobox star|from=therne}}\r\n\r\n'''Therne''', historically known as '''the Follower''', is the second [[star]] of the [[Sunly system]] and the binary companion to [[Sun|the Sun]]. It is a [[red dwarf]] of [[spectral classification]] M3V, orbiting the Sun at a mean distance of 30 [[Astronomical unit|AU]] with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a [[full moon]] depending on its orbital phase.\r\n	523		9	2026-03-29 10:41:03.903401+00
99	36	Sunly system	{{Infobox system|from=sunly}}\r\n	31		9	2026-03-29 10:50:57.537375+00
43	10	Izaro the Great	{{Infobox officeholder\r\n|name=Izaro the Great\r\n|office= Rabeantea of Onchera\r\n|term_start = 8 Bleeding Stone 3010\r\n|term_end = 25 Radiant Fire 3057\r\n|predecessor=[[Mitale Tiguzo]]|successor=[[Arizia Araun]]\r\n|office2= Head of the [[Araun clan]]\r\n|term_start2 = 11 Bleeding Stone 2995\r\n|term_end2 = 25 Radiant Fire 3057\r\n|predecessor2=[[Gaizka Araun]]|successor2=[[Arizia Araun]]\r\n|Born=7 Waning Iron 2979\r\n|Died=25 Radiant Fire 3057\r\n|Burial=5 Rotting Wood 3057\r\n|Spouse=[[Miren]]\r\n|Clan=[[Araun clan]]\r\n|Father=[[Gaizka Araun|Gaizka]]\r\n|Mother=[[Isturitze]]\r\n|Religion=[[Oncheran religion]]\r\n}}\r\n\r\n'''Izaro Araun''', later known as '''Izaro the Great''' (''Izaro Handia''), was an [[Onchera|Oncheran]] noble and stateswoman who rose to prominence in the closing days of the [[Later Bazambide era]], and was the focal point and leader during the early [[Araun period]]. She led the [[Onchera|State of Onchera]] as ''[[Rabeaneta]]'' (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the [[Rabeaneta period]] and transformed Onchera from a feudal state into an industrialised empire and world power.\r\n	1176		9	2026-03-20 19:29:56.659949+00
44	6	Almisan	{{Infobox country\r\n| name = Almisan\r\n| native_name = ''Bolia nà Almisàn''\r\n| image_flag=FlagofAlmisan.png\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''' (Classical Myreni: Bolia nà Almisàn), is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	949		9	2026-03-20 19:31:08.676799+00
46	12	Ževra	'''Ževra''' is the Lord of Heaven and Men, and Sovereign of Thunder. Ževra is the central ''[[vola]]'' in [[Kiranshelokism]]. They are interpreted as a female in [[Kirathara]], and a male in most other communities in [[Krelitser]].	233	Moved from "Ževra" (evra) to "Ževra" (Ževra)	9	2026-03-21 10:09:42.860007+00
48	26	Rabeaneta		0	Page created	9	2026-03-21 15:09:30.574045+00
49	2	Tornamm	{{Infobox country\r\n| common_name = Tornamm\r\n| official_name = Empire of Tornamm\r\n| native_name = ''Tornamm na Kaçeratt''\r\n| image_flag = Flag_of_Tornamm.png\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Maenn, Çodd ann Damm"<br/>("By Sun and By Soil")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}	2103		9	2026-03-22 08:54:16.72128+00
50	23	Oncheran language	\r\n\r\n\r\n{| class="wikitable" style="text-align:center;"\r\n|-\r\n! !! Front !! Central !! Back\r\n|-\r\n! High\r\n| <br>i<br>IPA: /i/\r\n| \r\n| <br>u<br>IPA: /u/\r\n|-\r\n! Mid\r\n| <br>e<br>IPA: /e/\r\n| \r\n| <br>o<br>IPA: /o/\r\n|-\r\n! Low\r\n| \r\n| <br>a<br>IPA: /a/\r\n| \r\n|}	247		9	2026-03-22 08:59:44.348786+00
51	15	Kiranshelokism	{{infobox religion\r\n|image=Тхост. дзуар.jpg\r\n}}\r\n\r\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\r\n\r\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a *volavont*, which can include temples, shrines, altars, and any physical structure accociated with worship.\r\n\r\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \r\n\r\n\r\n\r\n== Status ==\r\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \r\n\r\n\r\n== Beliefs ==\r\n=== Vola ===\r\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \r\n\r\n\r\n\r\n\r\n\r\n\r\n== History ==\r\n=== Early roots ===\r\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \r\n\r\n	2382		9	2026-03-22 09:03:56.231192+00
52	22	Krelitseran language	{| class="wikitable" style="text-align:center;"\r\n|-\r\n! !! Bilabial !! Labiodental !! Dental !! Alveolar !! Retroflex !! Palatal !! Velar !! Glottal\r\n|-\r\n! Plosive\r\n| p b ||  ||  || t d ||  ||  || k g || \r\n|-\r\n! Nasal\r\n| m ||  ||  || n ||  ||  ||  || \r\n|-\r\n! Fricative\r\n|  || f v || θ ð || s z || ʂ ʐ ||  ||  || h\r\n|-\r\n! Approximant\r\n| w ||  ||  ||  ||  || j ||  || \r\n|-\r\n! Lateral\r\n|  ||  ||  || ɫ ||  ||  ||  || \r\n|-\r\n! Tap/Flap\r\n|  ||  ||  || ɾ ||  ||  ||  || \r\n|}\r\n\r\n{| class="wikitable" style="text-align:center;"\r\n|-\r\n! !! Front !! Central !! Back\r\n|-\r\n! Close\r\n| i || ɨ || u\r\n|-\r\n! Close-mid\r\n| e ||  || \r\n|-\r\n! Mid\r\n|  || ə || \r\n|-\r\n! Open\r\n|  || a || \r\n|}	685		9	2026-03-22 09:04:33.723113+00
53	6	Almisan	{{Infobox country\r\n| name = City of Almisan\r\n| native_name = ''Bolia nà Almisàn'' ([[Classical Myreni]])\r\n| image_flag=FlagofAlmisan.png\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''', is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	941		9	2026-03-22 09:06:39.308625+00
54	27	Classical Myreni		0	Page created	9	2026-03-22 09:06:43.450807+00
56	29	Kingdom of Nilscodd		0	Page created	9	2026-03-22 09:48:15.559582+00
57	30	Aide the Sun		0	Page created	9	2026-03-22 16:17:03.682449+00
58	30	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|title=[[Oncheran high priestess|High Priestess of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Oncheran religion]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''' ({{lang-on|Mizeko Aide}}), was the founder and first [[Oncheran high priestess|High Priestess]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state — a political and religious achievement that shaped the character of the Oncheran nation for over a millennium.\r\n \r\nBorn to an assimilated Batea family in the [[Tambuli]]-founded trade port of [[Amalur]] on [[Lureta]], Aide received a [[Tambuli]] education while remaining deeply devout in the [[Oncheran religion|Batea shamanic tradition]]. Her exposure to Tambuli political philosophy, epic literature, and models of imperial governance profoundly influenced her ambitions. Beginning in the early 1800s EC, she waged a two-decade campaign of military conquest, religious proselytisation, and political consolidation that brought the archipelago's disparate kingdoms under a single authority. In 1821 EC, she proclaimed herself High Priestess — a title of her own invention — establishing the theocratic foundations upon which the Oncheran state would rest for centuries.\r\n \r\nAide died of [[tuberculosis]] in 1834 EC at the age of fifty, only thirteen years into her reign over a unified Onchera. Despite the brevity of her rule, the institutions she created — the office of High Priestess, the centralised temple-state, and the religious and legal framework binding the archipelago — proved remarkably durable. She is venerated as a saint in the [[Oncheran religion]] and remains the most celebrated figure in Oncheran history.	2491		9	2026-03-22 16:35:10.600525+00
59	10	Izaro the Great	{{Infobox officeholder\r\n|name=Izaro the Great\r\n|office= Rabeantea of Onchera\r\n|term_start = 8 Bleeding Stone 3010\r\n|term_end = 25 Radiant Fire 3057\r\n|predecessor=[[Mitale Tiguzo]]|successor=[[Arizia Araun]]\r\n|office2= Head of the [[Araun clan]]\r\n|term_start2 = 11 Bleeding Stone 2995\r\n|term_end2 = 25 Radiant Fire 3057\r\n|predecessor2=[[Gaizka Araun]]\r\n|successor2=[[Arizia Araun]]\r\n|Born=7 Waning Iron 2979\r\n|Died=25 Radiant Fire 3057\r\n|Burial=5 Rotting Wood 3057\r\n|Spouse=[[Miren]]\r\n|Clan=[[Araun clan]]\r\n|Father=[[Gaizka Araun|Gaizka]]\r\n|Mother=[[Isturitze]]\r\n|Religion=[[Oncheran religion]]\r\n}}\r\n\r\n'''Izaro Araun''', later known as '''Izaro the Great''' (''Izaro Handia''), was an [[Onchera|Oncheran]] noble and stateswoman who rose to prominence in the closing days of the [[Later Bazambide era]], and was the focal point and leader during the early [[Araun period]]. She led the [[Onchera|State of Onchera]] as ''[[Rabeaneta]]'' (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the [[Rabeaneta period]] and transformed Onchera from a feudal state into an industrialised empire and world power.\r\n	1178		9	2026-03-22 16:37:20.818688+00
60	30	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|succession= High Priestess of Onchera\r\n|title=[[Oncheran high priestess|High Priestess of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Oncheran religion]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''' ({{lang-on|Mizeko Aide}}), was the founder and first [[Oncheran high priestess|High Priestess]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state — a political and religious achievement that shaped the character of the Oncheran nation for over a millennium.\r\n \r\nBorn to an assimilated Batea family in the [[Tambuli]]-founded trade port of [[Amalur]] on [[Lureta]], Aide received a [[Tambuli]] education while remaining deeply devout in the [[Oncheran religion|Batea shamanic tradition]]. Her exposure to Tambuli political philosophy, epic literature, and models of imperial governance profoundly influenced her ambitions. Beginning in the early 1800s EC, she waged a two-decade campaign of military conquest, religious proselytisation, and political consolidation that brought the archipelago's disparate kingdoms under a single authority. In 1821 EC, she proclaimed herself High Priestess — a title of her own invention — establishing the theocratic foundations upon which the Oncheran state would rest for centuries.\r\n \r\nAide died of [[tuberculosis]] in 1834 EC at the age of fifty, only thirteen years into her reign over a unified Onchera. Despite the brevity of her rule, the institutions she created — the office of High Priestess, the centralised temple-state, and the religious and legal framework binding the archipelago — proved remarkably durable. She is venerated as a saint in the [[Oncheran religion]] and remains the most celebrated figure in Oncheran history.	2531		9	2026-03-22 16:37:59.94801+00
61	31	Amalur	'''Amalur''' is the [[Capital of Onchera|de-jure capital city]] of [[Onchera]]. As of 3280, the city had a population of 10.21 million, making it the second-most populous city in Ontssera. Nearly three-fourths (72.8%) of [[Lureta|Lureta Circuit]]'s population resides in the city. \r\n\r\nAmalur is the oldest municipality in Ontssera, having been traditional home of the [[High Priestess]], and many of the sacred mystery groups of [[Oncheran religion]]. The city was originally founded as a [[Tambuli]] merchant outpost, but became the centre of a new society, as Oncheran tribes began settling in the area. The High Priestess of Ontssera continues to reside in Amalur, even though state and military functions are held in [[Rabkareta]]. \r\n\r\nThe city was the scene of many events of the [[Trumoia period]] and the [[Rabeaneta period]]. When the modern Oncheran state was established by the [[Araun (Clan)|Araun clan]], they chose to centre it in their traditional home, which was in the same declaration, named Rabkareta.\r\n	1021	Page created	9	2026-03-22 16:45:28.298232+00
62	30	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|succession= High Priestess of Onchera\r\n|title=[[Oncheran high priestess|High Priestess of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Oncheran religion]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''', was the founder and first [[Oncheran high priestess|High Priestess]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state — a political and religious achievement that shaped the character of the Oncheran nation for over a millennium.\r\n \r\nBorn to an assimilated Batea family in the [[Tambuli]]-founded trade port of [[Amalur]] on [[Lureta]], Aide received a [[Tambuli]] education while remaining deeply devout in the [[Oncheran religion|Batea shamanic tradition]]. Her exposure to Tambuli political philosophy, epic literature, and models of imperial governance profoundly influenced her ambitions. Beginning in the early 1800s EC, she waged a two-decade campaign of military conquest, religious proselytisation, and political consolidation that brought the archipelago's disparate kingdoms under a single authority. In 1821 EC, she proclaimed herself High Priestess — a title of her own invention — establishing the theocratic foundations upon which the Oncheran state would rest for centuries.\r\n \r\nAide died of [[tuberculosis]] in 1834 EC at the age of fifty, only thirteen years into her reign over a unified Onchera. Despite the brevity of her rule, the institutions she created — the office of High Priestess, the centralised temple-state, and the religious and legal framework binding the archipelago — proved remarkably durable. She is venerated as a saint in the [[Oncheran religion]] and remains the most celebrated figure in Oncheran history.	2505		9	2026-03-22 17:55:26.796066+00
63	32	Aidegani		0	Page created	9	2026-03-23 00:04:43.052862+00
64	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[High Priestess]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321 km²\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mirish people|Mirish]] in origin, and brought with them a form of the [[Mirish languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Oncheran high priestess|High Priestess]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n== See also ==\r\n\r\n* [[Izaro the Great]]\r\n* [[Rabeaneta]]\r\n* [[Araun period]]\r\n* [[Later Bazambide era]]\r\n* [[Hadashule dynasty]]\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n[[Category:West Hashir]]\r\n	6280		9	2026-03-23 00:05:18.590057+00
65	31	Amalur	'''Amalur''' is the [[Capital of Onchera|de-jure capital city]] of [[Onchera]]. As of 3280, the city had a population of 10.21 million, making it the second-most populous city in Ontssera. Nearly three-fourths (72.8%) of [[Lureta|Lureta Circuit]]'s population resides in the city. \r\n\r\nAmalur is the oldest municipality in Ontssera, having been traditional home of the [[High Priestess]], and many of the sacred mystery groups of [[Aidegani]]. The city was originally founded as a [[Tambuli]] merchant outpost, but became the centre of a new society, as Oncheran tribes began settling in the area. The High Priestess of Ontssera continues to reside in Amalur, even though state and military functions are held in [[Rabkareta]]. \r\n\r\nThe city was the scene of many events of the [[Trumoia period]] and the [[Rabeaneta period]]. When the modern Oncheran state was established by the [[Araun (Clan)|Araun clan]], they chose to centre it in their traditional home, which was in the same declaration, named Rabkareta.\r\n	1012		9	2026-03-23 00:05:28.551998+00
66	30	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|succession= High Priestess of Onchera\r\n|title=[[Oncheran high priestess|High Priestess of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Aidegani]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''', was the founder and first [[Oncheran high priestess|High Priestess]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state — a political and religious achievement that shaped the character of the Oncheran nation for over a millennium.\r\n \r\nBorn to an assimilated Batea family in the [[Tambuli]]-founded trade port of [[Amalur]] on [[Lureta]], Aide received a [[Tambuli]] education while remaining deeply devout in the [[Aidegani|Batea shamanic tradition]]. Her exposure to Tambuli political philosophy, epic literature, and models of imperial governance profoundly influenced her ambitions. Beginning in the early 1800s EC, she waged a two-decade campaign of military conquest, religious proselytisation, and political consolidation that brought the archipelago's disparate kingdoms under a single authority. In 1821 EC, she proclaimed herself High Priestess — a title of her own invention — establishing the theocratic foundations upon which the Oncheran state would rest for centuries.\r\n \r\nAide died of [[tuberculosis]] in 1834 EC at the age of fifty, only thirteen years into her reign over a unified Onchera. Despite the brevity of her rule, the institutions she created — the office of High Priestess, the centralised temple-state, and the religious and legal framework binding the archipelago — proved remarkably durable. She is venerated as a saint in the [[Aidegani]] and remains the most celebrated figure in Oncheran history.	2478		9	2026-03-23 00:06:06.536621+00
67	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official_languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[High Priestess]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321 km²\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mirish people|Mirish]] in origin, and brought with them a form of the [[Mirish languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Oncheran high priestess|High Priestess]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n== See also ==\r\n\r\n* [[Izaro the Great]]\r\n* [[Rabeaneta]]\r\n* [[Araun period]]\r\n* [[Later Bazambide era]]\r\n* [[Hadashule dynasty]]\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n[[Category:West Hashir]]\r\n	6280		9	2026-03-23 00:13:10.063235+00
68	6	Almisan	{{Infobox country\r\n| name = City of Almisan\r\n| native_name = ''Bolia nà Almisàn'' ([[Classical Myreni]])\r\n| image_flag=FlagofAlmisan.png\r\n| Official languages=Classical Myreni, Almisani\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''', is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	990		9	2026-03-23 00:23:41.371365+00
69	6	Almisan	{{Infobox country\r\n| name = City of Almisan\r\n| native_name = ''Bolia nà Almisàn'' ([[Classical Myreni]])\r\n| image_flag=FlagofAlmisan.png\r\n| Official languages=[[Classical Myreni]], [[Almisani language|Almisani]]\r\n}}\r\n\r\n'''Almisan''', officially the '''City of Almisan''', is a sovereign city-state. Ruled by the high-rector, it is a semi-enclave bordered by Thalina to the north, west, and south, and the Mindron Sea to the east. With a population of 35,000 living in an area of 2.95 km^2 (1.14 mi), Almisan is the third-smallest sovereign state in the world. Almisan is governed by the [[University of Almisan]].\r\n\r\nAlmisan contains sites of world philosophical and historical heritage, such as the Almisan Library, Princess Mugon Observatory, and the Lord Havim Hall. They feature some of the world's most famous artworks and artifacts. The economy of Almisan is supported entirely by foreign admissions to Almisan University, and money spent by foreign students. Almisan has no taxes, and items are duty-free.\r\n	1016		9	2026-03-23 00:25:50.442323+00
70	30	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|succession= High Priestess of Onchera\r\n|title=[[Oncheran high priestess|High Priestess of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Aidegani]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''', was the founder and first [[Oncheran high priestess|High Priestess]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state.\r\n \r\n	1162		9	2026-03-23 05:41:46.827999+00
71	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official_languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[High Priestess]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321 km²\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mirish people|Mirish]] in origin, and brought with them a form of the [[Mirish languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Oncheran high priestess|High Priestess]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n== See also ==\r\n\r\n* [[Izaro the Great]]\r\n* [[Rabeaneta]]\r\n* [[Araun period]]\r\n* [[Later Bazambide era]]\r\n* [[Hadashule dynasty]]\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n[[Category:West Hashir]]\r\n	6280		9	2026-03-23 12:57:14.944235+00
72	3	Asyltas	{{Infobox country\r\n| common_name = Asyltas\r\n| official_name = Tribal Federation of Asyltas\r\n| native_name = ''Asyltas Ru Doãg''\r\n| image_flag = Asyltas.svg\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Çodd ann Maenn, Çodd ann Damm"<br/>("By Sun and By Soil")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}	2102		10	2026-03-23 16:54:34.609616+00
77	29	Kingdom of Nilscodd	{{Infobox country\r\n| common_name = Kingdom of Nilscodd\r\n| official_name = Kingdom of Nilscodd\r\n| native_name = ''Nilscodd na Mattmon''\r\n| image_flag = Flag_of_Nilscodd.png\r\n| national_motto = "Çodd ann Maenn, Çodd ann Damm"<br/>("By Sun and By Soil")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Porto Meldamm]]\r\n| largest_city = Porto Meldamm\r\n| official_languages = [[Nilscoddi language|Nilscoddi]]\r\n| recognised_regional_languages = [[Meldammi Creole]], various [[Indigenous Tornammi languages|indigenous languages]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Constitutional monarchy|Constitutional empire]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ₸ 214.8 billion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ₸ 7,510\r\n| currency = [[Tornammi terbom]] (₸)\r\n| time_zone = TBT / TBT+1\r\n| drives_on = right\r\n| calling_code = +XX\r\n| internet_tld = .tr\r\n}}	2073		9	2026-03-25 11:18:50.524579+00
73	3	Asyltas	{{Infobox country\r\n| common_name = Asyltas\r\n| official_name = Tribal Union of Asyltas\r\n| native_name = ''Asyltas Ru Doãg''\r\n| image_flag = Asyltas.svg\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Ķanl Dog"<br/>("Unity in Blood")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Üksik]]\r\n| largest_city = [[Tassik]]\r\n| official_languages = [[Mangurt language|Mangurt]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Asyltas Consularity|Consular Republic]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~2,400,000\r\n| population_estimate = ~28,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 11.9\r\n| GDP_PPP = ʓ 745.2 trillion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ʓ 21 000 000\r\n| currency = [[Asyltas Zom]] (ʓ)\r\n| time_zone = NPST\r\n| drives_on = right\r\n| calling_code = +88\r\n| internet_tld = .at\r\n}}	1922		10	2026-03-23 17:06:59.717846+00
74	3	Asyltas	{{Infobox country\r\n| common_name = Asyltas\r\n| official_name = Tribal Union of Asyltas\r\n| native_name = ''Asyltas Ru Doãg''\r\n| image_flag = Asyltas.svg\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Ķanl Dog"<br/>("Unity in Blood")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Üksik]]\r\n| largest_city = [[Tassik]]\r\n| official_languages = [[Mangurt language|Mangurt]]\r\n| ethnic_groups = 54% [[Indigenous Tornammi peoples|Indigenous Tornammi]]<br/>34% [[Mestizo (Tornamm)|Mestizo]]<br/>12% [[Nilscoddi peoples|Nilscoddi settler]]\r\n| demonym = Tornammi\r\n| government_type = [[Asyltas Consularity|Consular Republic]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Empress\r\n| leader_name1 = [[Çammara II]]\r\n| leader_title2 = Chancellor\r\n| leader_name2 = [[Eddomm Karsann]]\r\n| leader_title3 = President of the Assembly\r\n| leader_name3 = [[Nattça Orokomm]]\r\n| legislature = [[Tornammi Assembly]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Kingdom of Nilscodd|Nilscodd]]\r\n| established_date1 = c. 1580s EC\r\n| established_event2 = [[Nilscoddi Succession Crisis|Proclamation of Empire]]\r\n| established_date2 = 1847 EC\r\n| established_event3 = [[Tornammi Constitution of 1871|First Constitution]]\r\n| established_date3 = 1871 EC\r\n| established_event4 = [[Tornammi Constitutional Reform of 1923|Modern constitution]]\r\n| established_date4 = 1923 EC\r\n| area_km2 = ~4,400,000\r\n| population_estimate = ~31,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 7.8\r\n| GDP_PPP = ʓ 745.2 trillion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ʓ 21 000 000\r\n| currency = [[Asyltas Zom]] (ʓ)\r\n| time_zone = NPST\r\n| drives_on = right\r\n| calling_code = +88\r\n| internet_tld = .at\r\n}}	1921		10	2026-03-23 17:09:39.491859+00
75	3	Asyltas	{{Infobox country\r\n| common_name = Asyltas\r\n| official_name = Tribal Union of Asyltas\r\n| native_name = ''Asyltas Ru Doãg''\r\n| image_flag = Asyltas.svg\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Ķanl Dog"<br/>("Unity in Blood")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Üksik]]\r\n| largest_city = [[Tassik]]\r\n| official_languages = [[Mangurt language|Mangurt]]\r\n| ethnic_groups = 88% [[Sedentary Mangurt|Sedentary Mangurt]]<br/>12% [[Nomadic Mangurt|]] (According to official sources, true distribution challenged)\r\n| demonym = Tornammi\r\n| government_type = [[Asyltas Consularity|Consular Republic]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Supreme Director\r\n| leader_name1 = [[Edil]]\r\n| leader_title2 = Tribal Council Chairman\r\n| leader_name2 = [[Merke]]\r\n| legislature = [[Supreme Tribal Council]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Krelitser|Krelitser]]\r\n| established_date1 = c. 1830s EC\r\n| established_event2 = [[Asyltas Slave Rebellion|Proclamation of Independence]]\r\n| established_date2 = 1895 EC\r\n| established_event3 = [[Unification of the North|First Union Drafted]]\r\n| established_date3 = 1901 EC\r\n| established_event4 = [[Great Patriotic War|Krelitser Occupation]]\r\n| established_date4 = 1913 EC\r\n| established_event5 = [[Reunification of the North|Second Union Established]]\r\n| established_date5 = 1931 EC\r\n| area_km2 = ~4,400,000\r\n| population_estimate = ~31,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 7.8\r\n| GDP_PPP = ʓ 745.2 trillion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ʓ 21 000 000\r\n| currency = [[Asyltas Zom]] (ʓ)\r\n| time_zone = NPST\r\n| drives_on = right\r\n| calling_code = +88\r\n| internet_tld = .at\r\n}}	1924		10	2026-03-23 17:19:22.420397+00
100	37	Odolagozo	[[Image:Red algae.jpg|thumb|200px|Rooted Tssabura blood-algae.]]\r\n\r\nOdolagozo (pronounced [ˈo̞dola.ɡo.s̻o]) is a sweet algae wine with high acidity and moderate alcohol content produced in the southern coasts of [[Onchera]]. Chaburra blood-algae is the definining component of Odolagozo, setting it aside from other Hashiran algae wines.\r\n\r\nWhile commonly brewed with a pale red variety, pink varieties exist in some breweries. It is usually served during daytime as an accompaniment to raxetas, and during evening and nighttime celeberations, to moliras. It typically has between 9.5 and 11.5 ABV.\r\n\r\n	606	Page created	9	2026-03-29 12:59:59.925246+00
76	3	Asyltas	{{Infobox country\r\n| common_name = Asyltas\r\n| official_name = Tribal Union of Asyltas\r\n| native_name = ''Asyltas Ru Doãg''\r\n| image_flag = Asyltas.svg\r\n| image_coat = Coat_of_arms_of_Tornamm.png\r\n| national_motto = "Ķanl Dog"<br/>("Unity in Blood")\r\n| anthem = ''[[Tornammi Imperial Anthem|Damm ka Tornamm]]''\r\n| image_map = Tornamm_location_Oserath.png\r\n| map_caption = Location of Tornamm (dark green) on the continent of [[Oserath]]\r\n| capital = [[Üksik]]\r\n| largest_city = [[Tassik]]\r\n| official_languages = [[Mangurt language|Mangurt]]\r\n| ethnic_groups = 88% [[Sedentary Mangurt|Sedentary Mangurt]]<br/>12% [[Nomadic Mangurt|]] (According to official sources, true distribution challenged)\r\n| demonym = Tornammi\r\n| government_type = [[Asyltas Consularity|Consular Republic]] with [[parliamentary system|parliamentary legislature]]\r\n| leader_title1 = Supreme Director\r\n| leader_name1 = [[Edil]]\r\n| leader_title2 = Tribal Council Chairman\r\n| leader_name2 = [[Merke]]\r\n| legislature = [[Supreme Tribal Council]]\r\n| sovereignty_type = Establishment\r\n| established_event1 = Colony of [[Krelitser|Krelitser]]\r\n| established_date1 = c. 1830s EC\r\n| established_event2 = [[Asyltas Slave Rebellion|Proclamation of Independence]]\r\n| established_date2 = 1895 EC\r\n| established_event3 = [[Unification of the North|First Union Drafted]]\r\n| established_date3 = 1901 EC\r\n| established_event4 = [[Great Patriotic War|Krelitser Occupation]]\r\n| established_date4 = 1913 EC\r\n| established_event5 = [[Reunification of the North|Second Union Established]]\r\n| established_date5 = 1931 EC\r\n| area_km2 = ~4,400,000\r\n| population_estimate = ~31,600,000\r\n| population_estimate_year = 1987 census\r\n| population_density_km2 = 7.8\r\n| GDP_PPP = ʓ 745.2 trillion\r\n| GDP_PPP_year = 1986\r\n| GDP_PPP_per_capita = ʓ 21 000 000\r\n| currency = [[Asyltas Zom]] (ʓ)\r\n| time_zone = NPST\r\n| drives_on = right\r\n| calling_code = +88\r\n| internet_tld = .at\r\n}}\r\n'''Asyltas,''' also known as	1954		10	2026-03-23 17:20:09.496263+00
79	10	Izaro the Great	{{Infobox officeholder\r\n|name=Izaro the Great\r\n|office= Rabeaneta of Onchera\r\n|term_start = 8 Bleeding Stone 3010\r\n|term_end = 25 Radiant Fire 3057\r\n|predecessor=[[Mitale Tiguzo]]|successor=[[Arizia Araun]]\r\n|office2= Head of the [[Araun clan]]\r\n|term_start2 = 11 Bleeding Stone 2995\r\n|term_end2 = 25 Radiant Fire 3057\r\n|predecessor2=[[Gaizka Araun]]\r\n|successor2=[[Arizia Araun]]\r\n|Born=7 Waning Iron 2979\r\n|Died=25 Radiant Fire 3057\r\n|Burial=5 Rotting Wood 3057\r\n|Spouse=[[Miren]]\r\n|Clan=[[Araun clan]]\r\n|Father=[[Gaizka Araun|Gaizka]]\r\n|Mother=[[Isturitze]]\r\n|Religion=[[Oncheran religion]]\r\n}}\r\n\r\n'''Izaro Araun''', later known as '''Izaro the Great''' (''Izaro Handia''), was an [[Onchera|Oncheran]] noble and stateswoman who rose to prominence in the closing days of the [[Later Bazambide era]], and was the focal point and leader during the early [[Araun period]]. She led the [[Onchera|State of Onchera]] as ''[[Rabeaneta]]'' (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the [[Rabeaneta period]] and transformed Onchera from a feudal state into an industrialised empire and world power.\r\n	1178		9	2026-03-25 16:38:52.411046+00
80	33	Mitale Tiguzo		0	Page created	9	2026-03-25 16:39:01.321832+00
81	31	Amalur	{{Infobox settlement\r\n|name = Amalur\r\n\r\n}}\r\n\r\n'''Amalur''' is the [[Capital of Onchera|de-jure capital city]] of [[Onchera]]. As of 3280, the city had a population of 10.21 million, making it the second-most populous city in Ontssera. Nearly three-fourths (72.8%) of [[Lureta|Lureta Circuit]]'s population resides in the city. \r\n\r\nAmalur is the oldest municipality in Onchera, having been traditional home of the [[High Priestess]], and many of the sacred mystery groups of [[Aidegani]]. The city was originally founded as a [[Tambuli]] merchant outpost, but became the centre of a new society, as Oncheran tribes began settling in the area. The High Priestess of Onchera continues to reside in Amalur, even though state and military functions are held in [[Rabkareta]]. \r\n\r\nThe city was the scene of many events of the [[Trumoia period]] and the [[Rabeaneta period]]. When the modern Oncheran state was established by the [[Araun (Clan)|Araun clan]], they chose to centre it in their traditional home, which was in the same declaration, named Rabkareta.\r\n\r\n	1058		9	2026-03-25 17:02:39.15+00
82	9	Rabekareta	'''Rabekareta''', officially the '''Rabekareta Federal Metropolis''' is the [[Capital of Onchera|de-facto capital]] and [[List of cities in Onchera|most populous city]] of [[Onchera]]. 	185		9	2026-03-26 13:44:44.604749+00
83	16	Krelitser	{{Infobox country\r\n|name = Republic of Krelitser\r\n|native_name = Krėlıtse Tsıda ([[Krelitseran language|Krelitseran]])\r\n|image = Krelitflag.png\r\n|Capital = [[Kirathara]]\r\n|Official languages = [[Krelitseran language|Krelitseran]]\r\n|Recognised regional languages = 22 regional official languages\r\n|Ethnic groups = 65% [[Krelits|Krelit]] <br> 5.7% [[Otse people|Otse]] <br> 3.2% [[Aris]] <br> 13.1% other <br> 13% not reported\r\n|Religion = 85.8% [[Kiranshelokism]] <br> 7.3% no religion <br> 3.9% [[Remanism]] <br> 3% others\r\n|Demonym = Krelitseran\r\n|Government = Federal hereditary republic\r\n|Queen = [[Šerėnta]]\r\n|Legislature = [[Realm Council]]\r\n|Formation = [[Kingdom of Krelitser]]: 1703 <br> [[Kingdom of Kirathara]]: 1945\r\n|Currency = Krelit shara (KS)\r\n|Calling code = +91\r\n|Internet TLD = .kr\r\n}}\r\n\r\n'''Krelitser''', officially the '''Republic of Krelitser''' is a country in the central and northern area of [[Thentey]]. With over 120 million people, Krelitser is the largest and most populous country in Thentey, and eleventh most in the world. It is a moderately urbanised country, with population mostly concentrated in regional capitals in the southern areas, and extremely concetrated in a few cities in the northern areas.\r\n\r\nHuman settlement on the territory of modern Krelitser dates back to the [[Lower kys era]]. The [[Kronthey]] emerged as a distinct group in [[Thentey]] between the 11th and 12th centuries EC. The early Kronthey tribes centralised into early states in the periphery of the Negewians. \r\n\r\n\r\n\r\nThe [[Principality of Kirathara]] would go on to unite most of the region by the 20th century, eventually taking the title of kingdom. [[Dynastic conflicts in the 23th century]] tore the kingdom to pieces, and invited several partitions of the kingdom's former territory. Several states left in the wake of the dissolution came to recognise a shared leader, and formed the [[Krelitser League]], which by the 25th century, had taken control over most of the former territory of the kingdom. In 2490, the league would formally centralise into the Republic of Krelitser. By the early 27th century, Krelitser had vastly expanded through conquest, annexation, and the efforts of Krelit explorers, becoming and remaining the third-largest empire in history.\r\n\r\nKrelitser began industrialising in the mid 30th century, becoming a major exporter of raw minerals. After disasterous failure in the [[Third Krelitser-Otse war]], Krelitser introduced labour reforms to quell domestic unrest. Internal pressure over the loss led to a large reform and centralisation of the Krelitserian military.\r\n\r\n== Etymology ==\r\n\r\n''Krelitser'' is a scholasticisation of the Krelit word name, Krėlıtse. Usage of the name dates back to before the Kingdom of Krelitser. Etymologically, ''Krėlıtse'' comes from the Proto-Dardnish '''krols₁''', meaning "heart". The Mazarean region of Rulšam is etymologically related, meaning "heartland".\r\n\r\n== History ==\r\n\r\n=== Prehistory ===\r\n\r\n=== Early history ===\r\n\r\n=== Kingdom of Krelitser ===\r\nThe establishment of the first Krelit states in the\r\n\r\n=== Kingdom of Kirathara ===\r\n\r\n=== Unification ===\r\n\r\n=== Early realm ===\r\n\r\n=== Industrialisation ===\r\n\r\n== Government and politics ==\r\nKrelitser is an absolute monarchy with a federal system, ruled by a queen as head of state, and an appointed prime minister a\r\n\r\n=== Political divisions ===\r\n\r\n=== Military ===\r\n\r\n== Economy ==\r\n\r\nKrelitser's\r\n	3452		9	2026-03-26 15:31:14.805965+00
84	34	Therne		0	Page created	9	2026-03-26 15:45:04.837415+00
86	35	Sun	'''The Sun''' is the star at the centre of the Solar System. It is a massive sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core, radiating the energy from its surface mainly as visible light and infrared radiation with 10% at ultraviolet energies. It is the main source of energy for life on Earth. The Sun has been an object of veneration in many cultures and a central subject of astronomical research since antiquity.\r\n\r\n	459	Moved from "S" (S) to "Sun" (Sun)	9	2026-03-26 15:51:02.6618+00
85	35	S	'''The Sun''' is the star at the centre of the Solar System. It is a massive sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core, radiating the energy from its surface mainly as visible light and infrared radiation with 10% at ultraviolet energies. It is the main source of energy for life on Earth. The Sun has been an object of veneration in many cultures and a central subject of astronomical research since antiquity.\r\n\r\n	459	Page created	9	2026-03-26 15:48:05.954873+00
87	35	Sun	'''The Sun''' is the star at the centre of the Solar System. It is a massive sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core, radiating the energy from its surface mainly as visible light and infrared radiation with 10% at ultraviolet energies. It is the main source of energy for life on [[Earth]]. The Sun has been an object of veneration in many cultures and a central subject of astronomical research since antiquity.\r\n\r\n	463		9	2026-03-26 15:51:35.047614+00
88	29	Kingdom of Nilscodd	{{Infobox country\r\n| common_name = Kingdom of Nilscodd\r\n| official_name = Kingdom of Nilscodd\r\n| native_name = ''Nilscodd na Mattmon''\r\n| image_flag = Flag_of_Nilscodd.png\r\n}}\r\n\r\nThe '''Kingdom of Nilscodd''' was a Arian Remanist 	230		9	2026-03-27 05:14:58.167272+00
89	35	Sun	{{Infobox star\r\n| name = The Sun\r\n| image = \r\n| caption = The Sun, viewed through a clear sunly filter\r\n| epoch = \r\n| constell = \r\n| pronounce = \r\n| spectral_type = G2V\r\n| mass = 1.0 [[Sunly mass|M☉]]\r\n| radius = 1.0 [[Sunly radius|R☉]]\r\n| luminosity = 1.0 [[Sunly luminosity|L☉]]\r\n| temperature = 5,778 [[Kelvin|K]]\r\n| age = ~4.6 billion years\r\n| color = Yellow-white\r\n| mean_distance = 1.02 [[Astronomical unit|AU]] (from [[Earth]])\r\n| angular_diameter = 31.4 [[Arcminute|arcmin]]\r\n| apparent_magnitude = −26.7\r\n| orbital_period = —\r\n| companion = [[Therne]] (M3V, 30 AU)\r\n}}\r\n\r\n'''The Sun''' is the [[star]] at the centre of the [[Sunly system]]. It is a massive sphere of hot [[plasma]], heated to incandescence by [[nuclear fusion]] reactions in its core, radiating energy from its surface mainly as [[visible light]] and [[infrared radiation]]. It is the primary source of energy for life on [[Earth]] and the dominant gravitational body around which all inner system objects orbit.\r\n\r\nThe Sun is a main-sequence star of [[spectral classification]] G2V, with a surface temperature of approximately 5,778 K and a yellow-white colour. It contains roughly 73% [[hydrogen]] and 25% [[helium]] by mass, with trace quantities of heavier elements including [[oxygen]], [[carbon]], and [[iron]]. It formed approximately 4.6 billion years ago from the [[gravitational collapse]] of a region within a large [[molecular cloud]], alongside its binary companion [[Therne]].\r\n\r\nThe Sun is one of two stars in the Sunly system. Its companion, the red dwarf [[Therne]], orbits at a mean distance of 30 AU on a moderately [[Orbital eccentricity|eccentric]] orbit (''e'' = 0.3), completing one circuit every 140.9 years. Despite Therne's prominence in the night sky, it contributes less than 0.004% of Earth's total [[insolation]] and has no measurable effect on surface climate. The stability of planetary orbits around the Sun, including Earth's, is well understood through [[Celestial mechanics|orbital mechanics]]; the critical stability boundary lies at approximately 6.9 AU, far beyond Earth's orbit of 1.02 AU.\r\n\r\nFrom Earth, the Sun appears as a disc roughly 31.4 [[arcminute]]s across — large enough to observe [[sunspot]]s during atmospheric dimming near the horizon. Its apparent brightness of magnitude −26.7 overwhelms all other celestial objects by many orders of magnitude, including Therne at its closest approach (magnitude −13.3). At [[sunset]], [[Rayleigh scattering]] through the atmosphere shifts the Sun's apparent colour from white through yellow and orange to deep red, a phenomenon that is particularly striking during the decades-long periods when Therne is visible near the same horizon, offering a direct colour contrast between the two stars.\r\n\r\nThe Sun's [[habitable zone]] extends from approximately 0.95 to 1.68 AU. Earth, at 1.02 AU, sits comfortably within the conservative inner boundary. The [[frost line]] lies at roughly 2.7 AU, bisecting the [[asteroid belt]], and the Sun's gravitational dominance over planetary orbits extends to the [[Holman-Wiegert limit]] at 6.9 AU, beyond which Therne's perturbations render orbits unstable.\r\n	3176		9	2026-03-29 08:34:26.732134+00
101	37	Odolagozo	[[Image:red_algae.jpg|thumb|200px|Rooted Tssabura blood-algae.]]\r\n\r\nOdolagozo (pronounced [ˈo̞dola.ɡo.s̻o]) is a sweet algae wine with high acidity and moderate alcohol content produced in the southern coasts of [[Onchera]]. Chaburra blood-algae is the definining component of Odolagozo, setting it aside from other Hashiran algae wines.\r\n\r\nWhile commonly brewed with a pale red variety, pink varieties exist in some breweries. It is usually served during daytime as an accompaniment to raxetas, and during evening and nighttime celeberations, to moliras. It typically has between 9.5 and 11.5 ABV.\r\n\r\n	606		9	2026-03-29 13:07:55.482313+00
90	34	Therne	{{Infobox star\r\n| name = Therne\r\n| image = \r\n| caption = Therne near opposition, composite long-exposure image\r\n| epoch = \r\n| constell = \r\n| pronounce = {{IPA|/θɜːrn/}}\r\n| spectral_type = M3V\r\n| mass = 0.36 [[Sunly mass|M☉]]\r\n| radius = 0.39 [[Sunly radius|R☉]]\r\n| luminosity = 0.015 [[Sunly luminosity|L☉]] (bolometric)\r\n| luminosity_visual = 0.0013 [[Sunly luminosity|L☉]] (V-band)\r\n| temperature = 3,400 [[Kelvin|K]]\r\n| age = ~4.6 billion years\r\n| color = Deep orange-red\r\n| orbital_semimajor = 30 [[Astronomical unit|AU]]\r\n| orbital_eccentricity = 0.3\r\n| orbital_period = 140.9 years\r\n| periastron = 21.0 AU\r\n| apastron = 39.0 AU\r\n| apparent_magnitude_bright = −13.3 (periastron opposition)\r\n| apparent_magnitude_dim = −11.9 (apastron conjunction)\r\n| angular_diameter_max = 35.6 [[Arcsecond|arcsec]] (periastron)\r\n| angular_diameter_min = 19.2 arcsec (apastron)\r\n| companion = [[The Sun]] (G2V)\r\n}}\r\n\r\n'''Therne''' ({{IPA|/θɜːrn/}}), historically known as '''the Follower''', is the second [[star]] of the [[Sunly system]] and the binary companion to [[the Sun]]. It is a [[red dwarf]] of [[spectral classification]] M3V, orbiting the Sun at a mean distance of 30 [[Astronomical unit|AU]] with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a [[full moon]] depending on its orbital phase.\r\n	1429		9	2026-03-29 08:36:39.335054+00
91	34	Therne	{{Infobox star\r\n| name = Therne\r\n| image = \r\n| caption = Therne near opposition, composite long-exposure image\r\n| epoch = \r\n| constell = \r\n| pronounce = \r\n| spectral_type = M3V\r\n| mass = 0.36 [[Sunly mass|M☉]]\r\n| radius = 0.39 [[Sunly radius|R☉]]\r\n| luminosity = 0.015 [[Sunly luminosity|L☉]] (bolometric)\r\n| luminosity_visual = 0.0013 [[Sunly luminosity|L☉]] (V-band)\r\n| temperature = 3,400 [[Kelvin|K]]\r\n| age = ~4.6 billion years\r\n| color = Deep orange-red\r\n| orbital_semimajor = 30 [[Astronomical unit|AU]]\r\n| orbital_eccentricity = 0.3\r\n| orbital_period = 140.9 years\r\n| periastron = 21.0 AU\r\n| apastron = 39.0 AU\r\n| apparent_magnitude_bright = −13.3 (periastron opposition)\r\n| apparent_magnitude_dim = −11.9 (apastron conjunction)\r\n| angular_diameter_max = 35.6 [[Arcsecond|arcsec]] (periastron)\r\n| angular_diameter_min = 19.2 arcsec (apastron)\r\n| companion = [[The Sun]] (G2V)\r\n}}\r\n\r\n'''Therne''' ({{IPA|/θɜːrn/}}), historically known as '''the Follower''', is the second [[star]] of the [[Sunly system]] and the binary companion to [[the Sun]]. It is a [[red dwarf]] of [[spectral classification]] M3V, orbiting the Sun at a mean distance of 30 [[Astronomical unit|AU]] with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a [[full moon]] depending on its orbital phase.\r\n	1411		9	2026-03-29 08:36:49.080777+00
92	34	Therne	{{Infobox star\r\n| name = Therne\r\n| image = \r\n| caption = Therne near opposition, composite long-exposure image\r\n| epoch = \r\n| constell = \r\n| pronounce = \r\n| spectral_type = M3V\r\n| mass = 0.36 [[Sunly mass|M☉]]\r\n| radius = 0.39 [[Sunly radius|R☉]]\r\n| luminosity = 0.015 [[Sunly luminosity|L☉]] (bolometric)\r\n| luminosity_visual = 0.0013 [[Sunly luminosity|L☉]] (V-band)\r\n| temperature = 3,400 [[Kelvin|K]]\r\n| age = ~4.6 billion years\r\n| color = Deep orange-red\r\n| orbital_semimajor = 30 [[Astronomical unit|AU]]\r\n| orbital_eccentricity = 0.3\r\n| orbital_period = 140.9 years\r\n| periastron = 21.0 AU\r\n| apastron = 39.0 AU\r\n| apparent_magnitude_bright = −13.3 (periastron opposition)\r\n| apparent_magnitude_dim = −11.9 (apastron conjunction)\r\n| angular_diameter_max = 35.6 [[Arcsecond|arcsec]] (periastron)\r\n| angular_diameter_min = 19.2 arcsec (apastron)\r\n| companion = [[The Sun]] (G2V)\r\n}}\r\n\r\n'''Therne''', historically known as '''the Follower''', is the second [[star]] of the [[Sunly system]] and the binary companion to [[the Sun]]. It is a [[red dwarf]] of [[spectral classification]] M3V, orbiting the Sun at a mean distance of 30 [[Astronomical unit|AU]] with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a [[full moon]] depending on its orbital phase.\r\n	1390		9	2026-03-29 08:36:57.595404+00
93	34	Therne	{{Infobox star\r\n| name = Therne\r\n| image = \r\n| caption = Therne near opposition, composite long-exposure image\r\n| epoch = \r\n| constell = \r\n| pronounce = \r\n| spectral_type = M3V\r\n| mass = 0.36 [[Sunly mass|M☉]]\r\n| radius = 0.39 [[Sunly radius|R☉]]\r\n| luminosity = 0.015 [[Sunly luminosity|L☉]] (bolometric)\r\n| luminosity_visual = 0.0013 [[Sunly luminosity|L☉]] (V-band)\r\n| temperature = 3,400 [[Kelvin|K]]\r\n| age = ~4.6 billion years\r\n| color = Deep orange-red\r\n| orbital_semimajor = 30 [[Astronomical unit|AU]]\r\n| orbital_eccentricity = 0.3\r\n| orbital_period = 140.9 years\r\n| periastron = 21.0 AU\r\n| apastron = 39.0 AU\r\n| apparent_magnitude_bright = −13.3 (periastron opposition)\r\n| apparent_magnitude_dim = −11.9 (apastron conjunction)\r\n| angular_diameter_max = 35.6 [[Arcsecond|arcsec]] (periastron)\r\n| angular_diameter_min = 19.2 arcsec (apastron)\r\n| companion = [[The Sun]] (G2V)\r\n}}\r\n\r\n'''Therne''', historically known as '''the Follower''', is the second [[star]] of the [[Sunly system]] and the binary companion to [[Sun|the Sun]]. It is a [[red dwarf]] of [[spectral classification]] M3V, orbiting the Sun at a mean distance of 30 [[Astronomical unit|AU]] with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a [[full moon]] depending on its orbital phase.\r\n	1394		9	2026-03-29 08:37:22.884918+00
94	36	Sunly system		0	Page created	9	2026-03-29 08:37:59.407101+00
95	32	Aidegani	{{infobox religion\r\n\r\n}}	24		9	2026-03-29 10:12:45.417703+00
96	32	Aidegani	{{infobox religion\r\n| title=Aidegani\r\n| founder=[[Aide the Sun]]\r\n}}	68		9	2026-03-29 10:13:08.182254+00
97	35	Sun	{{Infobox star|from=the-sun}}\r\n\r\n'''The Sun''' is the [[star]] at the centre of the [[Sunly system]]. It is a massive sphere of hot [[plasma]], heated to incandescence by [[nuclear fusion]] reactions in its core, radiating energy from its surface mainly as [[visible light]] and [[infrared radiation]]. It is the primary source of energy for life on [[Earth]] and the dominant gravitational body around which all inner system objects orbit.\r\n\r\nThe Sun is a main-sequence star of [[spectral classification]] G2V, with a surface temperature of approximately 5,778 K and a yellow-white colour. It contains roughly 73% [[hydrogen]] and 25% [[helium]] by mass, with trace quantities of heavier elements including [[oxygen]], [[carbon]], and [[iron]]. It formed approximately 4.6 billion years ago from the [[gravitational collapse]] of a region within a large [[molecular cloud]], alongside its binary companion [[Therne]].\r\n\r\nThe Sun is one of two stars in the Sunly system. Its companion, the red dwarf [[Therne]], orbits at a mean distance of 30 AU on a moderately [[Orbital eccentricity|eccentric]] orbit (''e'' = 0.3), completing one circuit every 140.9 years. Despite Therne's prominence in the night sky, it contributes less than 0.004% of Earth's total [[insolation]] and has no measurable effect on surface climate. The stability of planetary orbits around the Sun, including Earth's, is well understood through [[Celestial mechanics|orbital mechanics]]; the critical stability boundary lies at approximately 6.9 AU, far beyond Earth's orbit of 1.02 AU.\r\n\r\nFrom Earth, the Sun appears as a disc roughly 31.4 [[arcminute]]s across — large enough to observe [[sunspot]]s during atmospheric dimming near the horizon. Its apparent brightness of magnitude −26.7 overwhelms all other celestial objects by many orders of magnitude, including Therne at its closest approach (magnitude −13.3). At [[sunset]], [[Rayleigh scattering]] through the atmosphere shifts the Sun's apparent colour from white through yellow and orange to deep red, a phenomenon that is particularly striking during the decades-long periods when Therne is visible near the same horizon, offering a direct colour contrast between the two stars.\r\n\r\nThe Sun's [[habitable zone]] extends from approximately 0.95 to 1.68 AU. Earth, at 1.02 AU, sits comfortably within the conservative inner boundary. The [[frost line]] lies at roughly 2.7 AU, bisecting the [[asteroid belt]], and the Sun's gravitational dominance over planetary orbits extends to the [[Holman-Wiegert limit]] at 6.9 AU, beyond which Therne's perturbations render orbits unstable.\r\n	2618		9	2026-03-29 10:40:42.528552+00
105	10	Izaro the Great	{{Infobox officeholder\r\n|name=Izaro the Great\r\n|office= Rabeaneta of Onchera\r\n|term_start = 8 Bleeding Stone 3010\r\n|term_end = 25 Radiant Fire 3057\r\n|predecessor=[[Mitale Tiguzo]]|successor=[[Arizia Araun]]\r\n|office2= Head of the [[Araun clan]]\r\n|term_start2 = 11 Bleeding Stone 2995\r\n|term_end2 = 25 Radiant Fire 3057\r\n|predecessor2=[[Gaizka Araun]]\r\n|successor2=[[Arizia Araun]]\r\n|Born=7 Waning Iron 2979\r\n|Died=25 Radiant Fire 3057\r\n|Burial=5 Rotting Wood 3057\r\n|Spouse=[[Miren]]\r\n|Clan=[[Araun clan]]\r\n|Father=[[Gaizka Araun|Gaizka]]\r\n|Mother=[[Isturitze]]\r\n|Religion=[[Oncheran religion]]\r\n}}\r\n\r\n'''Izaro Araun''', later known as '''Izaro the Great''' (''Izaro Handia''), was an [[Onchera|Oncheran]] noble and stateswoman who rose to prominence in the closing days of the [[Later Bazambide era]], and was the focal point and leader during the early [[Araun period]]. She led the [[Onchera|State of Onchera]] as ''[[Rabeaneta]]'' (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the [[Rabeaneta period]] and transformed Onchera from a feudal state into an industrialised empire and world power.\r\n\r\n\r\n	1182		9	2026-03-30 07:20:23.934884+00
106	15	Kiranshelokism	{{infobox religion\r\n|image=Тхост. дзуар.jpg\r\n}}\r\n\r\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\r\n\r\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a ''volavont'', which can include temples, shrines, altars, and any physical structure accociated with worship.\r\n\r\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \r\n\r\n\r\n\r\n== Status ==\r\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \r\n\r\n\r\n== Beliefs ==\r\n=== Vola ===\r\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \r\n\r\n\r\n== History ==\r\n=== Early roots ===\r\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \r\n\r\n	2376		9	2026-03-30 07:21:42.873208+00
107	9	Rabekareta	{{infobox settlement\r\n|name= Rabekareta\r\n|image='photo-1496823407868-80f47c7453b5.jpg.webp'\r\n}}\r\n\r\n'''Rabekareta''', officially the '''Rabekareta Federal Metropolis''' is the [[Capital of Onchera|de-facto capital]] and [[List of cities in Onchera|most populous city]] of [[Onchera]]. 	284		9	2026-03-30 10:12:50.847735+00
108	9	Rabekareta	{{infobox settlement\r\n|name= Rabekareta\r\n|image=photo-1496823407868-80f47c7453b5.jpg.webp\r\n}}\r\n\r\n'''Rabekareta''', officially the '''Rabekareta Federal Metropolis''' is the [[Capital of Onchera|de-facto capital]] and [[List of cities in Onchera|most populous city]] of [[Onchera]]. 	282		9	2026-03-30 10:13:00.825005+00
109	39	Elekoneta		0	Page created	9	2026-03-30 11:24:17.805856+00
110	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official_languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[Elekoneta]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mirish people|Mirish]] in origin, and brought with them a form of the [[Mirish languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Oncheran high priestess|High Priestess]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n== See also ==\r\n\r\n* [[Izaro the Great]]\r\n* [[Rabeaneta]]\r\n* [[Araun period]]\r\n* [[Later Bazambide era]]\r\n* [[Hadashule dynasty]]\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n[[Category:West Hashir]]\r\n	6270		9	2026-03-30 11:24:50.583171+00
111	30	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|succession= High Priestess of Onchera\r\n|title=[[Elekoneta|Elekoneta of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Aidegani]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''', was the founder and first [[Elekoneta]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state.\r\n \r\n	1114		9	2026-03-30 11:25:21.632101+00
112	30	Aide the Sun	{{Infobox royalty\r\n|name=Aide the Sun\r\n|native_name=Mizeko Aide ([[Oncheran language|Oncheran]])\r\n|image=Mizeko_Aide_temple_mosaic.png\r\n|caption=Mosaic of Aide the Sun from the [[Great Temple Palace]], [[Amalur]], dated c. 1900 EC\r\n|succession= Elekoneta of Onchera\r\n|title=[[Elekoneta|Elekoneta of Onchera]]\r\n|reign=1821 EC – 1834 EC\r\n|predecessor=Title created\r\n|successor=[[Aidetz I]]\r\n|birth_date=14th day of Suda, 1784 EC\r\n|birth_place=[[Amalur]], [[Lureta]]\r\n|death_date=9th day of Negu, 1834 EC (aged 50)\r\n|death_place=[[Amalur]], [[Lureta]]\r\n|burial_place=[[Great Temple Palace]], [[Amalur]]\r\n|full_name=Suda Aidema Tssera\r\n|house=[[House of Tssera]]\r\n|religion=[[Aidegani]]\r\n|spouse=\r\n|children=\r\n}}\r\n\r\n'''Suda Aidema Tssera''' (14th Suda, 1784 EC – 9th Negu, 1834 EC), known universally as '''Aide the Sun''', was the founder and first [[Elekoneta]] of the unified [[Onchera|State of Onchera]]. A [[Batea people|Batea]] priestess, military commander, and stateswoman, she is credited with the unification of the Oncheran archipelago's many competing kingdoms into a single theocratic state.\r\n \r\n	1109		9	2026-03-30 11:25:40.803196+00
113	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official_languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[Elekoneta]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mira people|Mira]] in origin, and brought with them a form of the [[Mira languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Elekoneta]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n== See also ==\r\n\r\n* [[Izaro the Great]]\r\n* [[Rabeaneta]]\r\n* [[Araun period]]\r\n* [[Later Bazambide era]]\r\n* [[Hadashule dynasty]]\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n[[Category:West Hashir]]\r\n	6235		9	2026-03-30 11:55:04.441993+00
114	34	Therne	{{Infobox star|from=therne}}\r\n\r\n'''Therne''', historically known as '''the Follower''', is the second [[star]] of the [[celestial:Sunly system]] and the binary companion to [[Sun|the Sun]]. It is a [[red dwarf]] of [[spectral classification]] M3V, orbiting the Sun at a mean distance of 30 [[Astronomical unit|AU]] with a period of 140.9 years. Therne is the brightest object in Sunly's night sky apart from the Sun itself, varying between roughly 0.5 and 1.7 times the brightness of a [[full moon]] depending on its orbital phase.\r\n	533		9	2026-03-30 13:59:06.674529+00
115	40	Metric system		0	Page created	9	2026-03-30 15:30:46.530887+00
116	41	Batea people		0	Page created	9	2026-03-30 15:51:54.516095+00
117	41	Batea people	The Batea people  were an ancient people who immigrated to the [[Oncheran archipelago]] during the Batea period 100EC and are characterized by the existence of Batea material culture. \r\n\r\n	188		9	2026-03-30 15:54:12.981242+00
118	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official_languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[Elekoneta]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mira people|Mira]] in origin, and brought with them a form of the [[Mira languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Elekoneta]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n	6077		9	2026-03-30 16:03:44.69132+00
119	29	Kingdom of Nilscodd	{{Infobox country\r\n| common_name = Kingdom of Nilscodd\r\n| official_name = Kingdom of Nilscodd\r\n| native_name = ''Nilscodd na Mattmon''\r\n| image_flag = Flag_of_Nilscodd.png\r\n}}\r\n\r\nThe '''Kingdom of Nilscodd''' was a 	215		9	2026-03-30 17:56:03.890997+00
120	10	Izaro the Great	{{Infobox officeholder\r\n|name=Izaro the Great\r\n|office= Rabeaneta of Onchera\r\n|term_start = 8 Bleeding Stone 3010\r\n|term_end = 25 Radiant Fire 3057\r\n|predecessor=[[Mitale Tiguzo]]|successor=[[Arizia Araun]]\r\n|office2= Head of the [[Araun (clan)|Araun clan]]\r\n|term_start2 = 11 Bleeding Stone 2995\r\n|term_end2 = 25 Radiant Fire 3057\r\n|predecessor2=[[Gaizka Araun]]\r\n|successor2=[[Arizia Araun]]\r\n|Born=7 Waning Iron 2979\r\n|Died=25 Radiant Fire 3057\r\n|Burial=5 Rotting Wood 3057\r\n|Spouse=[[Miren]]\r\n|Clan=[[Araun clan]]\r\n|Father=[[Gaizka Araun|Gaizka]]\r\n|Mother=[[Isturitze]]\r\n|Religion=[[Oncheran religion]]\r\n}}\r\n\r\n'''Izaro Araun''', later known as '''Izaro the Great''' (''Izaro Handia''), was an [[Onchera|Oncheran]] noble and stateswoman who rose to prominence in the closing days of the [[Later Bazambide era]], and was the focal point and leader during the early [[Araun period]]. She led the [[Onchera|State of Onchera]] as ''[[Rabeaneta]]'' (Supreme Commander) from 3010 to 3057. Scholars generally consider her reign to mark the modernisation of Onchera, which ended the [[Rabeaneta period]] and transformed Onchera from a feudal state into an industrialised empire and world power.\r\n\r\n\r\n	1195		9	2026-03-31 04:21:17.094925+00
121	15	Kiranshelokism	{{infobox religion\r\n|image=Тхост._дзуар.jpg\r\n}}\r\n\r\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\r\n\r\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a ''volavont'', which can include temples, shrines, altars, and any physical structure accociated with worship.\r\n\r\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \r\n\r\n\r\n\r\n== Status ==\r\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \r\n\r\n\r\n== Beliefs ==\r\n=== Vola ===\r\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \r\n\r\n\r\n== History ==\r\n=== Early roots ===\r\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \r\n\r\n	2376		9	2026-03-31 07:02:24.614432+00
122	15	Kiranshelokism	[[File:Тхост._дзуар.jpg|thumb|Dhoqo (Đoko) Temple, dedicated to Ževra, in the Ŧovum Gorge, Kroŧ, Mowum Republic]]\r\n\r\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\r\n\r\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a ''volavont'', which can include temples, shrines, altars, and any physical structure accociated with worship.\r\n\r\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \r\n\r\n\r\n\r\n== Status ==\r\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \r\n\r\n\r\n== Beliefs ==\r\n=== Vola ===\r\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \r\n\r\n\r\n== History ==\r\n=== Early roots ===\r\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \r\n\r\n	2446		9	2026-03-31 08:17:20.018777+00
123	36	Sunly system	hi	2		9	2026-03-31 12:12:23.565247+00
124	32	Aidegani	{{infobox religion\n| title=Aidegani\n| founder=[[Aide the Sun]]\n}}\n\n'''Aidegani'''  is the native and ethnic religion of [[Onchera]]. As polytheistic and naturalistic religion, Aidegani expresses belief and worship in physical and immanent deities within this realm and others. Aidegani does not regard souls to exist, and reincarnation is believed to happen in the form of physical transfer. Central authority in Aidegani exists solely in the institution of the [[Elekoneta]] and by extension, the State of Onchera, however, this is not excercised. There is much diversity of belief and practice evident among practitioners. \n\n== Etymology ==\n\n== See also ==\n\n== Notes ==\n\n== References ==\n	690		9	2026-03-31 13:37:41.194735+00
125	1	Onchera	{{Infobox country\r\n|name=State of Onchera\r\n|native_name=Ontsserako Demeta ([[Oncheran language|Oncheran]])<br>Demeat Uncera  ([[Great Tambuli]])\r\n|flag=Ontsseraflag.png\r\n|capital=[[Amalur]]\r\n|official_languages=[[Oncheran language|Oncheran]], [[Great Tambuli]]\r\n|religion=72.1% [[Aidegani]], 20.0% [[Tanism]], 5.9% [[Havimism]], 2% others\r\n| government_type =Federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship\r\n| leader_title1          = [[Elekoneta]]\r\n| leader_name1           = [[Taneta]]\r\n|legislature=[[Batzar Nagusia]]\r\n|area=~361,321\r\n|Population=~100,000,000\r\n|Currency=[[Oncheran tssanpon|Tssanpon]]\r\n|Calling code=+67\r\n|Internet TLD=.on\r\n}}\r\n\r\n'''Onchera''', officially the '''State of Onchera''', is an archipelagic country in [[West Hashir]]. Located in the [[Ouken Ocean]], it consists of 3,213 islands, with a total area of roughly 361,321 kilometres squared. The islands are broadly grouped into provinces based on the seven largest islands and their periphery: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The archipelago is protected from [[Ouken blood algae]] by the [[West Onchera Reef]]. With a population of 100 million, it is the world's thirteenth-most-populous country.\r\n\r\nWaves of early [[Iratssoat]] settlement is evidenced to have started around -11th century EC, followed thousands of years later by further arrivals from West Hashir, and finally, in 1st century EC, by the [[Batea people]]. The Batea were [[Mira people|Mira]] in origin, and brought with them a form of the [[Mira languages]] that would later develop into [[Oncheran language|Oncheran]]. Around the 15th century EC, Batea societies started regularly trading with [[Tambuli]] merchants and interacting with Tambuli scholars, who had begun settling in colonies across the archipelago. Extensive contact from these trade posts transformed the Oncheran people from a tribal society into a patchwork of early states.\r\n\r\nIn 1821, the various kingdoms of Onchera were unified under the first [[Elekoneta]], [[Aide the Sun]], in [[Amalur]]. This unification established the theocratic foundations that would characterise the Oncheran state for centuries to come. Beginning in the 20th century, Onchera became a regional power with an empire that threatened even the hegemony of the Tambulian [[Hadashule dynasty]]. Natural disasters such as the [[Ouken Algae Flood (2259)]], rebellion in [[Melcharia]], and the collapse of the Hadashule dynasty — Onchera's largest trading partner — caused the feudalisation and eventual collapse of the centralised Oncheran state.\r\n\r\nThe growing trend for hereditary titles among the elite of the standing army spread downward, and the Oncheran military became more akin to landed nobility. By the 24th century, the Oncheran army was indistinguishable from hereditary aristocracy. Power was concentrated in the ''[[Rabeaneta]]'' (Supreme Commander), who resided in the theocratic capital of [[Amalur]]. After rule by the Tiburu, Legarra, and Arizmea commands, followed by two centuries of warring states, Onchera was reunified in 2810 by the Ebaralo command. The Ebaralo began fracturing in the mid-30th century, and power was finally seized by [[Mitale Tiguzo]] in 2994.\r\n\r\nContact was made with the outside world in 3005, after Taranman circumnavigation through the [[Ouken Ocean]] with iron-hulled ships. The immense upheaval this caused in Onchera led to [[Izaro the Great]], at the time a general of Mitale Tiguzo, coming to power and creating the modern state of Onchera in the early 31st century. Under Izaro's forty-seven year reign, the country was transformed from a fractured feudal society into a centralised, industrialising state.\r\n\r\n\r\n== History ==\r\n\r\n=== Early settlement to classical history ===\r\nThe first settlement of humans to Onchera started in around -11,000EC, constituting the Oncheran Stone age. Around -8,000EC, the first notable elements of hunter-gatherer proto-Iratsoat culture appear, with pit dwellings, primitive agriculture, and clay vessels. Around -5,000EC, further hunter-gatherer peoples from West Hashir would arrive, and introduce algae harvesting.\r\n\r\nThe first waves of Batea settlement almost certainly began around 100EC, with the first evidence of fungal cultivation and different styles of pottery dating to around the time. Ancient Tambuli military records also note large depopulations of Mirish frontiers in 112EC. The agriculturalist Batea largely demographically replaced through outbreeding and intermarriage, large Iratsoat populations. Iratsoat holdouts remained in area unsuitable for Batea agriculture, or in instances of Iratsoat adopting Batea agricultral practices.\r\n\r\nTambuli records show contact with Onchera in 483EC, noting them as 'civilised barbarians' ruled by dozens upon dozens of kingdoms. The expansionist Gamadi dynasty neglected funding for counter-piracy, making trade between Onchera and the Tambuli difficult. Late Gamadi records note the almost industrial production of blood algae wines in southern Onchera. \r\n\r\nIn 1432EC, the Hadashule dynasty issued charters for the establishment of colonies and trade settlements across the Oncheran archaepeligo.\r\n\r\n=== Imperial era ===\r\n\r\n=== Feudal era ===\r\n\r\n=== Modern era===\r\n\r\n\r\n\r\n== Geography ==\r\n\r\nOnchera is an archipelago of 3,213 islands situated in the [[Ouken Ocean]] in [[West Hashir]]. The islands are grouped into provinces centred on the seven largest islands: [[Iparaleroa]], [[Ossela]], [[Maera]], [[Lureta]], [[Tarkolur]], [[Kizgar]], [[Nasseta]], and [[Tssabura]]. The [[West Onchera Reef]] protects the archipelago from the toxic [[Ouken blood algae]] prevalent in the open ocean.\r\n\r\n== Government and politics ==\r\n\r\n== Demographics ==\r\n\r\n=== Religion ===\r\n\r\nThe predominant faith is the [[Aidegani]], practised by approximately 72.1% of the population. [[Tanism]] accounts for 20.0%, [[Havimism]] for 5.9%, with the remaining 2% following other traditions.\r\n\r\n[[Category:Countries]]\r\n[[Category:Monarchies]]\r\n	6077		9	2026-03-31 20:10:37.080827+00
126	45	Earth	hi	2		9	2026-04-01 07:24:29.303309+00
127	45	Earth	hi	2		9	2026-04-01 07:24:33.073832+00
128	45	Earth	hi hu	5		9	2026-04-01 11:10:12.210522+00
129	45	Earth	hi hu	5		9	2026-04-01 11:10:17.971592+00
130	15	Kiranshelokism	[[File:Тхост._дзуар.jpg|thumb|Dhoqo (Đoko) Temple, dedicated to Ževra, in the Ŧovum Gorge, Kroŧ, Mowum Republic]]\r\n\r\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\r\n\r\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a ''volavont'', which can include temples, shrines, altars, and any physical structure accociated with worship.\r\n\r\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \r\n\r\n\r\n\r\n== Status ==\r\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \r\n\r\n\r\n== Beliefs ==\r\n=== Vola ===\r\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \r\n\r\n\r\n== History ==\r\n=== Early roots ===\r\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \r\n\r\n	2446	Moved from "Kiranshelokism" (kiranshelokism) to "Kiranshelokism" (Kiranshelokism)	9	2026-04-03 13:37:58.796992+00
131	15	Kiranshelokism	[[File:Тхост._дзуар.jpg|400px|Dhoqo (Đoko) Temple, dedicated to Ževra, in the Ŧovum Gorge, Kroŧ, Mowum Republic]]\n\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\n\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a ''volavont'', which can include temples, shrines, altars, and any physical structure accociated with worship.\n\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \n\n\n\n== Status ==\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \n\n\n== Beliefs ==\n=== Vola ===\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \n\n\n== History ==\n=== Early roots ===\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \n\n	2423		9	2026-04-03 16:44:23.785548+00
132	15	Kiranshelokism	[[File:Тхост._дзуар.jpg|thumb|Dhoqo (Đoko) Temple, dedicated to Ževra, in the Ŧovum Gorge, Kroŧ, Mowum Republic]]\n\n'''Kiranshelokism''' (''Verėli Kıranšelok'', "Ardent Celestialism") is the state religion of [[Krelitser]]. Kiranshelokism is used to describe the polytheistic practices that are recognised and co-ordinated by the government of Krelitser. Scholars debate on the classification of Kiranshelokism as a proper religion or state ideology with several accociated faiths. Kiranshelokist priests and the state of Krelitser officially consider Kiranshelokism an organisation within a true celestial religion.\n\nKiranshelokism is a polytheistic and bureaucratic religion revolving around worship of multifaceted, shifting deities, known as ''[[vola]]''. There is no officially recorded model of the Kiranshelokist pantheon, but the same structure of the highest level of the pantheon is generally standardised. The ''vola'' are worshipped at any structure classified as a ''volavont'', which can include temples, shrines, altars, and any physical structure accociated with worship.\n\nKiranshelokism is primarily found in Krelitser, where there are around 300,000 state recognised ''volavont'', although practitioners are also found abroad in former territories of Krelitser and among Krelit diaspora. It is the largest declared religion in Krelitser. \n\n\n\n== Status ==\nKiranshelokism is inseperably a state institution of Krelitser. The state excercises total control over designation of volavont, finances, and ordination and training of priests. \n\n\n== Beliefs ==\n=== Vola ===\nKiranshelokism is polytheistic, involving the veneration of many deities known as ''vola''. Officially, there is no agreed number of ''vola'', as they vary between regional Kiranshelokist pratices, with some ''vola'' having multiple equivalents in other pantheons. On the highest levels of the pantheon, the structure, outside of a few variations in gender, has stabilised and is consistently professed across different regions. ''Vola'' are not regarded as omnipotent, omniscient, or necessarily immortal. \n\n\n== History ==\n=== Early roots ===\nKiranshelokism ultimately has its roots in the beliefs and faith of prehistory Kronthey peoples. The earliest surviving pieces of iconography that precede Kiranshelokism were found in the Later Jukshi period. It is generally believed by scholars that the Early Kronthey religion \n\n	2423		9	2026-04-03 16:44:34.739073+00
133	16	Krelitser	{{Infobox country\n|name = Republic of Krelitser\n|native_name = Krėlıtse Tsıda ([[Krelitseran language|Krelitseran]])\n|image = Krelitflag.png\n|Capital = [[Kirathara]]\n|Official languages = [[Krelitseran language|Krelitseran]]\n|Recognised regional languages = 22 regional official languages\n|Ethnic groups = 65% [[Krelits|Krelit]] <br> 5.7% [[Otse people|Otse]] <br> 3.2% [[Aris]] <br> 13.1% other <br> 13% not reported\n|Religion = 85.8% [[Kiranshelokism]] <br> 7.3% no religion <br> 3.9% [[Remanism]] <br> 3% others\n|Demonym = Krelitseran\n|Government = Federal hereditary republic\n|Queen = [[Šerėnta]]\n|Legislature = [[Realm Council]]\n|Formation = [[Kingdom of Krelitser]]: 1703 <br> [[Kingdom of Kirathara]]: 1945\n|Currency = Krelit shara (KS)\n|Calling code = +91\n|Internet TLD = .kr\n}}\n\n'''Krelitser''', officially the '''Republic of Krelitser''' is a country in the central and northern area of [[Thentey]]. With over 120 million people, Krelitser is the largest and most populous country in Thentey, and eleventh most in the world. It is a moderately urbanised country, with population mostly concentrated in regional capitals in the southern areas, and extremely concetrated in a few cities in the northern areas.\n\nHuman settlement on the territory of modern Krelitser dates back to the [[Lower kys era]]. The [[Kronthey]] emerged as a distinct group in [[Thentey]] between the 11th and 12th centuries EC. The early Kronthey tribes centralised into early states in the periphery of the Negewians. \n\n\n\nThe [[Principality of Kirathara]] would go on to unite most of the region by the 20th century, eventually taking the title of kingdom. [[Dynastic conflicts in the 23th century]] tore the kingdom to pieces, and invited several partitions of the kingdom's former territory. Several states left in the wake of the dissolution came to recognise a shared leader, and formed the [[Krelitser League]], which by the 25th century, had taken control over most of the former territory of the kingdom. In 2490, the league would formally centralise into the Republic of Krelitser. By the early 27th century, Krelitser had vastly expanded through conquest, annexation, and the efforts of Krelit explorers, becoming and remaining the third-largest empire in history.\n\nKrelitser began industrialising in the mid 30th century, becoming a major exporter of raw minerals. After disasterous failure in the [[Third Krelitser-Otse war]], Krelitser introduced labour reforms to quell domestic unrest. Internal pressure over the loss led to a large reform and centralisation of the Krelitserian military.\n\n== Etymology ==\n\n''Krelitser'' is a scholasticisation of the Krelit word name, Krėlıtse. Usage of the name dates back to before the Kingdom of Krelitser. Etymologically, ''Krėlıtse'' comes from the Proto-Dardnish '''krols₁''', meaning "heart". The Mazarean region of Rulšam is etymologically related, meaning "heartland".\n\n== History ==\n\n=== Prehistory ===\n\n=== Early history ===\n\n=== Kingdom of Krelitser ===\nThe establishment of the first Krelit states in the\n\n=== Kingdom of Kirathara ===\n\n=== Unification ===\n\n=== Early realm ===\n\n=== Industrialisation ===\n\n== Government and politics ==\nKrelitser is an absolute monarchy with a federal system, ruled by a queen as head of state, and an appointed prime minister a \n\n=== Political divisions ===\n\n=== Military ===\n\n== Economy ==\n\nKrelitser's\n	3393		9	2026-04-04 10:52:23.183915+00
\.


--
-- Data for Name: definitions; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.definitions (id, entry_id, sense_number, part_of_speech, definition, usage_example, usage_translation, created_at, dialect_id) FROM stdin;
1	1	1	noun	A republic	\N	republic	2026-03-20 16:00:19.812462+00	\N
15	3	1	noun	a mountain	\N	mountain	2026-03-20 17:09:46.275102+00	\N
16	5	1	noun	Krelitser	\N	Krelitser	2026-03-20 17:20:27.605581+00	\N
17	6	1	\N	heart	\N	heart	2026-03-20 17:23:27.339366+00	\N
26	12	1	noun	mother	\N	mother	2026-03-22 01:50:50.5209+00	\N
27	13	1	noun	one	\N	one	2026-03-22 02:02:17.755777+00	\N
28	14	1	noun	city	\N	\N	2026-03-22 04:44:36.952981+00	\N
29	15	1	proper noun	Rabekareta	\N	\N	2026-03-22 04:45:33.114304+00	\N
30	16	1	verb	kill	\N	\N	2026-03-22 04:48:41.206898+00	\N
31	17	1	noun	dye	\N	\N	2026-03-22 04:55:33.161815+00	\N
32	18	1	noun	province	\N	\N	2026-03-22 04:57:20.1737+00	\N
33	19	1	noun	stead	\N	\N	2026-03-22 04:58:00.263004+00	\N
36	22	1	noun	place	\N	place	2026-03-22 05:06:58.663024+00	\N
38	23	1	noun	a shrine, temple	\N	\N	2026-03-22 05:08:22.285883+00	\N
39	21	1	noun	([[Kiranshelokism]]) a deity, god	\N	vola	2026-03-22 08:39:27.449098+00	\N
40	11	1	adjective	great	\N	great	2026-03-22 08:58:09.895851+00	\N
41	24	1	numeral	(number theory) The first positive number in the set of natural numbers.	\N	one	2026-03-22 09:36:03.65571+00	\N
43	25	1	numeral	(number theory) The second positive number in the set of natural numbers.	\N	two	2026-03-22 09:44:54.014158+00	\N
44	20	1	noun	snow	\N	\N	2026-03-22 09:45:07.906344+00	\N
47	2	1	noun	The Sun	\N	Sun	2026-03-22 12:52:17.354364+00	\N
48	2	2	proper noun	The solar goddess Kıraŧar	\N	Kıraŧar	2026-03-22 12:52:17.354364+00	\N
49	10	1	adjective	ardently held	\N	ardent	2026-03-22 12:52:27.901023+00	\N
50	26	1	noun	summer	\N	summer	2026-03-22 16:43:04.352821+00	\N
51	27	1	noun	the sun	\N	sun	2026-03-22 16:43:57.331821+00	\N
52	28	1	noun	The high priestess of Onchera	\N	\N	2026-03-23 00:04:01.844841+00	\N
53	29	1	proper noun	Nilscodd	\N	\N	2026-03-24 13:53:43.890156+00	\N
54	30	1	proper noun	Tornamm	\N	\N	2026-03-24 13:54:05.732431+00	\N
57	31	1	proper noun	Onchera	\N	\N	2026-03-30 16:04:31.439059+00	\N
\.


--
-- Data for Name: inflected_forms; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.inflected_forms (id, entry_id, form, cell_key, is_override) FROM stdin;
\.


--
-- Data for Name: inflection_dimensions; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.inflection_dimensions (id, language_id, part_of_speech, name, dim_values, sort_order) FROM stdin;
\.


--
-- Data for Name: language_dialects; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.language_dialects (id, language_id, name, slug, region, description) FROM stdin;
\.


--
-- Data for Name: languages; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.languages (id, name, slug, native_name, script, family, color, description, created_at, updated_at, page_slug, parent_language_id, language_type) FROM stdin;
4	Proto-Mira	proto-mira	\N	Latin	Mira	#4e927d	\N	2026-03-20 17:04:36.427933+00	2026-03-20 17:15:59.75+00	proto-mira_language	\N	proto
1	Oncheran	oncheran	Ontsserasaba	Latin	Mira	#439c49	Oncheran language is an umbrella term for all Oncheran languages, widely recognised as a collection of language varities, spoken natively by is 103 million speakers, primarily in Onchera.	2026-03-20 14:02:57.180803+00	2026-03-20 18:40:50.588+00	Oncheran_language	\N	language
2	Krelitseran	krelitseran	Krel tosum	Latin	\N	#3865a7	\N	2026-03-20 15:02:44.53797+00	2026-03-20 19:15:59.083+00	krelitseran_language	6	language
6	Proto-Dorupan	proto-dorupan	\N	Latin	Dorupan	#464899	\N	2026-03-20 17:23:04.595691+00	2026-03-20 19:16:06.871+00	\N	\N	proto
3	Nilscoddi	nilscoddish	Nilscoddi	Latin	\N	#fa76df	\N	2026-03-20 16:44:31.357695+00	2026-03-21 05:18:44.141+00	nilscoddi_language	\N	language
5	Mazarean	mazarean	Mazariš tam	Latin	\N	#d97706	\N	2026-03-20 17:22:41.276071+00	2026-03-21 13:14:07.326+00	mazarean_language	6	language
7	Classical Myreni	classical-myreni	\N	Latin	\N	#e7b169	\N	2026-03-22 09:01:39.536278+00	2026-03-22 09:07:02.854+00	Classical_Myreni	\N	historical
\.


--
-- Data for Name: lexicon; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.lexicon (id, word, language_id, pronunciation, etymology, notes, page_slug, tags, created_at, updated_at, search_vector, homograph_number) FROM stdin;
1	tsıda	2	/tsıda/	\N	\N	\N	{government}	2026-03-20 15:03:46.718726+00	2026-03-20 16:00:19.812462+00	'republ':3B 'tsıda':1A	1
13	em	1	/em/	\N	\N	\N	{numbers}	2026-03-22 02:02:17.755777+00	2026-03-22 02:02:17.77+00	'em':1A 'one':2B	1
3	metsiak	1	/mets.iak/	\N	\N	\N	{geography}	2026-03-20 17:03:37.0987+00	2026-03-20 17:09:46.276+00	'metsiak':1A 'mountain':3B	1
14	kareta	1	\N	\N	\N	\N	{}	2026-03-22 04:44:36.952981+00	2026-03-22 04:44:36.965+00	'citi':2B 'kareta':1A	1
15	Rabekareta	1	\N	\N	\N	Rabekareta	{places}	2026-03-22 04:45:33.114304+00	2026-03-22 04:45:33.118+00	'rabekareta':1A,2B	1
5	Krėlıtse	2	\N	\N	\N	Krelitser	{country}	2026-03-20 17:20:27.601353+00	2026-03-20 17:20:27.607+00	'krelits':2B 'krėlıtse':1A	1
16	makala	1	\N	\N	\N	\N	{verb}	2026-03-22 04:48:41.206898+00	2026-03-22 04:48:41.215+00	'kill':2B 'makala':1A	1
6	*krols₁	6	\N	\N	\N	\N	{}	2026-03-20 17:23:27.335489+00	2026-03-20 17:23:27.342+00	'heart':2B 'krol':1A	1
17	tor	3	\N	\N	\N	\N	{}	2026-03-22 04:55:33.161815+00	2026-03-22 04:55:33.181+00	'dye':2B 'tor':1A	1
18	xāsa	5	\N	\N	\N	\N	{}	2026-03-22 04:57:20.1737+00	2026-03-22 04:57:20.179+00	'provinc':2B 'xāsa':1A	1
19	thara	2	\N	\N	\N	\N	{}	2026-03-22 04:58:00.263004+00	2026-03-22 04:58:00.272+00	'stead':2B 'thara':1A	1
22	vont	2	\N	\N	\N	\N	{}	2026-03-22 05:06:58.663024+00	2026-03-22 05:06:58.667+00	'place':2B 'vont':1A	1
24	ivol	2	/i.vol/	\N	\N	\N	{numerals,mathematics}	2026-03-22 09:36:03.65571+00	2026-03-22 09:36:03.673+00	'first':5B 'ivol':1A 'natur':12B 'number':2B,7B,13B 'posit':6B 'set':10B 'theori':3B	1
23	volavont	2	\N	\N	\N	\N	{religion}	2026-03-22 05:07:46.385779+00	2026-03-22 05:08:22.289+00	'shrine':3B 'templ':4B 'volavont':1A	1
21	vola	2	\N	\N	\N	\N	{religion}	2026-03-22 05:05:14.161931+00	2026-03-22 08:39:27.459+00	'deiti':4B 'god':5B 'kiranshelok':2B 'vola':1A	1
31	Ontssera	1	\N	\N	\N	Onchera	{}	2026-03-25 13:14:16.335611+00	2026-03-30 16:04:31.448+00	'onchera':2B 'ontssera':1A	1
11	rab	1	/rab/	\N	\N	\N	{}	2026-03-22 01:43:40.275091+00	2026-03-22 08:58:09.907+00	'great':2B 'rab':1A	1
10	verėli	2	\N	\N	\N	\N	{religion}	2026-03-20 18:22:03.122104+00	2026-03-22 12:52:27.904+00	'ardent':2B 'held':3B 'verėli':1A	1
12	ama	1	/am.a/	\N	\N	\N	{family}	2026-03-22 01:50:50.5209+00	2026-03-22 01:50:50.535+00	'ama':1A 'mother':2B	1
25	sri	2	/sri/	\N	\N	\N	{numerals,mathematics}	2026-03-22 09:36:47.972512+00	2026-03-22 09:44:54.025+00	'natur':12B 'number':2B,7B,13B 'posit':6B 'second':5B 'set':10B 'sri':1A 'theori':3B	1
20	turo	2	\N	\N	\N	\N	{}	2026-03-22 04:58:30.929021+00	2026-03-22 09:45:07.914+00	'snow':2B 'turo':1A	1
26	suda	1	\N	\N	\N	\N	{seasons}	2026-03-22 16:43:04.352821+00	2026-03-22 16:43:04.367+00	'suda':1A 'summer':2B	1
2	kıraŧar	2	/kıˈraθar/	\N	\N	Kıraŧar	{}	2026-03-20 15:11:31.085599+00	2026-03-22 12:52:17.36+00	'goddess':6B 'kıraŧar':1A,7B 'solar':5B 'sun':3B	1
27	mize	1	\N	\N	\N	\N	{}	2026-03-22 16:43:57.331821+00	2026-03-22 16:43:57.343+00	'mize':1A 'sun':3B	1
28	elekoneta	1	\N	\N	\N	\N	{religion,monarchy}	2026-03-23 00:04:01.844841+00	2026-03-23 00:04:01.855+00	'elekoneta':1A 'high':3B 'onchera':6B 'priestess':4B	1
29	Nilscodd	3	\N	\N	\N	\N	{countries}	2026-03-24 13:53:43.890156+00	2026-03-24 13:53:43.915+00	'nilscodd':1A,2B	1
30	Tornamm	3	\N	\N	\N	\N	{}	2026-03-24 13:54:05.732431+00	2026-03-24 13:54:05.745+00	'tornamm':1A,2B	1
\.


--
-- Data for Name: lexicon_inflections; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.lexicon_inflections (id, entry_id, class_id, stem, overrides) FROM stdin;
\.


--
-- Data for Name: lexicon_relations; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.lexicon_relations (id, source_id, target_id, relation_type, notes, created_at) FROM stdin;
5	5	6	derived_from	\N	2026-03-20 19:03:39.605877+00
6	15	11	compound_of	\N	2026-03-22 04:45:33.114304+00
7	15	14	compound_of	\N	2026-03-22 04:45:33.114304+00
10	23	21	compound_of	\N	2026-03-22 08:47:19.478823+00
11	23	22	compound_of	\N	2026-03-22 08:47:31.266858+00
\.


--
-- Data for Name: lexicon_revisions; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.lexicon_revisions (id, entry_id, snapshot, edit_summary, user_id, created_at) FROM stdin;
1	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:00:19.812Z", "languageId": 2, "definitions": [{"id": 2, "entryId": 2, "createdAt": "2026-03-20T16:00:19.812Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": "Sun"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Headword updated	9	2026-03-20 16:42:51.542454+00
2	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:42:51.550Z", "languageId": 2, "definitions": [{"id": 2, "entryId": 2, "createdAt": "2026-03-20T16:00:19.812Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": "Sun"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Definitions updated	9	2026-03-20 16:42:51.909662+00
3	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:42:51.928Z", "languageId": 2, "definitions": [{"id": 3, "entryId": 2, "createdAt": "2026-03-20T16:42:51.922Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": "Sun"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Headword updated	9	2026-03-20 16:48:29.181007+00
4	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:48:29.185Z", "languageId": 2, "definitions": [{"id": 3, "entryId": 2, "createdAt": "2026-03-20T16:42:51.922Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": "Sun"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Definitions updated	9	2026-03-20 16:48:29.543724+00
5	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:48:29.563Z", "languageId": 2, "definitions": [{"id": 4, "entryId": 2, "createdAt": "2026-03-20T16:48:29.549Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 5, "entryId": 2, "createdAt": "2026-03-20T16:48:29.557Z", "dialectId": null, "definition": "The solar goddess Kıraŧar", "senseNumber": 2, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Headword updated	9	2026-03-20 16:48:40.716526+00
6	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:48:40.718Z", "languageId": 2, "definitions": [{"id": 4, "entryId": 2, "createdAt": "2026-03-20T16:48:29.549Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 5, "entryId": 2, "createdAt": "2026-03-20T16:48:29.557Z", "dialectId": null, "definition": "The solar goddess Kıraŧar", "senseNumber": 2, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Definitions updated	9	2026-03-20 16:48:41.064141+00
7	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:48:41.077Z", "languageId": 2, "definitions": [{"id": 6, "entryId": 2, "createdAt": "2026-03-20T16:48:41.071Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 7, "entryId": 2, "createdAt": "2026-03-20T16:48:41.075Z", "dialectId": null, "definition": "The solar goddess [[Kıraŧar]]", "senseNumber": 2, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Headword updated	9	2026-03-20 16:48:46.955383+00
8	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:48:46.958Z", "languageId": 2, "definitions": [{"id": 6, "entryId": 2, "createdAt": "2026-03-20T16:48:41.071Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 7, "entryId": 2, "createdAt": "2026-03-20T16:48:41.075Z", "dialectId": null, "definition": "The solar goddess [[Kıraŧar]]", "senseNumber": 2, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Definitions updated	9	2026-03-20 16:48:47.303642+00
9	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:03:37.112Z", "languageId": 1, "definitions": [{"id": 10, "entryId": 3, "createdAt": "2026-03-20T17:03:37.106Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "`/mets.iak/`", "homographNumber": 1}	Headword updated	9	2026-03-20 17:03:41.636088+00
10	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:03:41.639Z", "languageId": 1, "definitions": [{"id": 10, "entryId": 3, "createdAt": "2026-03-20T17:03:37.106Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "`/mets.iak/", "homographNumber": 1}	Definitions updated	9	2026-03-20 17:03:41.986229+00
11	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:03:41.995Z", "languageId": 1, "definitions": [{"id": 11, "entryId": 3, "createdAt": "2026-03-20T17:03:41.992Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "`/mets.iak/", "homographNumber": 1}	Headword updated	9	2026-03-20 17:03:47.985179+00
12	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:03:47.988Z", "languageId": 1, "definitions": [{"id": 11, "entryId": 3, "createdAt": "2026-03-20T17:03:41.992Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "/mets.iak/", "homographNumber": 1}	Definitions updated	9	2026-03-20 17:03:48.331855+00
13	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:03:48.342Z", "languageId": 1, "definitions": [{"id": 12, "entryId": 3, "createdAt": "2026-03-20T17:03:48.339Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "/mets.iak/", "homographNumber": 1}	Headword updated	9	2026-03-20 17:09:35.020446+00
14	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:09:35.024Z", "languageId": 1, "definitions": [{"id": 12, "entryId": 3, "createdAt": "2026-03-20T17:03:48.339Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "/mets.iak/", "homographNumber": 1}	Definitions updated	9	2026-03-20 17:09:35.362436+00
15	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:09:35.370Z", "languageId": 1, "definitions": [{"id": 14, "entryId": 3, "createdAt": "2026-03-20T17:09:35.368Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "/mets.iak/", "homographNumber": 1}	Headword updated	9	2026-03-20 17:09:45.931913+00
16	3	{"id": 3, "tags": ["geography"], "word": "metsiak", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T17:03:37.098Z", "etymology": null, "updatedAt": "2026-03-20T17:09:45.935Z", "languageId": 1, "definitions": [{"id": 14, "entryId": 3, "createdAt": "2026-03-20T17:09:35.368Z", "dialectId": null, "definition": "a mountain", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "mountain"}], "pronunciation": "/mets.iak/", "homographNumber": 1}	Definitions updated	9	2026-03-20 17:09:46.270129+00
19	23	{"id": 23, "tags": ["religion"], "word": "volavont", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T05:07:46.385Z", "etymology": null, "updatedAt": "2026-03-22T05:07:46.389Z", "languageId": 2, "definitions": [{"id": 37, "entryId": 23, "createdAt": "2026-03-22T05:07:46.385Z", "dialectId": null, "definition": "a shrine, temple", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Headword updated	9	2026-03-22 05:08:21.798789+00
20	23	{"id": 23, "tags": ["religion"], "word": "volavont", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T05:07:46.385Z", "etymology": null, "updatedAt": "2026-03-22T05:08:21.802Z", "languageId": 2, "definitions": [{"id": 37, "entryId": 23, "createdAt": "2026-03-22T05:07:46.385Z", "dialectId": null, "definition": "a shrine, temple", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Definitions updated	9	2026-03-22 05:08:22.284149+00
21	21	{"id": 21, "tags": ["religion"], "word": "vola", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T05:05:14.161Z", "etymology": null, "updatedAt": "2026-03-22T05:05:14.167Z", "languageId": 2, "definitions": [{"id": 35, "entryId": 21, "createdAt": "2026-03-22T05:05:14.161Z", "dialectId": null, "definition": "(Kiranshelokism) a deity, god", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "vola"}], "pronunciation": null, "homographNumber": 1}	Headword updated	9	2026-03-22 08:39:27.081805+00
22	21	{"id": 21, "tags": ["religion"], "word": "vola", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T05:05:14.161Z", "etymology": null, "updatedAt": "2026-03-22T08:39:27.086Z", "languageId": 2, "definitions": [{"id": 35, "entryId": 21, "createdAt": "2026-03-22T05:05:14.161Z", "dialectId": null, "definition": "(Kiranshelokism) a deity, god", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "vola"}], "pronunciation": null, "homographNumber": 1}	Definitions updated	9	2026-03-22 08:39:27.443198+00
23	11	{"id": 11, "tags": [], "word": "rab", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T01:43:40.275Z", "etymology": null, "updatedAt": "2026-03-22T01:43:40.324Z", "languageId": 1, "definitions": [{"id": 25, "entryId": 11, "createdAt": "2026-03-22T01:43:40.275Z", "dialectId": null, "definition": "great", "senseNumber": 1, "partOfSpeech": "adjective", "usageExample": null, "usageTranslation": "great"}], "pronunciation": "/ræb/", "homographNumber": 1}	Headword updated	9	2026-03-22 08:58:09.54056+00
24	11	{"id": 11, "tags": [], "word": "rab", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T01:43:40.275Z", "etymology": null, "updatedAt": "2026-03-22T08:58:09.544Z", "languageId": 1, "definitions": [{"id": 25, "entryId": 11, "createdAt": "2026-03-22T01:43:40.275Z", "dialectId": null, "definition": "great", "senseNumber": 1, "partOfSpeech": "adjective", "usageExample": null, "usageTranslation": "great"}], "pronunciation": "/rab/", "homographNumber": 1}	Definitions updated	9	2026-03-22 08:58:09.891729+00
25	25	{"id": 25, "tags": ["numerals", "mathematics"], "word": "sri", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T09:36:47.972Z", "etymology": null, "updatedAt": "2026-03-22T09:36:47.981Z", "languageId": 2, "definitions": [{"id": 42, "entryId": 25, "createdAt": "2026-03-22T09:36:47.972Z", "dialectId": null, "definition": "(number theory) The second positive number in the set of natural numbers.", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": "two"}], "pronunciation": "/sri/", "homographNumber": 1}	Headword updated	9	2026-03-22 09:44:53.644774+00
26	25	{"id": 25, "tags": ["numerals", "mathematics"], "word": "sri", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T09:36:47.972Z", "etymology": null, "updatedAt": "2026-03-22T09:44:53.651Z", "languageId": 2, "definitions": [{"id": 42, "entryId": 25, "createdAt": "2026-03-22T09:36:47.972Z", "dialectId": null, "definition": "(number theory) The second positive number in the set of natural numbers.", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": "two"}], "pronunciation": "/sri/", "homographNumber": 1}	Definitions updated	9	2026-03-22 09:44:54.00927+00
27	20	{"id": 20, "tags": [], "word": "turo", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T04:58:30.929Z", "etymology": null, "updatedAt": "2026-03-22T04:58:30.941Z", "languageId": 2, "definitions": [{"id": 34, "entryId": 20, "createdAt": "2026-03-22T04:58:30.929Z", "dialectId": null, "definition": "Snow", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Headword updated	9	2026-03-22 09:45:07.557871+00
28	20	{"id": 20, "tags": [], "word": "turo", "notes": null, "pageSlug": null, "createdAt": "2026-03-22T04:58:30.929Z", "etymology": null, "updatedAt": "2026-03-22T09:45:07.561Z", "languageId": 2, "definitions": [{"id": 34, "entryId": 20, "createdAt": "2026-03-22T04:58:30.929Z", "dialectId": null, "definition": "Snow", "senseNumber": 1, "partOfSpeech": null, "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Definitions updated	9	2026-03-22 09:45:07.90321+00
29	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-20T16:48:47.316Z", "languageId": 2, "definitions": [{"id": 8, "entryId": 2, "createdAt": "2026-03-20T16:48:47.309Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 9, "entryId": 2, "createdAt": "2026-03-20T16:48:47.312Z", "dialectId": null, "definition": "The solar goddess Kıraŧar", "senseNumber": 2, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Headword updated	9	2026-03-22 12:51:56.91183+00
30	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-22T12:51:56.916Z", "languageId": 2, "definitions": [{"id": 8, "entryId": 2, "createdAt": "2026-03-20T16:48:47.309Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 9, "entryId": 2, "createdAt": "2026-03-20T16:48:47.312Z", "dialectId": null, "definition": "The solar goddess Kıraŧar", "senseNumber": 2, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Definitions updated	9	2026-03-22 12:51:57.267159+00
31	2	{"id": 2, "tags": [], "word": "Kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-22T12:51:57.278Z", "languageId": 2, "definitions": [{"id": 45, "entryId": 2, "createdAt": "2026-03-22T12:51:57.269Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 46, "entryId": 2, "createdAt": "2026-03-22T12:51:57.269Z", "dialectId": null, "definition": "The solar goddess Kıraŧar", "senseNumber": 2, "partOfSpeech": "proper noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Headword updated	9	2026-03-22 12:52:17.001977+00
32	2	{"id": 2, "tags": [], "word": "kıraŧar", "notes": null, "pageSlug": "Kıraŧar", "createdAt": "2026-03-20T15:11:31.085Z", "etymology": null, "updatedAt": "2026-03-22T12:52:17.005Z", "languageId": 2, "definitions": [{"id": 45, "entryId": 2, "createdAt": "2026-03-22T12:51:57.269Z", "dialectId": null, "definition": "The Sun", "senseNumber": 1, "partOfSpeech": "noun", "usageExample": null, "usageTranslation": "Sun"}, {"id": 46, "entryId": 2, "createdAt": "2026-03-22T12:51:57.269Z", "dialectId": null, "definition": "The solar goddess Kıraŧar", "senseNumber": 2, "partOfSpeech": "proper noun", "usageExample": null, "usageTranslation": "Kıraŧar"}], "pronunciation": "/kıˈraθar/", "homographNumber": 1}	Definitions updated	9	2026-03-22 12:52:17.351984+00
33	10	{"id": 10, "tags": ["religion"], "word": "Verėli", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T18:22:03.122Z", "etymology": null, "updatedAt": "2026-03-20T18:22:03.138Z", "languageId": 2, "definitions": [{"id": 24, "entryId": 10, "createdAt": "2026-03-20T18:22:03.130Z", "dialectId": null, "definition": "ardently held", "senseNumber": 1, "partOfSpeech": "adjective", "usageExample": null, "usageTranslation": "ardent"}], "pronunciation": null, "homographNumber": 1}	Headword updated	9	2026-03-22 12:52:27.556421+00
34	10	{"id": 10, "tags": ["religion"], "word": "verėli", "notes": null, "pageSlug": null, "createdAt": "2026-03-20T18:22:03.122Z", "etymology": null, "updatedAt": "2026-03-22T12:52:27.560Z", "languageId": 2, "definitions": [{"id": 24, "entryId": 10, "createdAt": "2026-03-20T18:22:03.130Z", "dialectId": null, "definition": "ardently held", "senseNumber": 1, "partOfSpeech": "adjective", "usageExample": null, "usageTranslation": "ardent"}], "pronunciation": null, "homographNumber": 1}	Definitions updated	9	2026-03-22 12:52:27.899126+00
35	31	{"id": 31, "tags": [], "word": "Onchera", "notes": null, "pageSlug": null, "createdAt": "2026-03-25T13:14:16.335Z", "etymology": null, "updatedAt": "2026-03-25T13:14:16.350Z", "languageId": 1, "definitions": [{"id": 55, "entryId": 31, "createdAt": "2026-03-25T13:14:16.335Z", "dialectId": null, "definition": "Onchera", "senseNumber": 1, "partOfSpeech": "proper noun", "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Headword updated	9	2026-03-25 13:14:22.854093+00
36	31	{"id": 31, "tags": [], "word": "Onchera", "notes": null, "pageSlug": "Onchera", "createdAt": "2026-03-25T13:14:16.335Z", "etymology": null, "updatedAt": "2026-03-25T13:14:22.857Z", "languageId": 1, "definitions": [{"id": 55, "entryId": 31, "createdAt": "2026-03-25T13:14:16.335Z", "dialectId": null, "definition": "Onchera", "senseNumber": 1, "partOfSpeech": "proper noun", "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Definitions updated	9	2026-03-25 13:14:23.223015+00
37	31	{"id": 31, "tags": [], "word": "Onchera", "notes": null, "pageSlug": "Onchera", "createdAt": "2026-03-25T13:14:16.335Z", "etymology": null, "updatedAt": "2026-03-25T13:14:23.230Z", "languageId": 1, "definitions": [{"id": 56, "entryId": 31, "createdAt": "2026-03-25T13:14:23.225Z", "dialectId": null, "definition": "Onchera", "senseNumber": 1, "partOfSpeech": "proper noun", "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Headword updated	9	2026-03-30 16:04:31.083451+00
38	31	{"id": 31, "tags": [], "word": "Ontssera", "notes": null, "pageSlug": "Onchera", "createdAt": "2026-03-25T13:14:16.335Z", "etymology": null, "updatedAt": "2026-03-30T16:04:31.090Z", "languageId": 1, "definitions": [{"id": 56, "entryId": 31, "createdAt": "2026-03-25T13:14:23.225Z", "dialectId": null, "definition": "Onchera", "senseNumber": 1, "partOfSpeech": "proper noun", "usageExample": null, "usageTranslation": null}], "pronunciation": null, "homographNumber": 1}	Definitions updated	9	2026-03-30 16:04:31.434891+00
\.


--
-- Data for Name: lexicon_variants; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.lexicon_variants (id, entry_id, dialect_id, pronunciation, spelling, notes) FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.login_attempts (id, username, ip_address, success, created_at) FROM stdin;
1	rosehobgoblin	172.18.0.4	t	2026-04-01 04:18:44.877101+00
2	kyokyo	172.18.0.4	f	2026-04-01 16:07:37.486684+00
3	kyokyo	172.18.0.4	f	2026-04-01 16:10:44.705866+00
4	rosehobgoblin	172.18.0.4	t	2026-04-01 16:25:15.398264+00
5	rosehobgoblin	172.18.0.4	t	2026-04-01 16:26:13.243579+00
6	rosehobgoblin	172.18.0.4	t	2026-04-01 16:35:54.463157+00
7	rosehobgoblina	172.18.0.4	t	2026-04-01 16:38:44.82151+00
8	rosehobgoblin	172.18.0.4	t	2026-04-03 08:49:05.639787+00
9	madiwka	172.18.0.4	f	2026-04-04 18:45:55.029058+00
10	madiwka	172.18.0.4	f	2026-04-04 18:46:00.337533+00
11	madiwka	172.18.0.4	f	2026-04-04 18:46:04.405124+00
12	madiwka	172.18.0.4	f	2026-04-04 18:46:10.111571+00
13	madigga	172.18.0.4	t	2026-04-04 18:46:39.117318+00
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.media (id, filename, filepath, mime_type, width, height, size_bytes, uploaded_at, hash, description, uploaded_by, original_filename, has_thumb_150, has_thumb_300, has_thumb_600) FROM stdin;
1	Flag_of_Tornamm.png	/app/uploads/Flag_of_Tornamm.png	image/png	\N	\N	438325	2026-03-20 03:37:39.114497+00	\N	\N	\N	\N	f	f	f
3	FlagofAlmisan.png	/app/uploads/FlagofAlmisan.png	image/png	1440	1440	67391	2026-03-20 14:41:15.628249+00	01bd9f0c87d9ed4af024fbec6317de71fe3aa5e73bc0d86ca62e3884d36ae36b	\N	9	FlagofAlmisan.png	t	t	t
4	Krelitflag.png	/app/uploads/Krelitflag.png	image/png	1440	863	34480	2026-03-20 15:26:26.580673+00	f82a54b6bdd9e3a8eb9594760e68835a9e36b3e2e30cb65ad43fdd748991e93a	\N	9	Krelitflag.png	t	t	t
6	Ontsseraflag.png	/app/uploads/Ontsseraflag.png	image/png	1440	720	47789	2026-03-20 17:01:58.079704+00	2f325d4732655f9c21023442eec764a56ad9f47adf99678da561980aba2987ae	\N	9	Ontsseraflag.png	t	t	t
8	Asyltas.svg	/app/uploads/Asyltas.svg	image/svg+xml	\N	\N	9789	2026-03-23 16:50:15.725831+00	d86a43af3c6dc353949f3f74208e91ed6fa76748161fff8b0dee712abf92b1e8	\N	10	Asyltas.svg	f	f	f
9	red_algae.jpg	/app/uploads/red_algae.jpg	image/jpeg	1000	873	241058	2026-03-29 12:58:59.977104+00	f312fae30b844ab25733de61b159c4e95de2b3323187663dcf57bf6585ad948e	\N	9	red_algae.jpg	t	t	t
10	photo-1496823407868-80f47c7453b5.jpg.webp	/app/uploads/photo-1496823407868-80f47c7453b5.jpg.webp	image/webp	1000	636	211974	2026-03-30 10:10:44.655155+00	6718f95858cf02e9cd572facdef9868c58117e027c73b9c35877e00c9319bcc3	\N	9	photo-1496823407868-80f47c7453b5.jpg.webp	t	t	t
11	Тхост._дзуар.jpg	/app/uploads/Тхост._дзуар.jpg	image/jpeg	3264	2448	3693392	2026-03-31 07:01:51.780405+00	ff6abc7a3411e44385a5a07e0236850d2a4e35e124b53b8058b6e55b6496a15f	\N	9	Тхост._дзуар.jpg	t	t	t
\.


--
-- Data for Name: media_categories; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.media_categories (filename, category) FROM stdin;
\.


--
-- Data for Name: media_history; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.media_history (id, filename, user_id, action, details, created_at) FROM stdin;
1	Autosaved.png	9	upload	image/png, 66KB, 1440×1440	2026-03-20 14:40:46.470845+00
2	Autosaved.png	9	delete	image/png, 67391 bytes	2026-03-20 14:40:59.747872+00
3	FlagofAlmisan.png	9	upload	image/png, 66KB, 1440×1440	2026-03-20 14:41:15.630871+00
4	Krelitflag.png	9	upload	image/png, 34KB, 1440×863	2026-03-20 15:26:26.583797+00
5	Izaro.jpg	9	upload	image/jpeg, 1482KB, 2700×3000	2026-03-20 17:00:33.360595+00
6	Ontsseraflag.png	9	upload	image/png, 47KB, 1440×720	2026-03-20 17:01:58.084864+00
7	Izaro.jpg	9	delete	image/jpeg, 1517183 bytes	2026-03-20 19:30:04.987173+00
8	Untitled.svg	10	upload	image/svg+xml, 10KB	2026-03-23 16:49:07.836763+00
9	Untitled.svg	9	delete	image/svg+xml, 9789 bytes	2026-03-23 16:49:56.159701+00
10	Asyltas.svg	10	upload	image/svg+xml, 10KB	2026-03-23 16:50:15.729421+00
11	red_algae.jpg	9	upload	image/jpeg, 235KB, 1000×873	2026-03-29 12:58:59.981233+00
12	photo-1496823407868-80f47c7453b5.jpg.webp	9	upload	image/webp, 207KB, 1000×636	2026-03-30 10:10:44.66116+00
13	Тхост._дзуар.jpg	9	upload	image/jpeg, 3607KB, 3264×2448	2026-03-31 07:01:51.786682+00
\.


--
-- Data for Name: paradigm_classes; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.paradigm_classes (id, language_id, part_of_speech, name, description) FROM stdin;
\.


--
-- Data for Name: paradigm_rules; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.paradigm_rules (id, class_id, cell_key, pattern) FROM stdin;
\.


--
-- Data for Name: phonemes; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.phonemes (id, language_id, ipa, type, place, manner, subtype, voicing, height, backness, rounded, notes, sort_order) FROM stdin;
\.


--
-- Data for Name: planetary_bodies; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.planetary_bodies (id, name, slug, body_type, star_id, parent_id, page_slug, mass, radius, density, surface_gravity, escape_velocity, temperature, age, composition, atmosphere, surface_pressure, orbital_period, orbital_period_days, semi_major_axis, semi_major_axis_au, eccentricity, inclination, rotation_period, rotation_period_s, axial_tilt, apparent_magnitude, angular_diameter, albedo, satellites, has_rings, extra, description, created_at, updated_at, content_record_id, epoch_phase, mass_kg, radius_m) FROM stdin;
4	Seaxnēat	seaxnēat	planet	2	\N	\N	\N	\N	5.513 g/cm³	9.82 m/s²	11.186 km/s	288 K (mean)	\N	Iron, nickel, silicates	N₂ 78%, O₂ 21%, Ar 0.93%	\N	1.000 years	365.256	2.992e+7 km	0.2	0.0167	0	23h 56m 4s	86164	23.44	\N	\N	\N	0	f	{}		2026-04-01 15:52:21.566637+00	2026-04-01 15:57:49.871+00	48	\N	5.972e+24	6371000
2	Earth	earth	planet	1	\N	\N	1.000 M⊕	1.000 R⊕	5.513 g/cm³	9.82 m/s²	11.186 km/s	288 K (mean)	\N	Iron, nickel, silicates	N₂ 78%, O₂ 21%, Ar 0.93%	\N	365.2 days	\N	1.496e+8 km	1	0.0167	0	23h 56m 4s	86164	23.44	\N	\N	\N	0	f	{}		2026-03-31 20:47:23.248897+00	2026-04-04 18:48:08.91+00	45	\N	5.972e+24	6371000
5	Tesar	tesar	planet	1	\N	\N	1.000 Mⱼ	0.100 R☉	1.326 g/cm³	25.92 m/s²	60.200 km/s	165 K (cloud top)	\N	Hydrogen, helium (gas giant)	H₂ 89.8%, He 10.2%	\N	11.862 years	4332.59	6.029e+7 km	0.403	0.0489	1.303	9h 55m 30s	35730	3.13	\N	\N	\N	0	t	{}		2026-04-04 18:56:11.022871+00	2026-04-04 19:19:41.997+00	49	\N	1.898e+27	69911000
\.


--
-- Data for Name: registration_codes; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.registration_codes (id, code, created_by, used_by, role, used_at, expires_at, created_at) FROM stdin;
1	9324da663d42	9	\N	admin	\N	\N	2026-03-31 13:11:37.64284+00
2	335868752f74	9	\N	editor	\N	\N	2026-04-01 16:02:14.704583+00
3	75267099c3a5	9	\N	editor	\N	\N	2026-04-01 16:12:03.770386+00
4	637a253d8964	9	\N	editor	\N	\N	2026-04-01 16:25:23.272398+00
5	17418c56378b	9	31	editor	2026-04-01 16:35:42.607+00	\N	2026-04-01 16:35:24.163741+00
6	a87ff4903274	9	32	editor	2026-04-01 16:36:43.726+00	\N	2026-04-01 16:35:58.063225+00
7	9e42e26000a8	9	\N	admin	\N	\N	2026-04-04 18:46:08.874376+00
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.sessions (id, user_id, token, expires_at) FROM stdin;
4	9	e7b0f297c25af8c08f7b0cadaa95a14e0111b4f6bc22cf31f1fdaf8acb528cd1	2026-04-18 18:01:30.35+00
5	9	40d05a0956c0dc8448f46387ad04961c61e30deac9959274bab42d265af0c048	2026-04-18 22:56:01.599+00
7	9	b360e5e661c2a17b2a0ccb77ab5972f9c5d3b8ffab223dfb11ae74196f25c34c	2026-04-23 03:03:47.074+00
8	11	7423ef3e26d470710838bfd876ff85d6188c98da0a2839f675d43bfe694709b4	2026-04-28 13:50:52.85+00
9	9	1d103cb46bd0a0000f01a83b44c079b54034781935c27378089532ea7015ebc3	2026-04-29 09:53:15.562+00
11	9	02be082901a18f4910a5c185c0d9bcb05fa4f09fb545d4bdb650923a085f5f91	2026-05-01 04:18:44.881+00
16	32	26c9e3a2d0d0b4fd7913b20c8a6960538e8896431e3868bd58cd1df36b699200	2026-05-01 16:36:43.738+00
18	9	025bfb65048755e0be77510705c44a62f16f831c1c4f165cb72e90efe08ae923	2026-05-03 08:49:05.642+00
19	10	cea912c0f7d1812bda3b9d539939a194705ce86aeebe82bb1efa32bcb8ead962	2026-05-04 18:46:39.12+00
\.


--
-- Data for Name: site_settings; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.site_settings (key, value) FROM stdin;
nav_search_label	Search
site_name	KnowThing
site_tagline	A collaborative encyclopedia
institution_name	University of Almisan
footer_text	
logo_url	
text_direction	ltr
nav_wiki_label	Main Page
nav_create_label	Make
nav_wordbook_label	Wordbook
nav_calendar_label	Rimebook
wordbook_name	Wordbook
wordbook_enabled	true
calendar_enabled	true
\.


--
-- Data for Name: star_systems; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.star_systems (id, name, slug, page_slug, system_type, description, extra, created_at, updated_at, content_record_id) FROM stdin;
1	Sunly system	sunly	Sunly_system	binary		{}	2026-03-29 10:49:28.952605+00	2026-03-29 10:49:28.952605+00	36
\.


--
-- Data for Name: stars; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.stars (id, name, slug, page_slug, spectral_type, mass, radius, luminosity, luminosity_visual, temperature, age, color, orbital_period, semi_major_axis, semi_major_axis_au, eccentricity, periastron, apastron, apparent_magnitude, angular_diameter, companion, parent_star_id, extra, description, created_at, updated_at, system_id, content_record_id, epoch_phase, mass_kg, radius_m, luminosity_w, temperature_k, density, surface_gravity, escape_velocity, rotation_period, rotation_period_s, axial_tilt, orbital_period_days, absolute_magnitude, metallicity) FROM stdin;
2	Therne	therne	Therne	M3V	0.36 [[Sunly mass|M☉]]	0.39 [[Sunly radius|R☉]]	0.015 [[Sunly luminosity|L☉]] (bolometric)	0.0013 [[Sunly luminosity|L☉]] (V-band)	3,400 [[Kelvin|K]]	~4.6 billion years	Deep orange-red	140.9 years	30 [[Astronomical unit|AU]]	30	0.3	21.0 AU	39.0 AU	\N	\N	[[The Sun]] (G2V)	1	{"caption": "Therne near opposition, composite long-exposure image", "angular_diameter_max": "35.6 [[Arcsecond|arcsec]] (periastron)", "angular_diameter_min": "19.2 arcsec (apastron)", "apparent_magnitude_dim": "−11.9 (apastron conjunction)", "apparent_magnitude_bright": "−13.3 (periastron opposition)"}		2026-03-29 10:37:27.961662+00	2026-03-29 10:37:27.961662+00	1	34	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3	l'étoile brillante Misa	ltoile-brillante-misa	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}		2026-03-29 14:05:55.210024+00	2026-04-01 04:19:00.688+00	\N	46	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1	Sun	the-sun	Sun	G2V	1.0 [[Sunly mass|M☉]]	1.0 [[Sunly radius|R☉]]	1.0 [[Sunly luminosity|L☉]]	\N	5,778 [[Kelvin|K]]	~4.6 billion years	Yellow-white	\N	\N	\N	\N	\N	\N	−26.7	31.4 [[Arcminute|arcmin]]	[[Therne]] (M3V, 30 AU)	\N	{"caption": "The Sun, viewed through a clear sunly filter", "mean_distance": "1.02 [[Astronomical unit|AU]] (from [[Earth]])"}		2026-03-29 10:37:27.961662+00	2026-04-04 13:44:34.713+00	1	35	0	1.989e+30	695700000	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.templates (id, name, source, description, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: knowthing
--

COPY public.users (id, username, password_hash, role, created_at) FROM stdin;
11	misa	$2b$12$mRN0N0y7JJlk4.ol4s4Vye2O1JEHCKu3E1KNI62JjjMquUsvuKjfW	admin	2026-03-29 13:50:52.847308+00
9	RoseHobgoblin	$2b$12$Du1Ig9q.UoYWccHteKxh8OF5GGgpLYXNDL1TTfA5hQWX24WWKkTEG	owner	2026-03-19 18:01:30.346289+00
10	Madigga	$2b$12$827DS5a.pf7swYukT60OPuhJrG5e0EHiQz6XnzaBJdfdyVmSsy01S	admin	2026-03-20 19:05:21.9067+00
31	RoseHobgoblina	$2b$12$unByYVKVxoPUAmM3pFYI.OWZEDhC0XqemDERhSTUMbFv5JgF.Uw2K	editor	2026-04-01 16:35:42.609655+00
32	kyokyo122422@gmail.com	$2b$12$De4VL.8z3F/Qnp5RX4GDN.8uT7/d4gSajiM8TQFvd/bSMtH70TtL6	editor	2026-04-01 16:36:43.730977+00
\.


--
-- Name: _migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public._migrations_id_seq', 24, true);


--
-- Name: calendars_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.calendars_id_seq', 4, true);


--
-- Name: content_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.content_records_id_seq', 49, true);


--
-- Name: content_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.content_revisions_id_seq', 133, true);


--
-- Name: definitions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.definitions_id_seq', 57, true);


--
-- Name: inflected_forms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.inflected_forms_id_seq', 1, false);


--
-- Name: inflection_dimensions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.inflection_dimensions_id_seq', 1, false);


--
-- Name: language_dialects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.language_dialects_id_seq', 1, false);


--
-- Name: languages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.languages_id_seq', 7, true);


--
-- Name: lexicon_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.lexicon_id_seq', 31, true);


--
-- Name: lexicon_inflections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.lexicon_inflections_id_seq', 1, false);


--
-- Name: lexicon_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.lexicon_relations_id_seq', 11, true);


--
-- Name: lexicon_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.lexicon_revisions_id_seq', 38, true);


--
-- Name: lexicon_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.lexicon_variants_id_seq', 1, false);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 13, true);


--
-- Name: media_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.media_history_id_seq', 13, true);


--
-- Name: media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.media_id_seq', 11, true);


--
-- Name: paradigm_classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.paradigm_classes_id_seq', 1, false);


--
-- Name: paradigm_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.paradigm_rules_id_seq', 1, false);


--
-- Name: phonemes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.phonemes_id_seq', 1, false);


--
-- Name: planetary_bodies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.planetary_bodies_id_seq', 5, true);


--
-- Name: registration_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.registration_codes_id_seq', 7, true);


--
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.sessions_id_seq', 19, true);


--
-- Name: star_systems_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.star_systems_id_seq', 2, true);


--
-- Name: stars_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.stars_id_seq', 3, true);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.templates_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: knowthing
--

SELECT pg_catalog.setval('public.users_id_seq', 32, true);


--
-- Name: _migrations _migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_name_key UNIQUE (name);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: calendars calendars_name_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_name_key UNIQUE (name);


--
-- Name: calendars calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_pkey PRIMARY KEY (id);


--
-- Name: calendars calendars_slug_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_slug_key UNIQUE (slug);


--
-- Name: content_categories content_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_categories
    ADD CONSTRAINT content_categories_pkey PRIMARY KEY (content_record_id, category);


--
-- Name: content_links content_links_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_links
    ADD CONSTRAINT content_links_pkey PRIMARY KEY (source_id, target_domain, target_slug);


--
-- Name: content_media_usage content_media_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_media_usage
    ADD CONSTRAINT content_media_usage_pkey PRIMARY KEY (content_record_id, filename);


--
-- Name: content_records content_records_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_records
    ADD CONSTRAINT content_records_pkey PRIMARY KEY (id);


--
-- Name: content_revisions content_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_revisions
    ADD CONSTRAINT content_revisions_pkey PRIMARY KEY (id);


--
-- Name: definitions definitions_entry_id_sense_number_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.definitions
    ADD CONSTRAINT definitions_entry_id_sense_number_key UNIQUE (entry_id, sense_number);


--
-- Name: definitions definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.definitions
    ADD CONSTRAINT definitions_pkey PRIMARY KEY (id);


--
-- Name: inflected_forms inflected_forms_entry_id_cell_key_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflected_forms
    ADD CONSTRAINT inflected_forms_entry_id_cell_key_key UNIQUE (entry_id, cell_key);


--
-- Name: inflected_forms inflected_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflected_forms
    ADD CONSTRAINT inflected_forms_pkey PRIMARY KEY (id);


--
-- Name: inflection_dimensions inflection_dimensions_language_id_part_of_speech_name_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflection_dimensions
    ADD CONSTRAINT inflection_dimensions_language_id_part_of_speech_name_key UNIQUE (language_id, part_of_speech, name);


--
-- Name: inflection_dimensions inflection_dimensions_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflection_dimensions
    ADD CONSTRAINT inflection_dimensions_pkey PRIMARY KEY (id);


--
-- Name: language_dialects language_dialects_language_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.language_dialects
    ADD CONSTRAINT language_dialects_language_id_slug_key UNIQUE (language_id, slug);


--
-- Name: language_dialects language_dialects_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.language_dialects
    ADD CONSTRAINT language_dialects_pkey PRIMARY KEY (id);


--
-- Name: languages languages_name_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_name_key UNIQUE (name);


--
-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (id);


--
-- Name: languages languages_slug_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_slug_key UNIQUE (slug);


--
-- Name: lexicon_inflections lexicon_inflections_entry_id_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_inflections
    ADD CONSTRAINT lexicon_inflections_entry_id_key UNIQUE (entry_id);


--
-- Name: lexicon_inflections lexicon_inflections_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_inflections
    ADD CONSTRAINT lexicon_inflections_pkey PRIMARY KEY (id);


--
-- Name: lexicon lexicon_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon
    ADD CONSTRAINT lexicon_pkey PRIMARY KEY (id);


--
-- Name: lexicon_relations lexicon_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_relations
    ADD CONSTRAINT lexicon_relations_pkey PRIMARY KEY (id);


--
-- Name: lexicon_relations lexicon_relations_source_id_target_id_relation_type_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_relations
    ADD CONSTRAINT lexicon_relations_source_id_target_id_relation_type_key UNIQUE (source_id, target_id, relation_type);


--
-- Name: lexicon_revisions lexicon_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_revisions
    ADD CONSTRAINT lexicon_revisions_pkey PRIMARY KEY (id);


--
-- Name: lexicon_variants lexicon_variants_entry_id_dialect_id_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_variants
    ADD CONSTRAINT lexicon_variants_entry_id_dialect_id_key UNIQUE (entry_id, dialect_id);


--
-- Name: lexicon_variants lexicon_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_variants
    ADD CONSTRAINT lexicon_variants_pkey PRIMARY KEY (id);


--
-- Name: lexicon lexicon_word_lang_hom_unique; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon
    ADD CONSTRAINT lexicon_word_lang_hom_unique UNIQUE (word, language_id, homograph_number);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: media_categories media_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media_categories
    ADD CONSTRAINT media_categories_pkey PRIMARY KEY (filename, category);


--
-- Name: media media_filename_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_filename_key UNIQUE (filename);


--
-- Name: media_history media_history_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media_history
    ADD CONSTRAINT media_history_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: paradigm_classes paradigm_classes_language_id_part_of_speech_name_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_classes
    ADD CONSTRAINT paradigm_classes_language_id_part_of_speech_name_key UNIQUE (language_id, part_of_speech, name);


--
-- Name: paradigm_classes paradigm_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_classes
    ADD CONSTRAINT paradigm_classes_pkey PRIMARY KEY (id);


--
-- Name: paradigm_rules paradigm_rules_class_id_cell_key_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_rules
    ADD CONSTRAINT paradigm_rules_class_id_cell_key_key UNIQUE (class_id, cell_key);


--
-- Name: paradigm_rules paradigm_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_rules
    ADD CONSTRAINT paradigm_rules_pkey PRIMARY KEY (id);


--
-- Name: phonemes phonemes_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.phonemes
    ADD CONSTRAINT phonemes_pkey PRIMARY KEY (id);


--
-- Name: planetary_bodies planetary_bodies_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.planetary_bodies
    ADD CONSTRAINT planetary_bodies_pkey PRIMARY KEY (id);


--
-- Name: planetary_bodies planetary_bodies_slug_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.planetary_bodies
    ADD CONSTRAINT planetary_bodies_slug_key UNIQUE (slug);


--
-- Name: registration_codes registration_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.registration_codes
    ADD CONSTRAINT registration_codes_code_key UNIQUE (code);


--
-- Name: registration_codes registration_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.registration_codes
    ADD CONSTRAINT registration_codes_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);


--
-- Name: star_systems star_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.star_systems
    ADD CONSTRAINT star_systems_pkey PRIMARY KEY (id);


--
-- Name: star_systems star_systems_slug_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.star_systems
    ADD CONSTRAINT star_systems_slug_key UNIQUE (slug);


--
-- Name: stars stars_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.stars
    ADD CONSTRAINT stars_pkey PRIMARY KEY (id);


--
-- Name: stars stars_slug_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.stars
    ADD CONSTRAINT stars_slug_key UNIQUE (slug);


--
-- Name: templates templates_name_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_name_key UNIQUE (name);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_ccat_cat; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_ccat_cat ON public.content_categories USING btree (category);


--
-- Name: idx_clinks_target; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_clinks_target ON public.content_links USING btree (target_id);


--
-- Name: idx_clinks_target_slug; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_clinks_target_slug ON public.content_links USING btree (target_domain, target_slug);


--
-- Name: idx_clinks_target_slug_lower; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_clinks_target_slug_lower ON public.content_links USING btree (lower(target_slug));


--
-- Name: idx_cmu_filename; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_cmu_filename ON public.content_media_usage USING btree (filename);


--
-- Name: idx_cr_domain; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_cr_domain ON public.content_records USING btree (domain);


--
-- Name: idx_cr_domain_slug; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_cr_domain_slug ON public.content_records USING btree (domain, slug);


--
-- Name: idx_cr_search; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_cr_search ON public.content_records USING gin (search_vector);


--
-- Name: idx_cr_unique_slug; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE UNIQUE INDEX idx_cr_unique_slug ON public.content_records USING btree (domain, COALESCE(parent_path, ''::text), slug);


--
-- Name: idx_cr_updated; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_cr_updated ON public.content_records USING btree (updated_at);


--
-- Name: idx_crev_date; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_crev_date ON public.content_revisions USING btree (created_at);


--
-- Name: idx_crev_record; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_crev_record ON public.content_revisions USING btree (content_record_id);


--
-- Name: idx_definitions_entry; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_definitions_entry ON public.definitions USING btree (entry_id);


--
-- Name: idx_definitions_search; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_definitions_search ON public.definitions USING gin (search_vector);


--
-- Name: idx_dialects_language; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_dialects_language ON public.language_dialects USING btree (language_id);


--
-- Name: idx_infl_dim_lang; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_infl_dim_lang ON public.inflection_dimensions USING btree (language_id, part_of_speech);


--
-- Name: idx_inflected_forms_entry; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_inflected_forms_entry ON public.inflected_forms USING btree (entry_id);


--
-- Name: idx_inflected_forms_form; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_inflected_forms_form ON public.inflected_forms USING btree (form);


--
-- Name: idx_inflected_forms_trgm; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_inflected_forms_trgm ON public.inflected_forms USING gin (form public.gin_trgm_ops);


--
-- Name: idx_languages_parent; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_languages_parent ON public.languages USING btree (parent_language_id);


--
-- Name: idx_lex_infl_entry; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lex_infl_entry ON public.lexicon_inflections USING btree (entry_id);


--
-- Name: idx_lexicon_language; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexicon_language ON public.lexicon USING btree (language_id);


--
-- Name: idx_lexicon_search; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexicon_search ON public.lexicon USING gin (search_vector);


--
-- Name: idx_lexicon_tags; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexicon_tags ON public.lexicon USING gin (tags);


--
-- Name: idx_lexicon_word; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexicon_word ON public.lexicon USING btree (word);


--
-- Name: idx_lexicon_word_trgm; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexicon_word_trgm ON public.lexicon USING gin (word public.gin_trgm_ops);


--
-- Name: idx_lexrel_source; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexrel_source ON public.lexicon_relations USING btree (source_id);


--
-- Name: idx_lexrel_target; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexrel_target ON public.lexicon_relations USING btree (target_id);


--
-- Name: idx_lexrel_type; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexrel_type ON public.lexicon_relations USING btree (relation_type);


--
-- Name: idx_lexrev_entry; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_lexrev_entry ON public.lexicon_revisions USING btree (entry_id);


--
-- Name: idx_login_attempts_ip; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_login_attempts_ip ON public.login_attempts USING btree (ip_address, created_at);


--
-- Name: idx_login_attempts_username; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_login_attempts_username ON public.login_attempts USING btree (username, created_at);


--
-- Name: idx_media_categories_cat; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_media_categories_cat ON public.media_categories USING btree (category);


--
-- Name: idx_media_history_filename; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_media_history_filename ON public.media_history USING btree (filename);


--
-- Name: idx_media_search; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_media_search ON public.media USING gin (search_vector);


--
-- Name: idx_paradigm_rules_class; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_paradigm_rules_class ON public.paradigm_rules USING btree (class_id);


--
-- Name: idx_phonemes_language; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_phonemes_language ON public.phonemes USING btree (language_id);


--
-- Name: idx_phonemes_type; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_phonemes_type ON public.phonemes USING btree (language_id, type);


--
-- Name: idx_planetary_bodies_parent; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_planetary_bodies_parent ON public.planetary_bodies USING btree (parent_id);


--
-- Name: idx_planetary_bodies_slug; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_planetary_bodies_slug ON public.planetary_bodies USING btree (slug);


--
-- Name: idx_planetary_bodies_star; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_planetary_bodies_star ON public.planetary_bodies USING btree (star_id);


--
-- Name: idx_regcodes_code; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_regcodes_code ON public.registration_codes USING btree (code);


--
-- Name: idx_star_systems_slug; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_star_systems_slug ON public.star_systems USING btree (slug);


--
-- Name: idx_stars_slug; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_stars_slug ON public.stars USING btree (slug);


--
-- Name: idx_stars_system; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_stars_system ON public.stars USING btree (system_id);


--
-- Name: idx_variants_entry; Type: INDEX; Schema: public; Owner: knowthing
--

CREATE INDEX idx_variants_entry ON public.lexicon_variants USING btree (entry_id);


--
-- Name: definitions trg_definitions_touch; Type: TRIGGER; Schema: public; Owner: knowthing
--

CREATE TRIGGER trg_definitions_touch AFTER INSERT OR DELETE OR UPDATE ON public.definitions FOR EACH ROW EXECUTE FUNCTION public.definitions_touch_parent();


--
-- Name: lexicon trg_lexicon_search; Type: TRIGGER; Schema: public; Owner: knowthing
--

CREATE TRIGGER trg_lexicon_search BEFORE INSERT OR UPDATE ON public.lexicon FOR EACH ROW EXECUTE FUNCTION public.lexicon_search_update();


--
-- Name: calendars calendars_content_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_content_record_id_fkey FOREIGN KEY (content_record_id) REFERENCES public.content_records(id) ON DELETE SET NULL;


--
-- Name: calendars calendars_planet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_planet_id_fkey FOREIGN KEY (planet_id) REFERENCES public.planetary_bodies(id) ON DELETE SET NULL;


--
-- Name: content_categories content_categories_content_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_categories
    ADD CONSTRAINT content_categories_content_record_id_fkey FOREIGN KEY (content_record_id) REFERENCES public.content_records(id) ON DELETE CASCADE;


--
-- Name: content_links content_links_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_links
    ADD CONSTRAINT content_links_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.content_records(id) ON DELETE CASCADE;


--
-- Name: content_links content_links_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_links
    ADD CONSTRAINT content_links_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.content_records(id) ON DELETE SET NULL;


--
-- Name: content_media_usage content_media_usage_content_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_media_usage
    ADD CONSTRAINT content_media_usage_content_record_id_fkey FOREIGN KEY (content_record_id) REFERENCES public.content_records(id) ON DELETE CASCADE;


--
-- Name: content_revisions content_revisions_content_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_revisions
    ADD CONSTRAINT content_revisions_content_record_id_fkey FOREIGN KEY (content_record_id) REFERENCES public.content_records(id) ON DELETE CASCADE;


--
-- Name: content_revisions content_revisions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.content_revisions
    ADD CONSTRAINT content_revisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: definitions definitions_dialect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.definitions
    ADD CONSTRAINT definitions_dialect_id_fkey FOREIGN KEY (dialect_id) REFERENCES public.language_dialects(id) ON DELETE SET NULL;


--
-- Name: definitions definitions_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.definitions
    ADD CONSTRAINT definitions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.lexicon(id) ON DELETE CASCADE;


--
-- Name: inflected_forms inflected_forms_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflected_forms
    ADD CONSTRAINT inflected_forms_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.lexicon(id) ON DELETE CASCADE;


--
-- Name: inflection_dimensions inflection_dimensions_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.inflection_dimensions
    ADD CONSTRAINT inflection_dimensions_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.languages(id) ON DELETE CASCADE;


--
-- Name: language_dialects language_dialects_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.language_dialects
    ADD CONSTRAINT language_dialects_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.languages(id) ON DELETE CASCADE;


--
-- Name: languages languages_parent_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_parent_language_id_fkey FOREIGN KEY (parent_language_id) REFERENCES public.languages(id) ON DELETE SET NULL;


--
-- Name: lexicon_inflections lexicon_inflections_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_inflections
    ADD CONSTRAINT lexicon_inflections_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.paradigm_classes(id) ON DELETE SET NULL;


--
-- Name: lexicon_inflections lexicon_inflections_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_inflections
    ADD CONSTRAINT lexicon_inflections_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.lexicon(id) ON DELETE CASCADE;


--
-- Name: lexicon lexicon_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon
    ADD CONSTRAINT lexicon_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.languages(id) ON DELETE CASCADE;


--
-- Name: lexicon_relations lexicon_relations_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_relations
    ADD CONSTRAINT lexicon_relations_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.lexicon(id) ON DELETE CASCADE;


--
-- Name: lexicon_relations lexicon_relations_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_relations
    ADD CONSTRAINT lexicon_relations_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.lexicon(id) ON DELETE CASCADE;


--
-- Name: lexicon_revisions lexicon_revisions_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_revisions
    ADD CONSTRAINT lexicon_revisions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.lexicon(id) ON DELETE CASCADE;


--
-- Name: lexicon_revisions lexicon_revisions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_revisions
    ADD CONSTRAINT lexicon_revisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lexicon_variants lexicon_variants_dialect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_variants
    ADD CONSTRAINT lexicon_variants_dialect_id_fkey FOREIGN KEY (dialect_id) REFERENCES public.language_dialects(id) ON DELETE CASCADE;


--
-- Name: lexicon_variants lexicon_variants_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.lexicon_variants
    ADD CONSTRAINT lexicon_variants_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.lexicon(id) ON DELETE CASCADE;


--
-- Name: media_history media_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media_history
    ADD CONSTRAINT media_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: media media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: paradigm_classes paradigm_classes_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_classes
    ADD CONSTRAINT paradigm_classes_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.languages(id) ON DELETE CASCADE;


--
-- Name: paradigm_rules paradigm_rules_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.paradigm_rules
    ADD CONSTRAINT paradigm_rules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.paradigm_classes(id) ON DELETE CASCADE;


--
-- Name: phonemes phonemes_language_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.phonemes
    ADD CONSTRAINT phonemes_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.languages(id) ON DELETE CASCADE;


--
-- Name: planetary_bodies planetary_bodies_content_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.planetary_bodies
    ADD CONSTRAINT planetary_bodies_content_record_id_fkey FOREIGN KEY (content_record_id) REFERENCES public.content_records(id) ON DELETE SET NULL;


--
-- Name: planetary_bodies planetary_bodies_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.planetary_bodies
    ADD CONSTRAINT planetary_bodies_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.planetary_bodies(id) ON DELETE SET NULL;


--
-- Name: planetary_bodies planetary_bodies_star_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.planetary_bodies
    ADD CONSTRAINT planetary_bodies_star_id_fkey FOREIGN KEY (star_id) REFERENCES public.stars(id) ON DELETE SET NULL;


--
-- Name: registration_codes registration_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.registration_codes
    ADD CONSTRAINT registration_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: registration_codes registration_codes_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.registration_codes
    ADD CONSTRAINT registration_codes_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: star_systems star_systems_content_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.star_systems
    ADD CONSTRAINT star_systems_content_record_id_fkey FOREIGN KEY (content_record_id) REFERENCES public.content_records(id) ON DELETE SET NULL;


--
-- Name: stars stars_content_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.stars
    ADD CONSTRAINT stars_content_record_id_fkey FOREIGN KEY (content_record_id) REFERENCES public.content_records(id) ON DELETE SET NULL;


--
-- Name: stars stars_parent_star_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.stars
    ADD CONSTRAINT stars_parent_star_id_fkey FOREIGN KEY (parent_star_id) REFERENCES public.stars(id) ON DELETE SET NULL;


--
-- Name: stars stars_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: knowthing
--

ALTER TABLE ONLY public.stars
    ADD CONSTRAINT stars_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.star_systems(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 3wd26Tt1snUEQxprxJvC4mP9iRO6dCYfIZCtdSL5Wpm5vsmysnvIykJZIloWh75

