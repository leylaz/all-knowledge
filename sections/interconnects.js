/* Section: Interconnects and protocols
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "icx"). */

section({
  id: "icx",
  name: "Interconnects and Protocols",
  cap: "On-chip buses, coherence, chiplets, links, memory, I/O",
  sections: [
    { id: "what", label: "What a Protocol Standardizes" },
    { id: "onoff", label: "On-Chip vs. Off-Chip" },
    { id: "metrics", label: "The Numbers That Matter" },
    { id: "compare", label: "The Standards at a Glance" }
  ],
  body: `
<p>A <strong>protocol</strong> is an agreed set of rules for how two pieces of hardware exchange data. An <strong>interconnect</strong> is the network that carries that traffic: a bus, a crossbar, a ring, a mesh, or a point-to-point link. Inside a <a href="#/eda-soc">system-on-chip</a>, they tie together dozens of subsystems. Standard protocols let blocks from different teams and vendors connect, and let verification teams buy ready-made verification IP to check them (see <a href="#/verif-testbench/interfaces">Checking interfaces between blocks</a>).</p>
<h3 id="sec-what">What a Protocol Standardizes</h3>
<ul>
<li><strong>Signals and channels:</strong> which wires exist and what each carries (addresses, data, control).</li>
<li><strong>Handshake and flow control:</strong> how a sender knows the receiver can accept data (VALID/READY signals, or credits).</li>
<li><strong>Transaction types:</strong> reads, writes, bursts, atomics, and for coherent protocols, snoops and invalidations.</li>
<li><strong>Ordering rules:</strong> which responses must come back in order and which may not.</li>
<li><strong>Error handling:</strong> error responses, and for off-chip links, error detection and retry.</li>
<li><strong>Electrical and physical rules</strong> (off-chip only): voltages, signaling, encoding, and link training.</li>
</ul>
<h3 id="sec-onoff">On-Chip vs. Off-Chip</h3>
<p><strong>On-chip</strong> protocols use wide parallel buses (128 to 512 bits or more) at the chip's clock, because wires inside a die are short, cheap, and plentiful. <strong>Off-chip</strong> links have few pins and long, noisy channels, so they send data serially over a small number of very fast differential lanes (SerDes, serializer/deserializer), with encoding, error checking, and retry. Between the two, chiplet links inside one package use many short, slower wires for high bandwidth at low energy.</p>
<h3 id="sec-metrics">The Numbers That Matter</h3>
<p class="eq">Bandwidth = width × transfer rate × efficiency</p>
<p>Efficiency accounts for overhead: encoding, packet headers, and turnaround. Latency matters just as much, and the two are tied by Little's law: to keep a link busy, enough requests must be in flight to cover the round-trip latency.</p>
<p class="eq">Requests in flight = <span class="frac"><span>bandwidth × latency</span><span>bytes per request</span></span></p>
<p>Energy per bit also matters: moving data off-chip costs far more energy than moving it across a die, which is a major reason designs moved to chiplets and to memory stacked next to the processor.</p>
<h3 id="sec-compare">The Standards at a Glance</h3>
<div class="tbl"><table>
<tr><th>Standard</th><th>Connects</th><th>Coherent?</th><th>Typical bandwidth</th></tr>
<tr><td><a href="#/icx-onchip">AXI</a></td><td>Blocks inside an SoC</td><td>No (ACE adds it)</td><td>Width × clock: 128 bits at 1 GHz is 16 GB/s per direction</td></tr>
<tr><td><a href="#/icx-coherent">CHI</a></td><td>Cores, caches, and memory in large SoCs</td><td>Yes</td><td>Mesh links of hundreds of GB/s; scales with mesh size</td></tr>
<tr><td><a href="#/icx-chiplets">UCIe</a></td><td>Chiplets in one package</td><td>Can carry coherent protocols</td><td>Very high per millimeter of die edge</td></tr>
<tr><td><a href="#/icx-links">PCIe Gen5 x16</a></td><td>CPU to GPU, SSD, network card</td><td>No</td><td>About 63 GB/s each way</td></tr>
<tr><td><a href="#/icx-links">CXL</a></td><td>CPU to accelerators and memory expanders</td><td>Yes</td><td>Same as the PCIe generation it runs on</td></tr>
<tr><td><a href="#/icx-links">NVLink</a></td><td>GPU to GPU</td><td>Yes (proprietary)</td><td>Up to about 1.8 TB/s per GPU (recent generations)</td></tr>
<tr><td><a href="#/icx-memory">DDR5-4800</a></td><td>CPU to DRAM DIMMs</td><td>Not applicable</td><td>38.4 GB/s per channel</td></tr>
<tr><td><a href="#/icx-memory">HBM3</a></td><td>GPU or accelerator to stacked DRAM</td><td>Not applicable</td><td>About 819 GB/s per stack</td></tr>
<tr><td><a href="#/icx-io">USB4</a></td><td>External devices</td><td>No</td><td>40 Gb/s (5 GB/s), with faster versions emerging</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>An on-chip read channel is 256 bits wide and runs at 1.5 GHz. What's its peak bandwidth? If the round-trip latency to memory is 100 ns and each request fetches a 64-byte line, how many requests must be outstanding to use that bandwidth fully?</p>`,
        a: `<ol start="0"><li>Bandwidth = 256 bits / 8 × 1.5 × 10<sup>9</sup> = 32 bytes × 1.5 × 10<sup>9</sup> = <strong>48 GB/s</strong>.</li><li>Requests in flight = 48 × 10<sup>9</sup> × 100 × 10<sup>−9</sup> / 64 = 4,800 / 64 = <strong>75 requests</strong>.</li><li>That's why caches need many MSHRs and interconnects need deep queues: with only 10 outstanding, bandwidth would be limited to 10 × 64 / 100 ns = 6.4 GB/s.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do on-chip interconnects use wide parallel buses while off-chip links use a few very fast serial lanes?</p>`,
        a: `<p>Inside a die, wires are short, cheap, and plentiful, so many parallel wires at the core clock give high bandwidth with low latency and low energy. Off-chip, pins and package traces are scarce and expensive, and at high speeds it's very hard to keep dozens of parallel signals arriving at the same moment (skew). Serial links send data over a few differential lanes with the clock embedded in the data stream, which avoids skew and runs at tens of gigabits per second per lane, at the cost of encoding, more latency, and more energy per bit.</p>`
      }
    ]
  }
}, [
{
  id: "icx-onchip",
  region: "icx",
  title: "On-Chip Buses",
  sections: [
    { id: "blocks", label: "The Blocks on the Bus" },
    { id: "axi", label: "AXI" },
    { id: "handshake", label: "The VALID/READY Handshake" },
    { id: "others", label: "APB, AHB, AXI-Stream" },
    { id: "fabric", label: "Interconnect Fabrics" }
  ],
  body: `
<p>On-chip buses connect the blocks inside an SoC: CPU clusters, GPUs, DMA engines, accelerators, peripherals, and memory controllers. The dominant family is Arm's <strong>AMBA</strong> (Advanced Microcontroller Bus Architecture), used far beyond Arm cores. Blocks that start transactions are called <strong>managers</strong> and blocks that respond are <strong>subordinates</strong>.</p>
<h3 id="sec-blocks">The Blocks on the Bus</h3>
<p>Every block's registers and memory sit at addresses in one shared physical address map. The fabric decodes each address to find the block that owns it, so a CPU programs a peripheral with ordinary loads and stores (memory-mapped I/O). Many blocks are both kinds of node: a subordinate for their own control registers and a manager when they move data.</p>
<div class="tbl"><table>
<tr><th>Block</th><th>What it is</th><th>Role on the bus</th><th>Typical traffic</th></tr>
<tr><td><strong>CPU cluster</strong></td><td>A group of cores (often 2 to 8) that share an L2 or L3 cache and one connection to the fabric. Phone chips mix clusters of fast performance cores and small efficiency cores.</td><td>Manager</td><td>64-byte cache-line reads on misses and writebacks on evictions, plus small uncached accesses to device registers. Latency-sensitive. Because the clusters cache shared data, they connect through a coherent protocol (<a href="#/icx-coherent">ACE or CHI</a>), not plain AXI.</td></tr>
<tr><td><strong>GPU</strong></td><td>Many shader cores running thousands of threads, for graphics and parallel compute</td><td>Manager (and a subordinate for its control registers)</td><td>Large streams of textures, vertices, and frame data. Bandwidth-heavy, tolerant of latency.</td></tr>
<tr><td><strong>DMA engine</strong></td><td>Direct memory access: hardware that copies blocks of data (memory to memory, or between memory and a device) so the CPU doesn't have to run a load and store for every word. Software writes a <em>descriptor</em> (source, destination, length) into its registers or into memory, starts it, and gets an interrupt when the copy finishes.</td><td>Both: subordinate while being programmed, manager while copying</td><td>Long bursts with many requests outstanding, often on several AXI IDs. Usually <em>I/O-coherent</em> (ACE-Lite or a CHI RN-I): it can read up-to-date data from CPU caches but has no cache of its own to snoop. Without that, software must flush or invalidate caches around each transfer.</td></tr>
<tr><td><strong>Accelerator</strong></td><td>A unit built for one class of work, done faster and with less energy than on a CPU: an NPU for neural networks, an image signal processor for the camera, video encoders and decoders, crypto engines, DSPs</td><td>Both: subordinate for its registers, manager to fetch inputs and write results</td><td>Mostly streaming reads and writes, often with local SRAM so data is reused on-chip instead of re-read from DRAM</td></tr>
<tr><td><strong>Peripheral</strong></td><td>Controllers for the outside world and housekeeping: UART, I2C, SPI, GPIO, timers, watchdog (see <a href="#/icx-io">Peripheral and low-speed interfaces</a>)</td><td>Mostly subordinates, usually on <a href="#/icx-onchip/others">APB</a> behind a bridge. Faster ones such as USB and Ethernet controllers have built-in DMA engines and are managers too.</td><td>Rare, small (often 32-bit) register reads and writes. They report events to the CPU with interrupts.</td></tr>
<tr><td><strong>Memory controller</strong></td><td>Turns fabric requests into DRAM commands (activate, read, write, precharge, refresh) and schedules them for row hits and fairness (see <a href="#/icx-memory/controller">The memory controller</a>)</td><td>Subordinate</td><td>Everything that misses the on-chip caches, from every manager at once. It's the busiest subordinate on the chip, so this is where contention and quality-of-service priorities matter most.</td></tr>
</table></div>
<p><strong>Example: playing a video.</strong> A CPU core writes the video decoder's registers (where the compressed stream is, where to put frames) and starts it. The decoder, acting as a manager, reads the stream from DRAM through the memory controller and writes decoded frames back to DRAM. The display controller, another manager, reads each finished frame on every screen refresh. When the decoder finishes a frame, it raises an interrupt, and the CPU queues the next one. After setup, the CPU never touches the pixel data: managers move the data between themselves and the memory controller.</p>
<h3 id="sec-axi">AXI (Advanced eXtensible Interface)</h3>
<p>AXI is the main high-performance AMBA protocol. It separates traffic into <strong>five independent channels</strong>, each with its own handshake:</p>
<div class="tbl"><table>
<tr><th>Channel</th><th>Direction</th><th>Carries</th></tr>
<tr><td>Read address (AR)</td><td>Manager to subordinate</td><td>Address, burst length and type, ID</td></tr>
<tr><td>Read data (R)</td><td>Subordinate to manager</td><td>Data beats, response status, ID, a "last beat" marker</td></tr>
<tr><td>Write address (AW)</td><td>Manager to subordinate</td><td>Address, burst length and type, ID</td></tr>
<tr><td>Write data (W)</td><td>Manager to subordinate</td><td>Data beats, byte-enable strobes, "last beat" marker</td></tr>
<tr><td>Write response (B)</td><td>Subordinate to manager</td><td>Whether the write succeeded, ID</td></tr>
</table></div>
<p>Because reads and writes use separate channels, they proceed in parallel, so a 128-bit AXI interface at 1 GHz can move 16 GB/s of reads and 16 GB/s of writes at the same time.</p>
<ul>
<li><strong>Bursts:</strong> one address can be followed by many data beats (up to 256 in AXI4).<ul><li><em>Incrementing</em> bursts read consecutive addresses</li><li><em>Wrapping</em> bursts are used for cache line fills, so the critical word comes first</li><li><em>Fixed</em> bursts repeat one address, as for a FIFO register</li></ul></li>
<li><strong>Multiple outstanding transactions:</strong> a manager can issue many requests before the first completes, which hides latency.</li>
<li><strong>IDs and ordering:</strong> responses with the same ID return in order; different IDs may return out of order.</li>
<li><strong>Responses:</strong> each transaction reports OKAY or an error (subordinate error, or decode error when no subordinate owns the address).</li>
<li><strong>Exclusive accesses:</strong> support for atomic read-modify-write sequences, used for locks.</li>
<li><strong>AXI4-Lite:</strong> a stripped-down version with no bursts, for simple control registers.</li>
</ul>
<h3 id="sec-handshake">The VALID/READY Handshake</h3>
<p>Every AXI channel uses the same rule: the sender raises <strong>VALID</strong> when it has something to send, the receiver raises <strong>READY</strong> when it can accept, and the transfer happens on the clock edge where both are high. Until then, the sender must hold VALID high and keep the data stable.</p>
<pre><code>cycle:   1     2     3     4     5
clk    _|‾|__|‾|__|‾|__|‾|__|‾|__
VALID  ______|‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾|____
DATA   ======X     0xA5     X======
READY  __________________|‾‾‾‾‾|____
                          ^ transfer happens here (cycle 4)</code></pre>
<ul>
<li>The receiver controls the pace (back-pressure) simply by holding READY low.</li>
<li>To prevent deadlock, a sender may never wait for READY before raising VALID.</li>
<li>Verification checks this rule with an assertion like the one on <a href="#/verif-testbench/interfaces">Checking interfaces between blocks</a>.</li>
</ul>
<h3 id="sec-others">APB, AHB, and AXI-Stream</h3>
<ul>
<li><strong>APB (Advanced Peripheral Bus):</strong> a very simple, low-power bus for configuration registers in slow peripherals (timers, UARTs, GPIO). One transfer at a time, in two phases (setup, then access); no bursts. A bridge connects it to the main AXI fabric.</li>
<li><strong>AHB (Advanced High-performance Bus):</strong> an older single-channel pipelined bus, still common in microcontrollers and smaller systems.</li>
<li><strong>AXI-Stream:</strong> for one-way streams of data with no addresses (video pixels, network packets, accelerator pipelines). It keeps the VALID/READY handshake and adds a LAST signal marking the end of a packet.</li>
</ul>
<h3 id="sec-fabric">Interconnect Fabrics</h3>
<p>Managers and subordinates are joined by an interconnect fabric: a <strong>crossbar</strong> (any manager to any subordinate, with arbitration when two want the same one) for smaller systems, or a <strong>network-on-chip</strong> (NoC) that packetizes transactions and routes them across a ring or mesh for larger ones. The fabric decodes each address to find the right subordinate, arbitrates between competing managers, converts between bus widths and clock domains, and often enforces quality-of-service priorities, so that, for example, display refresh traffic is never starved.</p>
<p><strong>Performance angle:</strong> peak bandwidth is width × clock, but sustained bandwidth depends on how many requests each manager can keep outstanding (Little's law), arbitration fairness, and contention at popular subordinates such as the memory controller.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Classify each block as a manager, a subordinate, or both, and say what it does on the bus:</p><ul><li>(a) A CPU cluster</li><li>(b) A DMA engine</li><li>(c) A UART</li><li>(d) A DRAM memory controller</li><li>(e) A video decoder</li></ul>`,
        a: `<ol type="a"><li><strong>Manager:</strong> issues cache-line reads and writebacks when its caches miss or evict, and register reads and writes to program other blocks.</li><li><strong>Both:</strong> a subordinate when the CPU writes its configuration registers (source, destination, length), then a manager while it performs the copy as bursts of reads and writes.</li><li><strong>Subordinate:</strong> it only answers small register reads and writes, usually on APB behind a bridge. It tells the CPU about new data with an interrupt, not a bus transaction.</li><li><strong>Subordinate:</strong> the destination of nearly all memory traffic. It never starts transactions on the fabric.</li><li><strong>Both:</strong> a subordinate for its control registers, and a manager that reads the compressed stream from DRAM and writes decoded frames back.</li></ol>`
      },
      {
        q: `<p>Draw the VALID/READY waveform for a transfer where the sender raises VALID in cycle 2 and the receiver raises READY in cycle 4. In which cycle does the transfer happen, and what must the sender do in cycles 2 and 3?</p>`,
        a: `<ol start="0"><li>The transfer happens in <strong>cycle 4</strong>, the first rising clock edge where VALID and READY are both high.</li><li>In cycles 2 and 3 the sender must keep VALID high and the data unchanged; it isn't allowed to withdraw or change the request while waiting.</li><li>In cycle 5 the sender may lower VALID or present the next transfer.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why does AXI forbid a sender from waiting for READY before asserting VALID?</p>`,
        a: `<p>If the sender waited for READY and the receiver waited for VALID, each would wait for the other forever: a deadlock. AXI breaks the cycle by requiring VALID to be raised independently of READY, while the receiver is allowed (though not required) to wait for VALID before raising READY.</p>`
      },
      {
        q: `<p>A DMA engine issues reads with 4 different AXI IDs. Which responses must come back in order, and why does it help performance to use multiple IDs?</p>`,
        a: `<p>Responses with the same ID must return in the order the requests were issued; responses with different IDs may return in any order. Using multiple IDs lets the interconnect and memory system complete requests in whatever order is fastest (for example, a cache hit can return before an earlier miss), so one slow request doesn't block the others. It also lets requests to different destinations proceed in parallel.</p>`
      }
    ]
  }
},

