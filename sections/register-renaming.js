/* Section: Register Renaming
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "ren"). */

section({
  id: "ren",
  name: "Register Renaming",
  cap: "The RAT, the free list, rename ports, and the physical register file",
  sections: [
    { id: "pages", label: "Pages in This Region" }
  ],
  body: `
<p>Renaming sits between decode and dispatch. It maps every architectural register an instruction names onto a physical register, which removes the false dependences that come from reusing a small register set, and it is what lets the <a href="#/r/core">Out-of-Order Core</a> keep hundreds of instructions in flight. This region covers what renaming does, how its table is built down to the circuit, what it costs, and how big the physical register file has to be.</p>
<h3 id="sec-pages">Pages in This Region</h3>
<ul>
<li><a href="#/renaming">Register Renaming</a>: the RAT, free list, and old mappings, why a register is freed at commit, same-group dependences, and recovery.</li>
<li><a href="#/rat-design">Building the RAT</a>: SRAM and CAM tables, and how many ports a renamer needs.</li>
<li><a href="#/rat-circuit">Inside the RAT Circuit</a>: the multiported cell, decoders, word lines, and bit lines behind each port.</li>
<li><a href="#/rename-cost">What Renaming Costs</a>: storage, ports, area, energy, and delay for both forms, the tricks that cut ports, and how to model them.</li>
<li><a href="#/prf-sizing">Sizing the Physical Register File</a>: how many physical registers a window needs and what each one costs.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Follow one instruction, <code>r7 = r7 + r2</code>, through the renaming structures. The RAT holds r7→p52 and r2→p18, and p90 is at the head of the free list. Say what each structure does at rename, at commit, and if the instruction is squashed before it commits.</p>`,
        a: `<ol><li>Rename, sources: the RAT reads r7→p52 and r2→p18, so the instruction becomes <code>p90 = p52 + p18</code>.</li><li>Rename, destination: p90 comes off the free list, the RAT's r7 entry becomes p90, and the ROB entry saves the old mapping p52.</li><li>Execution: the result is written to p90. Every younger reader of r7 was renamed to p90 and wakes on it.</li><li>Commit: the retirement RAT's r7 entry becomes p90, and p52 goes back on the free list. Every reader of p52 is older and has already read it.</li><li>Squash: recovery puts r7→p52 back in the RAT (from a checkpoint, a ROB walk using the saved p52, or the retirement RAT), and p90 goes back on the free list. p52 is not freed, because it is the live mapping again.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A core's rename stage stalls 18% of cycles on a server workload. List what can stall rename, and say which counters or model statistics would tell you which one it is.</p>`,
        a: `<ul><li><strong>No free physical register:</strong> the free list is empty because the window holds every register. Count rename cycles stalled on an empty free list, split by register class (integer, FP/vector, flags). The fix is a larger PRF or freeing earlier, see <a href="#/prf-sizing">Sizing the Physical Register File</a>.</li><li><strong>No free checkpoint:</strong> every checkpoint is held by an unresolved branch. Count branch-checkpoint stalls and the number of unresolved branches in flight. Branchy code with slow-resolving branches (waiting on cache misses) hits this.</li><li><strong>Back-pressure from dispatch:</strong> the ROB, an issue queue, or the load or store queue is full, so renamed instructions can't leave. These show up as dispatch-stall counters by resource, and they mean rename is not the real bottleneck.</li><li><strong>Port or bank limits:</strong> a cap on RAT or register file reads per cycle, counted as port-conflict stall cycles (Core 2's RAT_STALLS counters).</li><li><strong>Front-end starvation:</strong> no instructions arrive. That is not a rename stall, so exclude it before blaming rename.</li></ul><p>A stall breakdown by reason, normalized to total cycles, settles it. If empty-free-list cycles dominate while the ROB is not full, the PRF is undersized relative to the ROB.</p>`
      }
    ]
  }
}, [
{
  id: "renaming",
  region: "ren",
  title: "Register Renaming",
  sections: [
    { id: "pieces", label: "Pieces" },
    { id: "lifecycle-mapping", label: "Lifecycle of a Mapping" },
    { id: "free-at-rename", label: "Why Not Free at Rename" },
    { id: "same-group", label: "Same-Group Dependences" },
    { id: "recovery", label: "Recovery" },
    { id: "limits", label: "What Limits It" }
  ],
  body: `
<p>Programs reuse a small set of architectural registers, which creates false dependences: write-after-read (WAR) and write-after-write (WAW). Renaming gives every destination a fresh physical register, so only true read-after-write (RAW) dependences remain.</p>
<h3 id="sec-pieces">Pieces</h3>
<ul><li><strong>Register alias table (RAT):</strong> maps each architectural register to its current physical register.</li><li><strong>Free list:</strong> physical registers available for new destinations.</li><li><strong>Old-mapping field in each ROB entry:</strong> the physical register the destination replaced, freed when the instruction commits and written back into the RAT if the instruction is squashed.</li><li><strong>Retirement RAT:</strong> the committed, non-speculative mapping.</li></ul>
<h3 id="sec-lifecycle-mapping">Lifecycle of a Mapping</h3>
<p>At rename, sources read the RAT, the destination takes a register from the free list, and the <em>previous</em> mapping is saved in the ROB entry. At commit, that previous register is freed. Commit is the earliest point that is always safe: every older reader of the old register is done, and the instruction can no longer be squashed.</p>
<h3 id="sec-free-at-rename">Why Not Free at Rename</h3>
<p>When I2 renames r1 from p7 to p40, every instruction renamed after I2 reads r1 as p40, so no new instruction will ever name p7 again. It's tempting to put p7 back on the free list right away. It can't go yet, because two things can still need its value until I2 commits:</p>
<ol>
<li><strong>Older readers.</strong> Instructions between p7's producer and I2 were renamed with p7 as a source and may not have issued yet. If p7 goes back on the free list, a younger instruction can pop it and write it first. p7's ready bit then wakes the older reader with the wrong value. When the original producer finally writes p7, it also clobbers the new owner's value.</li>
<li><strong>Recovery.</strong> If a branch older than I2 mispredicts, the RAT goes back to r1→p7. The same happens if I2 or anything older faults. The restored mapping is only useful if p7 still holds r1's old value. Precise exceptions depend on this: the handler must see r1 as it was before I2.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 296" role="img" aria-label="Cycle timeline of four instructions when p7 is freed as soon as I2 renames r1. I0, ld r1 from [r6], has destination p7. It renames in cycle 0 and misses in the L1, so its data comes back from the L2 and it writes p7 in cycle 16. I1, add r2 = r1 + 1, reads p7. It renames in cycle 0 and waits for p7. I2, mul r1 = r3 times 2, renames in cycle 0 to p40 and, in this broken design, puts p7 on the free list. I3, add r4 = r5 + 1, renames in cycle 2, pops p7, executes in cycle 3, and writes p7 in cycle 4. That write sets p7 ready, so I1 wakes and reads p7 in cycle 5, getting I3's value instead of the load's, though it should have read in cycle 17. In cycle 16 the load writes p7 too, so I3's own consumers now read the load's value.">
<defs><marker id="arrFR1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--accent-red)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Freeing p7 when I2 renames: a younger instruction reuses it</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M160,52 V222"/><path d="M188,52 V222"/><path d="M216,52 V222"/><path d="M244,52 V222"/><path d="M272,52 V222"/><path d="M300,52 V222"/><path d="M328,52 V222"/><path d="M356,52 V222"/><path d="M384,52 V222"/><path d="M412,52 V222"/><path d="M440,52 V222"/><path d="M468,52 V222"/><path d="M496,52 V222"/><path d="M524,52 V222"/><path d="M552,52 V222"/><path d="M580,52 V222"/><path d="M608,52 V222"/><path d="M636,52 V222"/><path d="M664,52 V222"/>
</g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="174" y="44">0</text><text x="202" y="44">1</text><text x="230" y="44">2</text><text x="258" y="44">3</text><text x="286" y="44">4</text><text x="314" y="44">5</text><text x="342" y="44">6</text><text x="370" y="44">7</text><text x="398" y="44">8</text><text x="426" y="44">9</text><text x="454" y="44">10</text><text x="482" y="44">11</text><text x="510" y="44">12</text><text x="538" y="44">13</text><text x="566" y="44">14</text><text x="594" y="44">15</text><text x="622" y="44">16</text><text x="650" y="44">17</text>
</g>
<text x="152" y="44" text-anchor="end" style="fill:var(--muted);font-size:10px">cycle</text>
<g style="stroke-width:1.5">
<rect x="160" y="56" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="188" y="56" width="420" height="30" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="608" y="56" width="28" height="30" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<rect x="160" y="100" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="188" y="100" width="112" height="30" style="fill:none;stroke:var(--muted);stroke-dasharray:4 3"/>
<rect x="300" y="100" width="28" height="30" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<rect x="636" y="100" width="28" height="30" style="fill:none;stroke:var(--accent-green);stroke-width:2;stroke-dasharray:4 3"/>
<rect x="160" y="144" width="28" height="30" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/>
<rect x="216" y="188" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="244" y="188" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="272" y="188" width="28" height="30" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
</g>
<path d="M286,188 C286,162 314,160 314,134" marker-end="url(#arrFR1)" style="fill:none;stroke:var(--accent-red);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)">
<text x="10" y="69">I0 ld r1,[r6]</text><text x="10" y="113">I1 add r2,r1,1</text><text x="10" y="157">I2 mul r1,r3,2</text><text x="10" y="201">I3 add r4,r5,1</text>
</g>
<g style="fill:var(--muted);font-size:10px">
<text x="10" y="82">dest p7</text><text x="10" y="126">src p7</text><text x="10" y="170">dest p40, old p7</text><text x="10" y="214">dest p7 (reused)</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle">
<text x="174" y="75">R</text><text x="622" y="75">W</text>
<text x="174" y="119">R</text><text x="314" y="119">rd</text><text x="650" y="119">rd</text>
<text x="174" y="163">R</text>
<text x="230" y="207">R</text><text x="258" y="207">X</text><text x="286" y="207">W</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="398" y="75">load in flight (L1 miss, L2 hit)</text>
<text x="244" y="119">wait</text>
</g>
<text x="630" y="119" text-anchor="end" style="fill:var(--accent-green);font-size:10px">should read here</text>
<text x="196" y="163" style="fill:var(--accent-red);font-size:11px">r1 → p40, and p7 goes on the free list ✗</text>
<text x="312" y="207" style="fill:var(--muted);font-size:11px">pops p7 in cycle 2 and writes it in cycle 4</text>
<g style="fill:var(--accent-red);font-size:11px">
<text x="10" y="244">✗ Cycle 4: I3's write sets p7 ready, so I1 wakes and reads I3's value, not the load's.</text>
<text x="10" y="262">✗ Cycle 16: the load writes p7 too, so I3's own consumers now read the load's value.</text>
</g>
<text x="10" y="286" style="fill:var(--muted);font-size:10px">R rename · X execute · W write p7 · rd read p7</text>
</svg></div>
<p>The second case needs no slow load. Here I0 has already written p7, and the branch I1 is predicted not taken but is really taken, so I2 and I3 are on the wrong path:</p>
<pre><code>I0: add r1, r2, r3    # r1 → p7, writes 5
I1: beq r4, r0, L     # predicted not taken, actually taken
I2: mul r1, r3, 2     # r1 → p40, old mapping p7
I3: ld  r5, [r6]      # wrong path</code></pre>
<div class="tbl"><svg viewBox="0 0 680 276" role="img" aria-label="Three snapshots of the RAT, the physical registers, and the free list when p7 is freed at rename and a branch then mispredicts. Snapshot 1, I2 renames r1: the RAT maps r1 to p40, p7 holds 5, p40 has no value yet, and the ROB entry of I2 saves old mapping p7. Snapshot 2, p7 freed at rename: the wrong-path load I3 pops p7 from the free list and writes 0x3F00 into it. Snapshot 3, the branch was taken, so recovery restores r1 to p7, but p7 now holds 0x3F00 and r1's real value, 5, is gone. With free at commit, I2 is squashed and never commits, so p7 is never freed, still holds 5 after the restore, and only p40 goes back to the free list.">
<defs><marker id="arrFR2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Freeing p7 at rename, then the branch mispredicts</text>
<g style="stroke-width:1.5">
<rect x="10" y="30" width="210" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="235" y="30" width="210" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="460" y="30" width="210" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
</g>
<g style="stroke-width:1;fill:var(--surface);stroke:var(--rule)">
<rect x="60" y="64" width="150" height="22"/><rect x="60" y="98" width="150" height="22"/><rect x="60" y="122" width="150" height="22"/><rect x="60" y="156" width="150" height="22"/>
<rect x="285" y="64" width="150" height="22"/><rect x="285" y="122" width="150" height="22"/><rect x="285" y="156" width="150" height="22"/>
<rect x="510" y="122" width="150" height="22"/><rect x="510" y="156" width="150" height="22"/>
</g>
<rect x="285" y="98" width="150" height="22" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<rect x="510" y="64" width="150" height="22" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="510" y="98" width="150" height="22" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M221,126 H233" marker-end="url(#arrFR2)"/><path d="M446,126 H458" marker-end="url(#arrFR2)"/>
</g>
<g style="fill:var(--ink);font-size:12px;font-weight:600">
<text x="20" y="50">1. I2 renames r1</text>
<text x="245" y="50" style="fill:var(--accent-red)">2. p7 freed at rename ✗</text>
<text x="470" y="50">3. beq was taken: undo</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="20" y="79">RAT</text><text x="20" y="113">PRF</text><text x="20" y="171">free</text>
<text x="245" y="79">RAT</text><text x="245" y="113">PRF</text><text x="245" y="171">free</text>
<text x="470" y="79">RAT</text><text x="470" y="113">PRF</text><text x="470" y="171">free</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="135" y="79">r1 → p40</text><text x="135" y="113">p7 = 5</text><text x="135" y="137">p40 = (not yet)</text><text x="135" y="171">p41, p42, …</text>
<text x="360" y="79">r1 → p40</text><text x="360" y="113" style="fill:var(--accent-red);font-weight:600">p7 = 0x3F00</text><text x="360" y="137">p40 = 10</text><text x="360" y="171">p7 popped by I3</text>
<text x="585" y="79" style="font-weight:600">r1 → p7 (restored)</text><text x="585" y="113" style="fill:var(--accent-red);font-weight:600">p7 = 0x3F00 ✗</text><text x="585" y="137">p40 freed</text><text x="585" y="171">p40, p41, …</text>
</g>
<g style="fill:var(--muted);font-size:10px">
<text x="20" y="198">ROB entry of I2 saves old = p7</text><text x="20" y="212">beq predicted not taken</text>
<text x="245" y="198">wrong-path I3 pops p7</text><text x="245" y="212">and writes 0x3F00 into it</text>
<text x="470" y="198">r1 should read 5, but that</text><text x="470" y="212">value is gone</text>
</g>
<text x="10" y="246" style="fill:var(--accent-green);font-size:11px;font-weight:600">✓ Free at commit: I2 is squashed and never commits, so p7 is never freed.</text>
<text x="10" y="264" style="fill:var(--muted);font-size:11px">p7 still holds 5 when the RAT goes back to r1 → p7, and only p40 returns to the free list.</text>
</svg></div>
<p>Both needs are gone once I2 commits. Every older instruction has committed by then, so every older reader has read p7. A committed instruction can't be squashed, so nothing will restore r1→p7. The ROB entry holds p7 until then. Rename reads the old mapping (the extra W RAT read ports counted on <a href="#/rat-design/rat-ports">RAT Ports</a>) and stores it in the entry, and commit pushes it onto the free list.</p>
<div class="tbl"><svg viewBox="0 0 680 212" role="img" aria-label="Lifetime of p7 on a time axis. I0 renames and p7 is allocated, then I0 writes p7. Until I2 renames r1 to p40, the RAT names p7. After that, only older readers and rollback still need it. I1, the last older reader, reads p7. Later I2 completes and every older branch has resolved, so I2 can no longer be squashed. Then I2 commits. Freeing at I2's rename is too early. Early-release schemes free p7 once both the last read and the no-squash point have passed, which needs per-register reader counts. Freeing at I2's commit is what most cores do.">
<defs><marker id="arrFR3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Lifetime of p7</text>
<rect x="50" y="80" width="250" height="20" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="300" y="80" width="320" height="20" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:10px" text-anchor="middle">
<text x="175" y="94">the RAT names p7</text>
<text x="460" y="94">only older readers and rollback need it</text>
</g>
<path d="M30,110 H660" marker-end="url(#arrFR3)" style="fill:none;stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:none;stroke:var(--muted);stroke-width:1">
<path d="M50,60 V114"/><path d="M150,60 V114"/><path d="M300,60 V114"/><path d="M420,60 V114"/><path d="M520,60 V114"/><path d="M620,60 V114"/>
</g>
<g style="fill:var(--ink);font-size:10px" text-anchor="middle">
<text x="50" y="40">I0 renames</text><text x="50" y="54">p7 allocated</text>
<text x="150" y="40">I0 writes</text><text x="150" y="54">p7</text>
<text x="300" y="40">I2 renames</text><text x="300" y="54">r1 → p40</text>
<text x="420" y="40">I1 reads p7</text><text x="420" y="54">(last reader)</text>
<text x="520" y="40">I2 can't be</text><text x="520" y="54">squashed</text>
<text x="620" y="40">I2</text><text x="620" y="54">commits</text>
</g>
<text x="652" y="128" text-anchor="end" style="fill:var(--muted);font-size:10px">time</text>
<path d="M300,150 V116" marker-end="url(#arrFR1)" style="fill:none;stroke:var(--accent-red);stroke-width:1.5"/>
<path d="M520,150 V116" marker-end="url(#arrFR3)" style="fill:none;stroke:var(--muted);stroke-width:1.5"/>
<path d="M620,150 V116" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<path d="M614,124 L620,116 L626,124" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="font-size:10px" text-anchor="middle">
<text x="300" y="166" style="fill:var(--accent-red);font-weight:600">free at rename ✗</text><text x="300" y="180" style="fill:var(--accent-red)">too early</text>
<text x="520" y="166" style="fill:var(--muted);font-weight:600">early release</text><text x="520" y="180" style="fill:var(--muted)">needs reader counts</text>
<text x="620" y="166" style="fill:var(--accent-green);font-weight:600">free at commit ✓</text><text x="620" y="180" style="fill:var(--accent-green)">what most cores do</text>
</g>
</svg></div>
<p>Commit is a safe point, not the earliest one. The earliest is when the last older reader has read p7 <em>and</em> I2 can no longer be squashed, whichever comes later. Early-release schemes aim for that point. They keep a per-register count of pending readers and check that the overwriting instruction is non-speculative (Moudgill, Pingali, and Vassiliadis, 1993, and Ergin et al., 2004). That lowers register pressure, but the counters and the extra recovery cases cost area and verification effort. Most cores free at commit and buy a larger PRF instead.</p>
<h3 id="sec-same-group">Same-Group Dependences</h3>
<p>Rename handles a group of W instructions per cycle (W is the rename width). The RAT is read at the start of the cycle and written at the end. If slot 0 of a group writes r1 and slot 2 reads r1, the RAT read for slot 2 returns r1's mapping from <em>before</em> the group, which is stale. The renamer fixes this with comparisons on architectural register names, which are known right after decode, so they run in parallel with the RAT read.</p>
<p>Take this group, with r1→p7, r2→p8, r3→p9, r4→p10, r5→p11, r6→p12 in the RAT and p40 to p43 at the head of the free list:</p>
<pre><code>slot 0: r1 = r2 + r3     new dest p40
slot 1: r4 = r1 + r5     new dest p41
slot 2: r1 = r4 + r1     new dest p42
slot 3: r6 = r1 + r2     new dest p43</code></pre>
<p>Each slot's free-list register is known at the start of the cycle (the free list pops W at once), so the comparisons only have to pick which one to use.</p>
<ol>
<li><strong>Source check (RAW inside the group).</strong> Each source of slot i is compared with the destination of every older slot 0 to i − 1. A priority selector picks the <em>youngest</em> older match, and a mux chooses that slot's new physical register over the RAT read. With no match, the RAT read wins. Slot 3's source r1 matches slot 0 and slot 2. The youngest is slot 2, so slot 3 reads p42, not p7 (stale) and not p40 (overwritten).</li>
<li><strong>Old-mapping check (for the ROB).</strong> The "previous" register saved in slot 2's ROB entry must be p40, the register slot 0 just gave r1, not p7 from the RAT. This uses the same destination-versus-older-destination compares. If slot 2 saved p7, p7 would be freed twice (once by slot 0's commit, once by slot 2's) and p40 would leak.</li>
<li><strong>Write check (WAW inside the group).</strong> Slot 0 and slot 2 both write r1 in the same cycle. Only the youngest writer may update the RAT, so slot 0's write enable is suppressed. Any slot whose destination matches a <em>younger</em> slot's destination is suppressed. The same comparator outputs serve this check and the old-mapping check, read in the other direction.</li>
</ol>
<p>After the group: slot 1 reads p40 and p11, slot 2 reads p41 and p40, slot 3 reads p42 and p8. The RAT ends with r1→p42, r4→p41, r6→p43, and the ROB saves old mappings p7, p10, p40, p12.</p>
<div class="tbl"><svg viewBox="0 0 680 330" role="img" aria-label="Same-group source check for slot 3. The rename group holds slot 0: r1 = r2 + r3 with new destination p40, slot 1: r4 = r1 + r5 with p41, slot 2: r1 = r4 + r1 with p42, and slot 3: r6 = r1 + r2 with p43. Slot 3's source r1 is compared with the destinations of slots 0, 1, and 2. Slots 0 and 2 match, slot 1 does not. A priority select picks slot 2, the youngest older match. A mux has four inputs: p40, p41, and p42 from the free list and p7 from the RAT read. The priority select drives the mux, which outputs p42 as slot 3's first source." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrRN" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="10" y="30" width="230" height="130" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="10" y="215" width="220" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="10" y="275" width="220" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="290" y="44" width="80" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="290" y="86" width="80" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="290" y="128" width="80" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="410" y="44" width="100" height="112" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<path d="M550,80 L600,105 L600,235 L550,260 Z" style="fill:var(--surface);stroke:var(--pad)"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M240,58 H288" marker-end="url(#arrRN)"/><path d="M240,100 H288" marker-end="url(#arrRN)"/><path d="M240,142 H288" marker-end="url(#arrRN)"/>
<path d="M370,58 H408" marker-end="url(#arrRN)"/><path d="M370,100 H408" marker-end="url(#arrRN)"/><path d="M370,142 H408" marker-end="url(#arrRN)"/>
<path d="M510,100 H575 V90" marker-end="url(#arrRN)"/>
<path d="M230,240 H548" marker-end="url(#arrRN)"/>
<path d="M230,300 H520 V120 H548" marker-end="url(#arrRN)"/><path d="M520,160 H548" marker-end="url(#arrRN)"/><path d="M520,200 H548" marker-end="url(#arrRN)"/>
<path d="M600,170 H650" marker-end="url(#arrRN)"/>
</g>
<text x="18" y="22" style="fill:var(--pad);font-size:12px;font-weight:600">Rename group</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)">
<text x="20" y="62">0: r1 = r2 + r3  p40</text>
<text x="20" y="90">1: r4 = r1 + r5  p41</text>
<text x="20" y="118">2: r1 = r4 + r1  p42</text>
<text x="20" y="146">3: r6 = r1 + r2  p43</text>
<text x="330" y="62" text-anchor="middle">r1 = r1?</text>
<text x="330" y="104" text-anchor="middle">r1 = r4?</text>
<text x="330" y="146" text-anchor="middle">r1 = r1?</text>
<text x="20" y="254">read r1 → p7</text>
<text x="20" y="314">pops p40 p41 p42 p43</text>
<text x="526" y="156">p40</text><text x="526" y="196">p41</text><text x="526" y="236">p42</text><text x="470" y="236">p7</text>
<text x="612" y="162">p42</text>
</g>
<g style="fill:var(--ink);font-size:12px">
<text x="20" y="234" style="font-weight:600">RAT (SRAM)</text>
<text x="20" y="294" style="font-weight:600">Free list</text>
<text x="460" y="80" text-anchor="middle" style="font-weight:600">Priority</text>
<text x="460" y="96" text-anchor="middle">youngest</text>
<text x="460" y="112" text-anchor="middle">older match</text>
<text x="460" y="136" text-anchor="middle">→ slot 2</text>
<text x="575" y="175" text-anchor="middle" style="font-weight:600">mux</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="290" y="36">slot 3 src r1 vs</text>
<text x="376" y="54">1</text><text x="376" y="96">0</text><text x="376" y="138">1</text>
<text x="250" y="54">s0</text><text x="250" y="96">s1</text><text x="250" y="138">s2</text>
<text x="604" y="186">slot 3 src</text>
</g>
</svg></div>
<h3 id="sec-recovery">Recovery</h3>
<p>On a misprediction or fault, the RAT must return to its state just before the oldest squashed instruction. There are three ways to get there:</p>
<ul>
<li><strong>Checkpoint:</strong> save a copy of the RAT (or the CAM valid vector) at each branch and restore it in one cycle. The number of checkpoints bounds how many unresolved branches can be in flight. Each branch holds its checkpoint from rename until it resolves, so when every checkpoint is taken, the next branch can't save one and rename stalls until an older branch resolves (see <a href="#/flush-recovery/checkpoints">Checkpointing</a>).</li>
<li><strong>ROB walk:</strong> every ROB entry with a destination holds its architectural register, its new physical register, and the physical register it replaced (the same old-mapping field that <a href="#/renaming/free-at-rename">Why Not Free at Rename</a> keeps alive). Walking from the youngest entry back to the squash point, each entry writes its old mapping back into the RAT and returns its new register to the free list. Walking youngest first means the last write to each architectural register comes from the oldest squashed instruction, which holds the mapping from just before the squash point. It needs no extra storage, but it takes (squashed entries ÷ walk width) cycles. A variant starts from the retirement RAT and walks forward from the ROB head to the squash point, re-applying mappings, which is faster when the squash point is near the head.</li>
<li><strong>Retirement RAT copy:</strong> the retirement RAT always holds the committed mapping. Once the faulting instruction reaches the ROB head, every uncommitted instruction goes, and copying the retirement RAT into the RAT is the whole recovery. It's simple, but it waits for every older instruction to commit, so cores use it for exceptions, interrupts, and other commit-time recoveries rather than branches.</li>
</ul>
<p>How the free list and every other structure recover too is in <a href="#/flush-recovery/rename">Pipeline Flush and Recovery</a>.</p>
<h3 id="sec-limits">What Limits It</h3>
<ul><li>Free-list size bounds instructions in flight (see <a href="#/prf-sizing">Sizing the Physical Register File</a>)</li><li>Rename width bounds throughput, and the RAT ports and same-group comparators grow as its square (see <a href="#/rename-cost">What Renaming Costs</a>)</li><li>Checkpoints bound branch depth</li></ul>
<p>How the RAT is built as hardware is on <a href="#/rat-design">Building the RAT</a>. After rename, each instruction waits in an issue queue until its sources are ready. The hardware that tracks readiness is on <a href="#/wakeup">Wakeup and Bypass Timing</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Initial RAT: r1→p1, r2→p2, r3→p3. Free list: p10, p11, p12. Rename:</p><pre><code>I0: r1 = r2 + r3
I1: r2 = r1 * r3
I2: r1 = r2 - r1</code></pre><p>Give the renamed instructions, the final RAT, and which register each instruction frees at commit.</p>`,
        a: `<ol><li>I0: sources p2, p3. r1 gets p10 (old p1). <code>p10 = p2 + p3</code></li><li>I1: sources r1 = p10, r3 = p3. r2 gets p11 (old p2). <code>p11 = p10 * p3</code></li><li>I2: sources r2 = p11, r1 = p10. r1 gets p12 (old p10). <code>p12 = p11 - p10</code></li><li>Final RAT: r1→p12, r2→p11, r3→p3.</li><li>At commit: I0 frees p1, I1 frees p2, I2 frees p10.</li><li>The WAW on r1 (I0, I2), the WAR on r1 (I1 reads, I2 writes), and the WAR on r2 (I0 reads, I1 writes) are gone. Only RAW edges remain: I0→I1, I0→I2, I1→I2.</li></ol>`
      },
      {
        q: `<p>A 6-wide renamer (AMD Zen 4's rename width) gets these six instructions in one cycle:</p><pre><code>s0: r3 = r1 + r2
s1: r1 = r3 + r3
s2: r3 = r1 + r4
s3: r5 = r3 + r1
s4: r3 = r5 + r2
s5: r2 = r3 + r1</code></pre><p class="given">Assume the RAT holds r1→p3, r2→p9, r3→p14, r4→p21, r5→p30 at the start of the cycle, and the free list pops p50, p51, p52, p53, p54, p55 to slots 0 to 5 in order. Each instruction has one destination and two sources.</p><p>Give every slot's physical sources, the old mapping each ROB entry saves, which RAT writes are suppressed, and the RAT at the end of the cycle.</p>`,
        a: `<ol><li>s0: no older slots, so sources come from the RAT: p3, p9. Dest p50. Old r3 mapping from the RAT: p14.</li><li>s1: both sources are r3, which matches s0's destination, so both read p50. Dest p51. Old r1: no older slot writes r1, so the RAT's p3.</li><li>s2: r1 matches s1 (p51), r4 has no match (RAT p21). Dest p52. Old r3: s0 writes r3, so the old mapping is p50, not the RAT's p14.</li><li>s3: r3 matches s0 and s2, and the youngest is s2, so p52. r1 matches s1, so p51. Dest p53. Old r5: RAT p30.</li><li>s4: r5 matches s3 (p53), r2 has no match (RAT p9). Dest p54. Old r3: youngest older writer is s2, so p52.</li><li>s5: r3 matches s0, s2, and s4. The youngest is s4, so p54. r1 matches s1, so p51. Dest p55. Old r2: RAT p9.</li><li>Write check: r3 is written by s0, s2, and s4, so s0's and s2's RAT writes are suppressed and only s4 writes r3.</li><li>Final RAT: r1→p51, r2→p55, r3→p54, r4→p21, r5→p53.</li><li>Check: the old mappings saved are p14, p3, p50, p30, p52, p9. Each of p14, p3, p30, p9 was live before the group, and p50 and p52 are freed by s2's and s4's commits, after s0 and s2 have both committed. Every register is freed exactly once.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>32 architectural integer registers, 180 physical. How many instructions with integer destinations can be in flight at most? And why not free the old mapping when the new producer writes back?</p>`,
        a: `<p>32 physical registers always hold committed state, so at most 180 − 32 = <strong>148</strong> in-flight destinations.</p><p>Freeing at writeback is unsafe for two reasons: older in-flight instructions may still need to read the old register, and if the new producer is squashed, the old mapping must be restored. Once the redefining instruction commits, neither can happen.</p>`
      },
      {
        q: `<p>Compare RAT checkpoints and ROB walk for misprediction recovery.</p>`,
        a: `<p>Checkpoints restore the whole RAT in about a cycle but cost area per checkpoint and cap unresolved branches in flight. A ROB walk costs no extra storage but takes cycles proportional to the number of squashed instructions. Many designs mix them: checkpoint at low-confidence branches, walk otherwise.</p>`
      }
    ]
  }
},

