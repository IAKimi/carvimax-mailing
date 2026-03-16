--
-- PostgreSQL database dump
--

\restrict ZkfK1ZTi8nh67pvsnvPwgFD5sGydqipQqChiLshUXJsLZWpchXugCemlRu0HlPo

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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

DROP INDEX IF EXISTS public."IDX_session_expire";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE IF EXISTS ONLY public.templates DROP CONSTRAINT IF EXISTS templates_pkey;
ALTER TABLE IF EXISTS ONLY public.session DROP CONSTRAINT IF EXISTS session_pkey;
ALTER TABLE IF EXISTS ONLY public.contacts DROP CONSTRAINT IF EXISTS contacts_pkey;
ALTER TABLE IF EXISTS ONLY public.contact_databases DROP CONSTRAINT IF EXISTS contact_databases_pkey;
ALTER TABLE IF EXISTS ONLY public.campaigns DROP CONSTRAINT IF EXISTS campaigns_pkey;
ALTER TABLE IF EXISTS ONLY public.campaign_versions DROP CONSTRAINT IF EXISTS campaign_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.campaign_sends DROP CONSTRAINT IF EXISTS campaign_sends_pkey;
ALTER TABLE IF EXISTS ONLY public.brand_identity DROP CONSTRAINT IF EXISTS brand_identity_user_id_unique;
ALTER TABLE IF EXISTS ONLY public.brand_identity DROP CONSTRAINT IF EXISTS brand_identity_pkey;
ALTER TABLE IF EXISTS ONLY public._migrations DROP CONSTRAINT IF EXISTS _migrations_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.templates ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.contacts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.contact_databases ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.campaigns ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.campaign_versions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.campaign_sends ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.brand_identity ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.templates_id_seq;
DROP TABLE IF EXISTS public.templates;
DROP TABLE IF EXISTS public.session;
DROP SEQUENCE IF EXISTS public.contacts_id_seq;
DROP TABLE IF EXISTS public.contacts;
DROP SEQUENCE IF EXISTS public.contact_databases_id_seq;
DROP TABLE IF EXISTS public.contact_databases;
DROP SEQUENCE IF EXISTS public.campaigns_id_seq;
DROP TABLE IF EXISTS public.campaigns;
DROP SEQUENCE IF EXISTS public.campaign_versions_id_seq;
DROP TABLE IF EXISTS public.campaign_versions;
DROP SEQUENCE IF EXISTS public.campaign_sends_id_seq;
DROP TABLE IF EXISTS public.campaign_sends;
DROP SEQUENCE IF EXISTS public.brand_identity_id_seq;
DROP TABLE IF EXISTS public.brand_identity;
DROP TABLE IF EXISTS public._migrations;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations (
    name character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT now()
);


--
-- Name: brand_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_identity (
    id integer NOT NULL,
    user_id integer NOT NULL,
    company_name text,
    industry text,
    website text,
    whatsapp text,
    mission text,
    vision text,
    products text,
    history text,
    style_guide text,
    target_audience text,
    tone text,
    primary_color text,
    secondary_color text,
    accent_color text,
    heading_font text,
    body_font text,
    updated_at timestamp without time zone DEFAULT now(),
    logo_url text,
    visual_style text DEFAULT 'moderno'::text,
    sender_name text,
    sender_email text
);


--
-- Name: brand_identity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brand_identity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brand_identity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brand_identity_id_seq OWNED BY public.brand_identity.id;


--
-- Name: campaign_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_sends (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    contact_email text NOT NULL,
    contact_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    message_id text,
    error_message text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: campaign_sends_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaign_sends_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaign_sends_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaign_sends_id_seq OWNED BY public.campaign_sends.id;


--
-- Name: campaign_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_versions (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    version_number integer NOT NULL,
    content_json jsonb NOT NULL,
    image_url text,
    is_selected boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    type text DEFAULT 'initial'::text NOT NULL
);


--
-- Name: campaign_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaign_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaign_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaign_versions_id_seq OWNED BY public.campaign_versions.id;


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    idea text NOT NULL,
    objective text NOT NULL,
    tone text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    layout_preference text DEFAULT 'Hero_Centered'::text NOT NULL,
    scheduled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    image_prompt text,
    target_database text,
    selected_image_url text,
    template_id integer,
    target_audience text,
    total_expected_sends integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    image_regen_count integer DEFAULT 0,
    text_regen_count integer DEFAULT 0,
    scheduler_retry_count integer DEFAULT 0,
    scheduler_last_error text
);


--
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;


--
-- Name: contact_databases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_databases (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: contact_databases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contact_databases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contact_databases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contact_databases_id_seq OWNED BY public.contact_databases.id;


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    database_id integer NOT NULL,
    email text NOT NULL,
    name text,
    "position" text,
    segment text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contacts_id_seq OWNED BY public.contacts.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    html text NOT NULL,
    favorite boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    is_ai_generated boolean DEFAULT false,
    ai_edit_count integer DEFAULT 0,
    original_html text,
    has_all_placeholders boolean DEFAULT false,
    is_confirmed boolean DEFAULT true,
    parent_template_id integer,
    version_number integer DEFAULT 1
);