{
  id: "icx-coherent",
  region: "icx",
  title: "Coherent Interconnects",
  sections: [{ id: "chi", label: "CHI" }, { id: "chi-flow", label: "A CHI Read, Step by Step" }, { id: "ace", label: "ACE and TileLink" }, { id: "mesh", label: "Mesh Networks and Latency" }],
  body: `
<p>A coherent interconnect doesn't just move data; it also carries the messages that keep every cache's copy of a line consistent (see <a href="#/mesi">Cache coherence and MESI</a> and <a href="#/directory">Directory-based coherence</a>). These protocols are what those textbook protocols look like in real chips.</p>
<h3 id="sec-chi">CHI (Coherent Hub Interface)</h3>
<p>CHI is Arm's AMBA 5 protocol for large, high-performance coherent systems, such as Arm-based server chips with dozens of cores on a mesh. Unlike AXI's wires-per-channel style, CHI is <strong>packet-based</strong>: transactions are split into small packets (flits) that travel over the network.</p>
<p><strong>Nodes</strong> (every component plays a role):</p>
<ul>
<li><strong>Request nodes (RN):</strong> issue requests. Fully coherent ones (RN-F) have caches that can be snooped, such as CPU clusters; I/O-coherent ones (RN-I) don't cache coherent data but can read coherent memory, such as DMA engines.</li>
<li><strong>Home nodes (HN):</strong> each owns a slice of the address space and is its point of coherence, usually with a snoop filter (a directory) and a slice of the last-level cache.</li>
<li><strong>Subordinate nodes (SN):</strong> memory controllers and other endpoints.</li>
</ul>
<p><strong>Four channels:</strong> requests (REQ), responses (RSP), snoops (SNP), and data (DAT). Flow control uses <strong>credits</strong>: a sender may only send a packet when it holds a credit from the receiver, guaranteeing buffer space.</p>
<p><strong>Cache states:</strong> Unique Dirty, Unique Clean, Shared Clean, Shared Dirty, and Invalid, which correspond to MOESI's Modified, Exclusive, Shared, Owned, and Invalid.</p>
<h3 id="sec-chi-flow">A CHI Read, Step by Step</h3>
<p>Core A misses on a line that core B holds in Unique Dirty:</p>
<ol start="0">
<li>A's request node sends a read request to the line's <strong>home node</strong>.</li>
<li>The home node checks its snoop filter and sees that B owns the line.</li>
<li>The home node sends B a <strong>snoop</strong>.</li>
<li>B sends the data <strong>directly to A</strong> (direct cache transfer) and tells the home node it has done so, downgrading its own copy.</li>
<li>A acknowledges completion to the home node, which updates the snoop filter.</li>
</ol>
<p>Sending data straight from owner to requester saves a trip through the home node, the same "3-hop vs. 4-hop" trade-off from directory protocols.</p>
<h3 id="sec-ace">ACE and TileLink</h3>
<ul>
<li><strong>ACE (AXI Coherency Extensions, AMBA 4):</strong> adds snoop channels to AXI so a few CPU clusters can share data coherently. Common in phone chips with several clusters; CHI replaced it for larger systems. <strong>ACE-Lite</strong> is for I/O devices that read coherent memory but have no caches to snoop.</li>
<li><strong>TileLink:</strong> an open protocol common in RISC-V systems, with three levels: a lightweight uncached version, a heavier version adding bursts and atomics, and a cached version adding coherence. It uses five channels (A through E) for requests, probes, releases, grants, and acknowledgments.</li>
</ul>
<h3 id="sec-mesh">Mesh Networks and Latency</h3>
<p>Many-core chips arrange cores, cache slices, and home nodes as tiles in a 2D mesh, each with a router. A packet moves one hop per router (typically a cycle or two per hop). In a k × k mesh, the average distance between two random tiles is about 2(k<sup>2</sup> − 1) / (3k) hops: about 5.25 for an 8 × 8 mesh.</p>
<ul>
<li><strong>Latency</strong> depends on where the home node and owner sit, which is why some chips map addresses to nearby home nodes or split the mesh into regions.</li>
<li><strong>Bandwidth</strong> scales with the number of links, but traffic concentrated on one home node (a hot lock, for example) creates a hot spot.</li>
<li><strong>Performance angle:</strong> coherence latency adds directly to the cost of sharing data between cores, which is why false sharing (see <a href="#/false-sharing">False sharing</a>) is so expensive on large chips.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>In an 8 × 8 mesh with random source and destination tiles, what's the average number of hops? If each hop takes 2 cycles, roughly how many cycles of network travel does a 3-hop coherence transaction take (requester to home, home to owner, owner to requester)?</p>`,
        a: `<ol start="0"><li>In one dimension, the average distance between two random positions among k is (k<sup>2</sup> − 1) / (3k) = 63 / 24 ≈ 2.63 for k = 8.</li><li>Two dimensions: about <strong>5.25 hops</strong>.</li><li>Three network traversals: 3 × 5.25 ≈ 16 hops × 2 cycles ≈ <strong>32 cycles</strong> of travel, plus the snoop-filter lookup and the owner's cache access. Forwarding data directly from the owner saves a fourth traversal compared with sending it back through the home node.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Map CHI's cache states to MOESI.</p>`,
        a: `<ul><li>Unique Dirty = Modified</li><li>Unique Clean = Exclusive</li><li>Shared Clean = Shared</li><li>Shared Dirty = Owned (this copy is dirty and responsible for writing back, but other copies may exist)</li><li>Invalid = Invalid</li></ul><p>CHI's names describe two separate properties: whether the copy is the only one (unique vs. shared) and whether it differs from memory (clean vs. dirty).</p>`
      },
      {
        q: `<p>Why do large coherent systems use snoop filters at home nodes instead of broadcasting every snoop?</p>`,
        a: `<p>Broadcasting every miss to every cache wastes interconnect bandwidth and energy, and the cost grows with core count. A snoop filter (a directory) at each home node tracks which caches may hold each line, so snoops go only to actual sharers, often none. The cost is the filter's storage, and the need to invalidate cached lines when the filter runs out of space to track them.</p>`
      }
    ]
  }
},