{
  id: "rat-design",
  region: "ren",
  title: "Building the RAT",
  sections: [
    { id: "rat-hardware", label: "Two Ways to Build the RAT" },
    { id: "rat-ports", label: "RAT Ports" }
  ],
  body: `
<h3 id="sec-rat-hardware">Two Ways to Build the RAT</h3>
<p>Rename handles a group of W instructions per cycle (W is the rename width). The RAT's job is set out on <a href="#/renaming">Register Renaming</a>. This page is about building it. For each instruction it must do three things in the same cycle:</p>
<ol><li>Look up the physical register for each source.</li><li>Look up the current mapping of the destination, so the ROB entry can save it as the "previous" register to free at commit.</li><li>Pop a physical register from the free list and write the new mapping for the destination.</li></ol>
<p>There are two ways to build the table.</p>
<ul>
<li><strong>SRAM (indexed) RAT:</strong> one entry per architectural register, holding a physical register number of ⌈log₂(PRF size)⌉ bits. A source lookup is a plain read indexed by the architectural register number. The MIPS R10000 and most current cores work this way.</li>
<li><strong>CAM RAT:</strong> one entry per <em>physical</em> register, holding the architectural register it currently names plus a valid bit. A lookup searches every entry for a valid match, and the matching row number is the physical register. Renaming a destination sets the new row's valid bit and clears the old row's. The Alpha 21264 used this form. A checkpoint (a saved copy of the map, used for <a href="#/renaming/recovery">recovery</a>) is only the vector of valid bits (one bit per physical register), which is cheap, but the search width grows with the physical register file, so it stopped scaling once PRFs reached hundreds of entries.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 270" role="img" aria-label="SRAM RAT lookup. The table has one row per architectural register, r0 to r15, each holding a physical register number: r0 holds p3, r1 p7, r2 p8, r3 p9, r4 p10, r5 p11, and r15 p30. Slot source r3 goes into a decoder, which selects row r3. The row is read out and the source is renamed to p9. The table is 16 rows of 8 bits for a 192-entry PRF, and a checkpoint copies all of it.">
<defs><marker id="arrRS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="10" y="105" width="80" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="110" y="36" width="50" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="200" y="36" width="130" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="201" y="109" width="128" height="22" style="fill:var(--trace-soft);stroke:none"/>
<rect x="400" y="105" width="70" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
</g>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M200,60 H330"/><path d="M200,84 H330"/><path d="M200,108 H330"/><path d="M200,132 H330"/><path d="M200,156 H330"/><path d="M200,180 H330"/><path d="M200,204 H330"/><path d="M240,36 V228"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M90,120 H108" marker-end="url(#arrRS)"/>
<path d="M160,120 H198" marker-end="url(#arrRS)"/>
<path d="M330,120 H398" marker-end="url(#arrRS)"/>
</g>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">SRAM RAT: one row per architectural register</text>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="220" y="52">r0</text><text x="220" y="76">r1</text><text x="220" y="100">r2</text><text x="220" y="124">r3</text><text x="220" y="148">r4</text><text x="220" y="172">r5</text><text x="220" y="196">⋮</text><text x="220" y="220">r15</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="285" y="52">p3</text><text x="285" y="76">p7</text><text x="285" y="100">p8</text><text x="285" y="124" style="font-weight:600">p9</text><text x="285" y="148">p10</text><text x="285" y="172">p11</text><text x="285" y="196">⋮</text><text x="285" y="220">p30</text>
<text x="50" y="124">src r3</text>
<text x="435" y="124" style="font-weight:600">p9</text>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="135" y="124" style="font-weight:600">dec</text>
<text x="365" y="112">read</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="180" y="110" text-anchor="middle" style="font-size:9px">select row</text>
<text x="200" y="248">16 rows × 8 bits = 128 bits (192-entry PRF)</text>
<text x="200" y="264">checkpoint: copy all 128 bits</text>
<text x="490" y="102">lookup = one indexed read</text>
<text x="490" y="118">rename dest = write the row</text>
<text x="490" y="134">old value of the row goes</text>
<text x="490" y="150">to the ROB as "previous"</text>
</g>
</svg></div>
<div class="tbl"><svg viewBox="0 0 680 290" role="img" aria-label="CAM RAT lookup. The table has one row per physical register, p0 to p191, each holding an architectural register name and a valid bit. Rows shown: p0 holds r0 valid, p7 holds r1 not valid, p8 holds r2 valid, p9 holds r3 valid, p40 holds r1 valid, and p191 is free and not valid. Slot source r1 is broadcast to every row. Only p40 matches, because p7 also names r1 but its valid bit is clear. An encoder turns the one-hot match lines into the row number p40. Renaming r1 to p40 set the valid bit of p40 and cleared the valid bit of p7. The valid column, 192 bits, is the whole checkpoint, and every lookup compares all 192 rows.">
<defs><marker id="arrRC" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="10" y="121" width="80" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="150" y="40" width="180" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="151" y="161" width="178" height="22" style="fill:var(--trace-soft);stroke:none"/>
<rect x="370" y="40" width="50" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="460" y="121" width="70" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
</g>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M150,64 H330"/><path d="M150,88 H330"/><path d="M150,112 H330"/><path d="M150,136 H330"/><path d="M150,160 H330"/><path d="M150,184 H330"/><path d="M150,208 H330"/>
<path d="M190,40 V232"/><path d="M240,40 V232"/><path d="M270,40 V232"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M90,136 H110"/><path d="M110,52 V220"/>
<path d="M110,52 H148" marker-end="url(#arrRC)"/><path d="M110,76 H148" marker-end="url(#arrRC)"/><path d="M110,100 H148" marker-end="url(#arrRC)"/><path d="M110,124 H148" marker-end="url(#arrRC)"/><path d="M110,172 H148" marker-end="url(#arrRC)"/><path d="M110,220 H148" marker-end="url(#arrRC)"/>
<path d="M330,52 H368" marker-end="url(#arrRC)"/><path d="M330,76 H368" marker-end="url(#arrRC)"/><path d="M330,100 H368" marker-end="url(#arrRC)"/><path d="M330,124 H368" marker-end="url(#arrRC)"/><path d="M330,220 H368" marker-end="url(#arrRC)"/>
<path d="M420,136 H458" marker-end="url(#arrRC)"/>
</g>
<path d="M330,172 H368" marker-end="url(#arrRC)" style="fill:none;stroke:var(--trace);stroke-width:2"/>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">CAM RAT: one row per physical register</text>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="170" y="34">row</text><text x="215" y="34">arch</text><text x="255" y="34">v</text><text x="300" y="34">match</text>
</g>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="170" y="56">p0</text><text x="170" y="80">p7</text><text x="170" y="104">p8</text><text x="170" y="128">p9</text><text x="170" y="152">⋮</text><text x="170" y="176">p40</text><text x="170" y="200">⋮</text><text x="170" y="224">p191</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="215" y="56">r0</text><text x="215" y="80">r1</text><text x="215" y="104">r2</text><text x="215" y="128">r3</text><text x="215" y="152">⋮</text><text x="215" y="176" style="font-weight:600">r1</text><text x="215" y="200">⋮</text><text x="215" y="224">–</text>
<text x="255" y="56">1</text><text x="255" y="80">0</text><text x="255" y="104">1</text><text x="255" y="128">1</text><text x="255" y="152">⋮</text><text x="255" y="176" style="font-weight:600">1</text><text x="255" y="200">⋮</text><text x="255" y="224">0</text>
<text x="300" y="56">0</text><text x="300" y="80">0</text><text x="300" y="104">0</text><text x="300" y="128">0</text><text x="300" y="152">⋮</text><text x="300" y="176" style="font-weight:600">1</text><text x="300" y="200">⋮</text><text x="300" y="224">0</text>
<text x="50" y="140">src r1</text>
<text x="495" y="140" style="font-weight:600">p40</text>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="395" y="140" style="font-weight:600">enc</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="104" y="44" text-anchor="end">broadcast</text>
<text x="545" y="124">rename r1 → p40:</text>
<text x="545" y="140">set p40 v, clear p7 v</text>
<text x="150" y="252">v column = 192 bits = the whole checkpoint</text>
<text x="150" y="268">every lookup compares all 192 rows</text>
<g style="font-size:10px"><text x="10" y="176">p7 also names r1</text>
<text x="10" y="190">but its v = 0, so</text>
<text x="10" y="204">it doesn't match</text></g>
</g>
</svg></div>
<h3 id="sec-rat-ports">RAT Ports</h3>
<p>A <strong>port</strong> is one independent access to the table per cycle: one read or one write, each with its own register number as the address. Two reads in the same cycle need two read ports, even when they name the same register. For an SRAM RAT with two sources per instruction and rename width W:</p>
<ul><li>Read ports: 2W for sources plus W for the destinations' old mappings, 3W in all. A 4-wide renamer needs 4 instructions × 3 reads/instruction = 12 read ports.</li><li>Write ports: W, one per new destination mapping. A 4-wide renamer needs 4 instructions × 1 write/instruction = 4 write ports.</li></ul>
<p>That's 16 ports on a tiny table: 16 rows × 8 bits/row = 128 bits, where 8 bits are enough to name any of 192 physical registers. The free list must also hand out W registers per cycle.</p>
<p>The 16 x86-64 integer registers set the number of rows, not the number of ports. The port count is set by how many accesses happen in one cycle, which is 3 reads and 1 write per renamed instruction, no matter which registers they name. AArch64's 31 integer registers need 31 rows, but a 4-wide renamer still needs exactly 12 read ports + 4 write ports = 16 ports. The two 16s in the x86-64 case are a coincidence.</p>
<p>The 3W read count assumes rename reads each destination's old mapping and stores it in the ROB. A design with a retirement RAT can skip that read. When an instruction commits, the retirement RAT's entry for its destination is exactly the register being replaced, so commit reads that entry, frees it, and writes the new mapping. The front-end RAT then needs only 2W read ports, and the W extra reads move to the retirement RAT at commit, off the rename critical path. The catch is recovery: without old mappings in the ROB, the core can't walk the ROB backward and must restore from checkpoints or the retirement RAT.</p>
<p>Ports cost far more area than rows. <a href="#/rat-circuit">Inside the RAT Circuit</a> shows the transistors and wires behind a port, and <a href="#/rename-cost">What Renaming Costs</a> works out how much they cost as the renamer widens.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Intel's APX extension doubles the x86-64 integer registers to 32. Take a core with Golden Cove's 6-wide rename and 280-entry integer PRF, running APX code. Size its RAT in both forms: rows, bits per row, read and write ports, and the bits one checkpoint saves. Then give the SRAM RAT's read ports if the design moves the old-mapping read to a retirement RAT.</p><p class="given">Assume two sources and one destination per instruction, and that every architectural register needs its own RAT row.</p>`,
        a: `<ol><li>Physical register number: ⌈log₂ 280⌉ = 9 bits. Architectural name: ⌈log₂ 32⌉ = 5 bits.</li><li>SRAM RAT: one row per architectural register, so 32 rows × 9 bits/row = 288 bits.</li><li>SRAM ports: 3 reads/instruction × 6 instructions = 18 read ports, and 1 write/instruction × 6 instructions = 6 write ports, 24 ports in all. Doubling the registers from 16 to 32 added rows but not one port.</li><li>CAM RAT: one row per physical register, so 280 rows × (5 bits + 1 valid bit)/row = 1,680 bits. It needs 18 search ports, 6 write ports, and 6 one-bit valid-clear ports.</li><li>Checkpoint: the SRAM RAT saves all 288 bits. The CAM RAT saves only its valid vector, 280 rows × 1 bit/row = 280 bits. With 32 architectural registers the two are nearly equal, so the CAM's cheap checkpoint no longer buys much once the PRF reaches hundreds of entries.</li><li>Retirement RAT: the old mapping is read at commit instead, so the front-end SRAM RAT keeps only 2 reads/instruction × 6 instructions = <strong>12 read ports</strong>, and the 6 old-mapping reads move to the retirement RAT. Recovery then can't walk the ROB backward.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague profiles a 6-wide core and finds that the 12 source operands of a rename group name only 7 distinct architectural registers on average. They propose cutting the SRAM RAT from 18 read ports to 10. Is the argument sound, and what would you need to show before agreeing?</p><p class="given">Assume the RAT reads one old mapping per destination, so the 18 read ports are 12 for sources and 6 for old mappings.</p>`,
        a: `<p>Not as stated. A port serves one access per cycle no matter which row it names, so two reads of the same register still need two ports unless extra logic merges them. Sharing ports needs comparators that find duplicate names within the group, an arbiter that assigns ports to distinct names, and a crossbar that fans each read back out to every slot that asked for it. That logic sits on the rename critical path.</p><p>The average is also the wrong statistic. Every group with more than 10 distinct reads stalls rename, and in an in-order stage every younger instruction slips with it. What matters is the distribution of distinct reads per group, and the 6 old-mapping reads usually name different registers from the sources, so they rarely merge.</p><p>Before agreeing, I'd model it as a per-cycle cap on distinct RAT reads (like Core 2's register read limit) and measure the IPC loss against unlimited ports across a suite, plus a stall counter for capped cycles. Moving the old-mapping reads to a retirement RAT cuts 6 ports with no stall risk, so it's the alternative to beat.</p>`
      }
    ]
  }
},