--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    company text,
    role text DEFAULT 'user'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: brand_identity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_identity ALTER COLUMN id SET DEFAULT nextval('public.brand_identity_id_seq'::regclass);


--
-- Name: campaign_sends id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_sends ALTER COLUMN id SET DEFAULT nextval('public.campaign_sends_id_seq'::regclass);


--
-- Name: campaign_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_versions ALTER COLUMN id SET DEFAULT nextval('public.campaign_versions_id_seq'::regclass);


--
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- Name: contact_databases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_databases ALTER COLUMN id SET DEFAULT nextval('public.contact_databases_id_seq'::regclass);


--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts ALTER COLUMN id SET DEFAULT nextval('public.contacts_id_seq'::regclass);


--
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._migrations (name, applied_at) FROM stdin;
001_superadmin_role_and_cleanup	2026-03-12 20:48:09.699122
002_sync_all_seed_data	2026-03-12 21:13:54.597877
003_add_scheduler_retry_columns	2026-03-16 15:48:09.73768
\.


--
-- Data for Name: brand_identity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brand_identity (id, user_id, company_name, industry, website, whatsapp, mission, vision, products, history, style_guide, target_audience, tone, primary_color, secondary_color, accent_color, heading_font, body_font, updated_at, logo_url, visual_style, sender_name, sender_email) FROM stdin;
1	2	PostIAlo Mail	Software as a Service (SaaS) / Inteligencia Artificial y Automatización de Marketing.	https://www.postialo.com	+503 7987 0006	Democratizar el acceso al marketing de alta conversión mediante el uso de inteligencia artificial, permitiendo que cualquier emprendedor o empresa comunique su valor de forma profesional, automatizada y efectiva sin necesidad de ser un experto en tecnología.	Convertirnos en la plataforma líder en Latinoamérica para la gestión inteligente de comunicación directa, siendo el estándar de eficiencia donde la creatividad humana y la IA se fusionan para potenciar las ventas de nuestros usuarios.	PostIAlo Mail es un portal SaaS diseñado para la creación, redacción y programación de campañas de email marketing potenciadas por IA. La plataforma permite configurar la identidad de marca una sola vez y generar flujos de correos, newsletters y correos transaccionales en minutos. Incluye herramientas de regeneración de texto con IA, edición asistida y programación inteligente para asegurar que cada mensaje llegue en el momento óptimo con el tono exacto de la marca.	Nacimos de la evolución de PostIAlo (RRSS), al darnos cuenta de que los emprendedores perdían demasiado tiempo redactando correos que nadie abría. Tras el éxito de nuestra herramienta de redes sociales, decidimos aplicar nuestra propia metodología de Prompt Engineering y estructuras de datos al mundo del Mailing. PostIAlo Mail nace como la solución definitiva para cerrar la brecha entre tener una base de datos y generar ventas reales a través de ella.	Guías y Estilos de Contenido: 1.  Directo y accionable: Cada correo debe tener un objetivo claro y un llamado a la acción (CTA) evidente.\n2.  Estructura Escaneable: Uso de frases cortas, viñetas y párrafos de no más de 3 líneas.\n3.  Personalización Inteligente: El contenido debe sentirse como si fuera escrito de uno a uno, evitando el lenguaje corporativo robótico y frío.\n4.  Enfoque en Beneficios: No hablamos de "características", hablamos de cómo le resolvemos la vida al usuario.	Dueños de pequeñas y medianas empresas (PyMEs), emprendedores digitales, consultores y encargados de marketing en edificios corporativos o complejos de oficinas que buscan optimizar su tiempo. Personas que tienen una base de datos de clientes pero no tienen el tiempo ni el conocimiento técnico para redactar campañas de seguimiento o venta de forma constante.	corporativo	#002073	#e3001b	#ffffff	Inter	Plus Jakarta Sans	2026-03-16 17:20:52.131	https://4ba7b3fb-6a89-42bb-8e6f-ffc246b9132e-00-1rw714l8m78p8.spock.replit.dev/uploads/logos/2_63c21c8429143ca1.png	moderno	PostIAlo Mailing	amachuca@postialo.com
2	18	TestCompany QA	Tecnología									profesional	#002073	#e3001b	#F59E0B	Inter	Inter	2026-03-16 18:09:22.556413		moderno	TestCompany Marketing	marketing@testcompany.example
\.


