/**
 * The on-topic gate, in the registers runners actually write in.
 *
 * Field test 20260812-01 found `وش نديري كي نحس روحي عيانة؟` — "what do I do when I feel
 * exhausted?" — refused as off-topic, deterministically, on two independent accounts. The Arabic
 * vocabulary was MSA-only while the product's documented Arabic voice is Algerian darija and the
 * system prompt tells the coach to mirror it. So the gate refused exactly the register the app
 * invites runners to use.
 *
 * A regex list is easy to regress and easy to over-narrow, hence this. Both directions are
 * asserted: real questions must get through, and clearly off-topic ones must still be refused, so
 * "fix" the gate by matching everything and this fails.
 *
 *   npm run test:coach-topicality
 */
import { evaluateTopicality } from "../src/lib/coach/topicality";

let passed = 0;
let failed = 0;

function expect(message: string, onTopic: boolean, note: string) {
  const actual = evaluateTopicality(message).onTopic;
  const ok = actual === onTopic;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${note} — ${ok ? "" : `expected onTopic=${onTopic}, got ${actual} · `}"${message}"`);
  if (ok) passed += 1;
  else failed += 1;
}

// ---- The regression that motivated this ---------------------------------------------------------
expect("وش نديري كي نحس روحي عيانة؟", true, "darija: what do I do when I feel exhausted (20260812-01)");

// ---- Algerian darija, Arabic script -------------------------------------------------------------
expect("راني عيانة بزاف بعد الحصة تاع البارح", true, "darija: exhausted after yesterday's session");
expect("واش نديرو باش نحبس الوجع في الركبة؟", true, "darija: knee pain");
expect("البرنامج تاع هاد السيمانة صعيب عليا", true, "darija: this week's plan is hard");
expect("وقتاش نخرج نجري في السخانة؟", true, "darija: when to run in the heat");
expect("شحال من كلم لازم ندير هاد السمانة؟", true, "darija: how many km this week");
expect("صباطي يضرني كي نجري", true, "darija: my shoes hurt when I run");
expect("نحتاج راحة ولا نكمل التمرين؟", true, "darija: rest or keep training");

// ---- Latin-script darija (arabizi) ---------------------------------------------------------------
expect("rani 3ayan bezaf, wach ndir?", true, "arabizi: I'm very tired");
expect("njri ghedwa ola nrta7?", true, "arabizi: run tomorrow or rest");
expect("3andi wja3 fe rekba", true, "arabizi: knee pain");

// ---- MSA and the other locales must still work ---------------------------------------------------
expect("كيف أتعامل مع التعب بعد التدريب؟", true, "MSA: fatigue after training");
expect("Can I do hard intervals this week?", true, "english: intervals");
expect("Comment gérer la fatigue après une sortie longue ?", true, "french: fatigue after long run");

// ---- Still refused. A gate that passes everything is not a gate ----------------------------------
expect("واش نديري باش نطيب الكسكس؟", false, "darija: how do I cook couscous");
expect("شكون ربح الماتش تاع البارح؟", false, "darija: who won yesterday's match");
expect("Write me a poem about the sea.", false, "english: poem");
expect("Quelle est la capitale du Japon ?", false, "french: capital of Japan");
expect("ما هي عاصمة اليابان؟", false, "MSA: capital of Japan");

// ---- Too short to classify: let it through rather than refuse blind -------------------------------
expect("ok", true, "very short message is not classified");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