{
  id: "rat-circuit",
  region: "ren",
  title: "Inside the RAT Circuit",
  sections: [
    { id: "circuit-terms", label: "Circuit Terms" },
    { id: "four-ports", label: "One Instruction's Four Ports" },
    { id: "decoder", label: "Address Input and Decoder" },
    { id: "word-bit-lines", label: "Word Lines and Bit Lines" }
  ],
  body: `
<p><a href="#/rat-design">Building the RAT</a> treats the RAT as a table with read and write ports. This page opens up the 4-wide SRAM RAT (16 rows × 8 bits, 12 read ports and 4 write ports) and shows what a port is built from and why each one costs so much area.</p>
<h3 id="sec-circuit-terms">Circuit Terms</h3>
<p>Each term builds on the ones before it.</p>
<ul><li><strong>Cell:</strong> the circuit that stores one bit. The RAT has 16 rows × 8 bits/row = 128 cells, and a row is the 8 cells holding one entry (row r3 holds p9 as 8 bits). At its core are two cross-coupled inverters, called the <strong>latch</strong>, holding the bit on node Q and its complement on node QB. Each inverter holds the other's input steady, so the bit stays put as long as the cell has power and nothing overpowers it.</li><li><strong>Raising and lowering a wire:</strong> driving it from 0 V (logic 0) up to the supply voltage VDD (logic 1), or back down. An NMOS transistor conducts when its gate is high and is off when its gate is low, so raising the wire on its gate turns it on.</li><li><strong>Access transistor:</strong> an NMOS transistor used as a switch between a cell and one port's wires. Off, the cell is isolated from that port. On, they are connected. A write port has two per cell, one for Q and one for QB. A read port usually uses a two-transistor <strong>read stack</strong> instead (described under Word Lines and Bit Lines below), so the stored bit never connects directly to the read wire.</li><li><strong>Word line:</strong> a wire running across one row, one per port in every row. It connects to the gate of that port's access transistor (or transistors) in every cell of the row, so raising it connects all 8 cells of that row to that port at once.</li><li><strong>Bit line:</strong> a wire running down one column, passing the same bit position in every row. A read port has one bit line per column, and a write port has a pair (the bit and its inverse).</li><li><strong>Precharge:</strong> pulling a read bit line up to VDD before the access, so the selected cell only has to pull it down or leave it high to signal its bit.</li><li><strong>Sense amplifier:</strong> the circuit at the bottom of a read port's bit line that turns its voltage into a clean 0 or 1. In a table this small it can be a plain inverter.</li><li><strong>Write driver:</strong> the circuit at the bottom of a write port's bit line pair that forces the pair to the new bit and its inverse, strongly enough to flip the latch.</li><li><strong>Port, in circuit terms:</strong> everything one access needs: an address input and decoder, a word line in every row, a bit line (or pair) in every column, and a sense amplifier or write driver at the bottom of each column. Every cell carries a piece of every port.</li></ul>
<div class="tbl"><svg viewBox="0 0 680 345" role="img" aria-label="What a cell is. Left: the RAT as a grid of 16 rows by 8 columns, 128 cells in all, one bit per cell. Row r3 holds p9 as the 8 bits 0000 1001, bit 7 on the left, one bit in each of its 8 cells. Its bit 0 cell, which holds 1, is highlighted and enlarged on the right. Right: inside that cell, a latch of two cross-coupled inverters. Inverter A takes Q = 1 and drives QB = 0. Inverter B takes QB = 0 and drives Q back to 1. Each inverter holds the other's input steady, so the bit stays put while the cell has power. Each inverter is 2 transistors, so the latch is 4. Ports later add transistors that connect Q and QB to word lines and bit lines.">
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">A cell stores one bit: the RAT is 128 of them</text>
<text x="10" y="40" style="fill:var(--ink);font-size:10px;font-weight:600">The RAT: 16 rows × 8 cells</text>
<text x="73" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">7</text>
<text x="99" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">6</text>
<text x="125" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">5</text>
<text x="151" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">4</text>
<text x="177" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">3</text>
<text x="203" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">2</text>
<text x="229" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">1</text>
<text x="255" y="67" text-anchor="middle" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="164" y="55" text-anchor="middle" style="fill:var(--muted);font-size:9px">bit</text>
<text x="55" y="81" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r0</text>
<rect x="60" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="72" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="93" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r1</text>
<rect x="60" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="84" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="105" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r2</text>
<rect x="60" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="96" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="117" text-anchor="end" style="fill:var(--pad);font-size:8px;font-family:var(--mono);font-weight:600">r3</text>
<rect x="60" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.2"/>
<text x="73" y="117.5" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0</text>
<rect x="86" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.2"/>
<text x="99" y="117.5" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0</text>
<rect x="112" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.2"/>
<text x="125" y="117.5" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0</text>
<rect x="138" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.2"/>
<text x="151" y="117.5" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0</text>
<rect x="164" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.2"/>
<text x="177" y="117.5" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">1</text>
<rect x="190" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.2"/>
<text x="203" y="117.5" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0</text>
<rect x="216" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.2"/>
<text x="229" y="117.5" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0</text>
<text x="55" y="129" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r4</text>
<rect x="60" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="120" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="141" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r5</text>
<rect x="60" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="132" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="153" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r6</text>
<rect x="60" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="144" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="165" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r7</text>
<rect x="60" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="156" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="177" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r8</text>
<rect x="60" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="168" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="189" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r9</text>
<rect x="60" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="180" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="201" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r10</text>
<rect x="60" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="192" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="213" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r11</text>
<rect x="60" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="204" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="225" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r12</text>
<rect x="60" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="216" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="237" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r13</text>
<rect x="60" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="228" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="249" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r14</text>
<rect x="60" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="240" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="55" y="261" text-anchor="end" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">r15</text>
<rect x="60" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="86" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="112" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="138" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="164" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="190" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="216" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="252" width="26" height="12" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<rect x="242" y="108" width="26" height="12" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.2"/>
<text x="255" y="117.5" text-anchor="middle" style="fill:var(--accent-green);font-size:9px;font-weight:600;font-family:var(--mono)">1</text>
<text x="10" y="284" style="fill:var(--muted);font-size:9.5px">Row r3 holds p9 = 0000 1001, one bit per cell.</text>
<text x="10" y="298" style="fill:var(--muted);font-size:9.5px">16 rows × 8 cells/row = 128 cells.</text>
<text x="10" y="312" style="fill:var(--accent-green);font-size:9.5px">Enlarged at right: r3, bit 0.</text>
<path d="M268,108 L400,62 M268,120 L400,212" style="fill:none;stroke:var(--accent-green);stroke-width:1;stroke-dasharray:3 3"/>
<rect x="400" y="62" width="220" height="150" rx="4" style="fill:none;stroke:var(--accent-green);stroke-width:1.2;stroke-dasharray:3 3"/>
<text x="400" y="40" style="fill:var(--ink);font-size:10px;font-weight:600">Inside one cell: the latch</text>
<path d="M440,105 V175 M580,105 V175" style="fill:none;stroke:var(--ink);stroke-width:1.5"/>
<path d="M440,105 H488 M546,105 H580" style="fill:none;stroke:var(--ink);stroke-width:1.5"/>
<path d="M488,87 L488,123 L536,105 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/><circle cx="541" cy="105" r="4.5" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<text x="510" y="80" text-anchor="middle" style="fill:var(--muted);font-size:9px">inverter A</text>
<path d="M580,175 H532 M474,175 H440" style="fill:none;stroke:var(--ink);stroke-width:1.5"/>
<path d="M532,157 L532,193 L484,175 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/><circle cx="479" cy="175" r="4.5" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<text x="510" y="206" text-anchor="middle" style="fill:var(--muted);font-size:9px">inverter B</text>
<circle cx="440" cy="140" r="3" style="fill:var(--ink)"/><circle cx="580" cy="140" r="3" style="fill:var(--ink)"/>
<text x="434" y="137" text-anchor="end" style="fill:var(--ink);font-size:10px;font-weight:600">Q</text>
<text x="434" y="151" text-anchor="end" style="fill:var(--accent-green);font-size:10px;font-weight:600;font-family:var(--mono)">1</text>
<text x="586" y="137" style="fill:var(--ink);font-size:10px;font-weight:600">QB</text>
<text x="586" y="151" style="fill:var(--accent-green);font-size:10px;font-weight:600;font-family:var(--mono)">0</text>
<text x="400" y="236" style="fill:var(--ink);font-size:9.5px">Inverter A turns Q = 1 into QB = 0.</text>
<text x="400" y="249" style="fill:var(--ink);font-size:9.5px">Inverter B turns QB = 0 back into Q = 1.</text>
<text x="400" y="267" style="fill:var(--muted);font-size:9.5px">Each holds the other&#39;s input steady, so the bit</text>
<text x="400" y="280" style="fill:var(--muted);font-size:9.5px">stays put as long as the cell has power.</text>
<text x="400" y="298" style="fill:var(--muted);font-size:9.5px">Each inverter is 2 transistors, so the latch is 4.</text>
<text x="400" y="316" style="fill:var(--muted);font-size:9.5px">Ports add transistors on Q and QB that connect</text>
<text x="400" y="329" style="fill:var(--muted);font-size:9.5px">the cell to word lines and bit lines (below).</text>
</svg></div>
<h3 id="sec-four-ports">One Instruction's Four Ports</h3>
<div class="tbl"><svg viewBox="0 0 680 400" role="img" aria-label="The four RAT ports used by one renamed instruction, r3 ← r1 + r12, in a 16-row by 8-bit SRAM RAT. Each port has its own 4-bit address input and its own 4-to-16 decoder. Every row carries four word lines, one per port, and every column carries four bit lines, one per port. Read port R0 decodes address 1 and raises its word line in row r1, R1 decodes 12 and raises its word line in row r12, and R2 decodes 3 and raises its word line in row r3. Each reads the 8 bits of its row onto its own 8 bit lines, which end at its own sense amplifiers and give psrc1, psrc2, and the old mapping that goes to the ROB. Write port W0 decodes 3 and raises its own word line in row r3 while its own write drivers put pnew on its own 8 bit lines. Because each port's decoder and lines reach all 16 rows, any port can access any row, and more architectural registers only add rows, a wider decoder, and longer lines, never more ports.">
<defs><marker id="arrP0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--accent-green)"/></marker><marker id="arrP1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--pad)"/></marker><marker id="arrP2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--redirect)"/></marker><marker id="arrP3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">One instruction's four ports: rename r3 ← r1 + r12</text>
<text x="10" y="34" style="fill:var(--muted);font-size:10px">Each port has its own address, decoder, word line in every row, and bit line in every column. A 4-wide renamer repeats this 4 times.</text>
<rect x="250" y="98" width="288" height="240" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<g style="fill:none;stroke:var(--rule);stroke-width:1"><path d="M250,113 H538"/><path d="M250,128 H538"/><path d="M250,143 H538"/><path d="M250,158 H538"/><path d="M250,173 H538"/><path d="M250,188 H538"/><path d="M250,203 H538"/><path d="M250,218 H538"/><path d="M250,233 H538"/><path d="M250,248 H538"/><path d="M250,263 H538"/><path d="M250,278 H538"/><path d="M250,293 H538"/><path d="M250,308 H538"/><path d="M250,323 H538"/><path d="M286,98 V338"/><path d="M322,98 V338"/><path d="M358,98 V338"/><path d="M394,98 V338"/><path d="M430,98 V338"/><path d="M466,98 V338"/><path d="M502,98 V338"/></g>
<g style="fill:none;stroke-width:0.6;opacity:0.25"><path d="M250,101 H538" style="stroke:var(--accent-green)"/><path d="M250,131 H538" style="stroke:var(--accent-green)"/><path d="M250,146 H538" style="stroke:var(--accent-green)"/><path d="M250,161 H538" style="stroke:var(--accent-green)"/><path d="M250,176 H538" style="stroke:var(--accent-green)"/><path d="M250,191 H538" style="stroke:var(--accent-green)"/><path d="M250,206 H538" style="stroke:var(--accent-green)"/><path d="M250,221 H538" style="stroke:var(--accent-green)"/><path d="M250,236 H538" style="stroke:var(--accent-green)"/><path d="M250,251 H538" style="stroke:var(--accent-green)"/><path d="M250,266 H538" style="stroke:var(--accent-green)"/><path d="M250,281 H538" style="stroke:var(--accent-green)"/><path d="M250,296 H538" style="stroke:var(--accent-green)"/><path d="M250,311 H538" style="stroke:var(--accent-green)"/><path d="M250,326 H538" style="stroke:var(--accent-green)"/><path d="M250,104 H538" style="stroke:var(--pad)"/><path d="M250,119 H538" style="stroke:var(--pad)"/><path d="M250,134 H538" style="stroke:var(--pad)"/><path d="M250,149 H538" style="stroke:var(--pad)"/><path d="M250,164 H538" style="stroke:var(--pad)"/><path d="M250,179 H538" style="stroke:var(--pad)"/><path d="M250,194 H538" style="stroke:var(--pad)"/><path d="M250,209 H538" style="stroke:var(--pad)"/><path d="M250,224 H538" style="stroke:var(--pad)"/><path d="M250,239 H538" style="stroke:var(--pad)"/><path d="M250,254 H538" style="stroke:var(--pad)"/><path d="M250,269 H538" style="stroke:var(--pad)"/><path d="M250,299 H538" style="stroke:var(--pad)"/><path d="M250,314 H538" style="stroke:var(--pad)"/><path d="M250,329 H538" style="stroke:var(--pad)"/><path d="M250,107 H538" style="stroke:var(--redirect)"/><path d="M250,122 H538" style="stroke:var(--redirect)"/><path d="M250,137 H538" style="stroke:var(--redirect)"/><path d="M250,167 H538" style="stroke:var(--redirect)"/><path d="M250,182 H538" style="stroke:var(--redirect)"/><path d="M250,197 H538" style="stroke:var(--redirect)"/><path d="M250,212 H538" style="stroke:var(--redirect)"/><path d="M250,227 H538" style="stroke:var(--redirect)"/><path d="M250,242 H538" style="stroke:var(--redirect)"/><path d="M250,257 H538" style="stroke:var(--redirect)"/><path d="M250,272 H538" style="stroke:var(--redirect)"/><path d="M250,287 H538" style="stroke:var(--redirect)"/><path d="M250,302 H538" style="stroke:var(--redirect)"/><path d="M250,317 H538" style="stroke:var(--redirect)"/><path d="M250,332 H538" style="stroke:var(--redirect)"/><path d="M250,110 H538" style="stroke:var(--trace)"/><path d="M250,125 H538" style="stroke:var(--trace)"/><path d="M250,140 H538" style="stroke:var(--trace)"/><path d="M250,170 H538" style="stroke:var(--trace)"/><path d="M250,185 H538" style="stroke:var(--trace)"/><path d="M250,200 H538" style="stroke:var(--trace)"/><path d="M250,215 H538" style="stroke:var(--trace)"/><path d="M250,230 H538" style="stroke:var(--trace)"/><path d="M250,245 H538" style="stroke:var(--trace)"/><path d="M250,260 H538" style="stroke:var(--trace)"/><path d="M250,275 H538" style="stroke:var(--trace)"/><path d="M250,290 H538" style="stroke:var(--trace)"/><path d="M250,305 H538" style="stroke:var(--trace)"/><path d="M250,320 H538" style="stroke:var(--trace)"/><path d="M250,335 H538" style="stroke:var(--trace)"/></g>
<g style="fill:none;stroke:var(--accent-green);stroke-width:1"><path d="M256,98 V344"/><path d="M292,98 V344"/><path d="M328,98 V344"/><path d="M364,98 V344"/><path d="M400,98 V344"/><path d="M436,98 V344"/><path d="M472,98 V344"/><path d="M508,98 V344"/></g>
<g style="fill:none;stroke:var(--pad);stroke-width:1;stroke-dasharray:5 3"><path d="M264,98 V352"/><path d="M300,98 V352"/><path d="M336,98 V352"/><path d="M372,98 V352"/><path d="M408,98 V352"/><path d="M444,98 V352"/><path d="M480,98 V352"/><path d="M516,98 V352"/></g>
<g style="fill:none;stroke:var(--redirect);stroke-width:1;stroke-dasharray:1.5 2"><path d="M272,98 V360"/><path d="M308,98 V360"/><path d="M344,98 V360"/><path d="M380,98 V360"/><path d="M416,98 V360"/><path d="M452,98 V360"/><path d="M488,98 V360"/><path d="M524,98 V360"/></g>
<g style="fill:none;stroke:var(--trace);stroke-width:1"><path d="M280,88 V338"/><path d="M316,88 V338"/><path d="M352,88 V338"/><path d="M388,88 V338"/><path d="M424,88 V338"/><path d="M460,88 V338"/><path d="M496,88 V338"/><path d="M532,88 V338"/></g>
<g style="fill:var(--muted);font-size:9px;font-family:var(--mono)" text-anchor="end"><text x="40" y="109">r0</text><text x="40" y="124">r1</text><text x="40" y="139">r2</text><text x="40" y="154">r3</text><text x="40" y="169">r4</text><text x="40" y="184">r5</text><text x="40" y="199">r6</text><text x="40" y="214">r7</text><text x="40" y="229">r8</text><text x="40" y="244">r9</text><text x="40" y="259">r10</text><text x="40" y="274">r11</text><text x="40" y="289">r12</text><text x="40" y="304">r13</text><text x="40" y="319">r14</text><text x="40" y="334">r15</text></g>
<text x="61" y="52" text-anchor="middle" style="fill:var(--accent-green);font-size:11px;font-weight:600">R0</text>
<text x="61" y="64" text-anchor="middle" style="fill:var(--ink);font-size:9px">rs1 = r1</text>
<text x="61" y="76" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0001</text>
<path d="M61,80 V96" style="fill:none;stroke:var(--accent-green);stroke-width:1.5" marker-end="url(#arrP0)"/>
<rect x="46" y="98" width="30" height="240" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.5"/>
<text transform="translate(65,218) rotate(-90)" text-anchor="middle" style="fill:var(--muted);font-size:9px">4→16 decoder</text>
<text x="111" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-weight:600">R1</text>
<text x="111" y="64" text-anchor="middle" style="fill:var(--ink);font-size:9px">rs2 = r12</text>
<text x="111" y="76" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">1100</text>
<path d="M111,80 V96" style="fill:none;stroke:var(--pad);stroke-width:1.5" marker-end="url(#arrP1)"/>
<rect x="96" y="98" width="30" height="240" rx="2" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.5"/>
<text transform="translate(115,218) rotate(-90)" text-anchor="middle" style="fill:var(--muted);font-size:9px">4→16 decoder</text>
<text x="161" y="52" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">R2</text>
<text x="161" y="64" text-anchor="middle" style="fill:var(--ink);font-size:9px">rd = r3</text>
<text x="161" y="76" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0011</text>
<path d="M161,80 V96" style="fill:none;stroke:var(--redirect);stroke-width:1.5" marker-end="url(#arrP2)"/>
<rect x="146" y="98" width="30" height="240" rx="2" style="fill:var(--surface);stroke:var(--redirect);stroke-width:1.5"/>
<text transform="translate(165,218) rotate(-90)" text-anchor="middle" style="fill:var(--muted);font-size:9px">4→16 decoder</text>
<text x="211" y="52" text-anchor="middle" style="fill:var(--trace);font-size:11px;font-weight:600">W0</text>
<text x="211" y="64" text-anchor="middle" style="fill:var(--ink);font-size:9px">rd = r3</text>
<text x="211" y="76" text-anchor="middle" style="fill:var(--ink);font-size:9px;font-family:var(--mono)">0011</text>
<path d="M211,80 V96" style="fill:none;stroke:var(--trace);stroke-width:1.5" marker-end="url(#arrP3)"/>
<rect x="196" y="98" width="30" height="240" rx="2" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text transform="translate(215,218) rotate(-90)" text-anchor="middle" style="fill:var(--muted);font-size:9px">4→16 decoder</text>
<path d="M76,116 H538" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="fill:var(--accent-green)"><circle cx="256" cy="116" r="2.2"/><circle cx="292" cy="116" r="2.2"/><circle cx="328" cy="116" r="2.2"/><circle cx="364" cy="116" r="2.2"/><circle cx="400" cy="116" r="2.2"/><circle cx="436" cy="116" r="2.2"/><circle cx="472" cy="116" r="2.2"/><circle cx="508" cy="116" r="2.2"/></g>
<path d="M126,284 H538" style="fill:none;stroke:var(--pad);stroke-width:2;stroke-dasharray:5 3"/>
<g style="fill:var(--pad)"><circle cx="264" cy="284" r="2.2"/><circle cx="300" cy="284" r="2.2"/><circle cx="336" cy="284" r="2.2"/><circle cx="372" cy="284" r="2.2"/><circle cx="408" cy="284" r="2.2"/><circle cx="444" cy="284" r="2.2"/><circle cx="480" cy="284" r="2.2"/><circle cx="516" cy="284" r="2.2"/></g>
<path d="M176,152 H538" style="fill:none;stroke:var(--redirect);stroke-width:2;stroke-dasharray:1.5 2"/>
<g style="fill:var(--redirect)"><circle cx="272" cy="152" r="2.2"/><circle cx="308" cy="152" r="2.2"/><circle cx="344" cy="152" r="2.2"/><circle cx="380" cy="152" r="2.2"/><circle cx="416" cy="152" r="2.2"/><circle cx="452" cy="152" r="2.2"/><circle cx="488" cy="152" r="2.2"/><circle cx="524" cy="152" r="2.2"/></g>
<path d="M226,155 H538" style="fill:none;stroke:var(--trace);stroke-width:2"/>
<g style="fill:var(--trace)"><circle cx="280" cy="155" r="2.2"/><circle cx="316" cy="155" r="2.2"/><circle cx="352" cy="155" r="2.2"/><circle cx="388" cy="155" r="2.2"/><circle cx="424" cy="155" r="2.2"/><circle cx="460" cy="155" r="2.2"/><circle cx="496" cy="155" r="2.2"/><circle cx="532" cy="155" r="2.2"/></g>
<rect x="250" y="84" width="288" height="4" style="fill:var(--trace)"/>
<text x="544" y="88" style="fill:var(--trace);font-size:9px;font-family:var(--mono)">W0 drivers ← pnew</text>
<rect x="250" y="344" width="288" height="4" style="fill:var(--accent-green)"/>
<text x="544" y="349" style="fill:var(--accent-green);font-size:9px;font-family:var(--mono)">R0 → psrc1</text>
<rect x="250" y="352" width="288" height="4" style="fill:var(--pad)"/>
<text x="544" y="357" style="fill:var(--pad);font-size:9px;font-family:var(--mono)">R1 → psrc2</text>
<rect x="250" y="360" width="288" height="4" style="fill:var(--redirect)"/>
<text x="544" y="365" style="fill:var(--redirect);font-size:9px;font-family:var(--mono)">R2 → pold to ROB</text>
<text x="544" y="124" style="fill:var(--ink);font-size:9px">← R0 reads row r1 (rs1)</text>
<text x="544" y="154" style="fill:var(--ink);font-size:9px">← R2 reads and W0 writes r3</text>
<text x="544" y="289" style="fill:var(--ink);font-size:9px">← R1 reads row r12 (rs2)</text>
<text x="544" y="207" style="fill:var(--muted);font-size:9px">Faint lines: the same</text><text x="544" y="219" style="fill:var(--muted);font-size:9px">ports' word lines in</text><text x="544" y="231" style="fill:var(--muted);font-size:9px">rows they didn't pick</text>
<text x="10" y="390" style="fill:var(--muted);font-size:10px">More architectural registers add rows: a wider decoder per port and longer bit lines. Ports come only from accesses per cycle.</text>
</svg></div>
<p>Each port has its own address input and decoder, its own word line along every row, and its own bit line down every column, so any port can reach any row. More rows don't add ports. AArch64's 31 rows need 5-bit addresses, 5-to-32 decoders, and bit lines about twice as long, but the same 16 ports.</p>
<h3 id="sec-decoder">Address Input and Decoder</h3>
<p>The renamer never searches the RAT. The architectural register number in an instruction field is already the row address. In x86-64 it is a 3-bit ModRM or opcode field plus one REX bit, 4 bits in all for 16 registers. Each port's address input is a 4-bit latch in the pipeline register between decode and rename, loaded at the start of the rename cycle. Slot 0's rs1 field goes to R0, rs2 to R1, and rd to both R2 and W0.</p>
<p>The decoder turns the 4 bits into 16 outputs, exactly one of them high (one-hot). Each output is a 4-input AND with one input per address bit: the bit itself where the row number has a 1 and its complement where it has a 0. Row r1 (0001) is ā3 · ā2 · ā1 · a0, so it is the only gate whose four inputs are all 1 when the address is 0001. Its output is R0's word line for row r1.</p>
<div class="tbl"><svg viewBox="0 0 680 410" role="img" aria-label="Read port R0's address input and decoder for slot 0, renaming r3 ← r1 + r12. The rs1 field of the instruction, 0001 for r1, is captured in R0's 4-bit address latch at the start of the cycle. Each latched bit drives two rails, the bit and its complement, giving eight rails. Sixteen 4-input AND gates, one per RAT row, each tap one rail per bit: row r taps a_i where bit i of r is 1 and the complement where it is 0. Only row r1's gate sees four high inputs, so only the r1 word line goes high. Every other gate taps at least one low rail. The output is one-hot: exactly one of the 16 word lines is raised, and it selects row r1 of the RAT.">
<defs><marker id="arrD" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Read port R0: address latch and 4→16 decoder</text>
<rect x="10" y="34" width="130" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="75" y="51" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-weight:600">slot 0: r3 ← r1 + r12</text>
<text x="75" y="68" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">rs1 field = 0001</text>
<path d="M140,56 H168" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrD)"/>
<rect x="170" y="40" width="160" height="32" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.5"/>
<text x="250" y="53" text-anchor="middle" style="fill:var(--ink);font-size:9px">R0 address latch</text>
<text x="190" y="66" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<text x="230" y="66" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<text x="270" y="66" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<text x="310" y="66" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<text x="180" y="88" text-anchor="middle" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">a3</text>
<path d="M180,96 V373" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<path d="M180,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="200" y="88" text-anchor="middle" style="fill:var(--accent-green);font-size:9px;font-family:var(--mono)">ā3</text>
<path d="M200,96 V373" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<path d="M200,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="220" y="88" text-anchor="middle" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">a2</text>
<path d="M220,96 V373" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<path d="M220,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="240" y="88" text-anchor="middle" style="fill:var(--accent-green);font-size:9px;font-family:var(--mono)">ā2</text>
<path d="M240,96 V373" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<path d="M240,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="260" y="88" text-anchor="middle" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">a1</text>
<path d="M260,96 V373" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<path d="M260,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="280" y="88" text-anchor="middle" style="fill:var(--accent-green);font-size:9px;font-family:var(--mono)">ā1</text>
<path d="M280,96 V373" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<path d="M280,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="300" y="88" text-anchor="middle" style="fill:var(--accent-green);font-size:9px;font-family:var(--mono)">a0</text>
<path d="M300,96 V373" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<path d="M300,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="320" y="88" text-anchor="middle" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">ā0</text>
<path d="M320,96 V373" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<path d="M320,72 V80" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<text x="166" y="113" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r0</text>
<path d="M174,110 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="200" cy="110" r="3" style="fill:var(--accent-green)"/>
<circle cx="240" cy="110" r="3" style="fill:var(--accent-green)"/>
<circle cx="280" cy="110" r="3" style="fill:var(--accent-green)"/>
<circle cx="320" cy="110" r="3" style="fill:var(--muted)"/>
<path d="M360,104 H368 A6,6 0 0 1 368,116 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,110 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="108" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="130" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r1</text>
<path d="M174,127 H360" style="fill:none;stroke:var(--accent-green);stroke-width:1.5"/>
<circle cx="200" cy="127" r="3" style="fill:var(--accent-green)"/>
<circle cx="240" cy="127" r="3" style="fill:var(--accent-green)"/>
<circle cx="280" cy="127" r="3" style="fill:var(--accent-green)"/>
<circle cx="300" cy="127" r="3" style="fill:var(--accent-green)"/>
<path d="M360,121 H368 A6,6 0 0 1 368,133 H360 Z" style="fill:var(--accent-green);stroke:var(--accent-green);stroke-width:1"/>
<path d="M374,127 H500" style="fill:none;stroke:var(--accent-green);stroke-width:2.5"/>
<text x="380" y="125" style="fill:var(--accent-green);font-size:8px;font-family:var(--mono)">1</text>
<text x="166" y="147" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r2</text>
<path d="M174,144 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="200" cy="144" r="3" style="fill:var(--accent-green)"/>
<circle cx="240" cy="144" r="3" style="fill:var(--accent-green)"/>
<circle cx="260" cy="144" r="3" style="fill:var(--muted)"/>
<circle cx="320" cy="144" r="3" style="fill:var(--muted)"/>
<path d="M360,138 H368 A6,6 0 0 1 368,150 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,144 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="142" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="164" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r3</text>
<path d="M174,161 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="200" cy="161" r="3" style="fill:var(--accent-green)"/>
<circle cx="240" cy="161" r="3" style="fill:var(--accent-green)"/>
<circle cx="260" cy="161" r="3" style="fill:var(--muted)"/>
<circle cx="300" cy="161" r="3" style="fill:var(--accent-green)"/>
<path d="M360,155 H368 A6,6 0 0 1 368,167 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,161 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="159" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="181" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r4</text>
<path d="M174,178 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="200" cy="178" r="3" style="fill:var(--accent-green)"/>
<circle cx="220" cy="178" r="3" style="fill:var(--muted)"/>
<circle cx="280" cy="178" r="3" style="fill:var(--accent-green)"/>
<circle cx="320" cy="178" r="3" style="fill:var(--muted)"/>
<path d="M360,172 H368 A6,6 0 0 1 368,184 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,178 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="176" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="198" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r5</text>
<path d="M174,195 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="200" cy="195" r="3" style="fill:var(--accent-green)"/>
<circle cx="220" cy="195" r="3" style="fill:var(--muted)"/>
<circle cx="280" cy="195" r="3" style="fill:var(--accent-green)"/>
<circle cx="300" cy="195" r="3" style="fill:var(--accent-green)"/>
<path d="M360,189 H368 A6,6 0 0 1 368,201 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,195 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="193" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="215" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r6</text>
<path d="M174,212 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="200" cy="212" r="3" style="fill:var(--accent-green)"/>
<circle cx="220" cy="212" r="3" style="fill:var(--muted)"/>
<circle cx="260" cy="212" r="3" style="fill:var(--muted)"/>
<circle cx="320" cy="212" r="3" style="fill:var(--muted)"/>
<path d="M360,206 H368 A6,6 0 0 1 368,218 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,212 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="210" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="232" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r7</text>
<path d="M174,229 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="200" cy="229" r="3" style="fill:var(--accent-green)"/>
<circle cx="220" cy="229" r="3" style="fill:var(--muted)"/>
<circle cx="260" cy="229" r="3" style="fill:var(--muted)"/>
<circle cx="300" cy="229" r="3" style="fill:var(--accent-green)"/>
<path d="M360,223 H368 A6,6 0 0 1 368,235 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,229 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="227" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="249" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r8</text>
<path d="M174,246 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="246" r="3" style="fill:var(--muted)"/>
<circle cx="240" cy="246" r="3" style="fill:var(--accent-green)"/>
<circle cx="280" cy="246" r="3" style="fill:var(--accent-green)"/>
<circle cx="320" cy="246" r="3" style="fill:var(--muted)"/>
<path d="M360,240 H368 A6,6 0 0 1 368,252 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,246 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="244" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="266" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r9</text>
<path d="M174,263 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="263" r="3" style="fill:var(--muted)"/>
<circle cx="240" cy="263" r="3" style="fill:var(--accent-green)"/>
<circle cx="280" cy="263" r="3" style="fill:var(--accent-green)"/>
<circle cx="300" cy="263" r="3" style="fill:var(--accent-green)"/>
<path d="M360,257 H368 A6,6 0 0 1 368,269 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,263 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="261" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="283" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r10</text>
<path d="M174,280 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="280" r="3" style="fill:var(--muted)"/>
<circle cx="240" cy="280" r="3" style="fill:var(--accent-green)"/>
<circle cx="260" cy="280" r="3" style="fill:var(--muted)"/>
<circle cx="320" cy="280" r="3" style="fill:var(--muted)"/>
<path d="M360,274 H368 A6,6 0 0 1 368,286 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,280 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="278" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="300" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r11</text>
<path d="M174,297 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="297" r="3" style="fill:var(--muted)"/>
<circle cx="240" cy="297" r="3" style="fill:var(--accent-green)"/>
<circle cx="260" cy="297" r="3" style="fill:var(--muted)"/>
<circle cx="300" cy="297" r="3" style="fill:var(--accent-green)"/>
<path d="M360,291 H368 A6,6 0 0 1 368,303 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,297 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="295" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="317" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r12</text>
<path d="M174,314 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="314" r="3" style="fill:var(--muted)"/>
<circle cx="220" cy="314" r="3" style="fill:var(--muted)"/>
<circle cx="280" cy="314" r="3" style="fill:var(--accent-green)"/>
<circle cx="320" cy="314" r="3" style="fill:var(--muted)"/>
<path d="M360,308 H368 A6,6 0 0 1 368,320 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,314 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="312" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="334" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r13</text>
<path d="M174,331 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="331" r="3" style="fill:var(--muted)"/>
<circle cx="220" cy="331" r="3" style="fill:var(--muted)"/>
<circle cx="280" cy="331" r="3" style="fill:var(--accent-green)"/>
<circle cx="300" cy="331" r="3" style="fill:var(--accent-green)"/>
<path d="M360,325 H368 A6,6 0 0 1 368,337 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,331 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="329" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="351" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r14</text>
<path d="M174,348 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="348" r="3" style="fill:var(--muted)"/>
<circle cx="220" cy="348" r="3" style="fill:var(--muted)"/>
<circle cx="260" cy="348" r="3" style="fill:var(--muted)"/>
<circle cx="320" cy="348" r="3" style="fill:var(--muted)"/>
<path d="M360,342 H368 A6,6 0 0 1 368,354 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,348 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="346" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="166" y="368" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r15</text>
<path d="M174,365 H360" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<circle cx="180" cy="365" r="3" style="fill:var(--muted)"/>
<circle cx="220" cy="365" r="3" style="fill:var(--muted)"/>
<circle cx="260" cy="365" r="3" style="fill:var(--muted)"/>
<circle cx="300" cy="365" r="3" style="fill:var(--accent-green)"/>
<path d="M360,359 H368 A6,6 0 0 1 368,371 H360 Z" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<path d="M374,365 H500" style="fill:none;stroke:var(--muted);stroke-width:1;opacity:0.6"/>
<text x="380" y="363" style="fill:var(--muted);font-size:8px;font-family:var(--mono)">0</text>
<text x="367" y="100" text-anchor="middle" style="fill:var(--muted);font-size:9px">AND</text>
<text x="430" y="100" text-anchor="middle" style="fill:var(--muted);font-size:9px">R0 word lines</text>
<rect x="500" y="102" width="60" height="271" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<rect x="500" y="119" width="60" height="17" style="fill:var(--trace-soft);stroke:var(--accent-green);stroke-width:1.5"/>
<text x="530" y="131" text-anchor="middle" style="fill:var(--ink);font-size:9px">row r1</text>
<text x="530" y="246" text-anchor="middle" style="fill:var(--muted);font-size:9px">RAT</text><text x="530" y="258" text-anchor="middle" style="fill:var(--muted);font-size:9px">16 rows</text>
<text x="572" y="126" style="fill:var(--ink);font-size:9px">Only r1 sees 1 on</text>
<text x="572" y="138" style="fill:var(--ink);font-size:9px">all four inputs</text>
<text x="572" y="195" style="fill:var(--muted);font-size:9px">Every other row taps</text>
<text x="572" y="207" style="fill:var(--muted);font-size:9px">at least one 0 rail</text>
<text x="572" y="219" style="fill:var(--muted);font-size:9px">(gray dot), so its</text>
<text x="572" y="231" style="fill:var(--muted);font-size:9px">word line stays low</text>
<text x="572" y="297" style="fill:var(--muted);font-size:9px">31 registers: 5 bits,</text>
<text x="572" y="309" style="fill:var(--muted);font-size:9px">10 rails, 32 gates</text>
<text x="572" y="321" style="fill:var(--muted);font-size:9px">of 5 inputs each</text>
<text x="10" y="397" style="fill:var(--muted);font-size:10px">Colored: 1. Gray: 0. Dots: the rail each gate taps. Row r taps aᵢ where bit i of r is 1 and āᵢ where it is 0. R1, R2, and W0 each have a copy of all this.</text>
</svg></div>
<ul><li><strong>Size grows with rows:</strong> k address bits need 2k rails and 2<sup>k</sup> gates of k inputs. 16 registers need 4 bits and 16 gates of 4 inputs. AArch64's 31 registers need 5 bits and 32 gates of 5 inputs (encoding 31 names SP or XZR, which isn't a renamed row).</li><li><strong>Delay grows slowly:</strong> real decoders predecode. Two 2-to-4 predecoders turn the 4 bits into two one-hot groups of 4 lines, and each row ANDs one line from each group with a 2-input gate. A buffer chain then drives the word line, sized for its load of one access transistor per column. Doubling the rows adds one address bit, which adds at most about one gate level.</li><li><strong>One decoder per port:</strong> a 4-wide renamer has 16 decoders, each a full 4-to-16 copy. R2 and W0 both decode 0011, and each raises its own word line in row r3, so they don't conflict. R2 reads the old mapping early in the cycle and W0 writes the new one at the end (see <a href="#/renaming/same-group">Same-Group Dependences</a>).</li></ul>
<h3 id="sec-word-bit-lines">Word Lines and Bit Lines</h3>
<p>A port's decoder raises exactly one of its word lines, so each of its bit lines sees exactly one cell, the one in the selected row. That is why a port does one access per cycle, and why a second access in the same cycle needs a second word line in every row and a second bit line in every column. <a href="#/cache-banking/why">Why Caches Are Banked</a> covers how wire length sets the delay of both.</p>
<div class="tbl"><svg viewBox="0 0 680 450" role="img" aria-label="Word lines and bit lines. Left: one port's wires in a 4-row by 4-column corner of the RAT. Each row's cells store the low 4 bits of its physical register number, columns ordered bit 3 to bit 0: r0 holds p3 (0011), r1 p7 (0111), r2 p8 (1000), and r3 p9 (1001). Each row has a word line running across every column, driven by the port's decoder, and each column has a bit line running down every row to the port's sense amplifier. R0's decoder raises the word line of row r1, so every cell in row r1 connects to its column's bit line, and the sense amplifiers read r1's bits, 0 1 1 1, while rows r0, r2, and r3 stay disconnected. Right: one RAT bit cell with one write port and one read port. Four transistors in two cross-coupled inverters hold the bit Q and its complement QB. The W0 word line gates two access transistors that connect Q and QB to the W0 bit line pair, WBL and WBLB, which the write drivers force to the new value. The R0 word line gates one transistor in a two-transistor stack from the R0 bit line, RBL, to ground. The other transistor in the stack is gated by QB. RBL starts high, and when R0's word line rises it is pulled low if the cell holds 0 and stays high if it holds 1.">
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Word lines select a row, bit lines carry a column's bit</text>
<text x="10" y="36" style="fill:var(--ink);font-size:10px;font-weight:600">One port (R0) in a 4 × 4 corner of the RAT</text>
<rect x="22" y="68" width="26" height="152" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.5"/>
<text transform="translate(39,144) rotate(-90)" text-anchor="middle" style="fill:var(--muted);font-size:9px">R0 decoder</text>
<text x="76" y="72" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r0</text>
<text x="76" y="112" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r1</text>
<text x="76" y="152" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r2</text>
<text x="76" y="192" text-anchor="end" style="fill:var(--muted);font-size:9px;font-family:var(--mono)">r3</text>
<path d="M124,62 V234" style="fill:none;stroke:var(--accent-green);stroke-width:1.5"/>
<rect x="112" y="234" width="24" height="16" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.2"/><text x="124" y="245" text-anchor="middle" style="fill:var(--muted);font-size:8px">SA</text>
<text x="124" y="266" text-anchor="middle" style="fill:var(--accent-green);font-size:11px;font-weight:600;font-family:var(--mono)">0</text>
<text x="110" y="58" text-anchor="middle" style="fill:var(--muted);font-size:9px">bit 3</text>
<path d="M174,62 V234" style="fill:none;stroke:var(--accent-green);stroke-width:1.5"/>
<rect x="162" y="234" width="24" height="16" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.2"/><text x="174" y="245" text-anchor="middle" style="fill:var(--muted);font-size:8px">SA</text>
<text x="174" y="266" text-anchor="middle" style="fill:var(--accent-green);font-size:11px;font-weight:600;font-family:var(--mono)">1</text>
<text x="160" y="58" text-anchor="middle" style="fill:var(--muted);font-size:9px">bit 2</text>
<path d="M224,62 V234" style="fill:none;stroke:var(--accent-green);stroke-width:1.5"/>
<rect x="212" y="234" width="24" height="16" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.2"/><text x="224" y="245" text-anchor="middle" style="fill:var(--muted);font-size:8px">SA</text>
<text x="224" y="266" text-anchor="middle" style="fill:var(--accent-green);font-size:11px;font-weight:600;font-family:var(--mono)">1</text>
<text x="210" y="58" text-anchor="middle" style="fill:var(--muted);font-size:9px">bit 1</text>
<path d="M274,62 V234" style="fill:none;stroke:var(--accent-green);stroke-width:1.5"/>
<rect x="262" y="234" width="24" height="16" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.2"/><text x="274" y="245" text-anchor="middle" style="fill:var(--muted);font-size:8px">SA</text>
<text x="274" y="266" text-anchor="middle" style="fill:var(--accent-green);font-size:11px;font-weight:600;font-family:var(--mono)">1</text>
<text x="260" y="58" text-anchor="middle" style="fill:var(--muted);font-size:9px">bit 0</text>
<path d="M48,76 H290" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<rect x="94" y="70" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="107" y="92" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M120,84 H122" style="stroke:var(--muted);stroke-width:1"/>
<rect x="144" y="70" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="157" y="92" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M170,84 H172" style="stroke:var(--muted);stroke-width:1"/>
<rect x="194" y="70" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="207" y="92" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M220,84 H222" style="stroke:var(--muted);stroke-width:1"/>
<rect x="244" y="70" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="257" y="92" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M270,84 H272" style="stroke:var(--muted);stroke-width:1"/>
<path d="M48,116 H290" style="fill:none;stroke:var(--accent-green);stroke-width:2.5"/>
<rect x="94" y="110" width="26" height="26" rx="2" style="fill:var(--trace-soft);stroke:var(--accent-green);stroke-width:1"/>
<text x="107" y="132" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M120,124 H124" style="stroke:var(--accent-green);stroke-width:2"/><circle cx="124" cy="124" r="2.5" style="fill:var(--accent-green)"/>
<rect x="144" y="110" width="26" height="26" rx="2" style="fill:var(--trace-soft);stroke:var(--accent-green);stroke-width:1"/>
<text x="157" y="132" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M170,124 H174" style="stroke:var(--accent-green);stroke-width:2"/><circle cx="174" cy="124" r="2.5" style="fill:var(--accent-green)"/>
<rect x="194" y="110" width="26" height="26" rx="2" style="fill:var(--trace-soft);stroke:var(--accent-green);stroke-width:1"/>
<text x="207" y="132" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M220,124 H224" style="stroke:var(--accent-green);stroke-width:2"/><circle cx="224" cy="124" r="2.5" style="fill:var(--accent-green)"/>
<rect x="244" y="110" width="26" height="26" rx="2" style="fill:var(--trace-soft);stroke:var(--accent-green);stroke-width:1"/>
<text x="257" y="132" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M270,124 H274" style="stroke:var(--accent-green);stroke-width:2"/><circle cx="274" cy="124" r="2.5" style="fill:var(--accent-green)"/>
<path d="M48,156 H290" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<rect x="94" y="150" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="107" y="172" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M120,164 H122" style="stroke:var(--muted);stroke-width:1"/>
<rect x="144" y="150" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="157" y="172" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M170,164 H172" style="stroke:var(--muted);stroke-width:1"/>
<rect x="194" y="150" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="207" y="172" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M220,164 H222" style="stroke:var(--muted);stroke-width:1"/>
<rect x="244" y="150" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="257" y="172" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M270,164 H272" style="stroke:var(--muted);stroke-width:1"/>
<path d="M48,196 H290" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<rect x="94" y="190" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="107" y="212" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M120,204 H122" style="stroke:var(--muted);stroke-width:1"/>
<rect x="144" y="190" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="157" y="212" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M170,204 H172" style="stroke:var(--muted);stroke-width:1"/>
<rect x="194" y="190" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="207" y="212" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">0</text>
<path d="M220,204 H222" style="stroke:var(--muted);stroke-width:1"/>
<rect x="244" y="190" width="26" height="26" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="257" y="212" text-anchor="middle" style="fill:var(--ink);font-size:10px;font-family:var(--mono)">1</text>
<path d="M270,204 H272" style="stroke:var(--muted);stroke-width:1"/>
<text x="294" y="119" style="fill:var(--accent-green);font-size:9px">word line</text>
<text x="294" y="131" style="fill:var(--accent-green);font-size:9px">high</text>
<text x="294" y="246" style="fill:var(--accent-green);font-size:9px">bit lines</text>
<text x="294" y="266" style="fill:var(--accent-green);font-size:9px">= r1 (p7)</text>
<text x="10" y="290" style="fill:var(--muted);font-size:9.5px">Word line: a wire along one row, through every</text>
<text x="10" y="303" style="fill:var(--muted);font-size:9.5px">column. High connects that row's cells to</text>
<text x="10" y="316" style="fill:var(--muted);font-size:9.5px">this port’s bit lines.</text>
<text x="10" y="329" style="fill:var(--muted);font-size:9.5px">Bit line: a wire down one column, past every row.</text>
<text x="10" y="342" style="fill:var(--muted);font-size:9.5px">It carries the bit of the one row whose word line</text>
<text x="10" y="355" style="fill:var(--muted);font-size:9.5px">is high, so a port does one access per cycle.</text>
<text x="10" y="375" style="fill:var(--muted);font-size:9.5px">Each row stores its physical register number.</text>
<text x="10" y="388" style="fill:var(--muted);font-size:9.5px">Shown: the low 4 of its 8 bits, bit 3 on the left.</text>
<path d="M328,30 V440" style="stroke:var(--rule);stroke-width:1"/>
<text x="340" y="36" style="fill:var(--ink);font-size:10px;font-weight:600">Inside one bit cell: write port W0 and read port R0</text>
<path d="M340,72 H670" style="fill:none;stroke:var(--trace);stroke-width:2.5"/>
<text x="372" y="67" style="fill:var(--trace);font-size:9px">W0 word line (WWL)</text>
<path d="M340,300 H670" style="fill:none;stroke:var(--accent-green);stroke-width:2.5"/>
<text x="372" y="313" style="fill:var(--accent-green);font-size:9px">R0 word line (RWL)</text>
<path d="M360,58 V330" style="fill:none;stroke:var(--trace);stroke-width:2"/>
<path d="M566,58 V330" style="fill:none;stroke:var(--trace);stroke-width:2"/>
<path d="M650,58 V330" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<text x="360" y="345" text-anchor="middle" style="fill:var(--trace);font-size:9px;font-family:var(--mono)">WBL</text>
<text x="566" y="345" text-anchor="middle" style="fill:var(--trace);font-size:9px;font-family:var(--mono)">WBLB</text>
<text x="650" y="345" text-anchor="middle" style="fill:var(--accent-green);font-size:9px;font-family:var(--mono)">RBL</text>
<text x="463" y="53" text-anchor="middle" style="fill:var(--trace);font-size:9px">W0 write drivers: new bit on WBL, its inverse on WBLB</text>
<text x="650" y="362" text-anchor="end" style="fill:var(--accent-green);font-size:9px">→ R0 sense amp</text>
<text x="463" y="362" text-anchor="middle" style="fill:var(--trace);font-size:9px">W0 bit line pair</text>
<rect x="424" y="112" width="68" height="78" rx="4" style="fill:none;stroke:var(--rule);stroke-dasharray:3 3"/>
<path d="M442,119 L442,141 L470,130 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/><circle cx="473" cy="130" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M474,161 L474,183 L446,172 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/><circle cx="443" cy="172" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M416,130 H442 M476,130 H500 M500,172 H477 M440,172 H416 M416,130 V172 M500,130 V172" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<text x="458" y="204" text-anchor="middle" style="fill:var(--muted);font-size:9px">latch: 4 transistors</text>
<text x="412" y="126" text-anchor="end" style="fill:var(--ink);font-size:9px;font-weight:600">Q</text>
<text x="504" y="126" text-anchor="start" style="fill:var(--ink);font-size:9px;font-weight:600">QB</text>
<path d="M360,151 H372 M398,151 H416" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M372,151 H378 V146 M398,151 H392 V146 M375,146 H395" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M378,142 H392" style="fill:none;stroke:var(--trace);stroke-width:1.8"/>
<path d="M385,142 V72" style="fill:none;stroke:var(--trace);stroke-width:1.3"/>
<circle cx="360" cy="151" r="2.5" style="fill:var(--trace)"/>
<circle cx="416" cy="151" r="2.5" style="fill:var(--ink)"/>
<circle cx="385" cy="72" r="2.5" style="fill:var(--trace)"/>
<path d="M500,151 H526 M552,151 H566" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M526,151 H532 V146 M552,151 H546 V146 M529,146 H549" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M532,142 H546" style="fill:none;stroke:var(--trace);stroke-width:1.8"/>
<path d="M539,142 V72" style="fill:none;stroke:var(--trace);stroke-width:1.3"/>
<circle cx="566" cy="151" r="2.5" style="fill:var(--trace)"/>
<circle cx="500" cy="151" r="2.5" style="fill:var(--ink)"/>
<circle cx="539" cy="72" r="2.5" style="fill:var(--trace)"/>
<path d="M650,258 H644" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M618,258 H624 V263 M644,258 H638 V263 M621,263 H641" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M624,267 H638" style="fill:none;stroke:var(--accent-green);stroke-width:1.8"/>
<path d="M631,267 V300" style="fill:none;stroke:var(--accent-green);stroke-width:1.3"/>
<circle cx="650" cy="258" r="2.5" style="fill:var(--accent-green)"/>
<circle cx="631" cy="300" r="2.5" style="fill:var(--accent-green)"/>
<path d="M618,258 H612" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M586,258 H592 V253 M612,258 H606 V253 M589,253 H609" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M592,249 H606" style="fill:none;stroke:var(--ink);stroke-width:1.8"/>
<path d="M599,249 V228" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M500,172 V228 H599" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<circle cx="500" cy="172" r="2.5" style="fill:var(--ink)"/>
<path d="M586,258 H580 V266 M572,266 H588 M575,270 H585 M578,274 H582" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<text x="604" y="222" text-anchor="middle" style="fill:var(--muted);font-size:9px">gate: QB</text>
<text x="340" y="384" style="fill:var(--accent-green);font-size:9px">Read: RBL starts high, then R0 raises RWL.</text>
<text x="340" y="397" style="fill:var(--accent-green);font-size:9px">Q = 0, so QB = 1: both on, RBL falls.</text>
<text x="340" y="410" style="fill:var(--accent-green);font-size:9px">Q = 1, so QB = 0: stack off, RBL stays high.</text>
<text x="340" y="423" style="fill:var(--trace);font-size:9px">Write: WWL high lets the drivers on WBL</text>
<text x="340" y="436" style="fill:var(--trace);font-size:9px">and WBLB overpower the latch and flip Q.</text>
</svg></div>
<ul><li><strong>Read port:</strong> the bit line is precharged high. The port's word line turns on the top transistor of a two-transistor stack, and the stored bit decides whether the bottom one conducts. If the cell holds 0, the stack pulls the bit line low, and if it holds 1, the bit line stays high. The latch only drives a transistor gate, so 12 ports can read the same cell in one cycle without disturbing it or each other.</li><li><strong>Write port:</strong> the driver puts the new bit on one bit line and its inverse on the other, and the word line turns on two access transistors that connect them to Q and QB. The drivers are stronger than the latch, so they flip it. A write port therefore has a bit line pair, not a single bit line.</li></ul>
<p>Per cell, the 4-wide RAT's 16 ports add up to:</p>
<ul><li>Word lines: 12 read ports × 1 word line/port + 4 write ports × 1 word line/port = 16 word lines.</li><li>Bit lines: 12 read ports × 1 bit line/port + 4 write ports × 2 bit lines/port = 20 bit lines.</li><li>Transistors: 4 latch transistors + 12 read ports × 2 transistors/port + 4 write ports × 2 transistors/port = 36 transistors, against 6 for a single-ported SRAM cell.</li></ul>
<p>The cell is 16 wire tracks tall and 20 wide, which is why its area grows about as the square of the port count. Nothing in it depends on the number of rows. AArch64's 31 rows use the same cell, just more of them, with each bit line passing 31 cells instead of 16 and so carrying about twice the capacitance.</p>
<p><a href="#/rename-cost">What Renaming Costs</a> scales this per-cell growth up to wider renamers and compares it with the CAM form.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide renamer (Golden Cove's rename width) uses an SRAM RAT built from the cell on this page. Count the word lines, bit lines, and transistors in one cell for two designs:</p><ol><li>Old mappings read at rename: 3 read ports per instruction and 1 write port per instruction.</li><li>Old mappings read from a retirement RAT at commit: 2 read ports per instruction and 1 write port per instruction.</li></ol><p>Then estimate how much smaller the second cell is.</p><p class="given">Assume a read port is a two-transistor stack on 1 word line and 1 bit line, a write port is 2 access transistors on 1 word line and a bit line pair, the latch is 4 transistors, and cell area is set by the port tracks alone (word lines set the height, bit lines the width).</p>`,
        a: `<ol><li>Design 1 ports: 3 read ports/instruction × 6 instructions = 18 read ports, and 1 write port/instruction × 6 instructions = 6 write ports.</li><li>Design 1 word lines: 18 read ports × 1 word line/port + 6 write ports × 1 word line/port = 24 word lines.</li><li>Design 1 bit lines: 18 read ports × 1 bit line/port + 6 write ports × 2 bit lines/port = 30 bit lines.</li><li>Design 1 transistors: 4 latch transistors + 18 read ports × 2 transistors/port + 6 write ports × 2 transistors/port = 52 transistors.</li><li>Design 2 ports: 2 read ports/instruction × 6 instructions = 12 read ports, still 6 write ports.</li><li>Design 2 word lines: 12 read ports × 1 word line/port + 6 write ports × 1 word line/port = 18 word lines.</li><li>Design 2 bit lines: 12 read ports × 1 bit line/port + 6 write ports × 2 bit lines/port = 24 bit lines.</li><li>Design 2 transistors: 4 latch transistors + 12 read ports × 2 transistors/port + 6 write ports × 2 transistors/port = 40 transistors.</li><li>Area: (24 tracks × 30 tracks) / (18 tracks × 24 tracks) = 720 tracks² / 432 tracks² ≈ <strong>1.67×</strong>. Dropping a quarter of the ports cuts the cell area by about 40%, because both of its sides shrink.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Twelve read ports can read the same RAT cell in one cycle without trouble. Why can't two write ports write the same row in one cycle, and how does the renamer make sure it never has to?</p>`,
        a: `<p>A read port only drives a transistor gate from the latch, so any number of ports can sense the stored bit without loading it. A write works by overpowering the latch: the write port's drivers pull Q and QB through the access transistors hard enough to flip the cross-coupled inverters. Two write ports on the same row would each drive their own bit line pair into the same latch. If their bits differ, the drivers fight, the final value depends on transistor strengths and timing, and the contention burns current through both drivers. Even with equal bits the result is only safe by luck, so the design rule is one writer per row per cycle.</p><p>The renamer guarantees it with the same-group write check. Two slots in a group can name the same destination register, so a WAW match between a slot and any younger slot suppresses the older slot's write enable. Only the youngest writer drives the row, and the older slot's new physical register still goes into its own ROB entry and the younger slot's old mapping (see <a href="#/renaming/same-group">Same-Group Dependences</a>).</p>`
      }
    ]
  }
},