--
-- Data for Name: campaign_sends; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.campaign_sends (id, campaign_id, contact_email, contact_name, status, message_id, error_message, created_at, updated_at) FROM stdin;
1	23	eortiz@postialo.com	Eduardo Ortiz	pending	\N	\N	2026-03-12 14:12:38.692785	2026-03-12 14:12:38.692785
2	23	mchavez@postialo.com	Mauricio Chavez	pending	\N	\N	2026-03-12 14:12:38.692785	2026-03-12 14:12:38.692785
3	23	jcornejo@postialo.com	Javier Cornejo	pending	\N	\N	2026-03-12 14:12:38.692785	2026-03-12 14:12:38.692785
4	23	gromro@postialo.com	Gerardo Romro	pending	\N	\N	2026-03-12 14:12:38.692785	2026-03-12 14:12:38.692785
5	23	amachuca@postialo.com	Angel Machuca	pending	\N	\N	2026-03-12 14:12:38.692785	2026-03-12 14:12:38.692785
6	25	eortiz@postialo.com	Eduardo Ortiz	sent	<202603121627.89923032348@smtp-relay.mailin.fr>	\N	2026-03-12 16:27:37.363011	2026-03-12 16:27:38.643
7	25	mchavez@postialo.com	Mauricio Chavez	sent	<202603121627.72308808182@smtp-relay.mailin.fr>	\N	2026-03-12 16:27:37.363011	2026-03-12 16:27:38.949
8	25	jcornejo@postialo.com	Javier Cornejo	sent	<202603121627.38628332254@smtp-relay.mailin.fr>	\N	2026-03-12 16:27:37.363011	2026-03-12 16:27:39.247
9	25	amachuca@postialo.com	Angel Machuca	sent	<202603121627.96527386522@smtp-relay.mailin.fr>	\N	2026-03-12 16:27:37.363011	2026-03-12 16:27:39.574
10	25	gromro@postialo.com	Gerardo Romero	sent	<202603121627.91006092032@smtp-relay.mailin.fr>	\N	2026-03-12 16:27:37.363011	2026-03-12 16:27:39.868
11	27	eortiz@postialo.com	Eduardo Ortiz	sent	<202603121704.69546735945@smtp-relay.mailin.fr>	\N	2026-03-12 17:04:07.00086	2026-03-12 17:04:08.221
12	27	amachuca@postialo.com	Angel Machuca	sent	<202603121704.30180667415@smtp-relay.mailin.fr>	\N	2026-03-12 17:04:07.00086	2026-03-12 17:04:09.205
13	27	mchavez@postialo.com	Mauricio Chavez	sent	<202603121704.22357077195@smtp-relay.mailin.fr>	\N	2026-03-12 17:04:07.00086	2026-03-12 17:04:09.631
14	27	gromro@postialo.com	Gerardo Romro	sent	<202603121704.91674864341@smtp-relay.mailin.fr>	\N	2026-03-12 17:04:07.00086	2026-03-12 17:04:10.624
15	27	jcornejo@postialo.com	Javier Cornejo	sent	<202603121704.22693798658@smtp-relay.mailin.fr>	\N	2026-03-12 17:04:07.00086	2026-03-12 17:04:11.406
16	28	jjimenez@red.com.sv	Juan Carlos Jímenez	sent	<202603121804.95066873840@smtp-relay.mailin.fr>	\N	2026-03-12 18:04:07.495005	2026-03-12 18:04:08.518
17	29	eortiz@postialo.com	Eduardo Ortiz	sent	<202603132302.47243281377@smtp-relay.mailin.fr>	\N	2026-03-13 23:02:23.872698	2026-03-13 23:02:25.005
18	29	amachuca@postialo.com	Angel Machuca	sent	<202603132302.15220449000@smtp-relay.mailin.fr>	\N	2026-03-13 23:02:23.872698	2026-03-13 23:02:25.316
19	29	mchavez@postialo.com	Mauricio Chavez	sent	<202603132302.59018168204@smtp-relay.mailin.fr>	\N	2026-03-13 23:02:23.872698	2026-03-13 23:02:25.619
20	29	gromro@postialo.com	Gerardo Romero	sent	<202603132302.71312734762@smtp-relay.mailin.fr>	\N	2026-03-13 23:02:23.872698	2026-03-13 23:02:26.012
21	29	jcornejo@postialo.com	Javier Cornejo	sent	<202603132302.77643364067@smtp-relay.mailin.fr>	\N	2026-03-13 23:02:23.872698	2026-03-13 23:02:26.308
\.


--
-- Data for Name: campaign_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.campaign_versions (id, campaign_id, version_number, content_json, image_url, is_selected, created_at, type) FROM stdin;
46	28	1	{"asunto": "Impulsa tu negocio con emails que venden solos", "cta_url": "portal.postialo.com", "cta_text": "Prueba PostIAlo Mail hoy", "preheader": "La IA que crea campañas irresistibles sin equipo ni complicaciones", "cuerpo_html": "<p><strong>PostIAlo Mail</strong> es tu aliado para <em>crear campañas de correo que conectan y venden</em>, sin necesidad de equipo de marketing.<br>Genera textos personalizados y <strong>imágenes impactantes</strong> que reflejan tu marca en minutos.<br></p><ul><li><p>Ahorra tiempo y esfuerzo</p></li><li><p>Llega a tus clientes con mensajes efectivos</p></li><li><p>Esto es una prueba</p></li></ul><p><strong>La inteligencia artificial que tu negocio necesita para crecer.</strong></p>"}	campaign_27_0e6476f2c836d91214888020.png	t	2026-03-12 18:03:12.834059	initial
47	29	1	{"asunto": "¡Tu primer carro está más cerca de lo que imaginas!", "cta_url": "www.carvimax.com", "cta_text": "Solicita tu financiamiento", "preheader": "Financiamiento fácil y confiable para jóvenes como tú, sin complicaciones.", "cuerpo_html": "<p><strong>¿Listo para estrenar tu primer carro?</strong> En PostIAlo Mail te ofrecemos <em>financiamiento accesible y confiable</em> pensado para jóvenes que quieren dar ese gran paso.<br>Olvida los trámites complicados y la incertidumbre. <strong>Con nosotros, tu sueño está al alcance.</strong></p><ul><li>Proceso rápido y transparente</li><li>Condiciones hechas para ti</li><li>Apoyo y confianza en cada paso</li></ul><p><strong>¡No esperes más!</strong> Empieza hoy mismo y maneja hacia tu futuro.</p>"}	campaign_29_ddde23508b1a90471c738e28.png	f	2026-03-13 22:57:14.806032	initial
48	29	2	{}	campaign_29_09f3472104bd384061b3db9b.png	t	2026-03-13 22:59:07.987061	image
44	27	1	{"asunto": "Impulsa tu negocio con emails que venden solos", "cta_text": "Prueba PostIAlo Mail hoy", "preheader": "La IA que crea campañas irresistibles sin equipo ni complicaciones", "cuerpo_html": "<p><strong>PostIAlo Mail</strong> es tu aliado para <em>crear campañas de correo que conectan y venden</em>, sin necesidad de equipo de marketing.<br>Genera textos personalizados y <strong>imágenes impactantes</strong> que reflejan tu marca en minutos.<br><ul><li>Ahorra tiempo y esfuerzo</li><li>Llega a tus clientes con mensajes efectivos</li><li>Convierte tu base de datos en ventas reales</li></ul><p><strong>La inteligencia artificial que tu negocio necesita para crecer.</strong></p>"}	campaign_27_0e6476f2c836d91214888020.png	t	2026-03-12 16:49:45.393279	initial
45	27	2	{}	campaign_27_f03d28fd9d188f99c8f457ee.png	f	2026-03-12 16:53:10.916219	image
\.