{
  id: "icx-chiplets",
  region: "icx",
  title: "Chiplets and UCIe",
  sections: [{ id: "why-chiplets", label: "Why Chiplets" }, { id: "packaging", label: "Packaging" }, { id: "ucie", label: "UCIe" }],
  body: `
<p>A <strong>chiplet</strong> is one of several smaller dies combined in a single package to act as one chip. Instead of one huge die, a design is split into pieces (core dies, an I/O die, cache dies) connected by very short, very wide links.</p>
<h3 id="sec-why-chiplets">Why Chiplets</h3>
<ul>
<li><strong>Size limit:</strong> lithography can't print a die larger than about 26 × 33 mm (roughly 850 mm<sup>2</sup>), the "reticle limit." Bigger systems have to use multiple dies.</li>
<li><strong>Yield:</strong> the chance a die has a defect grows with its area. With a simple model, yield is Y = e<sup>−A × D</sup> (A is die area, D is defect density), so small dies waste far less silicon. Each chiplet is tested before assembly, so only known-good dies are packaged.</li>
<li><strong>Mixing processes:</strong> core logic can use the newest, most expensive process, while I/O and analog circuits, which don't shrink well, stay on a cheaper older one.</li>
<li><strong>Reuse:</strong> the same chiplets can be combined in different numbers to build a product family (for example, 1 to 12 core dies around one I/O die).</li>
</ul>
<p>Examples include AMD EPYC and Ryzen processors (core dies plus an I/O die), Apple's Ultra chips (two dies joined by a high-bandwidth bridge), and NVIDIA's Blackwell GPUs (two large dies connected inside the package).</p>
<h3 id="sec-packaging">Packaging</h3>
<ul>
<li><strong>Organic substrate:</strong> chiplets side by side on a conventional package; cheapest, lowest wire density.</li>
<li><strong>2.5D with a silicon interposer or bridge:</strong> dies sit on (or are linked by) a slice of silicon with very fine wiring, allowing thousands of short connections, as used for GPUs with stacked HBM memory.</li>
<li><strong>3D stacking:</strong> dies bonded directly on top of each other, for example extra cache stacked on a core die, giving the shortest connections of all.</li>
</ul>
<h3 id="sec-ucie">UCIe (Universal Chiplet Interconnect Express)</h3>
<p>UCIe is an open standard, backed by major chip, packaging, and foundry companies, for connecting chiplets from different vendors. It has three layers:</p>
<ul>
<li><strong>Protocol layer:</strong> carries PCIe, CXL, or a raw streaming mode for custom protocols (such as a vendor's own coherent fabric).</li>
<li><strong>Die-to-die adapter:</strong> link management, error checking, and retry.</li>
<li><strong>Physical layer:</strong> the electrical interface, with versions for standard packages and for advanced (2.5D) packages with denser, shorter wires.</li>
</ul>
<p>The key metrics are <strong>bandwidth per millimeter of die edge</strong> (the "shoreline" available for connections is limited) and <strong>energy per bit</strong>. Advanced-package links cost far less energy per bit than off-package SerDes links, which is why heavy traffic is kept inside the package.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Defect density is 0.1 defects per cm<sup>2</sup>. Compare a monolithic 800 mm<sup>2</sup> die with four 200 mm<sup>2</sup> chiplets using the yield model Y = e<sup>−A × D</sup>. How much wafer area does each approach use per good product?</p>`,
        a: `<ol start="0"><li>Monolithic: A = 8 cm<sup>2</sup>, so Y = e<sup>−0.8</sup> ≈ 45%. Wafer area per good die = 800 / 0.45 ≈ <strong>1,780 mm<sup>2</sup></strong>.</li><li>Chiplet: A = 2 cm<sup>2</sup>, so Y = e<sup>−0.2</sup> ≈ 82%. Each chiplet is tested before packaging, so four good ones cost 4 × 200 / 0.82 ≈ <strong>977 mm<sup>2</sup></strong>.</li><li>The chiplet design uses about 1.8× less silicon per product, before counting packaging cost, die-to-die interface area, and assembly yield.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What are the downsides of splitting a design into chiplets?</p>`,
        a: `<ul><li><strong>Latency and energy:</strong> crossing a die-to-die link takes longer and costs more energy per bit than on-die wires, so traffic between chiplets (for example, cache coherence between core dies) gets slower.</li><li><strong>Area:</strong> each chiplet spends area on interface circuits.</li><li><strong>Packaging:</strong> advanced packages are expensive and add assembly yield loss and thermal challenges.</li><li><strong>Design and verification:</strong> partitioning, power delivery, and testing across dies add complexity.</li></ul><p>Designers place die boundaries where traffic is lowest, such as between core complexes and the I/O die, to limit these costs.</p>`
      }
    ]
  }
},

