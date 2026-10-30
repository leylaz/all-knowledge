/* Section: Computer arithmetic
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "arith"). */

/* Bit-field bars for the Floating-Point Formats page, drawn to scale. */
function fpBar(name, segs, of) {
  const w = segs.reduce((a, s) => a + s[1], 0) / of * 100;
  return '<div class="bfrow"><b>' + name + '</b><div class="bf" style="width:' + w + '%">' +
    segs.map(s => '<span class="' + s[0] + '" style="flex-grow:' + s[1] + '">' + (s[2] || s[1]) + '</span>').join("") +
    '</div></div>';
}
const FP_BARS = '<div class="bfs">' +
  fpBar("FP32", [["s", 1], ["e", 8], ["f", 23]], 32) +
  fpBar("TF32", [["s", 1], ["e", 8], ["f", 10], ["x", 13, "unused 13"]], 32) +
  fpBar("BF16", [["s", 1], ["e", 8], ["f", 7]], 32) +
  fpBar("FP16", [["s", 1], ["e", 5], ["f", 10]], 32) +
  fpBar("FP8 E5M2", [["s", 1], ["e", 5], ["f", 2]], 32) +
  fpBar("FP8 E4M3", [["s", 1], ["e", 4], ["f", 3]], 32) +
  fpBar("FP4 E2M1", [["s", 1], ["e", 2], ["f", 1]], 32) +
  '</div><p class="bfkey">Widths to scale (32 bits = full width).<i style="background:var(--pad-soft);border:1px solid var(--pad)"></i>sign<i style="background:var(--trace-soft);border:1px solid var(--trace)"></i>exponent<i style="background:var(--code-bg);border:1px solid var(--rule)"></i>fraction (stored mantissa bits)</p>';