--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.campaigns (id, user_id, name, idea, objective, tone, status, layout_preference, scheduled_at, created_at, image_prompt, target_database, selected_image_url, template_id, target_audience, total_expected_sends, sent_count, failed_count, image_regen_count, text_regen_count, scheduler_retry_count, scheduler_last_error) FROM stdin;
28	2	Impulsa tu negocio con emails que venden solos (reenvío)	Posicionar a mi plataforma de PostIAlo Mailing como la mejor solución de marketing dirigido con correo electrónico en el mercado. Estamos sobre todas las herramientas porque nosotros integramos inteligencia artificial de manera optimizada para crear imágenes de alto valor y textos personalizados según la marca	Nuestro objetivo es mostrar los beneficios de la herramienta	profesional	sent	Hero_Centered	2026-03-16 15:05:00	2026-03-12 18:03:12.821852	Un emprendedor feliz que tiene un desorden en su escritorio con:\n- muchos papeles de facturación\n- bocetos escritos a mano con lápiz\n- una pizarra que tiene su proyección de ventas\nuna oficina de un emprendedor desordenada pero feliz\n\nEl emprendedor debe tener una computadora que tenga un widget que diga "Mail sent" y que aparezca un cheque en verde, como que ya envió el correo. También debe tener una camiseta color azul con tipografía blanca que lea "PostIAlo Mailing es la mejor opción" 	17	campaign_27_0e6476f2c836d91214888020.png	52	Esto va enfocado para emprendedores y microemprendedores. Quiero hacer una campaña para personas que no tienen el personal suficiente para poder armar un equipo de mercadeo, pero que tienen esta herramienta como alternativa para poder crear campañas de correo	1	1	0	0	0	0	\N
27	2	Posicionar a mi plataforma de PostIAlo Mailing como la mejor solución de marketing dirigido con correo electrónico en el mercado. Estamos sobre todas las herramientas porque nosotros integramos inteli	Posicionar a mi plataforma de PostIAlo Mailing como la mejor solución de marketing dirigido con correo electrónico en el mercado. Estamos sobre todas las herramientas porque nosotros integramos inteligencia artificial de manera optimizada para crear imágenes de alto valor y textos personalizados según la marca	Nuestro objetivo es mostrar los beneficios de la herramienta	profesional	sent	Hero_Centered	2026-03-12 17:00:00	2026-03-12 16:49:31.298056	Un emprendedor feliz que tiene un desorden en su escritorio con:\n- muchos papeles de facturación\n- bocetos escritos a mano con lápiz\n- una pizarra que tiene su proyección de ventas\nuna oficina de un emprendedor desordenada pero feliz\n\nEl emprendedor debe tener una computadora que tenga un widget que diga "Mail sent" y que aparezca un cheque en verde, como que ya envió el correo. También debe tener una camiseta color azul con tipografía blanca que lea "PostIAlo Mailing es la mejor opción" 	16	campaign_27_0e6476f2c836d91214888020.png	52	Esto va enfocado para emprendedores y microemprendedores. Quiero hacer una campaña para personas que no tienen el personal suficiente para poder armar un equipo de mercadeo, pero que tienen esta herramienta como alternativa para poder crear campañas de correo	5	5	0	1	0	0	\N
29	2	Quiero posicionar el mensaje de que estoy ofreciendo financiamiento para todas las personas que quieren comprar su primer carro. Me quiero posicionar como una empresa confiable que pone este financiam	Quiero posicionar el mensaje de que estoy ofreciendo financiamiento para todas las personas que quieren comprar su primer carro. Me quiero posicionar como una empresa confiable que pone este financiamiento al alcance de todos	atraer a potenciales clientes	profesional	sent	Hero_Centered	2026-03-14 16:05:00	2026-03-13 22:56:58.951368	Quiero a una persona sonriendo frente a una car dealership, sosteniendo las llaves de su primer vehículo. A la par de esta persona sonriente, que tiene que ser un joven de aproximadamente 25 años, está un agente que está dándole la mano sonriente también y felicitándolo por su compra. La car dealership debe tener el título "Carvimax" en la entrada de la tienda. Debe ser visible.	18	campaign_29_09f3472104bd384061b3db9b.png	52	Personas que quieren comprar su primer carro tienen que ser jóvenes	5	5	0	1	0	0	\N
\.