{
  id: "icx-links",
  region: "icx",
  title: "Chip-to-Chip Links",
  sections: [{ id: "pcie", label: "PCIe" }, { id: "cxl", label: "CXL" }, { id: "gpu-links", label: "NVLink and Other Links" }],
  body: `
<p>Chip-to-chip links connect separate packages:</p><ul><li>A CPU to a GPU, SSD, or network card</li><li>GPUs to each other</li><li>One CPU socket to another</li></ul><p>They're serial links built from lanes of very fast differential signals.</p>
<h3 id="sec-pcie">PCIe (PCI Express)</h3>
<p>PCIe is the standard way to attach devices to a CPU. A link has 1 to 16 <strong>lanes</strong> (x1 to x16), each a pair of one-way differential connections, so data flows in both directions at once.</p>
<p><strong>Three layers:</strong></p>
<ul>
<li><strong>Transaction layer:</strong> builds packets (TLPs) for memory reads and writes, completions, and configuration. Writes are "posted" (no reply needed); reads wait for a completion. Credit-based flow control prevents overflowing the receiver's buffers.</li>
<li><strong>Data link layer:</strong> adds sequence numbers and error checks, and automatically retransmits any packet that arrives corrupted.</li>
<li><strong>Physical layer:</strong> encoding, the electrical SerDes circuits, and link training, where both ends negotiate speed and width.</li>
</ul>
<p><strong>Topology:</strong> a tree with the CPU's <strong>root complex</strong> at the top, <strong>switches</strong> fanning out, and <strong>endpoints</strong> (devices) at the leaves. Devices move data with DMA, and the CPU controls them by reading and writing their registers through memory-mapped I/O.</p>
<div class="tbl"><table>
<tr><th>Generation</th><th>Per-lane rate</th><th>x16 bandwidth, each way</th><th>Notes</th></tr>
<tr><td>Gen3</td><td>8 GT/s</td><td>About 16 GB/s</td><td>128b/130b encoding</td></tr>
<tr><td>Gen4</td><td>16 GT/s</td><td>About 32 GB/s</td><td></td></tr>
<tr><td>Gen5</td><td>32 GT/s</td><td>About 63 GB/s</td><td>Current mainstream in servers and GPUs</td></tr>
<tr><td>Gen6</td><td>64 GT/s</td><td>About 121 GB/s</td><td>Four-level signaling (PAM4) and fixed-size packets (flits) with forward error correction</td></tr>
<tr><td>Gen7</td><td>128 GT/s</td><td>About 242 GB/s</td><td>Newest specification</td></tr>
</table></div>
<p>Each generation doubles the per-lane rate. Round-trip latency is hundreds of nanoseconds, far longer than a DRAM access from the CPU.</p>
<h3 id="sec-cxl">CXL (Compute Express Link)</h3>
<p>CXL runs on PCIe's physical layer but adds <strong>cache coherence</strong>, so accelerators and memory devices can share memory with the CPU as if they were on the same chip. It combines three protocols:</p>
<ul>
<li><strong>CXL.io:</strong> essentially PCIe, for discovery, configuration, and DMA.</li>
<li><strong>CXL.cache:</strong> lets a device coherently cache host memory.</li>
<li><strong>CXL.mem:</strong> lets the host use the device's memory with ordinary loads and stores.</li>
</ul>
<p>Device types: Type 1 (accelerators without their own memory: .io + .cache), Type 2 (accelerators with memory: all three), and Type 3 (memory expanders: .io + .mem). Type 3 memory expansion is the most widely deployed use: it adds capacity and bandwidth beyond the CPU's DIMM slots, and newer versions allow pooling memory across servers through CXL switches. CXL-attached memory is slower than local DRAM, comparable to or slower than memory on another CPU socket, so it behaves like an extra NUMA tier.</p>
<h3 id="sec-gpu-links">NVLink and Other Links</h3>
<ul>
<li><strong>NVLink (NVIDIA):</strong> a proprietary GPU-to-GPU link with far more bandwidth than PCIe (about 900 GB/s per GPU on the H100 generation and about 1.8 TB/s on Blackwell). NVSwitch chips connect many GPUs so every GPU can talk to every other at full speed, which matters for splitting large AI models across GPUs.</li>
<li><strong>Infinity Fabric (AMD):</strong> AMD's interconnect within and between its chips and sockets.</li>
<li><strong>UPI (Intel Ultra Path Interconnect):</strong> Intel's coherent link between CPU sockets.</li>
<li><strong>Ethernet and InfiniBand:</strong> network links between servers, used to scale beyond one machine.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A training job copies 10 GB of data from CPU memory to a GPU. How long does it take over PCIe Gen5 x16 (about 63 GB/s each way), and between two GPUs over NVLink at 900 GB/s?</p>`,
        a: `<ol start="0"><li>PCIe Gen5 x16: 10 / 63 ≈ <strong>0.16 s</strong>.</li><li>NVLink: 10 / 900 ≈ <strong>11 ms</strong>, about 14× faster.</li><li>This gap is why GPU servers connect GPUs to each other with dedicated links and try to keep data on the GPUs rather than moving it back and forth over PCIe.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Each PCIe packet carries about 24 bytes of overhead (header, sequence number, error check, framing). What's the efficiency with 256-byte payloads versus 64-byte payloads, and what does that imply for software?</p>`,
        a: `<ol start="0"><li>256-byte payload: 256 / (256 + 24) ≈ <strong>91%</strong>.</li><li>64-byte payload: 64 / (64 + 24) ≈ <strong>73%</strong>.</li><li>Small transfers waste a large fraction of the link, and each also pays the full round-trip latency. Drivers and DMA engines batch data into large transfers, and devices use the largest payload size the system supports.</li></ol>`
      },
      {
        q: `<p>What's the difference between CXL.cache and CXL.mem, and which CXL device types use which?</p>`,
        a: `<p>CXL.cache lets a device coherently cache the host's memory, so an accelerator can work on host data without software copying or flushing. CXL.mem lets the host access memory attached to the device with ordinary loads and stores. Type 1 devices (accelerators without their own memory, such as smart network cards) use .io and .cache; Type 2 devices (accelerators with their own memory) use all three; Type 3 devices (memory expanders) use .io and .mem.</p>`
      }
    ]
  }
},

