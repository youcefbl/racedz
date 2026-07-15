# Coach Zid — Fennec Mascot Character Bible & Generation Prompts

The P0 deliverable named in `04-avatar-and-tools.md` §"Golden rules" #2. Locks the look of **Coach Zid** so every image and video across FR/AR/EN reads as the same character.

> **Decision: Coach Zid is a fennec, not a human.** Rationale in §0. The earlier photoreal-human version of this doc is in git history if the ship-test (§7) sends us back.

---

## 0. Why a fennec

- **Les Fennecs is already the national team.** Pre-loaded national pride; we borrow it, we don't build it.
- **The metaphor fits the product.** Desert fox: endurance over raw speed, survives brutal heat, small but tough. And the oversized ears — **a coach who listens.** That's literally what an adaptive AI coach does.
- **It doesn't compete with real runners.** Doc `04` picked Route C: AI avatar for volume, real Algerians for emotion. A *photoreal* AI human loses that comparison in its own feed. A mascot is a different register, so the two become complementary — the mascot makes real footage feel more real.
- **No casting problem.** A human coach is one face, one region. Kabyle, Chaoui, Sahrawi, Algérois — someone doesn't see themselves. A fennec is everyone's.
- **Transparency is free.** Golden rule #1 says be honest it's an AI. Nobody thinks a fox is a real person.
- **It scales into the product.** App icon, loading animation, badges, WhatsApp stickers, merch. A photoreal human becomes none of those.

**The known risk:** credibility. Will a runner chasing a sub-45 10K take advice from a cartoon fox? **Mitigation — role split:** the fennec never *gives* the coaching, the app does. The fennec is the voice and the hype-man; *"Zid!"* is a mascot word, not a physiology lecture. Anything needing a real body (form, gait, posture) goes to real runners.

---

## 1. Who he is (the bible)

| Trait | Locked value |
|---|---|
| **Name** | Coach Zid |
| **Species** | Fennec fox — upright bipedal, athletic human-like proportions, digitigrade legs, expressive hands |
| **Fur** | **Pale cream-sand**, warm ivory chest and inner ears, soft grey-tipped tail. *Pale, not orange* — see §2 palette trap |
| **Ears** | Oversized, upright, alert — the signature. Never drooping in hero shots. |
| **Eyes** | Large, dark, warm, intelligent. Slight smile-crease. |
| **Read** | Confident, warm, disciplined. The coach who *listens* before he talks. |
| **Build** | Lean runner. Not muscular, not chibi, not cute-baby. Adult. |
| **Signature outfit** | Lime-green technical tee w/ orange chevron · charcoal shorts · black smartwatch (left wrist) · lightweight running shoes |
| **Setting** | Algerian streets, seafronts, stadiums, desert trails — golden hour |
| **Catchphrase** | *"Zid!"* 🏃 |
| **Never does** | Medical claims · glorify only fast runners · aggression/snarling · childish mugging |

---

## 2. The palette trap — read before prompting

**ZidRun is lime green + orange. It is NOT teal.**

| Source | Says | Verdict |
|---|---|---|
| `public/zidrun-logo.svg` + `02-brand-voice-and-assets.md` | `#8BC53F` lime · `#F47A20` orange | ✅ **This is the brand** |
| `tailwind.config.ts` → `brand.teal` | `#15803D` (a *green*, key misnamed for legacy classes) | ⚠️ misleading key name |
| `www/index.html` (stale static landing) | `#0F766E` real teal | ❌ off-brand, ignore |

**Contrast rule (extends `02` §3 "never orange on orange"):** Coach Zid's fur is pale sand. **Orange accents must never touch fur** — they'd disappear. Orange sits only on charcoal or against the green. Green tee against cream fur is the high-contrast pairing that carries the brand.

| Role | Hex | In-prompt wording |
|---|---|---|
| Primary — tee | `#8BC53F` | "bright lime green, fresh tennis-ball green" |
| Accent — chevron only | `#F47A20` | "vivid tangerine orange" |
| Ink — shorts, shoes | `#141618` | "near-black charcoal" |
| Off-white | `#FAFAFA` | "soft off-white" |

Hex codes don't work in image prompts. Prompt in words, then color-correct the tee in Canva to land the exact values.

---

## 3. PROMPT A — canonical character reference (run this first)

**One character, one pose, one background.** No lists of alternatives — a model given "smiling, or pointing, or celebrating" doesn't choose, it averages them into mush. Nail the canonical form here; poses come in §5.

```
Character design render of an anthropomorphic fennec fox running coach,
standing full-body, three-quarter turn toward camera, on a plain soft
neutral grey studio gradient background.

CHARACTER: Upright bipedal fennec fox with athletic human-like proportions
and digitigrade legs. Lean distance-runner's build — athletic and capable,
not muscular, not cute or babyish. Adult, mid-thirties energy.

HEAD: Oversized signature fennec ears, held upright and alert, with warm
ivory inner fur. Pale cream-sand fur across the face, soft ivory muzzle and
chest. Large dark expressive eyes, intelligent and warm, with a slight
smile-crease. Calm confident closed-mouth smile. Small black nose, fine
whiskers.

WARDROBE: Fitted bright lime-green technical running tee (fresh
tennis-ball green) with a single vivid tangerine-orange diagonal chevron
stripe across the chest. Near-black charcoal running shorts. Lightweight
charcoal and off-white running shoes. Matte black smartwatch on the left
wrist. No brand logos, no text anywhere on the clothing.

POSE: Standing tall and relaxed, weight on one leg, arms loose at his sides,
looking directly at camera. Confident and welcoming.

STYLE: Premium stylized-realistic 3D character design for a modern animated
feature. Groomed fur with visible individual strands but a clean readable
silhouette. Cartoon-legible facial structure — expressive and warm, NOT
photoreal-wildlife. Soft warm key light, gentle rim light, subtle ambient
occlusion. Crisp detail, clean composition, neutral background.

AVOID: teal, blue, photoreal wildlife documentary fox, childish chibi
proportions, aggressive or snarling expression, bared teeth, excessive
muscles, orange fur, red fox coloring, cluttered background, text,
watermarks, logos, distorted anatomy, extra limbs, extra fingers, sunglasses.
```

