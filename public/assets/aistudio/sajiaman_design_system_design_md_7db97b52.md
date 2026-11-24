# SajiAman — Mobile Design System & Anti-Slop Aesthetic Specification (`DESIGN.md`)

> **Purpose:** This document is the single source of truth for designing the **SajiAman** mobile application in **Google Stitch** and implementing it in **React Native (Expo + NativeWind)**. Every visual decision below is engineered to prevent generic "AI slop" UI and establish an unmistakable, authoritative, field-tested public-health product identity for Indonesia's *Program Makan Bergizi Gratis (MBG)*.

---

## 1. Why AI UI Looks Like "Slop" — And Our Cure

AI UI generators default to monotonous, lifeless layouts when given vague prompts. They repeat identical white rounded cards with blurry gray drop shadows, slap glowing blue-purple gradients onto headers, scatter meaningless pastel badges everywhere, and flatten all visual hierarchy.

**SajiAman's Design Cure — "Swiss-Utilitarian Civic Instrument":**
Imagine the clarity of **Japanese municipal transit signage**, the disciplined industrial precision of **Braun / Teenage Engineering field hardware**, and the crisp structural hairlines of **Linear**—adapted into a warm, trustworthy **Indonesian Public Health (MBG)** mobile instrument built for steamy 4:00 AM kitchens and bright sunlit school courtyards.

### Core Aesthetic Pillars
1. **Structural Hairlines Over Blurry Shadows:** Depth is created through crisp `1px` borders (`#D8E2EE`), intentional surface contrast (`#F4F7FB` canvas vs. `#FFFFFF` cards vs. `#0B2E59` authority blocks), and generous breathing room—never muddy drop shadows.
2. **Typographic Drama & Instrument Telemetry:** Operational numbers (countdown timers, locked cook timestamps, ompreng counts, waste kilograms) are treated as *hero instruments* using bold monospaced/tabular numerals (`32px–52px`), paired with razor-sharp uppercase micro-labels (`10px–11px`, wide tracking).
3. **Physical Metaphors Over Generic SaaS Cards:** Instead of repeating identical card lists on every screen, each workflow uses a distinct structural archetype:
   - *Production Input* = Tactile Kitchen Control Panel (segmented mode switch, chunky nutrition chips, pinned live weakest-link bar).
   - *Batch QR Output* = Physical Thermal Shipping Seal / Ticket (perforated dashed divider, high-contrast scannable specimen block, immutable stamp).
   - *Safety Verification* = Authoritative Traffic-Light Verdict Instrument (full-bleed color-blocked status header with unmistakable lock/go geometry).
   - *Container & Waste Ledgers* = High-Signal Operational Dispatch Boards (clear pipeline progress rails, zero decorative clutter).
4. **Strict Semantic Color Discipline:** The app wears **MBG Institutional Blue** everywhere by default. **Green, Amber, and Red are legally reserved** for food safety status and urgent operational states. Because the base UI is restrained and blue-neutral, a Green/Yellow/Red safety banner hits with instant peripheral clarity.

---

## 2. Explicit Anti-Slop Rules (STRICTLY FORBIDDEN)

When generating or refining any SajiAman screen in Google Stitch, **NEVER** include:
- ❌ Generic SaaS blue-to-purple or cyan neon gradients, glassmorphism, or glowing blobs.
- ❌ Heavy blurred drop shadows (`shadow-xl`) on every stacked card.
- ❌ Repetitive identical full-width white cards stacked endlessly down the screen.
- ❌ Decorative 3D cartoons, stock food illustrations, floating sparkles, or AI "magic wand" icons.
- ❌ Generic "Good morning, Chef! 👋" greeting fluff that wastes valuable mobile viewport space.
- ❌ Fake decorative line charts or meaningless donut graphs with random percentages.
- ❌ Cluttered 5-tab bottom navigation bars (maximum 3–4 focused tabs per actor role).
- ❌ Tiny low-contrast countdown timers or cramped touch targets under `48dp`.
- ❌ Gallery/photo-library upload buttons inside the AI sample camera (strict anti-tampering rule).

---

## 3. Color System & Semantic Governance (MBG Blue Tone)