{
  id: "icx-memory",
  region: "icx",
  title: "Memory Interfaces",
  sections: [{ id: "dram-org", label: "How DRAM Is Organized" }, { id: "ddr", label: "DDR5 and LPDDR5" }, { id: "hbm", label: "HBM" }, { id: "controller", label: "The Memory Controller" }],
  body: `
<p>Memory interfaces connect the processor to DRAM. The standards are set by JEDEC, and each trades bandwidth, capacity, power, and cost differently. For how the cache hierarchy uses memory, see <a href="#/r/mem">Memory hierarchy</a>.</p>
<h3 id="sec-dram-org">How DRAM Is Organized</h3>
<ul>
<li><strong>Channels:</strong> independent interfaces, each with its own data bus; more channels mean more bandwidth.</li>
<li><strong>Ranks and banks:</strong> each channel has groups of chips (ranks), and each chip has many banks that can work in parallel.</li>
<li><strong>Rows and columns:</strong> a bank is a grid of cells. To read, the controller first <strong>activates</strong> a row (copying it into the bank's row buffer), then reads columns from that open row.</li>
</ul>
<p><strong>Three access cases:</strong></p>
<div class="tbl"><table>
<tr><th>Case</th><th>What has to happen</th><th>Latency</th></tr>
<tr><td>Row hit</td><td>The needed row is already open</td><td>t<sub>CL</sub></td></tr>
<tr><td>Closed row</td><td>Activate the row, then read</td><td>t<sub>RCD</sub> + t<sub>CL</sub></td></tr>
<tr><td>Row conflict</td><td>Close (precharge) the open row, activate the new one, then read</td><td>t<sub>RP</sub> + t<sub>RCD</sub> + t<sub>CL</sub></td></tr>
</table></div>
<p>DRAM also has to <strong>refresh</strong> every row periodically, briefly blocking access, because its cells slowly leak their charge.</p>
<h3 id="sec-ddr">DDR5 and LPDDR5</h3>
<ul>
<li><strong>DDR5:</strong> the standard for servers and desktops, on removable DIMMs. Each DIMM has two independent 32-bit subchannels, and each burst delivers 64 bytes, one cache line. Speed is given in transfers per second: DDR5-4800 moves 4,800 million transfers per second × 8 bytes = <strong>38.4 GB/s per channel</strong>. Servers have many channels per socket (for example, 12).</li>
<li><strong>LPDDR5 and LPDDR5X:</strong> low-power versions for phones and laptops, soldered next to (or on) the processor package, with narrower channels, higher speeds, and aggressive power-saving modes.</li>
</ul>
<h3 id="sec-hbm">HBM (High Bandwidth Memory)</h3>
<p>HBM stacks several DRAM dies on top of a base die, connected vertically by through-silicon vias, and places the stack right next to the processor on a silicon interposer. Instead of a 64-bit bus, each stack has a <strong>1,024-bit</strong> interface split into many independent channels.</p>
<p class="eq">HBM3: 1,024 bits × 6.4 Gb/s per pin ÷ 8 ≈ 819 GB/s per stack</p>
<p>HBM3E pushes per-pin rates higher (over 1 TB/s per stack), and a GPU with eight stacks reaches several TB/s. That bandwidth is what keeps GPU and AI accelerator compute units fed (see <a href="#/gen-gpus">How GPUs make this possible</a>), at the cost of high price, limited capacity, and an advanced package.</p>
<h3 id="sec-controller">The Memory Controller</h3>
<ul>
<li><strong>Address mapping:</strong> spreads consecutive cache lines across channels and banks so accesses run in parallel.</li>
<li><strong>Scheduling:</strong> reorders requests to maximize row hits, typically with FR-FCFS (open-row hits first, then oldest first), with limits so no request waits forever.</li>
<li><strong>Read/write turnaround:</strong> switching the bus between reading and writing costs idle cycles, so writes are buffered and drained in batches.</li>
<li><strong>Refresh and power management:</strong> schedules refresh and puts idle ranks into low-power states.</li>
<li><strong>Reliability:</strong> error-correcting codes (ECC) detect and fix bit errors.</li>
</ul>
<p><strong>Performance angle:</strong> loaded memory latency is much higher than the idle latency, because requests queue behind each other as bandwidth use rises. Performance models track row-hit rate, queueing delay, and bandwidth utilization for exactly this reason.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A DRAM has t<sub>CL</sub> = t<sub>RCD</sub> = t<sub>RP</sub> = 16 ns. What's the access latency for a row hit, a closed row, and a row conflict? Separately, what's the peak bandwidth of a 12-channel DDR5-4800 server?</p>`,
        a: `<ol start="0"><li>Row hit: just the column access, t<sub>CL</sub> = <strong>16 ns</strong>.</li><li>Closed row: activate then read, t<sub>RCD</sub> + t<sub>CL</sub> = <strong>32 ns</strong>.</li><li>Row conflict: close the open row, activate, then read: t<sub>RP</sub> + t<sub>RCD</sub> + t<sub>CL</sub> = <strong>48 ns</strong>. (Plus controller and interconnect time on top.)</li><li>Bandwidth: 12 × 4,800 × 10<sup>6</sup> × 8 bytes = <strong>about 461 GB/s</strong> peak.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do GPUs use HBM while CPUs mostly use DDR?</p>`,
        a: `<p>GPUs and AI accelerators are bandwidth-bound (see <a href="#/gen-gpus/roofline">the roofline model</a>), and HBM's very wide interface next to the processor delivers several TB/s with less energy per bit. The costs: HBM is expensive, capacity is limited (tens of GB per stack), it needs an advanced package with an interposer, and it can't be upgraded. CPUs need much larger capacity, upgradeable modules, and lower cost per gigabyte, and their workloads are more often latency-bound than bandwidth-bound, so DDR on DIMMs fits better.</p>`
      },
      {
        q: `<p>What does an FR-FCFS memory scheduler do, and what problem can it cause?</p>`,
        a: `<p>First-Ready, First-Come-First-Served prioritizes requests that hit the currently open row in their bank (they're "ready" fastest), and otherwise serves the oldest request first. This maximizes row hits and throughput. The problem is fairness: a thread streaming through one row can keep winning, starving other threads' requests. Real controllers add age limits and quality-of-service priorities to cap how long any request waits.</p>`
      }
    ]
  }
},

