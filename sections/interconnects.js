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
        a: `<ol><li>Bandwidth = 256 bits / 8 × 1.5 × 10<sup>9</sup> = 32 bytes × 1.5 × 10<sup>9</sup> = <strong>48 GB/s</strong>.</li><li>Requests in flight = 48 × 10<sup>9</sup> × 100 × 10<sup>−9</sup> / 64 = 4,800 / 64 = <strong>75 requests</strong>.</li><li>That's why caches need many MSHRs and interconnects need deep queues: with only 10 outstanding, bandwidth would be limited to 10 × 64 / 100 ns = 6.4 GB/s.</li></ol>`
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
        a: `<ol><li>The transfer happens in <strong>cycle 4</strong>, the first rising clock edge where VALID and READY are both high.</li><li>In cycles 2 and 3 the sender must keep VALID high and the data unchanged; it isn't allowed to withdraw or change the request while waiting.</li><li>In cycle 5 the sender may lower VALID or present the next transfer.</li></ol>`
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
<ol>
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
<li><strong>How the network works:</strong> flits, router pipelines, credits, and the virtual networks that keep coherence traffic from deadlocking are on <a href="#/icx-noc">On-Chip Networks: Flits, Routers, and Deadlock</a>.</li>
<li><strong>Performance angle:</strong> coherence latency adds directly to the cost of sharing data between cores, which is why false sharing (see <a href="#/false-sharing">False sharing</a>) is so expensive on large chips.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>In an 8 × 8 mesh with random source and destination tiles, what's the average number of hops? If each hop takes 2 cycles, roughly how many cycles of network travel does a 3-hop coherence transaction take (requester to home, home to owner, owner to requester)?</p>`,
        a: `<ol><li>In one dimension, the average distance between two random positions among k is (k<sup>2</sup> − 1) / (3k) = 63 / 24 ≈ 2.63 for k = 8.</li><li>Two dimensions: about <strong>5.25 hops</strong>.</li><li>Three network traversals: 3 × 5.25 ≈ 16 hops × 2 cycles ≈ <strong>32 cycles</strong> of travel, plus the snoop-filter lookup and the owner's cache access. Forwarding data directly from the owner saves a fourth traversal compared with sending it back through the home node.</li></ol>`
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
  id: "icx-noc",
  region: "icx",
  title: "On-Chip Networks: Flits, Routers, and Deadlock",
  sections: [
    { id: "packets", label: "Messages, Packets, and Flits" },
    { id: "topology", label: "Topologies" },
    { id: "switching", label: "Switching" },
    { id: "flow-control", label: "Flow Control and Credits" },
    { id: "vcs", label: "Virtual Channels" },
    { id: "router", label: "The Router Pipeline" },
    { id: "routing", label: "Routing and Routing Deadlock" },
    { id: "protocol-deadlock", label: "Protocol Deadlock and Virtual Networks" },
    { id: "latency", label: "A Latency Model" },
    { id: "model", label: "What to Model" }
  ],
  body: `
<p>A <a href="#/directory">directory protocol</a> assumes a network that delivers its messages. This page covers how an on-chip network (NoC) does that: how messages are cut into flits, how routers move them, how buffers are managed, and the two kinds of deadlock a coherent network has to rule out. It draws on Hennessy &amp; Patterson's Appendix F (by Pinkston and Duato), Jerger, Krishna, and Peh's <em>On-Chip Networks</em>, and Dally and Towles.</p>

<h3 id="sec-packets">Messages, Packets, and Flits</h3>
<p>The network works in four units:</p>
<ul>
<li><strong>Message:</strong> what the protocol sends, such as a read request or a data reply.</li>
<li><strong>Packet:</strong> the unit that's routed. A header carries the destination, the message class, and a transaction ID. On chip, a message is usually one packet.</li>
<li><strong>Flit</strong> (flow-control unit): the unit that buffers and links are allocated in. A packet is a head flit (with the route), zero or more body flits, and a tail flit that releases the resources the packet held. A one-flit packet is head and tail at once.</li>
<li><strong>Phit</strong> (physical unit): what crosses the wires in one cycle. On chip, a phit is usually a whole flit.</li>
</ul>
<p>Coherence traffic is bimodal. Requests, forwarded requests, and acks carry an address and a few control bits, so they fit in one flit. A data message carries a whole cache line: with 16-byte flits, a 64-byte line plus a header is 5 flits. That's why many designs give data its own wider channel (CHI's DAT channel) or its own physical network.</p>

<h3 id="sec-topology">Topologies</h3>
<p>For N = k × k nodes with bidirectional links and uniform random traffic:</p>
<div class="tbl"><table>
<tr><th>Topology</th><th>Router ports</th><th>Diameter</th><th>Average hops</th><th>Bisection links</th></tr>
<tr><td>Ring (N nodes)</td><td>3</td><td>N/2</td><td>About N/4</td><td>2</td></tr>
<tr><td>2D mesh (k × k)</td><td>5</td><td>2(k − 1)</td><td>About 2k/3</td><td>k</td></tr>
<tr><td>2D torus (k × k)</td><td>5</td><td>k (k even)</td><td>About k/2</td><td>2k</td></tr>
<tr><td>Crossbar</td><td>N</td><td>1</td><td>1</td><td>N/2 (cost grows as N<sup>2</sup>)</td></tr>
</table></div>
<ul>
<li><strong>Ring:</strong> cheap routers and a natural order for snooping, but latency and bisection don't scale. Intel used rings up to about two dozen cores (Broadwell-EP joined two).</li>
<li><strong>Mesh:</strong> short, equal-length wires that fit a tiled floorplan. Bisection grows with √N. Intel's server chips since Skylake-SP and Arm's CMN fabrics are meshes.</li>
<li><strong>Torus:</strong> wraparound links halve the average distance and double the bisection, but the long wires must be folded to keep lengths equal, and the rings it forms need extra virtual channels to avoid deadlock.</li>
<li><strong>Crossbar:</strong> one hop between any pair. Fine for a handful of ports (a cluster's L2, a GPU's L2 slices), too costly for more.</li>
</ul>

<h3 id="sec-switching">Switching</h3>
<p>Switching decides when a packet may leave a router. For a packet of F flits crossing H hops, with a router-plus-link delay of t<sub>r</sub> per hop and one flit per cycle on each link:</p>
<ul>
<li><strong>Store-and-forward:</strong> each router receives the whole packet before sending any of it. T ≈ H × (t<sub>r</sub> + F cycles). Serialization is paid at every hop.</li>
<li><strong>Virtual cut-through:</strong> the head leaves as soon as its route and the next buffer are ready, and the body follows in a pipeline. T ≈ H × t<sub>r</sub> + F cycles. Buffers are allocated a packet at a time, so a blocked packet collapses into one router's buffer.</li>
<li><strong>Wormhole:</strong> the same latency as cut-through, but buffers are allocated a flit at a time, so they can be smaller than a packet. A blocked packet stays strung across several routers and holds every channel it occupies, blocking unrelated packets behind it.</li>
</ul>
<p>Example: a 5-flit data packet crossing 4 hops at 3 cycles per hop takes 4 hops × (3 cycles + 5 cycles) = 32 cycles store-and-forward, but 4 hops × 3 cycles + 5 cycles = 17 cycles with cut-through or wormhole. On-chip networks use wormhole or cut-through with virtual channels.</p>

<h3 id="sec-flow-control">Flow Control and Credits</h3>
<p>Flow control keeps a sender from overrunning the receiver's buffers. On chip, it's almost always <strong>credit-based</strong>:</p>
<ol>
<li>The upstream router keeps a count of free buffer slots for each downstream virtual channel, starting at the buffer depth.</li>
<li>Sending a flit decrements the count. At zero, the upstream router waits.</li>
<li>When the downstream router forwards a flit and frees its slot, it sends a credit back, which increments the count.</li>
</ol>
<p>The <strong>credit round trip</strong> is the time from a slot's credit leaving the downstream router until the flit that reuses it arrives: link out, credit processing, link back, and the downstream pipeline. To keep a link busy every cycle, each virtual channel needs at least as many buffer slots as the round trip in cycles. Fewer slots cap that virtual channel's throughput at buffers / round trip. Back-pressure is how congestion spreads: a full buffer stops credits, which stops the router upstream, and so on back to the source.</p>

<h3 id="sec-vcs">Virtual Channels</h3>
<p>A <strong>virtual channel</strong> (VC) is a separate buffer queue, with its own state and credits, that shares a physical link with other VCs. The switch allocator picks one flit from among the VCs each cycle. VCs serve two purposes:</p>
<ul>
<li><strong>Performance:</strong> a packet blocked in one VC doesn't block packets in other VCs on the same link (head-of-line blocking).</li>
<li><strong>Deadlock freedom:</strong> separating packets into classes that can't wait on each other in a cycle, for routing (next section) and for protocol messages (the one after).</li>
</ul>
<p>The cost is buffer area and power, and a more complex allocator, so VCs are kept to a few per port.</p>

<h3 id="sec-router">The Router Pipeline</h3>
<p>A baseline virtual-channel router handles a head flit in these stages:</p>
<ol>
<li><strong>Buffer write and route computation (BW, RC):</strong> the flit is written into its input VC, and the output port is computed from the destination.</li>
<li><strong>VC allocation (VA):</strong> the packet wins a free VC on the output port.</li>
<li><strong>Switch allocation (SA):</strong> the flit wins the crossbar for this cycle, against flits from other inputs that want the same output.</li>
<li><strong>Switch traversal (ST):</strong> the flit crosses the crossbar.</li>
<li><strong>Link traversal (LT):</strong> the flit crosses the wire to the next router.</li>
</ol>
<p>Body and tail flits skip RC and VA, since they follow the head's route and VC. The tail frees the VC. Optimizations bring the per-hop delay down from 5 cycles:</p>
<ul>
<li><strong>Lookahead routing:</strong> each router computes the next router's output port, taking RC off the critical path.</li>
<li><strong>Speculative switch allocation:</strong> SA runs in parallel with VA and is discarded if VA fails.</li>
<li><strong>Bypassing:</strong> a flit arriving at an idle router skips the buffer and goes straight to the crossbar.</li>
</ul>
<p>With these, commercial meshes reach 1 to 2 cycles per hop at low load, at the network's clock, which is often slower than the cores' clock.</p>

<h3 id="sec-routing">Routing and Routing Deadlock</h3>
<p>Routing picks the path. <strong>Dimension-order routing</strong> (XY on a mesh) goes all the way in X, then in Y. It's deterministic, needs almost no logic, and is the common choice on chip. Adaptive routing picks among minimal paths based on congestion, which spreads load but costs logic and loses ordering.</p>
<p><strong>Routing deadlock</strong> happens when packets hold channels in a cycle, each waiting for a channel the next one holds. Dally and Seitz's condition: a routing function is deadlock-free if the <strong>channel dependency graph</strong> (an edge from channel a to channel b if a packet can hold a and request b) has no cycle.</p>
<ul>
<li><strong>XY on a mesh:</strong> a packet never turns from Y back to X, so the four turns that would close a cycle can't all happen. No cycle, no deadlock, with one VC.</li>
<li><strong>Turn model</strong> (Glass and Ni): forbid just enough turns to break every cycle (for example west-first routing) and route adaptively with the rest.</li>
<li><strong>Rings and tori:</strong> the wraparound itself is a cycle. A <strong>dateline</strong> fixes it: packets start in VC 0 and switch to VC 1 when they cross a chosen link, so no cycle stays within one VC.</li>
<li><strong>Escape channels</strong> (Duato): route fully adaptively in some VCs, as long as a deadlock-free escape VC (for example XY) is always reachable.</li>
</ul>

<h3 id="sec-protocol-deadlock">Protocol Deadlock and Virtual Networks</h3>
<p>A deadlock-free routing function isn't enough for coherence, because messages <em>depend on each other</em>: a request at the home generates forwarded requests, and a forwarded request at an owner generates a response. That's <strong>message-dependent</strong> or <strong>protocol deadlock</strong>:</p>
<ol>
<li>The home's input queue is full of requests.</li>
<li>To finish the request at the head, the home needs a response from an owner.</li>
<li>That response is stuck behind requests in the same queues, because every buffer between the owner and the home is full of requests.</li>
<li>No request can be consumed until a response arrives, and no response can arrive until a request is consumed.</li>
</ol>
<p>The fix is to give each message class its own <strong>virtual network</strong> (its own VCs, or its own physical network) and to order the classes so that a message only ever waits for messages in a later class:</p>
<ul>
<li><strong>Requests</strong> (GetS, GetM, PutM) wait for forwarded requests and responses.</li>
<li><strong>Forwarded requests</strong> (Fwd-GetS, Fwd-GetM, Inv) wait only for responses.</li>
<li><strong>Responses</strong> (data, acks) wait for nothing: every endpoint must always accept them, which it can because it reserved space for them when it sent the request (an MSHR entry).</li>
</ul>
<p>The responses always drain, so the forwarded requests can always finish, so the requests can always finish. The number of virtual networks needed is the length of the longest chain of dependent message classes. Sorin, Hill, and Wood's directory protocols use three. Real fabrics name theirs:</p>
<ul>
<li><strong>Arm CHI:</strong> four channels, REQ, SNP, RSP, and DAT, with data split from other responses.</li>
<li><strong>Intel QPI:</strong> six message classes: Home, Snoop, Non-Data Response, Data Response, Non-Coherent Standard, and Non-Coherent Bypass.</li>
</ul>
<p>Each virtual network still needs its own routing-deadlock freedom, so a torus with three virtual networks needs at least 3 virtual networks × 2 dateline VCs = 6 VCs per port. Ordering is the other thing to watch: with XY routing and one VC per class, two messages from the same source to the same destination arrive in order. Some protocols rely on that point-to-point ordering on a network to remove races, and adaptive routing or multiple VCs per class break it.</p>

<h3 id="sec-latency">A Latency Model</h3>
<p>Following Hennessy &amp; Patterson's Appendix F, a packet's latency splits into parts a model can charge separately:</p>
<div class="math">\[ T = T_{\text{inject}} + H \times t_r + \frac{L}{b} + T_{\text{contention}} \]</div>
<ul>
<li><strong>T<sub>inject</sub>:</strong> getting from the cache controller into the network interface, and out at the other end.</li>
<li><strong>H × t<sub>r</sub>:</strong> hops times the per-hop router and link delay at low load.</li>
<li><strong>L / b:</strong> serialization, the packet length over the link width. It's what makes data replies slower than requests.</li>
<li><strong>T<sub>contention</sub>:</strong> waiting for a VC, the switch, or credits. It's near zero at low load and grows without bound as offered load approaches saturation. On a mesh with uniform traffic, saturation comes before the bisection links are fully used, because XY routing loads the center links most.</li>
</ul>

<h3 id="sec-model">What to Model</h3>
<ul>
<li>Hop distance from the real placement of cores, LLC slices, and memory controllers, not an average.</li>
<li>Serialization by message class: one flit for control, several for data.</li>
<li>Contention at hot spots, a home slice with a contended lock or the routers next to a memory controller, which an average-latency model hides.</li>
<li>The network's own clock domain, and credit round trips if the buffers are shallow.</li>
<li>Virtual networks as separate resources, so that a flood of requests can't delay the responses in the model when it can't on silicon.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed., Appendix F (Pinkston and Duato), Sections F.2 to F.6, and Appendix I · Jerger, Krishna, and Peh, <em>On-Chip Networks</em>, 2nd ed. (2017) · Dally and Towles, <em>Principles and Practices of Interconnection Networks</em> (2004) · Sorin, Hill, and Wood, <em>A Primer on Memory Consistency and Cache Coherence</em>, 2nd ed. (2020), Chapters 8 and 9 · Dally and Seitz, "Deadlock-Free Message Routing in Multiprocessor Interconnection Networks," IEEE Trans. Computers, 1987 · Dally, "Virtual-Channel Flow Control," IEEE TPDS, 1992 · Glass and Ni, "The Turn Model for Adaptive Routing," ISCA 1992 · Duato, "A New Theory of Deadlock-Free Adaptive Routing in Wormhole Networks," IEEE TPDS, 1993</p>`,
  practice: {
    guided: [
      {
        q: `<p>A mesh has 32-byte flits and links that carry one flit per cycle. Each hop (router plus link) takes 2 cycles at low load. A data reply carries a 64-byte line plus a one-flit header, and a request fits in one flit. Both travel 6 hops. Compute each message's latency with store-and-forward and with wormhole switching, ignoring contention.</p>`,
        a: `<ol><li>Data reply length: 64 bytes / 32 bytes/flit + 1 header flit = 3 flits.</li><li>Store-and-forward, data: 6 hops × (2 cycles/hop + 3 flits × 1 cycle/flit) = <strong>30 cycles</strong>.</li><li>Wormhole, data: 6 hops × 2 cycles/hop + 3 flits × 1 cycle/flit = <strong>15 cycles</strong>.</li><li>Store-and-forward, request: 6 hops × (2 cycles/hop + 1 flit × 1 cycle/flit) = <strong>18 cycles</strong>.</li><li>Wormhole, request: 6 hops × 2 cycles/hop + 1 flit × 1 cycle/flit = <strong>13 cycles</strong>.</li><li>Store-and-forward pays serialization at every hop, so it doubles the data reply's latency but adds only 38% to the request's. Long packets and long paths are where cut-through and wormhole matter.</li></ol>`
      },
      {
        q: `<p>A link between two routers takes 1 cycle in each direction. The downstream router takes 2 cycles from a flit's arrival until it frees the flit's buffer slot and sends the credit, and the upstream router takes 1 cycle to process a credit before it can send a flit using it. Each VC has 3 buffer slots. What throughput can one VC sustain, and how many slots would it need to keep the link busy?</p>`,
        a: `<ol><li>Credit round trip: 1 cycle (flit on the link) + 2 cycles (downstream until the credit is sent) + 1 cycle (credit on the link back) + 1 cycle (upstream processing) = 5 cycles.</li><li>Each slot can carry one flit per round trip, so 3 slots carry 3 flits every 5 cycles: <strong>0.6 flits/cycle</strong>.</li><li>Full throughput (1 flit/cycle) needs one slot per cycle of round trip: <strong>5 slots</strong> per VC.</li><li>With several VCs active on the link, they can fill each other's idle cycles, so a single VC's shortfall matters most when one flow has the link to itself, such as a stream of data replies from one home.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 6 × 6 mesh runs at 2 GHz with 32-byte links in each direction. Traffic is uniform random: each tile sends to every tile (itself included) with equal probability. What's the highest injection rate per tile, in GB/s, that the bisection allows? Would you expect the network to sustain it?</p><p class="given">Assume XY routing, one flit per link per cycle, and that local-port and router bandwidth aren't the limit.</p>`,
        a: `<ol><li>Cut the mesh between columns 2 and 3. Each half has 18 tiles, and 6 links cross the cut in each direction, one per row.</li><li>Bisection bandwidth in one direction: 6 links × 32 bytes/cycle × 2 × 10<sup>9</sup> cycles/s = 384 GB/s.</li><li>A tile's packet crosses the cut if its destination is in the other half: 18 tiles / 36 tiles = 0.5 of the time.</li><li>Left-to-right traffic at a per-tile rate r: 18 tiles × r × 0.5 = 9r. Setting 9r ≤ 384 GB/s gives r ≤ <strong>42.7 GB/s per tile</strong>, or 42.7 GB/s / 2 × 10<sup>9</sup> cycles/s ≈ 21.3 bytes/cycle, two-thirds of a link.</li><li>No. The bound assumes every bisection link is fully used every cycle. With XY routing and uniform traffic, the links near the center carry more load than the ones at the edge, so they saturate first. Allocation conflicts in the routers and finite buffers also cost throughput. Real meshes saturate well below the bisection bound, and latency climbs steeply well before saturation.</li></ol>`
      },
      {
        q: `<p>A directory protocol has three message classes: requests (GetS, GetM, PutM), forwarded requests (Fwd-GetS, Fwd-GetM, Inv), and responses (data, acks). A colleague proposes putting requests and forwarded requests on the same virtual network to save buffers. Show how that can deadlock, and say what else you could do to save buffers instead.</p><p class="given">Assume each tile has a cache and a home slice behind one network interface, with one input queue per virtual network. A home stalls a request for a line that's busy (mid-transaction) at the head of its queue, and a cache stalls a forwarded request for a line in a transient state at the head of its queue. Responses keep their own virtual network.</p>`,
        a: `<p>With requests and forwarded requests sharing one virtual network, this cycle can form between tiles A and C:</p><ol><li>A's cache is in IM<sup>A</sup> for line X: it has the data and waits for an Inv-Ack from C's cache. A Fwd-GetM for X, from a later writer, sits at the head of A's shared queue, stalled until A's store completes.</li><li>C's cache can't send that ack until it receives the Inv for X. The Inv sits in C's shared queue behind a GetS for line W, whose home is C.</li><li>Line W is busy at C's home: it sent a Fwd-GetS for W to A's cache, the owner, and waits for the data. So the GetS for W stalls at the head of C's queue.</li><li>The Fwd-GetS for W is in A's shared queue, behind the stalled Fwd-GetM for X.</li><li>A waits for C's ack, which waits for the Inv behind the GetS, which waits for W's data from A, which waits behind the Fwd-GetM, which waits for A's store. No message in the cycle can move.</li></ol><p>With separate virtual networks, the Inv for X would not sit behind a request, and the Fwd-GetS for W would still be stuck behind the Fwd-GetM in the same class, but that one would complete as soon as the ack arrived. The rule is that a message must never wait behind a message of a class that depends on it. Forwarded requests are generated by requests, so they need their own network. Ways to save buffers without merging:</p><ul><li>Give the control classes shallow buffers (one-flit packets need few slots) and spend the depth on the data network.</li><li>Share a common pool of buffers among the virtual networks, but reserve at least one slot per class so each can always advance.</li><li>Merge classes only where the dependency chain allows it: data and non-data responses can share a network, since neither generates further messages.</li></ul>`
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
        a: `<ol><li>Monolithic: A = 8 cm<sup>2</sup>, so Y = e<sup>−0.8</sup> ≈ 45%. Wafer area per good die = 800 / 0.45 ≈ <strong>1,780 mm<sup>2</sup></strong>.</li><li>Chiplet: A = 2 cm<sup>2</sup>, so Y = e<sup>−0.2</sup> ≈ 82%. Each chiplet is tested before packaging, so four good ones cost 4 × 200 / 0.82 ≈ <strong>977 mm<sup>2</sup></strong>.</li><li>The chiplet design uses about 1.8× less silicon per product, before counting packaging cost, die-to-die interface area, and assembly yield.</li></ol>`
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
        a: `<ol><li>PCIe Gen5 x16: 10 / 63 ≈ <strong>0.16 s</strong>.</li><li>NVLink: 10 / 900 ≈ <strong>11 ms</strong>, about 14× faster.</li><li>This gap is why GPU servers connect GPUs to each other with dedicated links and try to keep data on the GPUs rather than moving it back and forth over PCIe.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Each PCIe packet carries about 24 bytes of overhead (header, sequence number, error check, framing). What's the efficiency with 256-byte payloads versus 64-byte payloads, and what does that imply for software?</p>`,
        a: `<ol><li>256-byte payload: 256 / (256 + 24) ≈ <strong>91%</strong>.</li><li>64-byte payload: 64 / (64 + 24) ≈ <strong>73%</strong>.</li><li>Small transfers waste a large fraction of the link, and each also pays the full round-trip latency. Drivers and DMA engines batch data into large transfers, and devices use the largest payload size the system supports.</li></ol>`
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
<p>An access to the open row is fast. Any other row first has to be activated, and a different open row has to be closed (precharged) before that, so the latency depends on the bank's state. The timings are in <a href="#/dram-ctrl/timing">Row Hits, Misses, and Conflicts</a>.</p>
<p>DRAM also has to <strong>refresh</strong> every row periodically, briefly blocking access, because its cells slowly leak their charge.</p>
<h3 id="sec-ddr">DDR5 and LPDDR5</h3>
<ul>
<li><strong>DDR5:</strong> the standard for servers and desktops, on removable DIMMs. Each DIMM has two independent 32-bit subchannels, and each burst delivers 64 bytes, one cache line. Speed is given in transfers per second: DDR5-4800 moves 4,800 million transfers per second × 8 bytes = <strong>38.4 GB/s per channel</strong>. Servers have many channels per socket (for example, 12).</li>
<li><strong>LPDDR5 and LPDDR5X:</strong> low-power versions for phones and laptops, soldered next to (or on) the processor package, with narrower channels, higher speeds, and aggressive power-saving modes.</li>
</ul>
<h3 id="sec-hbm">HBM (High Bandwidth Memory)</h3>
<p>HBM stacks several DRAM dies on top of a base die, connected vertically by through-silicon vias, and places the stack right next to the processor on a silicon interposer. Instead of a 64-bit bus, each stack has a <strong>1,024-bit</strong> interface split into many independent channels.</p>
<p class="eq">HBM3: 1,024 bits × 6.4 Gb/s per pin ÷ 8 ≈ 819 GB/s per stack</p>
<p>HBM3E pushes per-pin rates higher (over 1 TB/s per stack), and a GPU with eight stacks reaches several TB/s. That bandwidth is what keeps GPU and AI accelerator compute units fed (see <a href="#/gen-gpus">GPUs for generative AI</a>), at the cost of high price, limited capacity, and an advanced package.</p>
<h3 id="sec-controller">The Memory Controller</h3>
<p>The controller sits between the cache hierarchy and these interfaces. It maps addresses onto channels and banks, reorders requests to favor open rows, batches writes, schedules refresh and low-power states, and checks ECC. Loaded latency rises well above idle latency as bandwidth use grows, because requests queue. All of it is covered in <a href="#/dram-ctrl">DRAM Controllers and Scheduling</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A DRAM has t<sub>CL</sub> = t<sub>RCD</sub> = t<sub>RP</sub> = 16 ns. What's the access latency for a row hit, a closed row, and a row conflict? Separately, what's the peak bandwidth of a 12-channel DDR5-4800 server?</p>`,
        a: `<ol><li>Row hit: just the column access, t<sub>CL</sub> = <strong>16 ns</strong>.</li><li>Closed row: activate then read, t<sub>RCD</sub> + t<sub>CL</sub> = <strong>32 ns</strong>.</li><li>Row conflict: close the open row, activate, then read: t<sub>RP</sub> + t<sub>RCD</sub> + t<sub>CL</sub> = <strong>48 ns</strong>. (Plus controller and interconnect time on top.)</li><li>Bandwidth: 12 × 4,800 × 10<sup>6</sup> × 8 bytes = <strong>about 461 GB/s</strong> peak.</li></ol>`
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
        a: `<ol><li>Quad SPI moves 4 bits per clock: 4 × 50 × 10<sup>6</sup> = 200 Mb/s = 25 MB/s.</li><li>16 MB / 25 MB/s = <strong>0.64 s</strong>, ignoring command overhead. That's why fast boot designs use faster flash interfaces or load only a small first-stage bootloader from SPI.</li></ol>`
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