section({
  id: "arith",
  name: "Computer Arithmetic",
  cap: "Floating-point and fixed-point formats, rounding, ML types, and the integer and FMA datapaths",
  sections: [
    { id: "pages", label: "The Pages" },
    { id: "where-connects", label: "Where It Connects" }
  ],
  body: `
<p>How hardware represents numbers and computes with them. Integers and fixed point space their values evenly, so the absolute error is constant and the range is small. A floating-point number trades that for range: it stores a sign, an exponent, and a fixed number of significand bits, so the gap between neighbors grows with the magnitude. The format decides the hardware (adder and multiplier width, lanes per vector register, bytes per operand) and the numerics (what overflows, what rounds away, what accumulates error).</p>
<h3 id="sec-pages">The Pages</h3>
<p><strong>Representations:</strong></p>
<ol>
<li><a href="#/fp-encoding">Encoding a Float</a>: the sign, exponent, and fraction fields, the hidden bit, special values, and ULP, with an encoder you can try.</li>
<li><a href="#/fp-formats">Floating-Point Formats Compared</a>: every format from FP128 down to FP4, side by side.</li>
<li><a href="#/fp-rounding">Rounding, Exceptions, and Error</a>: rounding modes, guard, round, and sticky bits, the five exception flags, subnormal penalties, and summation error.</li>
<li><a href="#/fp-ml-formats">Low-Precision ML Formats</a>: BF16, TF32 and “BF32,” FP8, FP6, FP4, and block scaling.</li>
<li><a href="#/fixed-point">Fixed Point and Integer Quantization</a>: Q formats, saturating arithmetic, and INT8 and INT4 inference.</li>
</ol>
<p><strong>Hardware:</strong></p>
<ol start="6">
<li><a href="#/int-units">Integer Arithmetic Units</a>: prefix adders, shifters, Booth multipliers and compressor trees, and SRT dividers.</li>
<li><a href="#/fp-units">Floating-Point Units and the FMA Pipeline</a>: the FMA datapath stage by stage, latency and throughput, area by format, and ISA support.</li>
</ol>
<p>Interview questions on this material: <a href="#/intv-arith">Arithmetic and Floating Point</a>.</p>
<h3 id="sec-where-connects">Where It Connects</h3>
<ul>
<li><a href="#/exec-units">Execution Units</a>: where the FPU sits among the core’s other functional units.</li>
<li><a href="#/simd">SIMD and Vector Execution</a>: how the same FMA hardware is replicated across vector lanes.</li>
<li><a href="#/gen-gpus/roofline">The roofline model</a>: why smaller formats help memory-bound code more than compute-bound code.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>For each value, say whether FP16 and BF16 can store it, and with what relative error:</p><ul><li>(a) 70,000 (a token ID in Llama 3’s 128K vocabulary)</li><li>(b) 0.001 (a typical learning rate)</li><li>(c) π</li></ul>`,
        a: `<ol><li><strong>(a) 70,000.</strong> FP16’s largest finite value is 65,504, so it overflows to ∞. BF16: 2<sup>16</sup> = 65,536 ≤ 70,000 &lt; 2<sup>17</sup>, so the spacing is 2<sup>16 − 7</sup> = 512. 70,000 / 512 = 136.7, which rounds to 137, giving 70,144 (0.21% high).</li><li><strong>(b) 0.001.</strong> 2<sup>−10</sup> ≤ 0.001 &lt; 2<sup>−9</sup>, a normal number in both. FP16 spacing is 2<sup>−20</sup>, so the error is at most 0.05%. BF16 spacing is 2<sup>−17</sup> ≈ 7.6 × 10<sup>−6</sup>: 0.001 / 2<sup>−17</sup> = 131.07 rounds to 131, giving 0.00099945 (0.055% low).</li><li><strong>(c) π.</strong> π = 1.1001001 0000111…<sub>2</sub> × 2<sup>1</sup>. BF16 keeps 7 fraction bits (1001001) and the next bit is 0, so it rounds down to 3.140625. FP16 keeps 10 (1001001000) and the next bit is also 0, so it rounds to the same 3.140625 (0.03% low). FP16’s 3 extra bits happen to be zeros here.</li><li>Takeaway: BF16 fails on precision, FP16 fails on range.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>To save memory, someone changes a cycle-level simulator’s cycle counter from <code>uint64_t</code> to <code>float</code>, incrementing it by 1 each cycle. When does it break, and how long is that for a 3.5 GHz core?</p>`,
        a: `<p>FP32 has 24 bits of precision, so every integer up to 2<sup>24</sup> = 16,777,216 is exact. At 2<sup>24</sup> the spacing becomes 2. 16,777,216 + 1 lands exactly halfway between 16,777,216 and 16,777,218, and ties go to the even significand, which is 16,777,216. The counter <strong>stops at 2<sup>24</sup></strong> and never moves again.</p><p>At 3.5 GHz that’s 16,777,216 / 3.5 × 10<sup>9</sup> ≈ <strong>4.8 ms</strong> of simulated time, well inside a single SimPoint interval. Every IPC computed after that is wrong, and silently so. Counters should be integers. Even <code>double</code> only delays the problem to 2<sup>53</sup>, and floating-point counters also make ratios non-reproducible across compilers.</p>`
      }
    ]
  }
}, [
{
  id: "fp-encoding",
  region: "arith",
  title: "Encoding a Float",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Appendix J, Computer Arithmetic (floating-point representation). Patterson &amp; Hennessy, <em>Computer Organization and Design</em>, Section 3.5, Floating Point.`,
  sections: [
    { id: "fields", label: "Sign, Exponent, Mantissa" },
    { id: "special", label: "Zeros, Subnormals, Infinities, and NaNs" },
    { id: "ulp", label: "What the Mantissa Width Buys" },
    { id: "example", label: "Worked Example: −6.5 in Three Formats" },
    { id: "try", label: "Try It: Encode or Decode a Float" }
  ],
  body: `
<h3 id="sec-fields">Sign, Exponent, Mantissa</h3>
<p>Every binary floating-point format has the same three fields. For FP32, bit 31 is the sign, bits 30–23 are the exponent, and bits 22–0 are the fraction.</p>
<ul>
<li><strong>Sign (S):</strong> 1 bit. 0 is positive.</li>
<li><strong>Exponent (E):</strong> <em>e</em> bits, stored with a <strong>bias</strong> of 2<sup>e−1</sup> − 1 (127 for 8 bits, 15 for 5 bits) so that negative exponents need no separate sign.</li>
<li><strong>Fraction (F):</strong> <em>f</em> bits, the digits after the binary point.</li>
</ul>
<p class="eq">Normal value = (−1)<sup>S</sup> × 1.F × 2<sup>E − bias</sup></p>
<p><strong>Mantissa vs. significand vs. fraction.</strong></p><ul><li>IEEE 754 calls the full number 1.F the <em>significand</em></li><li>The stored field F is the <em>fraction</em></li><li>“mantissa” is the older word and people use it for either</li></ul><p>The leading 1 is not stored (the <strong>hidden bit</strong>): any normalized binary number starts with 1, so storing it would waste a bit. So the <strong>precision</strong> is <em>p</em> = <em>f</em> + 1 bits. FP32 stores 23 fraction bits but has 24 bits of precision. Hardware re-inserts the hidden bit when it unpacks an operand, so an FP32 multiplier is 24 × 24 bits, not 23 × 23.</p>
<p>Because the exponent sits above the fraction and is biased, positive floats sort the same way as their bit patterns read as unsigned integers. That’s why a float compare can reuse much of an integer comparator, and why radix sorts work on floats after flipping the sign handling.</p>

<h3 id="sec-special">Zeros, Subnormals, Infinities, and NaNs</h3>
<p>The exponent field has two reserved values:</p>
<div class="tbl"><table>
<tr><th>Exponent field</th><th>Fraction</th><th>Meaning</th></tr>
<tr><td>All zeros</td><td>0</td><td>±0 (two zeros: they compare equal, but 1/−0 = −∞)</td></tr>
<tr><td>All zeros</td><td>≠ 0</td><td>Subnormal: (−1)<sup>S</sup> × 0.F × 2<sup>1 − bias</sup>. Hidden bit is 0, so precision drops gradually toward zero</td></tr>
<tr><td>1 to all-ones − 1</td><td>Any</td><td>Normal number</td></tr>
<tr><td>All ones</td><td>0</td><td>±∞</td></tr>
<tr><td>All ones</td><td>≠ 0</td><td>NaN (on most ISAs, fraction bit <em>f</em>−1 set = quiet NaN)</td></tr>
</table></div>
<ul>
<li><strong>Subnormals</strong> fill the gap between zero and the smallest normal with evenly spaced values. They guarantee that x − y = 0 only when x = y (gradual underflow). The price is that they lose precision as they shrink, and that many cores handle them slowly (see <a href="#/fp-rounding/subnormal">Subnormals and Flush to Zero</a>).</li>
<li><strong>NaN</strong> is unordered: every comparison with a NaN is false, including x == x. A <em>quiet</em> NaN propagates through arithmetic. A <em>signaling</em> NaN raises the invalid exception when used. The spare fraction bits (the <em>payload</em>) can carry diagnostic information.</li>
<li><strong>Infinity</strong> results from overflow or division of a nonzero number by zero, and arithmetic on it follows the limits (∞ + 1 = ∞, while ∞ − ∞ = NaN).</li>
</ul>
<p>The small ML formats bend these rules (FP8 E4M3 has no infinity, and FP6 and FP4 have neither infinity nor NaN) to spend every encoding on numbers. The x87 80-bit format is the odd one out the other way: it stores the integer bit explicitly.</p>

<h3 id="sec-ulp">What the Mantissa Width Buys</h3>
<ul>
<li><strong>Spacing (ULP).</strong> Between 2<sup>k</sup> and 2<sup>k+1</sup> the representable numbers are evenly spaced, one <em>unit in the last place</em> apart: ULP = 2<sup>k − f</sup>. The spacing doubles at every power of two, so <em>absolute</em> error grows with magnitude while <em>relative</em> error stays roughly constant.</li>
<li><strong>Machine epsilon</strong> ε = 2<sup>−f</sup>, the gap between 1.0 and the next number. Round to nearest makes each operation’s relative error at most ε/2 (the <em>unit roundoff</em>).</li>
<li><strong>Decimal digits</strong> ≈ <em>p</em> × log<sub>10</sub>2 ≈ 0.301 <em>p</em>.</li>
<li><strong>Exact integers.</strong> Every integer from 0 to 2<sup>p</sup> is exact. Past that, odd integers start to disappear. FP32: up to 16,777,216 (2<sup>24</sup>). FP16: 2,048. BF16: only 256. FP64: 2<sup>53</sup> ≈ 9.0 × 10<sup>15</sup>.</li>
<li><strong>Decimal fractions are not exact.</strong> 0.1 is 0.000110011…<sub>2</sub>, a repeating binary fraction, so it is rounded in every binary format. In FP32 it is stored as 0.100000001490116.</li>
</ul>

<h3 id="sec-example">Worked Example: −6.5 in Three Formats</h3>
<p>6.5 = 110.1<sub>2</sub> = 1.101<sub>2</sub> × 2<sup>2</sup>, so S = 1 and the fraction starts 101.</p>
<div class="tbl"><table>
<tr><th>Format</th><th>Exponent field</th><th>Bits (S | E | F)</th><th>Hex</th></tr>
<tr><td>FP32</td><td>2 + 127 = 129</td><td><code>1 | 10000001 | 10100000000000000000000</code></td><td><code>0xC0D00000</code></td></tr>
<tr><td>BF16</td><td>2 + 127 = 129</td><td><code>1 | 10000001 | 1010000</code></td><td><code>0xC0D0</code></td></tr>
<tr><td>FP16</td><td>2 + 15 = 17</td><td><code>1 | 10001 | 1010000000</code></td><td><code>0xC680</code></td></tr>
</table></div>
<p>BF16 is literally the top 16 bits of the FP32 pattern. FP16 needs a re-biased exponent.</p>
<p><strong>Decoding in C</strong> (the same steps an FPU’s unpack stage does in hardware):</p>
<pre><code>void fp32_fields(float f, int *s, int *e, uint32_t *sig) {
    uint32_t x;
    memcpy(&amp;x, &amp;f, sizeof x);
    *s = x &gt;&gt; 31;
    int ef = (x &gt;&gt; 23) &amp; 0xFF;
    uint32_t frac = x &amp; 0x7FFFFF;
    if (ef == 0) {                       <span class="cm">// zero or subnormal: hidden bit is 0</span>
        *e = 1 - 127;
        *sig = frac;
    } else {                             <span class="cm">// normal (ef == 255 is inf/NaN, not handled here)</span>
        *e = ef - 127;
        *sig = frac | 0x800000;          <span class="cm">// re-insert the hidden bit</span>
    }
}                                        <span class="cm">// value = (-1)^s * sig * 2^(e - 23)</span></code></pre>

<h3 id="sec-try">Try It: Encode or Decode a Float</h3>
<p>Pick a format, then type a decimal value to see its bits and rounding error, or a bit pattern such as <code>0x3EAAAAAB</code> to decode it. Every format on <a href="#/fp-formats">Floating-Point Formats Compared</a> except FP128 and x87 is available.</p>
<div class="calc" data-calc="float"></div>`,
  practice: {
    guided: [
      {
        q: `<p>Decode the FP32 bit pattern <code>0x41460000</code>.</p>`,
        a: `<ol><li>Binary: <code>0 10000010 10001100000000000000000</code>.</li><li>Sign 0, so positive.</li><li>Exponent field 10000010<sub>2</sub> = 130, so the exponent is 130 − 127 = 3.</li><li>Significand 1.1000110<sub>2</sub> (hidden bit plus the fraction).</li><li>Value: 1.1000110<sub>2</sub> × 2<sup>3</sup> = 1100.011<sub>2</sub> = 8 + 4 + 0.25 + 0.125 = <strong>12.375</strong>.</li></ol>`
      },
      {
        q: `<p>A trace tool stores timestamps as <code>double</code> nanoseconds since boot. After how long does it lose 1 ns resolution? What if it stored them as <code>float</code>?</p>`,
        a: `<ol><li>FP64 has 53 bits of precision, so integers are exact up to 2<sup>53</sup> ≈ 9.007 × 10<sup>15</sup> ns.</li><li>9.007 × 10<sup>15</sup> ns = 9.007 × 10<sup>6</sup> s ≈ <strong>104 days</strong> of uptime.</li><li>FP32: 2<sup>24</sup> ns ≈ <strong>16.8 ms</strong>. After that, the spacing is 2 ns and keeps doubling.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A profiler stores Unix-epoch timestamps in nanoseconds as <code>double</code>. Today that’s about 1.79 × 10<sup>18</sup> ns. What is the actual resolution, and what does that do to a 40 ns L3-miss latency computed as a difference of two timestamps?</p>`,
        a: `<p>2<sup>60</sup> ≈ 1.15 × 10<sup>18</sup> ≤ 1.79 × 10<sup>18</sup> &lt; 2<sup>61</sup>, so the exponent is 60 and the ULP is 2<sup>60 − 52</sup> = <strong>256 ns</strong>. Each timestamp is rounded to a multiple of 256 ns, so a 40 ns interval comes out as either 0 or 256 ns. The subtraction itself is exact (Sterbenz lemma: the operands are within a factor of 2), but the damage was already done when the timestamps were rounded.</p><p>Fix: keep timestamps as <code>int64_t</code> nanoseconds and convert only the small difference to floating point, or subtract a per-run base time before converting.</p>`
      },
      {
        q: `<p>With subnormals disabled (flush to zero), find two different FP32 values x and y for which x − y evaluates to 0. Why does this matter for code like <code>if (x != y) z = 1 / (x - y);</code>?</p>`,
        a: `<p>Take x = 1.5 × 2<sup>−126</sup> and y = 2<sup>−126</sup> (the smallest normal). Both are normal, and x ≠ y. The exact difference is 0.5 × 2<sup>−126</sup> = 2<sup>−127</sup>, which is below the smallest normal, so it is a subnormal. With flush to zero it becomes 0.</p><p>So the guard <code>x != y</code> passes, yet x − y = 0 and the division produces ∞. Gradual underflow is what makes “x ≠ y implies x − y ≠ 0” true in IEEE arithmetic. Flush to zero breaks it, which is usually fine in ML and graphics but can break numerical code written assuming it.</p>`
      }
    ]
  }
},

{
  id: "fp-formats",
  region: "arith",
  title: "Floating-Point Formats Compared",
  book: `Sources: IEEE 754-2019. Micikevicius et al., “FP8 Formats for Deep Learning” (2022). Open Compute Project, “OCP Microscaling Formats (MX) v1.0 Specification” (2023).`,
  sections: [
    { id: "bars", label: "The Bit Layouts" },
    { id: "table", label: "Every Format, Side by Side" },
    { id: "read", label: "How to Read the Table" }
  ],
  body: `
<h3 id="sec-bars">The Bit Layouts</h3>
${FP_BARS}

<h3 id="sec-table">Every Format, Side by Side</h3>
<div class="tbl"><table>
<tr><th>Format</th><th>S / E / F bits</th><th>Bias</th><th>Precision <em>p</em></th><th>ε = 2<sup>−f</sup></th><th>≈ Digits</th><th>Max normal</th><th>Min normal</th><th>Main use</th></tr>
<tr><td>FP128 (quad, binary128)</td><td>1 / 15 / 112</td><td>16383</td><td>113</td><td>1.9 × 10<sup>−34</sup></td><td>34</td><td>1.19 × 10<sup>4932</sup></td><td>3.36 × 10<sup>−4932</sup></td><td>Error-sensitive science. Hardware only on IBM POWER9 and later, software elsewhere</td></tr>
<tr><td>x87 extended (80-bit)</td><td>1 / 15 / 64*</td><td>16383</td><td>64</td><td>1.1 × 10<sup>−19</sup></td><td>19</td><td>1.19 × 10<sup>4932</sup></td><td>3.36 × 10<sup>−4932</sup></td><td><code>long double</code> on x86 Linux. *Includes an explicit integer bit</td></tr>
<tr><td>FP64 (double, binary64)</td><td>1 / 11 / 52</td><td>1023</td><td>53</td><td>2.2 × 10<sup>−16</sup></td><td>15.9</td><td>1.80 × 10<sup>308</sup></td><td>2.23 × 10<sup>−308</sup></td><td>HPC, simulation, finance</td></tr>
<tr><td>FP32 (single, binary32)</td><td>1 / 8 / 23</td><td>127</td><td>24</td><td>1.19 × 10<sup>−7</sup></td><td>7.2</td><td>3.40 × 10<sup>38</sup></td><td>1.18 × 10<sup>−38</sup></td><td>General compute, ML master weights and accumulators</td></tr>
<tr><td>TF32 (TensorFloat-32)</td><td>1 / 8 / 10 (19 of 32 bits)</td><td>127</td><td>11</td><td>9.8 × 10<sup>−4</sup></td><td>3.3</td><td>≈ 3.40 × 10<sup>38</sup></td><td>1.18 × 10<sup>−38</sup></td><td>NVIDIA tensor-core matmul input (A100 onward), never stored</td></tr>
<tr><td>FP16 (half, binary16)</td><td>1 / 5 / 10</td><td>15</td><td>11</td><td>9.8 × 10<sup>−4</sup></td><td>3.3</td><td>65,504</td><td>6.1 × 10<sup>−5</sup></td><td>Graphics, inference, mixed-precision training with loss scaling</td></tr>
<tr><td>BF16 (bfloat16)</td><td>1 / 8 / 7</td><td>127</td><td>8</td><td>7.8 × 10<sup>−3</sup></td><td>2.4</td><td>3.39 × 10<sup>38</sup></td><td>1.18 × 10<sup>−38</sup></td><td>ML training and inference</td></tr>
<tr><td>FP8 E5M2</td><td>1 / 5 / 2</td><td>15</td><td>3</td><td>0.25</td><td>0.9</td><td>57,344</td><td>6.1 × 10<sup>−5</sup></td><td>Gradients (range matters more than precision)</td></tr>
<tr><td>FP8 E4M3</td><td>1 / 4 / 3</td><td>7</td><td>4</td><td>0.125</td><td>1.2</td><td>448</td><td>0.015625</td><td>Weights and activations. No ∞, one NaN pattern per sign</td></tr>
<tr><td>FP6 E3M2</td><td>1 / 3 / 2</td><td>3</td><td>3</td><td>0.25</td><td>0.9</td><td>28</td><td>0.25</td><td>OCP MX block formats. No ∞ or NaN</td></tr>
<tr><td>FP6 E2M3</td><td>1 / 2 / 3</td><td>1</td><td>4</td><td>0.125</td><td>1.2</td><td>7.5</td><td>1</td><td>OCP MX block formats. No ∞ or NaN</td></tr>
<tr><td>FP4 E2M1</td><td>1 / 2 / 1</td><td>1</td><td>2</td><td>0.5</td><td>0.6</td><td>6</td><td>1</td><td>Inference weights (MXFP4, NVFP4). No ∞ or NaN</td></tr>
</table></div>

<h3 id="sec-read">How to Read the Table</h3>
<ul>
<li><strong>Exponent bits set the range.</strong> FP32, TF32, and BF16 share 8 exponent bits and so share FP32’s range. FP16’s 5-bit exponent is why it overflows at 65,504.</li>
<li><strong>Fraction bits set the precision.</strong> TF32 and FP16 share 10 fraction bits and so share FP16’s precision.</li>
<li><strong>So the ML formats are mixes:</strong> TF32 is “FP32 range, FP16 precision,” and BF16 is “FP32 range, less precision than FP16.”</li>
<li><strong>The tiny formats are enumerable.</strong> FP4 is small enough to list every value: ±{0, 0.5, 1, 1.5, 2, 3, 4, 6}. Its 16 bit patterns encode 15 distinct values (+0 and −0 are both zero).</li>
<li><strong>Dynamic range in binades</strong> (powers of two from min normal to max) is a quick way to compare: FP16 covers 30, BF16 covers 254, E4M3 covers 15, and E5M2 covers 30.</li>
</ul>
<p>The details of BF16, TF32, and the 8-bit and smaller formats are on <a href="#/fp-ml-formats">Low-Precision ML Formats</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An activation value of 1.0 × 10<sup>−6</sup> is stored in FP16. Is it normal or subnormal, what value is actually stored, and what is the relative error? Compare with the worst case for a normal FP16 number.</p>`,
        a: `<ol><li>FP16’s smallest normal is 2<sup>−14</sup> ≈ 6.1 × 10<sup>−5</sup>, so 10<sup>−6</sup> is <strong>subnormal</strong>.</li><li>Subnormals are spaced 2<sup>−14 − 10</sup> = 2<sup>−24</sup> ≈ 5.96 × 10<sup>−8</sup> apart.</li><li>10<sup>−6</sup> / 5.96 × 10<sup>−8</sup> = 16.78, which rounds to 17. Stored value: 17 × 2<sup>−24</sup> ≈ <strong>1.013 × 10<sup>−6</sup></strong>.</li><li>Relative error: 1.3%. A normal FP16 number is off by at most 2<sup>−11</sup> ≈ 0.05%, so this value is about 27× less precise. Its significand has only 5 significant bits (17 = 10001<sub>2</sub>).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>FP8 E4M3 has a 4-bit exponent with bias 7, the same as an IEEE-style format would have, yet its maximum is 448 rather than the 240 an IEEE-style E4M3 would give. Derive both numbers and explain the design choice. Why doesn’t E5M2 do the same?</p>`,
        a: `<p>IEEE-style: the all-ones exponent (15) is reserved for ∞ and NaN, so the largest exponent is 14 − 7 = 7 and the largest significand is 1.111<sub>2</sub> = 1.875, giving 1.875 × 2<sup>7</sup> = <strong>240</strong>.</p><p>OCP E4M3 gives up ∞ and keeps only one NaN pattern per sign (exponent 1111 with fraction 111). Exponent 15 then holds normal numbers, so the largest exponent is 15 − 7 = 8 and the largest usable significand is 1.110<sub>2</sub> = 1.75, giving 1.75 × 2<sup>8</sup> = <strong>448</strong>. With only 15 binades, one more binade is a 7% gain in range, worth more than ∞ for weights and activations, which are scaled to fit anyway.</p><p>E5M2 already has 30 binades and is a truncated FP16 (its bit pattern is the top byte of an FP16), so it keeps IEEE rules: max 1.75 × 2<sup>15</sup> = 57,344, with ∞ and NaN. That makes FP16 ↔ E5M2 conversion trivial.</p>`
      }
    ]
  }
},

{
  id: "fp-rounding",
  region: "arith",
  title: "Rounding, Exceptions, and Error",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Appendix J, Computer Arithmetic (rounding, guard and sticky bits, exceptions). Nicholas Higham, <em>Accuracy and Stability of Numerical Algorithms</em> (2nd ed.), Chapter 4, Summation. Agner Fog, <em>The Microarchitecture of Intel, AMD, and VIA CPUs</em>, for measured subnormal penalties.`,
  sections: [
    { id: "modes", label: "Rounding Modes" },
    { id: "grs", label: "Guard, Round, and Sticky Bits" },
    { id: "exceptions", label: "The Five Exceptions" },
    { id: "subnormal", label: "Subnormals and Flush to Zero" },
    { id: "assoc", label: "Non-Associativity and Reproducibility" },
    { id: "sum", label: "Summation Error and Kahan Summation" }
  ],
  body: `
<h3 id="sec-modes">Rounding Modes</h3>
<p>IEEE 754 requires every basic operation (add, subtract, multiply, divide, square root, FMA, convert) to be <strong>correctly rounded</strong>: the result is the exact answer rounded once, as if computed with infinite precision. The rounding mode picks which neighbor wins:</p>
<ul>
<li><strong>Round to nearest, ties to even (RNE):</strong> the default everywhere. On a tie, pick the neighbor whose last bit is 0, so ties round up half the time and down half the time and don’t bias long sums.</li>
<li><strong>Round toward zero (truncation):</strong> what C’s float-to-int cast does. Cheapest in hardware, but biased.</li>
<li><strong>Round toward +∞ and toward −∞:</strong> used in interval arithmetic to compute guaranteed upper and lower bounds.</li>
<li><strong>Round to nearest, ties away from zero:</strong> required for decimal formats, optional for binary.</li>
<li><strong>Stochastic rounding</strong> (not in IEEE 754): round up with probability equal to the dropped fraction of an ULP. The error is zero in expectation, so tiny updates survive on average instead of always rounding away. Graphcore IPUs support it in hardware, and it’s used for low-precision training.</li>
</ul>
<p>The mode lives in a control register (<code>MXCSR</code> for SSE and AVX on x86, <code>FPCR</code> on Arm, <code>fcsr</code> on RISC-V), and AVX-512 and RISC-V can also encode it per instruction. Changing a global control register is serializing on many cores, so code that switches modes in a hot loop runs slowly.</p>

<h3 id="sec-grs">Guard, Round, and Sticky Bits</h3>
<p>Hardware doesn’t keep the infinitely precise result. It keeps <em>p</em> bits plus three more, which is enough to round correctly:</p>
<ul>
<li><strong>Guard (G):</strong> the first bit below the kept LSB, worth half an ULP.</li>
<li><strong>Round (R):</strong> the next bit, needed because normalizing after a subtraction can shift left by one and pull G into the result.</li>
<li><strong>Sticky (S):</strong> the OR of every bit below R. It records only whether anything nonzero was dropped.</li>
</ul>
<p>For RNE, round up when G = 1 and at least one of R, S, or the kept LSB is 1. G = 1 with R = S = 0 is an exact tie, settled by the LSB. The sticky bit is cheap to compute in parallel with alignment (OR the bits the aligner shifts out), which is why FPUs never need the full-width exact result.</p>
<p><strong>Double rounding.</strong> Rounding first to a wider format and then to a narrower one can differ from rounding once. The classic case was x87, which computed in 80 bits and then stored to 64. A result just above a 64-bit tie could round down to exactly the tie in 80 bits, then round to even in 64 bits, ending up 1 ULP off. SSE2 and later compute each operation in its own format, which is one reason x86-64 code is more reproducible than 32-bit x87 code.</p>

<h3 id="sec-exceptions">The Five Exceptions</h3>
<div class="tbl"><table>
<tr><th>Exception</th><th>Raised when</th><th>Default result</th></tr>
<tr><td>Invalid operation</td><td>0 / 0, ∞ − ∞, 0 × ∞, √−1, any op on a signaling NaN</td><td>Quiet NaN</td></tr>
<tr><td>Division by zero</td><td>Finite nonzero / 0 (also log(0))</td><td>±∞</td></tr>
<tr><td>Overflow</td><td>The rounded result exceeds the max normal</td><td>±∞ (or max normal, depending on the rounding mode)</td></tr>
<tr><td>Underflow</td><td>The result is tiny (below the min normal) and inexact</td><td>Subnormal or 0</td></tr>
<tr><td>Inexact</td><td>The rounded result differs from the exact result</td><td>The rounded result</td></tr>
</table></div>
<p>By default nothing traps: each exception sets a <strong>sticky flag</strong> in the status register and computation continues with the default result. Software checks the flags afterwards (<code>fetestexcept</code> in C). Inexact is set by nearly every operation, so it is almost never unmasked. Precise traps are expensive for an out-of-order core: the FPU must report the exception with the instruction so it is taken at retirement, like a page fault. With traps masked, the flags are just a few bits ORed together at retirement.</p>

<h3 id="sec-subnormal">Subnormals and Flush to Zero</h3>
<p>Subnormal operands and results need extra work: a missing hidden bit, a leading-zero count and normalizing shift on input, and a denormalizing shift on output. Many cores handle the common cases in the FMA pipeline and send the rest to a slow path:</p>
<ul>
<li><strong>Intel big cores</strong> send these cases to a <strong>microcode assist</strong>, which flushes the pipeline. Agner Fog measures about 140–150 cycles on Sandy Bridge, 124 on Haswell and Broadwell, 129 on Skylake, and 120 on Ice Lake. The penalty applies when an operation on normal numbers produces a subnormal result, and to a multiply (Skylake onward, also a divide) of a normal by a subnormal. Adding a normal and a subnormal costs nothing extra.</li>
<li><strong>AMD Zen 3, Zen 4, and Zen 5</strong> handle subnormals in hardware, and a subnormal result costs only a few extra cycles. AMD’s earlier Bulldozer and Piledriver paid about 175 cycles. Full hardware support costs extra shifter area and sometimes an extra pipeline cycle.</li>
<li><strong>Flush to zero (FTZ)</strong> replaces subnormal results with zero. <strong>Denormals are zero (DAZ)</strong> treats subnormal inputs as zero. On x86 they are bits 15 and 6 of <code>MXCSR</code>. On Arm, <code>FPCR.FZ</code> does both.</li>
<li>GCC and Clang set FTZ and DAZ at program startup when linking with <code>-ffast-math</code>, which changes results for the whole process, including libraries that weren’t compiled with it.</li>
</ul>
<p><strong>For a performance model:</strong> a benchmark whose values decay toward zero (IIR filters, physics damping, some neural-network layers) can slow down by an order of magnitude on cores with assists. The symptom is a high count of FP assist events, not a pipeline resource stall.</p>

<h3 id="sec-assoc">Non-Associativity and Reproducibility</h3>
<p>Each operation rounds, so the order of operations changes the result. In FP32, (10<sup>8</sup> + 1) − 10<sup>8</sup> = 0 because the ULP at 10<sup>8</sup> is 8 and the 1 rounds away, but (10<sup>8</sup> − 10<sup>8</sup>) + 1 = 1. Consequences:</p>
<ul>
<li><strong>Compilers can’t vectorize a reduction</strong> such as <code>s += x[i]</code> without permission, because splitting it into lanes reorders the additions. <code>-ffast-math</code> or <code>-fassociative-math</code> grants it, as does <code>#pragma omp simd reduction(+:s)</code>.</li>
<li><strong>Parallel reductions aren’t deterministic</strong> unless the reduction order is fixed. GPU atomics and dynamically scheduled threads make results vary run to run.</li>
<li><strong>FMA contraction changes bits.</strong> Compilers may fuse <code>a * b + c</code> into an FMA (<code>-ffp-contract</code>), so the same source gives different results with and without FMA hardware. It can even break symmetry: with x == y, <code>x * x - y * y</code> becomes <code>fma(x, x, -(y * y))</code>, which returns the rounding error of y × y instead of 0.</li>
<li><strong>Catastrophic cancellation:</strong> subtracting two nearly equal numbers is exact, but it exposes the error already in them. Every leading bit that cancels is a bit of accuracy lost.</li>
</ul>

<h3 id="sec-sum">Summation Error and Kahan Summation</h3>
<p>For a sum of <em>n</em> values with unit roundoff u = ε/2, the worst-case error bounds are:</p>
<div class="tbl"><table>
<tr><th>Method</th><th>Error bound (relative to Σ|x<sub>i</sub>|)</th><th>Cost</th></tr>
<tr><td>Recursive (one running sum)</td><td>≈ (<em>n</em> − 1) u</td><td>1 add per element</td></tr>
<tr><td>Pairwise (tree)</td><td>≈ log<sub>2</sub> <em>n</em> × u</td><td>1 add per element, needs blocking</td></tr>
<tr><td>Kahan (compensated)</td><td>≈ 2u, independent of <em>n</em></td><td>4 adds per element, one dependent chain</td></tr>
<tr><td>Wider accumulator</td><td>The wider format’s u times <em>n</em></td><td>Conversion, wider adder</td></tr>
</table></div>
<p>Vectorized and multi-accumulator sums are partly pairwise for free: 8 lanes × 4 accumulators split the sum into 32 shorter chains. Kahan summation keeps a compensation term holding the low-order bits each add drops:</p>
<pre><code>float kahan_sum(const float *x, size_t n) {
    float sum = 0.0f, c = 0.0f;          <span class="cm">// c holds the bits lost so far</span>
    for (size_t i = 0; i &lt; n; i++) {
        float y = x[i] - c;
        float t = sum + y;
        c = (t - sum) - y;               <span class="cm">// what the add just rounded away</span>
        sum = t;
    }
    return sum;
}</code></pre>
<p>Under <code>-ffast-math</code> the compiler may simplify <code>(t - sum) - y</code> to 0 and silently turn this back into a naive sum. The same idea in hardware is why matrix units accumulate in FP32 even when the inputs are BF16 or FP8.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Using guard, round, and sticky bits, round each exact FP32 sum with RNE:</p><ul><li>(a) 1.0 + 2<sup>−24</sup></li><li>(b) (1 + 2<sup>−23</sup>) + 2<sup>−24</sup></li><li>(c) 1.0 + 3 × 2<sup>−25</sup></li></ul>`,
        a: `<ol><li>Near 1.0 the ULP is 2<sup>−23</sup>, so G is worth 2<sup>−24</sup>, R is worth 2<sup>−25</sup>, and S covers everything below.</li><li><strong>(a)</strong> The dropped part is exactly 2<sup>−24</sup>: G = 1, R = 0, S = 0, a tie. The kept LSB of 1.0 is 0 (even), so the result stays <strong>1.0</strong>.</li><li><strong>(b)</strong> Again G = 1, R = S = 0, a tie, but now the kept LSB is 1 (odd), so it rounds up to <strong>1 + 2<sup>−22</sup></strong>.</li><li><strong>(c)</strong> 3 × 2<sup>−25</sup> = 2<sup>−24</sup> + 2<sup>−25</sup>: G = 1, R = 1, so it’s more than half an ULP and rounds up to <strong>1 + 2<sup>−23</sup></strong>.</li><li>Takeaway: (a) and (b) add the same amount, but (a) moves the result by 0 ULPs and (b) by 1 ULP. Ties to even balances the errors across many operations.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A power model accumulates core energy each cycle in an FP32 variable, in nanojoules. The core draws 5 W at 4 GHz, so each cycle adds 1.25 nJ. When does the total stop growing, how much simulated time is that, and what happens to accuracy before then?</p>`,
        a: `<p>An add of 1.25 is lost when 1.25 is less than half an ULP of the sum. ULP = 2<sup>k − 23</sup> for a sum in [2<sup>k</sup>, 2<sup>k+1</sup>):</p><ul><li>Below 2<sup>22</sup>: ULP ≤ 0.25, so 1.25 (= 1.01<sub>2</sub>) is added exactly.</li><li>[2<sup>22</sup>, 2<sup>23</sup>): ULP 0.5, so every sum + 1.25 is an exact tie and adds 1.0 or 1.5 depending on the even bit, averaging 1.25.</li><li>[2<sup>23</sup>, 2<sup>24</sup>): ULP 1, so 1.25 rounds to 1. The total grows 20% too slowly.</li><li>[2<sup>24</sup>, 2<sup>25</sup>): ULP 2, so 1.25 is 0.625 ULP and rounds up to 2. The total grows 60% too fast.</li><li>At 2<sup>25</sup>: ULP 4, so 1.25 is under half an ULP and rounds away. The total <strong>stops at 2<sup>25</sup> nJ ≈ 33.6 mJ</strong>.</li></ul><p>33.6 mJ / 5 W ≈ <strong>6.7 ms</strong> of simulated time, about 27 million cycles. A billion-cycle run would report roughly 33.6 mJ instead of 1.25 J. Fixes: accumulate in <code>double</code> (good to 2<sup>53</sup>), accumulate per interval and sum the intervals, or count events in integers and multiply by the per-event energy at the end, which is also how real power models work.</p>`
      },
      {
        q: `<p>An HPC code slows down 8× on one input set, with no change in instruction count or cache misses. The hot loop is an exponentially decaying recurrence <code>y = 0.999f * y + x[i]</code> with mostly zero <code>x</code>, and <code>y</code> starts near 1.0. The machine is a Skylake server, where a normal FP multiply-add takes 4 cycles and an operation that needs a microcode assist takes about 129 cycles. What is happening and how do you confirm and fix it?</p>`,
        a: `<p>With x mostly zero, y decays toward zero geometrically. In FP32, 0.999<sup>n</sup> reaches the smallest normal (1.18 × 10<sup>−38</sup>) from 1.0 after about ln(1.18 × 10<sup>−38</sup>) / ln(0.999) ≈ 87,000 iterations, and from then on y is subnormal. Each iteration then multiplies a normal (0.999) by a subnormal, which takes a microcode assist on Intel big cores: about 129 cycles on this Skylake, against 4 cycles for the normal multiply-add, roughly 32× slower per iteration. That explains a large slowdown with no change in instructions or misses. On Zen 4 the same loop would barely slow down.</p><p>Confirm with the FP assist counter (on Intel, <code>FP_ASSIST.ANY</code> or the newer <code>ASSISTS.FP</code>), or by checking that the slowdown disappears with FTZ and DAZ set. Fixes: set FTZ and DAZ for the thread if the algorithm tolerates it, clamp tiny values to zero explicitly, or add a tiny offset (the “denormal killer” trick in audio DSP).</p>`
      }
    ]
  }
},