**Then lock it:** save the seed. Generate 6–8 times. Pick the one you'd happily see 200 times.

**On the style tension in your draft:** "realistic fur" + "expressive face" fight each other. Realistic fur pulls toward photoreal-wildlife (the *Lion King* 2019 problem — technically gorgeous, emotionally dead, can't act). The prompt above resolves it deliberately: detailed fur, *cartoon-legible* facial structure. Think Nick Wilde, not a nature doc. Expression beats fidelity for a mascot — you need him to *emote* at thumbnail size on a phone.

---

## 4. PROMPT B — campaign hero (after A is locked)

Feed reference A back as an **Ingredient**. This is the one with negative space.

```
The same fennec fox coach, identical character design, identical lime-green
tee with orange chevron — standing confidently on an Algiers seafront
promenade at golden hour, arms folded, warm confident smile, looking at
camera.

COMPOSITION: He occupies the right third of the frame. The left two-thirds
is open sky and softly blurred sea — deliberate clean negative space for
headline text and logo overlay.

SETTING: Mediterranean coastline, palm trees, white Algerian architecture,
distant sea, warm haze.

LIGHT: Low golden sun, warm rim light on his ears and shoulders, soft bounce
fill, gentle lens flare.

STYLE: Premium sports-brand campaign key art, stylized-realistic 3D, crisp
detail. No text, no logo — leave the space empty.
```

> Negative space belongs **here**, not in Prompt A. The character reference should be tight and neutral so it cuts out cleanly; the campaign render is where layout matters.

---

## 5. Character sheet — the reusable set

Ingredient = reference A. Same skeleton each time:

```
The same fennec fox coach, identical character design, identical face, ears,
fur and wardrobe — [VARIANT]. Premium stylized-realistic 3D, warm golden
light, clean composition. No text, no logos.
```

| # | `[VARIANT]` | Used for |
|---|---|---|
| 1 | `clean front-facing bust portrait, neutral friendly expression, plain grey background` | Profile stills, rigging reference |
| 2 | `mid-stride sprinting on a coastal road, ears back, motion blur, dynamic low angle` | Reel covers, b-roll |
| 3 | `crouched at a stadium starting line, looking up at camera, encouraging smile` | Tip cards |
| 4 | `holding a phone, gesturing at the screen, explaining, warm patient expression` | Coach demo / feature posts |
| 5 | `arms raised celebrating at a finish line, big joyful open smile, confetti` | Race-day, congratulations posts |
| 6 | `pointing forward and ahead, encouraging, determined smile, desert trail at dawn` | Motivation, "Zid!" posts |
| 7 | `arms crossed, warm serious expression, charcoal background, dramatic rim light` | Quote cards, dark templates |
| 8 | `full-body T-pose, neutral expression, flat grey background, orthographic front view` | **Rigging reference — do not skip** |

Export all eight. **That set *is* the character bible** — it goes to any designer, any tool, any collaborator.

**Worth testing:** a subtle darker fur marking on his brow that echoes the Z speed-blade chevron. If it reads as *his* mark rather than a scar, it ties the mascot to the logo permanently. If it reads as a wound or a bindi, drop it — the apparel chevron already carries the brand.

---

## 6. Tooling — this changes the stack

**Google Flow is now the wrong tool for the character.** Veo is no better at consistent stylized characters than photoreal ones, and every generation re-rolls the dice on his face.

| Stage | Tool | Why |
|---|---|---|
| Explore the look | Midjourney / Imagen / Flow | Cheap iteration on §3 until one lands |
| **Lock the design** | **A real designer → clean vector / 3D model** | One-time cost. Ends character drift forever. |
| Animate | Rive (cheap, web-native) or After Effects | Rig once, animate infinitely at zero marginal cost |
| Voice | ElevenLabs FR/AR | Unchanged from `04` |
| Environments, b-roll | **Google Flow / Veo** | What it's genuinely great at — Algerian golden-hour cities, no character consistency required |
| Edit, design | CapCut + Canva | Unchanged from `04` |

**Net:** higher upfront (one designer engagement), then **cheaper forever** — this drops **HeyGen** from the stack entirely (~$30–90/mo), because a rigged mascot doesn't need talking-head lipsync. Generative tools explore; a designed asset ships.

---

## 7. Transparency & compliance (carries from `04` and `02` §7)

- Coach Zid is an **AI coach and we say so.** *"Coach Zid, ton coach IA"* is the pitch, not a secret.
- Profile avatar stays the **Z mark** — Coach Zid is the presenter *in* the content, never the logo.
- Every coach post keeps the soft disclaimer: *"Conseils informatifs, pas un avis médical."*
- The fennec never demos form or gives physiology. Real runners do that.

---

## 8. Ship-test before you scale

Per `04` §Golden rules #5: get to 3 Coach Zid posts *before* commissioning the designer — rough generated stills are enough to test whether the character lands. Watch retention and comments for a week.

Watch for one specific signal: **do the sub-45 10K runners engage, or only beginners?** That's the credibility risk from §0 showing up in real data. If serious runners bounce, tighten the role split — more real runners, fennec purely as hype and brand — before spending on the rig.