--
-- Data for Name: contact_databases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contact_databases (id, user_id, name, created_at) FROM stdin;
17	2	Base Gerencia	2026-03-12 16:50:52.634847
18	2	IAKimi	2026-03-13 22:51:10.808251
19	18	QA Test DB	2026-03-16 18:10:46.77527
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contacts (id, user_id, database_id, email, name, "position", segment, created_at) FROM stdin;
39	2	17	jjimenez@red.com.sv	Juan Carlos Jímenez	CEO	Radiocomunicaciones	2026-03-12 16:51:12.831446
40	2	18	eortiz@postialo.com	Eduardo Ortiz	Lider de Proyectos	\N	2026-03-13 22:51:14.574786
41	2	18	amachuca@postialo.com	Angel Machuca	Marketing y Productos	\N	2026-03-13 22:51:14.574786
42	2	18	mchavez@postialo.com	Mauricio Chavez	Software y Bots	\N	2026-03-13 22:51:14.574786
43	2	18	gromro@postialo.com	Gerardo Romero	Software y Bots	\N	2026-03-13 22:51:14.574786
44	2	18	jcornejo@postialo.com	Javier Cornejo	RRHH y Productos	\N	2026-03-13 22:51:14.574786
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
c2PMc1eBe8ta74UZpwOYLh1KwnSEbp6F	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T15:55:18.655Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-11 15:55:19
nuMAFGN4uWB9cDqnY7fJ0LBJOpE9rKIh	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T20:03:09.127Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":14}	2026-04-11 20:03:10
B2uChvKqoPArHUkPrRsNe4It2_lL2XBb	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T16:05:38.946Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-11 16:05:58
aR7D5y_qdGr5ukqRIOXvriz_JjD9tsU9	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T20:07:31.048Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":14}	2026-04-11 20:07:32
T_YqTRJf-S3E0Hp9-HOL090YxYek1a_G	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T20:07:31.208Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":14}	2026-04-11 20:07:32
VABa1aAXRSj2TKgsDMhvmU67Hc1NFa_5	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T17:04:37.130Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-11 17:07:21
U01oL9tX3iMYN1sez3IIU9eJn6BPQJYG	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T16:37:10.744Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-11 16:37:18
1IW2prrMxnaHg4y9KepCHKfyMFWTU-dY	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T17:10:07.660Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-11 17:10:47
FnXNVVrCwwBDIxllNxu8h9N9piC98ysl	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-12T22:46:59.689Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-15 18:19:16
KFNIrOXZ3ZXNS0rJhYVUQVSNStkRo_jk	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-15T15:52:27.289Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":15}	2026-04-15 15:52:28
EW0eiapqdDkJOfjsUJMrEz4SVYgaFe9K	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-15T18:08:43.832Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":18}	2026-04-15 18:11:32
oom2z7_RGOm57ZsIYQFgp9OIYOpbr1Ft	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-15T18:03:49.313Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":17}	2026-04-15 18:03:50
jesTrhMp0ZCuLvrx8a-G1vdUVCacqvtQ	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T16:14:24.505Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-11 16:14:45
Z1Y9r4XhAuMj6caG-50AhBJaYXe0x71B	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T20:05:08.560Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":14}	2026-04-11 20:05:09
wF9kofWvx49UaCZ4LRi2ZEaupB37EWdI	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-15T15:52:54.709Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":15}	2026-04-15 15:53:03
FwiXGIdA3fMermfsaijrjdcdoG2K4MPG	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T15:56:21.831Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}	2026-04-11 15:57:38
vWFbtiSQ-Qmed9ChCcK1omaJvQraQZM2	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-11T20:20:03.242Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":14}	2026-04-11 20:20:10
Z7grW_qQrnwoHSAjF6MvtaDOFOq33Vx7	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-15T16:38:58.642Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":16}	2026-04-15 16:39:27
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.templates (id, user_id, name, html, favorite, created_at, is_ai_generated, ai_edit_count, original_html, has_all_placeholders, is_confirmed, parent_template_id, version_number) FROM stdin;
52	2	Plantilla PostIAlo Mailing	<!DOCTYPE html><html lang="es"><head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>{{ASUNTO}}</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:'Poppins', 'Helvetica Neue', Arial, sans-serif;">\n<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>\n<table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6fb" style="padding:20px 0;">\n  <tbody><tr>\n    <td align="center">\n      <table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">\n        <!-- Header sin logo, asunto centrado -->\n        <tbody><tr>\n          <td bgcolor="#002073" style="padding:20px 20px 20px 20px;">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tbody><tr>\n                <td align="center" style="font-family:'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif; font-size:28px; line-height:36px; font-weight:700; color:#ffffff;">\n                  {{ASUNTO}}\n                </td>\n              </tr>\n            </tbody></table>\n          </td>\n        </tr>\n        <!-- Imagen hero/banner -->\n        <tr>\n          <td style="padding:20px; background:#ffffff;">\n            <img src="{{IMAGEN_URL}}" alt="Imagen del correo" width="600" style="display:block;border:0;width:100%;max-width:600px; border-radius:16px;">\n          </td>\n        </tr>\n        <!-- Contenido principal -->\n        <tr>\n          <td style="padding:20px 30px 20px 30px; font-family:'Poppins', 'Helvetica Neue', Arial, sans-serif; font-size:16px; line-height:24px; color:#333333; background:#ffffff;">\n            {{CONTENIDO}}\n          </td>\n        </tr>\n        <!-- Botón CTA -->\n        <tr>\n          <td align="center" style="padding:0 30px 30px 30px; background:#ffffff;">\n            <!--[if mso]>\n            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{CTA_URL}}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="#e3001b" fillcolor="#e3001b">\n              <w:anchorlock/>\n              <center style="color:#ffffff;font-family:'Plus Jakarta Sans', Arial, sans-serif;font-size:16px;font-weight:bold;">{{CTA_TEXTO}}</center>\n            </v:roundrect>\n            <![endif]-->\n            <a href="{{CTA_URL}}" target="_blank" style="background-color:#e3001b; border-radius:12px; color:#ffffff; display:inline-block; font-family:'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif; font-size:16px; font-weight:700; line-height:48px; text-align:center; text-decoration:none; width:240px; -webkit-text-size-adjust:none; mso-hide:all;">\n              {{CTA_TEXTO}}\n            </a>\n          </td>\n        </tr>\n        <!-- Footer -->\n        <tr>\n          <td style="padding:20px 30px; font-family:'Poppins', 'Helvetica Neue', Arial, sans-serif; font-size:12px; line-height:18px; color:#555555; background:#f9f9f9; border-top:1px solid #dddddd; text-align:center; border-radius: 0 0 16px 16px;">\n            <div>Contacto: WhatsApp +503 7987 0006 | <a href="https://www.postialo.com" target="_blank" style="color:#002073; text-decoration:none;">www.postialo.com</a></div>\n            <div style="padding-top:8px;">\n              <a href="{{UNSUBSCRIBE_LINK}}" target="_blank" style="color:#777777; text-decoration:underline;"></a>\n            </div>\n          </td>\n        </tr>\n      </tbody></table>\n    </td>\n  </tr>\n</tbody></table>\n\n</body></html>	f	2026-03-12 14:00:45.197824	t	1	<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>{{ASUNTO}}</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:'Poppins', 'Helvetica Neue', Arial, sans-serif;">\n<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>\n<table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6fb" style="padding:20px 0;">\n  <tr>\n    <td align="center">\n      <table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">\n        <!-- Header con logo y titular con fondo azul -->\n        <tr>\n          <td bgcolor="#002073" style="padding:20px 20px 10px 20px;">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="left" valign="middle" style="padding-bottom:10px;">\n                  <img src="https://4ba7b3fb-6a89-42bb-8e6f-ffc246b9132e-00-1rw714l8m78p8.spock.replit.dev/uploads/logos/2_04940ef72324be40.jpg" alt="PostIAlo Mail" width="120" style="display:block;border:0;" />\n                </td>\n              </tr>\n              <tr>\n                <td align="left" style="font-family:'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif; font-size:28px; line-height:36px; font-weight:700; color:#ffffff; padding-top:10px;">\n                  {{ASUNTO}}\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n        <!-- Imagen hero/banner -->\n        <tr>\n          <td style="padding:20px; background:#ffffff;">\n            <img src="{{IMAGEN_URL}}" alt="Imagen del correo" width="600" style="display:block;border:0;width:100%;max-width:600px; border-radius:16px;" />\n          </td>\n        </tr>\n        <!-- Contenido principal -->\n        <tr>\n          <td style="padding:20px 30px 20px 30px; font-family:'Poppins', 'Helvetica Neue', Arial, sans-serif; font-size:16px; line-height:24px; color:#333333; background:#ffffff;">\n            {{CONTENIDO}}\n          </td>\n        </tr>\n        <!-- Botón CTA -->\n        <tr>\n          <td align="center" style="padding:0 30px 30px 30px; background:#ffffff;">\n            <!--[if mso]>\n            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{CTA_URL}}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="#e3001b" fillcolor="#e3001b">\n              <w:anchorlock/>\n              <center style="color:#ffffff;font-family:'Plus Jakarta Sans', Arial, sans-serif;font-size:16px;font-weight:bold;">{{CTA_TEXTO}}</center>\n            </v:roundrect>\n            <![endif]-->\n            <a href="{{CTA_URL}}" target="_blank" style="background: linear-gradient(90deg, #e3001b 0%, #a10012 100%); border-radius:12px; color:#ffffff; display:inline-block; font-family:'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif; font-size:16px; font-weight:700; line-height:48px; text-align:center; text-decoration:none; width:240px; -webkit-text-size-adjust:none; mso-hide:all; box-shadow:0 4px 12px rgba(227,0,27,0.5);">\n              {{CTA_TEXTO}}\n            </a>\n          </td>\n        </tr>\n        <!-- Footer -->\n        <tr>\n          <td style="padding:20px 30px; font-family:'Poppins', 'Helvetica Neue', Arial, sans-serif; font-size:12px; line-height:18px; color:#555555; background:#f9f9f9; border-top:1px solid #dddddd; text-align:center; border-radius: 0 0 16px 16px;">\n            <div>Contacto: WhatsApp +503 7987 0006 | <a href="https://www.postialo.com" target="_blank" style="color:#002073; text-decoration:none;">www.postialo.com</a></div>\n            <div style="padding-top:8px;">\n              <a href="{{UNSUBSCRIBE_LINK}}" target="_blank" style="color:#777777; text-decoration:underline;">Cancelar suscripción</a>\n            </div>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	t	t	52	1
56	18	Plantilla prueba moderna con logo, imagen centrada y botón rojo	<!DOCTYPE html><html lang="es"><head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>{{ASUNTO}}</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Inter, sans-serif;">\n<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>\n<table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6fb" style="padding:20px 0;">\n  <tr>\n    <td align="center">\n      <table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">\n        <!-- BLOQUE 1: Header/Banner con logo y asunto -->\n        <tr>\n          <td bgcolor="#002073" style="padding:20px;">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="vertical-align:middle;">\n              <tr>\n                <td align="left" valign="middle" style="padding-right:10px;">\n                  <!-- Logo placeholder: espacio reservado para logo -->\n                  <img src="" alt="Logo" width="100" height="auto" style="display:block;border:0;max-height:40px;" />\n                </td>\n                <td align="center" valign="middle" style="font-family:Inter, sans-serif; font-size:28px; line-height:36px; font-weight:700; color:#ffffff;">\n                  {{ASUNTO}}\n                </td>\n                <td style="width:100px;"></td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n        <!-- BLOQUE 2: Imagen hero -->\n        <tr>\n          <td style="padding:20px; background:#ffffff; text-align:center;">\n            <img src="{{IMAGEN_URL}}" alt="Imagen del correo" width="560" style="display:inline-block;border:0;max-width:560px;border-radius:16px;" />\n          </td>\n        </tr>\n        <!-- BLOQUE 3: Contenido principal -->\n        <tr>\n          <td style="padding:20px 30px; font-family:Inter, sans-serif; font-size:16px; line-height:24px; color:#333333; background:#ffffff;">\n            {{CONTENIDO}}\n          </td>\n        </tr>\n        <!-- BLOQUE 4: Botón CTA -->\n        <tr>\n          <td align="center" style="padding:0 30px 30px 30px; background:#ffffff;">\n            <!--[if mso]>\n            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{CTA_URL}}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="#e3001b" fillcolor="#e3001b">\n              <w:anchorlock/>\n              <center style="color:#ffffff;font-family:Inter;font-size:16px;font-weight:bold;">{{CTA_TEXTO}}</center>\n            </v:roundrect>\n            <![endif]-->\n            <a href="{{CTA_URL}}" target="_blank" style="background-color:#e3001b; border-radius:12px; color:#ffffff; display:inline-block; font-family:Inter, sans-serif; font-size:16px; font-weight:700; line-height:48px; text-align:center; text-decoration:none; width:240px; -webkit-text-size-adjust:none; mso-hide:all;">\n              {{CTA_TEXTO}}\n            </a>\n          </td>\n        </tr>\n        <!-- BLOQUE 5: Footer -->\n        <tr>\n          <td style="padding:20px 30px; font-family:Inter, sans-serif; font-size:12px; line-height:18px; color:#555555; background:#f9f9f9; border-top:1px solid #dddddd; text-align:center; border-radius:0 0 16px 16px;">\n            <div style="padding-top:8px;">\n              <a href="{{UNSUBSCRIBE_LINK}}" target="_blank" style="color:#777777; text-decoration:underline;">Cancelar suscripción</a>\n            </div>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n</body></html>	f	2026-03-16 18:10:27.188107	t	0	<!DOCTYPE html><html lang="es"><head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>{{ASUNTO}}</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Inter, sans-serif;">\n<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>\n<table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6fb" style="padding:20px 0;">\n  <tr>\n    <td align="center">\n      <table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">\n        <!-- BLOQUE 1: Header/Banner con logo y asunto -->\n        <tr>\n          <td bgcolor="#002073" style="padding:20px;">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="vertical-align:middle;">\n              <tr>\n                <td align="left" valign="middle" style="padding-right:10px;">\n                  <!-- Logo placeholder: espacio reservado para logo -->\n                  <img src="" alt="Logo" width="100" height="auto" style="display:block;border:0;max-height:40px;" />\n                </td>\n                <td align="center" valign="middle" style="font-family:Inter, sans-serif; font-size:28px; line-height:36px; font-weight:700; color:#ffffff;">\n                  {{ASUNTO}}\n                </td>\n                <td style="width:100px;"></td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n        <!-- BLOQUE 2: Imagen hero -->\n        <tr>\n          <td style="padding:20px; background:#ffffff; text-align:center;">\n            <img src="{{IMAGEN_URL}}" alt="Imagen del correo" width="560" style="display:inline-block;border:0;max-width:560px;border-radius:16px;" />\n          </td>\n        </tr>\n        <!-- BLOQUE 3: Contenido principal -->\n        <tr>\n          <td style="padding:20px 30px; font-family:Inter, sans-serif; font-size:16px; line-height:24px; color:#333333; background:#ffffff;">\n            {{CONTENIDO}}\n          </td>\n        </tr>\n        <!-- BLOQUE 4: Botón CTA -->\n        <tr>\n          <td align="center" style="padding:0 30px 30px 30px; background:#ffffff;">\n            <!--[if mso]>\n            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{CTA_URL}}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="#e3001b" fillcolor="#e3001b">\n              <w:anchorlock/>\n              <center style="color:#ffffff;font-family:Inter;font-size:16px;font-weight:bold;">{{CTA_TEXTO}}</center>\n            </v:roundrect>\n            <![endif]-->\n            <a href="{{CTA_URL}}" target="_blank" style="background-color:#e3001b; border-radius:12px; color:#ffffff; display:inline-block; font-family:Inter, sans-serif; font-size:16px; font-weight:700; line-height:48px; text-align:center; text-decoration:none; width:240px; -webkit-text-size-adjust:none; mso-hide:all;">\n              {{CTA_TEXTO}}\n            </a>\n          </td>\n        </tr>\n        <!-- BLOQUE 5: Footer -->\n        <tr>\n          <td style="padding:20px 30px; font-family:Inter, sans-serif; font-size:12px; line-height:18px; color:#555555; background:#f9f9f9; border-top:1px solid #dddddd; text-align:center; border-radius:0 0 16px 16px;">\n            <div style="padding-top:8px;">\n              <a href="{{UNSUBSCRIBE_LINK}}" target="_blank" style="color:#777777; text-decoration:underline;">Cancelar suscripción</a>\n            </div>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n</body></html>	t	f	56	1
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password, company, role, created_at, is_active) FROM stdin;
12	Angel Machuca	angelmachucav@hotmail.com	$2b$10$t.1xVNidHQPFCFH6coQ4GetmBC7db.rTxBob60J2vn68xOeYRbPcq	AMACHUCA	user	2026-03-10 21:17:00.035037	t
2	PostIAloMailing DEV	demo@postialo.com	$2b$10$P9tHCl0F/J2SfgI.mkL5QOjIPnHBXyYUXpAtoROr7hGtr/guDAzg.	Mailing Demo Account	admin	2026-03-10 20:49:17.449793	t
14	Admin PostIAlo	admin@postialo.com	$2b$10$mWLXrDTvMtnNcTxctjL9SOY9iJWXVVg8lH05930WFdFAuow45CpcC	PostIAlo Mailing	superadmin	2026-03-12 20:00:46.557417	t
15	Test User	test@test.com	$2b$10$veFWIHokxb7PUv5hpKURnuLbAllnY5jzjjdQB5PahPvELsdEEVmse	Test Co	user	2026-03-16 15:52:27.141167	t
16	Tester Automático	test+1773679133269@example.com	$2b$10$zrCbdxOCHWKyzkBtqXnJ4ebg4/UqDiUcC.qd3WHZqbuITqCs/n3ZO	PostIAlo QA	user	2026-03-16 16:38:58.600436	t
17	Tester Automatizado	test+hRYzDS@example.com	$2b$10$EUQaeDj/agsVz04QUZGX3eDrff75fF5tXzNNCGQdpQcp5WCHQ9ww2	QA Inc	user	2026-03-16 18:03:49.309465	t
18	QA Test	qa_test_1773684518600@example.com	$2b$10$DdWzhzWDMDJiefINsvh35eOSW8/m5JCv1RKwDI9M.tYYkuiv3/T6e	TestCompany	user	2026-03-16 18:08:43.828422	t
\.