{
  id: "rename-cost",
  region: "ren",
  title: "What Renaming Costs",
  sections: [
    { id: "rat-cost", label: "SRAM and CAM Costs" },
    { id: "port-workarounds", label: "Cutting Port Costs" },
    { id: "model", label: "Putting It Into a Model" }
  ],
  body: `
<h3 id="sec-rat-cost">What Renaming Costs</h3>
<p>Let W be the rename width, A the number of architectural registers, and P the PRF size. The examples use the 4-wide x86-64 renamer from <a href="#/rat-design">Building the RAT</a> and <a href="#/rat-circuit">Inside the RAT Circuit</a>: W = 4 instructions/cycle, A = 16 registers, P = 192 registers.</p>
<h4>SRAM RAT (A Rows)</h4>
<div class="tbl"><table>
<tr><th>Cost</th><th>SRAM RAT</th><th>Calculation Example</th></tr>
<tr><td><strong>Storage</strong></td><td>A × ⌈log₂ P⌉ bits: one row per architectural register, each holding a physical register number. Small, so storage is never the problem.</td><td>16 rows × ⌈log₂ 192⌉ bits/row = 16 rows × 8 bits/row = 128 bits</td></tr>
<tr><td><strong>Ports</strong></td><td>3W read ports (2W sources plus W destinations' old mappings) and W write ports (one per new destination mapping). Each row has only one field, the physical register number, so the count comes entirely from how many rows are accessed in one cycle. Two reads of the same row in one cycle still need two ports.</td><td><ul><li>Read: 3 reads/instruction × 4 instructions = 12 read ports</li><li>Write: 1 write/instruction × 4 instructions = 4 write ports</li><li>Total: 12 ports + 4 ports = 16 ports</li></ul></td></tr>
<tr><td><strong>Area</strong></td><td>A multiported cell's area is set by its wires, not its transistors. Each port runs its own word line across the cell (one horizontal wire track) and its own bit lines down it (vertical tracks): 1 for a read port, a pair for a write port (see <a href="#/rat-circuit/word-bit-lines">Word Lines and Bit Lines</a>). With h₀ and w₀ the few tracks the latch needs on its own and 3W read plus W write ports:<ul><li>Height: h₀ + 3W + W = h₀ + 4W tracks</li><li>Width: w₀ + 3W + 2W = w₀ + 5W tracks</li><li>Area: (h₀ + 4W) × (w₀ + 5W) tracks², times the square of the wire pitch</li></ul>So area is not proportional to the port count. Both sides grow linearly with the ports, so the area grows with their product. Once the port tracks dwarf h₀ and w₀ (already true at 16 ports), it approaches 20W² tracks², the square of the width. With only a few ports the latch dominates and growth is closer to linear. The constants vary by implementation, but the square does not:<ul><li>Differential read ports use a bit line pair, making the width w₀ + 2 × 3W + 2W.</li><li>Single-ended write ports use one bit line.</li><li>Splitting the reads across two copies of the table gives each copy fewer ports, trading a second copy for smaller cells.</li></ul>Rows add area only linearly, and there are only A of them, so the ports set the area.</td><td><ul><li>4-wide: (12 read ports × 1 word line/port + 4 write ports × 1 word line/port) × (12 read ports × 1 bit line/port + 4 write ports × 2 bit lines/port) = 16 tracks × 20 tracks = 320 tracks²</li><li>6-wide: (18 read ports × 1 word line/port + 6 write ports × 1 word line/port) × (18 read ports × 1 bit line/port + 6 write ports × 2 bit lines/port) = 24 tracks × 30 tracks = 720 tracks²</li><li>Growth: 720 tracks² / 320 tracks² = 2.25×, the same as (24 ports / 16 ports)², because the read/write mix is fixed and both sides scale with W</li><li>These ignore h₀ and w₀. Including the latch's own tracks makes the growth a little smaller.</li></ul></td></tr>
<tr><td><strong>Energy</strong></td><td>A read drives one wordline and the bitlines of one row, so energy per access barely depends on A.</td><td>12 reads/cycle × 1 row/read = 12 row reads/cycle, each of 8 bits</td></tr>
<tr><td><strong>Same-group comparators</strong></td><td>Compare architectural register names, not RAT contents, so the count is the same as for the CAM RAT. Each is ⌈log₂ A⌉ bits wide.<ul><li>Source checks: slot i compares each of its 2 sources with i older destinations, so 2 × (0 + 1 + … + (W − 1)) = W(W − 1) comparators.</li><li>Destination checks: one per pair of slots, W(W − 1)/2 comparators, shared by the old-mapping and WAW checks.</li></ul>A WAW match suppresses the older slot's RAT write.</td><td><ul><li>Source: 4 slots × 3 slots = 12 comparators</li><li>Destination: 4 slots × 3 slots / 2 = 6 comparators</li><li>Total: 12 comparators + 6 comparators = 18 comparators, each ⌈log₂ 16⌉ = 4 bits wide</li></ul></td></tr>
<tr><td><strong>Delay</strong></td><td>Address decode, then a wordline and bitline read across A rows. A is small and fixed by the ISA, so the read stays short as the core grows.</td><td>⌈log₂ 16⌉ = 4 address bits decoded to 16 wordlines, and bitlines that span 16 rows</td></tr>
<tr><td><strong>Priority mux</strong></td><td>The comparisons overlap the RAT read, but the mux after them has W inputs for the youngest slot and sits on the critical path. Its depth grows with log₂ W, and its wiring grows with W².</td><td>Slot 3: 3 older-slot registers + 1 RAT read = 4 inputs, log₂ 4 = 2 levels of 2-to-1 muxes</td></tr>
<tr><td><strong>Checkpoints</strong></td><td>A full copy of the RAT, A × ⌈log₂ P⌉ bits. A mid-group branch needs the RAT plus only the older slots' writes, so checkpoint logic must see the per-slot write enables.</td><td>16 rows × 8 bits/row = 128 bits per checkpoint</td></tr>
</table></div>
<h4>CAM RAT (P Rows)</h4>
<div class="tbl"><table>
<tr><th>Cost</th><th>CAM RAT</th><th>Calculation Example</th></tr>
<tr><td><strong>Storage</strong></td><td>P × (⌈log₂ A⌉ + 1) bits: one row per physical register, holding an architectural register name plus a valid bit. Larger than the SRAM RAT, but still small.</td><td>192 rows × (⌈log₂ 16⌉ + 1) bits/row = 192 rows × 5 bits/row = 960 bits</td></tr>
<tr><td><strong>Ports</strong></td><td>The port count comes from how many different rows are read or written in one cycle (or, for searches, how many different keys are compared), not from how many fields each row has. Fields written together in one row share one port. A port only has to run through the columns it touches, so it can be narrower than the row.<ul><li>3W search ports: 2W sources, plus W destinations whose match gives the old register.</li><li>W write ports: each writes the name and sets the valid bit of the new row. Two fields, one row, one port.</li><li>W valid-clear ports: each clears the valid bit of the old row. That is a different row in the same cycle, so it needs its own port, but only 1 bit wide. The destination search's match line, gated by a clear enable, can drive it, so it needs no decoder.</li></ul></td><td><ul><li>Search: 3 searches/instruction × 4 instructions = 12 search ports</li><li>Write (name + valid set): 1 row/instruction × 4 instructions = 4 write ports, each ⌈log₂ 16⌉ + 1 = 5 bits wide</li><li>Valid clear: 1 row/instruction × 4 instructions = 4 clear ports, each 1 bit wide</li><li>Example in one cycle: renaming r1 → p40 writes r1 and valid = 1 into row p40 through one write port, and clears row p7's valid bit through one clear port</li></ul></td></tr>
<tr><td><strong>Area</strong></td><td>The cell is counted in wire tracks as in the SRAM RAT. Each search port adds a search-line pair down every column (the key bit and its inverse) and a match line across every row. Each write port adds a word line and a bit line pair. For a name cell with 3W search and W write ports:<ul><li>Height: h₀ + 3W + W = h₀ + 4W tracks</li><li>Width: w₀ + 2 × 3W + 2W = w₀ + 8W tracks</li></ul>It too approaches the square of the width, at 32W² tracks², and its per-port compare transistors make it larger still. But every search port also needs a ⌈log₂ A⌉-bit comparator in every row, 3W × P in all, plus a P-to-⌈log₂ P⌉ encoder per port. Area grows with W² × P, so the PRF size matters as much as the width.</td><td><ul><li>Name cell, 4-wide: (12 search ports × 1 match line/port + 4 write ports × 1 word line/port) × (12 search ports × 2 search lines/port + 4 write ports × 2 bit lines/port) = 16 tracks × 32 tracks = 512 tracks², against 320 tracks² for the SRAM RAT cell</li><li>Comparators: 12 search ports × 192 rows = 2,304 comparators, each 4 bits wide</li><li>Encoders: 12 encoders, each 192 match lines to ⌈log₂ 192⌉ = 8 bits</li><li>Doubling the PRF: 12 search ports × 384 rows = 4,608 comparators</li></ul></td></tr>
<tr><td><strong>Energy</strong></td><td>Every search toggles the match lines of all P rows. Energy grows with P, a main reason the CAM stopped scaling once PRFs reached hundreds of entries.</td><td>12 searches/cycle × 192 rows/search = 2,304 match-line evaluations/cycle, against 12 row reads/cycle for the SRAM RAT</td></tr>
<tr><td><strong>Same-group comparators</strong></td><td>The same count as the SRAM RAT, since they compare architectural names. A WAW match works differently: the older slot can still write its name into its new row but must not set that row's valid bit.</td><td>18 comparators, each ⌈log₂ 16⌉ = 4 bits wide (as for the SRAM RAT)</td></tr>
<tr><td><strong>Delay</strong></td><td>The search lines run past all P rows, each match line evaluates, and the encoder (depth growing with log₂ P) turns the one-hot match into a row number. All three grow with P, so the lookup slows as the PRF grows.</td><td>Search lines span 192 rows, 192 rows / 16 rows = 12× the SRAM RAT's bitlines, then a 192-to-8 encoder with about ⌈log₂ 192⌉ = 8 levels</td></tr>
<tr><td><strong>Priority mux</strong></td><td>The same as the SRAM RAT: W inputs for the youngest slot, depth growing with log₂ W, on the critical path.</td><td>Slot 3: 3 older-slot registers + 1 CAM lookup = 4 inputs, log₂ 4 = 2 levels of 2-to-1 muxes</td></tr>
<tr><td><strong>Checkpoints</strong></td><td>Only the valid vector, P bits. It beats the SRAM copy only when P &lt; A × ⌈log₂ P⌉, as on cores with many architectural registers and a small PRF. A mid-group branch needs the vector with only the older slots' sets and clears applied.</td><td><ul><li>Here: 192 rows × 1 bit/row = 192 bits, more than the SRAM RAT's 128 bits</li><li>Alpha 21264 integer side (32 architectural, 80 physical registers): 80 rows × 1 bit/row = 80 bits against 32 rows × ⌈log₂ 80⌉ bits/row = 32 rows × 7 bits/row = 224 bits for an SRAM copy</li></ul></td></tr>
</table></div>
<p>In both forms the comparator count grows as W² and the port count's area cost also grows as W², so wide cores split rename across two pipeline stages, or rename a wide group as two half-groups with a bypass between them. The CAM RAT also grows with P, which is why modern cores with PRFs of several hundred registers use the SRAM form.</p>
<h3 id="sec-port-workarounds">Cutting Port Costs</h3>
<p>The RAT and the physical register file hit the same wall: every port adds tracks to every cell in both directions, so a wider core can't simply give each slot its own ports. Designers cut the port count instead and accept a small IPC loss. A performance engineer's job is to put that loss into the model and measure it. The PRF is where most of these tricks appear, since its ports scale with issue width (see <a href="#/prf-sizing/cost-power-performance">PRF Sizing</a>), but they work the same way for the RAT.</p>
<div class="tbl"><table>
<tr><th>Workaround</th><th>How It Saves Ports</th><th>What It Costs</th><th>How to Model It</th></tr>
<tr><td><strong>Fewer read ports than operands</strong></td><td>Many operands arrive on the bypass network or are immediates, so the file gets fewer read ports than 2 sources/µop × issue width, and µops share them. Core 2 reads at most 3 different registers/cycle from its permanent register file (Agner Fog's microarchitecture guide).</td><td>A group that needs more file reads than there are ports stalls. Intel calls this a register read stall.</td><td>Count distinct file reads per cycle, leaving out operands still in flight (those come from the ROB or bypass). Over the cap, the youngest µops slip a cycle. Check against Core 2's RAT_STALLS.ROB_READ_PORT counter.</td></tr>
<tr><td><strong>Banking</strong></td><td>Split the file into banks with a few ports each, choosing the bank from the low bits of the physical register number.</td><td>A bank conflict (more reads to one bank than its ports) costs a stall or a replay. A crossbar routes banks to slots.</td><td>Map each physical register to its bank and count reads per bank per cycle. Delay the conflicting µop a cycle. Free-list order sets which bank a register lands in, so model it too.</td></tr>
<tr><td><strong>Replicated copies (clusters)</strong></td><td>Each copy serves only its own cluster's reads, so reads per copy halve. Every write still goes to every copy. The Alpha 21264 had two integer clusters, each with its own copy of the 80-entry integer file.</td><td>Write ports don't shrink. A result reaches the other cluster a cycle late (1 cycle on the 21264), and dispatch must steer µops to clusters.</td><td>Model the steering policy at dispatch. Add the cross-cluster delay to wakeup only for consumers in the other cluster. Report the fraction of dependences that cross.</td></tr>
<tr><td><strong>Separate files per domain</strong></td><td>Integer and FP/vector values live in separate files, each with ports only for its own execution units.</td><td>Moving a value across domains costs a bypass delay, 1 to 2 cycles on recent Intel cores (Agner Fog).</td><td>Tag each µop with its domain. Add the delay on producer→consumer edges that cross domains.</td></tr>
<tr><td><strong>Register file cache</strong></td><td>A small, fully ported cache of recently written values sits in front of a large PRF with few ports. Proposed by Cruz et al. (ISCA 2000). GPUs use a similar operand reuse cache.</td><td>A miss reads the large file and takes extra cycles. Dependents woken early on the assumption of a hit must replay.</td><td>Track the cache's contents and its insertion and replacement policy. Add the miss latency, replay the dependents, and report the hit rate.</td></tr>
<tr><td><strong>Pipelining the access</strong></td><td>It doesn't cut ports, but it lets a slow multiported structure meet the cycle time. The Pentium 4 spent 2 stages on rename and 2 on register read.</td><td>Each added stage adds a cycle to the misprediction penalty. Read stages between issue and execute also widen the bypass network, since more results are in flight.</td><td>Add the stages to the pipeline depth and to the misprediction penalty. If they sit between wakeup and execute, they also lengthen the load-miss replay window.</td></tr>
<tr><td><strong>Split rename</strong></td><td>Rename a wide group as two half-groups, each needing half the ports and comparators. The second half takes the first half's new mappings through a bypass.</td><td>An extra stage, or a second half that waits on the first.</td><td>An extra front-end stage, modeled as in the row above.</td></tr>
<tr><td><strong>Retirement RAT</strong></td><td>Commit reads the old mapping, removing W read ports from the front-end RAT (see <a href="#/rat-design/rat-ports">RAT Ports</a>).</td><td>Recovery can't walk the ROB backward, so it waits for checkpoints or the retirement RAT.</td><td>Add the restore latency to the misprediction penalty for branches with no checkpoint.</td></tr>
</table></div>
<h3 id="sec-model">Putting It Into a Model</h3>
<p>In a cycle-level model, every workaround above becomes one of three things:</p>
<ul><li><strong>A per-cycle cap:</strong> a count of uses per resource per cycle (reads per file, reads per bank). µops over the cap slip a cycle, and in an in-order stage such as rename or register read, every younger µop slips with them.</li><li><strong>Added latency on some edges:</strong> cross-cluster and cross-domain dependences and register cache misses. Add it to the producer→consumer wakeup time, not to every µop.</li><li><strong>Added pipeline depth:</strong> extra stages raise the misprediction penalty and the replay window, not the steady-state throughput.</li></ul>
<p>For each one, report the IPC change against a baseline with unlimited ports, plus a stall counter for the cycles the limit cost (the model's version of RAT_STALLS.ROB_READ_PORT). A read cap or bank model is only as good as its operand-source tracking: an operand still in flight comes from the bypass network and must not count against the file's ports.</p>
<p>Example, with a Core 2–style cap of 3 permanent-register reads/cycle: a 4-µop group reads rax, rbx, rcx, rdx, and rsi, none written recently enough to still be in flight. It needs ⌈5 registers / (3 registers/cycle)⌉ = 2 cycles, so it loses 1 rename cycle, in which a 4-wide renamer would have renamed 4 more µops.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A small RISC-V out-of-order core, in the class of BOOM's smaller configurations, renames 2 instructions per cycle into 96 integer physical registers and keeps up to 12 branch checkpoints. Compare an SRAM RAT and a CAM RAT on storage, checkpoint storage, and lookup energy. Which form does this core favor, and does the answer hold for a 6-wide core with 280 physical registers?</p><p class="given">Assume 32 architectural integer registers, each with a RAT row, two sources and one destination per instruction, and lookup energy counted as row reads for the SRAM RAT and match-line evaluations for the CAM RAT.</p>`,
        a: `<ol><li>Field widths: ⌈log₂ 96⌉ = 7 bits per physical register number, ⌈log₂ 32⌉ = 5 bits per architectural name.</li><li>SRAM storage: 32 rows × 7 bits/row = 224 bits. CAM storage: 96 rows × (5 bits + 1 valid bit)/row = 576 bits.</li><li>One checkpoint: the SRAM RAT copies all 224 bits, the CAM RAT only its valid vector, 96 rows × 1 bit/row = 96 bits.</li><li>12 checkpoints: 12 checkpoints × 224 bits/checkpoint = 2,688 bits for SRAM against 12 checkpoints × 96 bits/checkpoint = 1,152 bits for CAM. The CAM saves 2,688 bits − 1,152 bits = 1,536 bits, more than its 576 bits − 224 bits = 352 extra bits of table.</li><li>Lookups: 3 lookups/instruction × 2 instructions/cycle = 6 lookups/cycle. SRAM: 6 row reads/cycle. CAM: 6 searches/cycle × 96 rows/search = 576 match-line evaluations/cycle.</li><li>Verdict: the CAM checkpoint (P = 96 bits) is smaller than the SRAM one (A × ⌈log₂ P⌉ = 32 rows × 7 bits/row = 224 bits), so the CAM wins on checkpoints, and at 2-wide its search energy is affordable. Either form is reasonable here, with the CAM ahead if checkpoints dominate.</li><li>6-wide, 280 registers: an SRAM checkpoint is 32 rows × ⌈log₂ 280⌉ bits = 32 rows × 9 bits = 288 bits against 280 bits for CAM, nearly a tie. Searches become 18 searches/cycle × 280 rows/search = 5,040 match-line evaluations/cycle against 18 row reads/cycle, and the CAM's area grows with W² × P. The large core <strong>favors the SRAM RAT</strong>, which is why modern wide cores use it.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An AArch64 core widens rename from 6 to 8 instructions per cycle. Estimate how the same-group comparator logic and the RAT cell area grow, and name what sets the cycle time.</p><p class="given">Assume 32 architectural integer registers (5-bit names), two sources and one destination per instruction, an SRAM RAT, and cell area proportional to the square of the port count.</p>`,
        a: `<ol><li>Comparators: 1.5 × W(W − 1). 6-wide: 1.5 × 6 slots × 5 slots = 45 comparators. 8-wide: 1.5 × 8 slots × 7 slots = 84 comparators, which is 84 comparators / 45 comparators ≈ <strong>1.87×</strong>.</li><li>In bits: 45 comparators × 5 bits = 225 bit compares versus 84 comparators × 5 bits = 420 bit compares.</li><li>RAT ports: 3W read + W write. 6-wide: 18 + 6 = 24 ports. 8-wide: 24 + 8 = 32 ports. Cell area: (32 ports / 24 ports)² ≈ <strong>1.78×</strong> per entry.</li><li>Cycle time: the comparisons overlap the RAT read, so the critical path is RAT read (or compare) → priority select → mux. The youngest slot's mux grows from 6 inputs (5 older slots + RAT) to 8 inputs (7 older slots + RAT), adding about one gate level, and the wires from every slot's destination to every younger slot's mux grow with W². Designs that can't fit this in one cycle split rename into two stages or rename two half-groups back to back.</li></ol>`
      }
    ]
  }
},