### 3.1 Institutional Brand & Neutral Surfaces
| Token | Hex | Usage & Governance |
| :--- | :--- | :--- |
| `mbg-navy` | `#0B2E59` | High-authority headers, sealed ticket headers, primary dark surfaces, strong focal contrast. |
| `mbg-blue` | `#0F4C81` | Primary brand identity, primary CTA fills, active navigation indicators, institutional accents. |
| `mbg-action` | `#1D63B8` | Interactive text buttons, focused borders, active toggle indicators, progress fills. |
| `mbg-tint` | `#EBF3FC` | Soft institutional surface highlight for selected chips, summary strips, and active metric tiles. |
| `canvas-bg` | `#F4F7FB` | Cool porcelain-slate main screen background (reduces glare under bright kitchen/outdoor light). |
| `surface-pure` | `#FFFFFF` | Primary interactive blocks, ticket bodies, input controls, QR print surface. |
| `border-hairline` | `#D8E2EE` | Primary `1px` crisp structural divider and card outline. |
| `border-strong` | `#B6C7DC` | Focused inputs, dashed ticket perforations, tactile stepper outlines. |
| `ink-primary` | `#0F172A` | Primary headings, body copy, high-contrast operational labels. |
| `ink-secondary` | `#475569` | Metadata labels, timestamps, secondary instructions. |
| `ink-muted` | `#64748B` | Disabled labels, subtle captions, placeholder text. |

### 3.2 Food Safety & Operational Semantic Tokens (Strictly Isolated)
| Token | Foreground / Fill | Soft Surface | Strict Domain Usage |
| :--- | :--- | :--- | :--- |
| `safety-green` | `#15803D` | `#DCFCE7` | **HIJAU (Aman Dikonsumsi)** — safe holding time `>= 45 mins`, verified ompreng complete, AI nutrition passed. |
| `safety-amber` | `#B45309` | `#FEF3C7` | **KUNING (Segera Konsumsi)** — safe holding time `< 45 mins`, pending maggot pickup dispatch, minor container discrepancy. |
| `safety-red` | `#B91C1C` | `#FEE2E2` | **MERAH (DILARANG DIBAGIKAN)** — holding time expired (`<= 0 mins`), hard-locked safety warning, high-spoilage risk tag. |
| `eco-teal` | `#0F766E` | `#CCFBF1` | Subtle accent *only* on Sustainability Impact metrics (plastics saved & organic kg diverted to BSF maggots). |

---

## 4. Typography System & Hierarchy

SajiAman uses a deliberate two-font pairing engineered for outdoor legibility, crisp Indonesian copy, and jitter-free live countdown timers.

### 4.1 Font Families
- **Primary UI Sans:** `Plus Jakarta Sans` (Weights: `400 Regular`, `500 Medium`, `600 SemiBold`, `700 Bold`, `800 ExtraBold`). Sharp geometric terminals convey institutional clarity and modern Indonesian public service.
- **Instrument Mono / Numerals:** `JetBrains Mono` (Weights: `600 SemiBold`, `700 Bold`) with strict `tabular-nums` alignment for countdown timers, locked WIB timestamps, batch IDs (`SAJI-8F2A91`), ompreng counts, and weight metrics.

### 4.2 Type Scale (Mobile — 390px Base Viewport)
| Role | Font & Weight | Size / Line-Height | Letter Spacing | Application |
| :--- | :--- | :--- | :--- | :--- |
| `display-timer` | `JetBrains Mono` Bold | `44px / 48px` | `-0.03em` | Hero live countdown (`02:18:40`) on 1-Scan Safety Check screen. |
| `display-metric` | `JetBrains Mono` Bold | `28px / 32px` | `-0.02em` | Big ompreng numbers, kg waste counter, plastic-saved totals. |
| `title-screen` | `Plus Jakarta Sans` ExtraBold | `22px / 28px` | `-0.02em` | Top app bar title or verdict headline (`AMAN DIKONSUMSI`, `DILARANG DIBAGIKAN`). |
| `title-section` | `Plus Jakarta Sans` Bold | `16px / 22px` | `-0.01em` | Card section headings, school names, batch titles. |
| `body-strong` | `Plus Jakarta Sans` SemiBold | `14px / 20px` | `0em` | Menu item names, primary list rows, CTA button text. |
| `body-regular` | `Plus Jakarta Sans` Regular | `14px / 21px` | `0em` | Operational instructions, notes, confirmation details. |
| `micro-kicker` | `Plus Jakarta Sans` Bold | `11px / 14px` | `+0.08em` | **UPPERCASE** instrument labels (`JAM MASAK TERKUNCI`, `BATAS AMAN`, `SPPG SEMARANG 01`). |
| `code-badge` | `JetBrains Mono` SemiBold | `12px / 16px` | `+0.02em` | Batch tokens (`SAJI-4A9C`), timestamps (`05:14 WIB`), duration limits (`3,5 JAM`). |

---

## 5. Layout Grammar, Grid & Field Ergonomics

- **Viewport Target:** Mobile Portrait `390 x 844 px` (iOS/Android standard), safe areas respected (`top: 44px`, `bottom: 34px`).
- **Grid & Margins:** `16px` outer horizontal margin (`20px` on hero onboarding/login). Strict `4px / 8px` spatial rhythm (`8px` tight group, `12px` inner card padding, `16px` between sections, `24px` major structural break).
- **Corner Radius Discipline (Tactile, Not Bubbly):**
  - Main containers & cards: `12px` (never overly bubbly `28px` cards).
  - Primary CTA buttons & inputs: `10px`.
  - Tactile chips / preset toggles: `8px`.
  - Status micro-tags: `6px` sharp pill/tag (no soft squishy blobs).