--
-- Name: brand_identity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brand_identity_id_seq', 2, true);


--
-- Name: campaign_sends_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.campaign_sends_id_seq', 21, true);


--
-- Name: campaign_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.campaign_versions_id_seq', 48, true);


--
-- Name: campaigns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.campaigns_id_seq', 29, true);


--
-- Name: contact_databases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contact_databases_id_seq', 19, true);


--
-- Name: contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contacts_id_seq', 45, true);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.templates_id_seq', 56, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 18, true);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (name);


--
-- Name: brand_identity brand_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_identity
    ADD CONSTRAINT brand_identity_pkey PRIMARY KEY (id);


--
-- Name: brand_identity brand_identity_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_identity
    ADD CONSTRAINT brand_identity_user_id_unique UNIQUE (user_id);


--
-- Name: campaign_sends campaign_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_sends
    ADD CONSTRAINT campaign_sends_pkey PRIMARY KEY (id);


--
-- Name: campaign_versions campaign_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_versions
    ADD CONSTRAINT campaign_versions_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: contact_databases contact_databases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_databases
    ADD CONSTRAINT contact_databases_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- PostgreSQL database dump complete
--

\unrestrict ZkfK1ZTi8nh67pvsnvPwgFD5sGydqipQqChiLshUXJsLZWpchXugCemlRu0HlPo