{
  id: "prf-sizing",
  region: "ren",
  title: "Sizing the Physical Register File",
  sections: [
    { id: "math", label: "The Math" },
    { id: "benefit", label: "Benefit" },
    { id: "cost-power-performance", label: "Cost: Power, Performance, Area" },
    { id: "typical-workload-effects", label: "Typical Workload Effects" }
  ],
  body: `
<p>The physical register file (PRF) holds every renamed value. Its size limits how many instructions with destinations can be in flight.</p>
<h3 id="sec-math">The Math</h3>
<p>Registers needed ≈ architectural registers + in-flight destinations. By Little's law, in-flight destinations = rename rate × average lifetime (from rename until the next writer of the same architectural register commits). A practical target: PRF ≥ arch regs + (ROB size × fraction of instructions with a destination of that class).</p>
<h3 id="sec-benefit">Benefit</h3>
<p>More registers let the window grow before rename stalls, exposing more memory-level parallelism. Once the PRF stops being the first resource to fill, extra registers buy nothing. IPC versus PRF size is a saturating curve, and the knee depends on the workload.</p>
<h3 id="sec-cost-power-performance">Cost: Power, Performance, Area</h3>
<ul>
<li><strong>Area:</strong> grows with entries × width × (ports)². A wide core needs many ports, so the PRF is one of the densest and largest structures in the core.</li>
<li><strong>Latency:</strong> more entries means longer wordlines and bitlines. Past a point, register read takes an extra pipeline stage, which lengthens the mispredict penalty and needs more bypassing.</li>
<li><strong>Power:</strong> every read and write charges long bitlines; energy per access rises with entries and ports. Leakage rises with area.</li>
</ul>
<h3 id="sec-typical-workload-effects">Typical Workload Effects</h3>
<ul><li><strong>Pointer chasing:</strong> little gain; dependent misses don't overlap.</li><li><strong>Independent misses (streaming without good prefetch, irregular but independent loads):</strong> large gain until another structure fills.</li><li><strong>Compute-bound:</strong> modest gain; short-lived values recycle registers quickly.</li><li><strong>FP and vector code:</strong> wide vector registers make each entry costly, so the vector PRF is often the tighter limit.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A core has 32 architectural integer registers and a 200-entry ROB. About 60% of instructions write an integer register. How many integer physical registers avoid rename stalls when the ROB is full?</p>`,
        a: `<ol><li>Destinations in flight with a full ROB: 0.6 × 200 = 120.</li><li>Committed state needs 32.</li><li>Total: 32 + 120 = <strong>152</strong>. Fewer than that, and rename stalls before the ROB fills, so the PRF, not the ROB, sets the window.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Going from 6-wide to 8-wide issue raises the integer PRF from 12 read and 6 write ports to 16 read and 8 write ports. Estimate the area change per register and suggest mitigations.</p>`,
        a: `<p>Each port adds a wordline and a bitline per cell, so cell area grows roughly with the square of the port count: (24 / 18)² ≈ <strong>1.78×</strong> per entry, before adding entries. Latency and energy per access grow too.</p><p>Mitigations: split the PRF into clusters or banks (with cross-cluster delay), replicate read ports in copies of the file (writes go to all copies), take operands from the bypass network instead of the file, and add a small register cache in front of a larger, slower PRF.</p>`
      }
    ]
  }
}
]);
