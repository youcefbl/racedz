# Device capture folders

Each dated folder here holds the artifacts of one physical-device pass
(procedure: `docs/NATIVE_REGRESSION_M21.md`).

**Screenshots are not committed.** `.gitignore` excludes `*.png` under this directory because:

- they are large — a few passes reached ~38 MB, which every clone then carries forever;
- they contain seeded test-account data (emails, registrations, routes), and a device pass run
  against production would contain real data;
- the durable evidence is the written result, not the pixels. A screenshot proves appearance at one
  moment; it cannot prove gesture timing, focus order, process-death recovery or storage behaviour,
  which is where the defects in this project have actually lived.

**What IS committed, and must stay:** the dated `RESULTS.md` in each folder, plus performance
captures (`*-coldstart.txt`, `*-framestats.txt`). Those are small, diffable, and are what the
`EXECUTION_PLAN.md` evidence rows rely on.

Keep the PNGs locally for as long as they are useful, and attach them to a review or an issue if
someone needs to see a specific frame.