{
  id: "fp-ml-formats",
  region: "arith",
  title: "Low-Precision ML Formats",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 7, Domain-Specific Architectures, for bfloat16 on Google’s TPU.`,
  sections: [
    { id: "bf16", label: "BF16 (bfloat16)" },
    { id: "tf32", label: "TF32 and “BF32”" },
    { id: "fp8", label: "FP8, FP6, FP4 and Block Scaling" }
  ],
  body: `
<h3 id="sec-bf16">BF16 (bfloat16)</h3>
<p>Google Brain designed bfloat16 for the TPU (the “b” is for Brain). The design rule: keep FP32’s 8-bit exponent, cut the fraction from 23 to 7 bits. Three consequences make it the default ML training format:</p>
<ul>
<li><strong>Same range as FP32.</strong> Tiny gradients don’t underflow and big activations don’t overflow, so training needs no loss scaling (FP16 does).</li>
<li><strong>Conversion is almost free.</strong> BF16 → FP32 appends 16 zero bits. FP32 → BF16 rounds and keeps the top 16 bits. No exponent re-biasing, no range checks.</li>
<li><strong>The multiplier is tiny.</strong> An 8 × 8-bit significand multiplier versus 24 × 24 for FP32 (see <a href="#/fp-units/hw">the area table</a>).</li>
</ul>
<p>The cost is precision: 8 bits, about 2.4 decimal digits. Neural networks tolerate that in individual multiplies, but not in long sums or in small weight updates. Two consequences:</p>
<ul>
<li><strong>Accumulate in FP32.</strong> Every BF16 matrix unit (AVX-512 <code>VDPBF16PS</code>, Arm <code>BFMMLA</code>, Intel AMX, GPU tensor cores) multiplies BF16 pairs but adds into FP32.</li>
<li><strong>Keep FP32 master weights.</strong> A weight near 1.0 has a BF16 ULP of 2<sup>−7</sup>, so any update smaller than half of that (2<sup>−8</sup> ≈ 0.0039) rounds away completely. Optimizers keep an FP32 copy (or use stochastic rounding) and cast to BF16 for the forward and backward passes.</li>
</ul>
<p><strong>FP32 → BF16 in C,</strong> with round to nearest, ties to even:</p>
<pre><code>uint16_t fp32_to_bf16(float f) {
    uint32_t x;
    memcpy(&amp;x, &amp;f, sizeof x);
    if ((x &amp; 0x7FFFFFFF) &gt; 0x7F800000)    <span class="cm">// NaN: keep it NaN (force quiet bit)</span>
        return (uint16_t)((x &gt;&gt; 16) | 0x0040);
    x += 0x7FFF + ((x &gt;&gt; 16) &amp; 1);        <span class="cm">// add just under half an ULP, plus 1 if the kept LSB is odd</span>
    return (uint16_t)(x &gt;&gt; 16);           <span class="cm">// a carry out of the fraction bumps the exponent, as it should</span>
}</code></pre>
<p><strong>Example:</strong> 1/3 in FP32 is <code>0x3EAAAAAB</code>. The dropped half <code>0xAAAB</code> is above <code>0x8000</code>, so it rounds up to <code>0x3EAB</code> = 0.333984375. Plain truncation would give <code>0x3EAA</code> = 0.33203125, more than twice the error, and always biased toward zero, which adds up in training.</p>
<p><strong>Subnormals:</strong> the format has them, but many BF16 instructions flush subnormal inputs and outputs to zero and always round to nearest even, ignoring the FP control register. That’s cheap and rarely matters given the 10<sup>−38</sup> range.</p>

<h3 id="sec-tf32">TF32 and “BF32”</h3>
<p><strong>TF32 is a compute mode, not a storage format.</strong> NVIDIA introduced it with the A100’s tensor cores: tensors stay FP32 in memory and registers, the tensor core reads only the sign, 8 exponent bits, and the top 10 fraction bits of each input, multiplies at that precision, and accumulates in FP32. Code written for FP32 gets several times the throughput with no changes. The price is FP16-level precision in the products. Frameworks make it opt-in for matmuls (in PyTorch, <code>torch.set_float32_matmul_precision("high")</code>).</p>
<p><strong>“BF32” is not an IEEE or industry storage format.</strong> The name shows up as the same trick on Intel CPUs: Intel’s PyTorch extension offers a BF32 FP32-math mode, and oneDNN has an equivalent “fpmath mode” of bf16. Tensors stay FP32, but matmul and convolution inputs are converted to BF16 and run on AMX or AVX-512 BF16 units with FP32 accumulation. It’s Intel’s counterpart to TF32, with 8 bits of precision instead of 11.</p>
<p><strong>Getting FP32 accuracy from BF16 hardware.</strong> Split each FP32 value into a sum of BF16 pieces, x ≈ x<sub>0</sub> + x<sub>1</sub> + x<sub>2</sub>, where x<sub>0</sub> is x rounded to BF16, x<sub>1</sub> is the remainder rounded to BF16, and so on. Then multiply the pieces and drop the smallest cross terms: three BF16 products (“bf16x3”) give close to FP32 accuracy, six give about full FP32. On Google TPUs, JAX exposes these as precision levels. It trades matmul throughput for accuracy without needing FP32 multipliers.</p>

<h3 id="sec-fp8">FP8, FP6, FP4 and Block Scaling</h3>
<p>Below 16 bits the range is too small to use the raw numbers directly, so every low-precision format comes with <strong>scale factors</strong>: store x / s in FP8 or FP4 and keep s separately.</p>
<ul>
<li><strong>FP8 comes in two flavors</strong> (NVIDIA, Arm, and Intel’s 2022 proposal, first in hardware on the H100). E4M3 has more precision and is used for weights and activations. E5M2 has more range and is used for gradients. Hopper-style FP8 training uses one FP32 scale per tensor, chosen from recent maximum values.</li>
<li><strong>Finer scaling helps.</strong> One outlier forces a per-tensor scale to squash everything else toward zero. Fine-grained schemes give each small block its own scale: DeepSeek-V3 trained in FP8 with one scale per 1 × 128 tile of activations and per 128 × 128 block of weights.</li>
<li><strong>OCP Microscaling (MX) formats</strong> standardize this: a block of 32 elements (FP8, FP6, FP4, or INT8) shares one 8-bit power-of-two scale (E8M0: exponent only, no sign or fraction). MXFP4 therefore costs 4 + 8/32 = 4.25 bits per value.</li>
<li><strong>NVFP4</strong> (Blackwell) uses 16-element blocks with an FP8 E4M3 scale (finer than a power of two), plus one FP32 scale per tensor: 4 + 8/16 = 4.5 bits per value.</li>
<li><strong>INT8 and INT4</strong> are the integer alternative: uniformly spaced values with a scale and sometimes a zero point. They suit weights with a narrow, even distribution, while the FP formats handle outliers better because their spacing grows with magnitude.</li>
</ul>
<p>Hardware handles the scale cheaply: power-of-two scales just add to the exponent, and per-block scales are applied once per block of products inside the dot product, not per element.</p>
<p class="refs">Further reading:</p><ul class="refs"><li>Kalamkar et al., “A Study of BFLOAT16 for Deep Learning Training” (2019)</li><li>Micikevicius et al., “Mixed Precision Training” (ICLR 2018) and “FP8 Formats for Deep Learning” (2022)</li><li>Open Compute Project, “OCP Microscaling Formats (MX) v1.0 Specification” (2023)</li><li>NVIDIA, “NVIDIA A100 Tensor Core GPU Architecture” whitepaper, for TF32</li><li>DeepSeek-AI, “DeepSeek-V3 Technical Report” (2024), for fine-grained FP8 training</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Llama 3 sets its RoPE base frequency <code>rope_theta</code> to 500,000. What value does that constant actually have if it’s stored in FP16? In BF16? In FP32?</p>`,
        a: `<ol><li><strong>FP16:</strong> the largest finite value is 65,504, so 500,000 overflows to <strong>+∞</strong>. Every frequency computed from it is garbage.</li><li><strong>BF16:</strong> 2<sup>18</sup> = 262,144 ≤ 500,000 &lt; 2<sup>19</sup>, so the exponent is 18 and the spacing is 2<sup>18 − 7</sup> = 2,048. 500,000 / 2,048 = 244.14, which rounds to 244, so BF16 stores 244 × 2,048 = <strong>499,712</strong> (0.06% low).</li><li><strong>FP32:</strong> 500,000 &lt; 2<sup>24</sup>, and every integer below 2<sup>24</sup> is exact, so it is stored <strong>exactly</strong>.</li><li>Takeaway: this is why position-encoding frequencies are computed in FP32 even when the model runs in BF16. BF16’s range was fine, but its precision wasn’t.</li></ol>`
      },
      {
        q: `<p>DeepSeek-V3 has 671 billion parameters and was released with FP8 weights that carry one FP32 scale per 128 × 128 block. Can the weights fit on one 8 × H200 server (141 GB of HBM per GPU) in FP8? In BF16? How much memory is left for the KV cache and activations?</p>`,
        a: `<ol><li>Server memory: 8 × 141 = 1,128 GB.</li><li>BF16: 671 × 10<sup>9</sup> × 2 bytes = 1,342 GB. <strong>Doesn’t fit.</strong> It needs two servers or more aggressive quantization.</li><li>FP8: 671 GB for the values. The scales add 4 bytes per 128 × 128 = 16,384 values, about 0.02%, so roughly 671 GB total. <strong>Fits.</strong></li><li>Left over: about 1,128 − 671 ≈ <strong>457 GB</strong> for the KV cache, activations, and runtime buffers (in practice somewhat less after framework overhead).</li><li>Takeaway: the number format decides how many GPUs a deployment needs, which matters more for cost than the FLOPs it saves.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Mixed-precision training in FP16 needs loss scaling, but BF16 training usually doesn’t. Explain why, using a gradient value of 2 × 10<sup>−8</sup>.</p>`,
        a: `<p>FP16 has a 5-bit exponent: its smallest normal is 6.1 × 10<sup>−5</sup> and its smallest subnormal is 2<sup>−24</sup> ≈ 5.96 × 10<sup>−8</sup>. A gradient of 2 × 10<sup>−8</sup> is less than half the smallest subnormal, so it rounds to <strong>zero</strong>, and many small gradients vanish the same way. Loss scaling multiplies the loss by a large factor (for example 2<sup>16</sup>) before the backward pass, which lifts the gradient to about 1.3 × 10<sup>−3</sup>, comfortably representable. The optimizer divides the factor back out in FP32, and dynamic schemes lower the factor whenever a gradient overflows to ∞.</p><p>BF16 has FP32’s 8-bit exponent, with normals down to 1.18 × 10<sup>−38</sup>, so 2 × 10<sup>−8</sup> is an ordinary normal number. It loses precision (8 bits) but not the value. The trade-off: FP16 has 3 more bits of precision, so with loss scaling it can be slightly more accurate per operation.</p>`
      },
      {
        q: `<p>A naive kernel computes a dot product over K = 8,192 (Llama 3 70B’s hidden size) where every product is about 1.0, but it keeps the running sum in BF16. What does it return, and how do real matrix units avoid this?</p>`,
        a: `<p>It returns about <strong>256</strong>, not 8,192. From 128 to 256 the BF16 spacing is 2<sup>7 − 7</sup> = 1, so adding 1 is exact. At 256 the spacing becomes 2<sup>8 − 7</sup> = 2. 256 + 1 = 257 is exactly halfway between 256 and 258, and ties go to the even significand, which is 256. Every later addition rounds back to 256, so the sum stalls (this is called swamping).</p><p>Real hardware multiplies in BF16 (or FP8) but accumulates in FP32, where the stall point is 2<sup>24</sup>. Long reductions also sum in blocks or trees (for example per tile, then across tiles), which keeps the partial sums similar in size and reduces rounding error further.</p>`
      }
    ]
  }
},

{
  id: "fixed-point",
  region: "arith",
  title: "Fixed Point and Integer Quantization",
  book: `Sources: Jacob et al., “Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference” (CVPR 2018). Intel 64 and IA-32 Architectures Software Developer’s Manual, for <code>VPMADDUBSW</code> and <code>VPDPBUSD</code>. Arm Architecture Reference Manual, for <code>SQRDMULH</code>, <code>SDOT</code>, and <code>SMMLA</code>.`,
  sections: [
    { id: "q", label: "Q Formats" },
    { id: "ops", label: "Fixed-Point Arithmetic" },
    { id: "where", label: "Where Fixed Point Is Used" },
    { id: "quant", label: "Integer Quantization for ML" },
    { id: "hw", label: "INT8 Dot-Product Hardware" }
  ],
  body: `
<h3 id="sec-q">Q Formats</h3>
<p>A fixed-point number is an integer with an implied binary point. In <strong>Qm.n</strong> notation a signed value has m integer bits and n fraction bits after the sign bit, so it fits in 1 + m + n bits and represents the integer stored divided by 2<sup>n</sup>.</p>
<ul>
<li><strong>Range:</strong> −2<sup>m</sup> to 2<sup>m</sup> − 2<sup>−n</sup>.</li>
<li><strong>Resolution:</strong> 2<sup>−n</sup> everywhere. The <em>absolute</em> error is constant, where floating point keeps the <em>relative</em> error constant.</li>
<li><strong>Common formats:</strong> Q15 (Q0.15, 16 bits, range [−1, 1)) and Q31 (32 bits) in DSP and audio, and Q16.16 in older graphics and game engines.</li>
</ul>
<p>The format is a convention between the programmer and the code. The hardware only sees integers, so nothing checks that two operands share a binary point.</p>

<h3 id="sec-ops">Fixed-Point Arithmetic</h3>
<ul>
<li><strong>Add and subtract:</strong> ordinary integer adds, once both operands have the same n. Aligning different formats is a shift.</li>
<li><strong>Multiply:</strong> Qa.b × Qc.d gives Q(a+c).(b+d) in twice the width. To return to the input format, shift right by the extra fraction bits, adding half an LSB first to round to nearest instead of truncating toward −∞.</li>
<li><strong>Saturate, don’t wrap:</strong> integer overflow wraps around, which turns a loud audio sample into a loud click of the opposite sign. DSP code clamps to the largest or smallest value instead, and most ISAs have saturating instructions for it (Arm <code>QADD</code>, x86 <code>PADDSW</code>).</li>
<li><strong>Divide:</strong> rare and slow, as with integers. It’s usually replaced by multiplying with a precomputed reciprocal.</li>
</ul>
<p><strong>Q15 multiply in C,</strong> rounding and saturating (what Arm’s <code>SQRDMULH</code> does in one instruction):</p>
<pre><code>int16_t q15_mul(int16_t a, int16_t b) {
    int32_t p = (int32_t)a * b;           <span class="cm">// Q30 product</span>
    p = (p + (1 &lt;&lt; 14)) &gt;&gt; 15;            <span class="cm">// round to nearest, back to Q15</span>
    if (p &gt; INT16_MAX) p = INT16_MAX;     <span class="cm">// only (-1) * (-1) overflows</span>
    return (int16_t)p;
}</code></pre>
<p>−1 × −1 is the one overflow: in Q15, −1 is representable but +1 is not, so the product saturates to 0.99997.</p>

<h3 id="sec-where">Where Fixed Point Is Used</h3>
<ul>
<li><strong>Cores without an FPU:</strong> Arm Cortex-M0 and M3 class microcontrollers, where software floating point costs tens to hundreds of cycles per operation.</li>
<li><strong>DSP, audio, and radio:</strong> filters and FFTs with known signal ranges, where fixed point gives more precision per bit than a float of the same width.</li>
<li><strong>Determinism:</strong> integer arithmetic gives bit-identical results on every compiler and ISA, which is why lockstep game simulations and some financial code use it.</li>
<li><strong>Hardware structures:</strong> predictors and replacement policies that need weights or counters use small saturating integers. Perceptron branch predictors, for example, keep 8-bit signed weights and sum them with an integer adder tree.</li>
<li><strong>ML inference:</strong> integer quantization, below.</li>
</ul>

<h3 id="sec-quant">Integer Quantization for ML</h3>
<p>Quantization maps real values onto integers with an <strong>affine</strong> mapping, a scale s and a zero point z:</p>
<p class="eq">x ≈ s × (q − z)</p>
<ul>
<li><strong>Symmetric</strong> (z = 0): the usual choice for weights, whose distribution is centered on zero. INT8 then uses −127 to 127.</li>
<li><strong>Asymmetric</strong> (z ≠ 0): for activations that are all non-negative after a ReLU, so all 256 UINT8 codes are used.</li>
<li><strong>Granularity:</strong> one scale per tensor, per output channel, or per group of consecutive weights. Weight-only INT4 schemes such as GPTQ and AWQ typically use groups of 128. A group with a 16-bit scale costs 16 / g extra bits per weight, for example 4 + 16/64 = 4.25 bits with groups of 64.</li>
</ul>
<p><strong>An integer dot product.</strong> With symmetric weights, Σ x<sub>i</sub> w<sub>i</sub> = s<sub>x</sub> s<sub>w</sub> Σ (q<sub>x,i</sub> − z<sub>x</sub>) q<sub>w,i</sub>. The sum runs entirely in integer multiply-accumulates into INT32, and the z<sub>x</sub> term folds into a precomputed per-channel constant. The INT32 result is then <strong>requantized</strong> to INT8 for the next layer by multiplying by s<sub>x</sub> s<sub>w</sub> / s<sub>y</sub>. Integer-only pipelines represent that factor as a 32-bit fixed-point multiplier and a shift, so no floating point is needed at all.</p>
<p><strong>Integer or FP8?</strong> INT8’s evenly spaced codes suit narrow, well-behaved distributions. FP8’s spacing grows with magnitude, so it handles outliers better, which is why training and many LLM deployments moved to FP8 (see <a href="#/fp-ml-formats/fp8">FP8, FP6, FP4 and Block Scaling</a>).</p>

<h3 id="sec-hw">INT8 Dot-Product Hardware</h3>
<div class="tbl"><table>
<tr><th>Platform</th><th>Instruction or unit</th><th>What it computes</th></tr>
<tr><td>x86 (SSSE3, AVX2)</td><td><code>VPMADDUBSW</code></td><td>u8 × s8 products, adjacent pairs summed into <strong>saturating</strong> s16</td></tr>
<tr><td>x86 (AVX-512 VNNI, AVX-VNNI)</td><td><code>VPDPBUSD</code></td><td>4 u8 × s8 products summed into each s32 lane, in one instruction</td></tr>
<tr><td>x86 (AMX)</td><td>INT8 tile multiply</td><td>Matrix multiply of INT8 tiles into INT32 tiles</td></tr>
<tr><td>Arm (Armv8.2 dot product, Armv8.6 I8MM)</td><td><code>SDOT</code>, <code>UDOT</code>, <code>SMMLA</code></td><td>4-way dot products into s32, and 2 × 8 by 8 × 2 matrix multiply-accumulate</td></tr>
<tr><td>NVIDIA GPUs</td><td>INT8 tensor cores (Turing onward)</td><td>INT8 MMA into INT32. INT4 was supported on Turing and Ampere and dropped in Hopper</td></tr>
</table></div>
<p>A single integer MAC is much smaller and lower power than an FP MAC of the same width: no alignment shifter, no normalizer, no rounding. That’s the main reason inference accelerators favored INT8 before FP8 arrived.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A motor controller stores values in Q4.11 (16 bits). Compute 3.25 × −1.5, then 5 × 4, both returning Q4.11 with rounding and saturation.</p>`,
        a: `<ol><li>Q4.11 has range [−16, 16 − 2<sup>−11</sup>] and resolution 2<sup>−11</sup> ≈ 0.00049.</li><li>Encode: 3.25 × 2,048 = 6,656, and −1.5 × 2,048 = −3,072.</li><li>Multiply: 6,656 × −3,072 = −20,447,232, a Q8.22 value in 32 bits.</li><li>Shift back by 11 with rounding: (−20,447,232 + 1,024) &gt;&gt; 11 = −9,984 (the product was an exact multiple, so rounding doesn’t change it). −9,984 / 2,048 = <strong>−4.875</strong>, which is exact.</li><li>5 × 4: 10,240 × 8,192 = 83,886,080, and &gt;&gt; 11 gives 40,960. That’s more than the largest code, 32,767, so it saturates to 32,767 = <strong>15.9995</strong>. Without saturation, the low 16 bits of 40,960 read as −24,576 = −12.0.</li></ol>`
      },
      {
        q: `<p>Llama 3 70B has 70.6 billion parameters. How large are the weights in BF16, in INT8 with one FP32 scale per output channel (negligible overhead), and in INT4 with groups of 128 that each carry an FP16 scale and an FP16 zero point? Which of them fit on one 48 GB GPU, and how many 80 GB GPUs does BF16 need?</p>`,
        a: `<ol><li>BF16: 70.6 × 10<sup>9</sup> × 2 bytes = <strong>141.2 GB</strong>.</li><li>INT8: 70.6 GB, plus a few hundred kilobytes of scales, so about <strong>70.6 GB</strong>.</li><li>INT4: each group adds 16 + 16 = 32 bits for 128 weights, so 4 + 32/128 = 4.25 bits per weight. 70.6 × 10<sup>9</sup> × 4.25 / 8 ≈ <strong>37.5 GB</strong>.</li><li>Only INT4 fits on one 48 GB GPU (37.5 < 48, while 70.6 > 48). BF16 needs at least ⌈141.2 / 80⌉ = <strong>two 80 GB GPUs</strong>, before any room for the KV cache.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Before VNNI, x86 INT8 inference used <code>VPMADDUBSW</code> (u8 × s8, adjacent pairs summed into saturating s16) followed by <code>VPMADDWD</code> to widen to s32. Show that this can give wrong answers. Which inputs trigger it, and how did libraries work around it?</p>`,
        a: `<p>The largest pair sum is 255 × 127 + 255 × 127 = 64,770, and the most negative is 255 × (−128) × 2 = −65,280. s16 only holds −32,768 to 32,767, so any pair whose sum exceeds that saturates and the dot product is silently wrong. It needs large unsigned activations paired with large weights of the same sign, which is rare but does happen with outliers.</p><p>Workarounds: restrict weights to 7 bits (−64 to 63), so a pair is at most 255 × 63 × 2 = 32,130 and fits, at the cost of one bit of weight precision. Or shift activations into a smaller range. <code>VPDPBUSD</code> fixes it by summing 4 products directly into s32. The largest possible sum is 4 × 255 × 128 = 130,560, far from the s32 limits, and it’s one instruction instead of two or three.</p>`
      },
      {
        q: `<p>A perceptron branch predictor keeps 8-bit signed weights for each of 64 history bits plus a bias, and predicts taken if the dot product with the ±1 history is non-negative. Why integers rather than floats, and how wide must the adder tree’s output be?</p>`,
        a: `<p>Integers because:</p><ul><li>With ±1 inputs the “multiply” is just a conditional negate, and an integer adder tree is small and fast enough to fit in the prediction cycle budget.</li><li>Weights are trained with saturating ±1 updates, so they never need fractions.</li><li>Results are deterministic and easy to verify against a C model.</li></ul><p>Width: 65 terms each in [−128, 127] give a sum in [−8,320, 8,255]. That needs 15 bits signed, since 2<sup>13</sup> = 8,192 is too small and 2<sup>14</sup> = 16,384 covers it. In general, summing N values of b bits needs b + ⌈log<sub>2</sub> N⌉ bits: 8 + 7 = 15 here. Real designs also truncate low weight bits or use carry-save trees to meet timing, which a performance model can usually ignore but a timing model cannot.</p>`
      }
    ]
  }
},

{
  id: "int-units",
  region: "arith",
  title: "Integer Arithmetic Units",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Appendix J, Computer Arithmetic (carry-lookahead, carry-select, and carry-save adders, Booth recoding and multiplier trees, SRT division, the Pentium FDIV bug). Agner Fog, “Instruction Tables,” for the latencies below.`,
  sections: [
    { id: "adders", label: "Adders: Ripple Carry to Parallel Prefix" },
    { id: "shift", label: "Shifters and Bit Counting" },
    { id: "mul", label: "Multipliers" },
    { id: "div", label: "Dividers" },
    { id: "lat", label: "Measured Latencies" }
  ],
  body: `
<h3 id="sec-adders">Adders: Ripple Carry to Parallel Prefix</h3>
<p>An n-bit add is easy except for the carry, which can ripple from bit 0 to bit n − 1. Every fast adder is a way to compute carries in fewer than n gate delays. Each bit position defines</p>
<p class="eq">g<sub>i</sub> = a<sub>i</sub> b<sub>i</sub> (generate), &nbsp; p<sub>i</sub> = a<sub>i</sub> ⊕ b<sub>i</sub> (propagate), &nbsp; c<sub>i+1</sub> = g<sub>i</sub> + p<sub>i</sub> c<sub>i</sub>, &nbsp; s<sub>i</sub> = p<sub>i</sub> ⊕ c<sub>i</sub></p>
<ul>
<li><strong>Ripple carry:</strong> n full adders in a chain. Smallest, with delay linear in n.</li>
<li><strong>Carry lookahead:</strong> combine (g, p) pairs for groups of bits, (G, P) = (g<sub>1</sub> + p<sub>1</sub> g<sub>0</sub>, p<sub>1</sub> p<sub>0</sub>), so a group’s carry-out is known without waiting for its bits.</li>
<li><strong>Parallel prefix:</strong> apply that combine operator in a tree to get every carry in log<sub>2</sub> n levels. <strong>Kogge–Stone</strong> uses exactly log<sub>2</sub> n levels and n log<sub>2</sub> n − n + 1 combine cells, each with fanout 2, but needs many long wires. <strong>Brent–Kung</strong> uses 2 log<sub>2</sub> n − 1 levels and only 2n − 2 − log<sub>2</sub> n cells. <strong>Han–Carlson</strong> and <strong>Sklansky</strong> sit in between. For 64 bits: Kogge–Stone takes 6 levels and 321 cells, Brent–Kung 11 levels and 120 cells.</li>
<li><strong>Carry select:</strong> compute the upper half twice, for carry-in 0 and 1, and pick one when the real carry arrives.</li>
<li><strong>Carry save:</strong> to add three numbers, a row of full adders (3:2 compressors) produces a sum word and a carry word with no carry propagation at all. Only the final step needs a real adder. Multipliers and the FMA’s 3-input add are built this way.</li>
</ul>
<p>A 64-bit prefix adder fits in a fraction of a cycle at 5 GHz, which is why integer adds have 1-cycle latency. The harder part is the bypass network that gets the result back to the next adder in time.</p>

<h3 id="sec-shift">Shifters and Bit Counting</h3>
<ul>
<li><strong>Barrel (logarithmic) shifter:</strong> log<sub>2</sub> n stages of 2:1 muxes, stage k shifting by 2<sup>k</sup> when bit k of the amount is set. 6 stages for 64 bits, so shifts and rotates are also 1 cycle.</li>
<li><strong>Population count:</strong> a tree of adders over the bits, about log<sub>2</sub> n levels deep.</li>
<li><strong>Leading and trailing zero count:</strong> a priority encoder tree. The same logic normalizes FP results, and FPUs predict it in parallel with the add (the leading-zero anticipator, see <a href="#/fp-units/fma">Inside the FMA Pipeline</a>).</li>
</ul>
<p>Some cores give these a single cycle (Zen 4), others put them on the 3-cycle multiply port (Intel through Ice Lake), which matters for bit-manipulation-heavy code such as compression and chess engines.</p>

<h3 id="sec-mul">Multipliers</h3>
<p>An n × n multiply is a sum of n shifted partial products. Hardware speeds up both how many there are and how fast they’re summed:</p>
<ol>
<li><strong>Booth recoding (radix 4):</strong> recode the multiplier into digits in {−2, −1, 0, 1, 2}, each covering 2 bits. Every digit selects 0, ±a, or ±2a, all cheap (a shift and an invert), so there are only about n/2 + 1 partial products.</li>
<li><strong>Compressor tree:</strong> reduce the partial products with 3:2 compressors (Wallace or Dadda trees) or 4:2 compressors until two rows remain. Each level cuts the row count by about a third, so the depth grows with log<sub>1.5</sub> of the row count.</li>
<li><strong>Final adder:</strong> one carry-propagate adder of width 2n turns the two rows into the product.</li>
</ol>
<p>This pipelines into 3 cycles for a 64-bit multiply on modern x86 cores, with a new multiply accepted every cycle. The full 128-bit product (<code>MUL</code>, <code>MULX</code>) needs the upper half of the final adder and an extra result write.</p>

<h3 id="sec-div">Dividers</h3>
<p>Division produces quotient bits one digit at a time, and each digit depends on the remainder from the previous one, so it can’t be pipelined the way multiplication can.</p>
<ul>
<li><strong>Restoring and non-restoring:</strong> one quotient bit per iteration, a subtract and a sign check each time.</li>
<li><strong>SRT:</strong> a redundant quotient digit set (for radix 4, {−2, …, 2}) lets each digit be chosen from a few top bits of the remainder through a small lookup table, while the remainder stays in carry-save form. Radix 4 gives 2 bits per iteration. Radix 16 gives 4, often built as overlapped radix-4 stages.</li>
<li><strong>Newton–Raphson and Goldschmidt:</strong> iterate on the reciprocal with multiplies, doubling the correct bits each step. They reuse the multiplier and suit FP divide and square root, but the result needs a correction step to round correctly.</li>
<li><strong>Early out:</strong> integer dividers normalize first and skip leading quotient zeros, so small quotients finish sooner. That’s why divide latency is a range.</li>
</ul>
<p><strong>The Pentium FDIV bug (1994):</strong> 5 of the 1,066 entries in the original Pentium’s radix-4 SRT lookup table were missing, so some divisions were wrong from about the 4th significant decimal digit. The replacement program cost Intel $475 million and is a standard argument for formally verifying arithmetic units.</p>
<p><strong>Division by a constant</strong> never uses the divider: compilers multiply by a precomputed reciprocal and shift. For unsigned 32-bit x, x / 10 = (x × 0xCCCCCCCD) &gt;&gt; 35, where 0xCCCCCCCD = ⌈2<sup>35</sup> / 10⌉. Libraries such as libdivide do the same at run time for divisors that are fixed but not known at compile time.</p>

<h3 id="sec-lat">Measured Latencies</h3>
<div class="tbl"><table>
<tr><th>Operation</th><th>Intel Skylake</th><th>Intel Ice Lake</th><th>AMD Zen 4</th></tr>
<tr><td>Add, logic, shift (r64)</td><td>1</td><td>1</td><td>1</td></tr>
<tr><td><code>IMUL r64, r64</code></td><td>3</td><td>3</td><td>3</td></tr>
<tr><td><code>POPCNT</code>, <code>LZCNT</code></td><td>3</td><td>3</td><td>1</td></tr>
<tr><td><code>DIV r32</code></td><td>26</td><td>12</td><td>10–13</td></tr>
<tr><td><code>DIV r64</code></td><td>35–88</td><td>15</td><td>10–18</td></tr>
<tr><td><code>DIV r64</code> reciprocal throughput</td><td>21–83</td><td>10</td><td>7–12</td></tr>
</table></div>
<p>Latencies in cycles, from Agner Fog’s tables. Ice Lake’s new divider cut 64-bit divide latency by more than half, so a model calibrated on Skylake badly overestimates division-heavy code (hash tables with prime moduli, some compression codecs) on newer cores.</p>`,
  practice: {
    guided: [
      {
        q: `<p>For a 32-bit adder, how many prefix levels and combine cells do Kogge–Stone and Brent–Kung need? Which would you pick for an ALU on the critical bypass loop, and which for a low-power microcontroller?</p>`,
        a: `<ol><li>Kogge–Stone: log<sub>2</sub> 32 = <strong>5 levels</strong>, and 32 × 5 − 32 + 1 = <strong>129 cells</strong>.</li><li>Brent–Kung: 2 × 5 − 1 = <strong>9 levels</strong>, and 2 × 32 − 2 − 5 = <strong>57 cells</strong>.</li><li>A high-frequency core’s ALU picks Kogge–Stone (or a sparse variant such as Han–Carlson), because adder delay sits inside the 1-cycle add-to-dependent-add loop.</li><li>A microcontroller at a few hundred MHz has slack in the cycle, so Brent–Kung’s fewer cells and shorter wires save area and switching power.</li></ol>`
      },
      {
        q: `<p>GCC compiles unsigned 32-bit <code>x / 3</code> as <code>(x * 0xAAAAAAAB) &gt;&gt; 33</code> using a 64-bit product. Show where the constant comes from and check it for x = 100 and x = 4,294,967,295.</p>`,
        a: `<ol><li>2<sup>33</sup> / 3 = 2,863,311,530.67, so ⌈2<sup>33</sup> / 3⌉ = 2,863,311,531 = <code>0xAAAAAAAB</code>.</li><li>x = 100: 100 × 2,863,311,531 = 286,331,153,100. Divided by 2<sup>33</sup> = 8,589,934,592 that’s 33.33, which truncates to <strong>33</strong>.</li><li>x = 2<sup>32</sup> − 1: the product is 12,297,829,381,041,378,645 (it fits in 64 bits), and divided by 2<sup>33</sup> it’s 1,431,655,765.17, which truncates to <strong>1,431,655,765</strong>, the correct quotient.</li><li>The error of the rounded-up constant is small enough that it never reaches the next integer for any 32-bit x. That condition is what the compiler checks when it picks the shift amount.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 64 × 64 multiplier is built from a Dadda tree of 3:2 compressors. How many reduction levels does it need without Booth recoding and with radix-4 Booth? What does that say about what Booth recoding actually buys?</p>`,
        a: `<p>A Dadda tree reduces to the sequence of maximum heights 2, 3, 4, 6, 9, 13, 19, 28, 42, 63, 94, … and needs one level for each height below the starting row count.</p><ul><li>Without Booth: 64 rows. The heights below 64 are 63, 42, 28, 19, 13, 9, 6, 4, 3, 2, so <strong>10 levels</strong>.</li><li>Radix-4 Booth: about 64/2 + 1 = 33 rows. The heights below 33 are 28, 19, 13, 9, 6, 4, 3, 2, so <strong>8 levels</strong>.</li></ul><p>Booth halves the number of partial products, and so roughly halves the tree’s area and switching power, but saves only 2 of 10 levels of delay, because tree depth grows with the log of the row count. The recoding also adds a mux level up front. So Booth recoding is mostly an area and power win, and the latency win is modest. That’s why multiplier latency hasn’t improved much below 3 cycles, while multiplier count and width (more SIMD lanes) keep growing.</p>`
      },
      {
        q: `<p>A radix-4 SRT divider retires 2 quotient bits per cycle after 2 cycles of setup, with early out on leading zeros. Estimate the latency of dividing a 64-bit dividend of 2<sup>40</sup> by 1,000,000, then a full 64-bit quotient. What changes with a radix-16 divider, and why might a designer not just go to radix 256?</p>`,
        a: `<ol><li>Quotient size: 2<sup>40</sup> / 10<sup>6</sup> ≈ 1.1 × 10<sup>6</sup>, about 21 bits. That’s ⌈21 / 2⌉ = 11 iterations, so about <strong>13 cycles</strong>.</li><li>Full 64-bit quotient: 32 iterations plus setup, about <strong>34 cycles</strong>.</li><li>Radix 16 (4 bits per cycle): about 2 + 6 = 8 cycles and 2 + 16 = 18 cycles.</li><li>Why not radix 256: the digit-selection table grows quickly with radix (it needs more remainder and divisor bits as input), each iteration must also form a larger set of divisor multiples, and the iteration must still fit in one cycle. Designs therefore overlap several small-radix stages per cycle instead of building one large one.</li></ol>`
      }
    ]
  }
},