{
  id: "icx-io",
  region: "icx",
  title: "Peripheral and Low-Speed Interfaces",
  sections: [{ id: "peripheral", label: "Peripheral I/O" }, { id: "low-speed", label: "Low-Speed Control and Debug" }],
  body: `
<p>These interfaces connect a chip to the outside world and to small supporting chips. They're rarely performance bottlenecks inside the processor, but every SoC includes several of them, and each needs controllers, verification IP, and software drivers.</p>
<h3 id="sec-peripheral">Peripheral I/O</h3>
<div class="tbl"><table>
<tr><th>Interface</th><th>Used for</th><th>Typical speed</th></tr>
<tr><td>USB</td><td>External devices</td><td>480 Mb/s (USB 2.0) to 40 Gb/s and beyond (USB4)</td></tr>
<tr><td>Ethernet</td><td>Networking</td><td>1 Gb/s in PCs to 400 Gb/s and faster in data centers</td></tr>
<tr><td>SATA</td><td>Older storage</td><td>6 Gb/s; largely replaced by NVMe SSDs over PCIe</td></tr>
<tr><td>MIPI CSI-2 and DSI</td><td>Phone cameras and displays</td><td>Several Gb/s per lane</td></tr>
<tr><td>DisplayPort and HDMI</td><td>External monitors</td><td>Tens of Gb/s</td></tr>
</table></div>
<h3 id="sec-low-speed">Low-Speed Control and Debug</h3>
<ul>
<li><strong>I2C:</strong> two shared wires (data and clock) with device addresses; slow but lets many small chips (sensors, power controllers) share one bus.</li>
<li><strong>SPI:</strong> separate wires for data in, data out, clock, and a select line per device; faster and full-duplex. Commonly used for the flash chip a system boots from.</li>
<li><strong>UART:</strong> simple asynchronous serial with no clock wire, used for debug consoles that print boot messages.</li>
<li><strong>JTAG:</strong> the standard test and debug port, used for boundary-scan testing of board connections and for debuggers that halt cores and read their state (see <a href="#/eda-rtl/test-hooks">Test hooks</a>).</li>
<li><strong>GPIO:</strong> general-purpose pins software can read or drive directly, for buttons, LEDs, and simple signals.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A system boots by copying a 16 MB firmware image from SPI flash. With quad SPI (4 data lines) at 50 MHz, how long does the copy take?</p>`,
        a: `<ol start="0"><li>Quad SPI moves 4 bits per clock: 4 × 50 × 10<sup>6</sup> = 200 Mb/s = 25 MB/s.</li><li>16 MB / 25 MB/s = <strong>0.64 s</strong>, ignoring command overhead. That's why fast boot designs use faster flash interfaces or load only a small first-stage bootloader from SPI.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Compare I2C and SPI. When would you choose each?</p>`,
        a: `<p>I2C uses just two shared wires (data and clock) with addresses, so many devices share one bus; it's slow (typically hundreds of kHz to a few MHz) and half-duplex. Choose it for sensors, power-management chips, and configuration of many low-bandwidth devices. SPI uses separate wires for data in, data out, clock, and a chip-select per device; it's full-duplex and much faster (tens of MHz or more). Choose it for flash memory, displays, and anything needing more bandwidth, accepting the extra pins.</p>`
      }
    ]
  }
}
]);