- **Field Ergonomics (Wet Hands / Bright Sunlight / One-Handed Use):**
  - Primary CTA height: `54px–56px` (full-width or anchored sticky footer bar).
  - Minimum interactive tap target: `48 x 48 px`.
  - High contrast ratio: minimum `7:1` for safety verdicts and countdown numbers.
- **Anti-Monotony Layout Variety Matrix:**
  - `SCR-01 (Login)`: Editorial Institutional Split (deep MBG Navy upper masthead + crisp white structured entry sheet).
  - `SCR-02 (Kitchen Home)`: Command Cockpit (deep navy operational command banner + asymmetric 2-tile telemetry + compact live batch manifest).
  - `SCR-03A (Manual Input)`: Tactile Control Board (sticky bottom seal bar + segmented toggle + color-coded spoilage risk menu matrix).
  - `SCR-03B (AI Live Camera)`: Full-Bleed Hardware Viewfinder (edge-to-edge dark camera frame + crisp optical alignment guides + live 4-nutrition HUD checklist).
  - `SCR-04 (QR Batch Ticket)`: Physical Thermal Shipping Label (white perforated ticket floating on cool navy-tinted backdrop, bold QR + anti-tamper stamp).
  - `SCR-05A & 05B (Ompreng & Waste/Impact)`: Dispatch Board & Sustainability Telemetry (horizontal status rail + crisp data rows + bold dark-navy/teal impact hero block).
  - `SCR-06 (School Home & Scanner)`: Action-First Scanner Hub (dominant scan card/trigger up top + live traffic-light shipment strip below).
  - `SCR-07A/B/C (1-Scan Safety Verdict)`: Full-Bleed Traffic-Light Instrument (40% top verdict block in solid Green/Amber/Red + crisp factual ledger below + locked action bar).
  - `SCR-08 (Quick Zero-Waste Form)`: Fast Tactile Stepper Sheet (giant centered numeric stepper, chunky unit toggle `KG` / `EMBER`, instant preset chips).

---

## 6. Signature Reusable Component Library (React Native Ready)

1. **Anti-Tamper Timestamp Stamp:** Monospaced clock icon + `05:12 WIB • SERVER LOCKED` pill with subtle lock glyph (`lucide-react-native: Lock`). Communicates immutability instantly.
2. **Weakest-Link Rule Strip:** Horizontal alert bar dynamically showing the controlling perishable ingredient (e.g., `Batas Aman Terkunci: 3,5 Jam — Dipicu oleh Sayur Lodeh Santan`).
3. **Traffic-Light Verdict Banner:** Full-width top status container with bold icon, uppercase verdict, and `44px` monospaced countdown timer. Never shrinks into a tiny badge.
4. **Ompreng Circulation Rail:** 3-node horizontal milestone tracker (`Dikirim` → `Diterima Sekolah` → `Kembali ke Dapur`) with crisp connecting hairlines and integer counts (`120 / 120`).
5. **Bottom Navigation Bar (Role-Scoped):** Crisp white bar with `1px solid #D8E2EE` top border, `64px` height, active icon in `#0F4C81` with a sharp `3px` top indicator bar (not a floating bubble pill).
   - **Kitchen Role (3 Tabs):** `Produksi`, `Ompreng`, `Limbah & Dampak`.
   - **School Role (3 Tabs):** `Pindai QR`, `Kiriman`, `Lapor Sisa`.

---

## 7. Authentic Indonesian MBG Data Dictionary (Use in All Mockups)

To avoid generic placeholder text, always use realistic Indonesian MBG operational data:
- **Kitchen (SPPG):** `SPPG Semarang Tengah 01`
- **Schools:** `SDN Pindrikan Lor 01`, `SDN Sekayu 02`, `SMPN 3 Semarang`
- **Menus (Perishable / 3.5h):** `Sayur Lodeh Santan`, `Soto Ayam Kuah`, `Opor Ayam Santan`, `Sayur Asem`
- **Menus (Dry / 4.5h):** `Nasi Putih`, `Ayam Goreng Lengkuas`, `Tempe Orek Kering`, `Tumis Buncis Wortel`, `Pisang Ambon`, `Jeruk Medan`
- **Container Terminology:** `Ompreng Stainless` (e.g., `120 Ompreng`, `85 Ompreng`)
- **Waste & BSF Terminology:** `Mitra Maggot BSF — Berkah Organik`, `Takaran Ember`, `Kilogram (kg)`, `Siap Dijemput Mitra Maggot`
- **Batch IDs:** `SAJI-8F2A91`, `SAJI-3C7D10`, `SAJI-9B4E22`