{
  id: "fp-units",
  region: "arith",
  title: "Floating-Point Units and the FMA Pipeline",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Appendix J, Computer Arithmetic (floating-point multiplication and addition, rounding).`,
  sections: [
    { id: "role", label: "What the FPU Does" },
    { id: "fma", label: "Inside the FMA Pipeline" },
    { id: "latency", label: "Latency, Throughput, and Accumulators" },
    { id: "hw", label: "Area and Multi-Precision Datapaths" },
    { id: "isa", label: "ISA Support" }
  ],
  body: `
<h3 id="sec-role">What the FPU Does</h3>
<p>The floating-point unit executes FP add, multiply, fused multiply-add (FMA), compare, convert, and (in a separate iterative unit) divide and square root. In a modern core the scalar FPU and the SIMD units are the same hardware: a scalar FP add is just one lane of a vector pipe. The format a number uses decides almost everything about the unit: how wide the multiplier is, how far the aligner shifts, how many lanes fit in a vector register, and how many bytes cross the memory system per operation (see <a href="#/fp-formats">Floating-Point Formats Compared</a>).</p>

<h3 id="sec-fma">Inside the FMA Pipeline</h3>
<p>A fused multiply-add computes a × b + c with <strong>one</strong> rounding at the end, which is both more accurate and faster than a separate multiply and add. It counts as two FLOPs, which is why peak-FLOPS figures assume FMAs. Most FPUs build add and multiply out of the FMA datapath (a + b = a × 1 + b). The stages:</p>
<ol>
<li><strong>Unpack:</strong> split the fields, insert the hidden bit (1 for normals, 0 for subnormals), detect zero, ∞, and NaN.</li>
<li><strong>Multiply significands:</strong> a <em>p</em> × <em>p</em> partial-product array (Booth recoding plus a Wallace or Dadda compressor tree), leaving the 2<em>p</em>-bit product in carry-save form. In parallel, add the exponents (E<sub>a</sub> + E<sub>b</sub> − bias) and compute how far to shift c.</li>
<li><strong>Align c:</strong> shift c’s significand to line up with the product. The aligner is about 3<em>p</em> bits wide, because c can sit far above or below the product.</li>
<li><strong>Add:</strong> a 3-input carry-save step, then a carry-propagate adder about 3<em>p</em> bits wide. A leading-zero anticipator (LZA) predicts the normalization shift in parallel with the add.</li>
<li><strong>Normalize:</strong> shift left by the LZA count (cancellation when a × b ≈ −c can remove many leading bits), or right by one on carry-out.</li>
<li><strong>Round:</strong> using the guard, round, and sticky bits and the current rounding mode (see <a href="#/fp-rounding/grs">Guard, Round, and Sticky Bits</a>), handle overflow to ∞, underflow to subnormal or zero, and set the exception flags.</li>
</ol>
<p>These steps pipeline into about 4 cycles at high frequency: Intel Skylake runs FP add, multiply, and FMA all at 4 cycles. AMD Zen 4 runs add and multiply at 3 and FMA at 4, using separate add pipes next to its FMA pipes. Divide and square root use a separate iterative unit (radix-4 SRT or Newton–Raphson style), which is why they take 10–30 cycles and usually aren’t fully pipelined.</p>

<h3 id="sec-latency">Latency, Throughput, and Accumulators</h3>
<p>A pipelined FMA unit with latency L accepts a new operation every cycle, but a dependent chain (such as a running sum <code>acc = fma(a[i], b[i], acc)</code>) issues only once every L cycles. By Little’s law, keeping P pipes busy needs</p>
<p class="eq">independent accumulators = L × P</p>
<p>On Skylake (L = 4, P = 2) that’s 8 vector accumulators. With fewer, the loop is latency bound: throughput = accumulators / L FMAs per cycle. This is why BLAS kernels keep a register tile of accumulators, and why a performance model must track FP dependency chains, not just port counts.</p>
<ul>
<li><strong>Peak FLOPs per cycle</strong> = pipes × lanes × 2. A Skylake-SP part with two 512-bit FMA units (Gold 6000 and Platinum. Most lower SKUs have only one): 2 × 16 FP32 lanes × 2 = 64 FP32 FLOPs per cycle per core.</li>
<li><strong>Fused vs. separate:</strong> when the compiler can’t fuse (or the ISA lacks FMA), a dependent multiply-then-add pays both latencies back to back.</li>
<li><strong>Bypass delays:</strong> on some cores, moving a result between the FP/SIMD domain and the integer domain costs an extra cycle or more, which shows up in code that mixes integer and FP ops on the same data.</li>
</ul>

<h3 id="sec-hw">Area and Multi-Precision Datapaths</h3>
<p>The significand multiplier dominates FMA area, and it grows roughly with <em>p</em><sup>2</sup>. The aligner, adder, and normalizer grow roughly linearly with <em>p</em>, and the exponent logic is small.</p>
<div class="tbl"><table>
<tr><th>Format</th><th>Multiplier (<em>p</em> × <em>p</em>)</th><th>Partial-product bits</th><th>Relative to FP32</th></tr>
<tr><td>FP64</td><td>53 × 53</td><td>2,809</td><td>4.9×</td></tr>
<tr><td>FP32</td><td>24 × 24</td><td>576</td><td>1×</td></tr>
<tr><td>TF32, FP16</td><td>11 × 11</td><td>121</td><td>0.21×</td></tr>
<tr><td>BF16</td><td>8 × 8</td><td>64</td><td>0.11×</td></tr>
<tr><td>FP8 E4M3</td><td>4 × 4</td><td>16</td><td>0.028×</td></tr>
<tr><td>FP8 E5M2</td><td>3 × 3</td><td>9</td><td>0.016×</td></tr>
<tr><td>FP4 E2M1</td><td>2 × 2</td><td>4</td><td>0.007×</td></tr>
</table></div>
<ul>
<li><strong>Why GPUs cut FP64:</strong> a 53 × 53 multiplier is about 5 FP32 multipliers’ worth of area. Data-center GPUs pay for it. Consumer GPUs run FP64 at a small fraction of FP32 speed (1/64 on recent NVIDIA GeForce parts).</li>
<li><strong>Multi-precision datapaths:</strong> one 24 × 24 array can be partitioned into several smaller multipliers, so the same FMA hardware runs one FP32 lane, two FP16 lanes, or more BF16 or FP8 lanes. In SIMD units, halving the width doubles the lanes in a fixed-width register, so throughput doubles per halving even though the multiplier shrinks about 4×. Register-file and operand bandwidth, not multiplier area, sets the pace.</li>
<li><strong>Bandwidth is the other half:</strong> halving the bits also halves the bytes per value, doubling effective memory bandwidth and cache capacity (see <a href="#/gen-gpus/roofline">the roofline model</a>). For memory-bound inference, that matters more than the FLOPs.</li>
</ul>

<h3 id="sec-isa">ISA Support</h3>
<div class="tbl"><table>
<tr><th>Platform</th><th>Formats beyond FP32 / FP64</th></tr>
<tr><td>x86</td><td><ul><li>x87 80-bit</li><li>F16C (FP16 ↔ FP32 conversion only)</li><li>AVX-512 BF16 (<code>VDPBF16PS</code> dot product into FP32, on Cooper Lake and Zen 4)</li><li>AVX-512 FP16 full arithmetic (Sapphire Rapids)</li><li>AMX tiles with BF16 (Sapphire Rapids) and FP16 (Granite Rapids)</li></ul></td></tr>
<tr><td>Arm</td><td><ul><li>FP16 arithmetic (Armv8.2)</li><li>BF16 <code>BFDOT</code>, <code>BFMMLA</code>, <code>BFCVT</code> (Armv8.6)</li><li>FP8 in recent Armv9 extensions</li></ul></td></tr>
<tr><td>RISC-V</td><td><ul><li>Q (quad)</li><li>Zfh (half)</li><li>Zfbfmin and Zvfbfmin (BF16 conversions)</li><li>Zvfbfwma (vector BF16 widening multiply-add into FP32)</li></ul></td></tr>
<tr><td>IBM POWER</td><td>Hardware binary128 (POWER9 onward)</td></tr>
<tr><td>NVIDIA GPUs</td><td><ul><li>FP16 tensor cores (Volta)</li><li>TF32 and BF16 (Ampere)</li><li>FP8 E4M3 and E5M2 (Hopper)</li><li>FP6, FP4, MX formats, and NVFP4 (Blackwell)</li></ul></td></tr>
<tr><td>Google TPU</td><td>BF16 matrix units with FP32 accumulation (TPU v2 onward), with INT8 and FP8 on later generations</td></tr>
</table></div>
<p class="refs">Further reading:</p><ul class="refs"><li>IEEE 754-2019, the standard</li><li>David Goldberg, “What Every Computer Scientist Should Know About Floating-Point Arithmetic” (ACM Computing Surveys, 1991)</li><li>Agner Fog, “Instruction Tables,” for measured FP latencies and throughputs per core</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Apple’s M1 performance core (Firestorm) has 4 128-bit NEON FMA pipes with a 4-cycle FMA latency, and NEON has 32 vector registers. How many independent FP32 accumulators does an FMA-bound kernel need to reach peak, and what is the peak at 3.2 GHz?</p>`,
        a: `<ol><li>Accumulators = latency × pipes = 4 × 4 = <strong>16 vector registers</strong>. NEON has 32, so 16 are left for operands.</li><li>FP32 lanes per 128-bit register: 128 / 32 = 4.</li><li>FLOPs per cycle = 4 pipes × 4 lanes × 2 = <strong>32</strong>.</li><li>Peak: 32 × 3.2 × 10<sup>9</sup> = <strong>102.4 GFLOPS</strong> FP32 per core.</li><li>With only 4 accumulators, the kernel would issue 4 / 4 = 1 FMA per cycle, a quarter of peak.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>On Haswell, FP multiply and FMA both take 5 cycles and FP add takes 3. Two ports can each start an FP multiply or FMA every cycle, and FP add runs on only one of them. A degree-12 polynomial is evaluated with Horner’s rule, once per element, with elements independent of each other. Compare a build with FMA contraction to one without, for a single evaluation and for a long array. What sets the gap in each case?</p>`,
        a: `<p><strong>One evaluation (latency bound):</strong> Horner’s rule is a chain of 12 dependent steps, each y = y × x + c<sub>k</sub>. With FMA each step is one 5-cycle op, so 12 × 5 = <strong>60 cycles</strong>. Without FMA each step is a multiply then a dependent add, 5 + 3 = 8 cycles, so 12 × 8 = <strong>96 cycles</strong>. FMA is 1.6× faster.</p><p><strong>Long array (throughput bound):</strong> independent elements give the out-of-order core plenty of parallel chains, so latency is hidden and the limit is issue ports. With FMA: 12 ops per element on 2 FMA ports, 6 cycles per element. Without FMA: 12 multiplies and 12 adds, with the adds confined to the single add port (the multiplies go on the other port), so the add port is the bottleneck at 12 cycles per element. Here FMA is 2× faster, because of op count and port balance, not latency.</p><p>The general lesson for a model: latency matters for dependent chains, port count and op mix matter for independent work, and FMA changes both.</p>`
      },
      {
        q: `<p>H100 SXM dense tensor-core peaks are about 67 TFLOPS for FP64, 495 for TF32, 989 for BF16, and 1,979 for FP8. A BF16 multiplier is about 9× smaller than an FP32 one and an FP8 E4M3 multiplier about 4× smaller than BF16. Why does throughput only double per format step instead of tracking multiplier area? And why is the FP64 gap so large?</p>`,
        a: `<p>Throughput is set by how many operands per cycle the tensor core can be fed, not by multiplier area. Register-file and shared-memory bandwidth is fixed in bytes per cycle, so halving the bytes per value doubles the values delivered, and so the multiplies performed. The datapath is also built as partitionable arrays: the wide multiplier array splits into 2× as many narrower multipliers per step, keeping the same wiring, accumulators, and operand routing. The spare area from smaller multipliers is spent on wider accumulators, scaling logic, and more formats, not on more lanes that couldn’t be fed.</p><p>FP64 goes the other way: a 53 × 53 multiplier is about 5× an FP32 one and about 23× a TF32 or FP16 one (2,809 vs. 121 partial-product bits), so NVIDIA provides far fewer FP64 lanes. That’s where the roughly 7× gap to TF32 comes from. A performance model of a new tensor unit should therefore model operand bandwidth per cycle first and multiplier count second.</p>`
      }
    ]
  }
}
]);
