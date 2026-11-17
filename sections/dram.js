/* Section: DRAM
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "dram"). */

section({
  id: "dram",
  name: "DRAM",
  cap: "How a DRAM cell stores a bit as charge, why its reads are destructive and its rows need refresh, and how it compares with SRAM",
  body: `
<p>A DRAM cell stores its bit as charge on a capacitor behind one access transistor. That makes it many times denser than SRAM, and it is also why DRAM is slower: the charge is tiny, a read drains it so the row must be written back, and it leaks, so every row must be refreshed. The page below compares the DRAM cell with the SRAM cell and explains why the hierarchy puts small SRAM caches in front of large DRAM main memory. The <a href="#/r/sram">SRAM</a> region goes inside the SRAM array.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 16 Gb DDR5 device must be refreshed every tREFI = 3.9 µs (normal temperature range), and each all-bank refresh command keeps the device busy for tRFC = 295 ns. What fraction of the time can the device not serve reads or writes? What happens to that fraction above 85 °C, where tREFI halves?</p>`,
        a: `<ol><li>Each refresh interval of 3.9 µs = 3,900 ns loses 295 ns to the refresh.</li><li>Busy fraction: 295 ns / 3,900 ns ≈ <strong>7.56%</strong>.</li><li>Above 85 °C, cells leak faster, so tREFI = 3.9 µs / 2 = 1.95 µs = 1,950 ns.</li><li>Busy fraction: 295 ns / 1,950 ns ≈ <strong>15.13%</strong>.</li><li>An SRAM of any size pays 0% here, because its latch actively holds the bit. This is one of the costs DRAM pays for its 1T1C density, and it is why DDR5 added same-bank refresh, which refreshes one bank in each bank group while the others keep serving requests.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A team proposes replacing a 32 MB SRAM last-level cache with a 96 MB eDRAM cache in the same area. What would you change in the performance model to evaluate it, and what would decide the outcome?</p>`,
        a: `<p>Three things change in the model:</p><ul><li><strong>Hit latency:</strong> eDRAM sensing is slower and its reads are destructive, so each access needs a restore before the bank can be reused. The hit latency goes up by several nanoseconds and each bank's occupancy per access grows, which lowers the bandwidth the LLC can sustain under load.</li><li><strong>Refresh:</strong> banks are periodically unavailable. Model it as a fraction of bank time blocked, or as a periodic busy window per bank, so requests that land on a refreshing bank wait.</li><li><strong>Miss rate:</strong> 3× the capacity lowers the miss rate for workloads whose working sets fall between 32 MB and 96 MB, and every miss avoided saves a DRAM access of roughly 80 to 100 ns.</li></ul><p>The outcome depends on the workloads. Cache-friendly code that fits in 32 MB sees only the slower hits and loses. Workloads with working sets between 32 MB and 96 MB win big, because the saved DRAM misses dwarf the extra hit latency. Streaming code that misses in both gains nothing. IBM made this trade in POWER7 through POWER9, which used eDRAM for their large L3s, so I'd run representative server traces and compare both IPC and the LLC's loaded latency, not just its miss rate.</p>`
      }
    ]
  }
}, [
{
  id: "sram-dram",
  region: "dram",
  title: "Two Ways to Store a Bit",
  sections: [
    { id: "dram-slower", label: "Why DRAM Is Slower" },
    { id: "sram-faster", label: "Why SRAM Is Faster" },
    { id: "hierarchy-trade-off", label: "The Hierarchy Trade-Off" }
  ],
  body: `
<p>The difference is how a bit is physically stored.</p>
<ul><li><strong>SRAM:</strong> a pair of cross-coupled inverters (a latch) plus two access transistors, <strong>6T per bit</strong>. The latch actively holds its value while powered.</li><li><strong>DRAM:</strong> charge on a <strong>capacitor</strong> with one access transistor (<strong>1T1C</strong>). The charge leaks, so it must be refreshed.</li></ul>
<div class="tbl"><table>
<tr><th></th><th>SRAM</th><th>DRAM</th></tr>
<tr><td>Cell</td><td>6T latch</td><td>1 transistor + 1 capacitor</td></tr>
<tr><td>Density</td><td>Low (big cell)</td><td>~10–20× denser</td></tr>
<tr><td>Speed</td><td>Fast (~1 ns on-chip)</td><td>Tens of ns</td></tr>
<tr><td>Refresh</td><td>None</td><td>Every ~64 ms per row</td></tr>
<tr><td>Reads</td><td>Non-destructive</td><td>Destructive; the row must be written back</td></tr>
<tr><td>Process</td><td>Same logic process as the CPU</td><td>Specialized process, usually a separate chip</td></tr>
<tr><td>Use</td><td>Caches, register files, TLBs</td><td>Main memory</td></tr>
</table></div>
<h3 id="sec-dram-slower">Why DRAM Is Slower</h3>
<p>The capacitor is tiny, so opening a row only nudges the bitline voltage, and sense amps must amplify that small signal. Then the row is restored and the bank precharged before reuse. Hence <strong>row buffers</strong> (open a row, read many columns) and timing parameters like tRCD, tCAS, and tRP. See <a href="#/l2-banks">L2 and banking</a> for row-buffer hits vs. conflicts.</p>
<h3 id="sec-sram-faster">Why SRAM Is Faster</h3>
<p>The latch actively drives the bitline, so the signal develops quickly, reads leave the cell intact, and nothing needs refreshing.</p>
<p>The <a href="#/r/sram">SRAM</a> region goes inside the SRAM array: <a href="#/sram-read">Reading an SRAM Cell</a>, <a href="#/sram-write">Writing an SRAM Cell</a>, <a href="#/sram-output">Where the Bit Leaves the Array</a>, <a href="#/sram-array-size">How Array Size Sets Delay and Energy</a>, and <a href="#/sram-banks">Splitting the Array into Banks</a>.</p>
<h3 id="sec-hierarchy-trade-off">The Hierarchy Trade-Off</h3>
<p>H&amp;P Ch. 2: SRAM is fast but expensive per bit; DRAM is dense and cheap but slow. So small SRAM caches sit in front of large DRAM main memory.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Roughly how many transistors are in the data array of a 32 KB SRAM cache built from 6T cells? What would the same capacity be in 1T1C DRAM cells?</p>`,
        a: `<ol><li>Bits: 32 × 1024 × 8 = 262,144.</li><li>SRAM: 262,144 × 6 ≈ <strong>1.57 million transistors</strong>, before tags, decoders, and sense amps.</li><li>DRAM: 262,144 transistors plus 262,144 capacitors. That is 6× fewer transistors per bit, and the capacitor is built above or beside the transistor, so the cell is smaller still. That is why DRAM is much denser.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>DRAM is much denser. Why aren’t on-chip caches built from it?</p>`,
        a: `<p>DRAM needs special process steps for the capacitor that don’t mix cheaply with a fast logic process, its reads are destructive (restore + precharge before reuse), it needs refresh, and its tiny charge makes sensing slow. SRAM sits in the same logic process and is fast and simple. Some designs did use embedded DRAM for large last-level caches (IBM POWER7–POWER9 L3, Intel’s Crystal Well eDRAM L4), trading latency for capacity where density mattered most.</p>`
      }
    ]
  }
}

]);
