/* Section: Virtual memory and the OS boundary
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "os"). */

section({
  id: "os",
  name: "Virtual Memory and the OS Boundary",
  cap: "Translation, TLBs, faults, traps, kernel entry, demand paging, page replacement, copy-on-write, mmap, file and process system calls",
  body: `
<p>The hardware and OS cooperate on two things: giving each process its own address space, and moving between user code and the kernel safely. Both show up directly in performance.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A process has a private anonymous heap page that it has already written. It calls <code>fork</code>, and the child stores to that page. Later, reclaim evicts the parent's copy of the page to swap, and then the parent loads from it. List the hardware and OS events in order, from the <code>fork</code> onward.</p>`,
        a: `<ol><li><strong>Fork:</strong> the kernel copies the parent's page table into the child, marks the page's entry read-only in both tables, and raises the frame's map count to 2. It flushes the parent's now-stale writable TLB entry.</li><li><strong>Child's store:</strong> the walk finds a present but read-only leaf entry, so the store is marked as faulting, and the core takes a page fault when it reaches the head of the ROB.</li><li><strong>Copy-on-write:</strong> the handler sees that the region is writable and the frame has 2 mappings, so it copies the page into a new frame and points the child's entry at the copy, writable. The store re-executes and completes.</li><li><strong>Eviction:</strong> the parent's frame reaches the tail of an inactive list with its accessed bit clear. Reclaim assigns a swap slot, replaces the parent's entry with a swap entry, shoots down the TLBs, writes the dirty page to swap, and frees the frame.</li><li><strong>Parent's load:</strong> the walk reaches the not-present leaf, and the fault is taken at commit. The handler reads the swap entry, reads the page back from swap (a major fault, unless the page is still in the swap cache), and maps it again. The load re-executes and completes.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is a page fault a "fault" and a system call a "trap"? What does that change for the return address?</p>`,
        a: `<p>A fault is reported before the instruction completes, so the saved PC points at the faulting instruction and it is re-executed after the handler fixes the cause. A trap is reported after the instruction completes, so the saved PC points to the next instruction and execution continues past it.</p>`
      }
    ]
  }
}, [
{
  id: "virtual-memory",
  region: "os",
  title: "Virtual and Physical Memory",
  sections: [
    { id: "motivation", label: "Motivation" },
    { id: "pages-page-tables", label: "Pages and Page Tables" },
    { id: "multilevel", label: "Multilevel Page Tables" }
  ],
  body: `
<h3 id="sec-motivation">Motivation</h3>
<p>The simplest machine lets every load and store use a physical address directly. Small microcontrollers such as Arm Cortex-M parts still work that way, with at most a memory protection unit that checks a handful of address ranges. On a machine that runs many programs at once, using only physical addresses causes problems that virtual memory solves (Hennessy &amp; Patterson, Appendix B):</p>
<ul>
<li><strong>Protection:</strong> with physical addresses alone, any program can read or overwrite another program's memory or the kernel's. A page table lists exactly which frames a process can touch and how (read, write, execute, user or kernel), and the hardware checks every access.</li>
<li><strong>Relocation:</strong> a program linked for fixed addresses could only run where those addresses happen to be free. With translation, every process can use the same layout (code near the bottom, stack near the top), and the OS places its pages in whatever frames are free, at load time or later.</li>
<li><strong>Fragmentation:</strong> giving each program one contiguous chunk of physical memory, as base-and-bound registers do, leaves free memory scattered in gaps too small to use. Pages let a large contiguous virtual region map onto scattered 4 KB frames, so any free frame is usable.</li>
<li><strong>Capacity and sparse use:</strong> a process can reserve far more address space than it touches. Its heap and stack sit terabytes apart, and only the pages it actually uses take frames, so physical memory holds the hot pages of many processes and the rest can wait on disk.</li>
<li><strong>Sharing:</strong> two virtual pages can map the same frame. Shared libraries, copy-on-write after <code>fork</code>, and memory-mapped files all rely on that.</li>
</ul>
<p>Each process sees its own virtual address space, and the hardware translates every virtual address (VA) to a physical address (PA) using page tables that the OS manages. The cost is a translation on every instruction fetch, load, and store. The rest of this page, and the hardware in <a href="#/tlb">Page Walks and TLBs</a>, is about making that translation nearly free.</p>
<h3 id="sec-pages-page-tables">Pages and Page Tables</h3>
<p>Memory is divided into pages (commonly 4 KB; 16 KB on Apple's ARM systems). A VA splits into a virtual page number and an offset; translation maps the page number to a physical frame and keeps the offset. The figure shows the split for one address, with a made-up frame number:</p>
<div class="tbl"><svg viewBox="0 0 680 296" role="img" aria-label="The x86-64 virtual address 0x0000555555559ABC with 4 KB pages. Bits 47 to 12, 36 bits, are the virtual page number, 0x555555559. Bits 11 to 0, 12 bits, are the page offset, 0xABC. The page table, or a TLB hit, maps the virtual page number to physical frame number 0x1A2B3, which fills bits 51 to 12 of the physical address. The offset is copied unchanged, so the physical address is 0x1A2B3ABC." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrVPN" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Virtual address 0x0000555555559ABC (x86-64, 48-bit virtual addresses, 4 KB pages)</text>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)"><text x="22" y="40">47</text><text x="498" y="40" text-anchor="end">12</text><text x="502" y="40">11</text><text x="658" y="40" text-anchor="end">0</text><text x="22" y="262">51</text><text x="498" y="262" text-anchor="end">12</text><text x="502" y="262">11</text><text x="658" y="262" text-anchor="end">0</text></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="20" y="46" width="480" height="50" rx="3"/><rect x="20" y="196" width="480" height="50" rx="3"/></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="500" y="46" width="160" height="50" rx="3"/><rect x="500" y="196" width="160" height="50" rx="3"/></g>
<rect x="130" y="124" width="260" height="40" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="260" y="63">Virtual page number (VPN)</text><text x="580" y="63">Page offset</text><text x="260" y="140">Page table (or a TLB hit)</text><text x="260" y="213">Physical frame number (PFN)</text><text x="580" y="213">Page offset</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="260" y="77">36 bits</text><text x="580" y="77">12 bits</text><text x="260" y="156">maps VPN 0x555555559 to PFN 0x1A2B3</text><text x="260" y="227">40 bits (52-bit physical addresses)</text><text x="580" y="227">12 bits</text></g>
<g style="font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="260" y="91" style="fill:var(--trace)">0x555555559</text><text x="580" y="91" style="fill:var(--pad)">0xABC</text><text x="260" y="241" style="fill:var(--trace)">0x1A2B3</text><text x="580" y="241" style="fill:var(--pad)">0xABC</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrVPN)"><path d="M260,96 V122"/><path d="M260,164 V194"/><path d="M580,96 V194"/></g>
<text x="572" y="150" text-anchor="end" style="fill:var(--muted);font-size:11px">copied unchanged</text>
<text x="20" y="286" style="fill:var(--muted);font-size:11px">Physical address 0x1A2B3ABC: translation replaces the page number and keeps the low 12 bits.</text>
</svg></div>
<p>A page table entry holds the frame number plus permission and status bits: present, read/write, execute-disable, user/supervisor, accessed, and dirty.</p>
<h3 id="sec-multilevel">Multilevel Page Tables</h3>
<p>A flat table for a 48-bit address space with 4 KB pages needs 2<sup>36</sup> entries × 8 bytes = 512 GB per process, almost all of it describing addresses the process never uses. A multilevel (radix) table instead splits the page number into one index per level, and each table holds pointers to the tables one level down. On x86-64, each level indexes 9 bits into a 4 KB table of 512 entries: 9 + 9 + 9 + 9 + 12 = 48 bits. A fifth level extends this to 57 bits. The figure walks one address through all four levels:</p>
<div class="tbl"><svg viewBox="0 0 680 404" role="img" aria-label="A 4-level x86-64 page walk for the virtual address 0x0000555555559ABC. The address splits into PML4 index 170 (bits 47 to 39), PDPT index 341 (bits 38 to 30), PD index 170 (bits 29 to 21), PT index 345 (bits 20 to 12), and page offset 0xABC (bits 11 to 0). CR3 points to the base of the PML4 table. Entry 170 of the PML4 points to the base of a PDPT, entry 341 of that PDPT points to a page directory, entry 170 of the page directory points to a page table, and entry 345 of the page table points to the 4 KB data page, where the offset selects byte 0xABC. Each table is 512 entries of 8 bytes, one 4 KB page. The walk is 4 dependent loads before the data access." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrWalkI" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker><marker id="arrWalkP" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--pad)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Walking the x86-64 4-level page table for 0x0000555555559ABC</text>
<g style="fill:var(--muted);font-size:11px;font-weight:600"><text x="20" y="68">Virtual</text><text x="20" y="82">address</text></g>
<rect x="100" y="46" width="105" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><rect x="205" y="46" width="105" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><rect x="310" y="46" width="105" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><rect x="415" y="46" width="105" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><rect x="520" y="46" width="140" height="50" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="152.5" y="63">PML4 index</text><text x="257.5" y="63">PDPT index</text><text x="362.5" y="63">PD index</text><text x="467.5" y="63">PT index</text><text x="590" y="63">Page offset</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="152.5" y="77">bits 47–39</text><text x="257.5" y="77">bits 38–30</text><text x="362.5" y="77">bits 29–21</text><text x="467.5" y="77">bits 20–12</text><text x="590" y="77">bits 11–0</text></g>
<g style="font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="152.5" y="91" style="fill:var(--trace)">170</text><text x="257.5" y="91" style="fill:var(--trace)">341</text><text x="362.5" y="91" style="fill:var(--trace)">170</text><text x="467.5" y="91" style="fill:var(--trace)">345</text><text x="590" y="91" style="fill:var(--pad)">0xABC</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="112.5" y="150" width="80" height="160" rx="2"/><rect x="217.5" y="150" width="80" height="160" rx="2"/><rect x="322.5" y="150" width="80" height="160" rx="2"/><rect x="427.5" y="150" width="80" height="160" rx="2"/><rect x="540" y="150" width="100" height="160" rx="2"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"><rect x="112.5" y="196" width="80" height="14"/><rect x="217.5" y="250" width="80" height="14"/><rect x="322.5" y="196" width="80" height="14"/><rect x="427.5" y="251" width="80" height="14"/></g><rect x="540" y="252" width="100" height="10" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1"/>
<g style="fill:var(--trace);font-size:10px;font-family:var(--mono)" text-anchor="middle"><text x="152.5" y="207">[170]</text><text x="257.5" y="261">[341]</text><text x="362.5" y="207">[170]</text><text x="467.5" y="262">[345]</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="152.5" y="326" style="fill:var(--ink);font-weight:600">PML4</text><text x="152.5" y="340">512 × 8 B = 4 KB</text><text x="257.5" y="326" style="fill:var(--ink);font-weight:600">PDPT</text><text x="257.5" y="340">512 × 8 B = 4 KB</text><text x="362.5" y="326" style="fill:var(--ink);font-weight:600">PD</text><text x="362.5" y="340">512 × 8 B = 4 KB</text><text x="467.5" y="326" style="fill:var(--ink);font-weight:600">PT</text><text x="467.5" y="340">512 × 8 B = 4 KB</text><text x="590" y="326" style="fill:var(--ink);font-weight:600">Data page</text><text x="590" y="340">4 KB frame, byte 0xABC</text></g>
<rect x="20" y="150" width="64" height="30" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="52" y="170" text-anchor="middle" style="fill:var(--pad);font-size:12px;font-family:var(--mono)">CR3</text>
<g style="fill:var(--muted);font-size:10px"><text x="20" y="196">physical base</text><text x="20" y="208">of the PML4</text></g>
<g style="stroke:var(--trace);stroke-width:1.5;fill:none" marker-end="url(#arrWalkI)"><path d="M152.5,96 V194"/><path d="M257.5,96 V248"/><path d="M362.5,96 V194"/><path d="M467.5,96 V249"/><path d="M590,96 V250"/></g>
<g style="stroke:var(--pad);stroke-width:1.5;fill:none" marker-end="url(#arrWalkP)"><path d="M84,158 H110"/><path d="M192.5,203 H204.5 V158 H215.5"/><path d="M297.5,257 H309.5 V158 H320.5"/><path d="M402.5,203 H414.5 V158 H425.5"/><path d="M507.5,258 H519.5 V158 H538"/></g>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="372">Each entry holds the physical address of the next table, so the walk is 4 dependent loads before the data access.</text>
<text x="20" y="390">Only tables in use exist: mapping one aligned 2 MB region takes one table per level, 16 KB in all.</text></g>
</svg></div>
<p>A multilevel table allocates its lower-level tables lazily. A page table (covering 2 MB), page directory (1 GB), or PDPT (512 GB) exists only once some page in its range has been mapped. Until then, the entry above it is not present, which marks that whole range unmapped with a single entry. The page-fault handler builds the missing tables on the first touch of a page (see <a href="#/demand-paging/first-touch">Filling the Path on a First Touch</a>), and a new process starts with only its top-level table. How the OS fills, evicts, and shares pages is covered in <a href="#/demand-paging">Demand Paging and Copy-on-Write</a>, <a href="#/page-replacement">Page Replacement</a>, and <a href="#/mmap">Memory Mapping</a>.</p>
<details class="ex"><summary>Worked example: how many levels does a page table need?</summary>
<p><strong>Question.</strong> A core implements Armv8-A with the 16 KB translation granule (16 KB pages, as on Apple's ARM systems) and 48-bit virtual addresses. Every page table is one 16 KB page of 8-byte descriptors, and each level of the walk indexes one table. How many levels does a walk need, and how many entries of the top-level table can be used? How does the answer change for 47-bit virtual addresses?</p>
<ol>
<li><strong>Page offset.</strong> 16 KB = 2<sup>14</sup> bytes, so the offset is bits 13–0: <strong>14 bits</strong>, which translation never touches.</li>
<li><strong>Bits to translate.</strong> 48 − 14 = <strong>34</strong> bits of virtual page number.</li>
<li><strong>Bits per level.</strong> One table holds 16 KB / 8 B = 2048 = 2<sup>11</sup> descriptors, so each level resolves <strong>11 bits</strong>.</li>
<li><strong>Levels.</strong> ⌈34 / 11⌉ = ⌈3.09⌉ = <strong>4 levels</strong>. Three full levels cover 33 bits, so the top level resolves the single leftover bit, bit 47, and only <strong>2 of its 2048 entries</strong> can be used. Arm's specification defines that level 0 table with exactly 2 entries.</li>
<li><strong>47-bit addresses.</strong> 47 − 14 = 33 = 3 × 11, so exactly <strong>3 levels</strong>, each table fully used. The one extra address bit costs a whole extra dependent load on every walk that misses the page-walk caches.</li>
</ol>
<p>The general rule: levels = ⌈(VA bits − log<sub>2</sub> page size) / log<sub>2</sub>(page size / PTE size)⌉. Address widths that divide evenly (36 or 47 bits for this granule, 39 or 48 bits for 4 KB pages) waste nothing at the top.</p>
</details>`,
  practice: {
    guided: [
      {
        q: `<p>On x86-64 with 4-level paging and 4 KB pages, split the virtual address 0x00007F3A12345678 into its page-table indices and page offset.</p>`,
        a: `<ol><li>Layout: bits 47–39 (PML4), 38–30 (PDPT), 29–21 (PD), 20–12 (PT), 11–0 (offset).</li><li>Offset: low 12 bits = <strong>0x678</strong>.</li><li>Shift and mask 9 bits for each level: PML4 = <strong>254</strong>, PDPT = <strong>232</strong>, PD = <strong>145</strong>, PT = <strong>325</strong>.</li><li>A walk reads PML4[254] → PDPT[232] → PD[145] → PT[325], then adds 0x678 to the frame address: up to 4 memory accesses per TLB miss.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A Linux process on x86-64 uses 4-level paging with 4 KB pages and no huge pages. It has touched every page of these regions and nothing else:</p><ul><li>Code and data: 3 MB starting at 0x00400000</li><li>Heap: 64 MB starting at 0x01000000</li><li>Stack: 132 KB ending just below 0x7FFFFFFFF000</li><li>A shared library: 2 MB starting at 0x7F0000000000</li></ul><p>How many page-table pages does the user half of its address space use (count the PML4, but not the kernel's tables), how much memory is that, and when was each one allocated?</p>`,
        a: `<ol><li><strong>Page tables (each covers 2 MB).</strong> Code and data span 0x00400000 to 0x006FFFFF, which is 2 MB regions 2 and 3: 2 tables. The heap spans 0x01000000 to 0x04FFFFFF, 64 MB starting on a 2 MB boundary: 32 tables. The stack spans 0x7FFFFFFDE000 to 0x7FFFFFFFEFFF, all inside the 2 MB region at 0x7FFFFFE00000: 1 table. The library is 1 table. Total <strong>36</strong>.</li><li><strong>Page directories (each covers 1 GB).</strong> Code, data, and heap all sit in the first 1 GB: 1 directory. The stack and the library are each in their own 1 GB range: 2 more. Total <strong>3</strong>.</li><li><strong>PDPTs (each covers 512 GB).</strong> The low regions use PML4 entry 0. The library uses entry 0x7F0000000000 &gt;&gt; 39 = 254, and the stack uses entry 255. Total <strong>3</strong>.</li><li><strong>Total:</strong> 36 + 3 + 3 + 1 = <strong>43 tables × 4 KB = 172 KB</strong>, for about 69 MB of mapped data, roughly 0.24%. A flat table would need 512 GB.</li><li><strong>When:</strong> the PML4 at process creation. Each other table was allocated by the page-fault handler on the first touch of any page in its range: for example, the first stack access allocated the stack's PDPT, PD, and PT along with the data page. Later touches in the same 2 MB needed only a data frame.</li></ol>`
      }
    ]
  }
},

{
  id: "tlb",
  region: "os",
  title: "Page Walks and TLBs",
  sections: [
    { id: "walk", label: "What a Page Walk Does" },
    { id: "pwc", label: "Page-Walk Caches" },
    { id: "walkers", label: "Multiple Walkers" },
    { id: "walk-prefetch", label: "Translation Prefetching and Speculation" },
    { id: "hierarchy", label: "The TLB Hierarchy" },
    { id: "tlb-miss", label: "From a TLB Miss to the Translation" },
    { id: "coalesce", label: "Coalescing Page Walks" },
    { id: "reach", label: "TLB Reach" },
    { id: "huge-pages", label: "Huge Pages" },
    { id: "interaction-caches", label: "Interaction with Caches" },
    { id: "virt", label: "Virtualization: Two-Dimensional Walks" },
    { id: "power-performance-area", label: "Power, Performance, Area" },
    { id: "model", label: "Modeling Translation" }
  ],
  body: `
<p>Every load, store, and instruction fetch needs its virtual address translated before (or while) the cache is accessed. <a href="#/virtual-memory">Virtual and Physical Memory</a> covers how the page table is built. This page follows the hardware: first what a walk of that table costs, then the TLBs that let most accesses skip the walk, and the huge pages that stretch them further.</p>

<h3 id="sec-walk">What a Page Walk Does</h3>
<p>A hardware <strong>page walker</strong> translates an address by reading the page table, starting from the root in CR3 and using one 9-bit index per level (the figure in <a href="#/virtual-memory/multilevel">Multilevel Page Tables</a> traces one address through all four levels of x86-64). It returns the frame number and the permission bits, or, if it reaches a not-present entry because the page or one of its tables isn't mapped, it marks the access as faulting (when the fault is actually taken is covered in <a href="#/tlb/tlb-miss">From a TLB Miss to the Translation</a>).</p>
<p>Each level of the walk goes through the same five steps:</p>
<ol>
<li><strong>Get the table's base address.</strong> At the first level, the walker reads CR3, a register inside the core, so this costs no memory access. Bits 51&ndash;12 of CR3 hold the physical frame number of the top-level table (PML4). Tables are page-aligned, so the walker appends 12 zero bits to the frame number to get the table's physical base address. At every later level, the frame number comes from the entry read in step 5 instead. The figure uses a made-up CR3 value:
<div class="tbl"><svg viewBox="0 0 680 360" role="img" aria-label="CR3 holds 0x000000012A4F3000. Bits 63 to 52 are reserved. Bits 51 to 12, 40 bits, hold the PML4's physical frame number, 0x12A4F3. Bits 11 to 0 hold the PCID or cache-control flags. The walker copies the frame number into bits 51 to 12 of the base address and appends 12 zero bits as bits 11 to 0, giving the PML4's physical base address 0x12A4F3000. The base is 4 KB aligned because every table fills exactly one page. It points to entry 0 of the PML4, a 4 KB table of 512 entries of 8 bytes: entry 0 at 0x12A4F3000, entry 1 at 0x12A4F3008, through entry 511 at 0x12A4F3FF8." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrCR3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">CR3 = 0x000000012A4F3000 (a register in the core)</text>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)"><text x="22" y="40">63</text><text x="98" y="40" text-anchor="end">52</text><text x="102" y="40">51</text><text x="518" y="40" text-anchor="end">12</text><text x="522" y="40">11</text><text x="658" y="40" text-anchor="end">0</text><text x="102" y="200">51</text><text x="518" y="200" text-anchor="end">12</text><text x="522" y="200">11</text><text x="658" y="200" text-anchor="end">0</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="20" y="46" width="80" height="50" rx="3"/><rect x="520" y="46" width="140" height="50" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="100" y="46" width="420" height="50" rx="3"/><rect x="100" y="136" width="420" height="50" rx="3"/></g>
<rect x="520" y="136" width="140" height="50" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="60" y="68">Reserved</text><text x="310" y="63">PML4 frame number</text><text x="590" y="68">PCID or flags</text><text x="310" y="153">PML4 frame number</text><text x="590" y="153">Appended zeros</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="310" y="77">40 bits</text><text x="310" y="167">copied from CR3</text><text x="590" y="167">12 bits</text></g>
<g style="font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="310" y="91" style="fill:var(--trace)">0x12A4F3</text><text x="310" y="181" style="fill:var(--trace)">0x12A4F3</text><text x="590" y="181" style="fill:var(--pad)">0x000</text></g>
<path d="M310,96 V134" style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrCR3)"/>
<text x="318" y="120" style="fill:var(--muted);font-size:11px">walker copies bits 51&ndash;12</text>
<text x="240" y="226" style="fill:var(--muted);font-size:11px;font-weight:600">PML4: 512 entries &times; 8 bytes = 4 KB</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="240" y="234" width="180" height="22"/><rect x="240" y="256" width="180" height="22"/><rect x="240" y="278" width="180" height="22"/><rect x="240" y="300" width="180" height="22"/></g>
<rect x="240" y="234" width="180" height="22" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle"><text x="330" y="249">Entry 0</text><text x="330" y="271">Entry 1</text><text x="330" y="293">&#8942;</text><text x="330" y="315">Entry 511</text></g>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)"><text x="430" y="249">0x12A4F3000</text><text x="430" y="271">0x12A4F3008</text><text x="430" y="315">0x12A4F3FF8</text></g>
<path d="M180,186 V245 H238" style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrCR3)"/>
<text x="20" y="348" style="fill:var(--muted);font-size:11px">The base address 0x12A4F3000 points to entry 0. Every table fills one 4 KB page, so its low 12 bits are always 0.</text>
</svg></div></li>
<li><strong>Compute the entry's address.</strong> The walker takes this level's 9-bit index from the virtual address: bits 47&ndash;39 for the PML4, 38&ndash;30 for the PDPT, 29&ndash;21 for the page directory, and 20&ndash;12 for the page table. Each entry is 8 bytes, so it multiplies the index by 8 (a 3-bit shift) and adds the result to the base. The sum is the entry's physical address, so it needs no translation. The entry is an 8-byte slot in the current table. It holds the next table's frame number (a pointer to it) plus flag bits. The figure continues the example, with the virtual address from <a href="#/virtual-memory/multilevel">Multilevel Page Tables</a>:
<div class="tbl"><svg viewBox="0 0 680 308" role="img" aria-label="Computing the address of a PML4 entry. Bits 47 to 39 of the virtual address 0x0000555555559ABC are the PML4 index, 170. Bits 38 to 0 hold the lower indices and the page offset, used at later levels. The index times 8, a shift left by 3, is 1,360, or 0x550. Adding that to the PML4 base 0x12A4F3000 from step 1 gives 0x12A4F3550, the physical address of entry 170. Entries 168 to 175 share the 64-byte line at 0x12A4F3540." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrIdx" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Virtual address 0x0000555555559ABC, first level</text>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)"><text x="22" y="40">47</text><text x="198" y="40" text-anchor="end">39</text><text x="202" y="40">38</text><text x="658" y="40" text-anchor="end">0</text></g>
<rect x="20" y="46" width="180" height="50" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<rect x="200" y="46" width="460" height="50" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="20" y="126" width="220" height="50" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="330" y="126" width="230" height="50" rx="3"/><rect x="160" y="216" width="300" height="50" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="110" y="63">PML4 index</text><text x="430" y="68">Lower indices and page offset (later levels)</text><text x="130" y="143">Index &times; 8 (shift left 3)</text><text x="445" y="143">PML4 base (step 1)</text><text x="310" y="233">Address of PML4 entry 170</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="110" y="77">9 bits</text><text x="130" y="157">each entry is 8 bytes</text><text x="445" y="157">frame number + 12 zeros</text><text x="310" y="247">base + 0x550</text></g>
<g style="font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="110" y="91" style="fill:var(--pad)">170</text><text x="130" y="171" style="fill:var(--pad)">170 &times; 8 = 0x550</text><text x="445" y="171" style="fill:var(--trace)">0x12A4F3000</text><text x="310" y="261" style="fill:var(--trace)">0x12A4F3550</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrIdx)"><path d="M110,96 V124"/><path d="M130,176 V196 H260 V214"/><path d="M445,176 V196 H360 V214"/></g>
<text x="310" y="201" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">+</text>
<text x="20" y="296" style="fill:var(--muted);font-size:11px">Entry 170 sits 1,360 bytes into the table. Entries 168&ndash;175 share its 64-byte line at 0x12A4F3540 (step 3).</text>
</svg></div></li>
<li><strong>Fetch the line holding the entry.</strong> The walker sends the entry's physical address to the L1 data cache, which is probed for the 64-byte line containing it. On a miss, L2 is probed, then the LLC. If no cache holds the line, the request goes to the memory controller, which reads the line from DRAM, and the line is filled into the caches on its way back to the walker. Besides the entry, the line holds the 7 other entries of the same table that share its 64-byte block, so it covers 8 consecutive indices. Those entries map the neighboring virtual ranges: at the page-table level, the 7 nearby 4 KB pages, and at the page-directory level, the 7 nearby 2 MB regions. A later walk for a nearby address therefore usually finds its entry already cached. The figure follows entry 170 through the hierarchy, with every cache missing:
<div class="tbl"><svg viewBox="0 0 680 264" role="img" aria-label="Fetching PML4 entry 170 at physical address 0x12A4F3550. The page walker probes the L1 data cache, then L2 on a miss, then the LLC, and on a miss in every cache the memory controller reads DRAM. The 64-byte line comes back to the walker and is filled into the caches on the way. The line starts at 0x12A4F3540, the entry address with bits 5 to 0 cleared, and holds entries 168 to 175 at byte offsets 0x00 to 0x38. Bits 5 to 3 of the entry address are 010, so the walker takes slot 2, entry 170." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrLine" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Fetching PML4 entry 170 (physical address 0x12A4F3550)</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="160" y="30" width="100" height="40" rx="3"/><rect x="300" y="30" width="100" height="40" rx="3"/><rect x="440" y="30" width="100" height="40" rx="3"/><rect x="580" y="30" width="80" height="40" rx="3"/></g>
<rect x="20" y="30" width="100" height="40" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="70" y="54">Page walker</text><text x="210" y="54">L1 data cache</text><text x="350" y="54">L2</text><text x="490" y="54">LLC</text><text x="620" y="54">DRAM</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrLine)"><path d="M120,50 H158"/><path d="M260,50 H298"/><path d="M400,50 H438"/><path d="M540,50 H578"/><path d="M620,70 V100 H70 V72"/></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="140" y="86">probe</text><text x="280" y="86">miss</text><text x="420" y="86">miss</text><text x="560" y="86">miss</text></g>
<text x="345" y="116" text-anchor="middle" style="fill:var(--muted);font-size:11px">the 64-byte line returns, filled into the caches on the way</text>
<text x="20" y="148" style="fill:var(--muted);font-size:12px;font-weight:600">The line at 0x12A4F3540 (the entry address with bits 5&ndash;0 cleared)</text>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="middle"><text x="60" y="170">+0x00</text><text x="140" y="170">+0x08</text><text x="220" y="170">+0x10</text><text x="300" y="170">+0x18</text><text x="380" y="170">+0x20</text><text x="460" y="170">+0x28</text><text x="540" y="170">+0x30</text><text x="620" y="170">+0x38</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="20" y="176" width="80" height="44"/><rect x="100" y="176" width="80" height="44"/><rect x="180" y="176" width="80" height="44"/><rect x="260" y="176" width="80" height="44"/><rect x="340" y="176" width="80" height="44"/><rect x="420" y="176" width="80" height="44"/><rect x="500" y="176" width="80" height="44"/><rect x="580" y="176" width="80" height="44"/></g>
<rect x="180" y="176" width="80" height="44" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle"><text x="60" y="203">Entry 168</text><text x="140" y="203">Entry 169</text><text x="220" y="203">Entry 170</text><text x="300" y="203">Entry 171</text><text x="380" y="203">Entry 172</text><text x="460" y="203">Entry 173</text><text x="540" y="203">Entry 174</text><text x="620" y="203">Entry 175</text></g>
<text x="20" y="250" style="fill:var(--muted);font-size:11px">Bits 5&ndash;3 of 0x12A4F3550 are 010, so the walker takes slot 2: entry 170. Each neighbor maps its own 512 GB region.</text>
</svg></div>
<p><strong>Note:</strong> The walker only reads a table it reached through a <strong>present</strong> entry: CR3 for the root, then an entry with P = 1 for each lower level. That entry holds a physical frame number, and physical addresses that point to RAM are, by definition, locations in DRAM. Nothing sits below DRAM in the hardware hierarchy. Disk is a different storage space that only the OS manages, not a level the walker can reach. So a line the walker asks for can miss in every cache, but DRAM always returns it, at the cost of a full DRAM access. An OS that moves a table to disk first clears the entry pointing to it, so the walk stops one level earlier with a page fault (see <a href="#/page-replacement/table-eviction">Paging Out Page Tables</a>).</p></li>
<li><strong>Check the entry's metadata.</strong> The walker picks the 8-byte entry out of the line (bits 5&ndash;3 of its address say which of the 8) and reads its flag bits:
<ul>
<li><strong>Present (bit 0):</strong> if clear, the next table or the page isn't mapped. This is the only way a missing table shows up. The walk stops and the access is marked as faulting.</li>
<li><strong>Read/write (bit 1), user/supervisor (bit 2), and no-execute (bit 63):</strong> the walker combines these across all levels, so an access is allowed only if every level allows it. A forbidden access is marked as faulting too.</li>
<li><strong>Accessed (bit 5):</strong> if clear, the walker sets it with an atomic write to the entry in memory, so the OS can tell which pages are in use. At the last level, a store also sets the dirty bit (bit 6).</li>
<li><strong>Page size (bit 7):</strong> if set in a PDPT or page-directory entry, the entry maps a 1 GB or 2 MB page directly and the walk ends here (see <a href="#/tlb/huge-pages">Huge Pages</a>).</li>
</ul>The example entry, with the bits the walker checks in purple:
<div class="tbl"><svg viewBox="0 0 680 232" role="img" aria-label="PML4 entry 170 holds 0x000000003B7C1027. Bit 63, NX, is 0. Bits 62 to 52 are ignored. Bits 51 to 12 hold the next table's frame number, 0x3B7C1. Bits 11 to 8 are ignored. Bit 7, PS, is 0. Bit 6, D, is 0. Bit 5, A, is 1. Bits 4 and 3, cache control, are 0. Bit 2, U/S, bit 1, R/W, and bit 0, P, are 1. The walker checks that the entry is present, that this level allows the access, that the accessed bit is already set, and that PS is 0, so the walk continues to the PDPT." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">PML4 entry 170 = 0x000000003B7C1027</text>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="middle"><text x="40" y="40">63</text><text x="90" y="40">62&ndash;52</text><text x="240" y="40">51&ndash;12</text><text x="385" y="40">11&ndash;8</text><text x="427" y="40">7</text><text x="461" y="40">6</text><text x="495" y="40">5</text><text x="534" y="40">4&ndash;3</text><text x="573" y="40">2</text><text x="607" y="40">1</text><text x="641" y="40">0</text></g>
<rect x="20" y="46" width="40" height="46" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><rect x="60" y="46" width="60" height="46" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/><rect x="120" y="46" width="240" height="46" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><rect x="360" y="46" width="50" height="46" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/><rect x="410" y="46" width="34" height="46" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><rect x="444" y="46" width="34" height="46" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/><rect x="478" y="46" width="34" height="46" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><rect x="512" y="46" width="44" height="46" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/><rect x="556" y="46" width="34" height="46" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><rect x="590" y="46" width="34" height="46" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><rect x="624" y="46" width="34" height="46" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:10px;font-weight:600" text-anchor="middle"><text x="40" y="64">NX</text><text x="90" y="64">Ignored</text><text x="240" y="64">Next table's frame number</text><text x="385" y="64">Ignored</text><text x="427" y="64">PS</text><text x="461" y="64">D</text><text x="495" y="64">A</text><text x="534" y="64">Cache</text><text x="573" y="64">U/S</text><text x="607" y="64">R/W</text><text x="641" y="64">P</text></g>
<g style="font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="40" y="83" style="fill:var(--pad)">0</text><text x="90" y="83" style="fill:var(--muted)">0</text><text x="240" y="83" style="fill:var(--trace)">0x3B7C1</text><text x="385" y="83" style="fill:var(--muted)">0</text><text x="427" y="83" style="fill:var(--pad)">0</text><text x="461" y="83" style="fill:var(--muted)">0</text><text x="495" y="83" style="fill:var(--pad)">1</text><text x="534" y="83" style="fill:var(--muted)">00</text><text x="573" y="83" style="fill:var(--pad)">1</text><text x="607" y="83" style="fill:var(--pad)">1</text><text x="641" y="83" style="fill:var(--pad)">1</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="124">P = 1: the PDPT exists, so the walk continues. A 0 here would end the walk with a page fault.</text><text x="20" y="146">R/W = 1, U/S = 1, NX = 0: this level allows user reads, writes, and instruction fetches.</text><text x="20" y="168">A = 1: already set, so the walker writes nothing back to the entry.</text><text x="20" y="190">PS = 0: required in a PML4 entry. In a PDPT or page-directory entry, a 1 would end the walk at a huge page.</text><text x="20" y="212">D: used only at the last level, so it is ignored here.</text></g>
</svg></div></li>
<li><strong>Follow the pointer.</strong> Bits 51&ndash;12 of the entry hold the physical frame number of the next level's table. The walker returns to step 1 with that frame number in place of CR3's and moves to the next 9-bit index.
<div class="tbl"><svg viewBox="0 0 680 304" role="img" aria-label="Following PML4 entry 170 to the PDPT. Bits 51 to 12 of the entry hold the PDPT's frame number, 0x3B7C1, and bits 11 to 0 hold the flags, 0x027. The walker appends 12 zero bits to the frame number, giving the PDPT base 0x3B7C1000, which replaces CR3's frame number. The next index, virtual address bits 38 to 30, is 341, and 341 times 8 is 0xAA8. The base plus 0xAA8 gives 0x3B7C1AA8, the address of PDPT entry 341, and the walker returns to step 3 to fetch it." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrPtr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">PML4 entry 170 (bits 51&ndash;0)</text>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)"><text x="22" y="40">51</text><text x="478" y="40" text-anchor="end">12</text><text x="482" y="40">11</text><text x="658" y="40" text-anchor="end">0</text></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="20" y="46" width="460" height="50" rx="3"/><rect x="20" y="136" width="460" height="50" rx="3"/><rect x="380" y="226" width="280" height="50" rx="3"/></g>
<rect x="480" y="46" width="180" height="50" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="480" y="136" width="180" height="50" rx="3"/><rect x="20" y="226" width="280" height="50" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="250" y="65">PDPT frame number</text><text x="570" y="65">Flags</text><text x="250" y="155">PDPT frame number</text><text x="570" y="155">Appended zeros</text><text x="160" y="245">Next index: VA bits 38&ndash;30</text><text x="520" y="245">Address of PDPT entry 341</text></g>
<g style="font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="250" y="84" style="fill:var(--trace)">0x3B7C1</text><text x="570" y="84" style="fill:var(--muted)">0x027</text><text x="250" y="174" style="fill:var(--trace)">0x3B7C1</text><text x="570" y="174" style="fill:var(--pad)">0x000</text><text x="160" y="264" style="fill:var(--pad)">341 &times; 8 = 0xAA8</text><text x="520" y="264" style="fill:var(--trace)">0x3B7C1000 + 0xAA8</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrPtr)"><path d="M250,96 V134"/><path d="M430,186 V224"/><path d="M300,251 H378"/></g>
<text x="258" y="120" style="fill:var(--muted);font-size:11px">PDPT base 0x3B7C1000 replaces CR3's</text>
<text x="339" y="245" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">+</text>
<text x="20" y="296" style="fill:var(--muted);font-size:11px">Entry 341 is at 0x3B7C1AA8. Steps 3&ndash;5 repeat there, then for the page directory (index 170) and the page table (index 345).</text>
</svg></div></li>
</ol>
<p>At the last level, the page-table entry holds the frame number of the data page itself. The walker joins it with the 12-bit page offset to form the physical address, and fills the TLB with the translation and its permission bits.</p>
<p>Step 2 of each level needs the frame number from step 5 of the level above, so the reads form a chain of dependent reads, like following a linked list. The walker can't issue the next read until the current one returns, and the out-of-order core can't overlap them the way it overlaps independent loads. A walk whose entries are all in L1 or L2 therefore costs tens of cycles, while one that misses to DRAM at every level costs four DRAM latencies back to back. Page-walk caches shorten the chain by skipping the upper levels (next section). 5-level paging (57-bit addresses) adds a fifth level, and Armv8 and RISC-V Sv48 work the same way with their own table formats.</p>

<h3 id="sec-pwc">Page-Walk Caches</h3>
<p>Consecutive walks mostly read the same upper-level entries. One PML4 entry covers 512 GB, one PDPT entry 1 GB, and one page-directory entry 2 MB, so two TLB misses a few megabytes apart share every level but the last. A <strong>page-walk cache</strong> (PWC) keeps those entries next to the walker, so a walk can skip the levels it already knows. Intel calls them paging-structure caches. Only <strong>non-leaf</strong> entries go in, the ones that point to another table. The leaf entry that maps the page goes into the TLBs instead, so a PWC never returns a translation by itself, and the walker always reads at least the last level.</p>
<p>Intel's design has one small cache per level, each tagged by virtual address. An entry holds:</p>
<ul>
<li><strong>Tag:</strong> the VA bits that index every level down to its own (bits 47&ndash;39 for a PML4 entry, 47&ndash;30 for a PDPT entry, and 47&ndash;21 for a page-directory entry), plus the PCID, so entries survive a context switch.</li>
<li><strong>Next table:</strong> the physical frame number of the table one level down.</li>
<li><strong>Permissions so far:</strong> the R/W, U/S, and NX results combined over the levels it skips, plus their cache-control bits, so the walker resumes in the same state it would have reached by reading those levels itself.</li>
</ul>
<p>Neither Intel nor AMD publishes the sizes, but they are tiny. Reverse-engineering studies find a few entries at the PML4 and PDPT levels and a few dozen at the page-directory level, and AMD's K10 page walk cache held 24 entries. Small is enough because reach grows with the level: 32 page-directory entries cover 32 &times; 2 MB = 64 MB, and 4 PDPT entries cover 4 GB. A workload whose misses scatter over more than 64 MB misses in the page-directory cache but still hits at the PDPT level, and then walks 2 levels instead of 4.</p>
<p>The PWC is probed <strong>before</strong> the data cache, not in parallel with it. The walker can't send a read to the L1 data cache until it knows which entry to read, and that is exactly what the PWC tells it: after a page-directory hit, the first read is the page-table entry, and after a full miss, it is the PML4 entry at CR3. So after an L2 TLB miss, the walker probes all three caches at once with the VA (a CAM lookup of 1&ndash;2 cycles), takes the deepest hit, and only then issues its first read. Some designs hide even those cycles by probing the PWC alongside the L2 TLB, since both lookups need only the VA, and discarding the result when the L2 TLB hits. The figure continues the example address from <a href="#/tlb/walk">What a Page Walk Does</a>, with made-up frame numbers below the PDPT:</p>
<div class="tbl"><svg viewBox="0 0 680 366" role="img" aria-label="Page-walk cache lookup for virtual address 0x0000555555559ABC after an L2 TLB miss. Its indices are PML4 170, PDPT 341, page directory 170, and page table 345, with page offset 0xABC. The walker probes three caches at once. The PML4 cache, 2 entries, is tagged by VA bits 47 to 39 and hits on tag 170, giving the PDPT frame 0x3B7C1. The PDPT cache, 4 entries, is tagged by bits 47 to 30 and hits on 170, 341, giving the page directory frame 0x41D07. The page-directory cache, 32 entries, is tagged by bits 47 to 21 and hits on 170, 341, 170, giving the page table frame 0x58E22. The deepest hit wins, so the only read left is page-table entry 345 at 0x58E22000 plus 345 times 8, which is 0x58E22AC8, sent to the L1 data cache. Without the page-walk cache, the walk would need 4 dependent reads." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrPWC" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Page-walk cache lookup for VA 0x0000555555559ABC, after an L2 TLB miss</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="20" y="30" width="110" height="48" rx="3"/><rect x="130" y="30" width="110" height="48" rx="3"/><rect x="240" y="30" width="110" height="48" rx="3"/><rect x="350" y="30" width="110" height="48" rx="3"/><rect x="460" y="30" width="200" height="48" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="75" y="46">PML4 index</text><text x="185" y="46">PDPT index</text><text x="295" y="46">PD index</text><text x="405" y="46">PT index</text><text x="560" y="46">Page offset</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="middle"><text x="75" y="58">47&ndash;39</text><text x="185" y="58">38&ndash;30</text><text x="295" y="58">29&ndash;21</text><text x="405" y="58">20&ndash;12</text><text x="560" y="58">11&ndash;0</text></g>
<g style="fill:var(--pad);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="75" y="72">170</text><text x="185" y="72">341</text><text x="295" y="72">170</text><text x="405" y="72">345</text><text x="560" y="72">0xABC</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrPWC)"><path d="M75,78 V120 H120 V136"/><path d="M185,78 V112 H340 V136"/><path d="M295,78 V104 H560 V136"/></g>
<text x="400" y="98" style="fill:var(--muted);font-size:11px">all three probed at once, 1&ndash;2 cycles</text>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="120" y="150">PML4 cache (2 entries)</text><text x="340" y="150">PDPT cache (4 entries)</text><text x="560" y="150">PD cache (32 entries)</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="120" y="163">tag: VA bits 47&ndash;39</text><text x="340" y="163">tag: VA bits 47&ndash;30</text><text x="560" y="163">tag: VA bits 47&ndash;21</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="20" y="170" width="200" height="20"/><rect x="20" y="212" width="200" height="22"/><rect x="240" y="170" width="200" height="20"/><rect x="240" y="212" width="200" height="22"/><rect x="460" y="170" width="200" height="20"/><rect x="460" y="212" width="200" height="22"/></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="20" y="190" width="200" height="22"/><rect x="240" y="190" width="200" height="22"/></g>
<rect x="460" y="190" width="200" height="22" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="stroke:var(--rule);stroke-width:1"><path d="M120,170 V234"/><path d="M340,170 V234"/><path d="M570,170 V234"/></g>
<g style="fill:var(--muted);font-size:10px;font-weight:600" text-anchor="middle"><text x="70" y="184">Tag</text><text x="170" y="184">Next table</text><text x="290" y="184">Tag</text><text x="390" y="184">Next table</text><text x="515" y="184">Tag</text><text x="615" y="184">Next table</text></g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="70" y="205">170</text><text x="170" y="205">0x3B7C1</text><text x="290" y="205">170.341</text><text x="390" y="205">0x41D07</text><text x="515" y="205">170.341.170</text><text x="615" y="205">0x58E22</text><text x="70" y="227">0</text><text x="170" y="227">0x2F0A4</text><text x="290" y="227">0.0</text><text x="390" y="227">0x1C3E8</text><text x="515" y="227">170.341.169</text><text x="615" y="227">0x6A0F1</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="120" y="250">hit, not needed</text><text x="340" y="250">hit, not needed</text></g>
<text x="574" y="252" style="fill:var(--trace);font-size:10px;font-weight:600">deepest hit wins</text>
<path d="M560,234 V272" style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrPWC)"/>
<rect x="20" y="274" width="300" height="50" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/>
<rect x="360" y="274" width="300" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="170" y="294">Without a PWC: 4 dependent reads</text><text x="510" y="294">With this hit: 1 read, to the L1 data cache</text></g>
<g style="font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="170" y="312" style="fill:var(--muted)">PML4 &rarr; PDPT &rarr; PD &rarr; PT</text><text x="510" y="312" style="fill:var(--trace)">0x58E22000 + 345 &times; 8 = 0x58E22AC8</text></g>
<text x="20" y="348" style="fill:var(--muted);font-size:11px">The hit entry also carries the R/W, U/S, and NX results of PML4 entry 170, PDPT entry 341, and PD entry 170.</text>
</svg></div>
<p>A page-directory hit removes 3 of the 4 dependent reads. Upper-level lines are hot, so each skipped read would usually have hit in L1 (about 5 cycles on Golden Cove and Zen 4) or L2 (about 14&ndash;16 cycles). The hit therefore saves roughly 15&ndash;45 cycles per walk, and a few hundred when a large footprint has pushed the upper-level lines out to the LLC or DRAM. The skipped reads also leave L1 load ports and fill buffers to the program's own loads.</p>
<p>AMD's original page walk cache took the other approach and tagged entries by the entry's <em>physical</em> address. It works as a private cache level for page-table entries: the walker still goes level by level, because it needs each entry to compute the next address, but the upper reads hit in a 1-cycle structure instead of the L1 data cache. Barr, Cox, and Rixner compared the two and found that VA-tagged caches, which skip levels instead of speeding them up, get more out of the same number of entries.</p>
<p>The area cost is small. 32 page-directory entries of about 90 bits each (a 27-bit tag, a 12-bit PCID, a 40-bit frame number, and the permission and cache-control bits) come to under 3 Kbit, smaller than a 72-entry L1 DTLB. The energy is a few CAM searches per walk, and walks happen only on L2 TLB misses. The real cost is correctness: every invalidation the OS performs must clear PWC entries too. INVLPG and a CR3 write that doesn't preserve the PCID flush them, and an OS that frees a page-table page must flush them before it reuses the frame, or a stale entry would point the walker at a frame that now holds something else. A PWC pays off when walks are frequent and their upper levels repeat:</p>
<ul>
<li><strong>Large, irregular footprints:</strong> graph analytics, databases, and key-value stores, which miss in the L2 TLB a few times per thousand instructions.</li>
<li><strong>Virtualized guests:</strong> each guest upper-level hit also skips a whole host walk (see <a href="#/tlb/virt">Virtualization: Two-Dimensional Walks</a>).</li>
</ul>
<p>A core whose working set fits in its L2 TLB's reach, such as a small embedded core with a few megabytes of memory, gains little, since it rarely walks at all. Because the cost is so low, every current Intel, AMD, and Arm application core has one.</p>
<details class="ex"><summary>Worked example: how much a page-walk cache saves on a hash-table lookup</summary>
<p><strong>Question.</strong> A key-value store on a Skylake-class core probes a 256 MB hash table, mapped with 4 KB pages, at uniformly random keys. It takes 12 L2 TLB misses per 1,000 instructions. Assume:</p>
<ul>
<li>The table starts on a 1 GB boundary, and its walks are the only ones that matter (ignore code, stack, and other data).</li>
<li>Each probe picks its page independently and uniformly at random.</li>
<li>The page-walk cache is VA-tagged, with a 16-entry fully associative LRU page-directory cache, and PML4 and PDPT caches of a few entries each. Probing it takes 2 cycles, before the first read.</li>
<li>PML4, PDPT, and page-directory entry reads hit in L2 at 12 cycles. Page-table entry reads hit in the LLC at 42 cycles.</li>
<li>Walks are fully exposed: each walk cycle adds one cycle to execution time. Apart from walks, the program runs at a CPI of 0.6.</li>
</ul>
<p>Find:</p>
<ol>
<li>The average walk latency without a PWC.</li>
<li>The page-directory cache's hit rate and the average walk latency with the PWC.</li>
<li>The average walk latency if the page-directory cache doubles to 32 entries, and why the gain is small.</li>
<li>The CPI with and without the PWC, and the speedup.</li>
</ol>
<p><strong>Solution.</strong></p>
<ol>
<li><strong>Without a PWC</strong>, every walk reads all four levels in sequence: 12 + 12 + 12 + 42 = <strong>78 cycles</strong>.</li>
<li><strong>With the PWC.</strong> The table is 256 MB / 2 MB = 128 page-directory entries, all under one PDPT entry and one PML4 entry, since it sits inside one aligned 1 GB range. Every walk uses that PDPT entry, so after warm-up it never leaves the PDPT cache. The page-directory cache always holds 16 of the 128 page-directory entries, and the next probe's entry is uniformly random, so it hits with probability 16 / 128 = 12.5%.
<ul>
<li>A page-directory hit leaves 1 read: 2 + 42 = 44 cycles.</li>
<li>A miss there still hits at the PDPT level, leaving 2 reads: 2 + 12 + 42 = 56 cycles.</li>
</ul>
The average is 0.125 &times; 44 + 0.875 &times; 56 = 5.5 + 49 = <strong>54.5 cycles</strong>, 30% less than 78.</li>
<li><strong>32 entries:</strong> the hit rate becomes 32 / 128 = 25%, and the average is 0.25 &times; 44 + 0.75 &times; 56 = 11 + 42 = <strong>53 cycles</strong>, only 1.5 cycles better. Nearly all of the saving came from the PDPT level, which removes two 12-cycle reads on every walk. A page-directory hit removes only one more 12-cycle read, and the 42-cycle page-table read is left either way, since the PWC holds no leaf entries. Covering the whole table would take 128 entries, and even then the walk would cost 44 cycles.</li>
<li><strong>CPI.</strong> Walk cycles per instruction are 12 / 1,000 &times; latency.
<ul>
<li>Without a PWC: 0.6 + 0.012 &times; 78 = 0.6 + 0.936 = <strong>1.536</strong>.</li>
<li>With it: 0.6 + 0.012 &times; 54.5 = 0.6 + 0.654 = <strong>1.254</strong>.</li>
</ul>
The speedup is 1.536 / 1.254 &asymp; <strong>1.22</strong>. Even with the PWC, walks still take 0.654 / 1.254 &asymp; 52% of the time. The page-table read dominates, and only fewer walks (2 MB pages, so the table needs 128 L2 TLB entries) or a closer page-table line would cut it further.</li>
</ol>
</details>

<h3 id="sec-walkers">Multiple Walkers</h3>
<p>A walker is a small finite-state machine plus a register set that holds one walk in progress. The registers keep everything needed to resume the walk each time one of its reads returns. The figure shows walker 0 partway through the walk above, after the page-directory hit:</p>
<div class="tbl"><svg viewBox="0 0 680 352" role="img" aria-label="Walker 0, a state machine with a register set, partway through a walk. Its fields: busy 1, virtual page number 0x555555559, access type load, requester load-buffer entry 37, PCID 0x012, level PT (4 of 4), table base 0x58E22, permissions so far R/W and U/S with NX clear, read in flight 0x58E22AC8, prefetch walk no, fault none. On the left, an L2 TLB miss writes the virtual page number, access type, and requester registers, the page-walk cache writes the level and table base registers, and the walker's copy of CR3 writes the table base on a page-walk cache miss. On the right, the requester register wakes load-buffer entry 37, the table base and permissions registers fill the L2 TLB, the L1 DTLB, and the page-walk caches, and the read-in-flight register sends 8-byte entry reads to the L1 data cache, which returns the lines." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrWlk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<rect x="200" y="30" width="280" height="24" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="340" y="46" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">Walker 0: state machine + registers</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="200" y="54" width="280" height="22"/><rect x="200" y="76" width="280" height="22"/><rect x="200" y="98" width="280" height="22"/><rect x="200" y="120" width="280" height="22"/><rect x="200" y="142" width="280" height="22"/><rect x="200" y="252" width="280" height="22"/><rect x="200" y="274" width="280" height="22"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="200" y="164" width="280" height="22"/><rect x="200" y="186" width="280" height="22"/><rect x="200" y="208" width="280" height="22"/><rect x="200" y="230" width="280" height="22"/></g>
<g style="fill:var(--ink);font-size:11px"><text x="208" y="69">Busy</text><text x="208" y="91">Virtual page number</text><text x="208" y="113">Access type</text><text x="208" y="135">Requester</text><text x="208" y="157">PCID</text><text x="208" y="179">Level</text><text x="208" y="201">Table base (PFN)</text><text x="208" y="223">Permissions so far</text><text x="208" y="245">Read in flight</text><text x="208" y="267">Prefetch walk</text><text x="208" y="289">Fault</text></g>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="end"><text x="472" y="69">1</text><text x="472" y="91">0x555555559</text><text x="472" y="113">load</text><text x="472" y="135">LB entry 37</text><text x="472" y="157">0x012</text><text x="472" y="179" style="fill:var(--trace)">PT (4 of 4)</text><text x="472" y="201" style="fill:var(--trace)">0x58E22</text><text x="472" y="223" style="fill:var(--trace)">R/W, U/S, NX=0</text><text x="472" y="245" style="fill:var(--trace)">0x58E22AC8</text><text x="472" y="267">no</text><text x="472" y="289">none</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="20" y="76" width="140" height="66" rx="3"/><rect x="20" y="164" width="140" height="44" rx="3"/><rect x="20" y="230" width="140" height="44" rx="3"/><rect x="520" y="109" width="140" height="44" rx="3"/><rect x="520" y="178" width="140" height="48" rx="3"/><rect x="520" y="230" width="140" height="44" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="90" y="105">L2 TLB miss</text><text x="90" y="182">Page-walk caches</text><text x="90" y="248">CR3 copy</text><text x="590" y="127">Load buffer</text><text x="590" y="197">L2 TLB, L1 DTLB</text><text x="590" y="248">L1 data cache</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="90" y="121">VA, type, requester</text><text x="90" y="198">start level, table base</text><text x="90" y="264">table base on a PWC miss</text><text x="590" y="143">wake entry 37</text><text x="590" y="213">fill translation (+ PWC)</text><text x="590" y="264">entry reads, 8 bytes</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrWlk)"><path d="M160,87 H198"/><path d="M160,109 H198"/><path d="M160,131 H198"/><path d="M160,175 H198"/><path d="M160,192 H198"/><path d="M160,252 H180 V202 H198"/><path d="M480,131 H518"/><path d="M480,197 H518"/><path d="M480,219 H518"/><path d="M480,236 H518"/><path d="M520,247 H482"/></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="499" y="232">read</text><text x="499" y="260">line</text></g>
<text x="20" y="322" style="fill:var(--muted);font-size:11px">Highlighted: the progress registers, rewritten after every read. In all, under 200 bits of state per walker.</text>
<text x="20" y="340" style="fill:var(--muted);font-size:11px">More walkers means more register sets, plus the ports their reads and fills need.</text>
</svg></div>
<p>The boxes on the left feed the walker, and each arrow ends on the registers it writes:</p>
<ul>
<li><strong>L2 TLB miss:</strong> starts the walk. The miss logic gives a free walker the virtual address, the access type, and the ID of the requester waiting on it, here load-buffer entry 37.</li>
<li><strong>Page-walk caches:</strong> probed with the upper VA bits. A hit gives the level to start at and that table's frame number, so the walker skips the levels above it.</li>
<li><strong>CR3 copy:</strong> on a PWC miss, the walk starts at the top-level table, whose frame number comes from the walker's own copy of CR3.</li>
</ul>
<p>The boxes on the right are what the walker drives, each from the registers it uses:</p>
<ul>
<li><strong>Load buffer:</strong> when the walk ends, the walker wakes the entry named in Requester, and the load replays and hits in the L1 DTLB.</li>
<li><strong>L2 TLB, L1 DTLB:</strong> at the leaf, the walker writes the translation (the frame number in Table base) and the combined permissions into both TLBs. It also fills the PWCs with the upper-level entries it read.</li>
<li><strong>L1 data cache:</strong> each level's 8-byte entry read goes to the L1D at the address in Read in flight, and the returning line is matched to this walk by that address.</li>
</ul>
<p>The registers fall into three groups:</p>
<ul>
<li><strong>Request:</strong> the virtual page number, the PCID, the access type (load, store, or instruction fetch, which decides which permission is checked and whether the dirty bit is set), and the ID of the waiting requester (a load-buffer entry, a store-buffer entry, or the ITLB).</li>
<li><strong>Progress:</strong> the current level, the current table's frame number, and the address of the read in flight, so its response can be matched to this walk.</li>
<li><strong>Result so far:</strong> the permissions combined over the levels read, the page size once a leaf is found, a fault flag if the walk reached a not-present entry or a forbidden access, and whether the walk is a prefetch (see <a href="#/tlb/walk-prefetch">Translation Prefetching and Speculation</a>).</li>
</ul>
<p>A walker is cheap in registers. The expensive part is the traffic: each walker issues reads into the L1 data cache, competing with the program's loads for load ports and fill buffers, and needs a turn on the TLB and PWC fill paths. With one walker, every TLB miss waits behind the one before it. Intel went from one walker to two in Broadwell, and AMD went from two in Zen 2 to six in Zen 3. Walkers act like MSHRs for translation: their count caps how many TLB misses can be resolved at once, which is translation's memory-level parallelism (MLP). A miss to a page that already has a walk in flight doesn't take a second walker, it waits on the first, the way a secondary miss merges into an MSHR (see <a href="#/tlb/coalesce">Coalescing Page Walks</a>).</p>
<details class="ex"><summary>Worked example: how the walker count caps translation MLP</summary>
<p><strong>Question.</strong> A graph kernel on a 4 GHz core gathers from a 64 GB array mapped with 4 KB pages. A window of 32 independent loads is in flight, each to a different random page, so every one misses the L2 TLB. Assume:</p>
<ul>
<li>Every walk hits the page-directory cache, so it is one read, the page-table entry. The page tables for 64 GB of 4 KB pages take 64 GB / 512 = 128 MB, far more than the LLC, so that read goes to DRAM: about 300 cycles (75 ns).</li>
<li>Each data load then misses to DRAM too, another 300 cycles.</li>
<li>The core has 16 L1 fill buffers, shared by walker reads and data misses.</li>
<li>All 32 loads fit in the ROB, so nothing but the walkers and fill buffers limits overlap.</li>
</ul>
<p>How long do the 32 loads take with 1, 2, 4, and 6 walkers, and with TLB hits?</p>
<p><strong>Solution.</strong> Walks run in rounds of W, one round per 300 cycles. Each data load starts as soon as its walk ends, overlapping the next round of walks, and the last data loads finish 300 cycles after the last round. Even with 6 walkers, 6 walk reads plus 6 data misses use only 12 of the 16 fill buffers, so the batch takes &lceil;32 / W&rceil; &times; 300 + 300 cycles. Each load makes 2 DRAM accesses, 64 in all, so the average number in flight is 64 &times; 300 / total cycles. With TLB hits there are no walks, and the 16 fill buffers serve the 32 data misses in 2 rounds:</p>
<div class="tbl"><table>
<tr><th>Walkers</th><th>Rounds of walks</th><th>Cycles for 32 loads</th><th>Cycles per load</th><th>DRAM reads in flight (average)</th></tr>
<tr><td>1</td><td>32</td><td>9,900</td><td>309</td><td>1.9</td></tr>
<tr><td>2</td><td>16</td><td>5,100</td><td>159</td><td>3.8</td></tr>
<tr><td>4</td><td>8</td><td>2,700</td><td>84</td><td>7.1</td></tr>
<tr><td>6</td><td>6</td><td>2,100</td><td>66</td><td>9.1</td></tr>
<tr><td>TLB hits</td><td>0</td><td>600</td><td>19</td><td>16</td></tr>
</table></div>
<p>With one walker, translation sets the pace: the core keeps fewer than 2 DRAM reads in flight while its fill buffers could hold 16. Each doubling of the walker count nearly halves the time, as long as walkers are the bottleneck. Even with 6, the loads take 66 / 19 &asymp; 3.5&times; as long as with TLB hits, because each load now makes two serial DRAM accesses. More walkers can't remove that. Fewer page-table reads in DRAM can: with 2 MB pages, the page directories for 64 GB take only 256 KB, so each walk's one read usually hits on chip.</p>
</details>

<h3 id="sec-walk-prefetch">Translation Prefetching and Speculation</h3>
<p>A translation can be ready before the access that needs it arrives. Three things start a walk early, and each is an ordinary walk on a free walker:</p>
<ul>
<li><strong>Out-of-order and speculative loads.</strong> A walk starts as soon as a load's address is known, not when the load reaches the head of the ROB. So loads far ahead of retirement, and loads on paths that later turn out to be mispredicted, warm the TLB for the instructions behind them (see <a href="#/tlb/tlb-miss">From a TLB Miss to the Translation</a>). Software prefetches count as loads here: on recent x86 cores, a <code>PREFETCHT0</code> to a page missing in the TLB starts a walk, so software can prefetch the translation along with the data.</li>
<li><strong>Data prefetchers that cross a page.</strong> L2 prefetchers see physical addresses and stop at 4 KB page boundaries, since the next physical page is unrelated. A prefetcher that sees virtual addresses can follow a stream into the next page, and its request needs that page's translation first. Intel documents a next-page prefetcher in the L1 since Ivy Bridge. It watches for accesses near the end of a page and touches the next one, and measurements show it starts a walk on a TLB miss, so the translation arrives before the demand stream does.</li>
<li><strong>TLB prefetchers.</strong> These are triggered by demand L2 TLB misses. On each miss, the prefetcher predicts the next pages that will miss: the next sequential page, or a page at a distance it has seen between recent misses (Kandiraju and Sivasubramaniam's distance prefetching). It then queues prefetch walks for them.</li>
</ul>
<p>A prefetch walk is a normal walk, so it leaves something behind at every level it touches:</p>
<ul>
<li><strong>The translation:</strong> research designs put it in a small <strong>prefetch buffer</strong> next to the L2 TLB, a few dozen entries, rather than in the TLB, so a wrong guess can't evict a useful entry. A demand miss probes the buffer alongside the L2 TLB and moves a hit into the TLB. A simpler design writes the translation straight into the L2 TLB and accepts the pollution.</li>
<li><strong>The page-walk caches:</strong> filled with the upper-level entries the walk read, like any walk. A prefetch target is usually close to the demand page, so the PWC already holds its upper levels, and the prefetch walk is a single read.</li>
<li><strong>The data caches:</strong> each page-table line the walk reads is filled into the caches like any walker read. Some designs stop there and prefetch only page-table lines. ASAP (Margaritov et al.) has the OS place each level's tables contiguously, so the address of a lower-level entry can be computed straight from the VA, and prefetches those lines into the cache while the upper levels are still being read. The dependent chain then overlaps instead of running back to back.</li>
</ul>
<p>The prefetcher doesn't own walkers. It shares them with demand misses, at lower priority:</p>
<ol>
<li><strong>Trigger.</strong> A demand L2 TLB miss for page P takes a walker as usual. At the same time, the prefetcher predicts P + 1, or P + d for a distance d it has learned, and puts the prediction in a small prefetch queue, after filtering out pages already in the TLB, in the prefetch buffer, or being walked.</li>
<li><strong>Piggyback on the current walk.</strong> When the demand walk's last read returns, its 64-byte line also holds the page-table entries of 7 neighboring pages (step 3 of <a href="#/tlb/walk">What a Page Walk Does</a>). A "free" prefetcher copies the useful neighbors into the prefetch buffer with no extra memory access. Vavouliotis et al.'s SBFP samples which neighbor distances have been useful and keeps only those. A prediction of P + 1 that falls in the same line is served this way and never needs a walker.</li>
<li><strong>Walk only when a walker is idle.</strong> A queued prefetch that the line didn't cover starts a walk only when a walker is free. If demand misses arrive while walkers are busy with prefetches, the design either aborts a prefetch walk or lets it finish, trading wasted work against delaying the demand miss. With 2 walkers, prefetches run mostly between bursts of misses. With 6, they also get a share during a burst.</li>
<li><strong>Never fault.</strong> A prefetch walk that reaches a not-present entry or a forbidden access is simply dropped. There is no load to mark as faulting, so the OS never sees it. It never sets a dirty bit, though x86 allows any speculative walk, prefetches included, to set accessed bits.</li>
</ol>
<p>The risk is the same as for data prefetching. Useless prefetch walks take walker time and cache bandwidth away from demand misses, which is why Vavouliotis et al.'s ATP turns TLB prefetching off in program phases where it isn't helping.</p>

<h3 id="sec-hierarchy">The TLB Hierarchy</h3>
<p>Translation is cached in TLBs organized like data caches:</p>
<ul>
<li><strong>L1 TLBs</strong>, separate for instructions and data, small (tens of entries) and fast enough to look up in parallel with the L1 cache. With a virtually indexed, physically tagged L1, the cache set is chosen from page-offset bits while the TLB translates the rest, so translation adds no latency on a hit (see <a href="#/tlb/interaction-caches">Interaction with Caches</a>).</li>
<li><strong>A shared L2 TLB</strong> (thousands of entries) behind them, a few cycles slower. Zen 4, for example, has a 72-entry L1 DTLB and a 3,072-entry L2 DTLB.</li>
<li>Entries carry the page size, permissions, and an address-space tag (ASID or PCID) so context switches don't need a flush.</li>
</ul>

<h3 id="sec-tlb-miss">From a TLB Miss to the Translation</h3>
<p>On x86, Arm, and nearly all RISC-V cores, the whole walk is done by hardware. No instructions run, no microcode sequence starts, and the OS is not involved unless the walk ends in a fault. The walker is a finite-state machine in the memory unit (Intel calls it the page miss handler, or PMH), and it leads the walk from start to finish. Here is the path of a load, from issue to receiving its physical address:</p>
<ol>
<li><strong>Probe the L1 DTLB.</strong> The load's address-generation unit computes the virtual address. In the same cycle, the L1 DTLB is probed with the virtual page number and the L1 data cache is indexed with the page-offset bits.</li>
<li><strong>Probe the L2 TLB.</strong> The L1 DTLB misses, so the L2 TLB is probed with the same virtual page number. This costs several extra cycles, and a hit refills the L1 DTLB and the load continues.</li>
<li><strong>Hand the miss to a walker.</strong> The L2 TLB misses too. The miss logic allocates a free walker and gives it everything the walk needs: the virtual address, the access type (load, store, or instruction fetch), and the ID of the load-buffer entry waiting on it. This hand-off is the signal that starts the walk, and it comes from the TLB miss logic itself, not from the core's pipeline. If another walk for the same page is already in flight, the new miss usually waits on that one instead, the way an MSHR merges misses to the same line (see <a href="#/tlb/coalesce">Coalescing Page Walks</a>). If every walker is busy, the miss waits for one to free up.</li>
<li><strong>Put the load to sleep.</strong> The load can't finish without a physical address, so its load-buffer entry is marked as waiting on the walker and the load leaves its execution port. The port and the rest of the core move on to other work.</li>
<li><strong>Get the starting point.</strong> Nothing has to tell the core to read CR3. The walker keeps its own copy of the current CR3 value, which hardware updates whenever the OS writes CR3 on a context switch. The walker first probes the page-walk caches with the upper bits of the virtual address. A hit there gives it the frame number of a lower-level table directly, so it skips the levels above it.</li>
<li><strong>Walk the remaining levels.</strong> The walker runs the five steps from <a href="#/tlb/walk">What a Page Walk Does</a> once per remaining level. Its reads go into the L1 data cache like ordinary loads, but they come from the walker, not from the program. The walker's state holds the progress of the walk: the virtual address, the current level, the current table's base, and the permissions gathered so far.</li>
<li><strong>Fill the TLBs.</strong> At the last level, the walker writes the translation, its page size, and its permissions into the L2 TLB and the L1 DTLB. It also fills the page-walk caches with the upper-level entries it read.</li>
<li><strong>Wake the load.</strong> The walker signals the waiting load-buffer entry and frees itself for the next miss. The load is replayed: it probes the L1 DTLB again, hits, gets its physical frame number, and finishes the tag compare in the L1 data cache.</li>
</ol>
<p>The walk runs in parallel with the rest of the program. Only the load that missed and the instructions that depend on its value wait. Independent loads, stores, and arithmetic keep issuing out of order, and other loads may hit in the TLB or even start walks of their own on other walkers. The core stalls only when the waiting load reaches the head of the ROB and the ROB fills up behind it, which happens when the walk misses to DRAM. An instruction-fetch miss hurts more: the front end has nothing to fetch until the ITLB gets its translation, so the core runs only on the instructions already in its buffers.</p>
<p>Walks are also speculative. A load on a mispredicted path can start a walk, and if the load is squashed, the walk is dropped or finishes and just fills the TLB. For the same reason, a walk that ends at a not-present entry or a permission violation doesn't raise a page fault on the spot. It marks the load's ROB entry as faulting, and the core takes the fault only if that load reaches retirement, which keeps exceptions precise. Only then does software run: the OS fault handler fixes the table, and the load re-executes and walks again.</p>
<p>The alternative is a <strong>software-managed TLB</strong>, used by MIPS and older SPARC. There, a TLB miss raises an exception right away, and an OS handler made of ordinary instructions reads the page table and writes the entry into the TLB with a special instruction (<code>tlbwr</code> on MIPS). The OS can then use any table format it likes, but every miss costs a pipeline flush plus tens of instructions, and nothing else runs alongside it. That cost is why hardware walkers took over.</p>

<h3 id="sec-coalesce">Coalescing Page Walks</h3>
<p>Misses to the same page come in bursts. A loop streaming through an array issues dozens of loads to a new page before the first one's walk returns, and every one of them misses the TLB, because the translation arrives only when the walk ends. If each of those misses took its own walker, they would all repeat the same reads, and one page crossing could occupy every walker while misses to other pages wait. So the miss logic merges them: one walk per page, however many accesses wait on it. That takes three pieces:</p>
<ol>
<li><strong>Detect the match.</strong> Before allocating a walker, the miss logic compares the miss's virtual page number and PCID with those of every busy walker. With 4 to 6 walkers that is 4 to 6 comparators of about 48 bits, working in parallel, like an MSHR lookup but much smaller. A match makes the miss a <strong>secondary miss</strong>: it takes no walker and issues no reads. Two more places need the same check. Misses queued for a free walker must be checked against the walkers when they reach the head of the queue, or two queued misses to one page would each get a walker later. And a miss that arrives in the cycle a walk ends must see that walk's TLB fill, or it starts a walk the fill just made unnecessary.</li>
<li><strong>Record the waiters in the load buffer.</strong> The walker keeps no list of waiters. Its Requester field (in the figure in <a href="#/tlb/walkers">Multiple Walkers</a>) names only the miss that started the walk. Instead, each waiting load-buffer entry holds a <strong>wait tag</strong>: a valid bit plus the ID of the walker it waits on, 3 bits for 6 walkers. A primary miss writes the ID of the walker it was given, and a secondary miss writes the ID of the walker it matched, so from then on the two look the same. Any number of loads can wait on one walk, because the storage grows with the load buffer, not with the walker. Store-buffer entries waiting for a store-address translation get the same tag. An ITLB miss needs none: the fetch unit stalls and waits on a single walk.</li>
<li><strong>Wake every match.</strong> When the walk ends, the walker fills the TLBs and broadcasts its ID on a wake bus, the way a returning line wakes the loads waiting on an MSHR. Every entry whose tag matches clears it and is replayed: it probes the L1 DTLB again and hits. Each replayed access checks its own access type against the permission bits in the TLB entry, so a store that waited on a walk started by a load still gets its write check.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 324" role="img" aria-label="Coalescing a page walk. A new L2 TLB miss from load-buffer entry 52, for virtual page 0x555555559, is compared with the virtual page of every busy walker. Walker 0 is walking 0x555555559 and matches. Walker 1 is walking 0x7F12A0004 and walker 3 is walking 0x0004B2C17, which don't match, and walker 2 is idle. The miss takes no walker, and load-buffer entry 52 records wait tag W0. Entries 37 and 41 already wait on W0, entry 44 on W1, and entry 50 on W3. When walker 0's walk ends, it broadcasts its ID and a fault bit on the wake bus, and entries 37, 41, and 52 match, wake, and replay." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrCoal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<rect x="20" y="52" width="150" height="66" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/>
<text x="95" y="74" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">New L2 TLB miss</text>
<text x="95" y="92" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-family:var(--mono)">VPN 0x555555559</text>
<text x="95" y="108" text-anchor="middle" style="fill:var(--muted);font-size:10px">from LB entry 52</text>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="200" y="30" width="280" height="22"/><rect x="520" y="30" width="140" height="22"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600"><text x="208" y="45">Walker</text><text x="262" y="45">Busy</text><text x="302" y="45">VPN</text><text x="426" y="45">Match</text><text x="528" y="45">LB entry</text><text x="596" y="45">Waits on</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"><rect x="200" y="74" width="280" height="22"/><rect x="200" y="96" width="280" height="22"/><rect x="200" y="118" width="280" height="22"/><rect x="520" y="52" width="140" height="22"/><rect x="520" y="74" width="140" height="22"/><rect x="520" y="96" width="140" height="22"/><rect x="520" y="118" width="140" height="22"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="200" y="52" width="280" height="22"/><rect x="520" y="140" width="140" height="22"/></g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)"><text x="208" y="67">0</text><text x="262" y="67">1</text><text x="302" y="67">0x555555559</text><text x="426" y="67" style="fill:var(--trace)">yes</text><text x="208" y="89">1</text><text x="262" y="89">1</text><text x="302" y="89">0x7F12A0004</text><text x="426" y="89">no</text><text x="208" y="111">2</text><text x="262" y="111">0</text><text x="302" y="111">&ndash;</text><text x="426" y="111">&ndash;</text><text x="208" y="133">3</text><text x="262" y="133">1</text><text x="302" y="133">0x0004B2C17</text><text x="426" y="133">no</text></g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)"><text x="528" y="67">37</text><text x="596" y="67">W0</text><text x="528" y="89">41</text><text x="596" y="89">W0</text><text x="528" y="111">44</text><text x="596" y="111">W1</text><text x="528" y="133">50</text><text x="596" y="133">W3</text><text x="528" y="155">52</text><text x="596" y="155" style="fill:var(--trace)">W0 (new)</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrCoal)"><path d="M170,85 H198"/><path d="M480,63 H500 V151 H518"/><path d="M240,140 V205 H590 V164"/></g>
<text x="250" y="199" style="fill:var(--muted);font-size:11px">walk done: broadcast walker ID 0 and the fault bit</text>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="246">Detect: the miss's VPN matches walker 0, so it takes no walker. LB entry 52 just records tag W0.</text><text x="20" y="266">Wake: when walker 0 fills the TLBs, entries 37, 41, and 52 match its ID, wake, and replay.</text><text x="20" y="286">Entry 44 keeps waiting on walker 1 and entry 50 on walker 3. Walker 2 is idle.</text><text x="20" y="306">Each entry needs only a valid bit and a 2-bit walker ID, so one walk can have any number of waiters.</text></g>
</svg></div>
<p>The alternative keeps a <strong>target list</strong> in each walker, like the target list of an MSHR: a few slots, each holding one requester ID. It takes less storage, 6 walkers &times; 4 slots &times; 9 bits (a valid bit and an 8-bit load-buffer ID) is 216 bits, against 192 entries &times; 4 bits = 768 bits for wait tags in a 192-entry load buffer. But it caps the waiters per walk, and a streaming loop fills 4 slots within a couple of cycles. Every later miss to the page is then rejected and replayed until the walk ends, and each retry takes a load-port slot and another L2 TLB probe. Vendors don't document which scheme their cores use. Wait tags fit the replay machinery the load buffer already has for loads waiting on cache misses.</p>
<p>Merging is safe because a walk's result, the translation and its permission bits, doesn't depend on which access asked for it. The corner cases are the parts that do:</p>
<ul>
<li><strong>Faults.</strong> x86 never caches a translation unless every level is present, so a waiter replayed after a walk that found a not-present entry would miss again, merge into a new walk, and loop. So the wake broadcast carries the walk's fault bit, and every matching entry is marked faulting instead of replayed. As in <a href="#/tlb/tlb-miss">From a TLB Miss to the Translation</a>, the fault is taken only if one of those accesses reaches retirement.</li>
<li><strong>Dirty bit.</strong> A walk started by a load sets only the accessed bit. A store merged onto it gets a TLB entry with D clear, so on replay it has to go back to a walker to set D in memory, a second, short walk. A walk started by a store sets both bits, and loads merged onto it lose nothing.</li>
<li><strong>Squashes.</strong> A mispredict can squash the load that started the walk while older loads still wait on it. The walk goes on, since its translation is valid on any path, and the other entries keep their tags. A squashed entry's tag is cleared when the entry is freed, so a new load in that entry isn't woken by mistake. With per-walker target lists, a stale ID can wake an entry that was reallocated, but that is harmless: a wake only causes a replay, and a load whose page isn't in the TLB yet just misses again.</li>
<li><strong>Page size.</strong> The match uses the 4 KB page number, because the page size is known only when the walk reaches its leaf. Two concurrent misses 8 KB apart inside one 2 MB page each start a walk. The second one is short: the page-walk caches skip the upper levels, and it stops at the page-directory entry, with PS = 1, often read from a line the first walk just brought into L1.</li>
</ul>
<p>Coalescing also happens one level down. Walks for neighboring pages read entries from the same 64-byte page-table line (step 3 of <a href="#/tlb/walk">What a Page Walk Does</a>), and if that line isn't in L1, the second walker's read merges into the first one's L1 MSHR. The walks stay separate, but they make one memory access. In a simulator, merging is a lookup keyed by (PCID, VPN) before a walker is allocated, plus a list of requests that all complete at the fill. Leaving it out makes a streaming loop look walker-bound, with dozens of walks per page crossing instead of one.</p>
<details class="ex"><summary>Worked example: one page crossing, with and without merging</summary>
<p><strong>Question.</strong> A dot-product loop on a core like Golden Cove loads 32 bytes from array <code>a</code> and then 32 bytes from array <code>b</code> in each iteration. Assume:</p>
<ul>
<li>The core runs 1 iteration per cycle, so it issues 2 loads per cycle, and the 192-entry load buffer and 512-entry ROB never fill.</li>
<li>Both arrays use 4 KB pages. <code>a</code> starts at a page boundary and <code>b</code> at page offset 0x080, so <code>b</code> reaches each new page 4 iterations before <code>a</code>.</li>
<li>Cycle 0 is the cycle in which <code>b</code>'s first load to its new page issues. A load's L2 TLB miss reaches the walkers in the cycle it issues (the real L1 and L2 TLB delay is the same for every load, so leaving it out shifts every time equally).</li>
<li>The core has 4 page walkers, as Golden Cove does, all idle at cycle 0. Each walk takes 20 cycles: the page-directory cache hits and the page-table entry comes from L2. A walk that starts in cycle t fills the TLBs in cycle t + 20, and loads issued from then on hit.</li>
<li>There is no TLB prefetching.</li>
<li>Without merging, every L2 TLB miss takes a free walker. When none is free, misses wait in a FIFO in issue order. As soon as a walker frees up, the FIFO hands it to the oldest queued miss whose page is still not in the TLB, and the queued misses whose page has been filled replay and hit.</li>
</ul>
<p>Answer these:</p>
<ol>
<li>With merging and without it, how many walks start for the two new pages, and in which cycle is <code>a</code>'s translation in the TLB?</li>
<li>With merging, how many loads wait on each walk, and how many load-buffer entries hold a wait tag at the peak? What would a target list of 4 requester slots per walker do with these loads?</li>
</ol>
<p><strong>Solution.</strong></p>
<ol>
<li><strong>With merging.</strong> <code>b</code>'s miss in cycle 0 takes walker 0, which fills the TLBs in cycle 20. <code>b</code>'s misses in cycles 1&ndash;19 match walker 0 and take no walker. <code>a</code> reaches its new page in cycle 4, matches no walker, and takes walker 1, which fills in cycle 24. That is <strong>2 walks</strong>, <code>a</code>'s translation is ready in <strong>cycle 24</strong>, and walkers 2 and 3 stay free the whole time.</li>
<li><strong>Without merging.</strong> <code>b</code>'s misses in cycles 0, 1, 2, and 3 take walkers 0&ndash;3, four walks of the same page. In cycle 4, <code>a</code>'s first miss finds no free walker and becomes the oldest entry in the FIFO, ahead of <code>b</code>'s miss from the same cycle, since <code>a</code> is loaded first. Walker 0 frees up in cycle 20 and goes to <code>a</code>, whose walk fills in cycle 40. Walkers 1&ndash;3 free up in cycles 21&ndash;23 after finishing duplicate walks of <code>b</code>'s page. <code>b</code>'s queued misses now hit, but <code>a</code>'s misses from cycles 5, 6, and 7 still find <code>a</code>'s page missing and take them. That is <strong>8 walks</strong>, 6 of them redundant, and <code>a</code>'s translation is ready in <strong>cycle 40</strong>, 16 cycles later. From cycle 3 to cycle 39 every walker is busy, so a third stream crossing a page in that window would wait too.</li>
<li><strong>Waiters.</strong> Walker 0 has the 20 <code>b</code> loads issued in cycles 0&ndash;19, and walker 1 has the 20 <code>a</code> loads issued in cycles 4&ndash;23. The peak is in cycle 19: 20 <code>b</code> loads plus the 16 <code>a</code> loads from cycles 4&ndash;19, so 36 entries hold a wait tag, well within 192. With 4 walkers, each tag is a valid bit and a 2-bit ID.</li>
<li><strong>Target lists.</strong> Walker 0's 4 slots fill with <code>b</code>'s misses from cycles 0&ndash;3, and walker 1's with <code>a</code>'s from cycles 4&ndash;7. The other 16 + 16 = 32 loads find the list full and are rejected. Each retry takes another load-port slot and L2 TLB probe until its walk ends, competing with the loop's own loads.</li>
</ol>
</details>

<h3 id="sec-reach">TLB Reach</h3>
<p><strong>Reach</strong> is how much memory the TLB covers: entries × page size. With 4 KB pages, a 3,072-entry L2 TLB reaches 12 MB, smaller than many last-level caches, so a workload can hit in L3 and still miss in the TLB on every access. With 2 MB pages the same entries reach 6 GB.</p>

<h3 id="sec-huge-pages">Huge Pages</h3>
<p>A huge page is a leaf entry one or two levels early. On x86-64, a page directory entry with its page-size (PS) bit set maps a 2 MB page directly: its frame number names a 2 MB-aligned physical region, and the low 21 bits of the virtual address are the offset. A PDPT entry with PS set maps 1 GB the same way, with a 30-bit offset. Three things improve together:</p>
<ul>
<li><strong>Reach:</strong> one TLB entry covers 512 or 262,144 times as much memory.</li>
<li><strong>Walk length:</strong> 3 dependent loads for a 2 MB page and 2 for a 1 GB page, against 4.</li>
<li><strong>Page-table size:</strong> one directory entry replaces a whole 4 KB page table, so the remaining tables are small enough to stay in the data caches.</li>
</ul>
<p>That is why large-memory workloads (databases, JVMs, HPC codes, in-memory key-value stores) use huge pages, through explicit reservations or the kernel's transparent huge pages. The costs: memory fragmentation, internal waste for sparse data, and slower page faults (zeroing 2 MB at once). A 2 MB page also needs 2 MB of contiguous, aligned free physical memory, which a long-running system may not have without compaction, so Linux's <code>khugepaged</code> merges 4 KB pages into huge pages in the background.</p>

<h3 id="sec-interaction-caches">Interaction with Caches</h3>
<p>A virtually indexed, physically tagged (VIPT) L1 indexes with untranslated offset bits while the L1 TLB translates the tag in parallel, which bounds L1 size to page size × ways. See <a href="#/dcache">Data cache</a>.</p>
<p>Zen 4's L1 data cache is 32 KB and 8-way with 64-byte lines, so it has 32 KB / (8 × 64 B) = 64 sets: a 6-bit set index above a 6-bit block offset. Together they are exactly the 12-bit page offset, which translation never changes. The cache reads the selected set while the TLB translates the page number, and only the final tag compare waits for the frame number:</p>
<div class="tbl"><svg viewBox="0 0 680 552" role="img" aria-label="A virtually indexed, physically tagged lookup in a 32 KB, 8-way L1 data cache with 64-byte lines, so 64 sets, and 4 KB pages. The virtual address splits into the virtual page number, bits 47 to 12, and the page offset, bits 11 to 0. The virtual page number goes to the L1 DTLB, which returns the physical frame number. The page offset is the same 12 bits in the physical address and needs no translation. The cache splits the physical address into the tag, bits 51 to 12, which is the frame number from the TLB, the set index, bits 11 to 6, and the block offset, bits 5 to 0. The set index selects one of the 64 sets while the TLB is translating, reading 8 tags and 8 lines. The 8 tags are compared with the frame number from the TLB, the hit way selects one line, and the block offset selects the bytes for the load." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrVIPT" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">VIPT lookup: 32 KB, 8-way L1 data cache, 64-byte lines (64 sets), 4 KB pages</text>
<text x="20" y="38" style="fill:var(--ink);font-size:11px;font-weight:600">Virtual address, as the TLB sees it</text>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="20" y="44" width="400" height="46" rx="3"/><rect x="20" y="196" width="400" height="46" rx="3"/><rect x="150" y="430" width="140" height="36" rx="3"/></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="420" y="44" width="240" height="46" rx="3"/><rect x="420" y="196" width="120" height="46" rx="3"/><rect x="540" y="196" width="120" height="46" rx="3"/><rect x="400" y="430" width="260" height="36" rx="3"/></g>
<rect x="120" y="112" width="200" height="40" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="220" y="62">Virtual page number</text><text x="540" y="62">Page offset</text><text x="220" y="129">L1 DTLB</text><text x="220" y="214">Tag = PFN</text><text x="480" y="214">Set index</text><text x="600" y="214">Block offset</text><text x="220" y="452">8 tag compares</text><text x="530" y="452">Way select, then byte select</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="220" y="78">bits 47–12, 36 bits</text><text x="540" y="78">bits 11–0, 12 bits</text><text x="220" y="145">VPN to PFN</text><text x="220" y="230">bits 51–12, from the TLB</text><text x="480" y="230">bits 11–6, 64 sets</text><text x="600" y="230">bits 5–0, 64 B line</text></g>
<g style="stroke:var(--rule);stroke-width:1.5;stroke-dasharray:4 3"><path d="M420,90 V196"/><path d="M660,90 V196"/></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle"><text x="540" y="136">same 12 bits, not translated,</text><text x="540" y="150">so the set read starts at once</text></g>
<text x="236" y="258" style="fill:var(--ink);font-size:11px;font-weight:600">Physical address, as the cache splits it</text>
<rect x="380" y="300" width="224" height="90" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1.5"/>
<rect x="380" y="336" width="224" height="14" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1"/>
<g style="stroke:var(--rule);stroke-width:1"><path d="M408,300 V390"/><path d="M436,300 V390"/><path d="M464,300 V390"/><path d="M492,300 V390"/><path d="M520,300 V390"/><path d="M548,300 V390"/><path d="M576,300 V390"/></g>
<text x="548" y="318" text-anchor="middle" style="fill:var(--muted);font-size:10px">64 sets × 8 ways</text>
<text x="548" y="372" text-anchor="middle" style="fill:var(--pad);font-size:10px">selected set</text>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrVIPT)"><path d="M220,90 V110"/><path d="M220,152 V194"/><path d="M220,242 V428"/><path d="M480,242 V334"/><path d="M380,343 H260 V428"/><path d="M560,390 V428"/><path d="M640,242 V428"/><path d="M290,448 H398"/><path d="M530,466 V486"/></g>
<g style="fill:var(--muted);font-size:10px"><text x="320" y="337" text-anchor="middle">8 tags</text><text x="566" y="414">8 lines</text><text x="344" y="442" text-anchor="middle">hit, way</text><text x="530" y="500" text-anchor="middle">bytes to the load</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="526">Set index + block offset = 6 + 6 = 12 bits = the page offset, so no index bit needs translation.</text>
<text x="20" y="544">That holds while size ÷ ways ≤ page size: 32 KB ÷ 8 ways = 4 KB.</text></g>
</svg></div>
<p>A 64 KB, 8-way cache would need a 7th index bit, bit 12, which belongs to the virtual page number. Two virtual addresses that map to the same physical line (synonyms) could then land in different sets. So designers add ways instead: Golden Cove's 48 KB L1 data cache is 12-way, still 4 KB per way.</p>

<h3 id="sec-virt">Virtualization: Two-Dimensional Walks</h3>
<p>Under hardware virtualization (Intel EPT, AMD NPT), the guest's page table holds guest-physical addresses, and each of them must itself be translated through the host's table. With 4 levels on each side, a walk can need up to (4 + 1) × (4 + 1) − 1 = <strong>24</strong> memory references: each of the guest's 4 table reads and the final guest-physical address needs a host walk of up to 4 references, plus the 4 guest reads themselves. Page-walk caches for both dimensions and huge pages on the host side are what keep virtualized TLB misses affordable.</p>

<h3 id="sec-power-performance-area">Power, Performance, Area</h3>
<ul>
<li><strong>Bigger TLBs:</strong> more reach, but the L1 TLB is looked up in parallel with the L1 cache, so its size is latency-limited, like the L1 cache's. Capacity goes into the L2 TLB instead, which is slower but is reached only on an L1 TLB miss.</li>
<li><strong>Larger pages:</strong> more reach and shorter walks, but more internal fragmentation and costlier copy-on-write and zeroing (see <a href="#/tlb/huge-pages">Huge Pages</a>).</li>
<li><strong>Hardware walkers:</strong> much faster than software-managed TLBs, and small in area, since a walker is a state machine plus a few registers. Several concurrent walkers help irregular workloads, and page-walk caches cost little because a few dozen upper-level entries cover most walks.</li>
</ul>

<h3 id="sec-model">Modeling Translation</h3>
<ul>
<li>Model the walk as real loads through the cache hierarchy, not a fixed latency; walk cost depends on whether page-table lines are cached, which depends on the workload's footprint.</li>
<li>Model the number of walkers and page-walk caches, since they set translation's MLP.</li>
<li>Use the page sizes the real system would use: a simulator that hands out 4 KB pages for a workload that runs on 2 MB pages in production overstates TLB misses enormously, and vice versa.</li>
<li>Count TLB shootdowns and context switches if the workload has them; trace-driven models usually don't see them.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix B and Chapter 2 (virtual memory and TLBs) · Bhargava, Serebrin, Spadini, and Manne, "Accelerating Two-Dimensional Page Walks for Virtualized Systems," ASPLOS 2008 · Barr, Cox, and Rixner, "Translation Caching: Skip, Don't Walk (the Page Table)," ISCA 2010 · Kandiraju and Sivasubramaniam, "Going the Distance for TLB Prefetching," ISCA 2002 · Margaritov et al., "Prefetched Address Translation," MICRO 2019 · Vavouliotis et al., "Exploiting Page Table Locality for Agile TLB Prefetching," ISCA 2021 · Intel, <em>Intel 64 and IA-32 Architectures Software Developer's Manual</em>, Volume 3, Chapter 4 (paging) · AMD, <em>Software Optimization Guide for the AMD Zen 4 Microarchitecture</em> · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em></p>`,
  practice: {
    guided: [
      {
        q: `<p>A key-value store randomly accesses a 32 GB table on a core whose L2 TLB has 2,048 entries for 4 KB or 2 MB pages and 16 entries for 1 GB pages. A 1 GB page walk reads only the top two page-table levels. What fraction of accesses miss the TLB with 4 KB pages, with 2 MB pages, and with 1 GB pages (assume uniform random access, and that the TLB holds only data pages)?</p>`,
        a: `<ol><li>4 KB pages: reach 2,048 × 4 KB = 8 MB. Hit fraction ≈ 8 MB / 32 GB ≈ 0.024%, so <strong>almost every access misses</strong>.</li><li>2 MB pages: reach 4 GB, so hit fraction ≈ 4 / 32 = 12.5%: about <strong>87.5% miss</strong>. Better per walk (fewer levels, smaller page tables that cache well), but still mostly misses.</li><li>1 GB pages: the table needs only 32 translations, but only 16 fit. Hit fraction ≈ 16 / 32 = 50%, so <strong>about 50% miss</strong>. Each walk, though, reads only two levels, and those 32 entries sit in a few lines that stay cached, so translation cost nearly disappears.</li><li>For random access over huge data, only 1 GB pages remove translation cost; 2 MB pages mainly make each walk cheaper.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An 8-row image filter runs on a Zen 5 core. The image is 4,096 pixels of 4 bytes wide, so each row is 16 KB, and every row starts at a page boundary. Each iteration loads one 64-byte line from each of rows 0&ndash;7, in row order, and then moves 64 bytes to the right. So all 8 rows reach a new 4 KB page in the same iteration. Assume:</p><ul><li>The core issues 2 of these 512-bit loads per cycle, so an iteration takes 4 cycles. Cycle 0 is the cycle in which row 0's first load to its new page issues, together with row 1's.</li><li>The core has 6 page walkers, all idle at cycle 0. Every walk takes 25 cycles: the page-directory cache hits, and the page-table entry comes from L2. A walk that starts in cycle t fills the TLBs in cycle t + 25, and loads issued from then on hit.</li><li>A load's L2 TLB miss reaches the walkers in the cycle it issues. Misses that find no free walker wait in a queue, in issue order, and the queue is long enough. When a walker frees up, it goes to the oldest queued miss whose page isn't in the TLB yet, and queued misses whose page has been filled replay and hit.</li><li>The 202-entry load queue and the ROB never fill, and there is no TLB prefetching.</li></ul><ol><li>With walk merging, how many walks start, and in which cycle does each row's translation arrive?</li><li>Without merging, so that every miss to a page with no fill yet can take a free walker, answer the same question. Does merging make the page crossing finish sooner? What does it save?</li><li>With merging, what is the largest number of loads waiting for a translation at once? How many bits do wait tags (a valid bit and a walker ID) take across the whole load queue?</li></ol>`,
        a: `<ol><li><strong>With merging: 8 walks.</strong> Rows 0 and 1 miss in cycle 0, rows 2 and 3 in cycle 1, and rows 4 and 5 in cycle 2, and they take walkers 0&ndash;5, which fill in cycles 25, 26, and 27. Rows 6 and 7 miss in cycle 3, find all 6 walkers busy, and queue. Their later misses (cycles 7, 11, &hellip;) queue behind them and merge once the first ones have walkers. Walkers 0 and 1 free up in cycle 25 and take rows 6 and 7, which fill in cycle <strong>50</strong>. Fills: rows 0&ndash;1 in cycle 25, rows 2&ndash;3 in 26, rows 4&ndash;5 in 27, rows 6&ndash;7 in 50.</li><li><strong>Without merging: 12 walks.</strong> The first 6 walks and the cycle-25 hand-off to rows 6 and 7 are the same. In cycle 26, walkers 2 and 3 free up. The queued misses of rows 0&ndash;3 now hit, but the cycle-6 misses of rows 4 and 5 find no fill yet (it comes in cycle 27), so they take walkers 2 and 3 for duplicate walks. In cycle 27, walkers 4 and 5 go to the cycle-7 misses of rows 6 and 7, whose walks are still in flight. Every page is filled in the same cycle as with merging, so the crossing ends in cycle <strong>50 either way</strong>: the walker count, not merging, sets the pace, because 8 pages need 2 rounds on 6 walkers. Merging saves 4 duplicate walks, 4 &times; 25 = 100 walker-cycles plus their L2 reads. More importantly, without merging all 6 walkers are busy from cycle 27 to cycle 50, so any other TLB miss in that window (a store stream, a lookup table, the next instruction page) waits until cycle 50. With merging, walkers 2&ndash;5 are free from cycle 27.</li><li><strong>Waiting loads.</strong> Each row issues a load every 4 cycles, so row r has loads in cycles &lfloor;r / 2&rfloor; + 4k. The peak is in cycle 24, just before the first fill: rows 0&ndash;1 have 7 each (cycles 0&ndash;24), and rows 2&ndash;3, 4&ndash;5, and 6&ndash;7 have 6 each, so 14 + 12 + 12 + 12 = <strong>50</strong> loads. In cycle 25, rows 0 and 1 wake and the count drops to 38. Rows 6 and 7 later reach 12 waiting loads each (cycles 3&ndash;47). With 6 walkers, an ID is 3 bits, so a tag is 4 bits and the load queue needs 202 &times; 4 = <strong>808 bits</strong>. A per-walker target list would have to hold 7 waiters to avoid rejections on rows 0&ndash;5, and 12 on rows 6&ndash;7.</li></ol>`
      },
      {
        q: `<p>A workload runs 30% slower inside a virtual machine than on bare metal, with no I/O involved. The guest and host both use 4-level page tables. Counters show the same L2 TLB miss rate in both. Explain the gap and propose fixes.</p>`,
        a: `<p>The miss rate is the same, but each miss costs far more: a native walk is up to 4 dependent references, while a nested walk is up to 24, and the extra host-table lines compete for cache space, so more of those references miss. Confirm with page-walk cycles per miss (Intel's <code>DTLB_LOAD_MISSES.WALK_ACTIVE</code> divided by completed walks) inside and outside the VM. Fixes: back the guest with huge pages on the host (2 MB or 1 GB host pages remove most of the host dimension), use huge pages in the guest too, and make sure the host doesn't split those pages (for example, through memory overcommit or deduplication).</p>`
      },
      {
        q: `<p>An Ice Lake server runs a guest that uses 5-level paging (57-bit addresses) on a host whose extended page tables use 4 levels. How many memory references can one guest TLB miss cost in the worst case, and what removes most of them?</p>`,
        a: `<ol><li>Every guest page-table pointer is a guest-physical address, so each of the 5 guest table reads needs a host walk of up to 4 references before the read itself: 5 × (4 + 1) = 25.</li><li>The final guest-physical address of the data needs one more host walk: 4.</li><li>Total: (n + 1)(m + 1) − 1 with n = 5 and m = 4, so 6 × 5 − 1 = <strong>29</strong> references, against 5 natively.</li><li>Page-walk caches for both dimensions skip most upper levels, and huge pages on the host cut each host walk to 2 or 3 references. Huge pages in the guest also shorten the guest dimension.</li></ol>`
      }
    ]
  }
},

{
  id: "exceptions",
  region: "os",
  title: "Faults, Traps, Interrupts, and System Calls",
  sections: [
    { id: "privilege-levels", label: "Privilege Levels" },
    { id: "out-order-core", label: "Making the Exception Precise" },
    { id: "hardware-sequence", label: "The Hardware Sequence" },
    { id: "trap-frame", label: "The Handler and the Trap Frame" },
    { id: "return", label: "Returning to User Mode" },
    { id: "system-calls", label: "System Calls" },
    { id: "performance-trade-offs", label: "Performance Trade-Offs" }
  ],
  body: `
<p>User code can't touch the page tables, the devices, or other processes. The only way into the kernel is for the core itself to transfer control there, to an address the kernel chose in advance. Four kinds of event do that. They differ in what causes them and where execution resumes. Main sources: Hennessy and Patterson (appendix C on exceptions in pipelines, and chapter 3 on reorder buffers), Bryant and O’Hallaron chapter 8, the RISC-V privileged specification, and the Intel SDM volume 3.</p>
<div class="tbl"><table>
<tr><th>Type</th><th>Cause</th><th>Timing</th><th>Resumes at</th><th>Examples</th></tr>
<tr><td>Fault</td><td>Instruction can't complete, but it's fixable</td><td>Synchronous, before completion</td><td>The faulting instruction (re-executed)</td><td>Page fault, protection fault</td></tr>
<tr><td>Trap</td><td>Intentional, or reported after completion</td><td>Synchronous, after completion</td><td>The next instruction</td><td>System call, breakpoint, single-step</td></tr>
<tr><td>Abort</td><td>Unrecoverable error</td><td>Synchronous or not</td><td>Usually doesn't resume</td><td>Machine check, double fault</td></tr>
<tr><td>Interrupt</td><td>External device or timer</td><td>Asynchronous</td><td>Between instructions</td><td>Timer, I/O completion, inter-processor interrupt</td></tr>
</table></div>

<h3 id="sec-privilege-levels">Privilege Levels</h3>
<p>The current privilege level is a few bits of core state: the low 2 bits of the CS register on x86, the EL field of PSTATE on ARM, and a mode register that software can't read directly on RISC-V. It decides two things:</p>
<ul>
<li><strong>Which instructions run:</strong> writing the page-table base (CR3, TTBR0_EL1, <code>satp</code>), masking interrupts, accessing devices, and returning from an exception all fault in user mode.</li>
<li><strong>Which pages are reachable:</strong> every page-table entry has a user/supervisor bit, so kernel memory can stay mapped in every address space and still fault on a user access (see <a href="#/virtual-memory/pages-page-tables">Pages and Page Tables</a>).</li>
</ul>
<p>x86 has rings 0–3 (kernel in 0, user in 3). ARM has exception levels EL0 (user), EL1 (kernel), EL2 (hypervisor), and EL3 (secure monitor). RISC-V has user, supervisor, and machine modes. No instruction raises privilege directly. Privilege goes up only through an exception entry, which always lands on a handler the kernel installed, and comes down only through an exception-return instruction.</p>

<h3 id="sec-out-order-core">Making the Exception Precise</h3>
<p>Hennessy and Patterson call an exception <strong>precise</strong> if the core stops so that every instruction before the faulting one has completed, and neither the faulting instruction nor anything after it has changed architectural state. The handler can then fix the cause and restart from one PC as if nothing had happened. An out-of-order core finishes instructions out of order, so it gets this property from the reorder buffer:</p>
<ol>
<li><strong>Detect:</strong> the unit that finds the problem writes an exception code into the instruction's ROB entry, plus the faulting address if there is one. That unit is decode for an illegal opcode, the TLB or page walker for a page fault, and the divider for a divide error. Nothing else happens yet.</li>
<li><strong>Wait:</strong> the instruction may be on a mispredicted path. If an older branch turns out to be mispredicted, the flush removes the faulting entry and the exception never happened. Meanwhile, younger instructions keep executing speculatively, which is the window Meltdown exploited.</li>
<li><strong>Take it at the head:</strong> when the entry reaches the ROB head, every older instruction has committed. The core flushes the ROB, the issue queues, and the load and store queues, and restores the rename map from the committed (retirement) map. Stores that already committed and sit in the store buffer still drain to memory, since they are architectural. Then the front end is redirected to the handler.</li>
</ol>
<p>Because exceptions are taken in commit order, the oldest one always wins, even if a younger instruction detected its fault first. An interrupt has no faulting instruction, so the core chooses a boundary: it flushes everything uncommitted and saves the PC of the oldest uncommitted instruction as the resume point. Flushing keeps interrupt latency short but throws away the work in flight, which in a 512-entry ROB (Intel's Golden Cove) can be hundreds of instructions that are fetched again after the handler. See <a href="#/rob">Reorder buffer</a>.</p>

<h3 id="sec-hardware-sequence">The Hardware Sequence</h3>
<p>Once the exception is taken, the core runs a fixed sequence with no software involved. RISC-V shows it most plainly. For an exception taken from user mode into supervisor mode:</p>
<ol>
<li><strong>Save the resume PC</strong> in <code>sepc</code>: the faulting instruction for a fault, the <code>ecall</code> itself for a system call, or the oldest uncommitted instruction for an interrupt.</li>
<li><strong>Record the cause</strong> in <code>scause</code>, an interrupt bit plus a code (13 for a load page fault, 8 for an <code>ecall</code> from user mode), and the detail in <code>stval</code>: the faulting virtual address, or the bits of an illegal instruction.</li>
<li><strong>Save the old mode and interrupt state</strong> in <code>sstatus</code>. SPP takes the previous privilege, SPIE takes the old interrupt-enable bit, and SIE is cleared, so the handler starts with interrupts off.</li>
<li><strong>Raise privilege</strong> to supervisor mode.</li>
<li><strong>Jump</strong> to the address in <code>stvec</code>, which the kernel set at boot. In vectored mode, interrupts go to the base plus 4 × the cause code instead.</li>
</ol>
<p>RISC-V saves no general registers and doesn't switch stacks. x86 and ARM do some of that in hardware:</p>
<div class="tbl"><table>
<tr><th>Step</th><th>x86-64 (interrupt or exception from ring 3)</th><th>ARMv8-A (EL0 to EL1)</th><th>RISC-V (user to supervisor)</th></tr>
<tr><td>Resume PC</td><td>Pushed on the kernel stack (RIP)</td><td>ELR_EL1</td><td><code>sepc</code></td></tr>
<tr><td>Cause</td><td>The vector number selects the IDT entry, some vectors push an error code, and CR2 holds a page fault's address</td><td>ESR_EL1 (exception class and syndrome), FAR_EL1 for the address</td><td><code>scause</code>, <code>stval</code></td></tr>
<tr><td>Old state</td><td>RFLAGS, CS, SS, and RSP pushed, and an interrupt gate clears IF</td><td>SPSR_EL1 takes PSTATE, and the DAIF masks are set</td><td><code>sstatus</code> SPP and SPIE, SIE cleared</td></tr>
<tr><td>Stack</td><td>Loads RSP from the TSS (RSP0, or an IST entry for faults that need a known-good stack)</td><td>Switches to the banked SP_EL1</td><td>None. The handler finds its own.</td></tr>
<tr><td>Handler address</td><td>The IDT entry for the vector</td><td>VBAR_EL1 plus an offset for the source level and type (0x400 for a synchronous exception from AArch64 EL0)</td><td><code>stvec</code></td></tr>
<tr><td>Return instruction</td><td><code>iretq</code>, or <code>sysretq</code> after <code>syscall</code></td><td><code>eret</code></td><td><code>sret</code></td></tr>
</table></div>

<h3 id="sec-trap-frame">The Handler and the Trap Frame</h3>
<p>The hardware saves only what it must to reach the handler. The kernel's entry code, written in assembly, saves everything else before any C code runs:</p>
<ol>
<li><strong>Get a trustworthy stack.</strong> The user stack pointer can't be used: it may be unmapped, point into kernel memory, or be changed by another user thread mid-call. On RISC-V, the entry code swaps a register with <code>sscratch</code>, which the kernel loaded with a pointer to the current thread's kernel data, and finds the kernel stack from there. On x86-64, <code>syscall</code> doesn't switch stacks, so the entry code runs <code>swapgs</code> to reach per-CPU data, saves the user RSP there, and loads the kernel stack pointer.</li>
<li><strong>Build the trap frame.</strong> Push all general registers, plus the saved PC, status, and cause, onto the kernel stack. This <strong>trap frame</strong> (<code>struct pt_regs</code> on Linux) is the user thread's complete register state.</li>
<li><strong>Dispatch</strong> to the C handler for the cause: the page-fault handler, the system-call table, or a device's interrupt handler.</li>
</ol>
<p>The trap frame is what the rest of the kernel works on. A system call returns its result by writing the saved <code>rax</code> or <code>a0</code>. A context switch is the kernel returning through a different thread's trap frame. A signal is delivered by editing the saved PC (see <a href="#/process-syscalls/signals">Signals</a>).</p>

<h3 id="sec-return">Returning to User Mode</h3>
<ol>
<li><strong>Choose where to go.</strong> Usually back to the same thread. If the scheduler picked another thread, the kernel switches to that thread's kernel stack and returns through its trap frame instead. If a signal is pending, it edits the trap frame first.</li>
<li><strong>Switch page tables if needed.</strong> With kernel page-table isolation (KPTI, for Meltdown-affected x86 cores), CR3 goes back to the user page table.</li>
<li><strong>Restore the general registers</strong> from the trap frame.</li>
<li><strong>Execute the return instruction.</strong> <code>sret</code> sets the PC to <code>sepc</code>, the privilege to SPP, and SIE to SPIE in one step, so user code never runs with kernel privilege and the kernel never runs at a user PC.</li>
</ol>
<p>The saved PC is what makes a fault different from a trap. A fault leaves it at the faulting instruction, so returning re-executes it. RISC-V also leaves <code>sepc</code> at the <code>ecall</code>, so the kernel adds 4 before returning, or the system call would repeat forever. x86 <code>syscall</code> and ARM <code>svc</code> save the address of the next instruction instead.</p>

<h3 id="sec-system-calls">System Calls</h3>
<p>A system call is a trap the program asks for. The C function <code>read</code> is a short libc wrapper: it puts the call number and arguments in registers and executes the trap instruction.</p>
<div class="tbl"><table>
<tr><th></th><th>x86-64 Linux</th><th>AArch64 Linux</th><th>RISC-V Linux</th></tr>
<tr><td>Trap instruction</td><td><code>syscall</code></td><td><code>svc #0</code></td><td><code>ecall</code></td></tr>
<tr><td>Call number</td><td>rax</td><td>x8</td><td>a7</td></tr>
<tr><td>Arguments</td><td>rdi, rsi, rdx, r10, r8, r9</td><td>x0–x5</td><td>a0–a5</td></tr>
<tr><td>Result</td><td>rax</td><td>x0</td><td>a0</td></tr>
</table></div>
<p>x86 passes the fourth argument in r10 instead of the usual rcx because <code>syscall</code> itself overwrites rcx with the return address and r11 with RFLAGS. A result from −4095 to −1 is an error code, which the wrapper turns into a return value of −1 plus <code>errno</code>.</p>
<p><code>syscall</code> is faster than going through an interrupt vector (the old <code>int 0x80</code>): it reads the handler address from the LSTAR register instead of the IDT in memory, pushes nothing, and skips the segment-descriptor checks. The entry code builds the trap frame, indexes the system-call table by the call number, and calls the handler.</p>
<p>Some calls skip the kernel entirely. The kernel maps a small shared library, the <strong>vDSO</strong>, into every process, along with a read-only data page that it keeps updated. <code>clock_gettime</code> reads the time from that page and the timestamp counter in user mode, in tens of nanoseconds instead of a kernel entry. The calls programs make most often are covered in <a href="#/file-syscalls">File System Calls</a>, <a href="#/process-syscalls">Process System Calls</a>, and <a href="#/mmap">Memory Mapping</a>.</p>

<h3 id="sec-performance-trade-offs">Performance Trade-Offs</h3>
<ul>
<li><strong>Direct cost:</strong> a null system call such as <code>getppid</code> takes on the order of 100 ns on a recent core. Mitigations for speculative-execution attacks (KPTI's page-table switch, predictor barriers) can multiply that.</li>
<li><strong>Indirect cost:</strong> each crossing flushes the pipeline, and the kernel's code and data displace user state in the L1 caches, branch predictors, and TLBs. Soares and Stumm (FlexSC, OSDI 2010) found that user-mode IPC stays depressed for thousands of cycles after a system call, so the indirect cost can exceed the direct one.</li>
<li><strong>Batching:</strong> <code>io_uring</code> passes requests and completions through rings shared with the kernel, so one system call, or none with kernel-side polling, covers many operations.</li>
<li><strong>Interrupts:</strong> interrupt coalescing and polling trade latency for throughput in I/O-heavy servers.</li>
<li><strong>For a simulator:</strong> syscall-emulation mode (gem5 SE) carries out each call in the simulator, so neither the kernel's instructions nor its pollution of caches and predictors appears. Workloads that cross often need full-system simulation.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A server makes 1 million system calls per second per core, each costing 500 ns of entry, dispatch, and exit overhead. What fraction of the core goes to overhead, and what would you do?</p>`,
        a: `<ol><li>Overhead per second = 10<sup>6</sup> × 500 ns = 0.5 s.</li><li>That's <strong>50%</strong> of the core.</li><li>Reduce the count: batch work per call (<code>io_uring</code>, <code>sendmmsg</code>), use vDSO for calls like <code>clock_gettime</code> that need no kernel entry, or bypass the kernel for I/O.</li></ol>`
      },
      {
        q: `<p>On RISC-V Linux, a user program executes <code>ecall</code> at address 0x10a4c with a7 = 63 (<code>read</code>) and interrupts enabled. Give <code>sepc</code>, <code>scause</code>, SPP, and SIE right after the trap, the PC the program resumes at, and what happens if the kernel forgets to adjust <code>sepc</code>.</p>`,
        a: `<ol><li><code>sepc</code> = <strong>0x10a4c</strong>, the address of the <code>ecall</code> itself.</li><li><code>scause</code> = <strong>8</strong>, environment call from user mode, with the interrupt bit clear.</li><li>SPP = <strong>0</strong> (the trap came from user mode). SPIE takes the old SIE value, 1, and SIE = <strong>0</strong>.</li><li>The PC jumps to <code>stvec</code>. The entry code builds the trap frame, the dispatcher calls the <code>read</code> handler (number 63), and the result goes into the saved a0.</li><li>Before <code>sret</code>, the kernel sets <code>sepc</code> = 0x10a4c + 4 = <strong>0x10a50</strong>, so the program resumes after the <code>ecall</code>.</li><li>Without that adjustment, <code>sret</code> returns to the <code>ecall</code>, which traps again with the same a7 (and the result in a0 as the new first argument), so the program never gets past it.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Walk through what an out-of-order core does when a load page-faults.</p>`,
        a: `<ol><li>The load misses the TLB, and the walker finds a non-present entry. The load is marked faulting in its ROB entry; nothing architectural happens yet.</li><li>If an older branch was mispredicted, the load is squashed and the fault disappears.</li><li>When the load reaches the ROB head, the core flushes it and everything younger, saves the faulting PC and address (CR2 on x86, FAR on ARM), switches to kernel mode, and jumps to the fault vector.</li><li>The handler maps the page and returns; the load re-executes from the saved PC.</li></ol>`
      },
      {
        q: `<p>Why did system calls get more expensive after Meltdown?</p>`,
        a: `<p>Meltdown let user code speculatively read kernel memory mapped in the same address space. The fix, kernel page-table isolation, gives the kernel a separate page table, so every system call and interrupt switches page tables (and without PCIDs, flushes the TLB). That adds hundreds of cycles to each entry and exit; newer cores fix the hardware flaw so the isolation can be dropped.</p>`
      },
      {
        q: `<p>In an x86-64 out-of-order core, a load page-faults and records the fault in its ROB entry. Twenty cycles later, an older integer divide in the same thread finds a zero divisor and records a divide error. No branch between them is mispredicted. Which exception does the kernel see first, and what happens to the other one?</p>`,
        a: `<p>The kernel sees the divide error first. Exceptions are taken only when the instruction reaches the ROB head, in program order, and the divide is older, so it reaches the head first no matter when each fault was detected. Taking it flushes everything younger, including the faulting load, and its recorded page fault is discarded with it. If the handler resumes the program (for example, a SIGFPE handler that skips the divide), the load is fetched and executed again, and only then does it raise its page fault again. If the divide error kills the process, the page fault is never taken at all.</p>`
      },
      {
        q: `<p>On x86-64, <code>syscall</code> doesn't switch stacks. Why can't the kernel just keep running on the user's stack for the call?</p>`,
        a: `<ul><li><strong>It may not be valid.</strong> User code can set RSP to anything. If it points at an unmapped page, the kernel's first push faults inside the kernel entry path, before any state is saved.</li><li><strong>It may point at kernel memory.</strong> The kernel's pushes would then overwrite its own data, a direct privilege escalation.</li><li><strong>Other threads can change it.</strong> Another user thread sharing the address space can rewrite that stack while the kernel uses it, corrupting saved state or return addresses.</li><li><strong>It would leak data.</strong> Kernel values left on a user-readable stack would be visible to user code afterward.</li></ul><p>So the entry code saves the user RSP and loads a per-thread kernel stack, reached through <code>swapgs</code> and per-CPU data, before it pushes anything. Interrupts and exceptions get the same protection in hardware from the TSS stack switch.</p>`
      }
    ]
  }
},

{
  id: "demand-paging",
  region: "os",
  title: "Demand Paging and Copy-on-Write",
  sections: [
    { id: "indirection", label: "The Page Table as a Layer of Indirection" },
    { id: "root-table", label: "Setting Up CR3 and the Root Table" },
    { id: "backing", label: "Demand Paging and Backing Objects" },
    { id: "first-touch", label: "Filling the Path on a First Touch" },
    { id: "cow", label: "Copy-on-Write After Fork" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>Once every access goes through a page table, the OS can point any virtual page at any physical frame, or at nothing yet. Two features fall out of that one layer of indirection: loading pages only when they are touched (demand paging), and letting processes share a page until one of them writes to it (copy-on-write). The same indirection lets the OS take a frame back later and fault the page in again when it is next touched, which is covered in <a href="#/page-replacement">Page Replacement</a>. Both work by having the CPU, the OS, and user code see different things about the same page, and both rely on the page fault being precise and restartable (see <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>). <a href="#/mmap">Memory Mapping</a> hands the same machinery to the program. Builds on <a href="#/virtual-memory">Virtual and Physical Memory</a>. Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (chapter 9) and Chris Kanich’s CS 361 lecture on memory mapping.</p>

<h3 id="sec-indirection">The Page Table as a Layer of Indirection</h3>
<p>Each process has its own page table, and each table maps virtual pages to physical frames however the OS likes:</p>
<ul>
<li><strong>Many to one:</strong> two virtual pages, in the same process or in different ones, can map to the same frame. That is how processes share code and memory.</li>
<li><strong>Not yet:</strong> an entry can be marked not present, so the first access faults and the OS decides what to put there.</li>
<li><strong>Lie about permissions:</strong> the entry can be stricter than what the program was promised, so the OS gets control on the first write.</li>
</ul>
<p>The table only works in one direction: given a virtual page, find the frame. Going from a frame back to every virtual page that maps it (needed to evict a shared page or to tell whether a page still has other users) takes a separate structure. Linux keeps a <strong>reverse map</strong> for this, and a per-frame count of how many page tables map it.</p>
<p>Three parties take part, and keeping them apart is the key to every example below:</p>
<ul>
<li><strong>The CPU</strong> reads the page table on every TLB miss and faults when an entry is not present or forbids the access.</li>
<li><strong>The OS</strong> writes the page table and handles the faults. It also keeps its own description of each region (on Linux, a VMA per region: its range, its real permissions, and what backs it), which can differ from the page table.</li>
<li><strong>User code</strong> sees neither. It loads and stores, and a fault that the OS fixes is invisible to it apart from the time it took.</li>
</ul>

<h3 id="sec-root-table">Setting Up CR3 and the Root Table</h3>
<p>CR3 holds the physical frame number of the running process's top-level table (the PML4 on x86-64). Only the kernel can write it: a move to CR3 is a privileged instruction, and user code that tries it takes a general-protection fault. The kernel sets it up at three moments:</p>
<ol>
<li><strong>Boot.</strong> A core can't enter 64-bit mode with paging off, so the first tables are built while every address is still physical. Early boot code writes a small set of tables into memory that map the kernel's own image, writes the physical address of the top table into CR3, and then turns paging on. (UEFI firmware already runs with paging on, using its own tables, and the kernel just loads CR3 with its own.) With paging on, the kernel builds its final tables, including the <strong>direct map</strong>: all of physical memory, mapped at one fixed virtual offset. From then on, the kernel reads and writes any frame, page tables included, at its physical address plus that offset. That is how the kernel edits tables that it can only name by physical address.</li>
<li><strong>Process creation.</strong> <code>fork</code> and <code>exec</code> each give the process a new address space, and its root table is allocated then, before the process runs: the kernel takes one free 4 KB frame from the page allocator and zeroes it. The upper half of the PML4, entries 256 to 511, maps the kernel, so the kernel copies those entries from its own reference table, and every process points at the same kernel PDPTs. The lower half, entries 0 to 255, is the user half. After <code>exec</code> it stays empty (all not present). After <code>fork</code> it holds the copy-on-write copy of the parent's entries. The kernel records the table in the process's memory descriptor (<code>mm-&gt;pgd</code> on Linux). With kernel page-table isolation (the Meltdown mitigation), each process gets two root tables instead: a full one for kernel mode, and one for user mode that maps almost none of the kernel. Kernel entry and exit then switch CR3 between the two.</li>
<li><strong>Context switch.</strong> When the scheduler switches to a thread of another process, it writes the new process's root frame number into CR3. The low 12 bits carry the process's PCID, and setting bit 63 tells the core to keep that PCID's TLB entries instead of flushing them. Without PCIDs, a CR3 write flushes every TLB entry that isn't marked global. Kernel mappings are global, so they survive either way. Threads of one process share its root table, so switching between them leaves CR3 alone.</li>
</ol>
<p>The walker keeps its own copy of CR3, which the write updates, and uses it on the next TLB miss (see <a href="#/tlb/tlb-miss">From a TLB Miss to the Translation</a>).</p>

<h3 id="sec-backing">Demand Paging and Backing Objects</h3>
<p>Every region of a process's address space is backed by an object, and its pages start out not present. The mapping already says where each page's bytes come from, but they aren't read until the first touch faults them in. Pages that are never touched cost no memory and no I/O. Regions are created by <code>exec</code> when a program starts and by <code>mmap</code> afterward. The backing object is one of two kinds:</p>
<ul>
<li><strong>A regular file:</strong> page <em>i</em> of the region holds bytes <em>i</em> × 4096 onward of the file (plus the mapping's starting offset). The fault reads the page into the page cache if it isn't already there, then maps that page-cache frame.</li>
<li><strong>An anonymous object:</strong> memory with no file behind it, which reads as all zeros at first. These are called <strong>demand-zero</strong> pages: the fault hands out a freshly zeroed frame. On Linux, a read fault on an untouched anonymous page maps one shared, read-only <strong>zero page</strong> instead, so a region that is only read never uses more than that one frame. The first write then gets a private zeroed frame.</li>
</ul>
<p>How an ELF executable's segments are backed:</p>
<div class="tbl"><table>
<tr><th>Region</th><th>Backed by</th><th>Shared or private</th><th>Why</th></tr>
<tr><td><code>.text</code>, <code>.rodata</code></td><td>The executable file</td><td>Shared, read-only</td><td>Never written, so a thousand processes running <code>bash</code> share one physical copy</td></tr>
<tr><td><code>.data</code></td><td>The executable file</td><td>Private (copy-on-write)</td><td>Starts as the file's initial values, but each process's writes to its globals must stay its own</td></tr>
<tr><td><code>.bss</code></td><td>Anonymous (demand-zero)</td><td>Private</td><td>Zero-initialized globals take no space in the file, only in the address space</td></tr>
<tr><td>Heap, stack</td><td>Anonymous (demand-zero)</td><td>Private</td><td>Fresh memory, zero until written</td></tr>
<tr><td>Shared libraries</td><td>The <code>.so</code> files</td><td>Code shared, data private</td><td>Same split as the executable, so every process's copy of <code>libc</code> code is one set of frames</td></tr>
</table></div>
<div class="tbl"><svg viewBox="0 0 680 290" role="img" aria-label="Backing objects for a process's address space. The address space has five regions from top to bottom: stack, heap, bss, data, and text. Stack, heap, and bss map to the anonymous object, drawn as the shared zero page, as private demand-zero memory. Data maps to the data bytes of the executable file as a private, copy-on-write file mapping. Text maps to the text bytes of the same file as a shared, read-only file mapping. Every mapping starts not present and is faulted in on first touch." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrMM" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrMMt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:11px">virtual address space (high addresses at top)</text>
<text x="430" y="18" style="fill:var(--muted);font-size:11px">backing objects</text>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<rect x="20" y="30" width="180" height="34" rx="3"/><rect x="20" y="78" width="180" height="34" rx="3"/><rect x="20" y="126" width="180" height="34" rx="3"/>
</g>
<rect x="20" y="174" width="180" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="20" y="222" width="180" height="34" rx="3" style="fill:var(--code-bg);stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="110" y="51">stack</text><text x="110" y="99">heap</text><text x="110" y="147">.bss</text><text x="110" y="195">.data (globals)</text><text x="110" y="243">.text (code)</text>
</g>
<rect x="430" y="62" width="230" height="52" rx="4" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="545" y="84" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">anonymous object</text>
<text x="545" y="100" text-anchor="middle" style="fill:var(--muted);font-size:11px">reads as zeros (shared zero page)</text>
<text x="545" y="156" text-anchor="middle" style="fill:var(--muted);font-size:11px">executable file (via the page cache)</text>
<rect x="430" y="164" width="230" height="100" rx="4" style="fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 3"/>
<rect x="445" y="174" width="200" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="445" y="222" width="200" height="34" rx="3" style="fill:var(--code-bg);stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle"><text x="545" y="195">.data bytes</text><text x="545" y="243">.text bytes</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrMM)">
<path d="M200,47 L428,80"/><path d="M200,95 L428,88"/><path d="M200,143 L428,96"/>
<path d="M200,239 L443,239"/>
</g>
<path d="M200,191 L443,191" style="stroke:var(--trace);stroke-width:1.5;fill:none" marker-end="url(#arrMMt)"/>
<g style="font-size:11px" text-anchor="middle">
<text x="330" y="150" style="fill:var(--muted)">private, demand-zero</text>
<text x="320" y="184" style="fill:var(--trace)">private file-backed (copy-on-write)</text>
<text x="320" y="232" style="fill:var(--muted)">shared file-backed, read-only</text>
</g>
<text x="20" y="282" style="fill:var(--muted);font-size:11px">Every arrow starts as a not-present page-table entry. The first touch of each page faults it in.</text>
</svg></div>
<p>Demand paging is lazy evaluation for memory: like not studying for an exam you won't take, the OS does no work for a page until an instruction actually needs it. A <strong>minor fault</strong> finds the bytes already in memory (a zero page, or a file page already in the page cache) and costs on the order of a microsecond. A <strong>major fault</strong> waits for storage: tens of microseconds on an NVMe SSD, milliseconds on a disk. Readahead hides much of this for sequential access by pulling in neighboring file pages before they are touched.</p>
<h3 id="sec-first-touch">Filling the Path on a First Touch</h3>
<p>The page table is filled in the same lazy way as the data. <code>mmap</code> and <code>exec</code> only record a region in a VMA, and the fault handler builds whatever tables are missing on the path to the faulting page. Say CR3 points at a root table whose entry 170 is not present, because nothing in that 512 GB range has been touched yet. The process stores to 0x0000555555559ABC, the address from <a href="#/virtual-memory/multilevel">Multilevel Page Tables</a> (PML4 index 170, PDPT index 341, PD index 170, PT index 345), inside an anonymous region it created with <code>mmap</code>:</p>
<ol>
<li><strong>The walk stops at the root.</strong> The store misses in the L1 DTLB and the L2 TLB, and the walker reads PML4 entry 170 at the address built from CR3. Its P bit is clear, so the walk ends after one read: the walker marks the store's ROB entry as faulting and fills no TLB entry. x86 never caches a not-present entry, in the TLBs or in the page-walk caches.</li>
<li><strong>The core takes the fault.</strong> When the store reaches the head of the ROB, the core takes a page fault (vector 14) as described in <a href="#/exceptions/hardware-sequence">The Hardware Sequence</a>. CR2 holds the faulting address, the error code says not present, write, user mode, and the saved PC points at the store itself.</li>
<li><strong>The handler checks the access.</strong> It looks up the VMA containing the address in CR2. The address is inside an anonymous region that allows writes, so the fault is legal. An address in no region, or a write to a read-only region, would end in <code>SIGSEGV</code> instead.</li>
<li><strong>It builds the missing path, top-down.</strong> At each level it reads the entry, and if the entry is not present, it takes a frame from the page allocator, zeroes it through the direct map, and writes the entry: the new table's frame number, P = 1, and permissive flags (writable, user, executable). Here all three lower levels are missing, so it allocates a PDPT and writes PML4[170], then a page directory for PDPT[341], then a page table for PD[170]. The real permissions go only in the leaf entry. The walker ANDs the flags of every level, and one upper entry covers many regions with different permissions, so upper entries must allow everything their range might need.</li>
<li><strong>It maps the data page.</strong> For an anonymous region, that is a freshly zeroed frame. For a file-backed region, the handler looks up the file page in the page cache, and if it isn't there, reads it from storage. That makes it a major fault, and the process sleeps while other processes run. The handler then writes PT[345]: the data frame's number, P = 1, writable, user, and no-execute for a data region.</li>
<li><strong>It returns.</strong> <code>iretq</code> restores the saved state, and the store executes again. It misses in the TLB again, but this time the walk finds all four entries present. The walker sets their accessed bits, and the dirty bit in the leaf, then fills the TLBs, and the store completes.</li>
</ol>
<p>This first touch took four frames: three tables and the data page, 16 KB in all. Two details make the handler's job safe and cheap:</p>
<ul>
<li><strong>No TLB invalidation.</strong> Every entry the handler wrote was not present before, and not-present entries are never cached, so no TLB or page-walk cache on any core holds a stale copy. Adding a mapping needs no shootdown. Removing or restricting one does (see <a href="#/page-replacement/eviction">Evicting Pages</a>).</li>
<li><strong>Write order.</strong> Other threads of the process may run on other cores, and their walkers can read the table at any moment. So the kernel zeroes each new table before writing the entry that points at it, with a write barrier in between, and a concurrent walker sees either a not-present entry or a complete table, never garbage. A page-table lock keeps two threads faulting in the same range from both allocating a table.</li>
</ul>
<p>Later first touches reuse the path. A page elsewhere in the same 2 MB needs only a data frame, and the first page in the next 2 MB also needs a new page table. File-backed faults go further: Linux's fault-around maps up to 16 neighboring pages that are already in the page cache in the same fault. Tables are freed when no mapping in their range remains: <code>munmap</code> frees the tables whose whole range it removed, and process exit frees them all. Evicting a page doesn't free its table. Its entry becomes a not-present entry that records where the page went.</p>
<h3 id="sec-cow">Copy-on-Write After Fork</h3>
<p><code>fork</code> must give the child an address space identical to the parent's, after which the two must not see each other's writes. Copying every frame would be slow and wasteful, especially since most children call <code>exec</code> immediately. Copying only the page table would be fast but wrong, since the processes would then share writable frames. Copy-on-write does both: share now, copy at the last possible moment, one page at a time.</p>
<ol>
<li><strong>At fork,</strong> the kernel copies the parent's page table into the child. Every private writable page is set to read-only in <em>both</em> tables, and each frame's map count goes up. The regions themselves (the VMAs) stay writable: the OS remembers the truth even though the page table says otherwise. Already read-only pages, such as code, simply stay shared forever.</li>
<li><strong>User code stores to a private page.</strong> It believes the page is writable, because it is.</li>
<li><strong>The CPU</strong> sees a read-only entry and raises a page fault. It knows nothing about copy-on-write.</li>
<li><strong>The OS</strong> sees a write fault on a page that the region says is writable, so the fault is legal. If other page tables still map the frame, it allocates a new frame, copies the 4 KiB, points the writer's entry at the copy with write permission, and invalidates the stale TLB entry. If the writer is now the only one mapping the frame, it just makes the entry writable, with no copy.</li>
<li><strong>The store re-executes</strong> and succeeds. The program never knew.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 252" role="img" aria-label="Copy-on-write in three steps. Step 1, after fork: the parent and child page-table entries are both read-only and both point at frame A, which holds x equals 1 and has 2 mappings. Step 2, the child writes x equals 2: its entry is read-only, so the store faults, and the kernel sees the region is writable and the frame has 2 mappings, so it copies. Step 3, after the fault: the parent entry, still read-only, points at frame A with x equals 1 and 1 mapping, and the child entry, now read-write, points at a new frame B with x equals 2 and 1 mapping. The parent stays read-only until it writes, and then the kernel just makes the entry writable without copying." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrCW" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrCWt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle">
<text x="117" y="18">Step 1: After Fork</text><text x="340" y="18">Step 2: Child Writes x = 2</text><text x="563" y="18">Step 3: After the Fault</text>
</g>
<g style="fill:none;stroke:var(--rule);stroke-width:1.5">
<rect x="10" y="28" width="214" height="214" rx="4"/><rect x="233" y="28" width="214" height="214" rx="4"/><rect x="456" y="28" width="214" height="214" rx="4"/>
</g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<rect x="20" y="44" width="92" height="40" rx="3"/><rect x="122" y="44" width="92" height="40" rx="3"/>
<rect x="243" y="44" width="92" height="40" rx="3"/>
<rect x="466" y="44" width="92" height="40" rx="3"/>
<rect x="67" y="150" width="100" height="44" rx="3"/><rect x="290" y="150" width="100" height="44" rx="3"/><rect x="462" y="150" width="98" height="44" rx="3"/>
</g>
<rect x="345" y="44" width="92" height="40" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<rect x="568" y="44" width="92" height="40" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="566" y="150" width="98" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle">
<text x="66" y="60">parent PTE</text><text x="168" y="60">child PTE</text>
<text x="289" y="60">parent PTE</text><text x="391" y="60">child PTE</text>
<text x="512" y="60">parent PTE</text><text x="614" y="60">child PTE</text>
<text x="117" y="168">frame A</text><text x="340" y="168">frame A</text><text x="511" y="168">frame A</text><text x="615" y="168">frame B (copy)</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="66" y="76">read-only</text><text x="168" y="76">read-only</text>
<text x="289" y="76">read-only</text><text x="391" y="76" style="fill:var(--pad)">read-only: fault</text>
<text x="512" y="76">read-only</text><text x="614" y="76" style="fill:var(--trace)">read-write</text>
<text x="117" y="184">x = 1, 2 maps</text><text x="340" y="184">x = 1, 2 maps</text><text x="511" y="184">x = 1, 1 map</text><text x="615" y="184">x = 2, 1 map</text>
<text x="117" y="216">both entries read-only,</text><text x="117" y="231">one physical copy</text>
<text x="340" y="216">region is writable and frame</text><text x="340" y="231">has 2 maps, so the kernel copies</text>
<text x="563" y="216">parent stays read-only until it</text><text x="563" y="231">writes, then no copy is needed</text>
</g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrCW)">
<path d="M66,84 L104,148"/><path d="M168,84 L130,148"/>
<path d="M289,84 L327,148"/><path d="M391,84 L353,148"/>
<path d="M512,84 L511,148"/>
</g>
<path d="M614,84 L615,148" style="stroke:var(--trace);stroke-width:1.5;fill:none" marker-end="url(#arrCWt)"/>
<text x="400" y="120" style="fill:var(--pad);font-size:11px">store</text>
</svg></div>
<p>The net effect: after a fork, physical memory grows by one page per page actually written, not by the size of the process. Pages that are never written, such as globals touched only on an error path, are never copied. The same trick serves file-backed <a href="#/mmap/flags"><code>MAP_PRIVATE</code></a> mappings like <code>.data</code>, and anonymous memory, whose untouched pages are copy-on-write views of the zero page.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Faults are not free.</strong> A minor fault costs roughly 0.5 to 1 µs of kernel time, plus zeroing or copying the page. Touching a fresh 4 KiB page per microsecond of work halves throughput. Ways to batch this work are in <a href="#/mmap/perf">Memory Mapping</a>.</li>
<li><strong>Copy-on-write costs the parent too.</strong> Fork write-protects the parent's pages and flushes its TLB entries (with shootdowns on every core running its threads). Afterward, the parent takes a write fault on the first store to each page, even when the child has already exited.</li>
<li><strong>Huge pages make copy-on-write coarse.</strong> With 2 MiB pages, a single byte written copies 2 MiB. Redis tells users to disable transparent huge pages for this reason: its snapshot forks the server, and scattered writes during the snapshot can copy almost the whole heap.</li>
<li><strong>For a simulator:</strong> user-level traces and most syscall-emulation simulators miss fault handling entirely, so first-touch and copy-on-write costs disappear from the model. A workload that forks, or allocates and touches memory in its measured region, needs full-system simulation or a correction for the kernel time.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A Redis server holds 24 GiB of anonymous heap in 4 KiB pages, with 8-byte page-table entries. To snapshot, it forks a child that writes the data to disk. During the snapshot, clients modify 12.5% of the heap's 4 KiB pages, spread uniformly at random, and each copy-on-write fault costs 1.5 µs of kernel time including the copy.</p><ol><li>How much leaf page-table memory does fork copy?</li><li>How much extra physical memory does the snapshot need, and how much kernel time do the copy-on-write faults cost?</li><li>Redo the extra memory with 2 MiB transparent huge pages.</li></ol>`,
        a: `<ol><li>Pages = 24 GiB / 4 KiB = 6,291,456. Leaf entries = 6,291,456 × 8 B = <strong>48 MiB</strong> copied while the parent is paused.</li><li>Written pages = 12.5% × 6,291,456 = 786,432. Each gets one copy, so extra memory = 786,432 × 4 KiB = <strong>3 GiB</strong>. Kernel time = 786,432 × 1.5 µs ≈ <strong>1.18 s</strong>, spread over the snapshot and charged to the parent's request latency.</li><li>Huge pages = 24 GiB / 2 MiB = 12,288, each covering 512 small pages. A huge page is copied if any of its 512 small pages is written. The chance that none is written is 0.875<sup>512</sup> = e<sup>512 × ln 0.875</sup> ≈ e<sup>−68</sup>, effectively 0. So nearly every huge page is copied: extra memory ≈ <strong>24 GiB</strong>, 8× more, and each fault now copies 2 MiB. That is why Redis asks for transparent huge pages to be disabled.</li></ol>`
      },
      {
        q: `<p>A process on x86-64 Linux uses 4-level paging with 4 KiB pages, and transparent huge pages are off. It creates a 256 MiB anonymous region with <code>mmap</code>, which the kernel places at 0x200000000000. Nothing else is mapped in the 512 GiB range of that address's PML4 entry. The process then stores one byte to each page of the region, in address order.</p><ol><li>How many page faults does it take, how many of them allocate page tables, and how much memory do the tables use?</li><li>How many TLB shootdowns does filling the region need?</li><li>Later, reclaim evicts every page of the region to swap. How much table memory does that free?</li></ol>`,
        a: `<ol><li>Pages = 256 MiB / 4 KiB = 65,536, and every first touch faults (anonymous memory gets no fault-around): <strong>65,536 faults</strong>. The PML4 index is 0x200000000000 &gt;&gt; 39 = 64, and that entry is not present, so fault 0 allocates a PDPT, a page directory, and a page table. The region starts on a 1 GiB boundary and is smaller than 1 GiB, so one directory covers it, and it needs 256 MiB / 2 MiB = 128 page tables. Faults 512, 1,024, &hellip;, 65,024 each allocate one more: 127 faults. Total: <strong>128 faults allocate tables</strong>, and 3 + 127 = 130 tables × 4 KiB = <strong>520 KiB</strong>, about 0.2% of the region.</li><li><strong>None.</strong> Every entry the handler writes was not present before, and not-present entries are never cached, so no core can hold a stale translation.</li><li><strong>Nothing.</strong> Each leaf entry becomes a swap entry that records where its page went, so all 130 tables stay. They are the only record of the swap locations. Linux never pages tables out, and Windows could page out the 128 page tables only after their pages had all left memory.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>After fork, the parent writes to a private page, and then the child writes to the same page. How many page copies happen, and why?</p>`,
        a: `<p>One. The parent's write faults on its read-only entry. The frame still has 2 mappings, so the kernel copies it and gives the parent a private writable page, leaving the original frame with 1 mapping (the child). The child's write also faults, since its entry is still read-only, but now the kernel finds that the child is the only process mapping the frame, so it just sets the entry writable without copying. The last writer reuses the original frame.</p>`
      },
      {
        q: `<p>A 100 GiB, 32-thread service with 4 KiB pages launches a helper process with <code>fork</code> then <code>exec</code>, and its tail latency spikes. Explain why, and what <code>posix_spawn</code> changes.</p>`,
        a: `<ul><li><strong>Page-table copy:</strong> 100 GiB / 4 KiB = 26,214,400 entries × 8 B = 200 MiB of leaf entries copied while the forking thread holds the address-space lock, stalling other threads that fault or <code>mmap</code>.</li><li><strong>Write-protection:</strong> every writable page in the parent becomes read-only, which needs TLB shootdowns to every core running the other 31 threads.</li><li><strong>Fault storm:</strong> afterward, the first store to each page faults. Pages the child still maps get copied, and even after the child execs, each page needs one fault to become writable again.</li><li><strong><code>posix_spawn</code>:</strong> uses <code>clone(CLONE_VM | CLONE_VFORK)</code>, so the child runs on the parent's page table until <code>exec</code>. No copy, no write-protection, no shootdowns, and no later faults.</li></ul>`
      },
      {
        q: `<p>A program allocates 8 GiB with anonymous <code>mmap</code> and then only reads it. How much physical memory does it use, and what happens on the first write to a page?</p>`,
        a: `<p>Almost none. Each read fault on an untouched anonymous page maps the kernel's single shared zero page read-only, so all 2,097,152 pages (8 GiB / 4 KiB) point at one frame, at the cost of a page-table entry each. The first write to a page faults again, because the entry is read-only. The kernel allocates a zeroed frame (no copy is needed, since the source is known to be zeros), maps it writable, and invalidates the stale TLB entry. The cost is a second fault per page that was read before being written, which is why benchmarks that read a buffer before filling it see double the faults.</p>`
      }
    ]
  }
},

{
  id: "page-replacement",
  region: "os",
  title: "Page Replacement",
  sections: [
    { id: "eviction", label: "Evicting Pages" },
    { id: "table-eviction", label: "Paging Out Page Tables" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p><a href="#/demand-paging">Demand Paging and Copy-on-Write</a> showed how a page gets a frame: lazily, on the first touch, with the fault handler building any missing tables on the way. This page covers the reverse: how the OS takes frames back when memory runs short, which pages it picks, what happens to their page-table entries, and what it costs when the pages are needed again. Main sources: Hennessy &amp; Patterson, Appendix B, Mel Gorman's <em>Understanding the Linux Virtual Memory Manager</em>, and Russinovich, Solomon, Ionescu, and Yosifovich's <em>Windows Internals</em> (chapter 5).</p>

<h3 id="sec-eviction">Evicting Pages</h3>
<p>When memory runs short, the OS takes frames back from pages that are mapped but cold. The decision belongs entirely to the OS. The hardware only reports usage: the walker sets a leaf entry's accessed bit when it walks the entry, and its dirty bit on the first store. It never picks a victim. That is the opposite of a cache, where hardware replacement (LRU, pseudo-LRU, RRIP) chooses on every miss. A page miss costs microseconds to milliseconds, so the OS can afford a policy that runs thousands of instructions, and it knows things the hardware can't: whether a page is clean file data that can be read again, anonymous memory that needs swap space, locked in memory with <code>mlock</code>, or charged to a cgroup over its limit.</p>
<p><strong>When reclaim runs.</strong> Linux keeps three watermarks of free memory per zone: min, low, and high.</p>
<ul>
<li><strong>Free memory falls below low:</strong> the allocator wakes <code>kswapd</code>, one kernel thread per NUMA node, which reclaims in the background until free memory is back above high. Applications don't wait for it.</li>
<li><strong>An allocation would take free memory below min:</strong> the allocating thread reclaims pages itself (<strong>direct reclaim</strong>) and waits until it has enough. This is where reclaim shows up as tail latency.</li>
<li><strong>Reclaim frees nothing:</strong> the OOM killer kills a process, chosen mostly by how much memory it uses.</li>
</ul>
<p><strong>Choosing the victim.</strong> Exact LRU would need a timestamp on every access, and only the hardware sees accesses. The OS approximates LRU with the accessed bit, as the clock (second-chance) algorithm does (Hennessy &amp; Patterson, Appendix B): it sweeps over the frames, and a page whose accessed bit is set gets the bit cleared and is passed over, while a page whose bit is still clear hasn't been used since the last sweep and is evicted. Linux keeps frames on LRU lists, separate for anonymous and file pages, each split into an active and an inactive list. Reclaim scans the tail of an inactive list. It checks a page's accessed bit in every page table that maps the page, through the reverse map: a page with a set bit moves to the active list, and a page with none is evicted. Pages age from the active list into the inactive one to keep the two balanced, and <code>vm.swappiness</code> sets how hard reclaim leans on anonymous pages versus file pages. Since Linux 6.1, the multi-generational LRU (MGLRU) can replace the two lists with several generations, which it ages by walking page tables instead of the reverse map.</p>
<p>The accessed bit has a hardware catch. The walker sets it only during a walk, so while a page's translation stays in a TLB, accesses don't touch the bit. Linux on x86 clears accessed bits without flushing the TLB, to avoid a shootdown per page, so a page that stays hot in some core's TLB can look unused until that entry is evicted. TLB entries usually turn over much faster than reclaim scans, so this costs little accuracy.</p>
<p><strong>Evicting the victim.</strong></p>
<ol>
<li><strong>Find every mapping.</strong> Through the reverse map, the kernel finds each page-table entry that maps the frame: one for a private page, possibly thousands for a page of <code>libc</code>.</li>
<li><strong>Clear the entries.</strong> Each entry becomes not present. For an anonymous page, the kernel first assigns a swap slot and writes a <strong>swap entry</strong> in place of the old one: P = 0, with the swap device and offset in the other bits. The hardware ignores every other bit of an entry whose P bit is clear, so the OS is free to store anything there. For a file page, the entry is simply cleared, since the VMA already says which file offset backs it.</li>
<li><strong>Shoot down the TLBs.</strong> Any core may still cache the old translation, and a core holding a stale entry could keep reading or writing the frame after it has been reused. The kernel invalidates the entry locally with <code>invlpg</code>, sends an inter-processor interrupt to every other core that may be running the process, and waits for all of them to confirm. Reclaim batches many pages per shootdown to spread its cost.</li>
<li><strong>Write back if needed.</strong> If the page is dirty, its contents go to the swap slot or back to the file. A clean file page, such as program code, is just dropped, because the file still holds its bytes. A clean anonymous page that already has a copy in swap skips the write too.</li>
<li><strong>Free the frame.</strong> The frame goes back to the page allocator only once the shootdown and any write have completed.</li>
</ol>
<p>The next access to the page walks to the not-present entry and faults. For a swap entry, the handler reads the page back from swap, which is a major fault, unless the page is still in the <strong>swap cache</strong> (written out but not yet freed), which makes it a minor one. Windows does the same work in a different shape: it trims each process's working set separately, and trimmed pages wait on a standby list (or on a modified list until they are written), where a touch brings them back with a soft fault. When the pages that running processes keep using add up to more than physical memory, every eviction removes a page that is needed again soon, and the system spends its time in major faults instead of doing work. That is <strong>thrashing</strong>.</p>

<h3 id="sec-table-eviction">Paging Out Page Tables</h3>
<p>Page tables live in ordinary frames, so an OS can evict them too. Linux never does. A process's tables are a fraction of a percent of the memory they map, the kernel walks them constantly for faults and reclaim, and an empty table is simply freed. Windows does page out the page tables of user processes, with one condition: a page table can leave memory only once none of its entries points at a page still in memory (its frame-database entry counts them). The hardware isn't told any of this. It reaches a not-present entry and faults, exactly as it does for a data page.</p>
<p>Evicting the page table that covers one 2 MB range takes these steps:</p>
<ol>
<li><strong>Wait until the table maps nothing.</strong> Every data page under it has been evicted, so all 512 entries are not present, and most hold the disk location of their page. (If all 512 are empty, the table can be freed without being written.)</li>
<li><strong>Write the table out.</strong> The table's 4 KB go to the pagefile like any data page. Its entries have to be saved, because they are the only record of where the data pages went.</li>
<li><strong>Clear the parent entry.</strong> The page-directory entry that pointed at the table becomes not present, with the table's pagefile location in its other bits.</li>
<li><strong>Flush the paging-structure caches.</strong> No TLB holds a translation through the table, since all its entries were already not present. But a page-walk cache may still hold the old page-directory entry and send a walk straight to the old frame. On x86, <code>invlpg</code> for any address also flushes the paging-structure caches for the current PCID, and a shootdown does the same on the other cores.</li>
<li><strong>Free the frame.</strong></li>
</ol>
<p>A later access to that 2 MB range plays out in this order:</p>
<ol>
<li><strong>The walk stops one level early.</strong> The walker reads the PML4 and PDPT entries, which are present, and then the page-directory entry, whose P bit is clear. It stops there and marks the access as faulting, so it never fetches a line from the missing table. That is why the walk itself never needs anything that isn't in DRAM (see <a href="#/tlb/walk">What a Page Walk Does</a>).</li>
<li><strong>The handler restores the table.</strong> It finds a pagefile location in the page-directory entry, allocates a frame, reads the table back, and writes the page-directory entry with P = 1.</li>
<li><strong>It restores the data page.</strong> The table's entry for the faulting page is itself not present, because the data page left first. The handler can read the data page in the same fault, or return and let the access fault a second time on the leaf entry. Either way, the access waits for two reads from storage, one after the other.</li>
</ol>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Major faults dominate quickly.</strong> With DRAM accesses near 100 ns and a swap-in from an NVMe SSD near 100 µs, one access in a thousand that faults roughly doubles the average access time. A workload whose hot pages don't fit in memory slows down by orders of magnitude, not percent.</li>
<li><strong>Direct reclaim lands on the request path.</strong> <code>kswapd</code> reclaims in the background, but a burst of allocations can outrun it and push threads into direct reclaim, which shows up as latency spikes. Raising the watermarks (<code>vm.watermark_scale_factor</code> or <code>vm.min_free_kbytes</code>) wakes <code>kswapd</code> earlier, trading some unused memory for steadier latency.</li>
<li><strong>Shootdowns cost every core that runs the process.</strong> Each eviction batch sends inter-processor interrupts, which cost the sender microseconds of waiting and interrupt the receivers. Evicting a page shared by many processes, such as a library page, reaches the most cores.</li>
<li><strong>Compressed swap trades CPU for I/O.</strong> zram (Linux) and memory compression (Windows, macOS) keep evicted pages compressed in RAM, so a swap-in costs a few microseconds of decompression instead of a storage read.</li>
<li><strong>For a simulator:</strong> user-level and syscall-emulation simulators give the workload all the memory it asks for, so eviction never happens. If the real system runs under memory pressure, use full-system simulation or add the major faults as a rate times a latency.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix B · Mel Gorman, <em>Understanding the Linux Virtual Memory Manager</em> · Russinovich, Solomon, Ionescu, and Yosifovich, <em>Windows Internals</em>, 7th edition, Part 1, chapter 5 · Intel, <em>Intel 64 and IA-32 Architectures Software Developer's Manual</em>, Volume 3, Chapter 4 (paging)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A key-value store's memory accesses take 90 ns on average when the page they touch is in memory. Its server swaps to an NVMe SSD, where a major fault costs 80 µs in all, including the kernel's work. Assume every fault is a major fault and nothing else changes.</p><ol><li>What fraction of accesses can fault before the average access time doubles?</li><li>What fraction can fault before it rises by only 10%?</li></ol>`,
        a: `<ol><li>Average access time = 90 ns + <em>p</em> × 80,000 ns. It doubles when <em>p</em> × 80,000 = 90, so <em>p</em> = 90 / 80,000 = <strong>1.125 × 10<sup>−3</sup></strong>, about 1 access in 889.</li><li>A 10% rise means <em>p</em> × 80,000 = 9, so <em>p</em> = <strong>1.125 × 10<sup>−4</sup></strong>, about 1 access in 8,889.</li><li>A fault is about 890 times as expensive as a normal access, so even a tiny fault rate dominates. That is why a workload whose hot pages don't fit in memory thrashes instead of slowing down gradually.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A Linux x86-64 server pins a latency-critical thread to one Golden Cove core. The thread reads a 4 KiB page of a lookup table every 2 µs and touches only 40 pages in all, so their translations stay in the core's 2,048-entry L2 TLB. Under memory pressure, reclaim swaps that hot page out anyway, and the thread's next read takes a 90 µs major fault. How did reclaim conclude that the page was cold, and what are two fixes?</p>`,
        a: `<ol><li>Reclaim judges a page by its accessed bit, and the walker sets that bit only during a walk. Linux on x86 clears accessed bits without flushing the TLB.</li><li>The thread is pinned, its 40 translations fit easily in the TLB, and with PCIDs even a context switch doesn't flush them. So after reclaim cleared the bit, the thread's reads all hit in the TLB, no walk ran, and the bit stayed clear.</li><li>When reclaim scanned the page again, the bit was still clear, so the page looked unused and was evicted. Eviction cleared the entry and shot down the TLB, so the next read walked, found a swap entry, and faulted.</li><li><strong>Fix 1:</strong> lock the table in memory with <code>mlock</code>, which moves its pages to the unevictable list.</li><li><strong>Fix 2:</strong> put the service in a memory cgroup with <code>memory.min</code> covering its working set, or <code>memory.swap.max</code> = 0, so reclaim takes memory from other cgroups first.</li></ol>`
      }
    ]
  }
},

{
  id: "mmap",
  region: "os",
  title: "Memory Mapping",
  sections: [
    { id: "mmap", label: "Mapping a File with mmap" },
    { id: "flags", label: "Shared and Private Mappings" },
    { id: "change", label: "Changing and Removing Mappings" },
    { id: "malloc", label: "Where malloc Gets Its Memory" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p><a href="#/demand-paging">Demand Paging and Copy-on-Write</a> showed that every region of an address space is a lazily faulted view of some backing object. <code>mmap</code> lets a program create such regions itself: map a file and read it with plain loads, share memory with another process, or get fresh zeroed memory. A small family of calls then changes or removes them. Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (sections 9.8 and 9.9), Chris Kanich’s CS 361 lecture on memory mapping, and the Linux man pages for <code>mmap</code>, <code>madvise</code>, and <code>mallopt</code>.</p>

<h3 id="sec-mmap">Mapping a File with mmap</h3>
<p><code>mmap(addr, length, prot, flags, fd, offset)</code> asks the kernel to create a region whose pages are backed by <code>fd</code> starting at <code>offset</code>. Passing <code>NULL</code> for <code>addr</code> lets the kernel pick the address. After that one call, byte <em>k</em> of the file is just address <em>base</em> + <em>k</em>, and reading or writing it is an ordinary load or store.</p>
<pre><code>/* read(): one system call and one copy per buffer */
char buf[65536];
while ((n = read(fd, buf, sizeof buf)) &gt; 0)
    sum += checksum(buf, n);

/* mmap(): one system call, then plain loads */
struct stat st;
fstat(fd, &amp;st);
const char *p = mmap(NULL, st.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
close(fd);                       /* the mapping keeps the file open */
sum = checksum(p, st.st_size);   /* first touch of each page faults it in */
munmap((void *)p, st.st_size);</code></pre>
<p>What changes compared with <code>read</code>, <code>write</code>, and <code>lseek</code>:</p>
<ul>
<li><strong>No system call per access.</strong> Each <code>read</code> crosses into the kernel and back. With many small reads, such as random lookups into an index, those crossings dominate. With <code>mmap</code>, a page that is already mapped costs only a load.</li>
<li><strong>No extra copy.</strong> <code>read</code> copies from the page cache into the user buffer. A mapping points the page table at the page-cache frame itself.</li>
<li><strong>The program tracks its own position.</strong> There is no file offset. Random access is just pointer arithmetic.</li>
<li><strong>The cost moves to page faults.</strong> Each first touch of a page is a fault, and errors arrive as signals (<code>SIGBUS</code> if the file shrinks under the mapping) rather than return codes.</li>
</ul>
<p>The executable loader uses exactly this mechanism to map ELF segments (see <a href="#/comp-load">Loading and Running</a>), and <code>malloc</code> uses anonymous <code>mmap</code> for large blocks.</p>

<h3 id="sec-flags">Shared and Private Mappings</h3>
<p>The <code>flags</code> argument decides who sees writes:</p>
<div class="tbl"><table>
<tr><th></th><th><code>MAP_SHARED</code></th><th><code>MAP_PRIVATE</code></th></tr>
<tr><td>File-backed</td><td>Writes go to the page-cache page, are seen by every process mapping the file, and reach the file on writeback or <code>msync</code></td><td>Copy-on-write: reads see the file, the first write to a page makes a private copy, and writes never reach the file</td></tr>
<tr><td>Anonymous (<code>MAP_ANONYMOUS</code>)</td><td>Zeroed memory that stays shared with children after <code>fork</code></td><td>Ordinary private memory (large <code>malloc</code> blocks, thread stacks)</td></tr>
</table></div>
<p>A <code>MAP_SHARED</code> region set up before <code>fork</code> stays one set of frames in both processes. If the parent stores 50 to a variable there, the child's next load of it sees 50. It is the cheapest form of interprocess communication, but it is a raw bulletin board: nothing notifies the other process that something changed, so real use needs atomics, futexes, or another signal on top (see <a href="#/c11-ordering">C11 Memory Ordering</a>).</p>

<h3 id="sec-change">Changing and Removing Mappings</h3>
<p>Each call below edits both the OS's list of regions and the page table. The page-table edits cost the most, because a stale translation may sit in any core's TLB.</p>
<ul>
<li><strong><code>munmap(addr, len)</code></strong> removes the range. Private pages are freed, and dirty pages of a shared file mapping stay in the page cache for writeback. Every core that may hold a translation for the range must drop it, so the kernel sends an inter-processor interrupt to each core running a thread of the process and waits until all of them have flushed. This is a <strong>TLB shootdown</strong>.</li>
<li><strong><code>mprotect(addr, len, prot)</code></strong> changes permissions, for example to make a JIT's freshly written code executable and no longer writable. Removing a permission needs a shootdown before the call returns, or another core could keep writing through a stale writable entry.</li>
<li><strong><code>madvise(addr, len, advice)</code></strong> gives hints. <code>MADV_WILLNEED</code> starts readahead, and <code>MADV_SEQUENTIAL</code> and <code>MADV_RANDOM</code> tune it. <code>MADV_DONTNEED</code> drops the pages but keeps the region, so the next touch of a private anonymous page faults in a fresh zeroed one. Allocators use it, or the lazier <code>MADV_FREE</code>, to give memory back without unmapping.</li>
<li><strong><code>msync(addr, len, MS_SYNC)</code></strong> writes a shared file mapping's dirty pages to storage and waits. It is the mapping counterpart of <code>fsync</code> (see <a href="#/file-syscalls/durability">Metadata and Durability</a>).</li>
</ul>

<h3 id="sec-malloc">Where malloc Gets Its Memory</h3>
<p><code>malloc</code> is a library function, not a system call. It carves blocks out of memory it gets from the kernel in large pieces, through one of two calls:</p>
<ul>
<li><strong><code>brk</code></strong> moves the end of the heap, a single anonymous region that starts a random offset past <code>.bss</code>. glibc serves small blocks from it and reuses freed ones without asking the kernel again. It can only shrink the heap from the top.</li>
<li><strong>Anonymous <code>mmap</code></strong> gives each large block a region of its own. In glibc, that means requests of at least <code>M_MMAP_THRESHOLD</code>, 128 KiB by default. <code>free</code> on such a block calls <code>munmap</code>, so the memory goes straight back to the kernel.</li>
</ul>
<p>glibc raises the threshold by itself when a program frees an mmap-backed block (up to 32 MiB on 64-bit systems), so a program that keeps allocating and freeing one large size soon gets it from the heap instead. Setting the threshold with <code>mallopt</code> turns that adjustment off. Allocators such as jemalloc, tcmalloc, and mimalloc map memory in large chunks and hand it back with <code>madvise</code>, in batches, which avoids most of these calls.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>mmap is not always faster than read.</strong> For large sequential scans, <code>read</code> with a big buffer pays few system calls, and its copy is cheap compared with per-page faults, TLB misses, and TLB shootdowns when mappings change.</li>
<li><strong>Batch the faults.</strong> <code>MAP_POPULATE</code> faults in the whole range during the <code>mmap</code> call, <code>madvise(MADV_WILLNEED)</code> reads ahead, and the kernel's fault-around maps up to 16 already-cached file pages per fault. Each turns many small faults into one larger piece of work.</li>
<li><strong>Unmapping is expensive in threaded programs.</strong> A shootdown interrupts every core running the process, and each costs on the order of microseconds. Allocators that cache freed memory instead of unmapping it, and kernels that batch invalidations, exist largely to avoid this.</li>
<li><strong>Database systems mostly avoid mmap for their buffer pool.</strong> Crotty, Leis, and Pavlo (CIDR 2022) list the reasons: the kernel decides when pages are evicted and written back, I/O errors arrive as signals, page-table contention and shootdowns limit scaling, and the kernel may write a dirty page back at any moment, even before the transaction that changed it commits.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A program checksums a 2 GiB file that is already in the page cache. Compare two versions:</p><ul><li><code>read</code> into a 64 KiB buffer: each call costs 1 µs of overhead, and the copy runs at 10 GB/s.</li><li><code>mmap</code> with 4 KiB pages and no copy: a minor fault that maps one page costs 0.8 µs, and a fault with fault-around that maps 16 pages at once costs 2 µs.</li></ul><p>Ignore the checksum work itself, which is the same in both. Which is faster, with and without fault-around?</p>`,
        a: `<ol><li>File size = 2 GiB = 2,147,483,648 B.</li><li><code>read</code>: calls = 2 GiB / 64 KiB = 32,768, costing 32,768 × 1 µs = 32.8 ms. Copy = 2,147,483,648 B / 10<sup>10</sup> B/s = 214.7 ms. Total ≈ <strong>247.5 ms</strong>.</li><li><code>mmap</code> without fault-around: faults = 2 GiB / 4 KiB = 524,288, costing 524,288 × 0.8 µs ≈ <strong>419.4 ms</strong>. Slower than <code>read</code>, even with no copy.</li><li><code>mmap</code> with fault-around: faults = 524,288 / 16 = 32,768, costing 32,768 × 2 µs ≈ <strong>65.5 ms</strong>, about 3.8× faster than <code>read</code>.</li><li>Lesson: <code>mmap</code> wins only when per-page fault work is batched or amortized. Its advantage is the missing copy, and a fault per 4 KiB page can cost more than that copy.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Process A maps a file with <code>MAP_SHARED</code> and process B maps the same file with <code>MAP_PRIVATE</code>. A writes a byte. Does B see it? Does the answer change over time?</p>`,
        a: `<p>It depends on whether B has written to that page yet. Until B writes, its entry points at (or will fault in) the same page-cache frame that A writes to, so on Linux B sees A's update. POSIX leaves this unspecified. Once B writes anywhere in that page, the copy-on-write fault gives B a private copy, and from then on B sees neither A's later writes to that page nor any change to the file. Other pages that B hasn't written still track the file. So B's view is a page-by-page mix of live file contents and its own snapshot.</p>`
      },
      {
        q: `<p>A single-threaded program on x86-64 Linux with glibc calls <code>mallopt(M_MMAP_THRESHOLD, 128 * 1024)</code>. Then, 10,000 times, it calls <code>malloc(1 &lt;&lt; 20)</code>, writes every byte of the 1 MiB block, and frees it. Pages are 4 KiB, transparent huge pages are off, and glibc puts a 16-byte header in front of each mmap-backed block. What kernel work does each iteration cause, how many page faults happen in total, and what would you change?</p>`,
        a: `<ol><li>1 MiB is above the 128 KiB threshold, and setting the threshold turned off glibc's automatic adjustment, so every <code>malloc</code> calls <code>mmap</code> for a new region.</li><li>The region holds the 16-byte header plus 1,048,576 bytes, rounded up to whole pages: 1,048,592 B needs 257 pages. Writing the block touches bytes 16 through 1,048,591 of the region, which span all 257 pages, so each iteration takes <strong>257</strong> demand-zero faults, and the kernel zeroes 257 frames that the program then overwrites.</li><li><code>free</code> calls <code>munmap</code>, which frees the frames and invalidates their TLB entries (no shootdown, since only one core runs the process).</li><li>Total faults = 10,000 × 257 = <strong>2,570,000</strong>, plus 20,000 system calls.</li><li>Fixes: reuse one buffer across iterations, leave the threshold alone (glibc would raise it to the block size after the first <code>free</code> and serve later blocks from the heap), or use an allocator that keeps freed memory mapped.</li></ol>`
      },
      {
        q: `<p>A service runs 64 threads, each pinned to its own core and running continuously. One thread calls <code>munmap</code> on a 2 MiB buffer. Why is this much slower than the same call in a single-threaded process, and how do allocators avoid paying it often?</p>`,
        a: `<p>In the single-threaded process, the kernel removes the entries and invalidates its own core's TLB, and nothing else is involved. With 64 running threads, any of the other 63 cores may have cached translations for the buffer, so the kernel must perform a TLB shootdown: it sends an inter-processor interrupt to each of those cores and waits until every one has taken the interrupt, flushed the entries, and acknowledged. Each target core pays an interrupt (a pipeline flush and a trip through the kernel), and the calling thread waits for the slowest of 63 cores, so the call takes microseconds instead of a fraction of one, and every other thread is disturbed too. Allocators avoid this by keeping freed memory mapped and reusing it, and by returning memory to the kernel rarely and in large batches, so one shootdown covers many pages.</p>`
      }
    ]
  }
},

{
  id: "file-syscalls",
  region: "os",
  title: "File System Calls",
  sections: [
    { id: "descriptors", label: "File Descriptors and the Three Tables" },
    { id: "open-close", label: "Opening and Closing Files" },
    { id: "read-write", label: "Reading and Writing" },
    { id: "sharing", label: "Sharing Descriptors: fork, dup2, and pipe" },
    { id: "durability", label: "Metadata and Durability" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>Unix gives every kind of I/O one interface. Files, pipes, sockets, and devices are all read and written through small integers called file descriptors. Five calls cover most programs: <code>open</code>, <code>read</code>, <code>write</code>, <code>lseek</code>, and <code>close</code>, each one trap into the kernel (see <a href="#/exceptions/system-calls">System Calls</a>). Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (chapter 10), Arpaci-Dusseau’s <em>Operating Systems: Three Easy Pieces</em> (chapter 39, on files and directories), and the Linux man pages.</p>

<h3 id="sec-descriptors">File Descriptors and the Three Tables</h3>
<p>A descriptor is an index into the process's <strong>descriptor table</strong>. By convention, 0 is standard input, 1 is standard output, and 2 is standard error. Behind the index sit three levels of kernel state:</p>
<div class="tbl"><table>
<tr><th>Table</th><th>One entry per</th><th>Holds</th></tr>
<tr><td>Descriptor table</td><td>Descriptor, in each process</td><td>A pointer to an open-file entry, and the close-on-exec flag</td></tr>
<tr><td>Open-file table</td><td>Call to <code>open</code>, system-wide</td><td>The current offset, the access mode and status flags (such as <code>O_APPEND</code>), and a reference count</td></tr>
<tr><td>Inode table</td><td>File, system-wide</td><td>Size, owner, permissions, timestamps, where the data lives, and the file's pages in the page cache</td></tr>
</table></div>
<p>The middle level is the one people forget, and it explains every sharing rule. Two descriptors share an offset exactly when they point at the same open-file entry. Opening a file twice gives two entries and two independent offsets. <code>dup2</code> and <code>fork</code> make a second descriptor that points at the existing entry, so a read through either one moves both.</p>
<div class="tbl"><svg viewBox="0 0 680 250" role="img" aria-label="The three tables after fork. The parent opened log.txt as descriptor 3 and then forked. Parent descriptor 3 and child descriptor 3 both point at one open-file entry with offset 4096 and reference count 2. The child then opened log.txt again as descriptor 4, which points at a second open-file entry with offset 0 and reference count 1. Both open-file entries point at the same inode for log.txt, size 8192." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrFD" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrFDt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="fill:var(--muted);font-size:11px">
<text x="20" y="18">descriptor tables (per process)</text><text x="270" y="18">open-file table</text><text x="530" y="18">inode table</text>
</g>
<g style="fill:var(--ink);font-size:12px;font-weight:600"><text x="20" y="44">parent</text><text x="20" y="118">child</text></g>
<rect x="20" y="50" width="150" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="20" y="124" width="150" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="20" y="154" width="150" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<rect x="270" y="60" width="190" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="270" y="150" width="190" height="50" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<rect x="530" y="100" width="130" height="60" rx="3" style="fill:var(--code-bg);stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="95" y="70">fd 3</text><text x="95" y="144">fd 3</text><text x="95" y="174">fd 4</text>
<text x="365" y="81">offset 4096</text><text x="365" y="171">offset 0</text>
<text x="595" y="126">log.txt</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="365" y="99">refs 2</text><text x="365" y="189">refs 1</text><text x="595" y="144">size 8192</text>
</g>
<g style="stroke:var(--trace);stroke-width:1.5;fill:none" marker-end="url(#arrFDt)">
<path d="M170,65 L268,78"/><path d="M170,139 L268,94"/>
</g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrFD)">
<path d="M170,169 L268,174"/><path d="M460,85 L528,118"/><path d="M460,175 L528,144"/>
</g>
<text x="20" y="226" style="fill:var(--muted);font-size:11px">After fork, both copies of fd 3 share one entry, so they share one offset. The child's own open of the</text>
<text x="20" y="241" style="fill:var(--muted);font-size:11px">same file creates a second entry with an independent offset. Both entries lead to the one inode.</text>
</svg></div>

<h3 id="sec-open-close">Opening and Closing Files</h3>
<p><code>int fd = open(path, flags, mode)</code> does three things:</p>
<ol>
<li><strong>Resolves the path</strong> one component at a time, checking search permission on each directory. The kernel's directory-entry cache keeps recent lookups in memory, so a hot path needs no I/O.</li>
<li><strong>Checks permission</strong> for the requested access against the file's owner, group, and mode bits.</li>
<li><strong>Allocates</strong> a new open-file entry and the lowest unused descriptor number, and returns that number. On failure it returns −1 and sets <code>errno</code>, for example to <code>ENOENT</code> (no such file), <code>EACCES</code> (permission denied), or <code>EMFILE</code> (the process is out of descriptors).</li>
</ol>
<p>The flags that matter most:</p>
<ul>
<li><code>O_RDONLY</code>, <code>O_WRONLY</code>, or <code>O_RDWR</code> sets the access mode.</li>
<li><code>O_CREAT</code> creates the file if it doesn't exist, with permissions <code>mode</code> masked by the process's umask. Adding <code>O_EXCL</code> makes the call fail if the file exists, an atomic way to take a lock file.</li>
<li><code>O_TRUNC</code> sets the size to 0.</li>
<li><code>O_APPEND</code> moves the offset to the end of the file before every write.</li>
<li><code>O_CLOEXEC</code> closes the descriptor automatically on <code>exec</code>, so it doesn't leak into programs the process starts.</li>
<li><code>O_DIRECT</code> bypasses the page cache and moves data straight between storage and the user buffer, which must then be aligned.</li>
</ul>
<p><code>close(fd)</code> frees the descriptor number and drops one reference to the open-file entry. The entry is freed only when its count reaches zero. That is why a pipe's reader sees end of file only after <em>every</em> descriptor for the write end, in every process, is closed. <code>close</code> does not write anything to storage.</p>

<h3 id="sec-read-write">Reading and Writing</h3>
<p><code>ssize_t n = read(fd, buf, count)</code> copies up to <code>count</code> bytes from the current offset into <code>buf</code>, advances the offset by <code>n</code>, and returns <code>n</code>. It can return less than was asked for, a <strong>short count</strong>, so correct code loops until it has what it needs:</p>
<ul>
<li><strong>0</strong> means end of file, or that every writer of a pipe has closed it.</li>
<li><strong>Fewer than <code>count</code></strong> happens near the end of a file, on pipes and sockets (whatever has arrived so far), and on terminals (one line at a time).</li>
<li><strong>−1 with <code>EINTR</code></strong> means a signal arrived before any data was transferred.</li>
</ul>
<p>For a regular file, <code>read</code> looks up each page in the page cache. A miss starts I/O and puts the process to sleep, and readahead fetches the following pages at the same time. A hit costs only a copy, done by the kernel from the page-cache frame into the user buffer.</p>
<p><code>write(fd, buf, count)</code> copies the other way: into page-cache pages, which are marked dirty, and then returns. The data reaches storage later, when the kernel's writeback flushes it (after about 30 seconds by default on Linux, or sooner under memory pressure). A successful <code>write</code> means other processes will see the data, not that the data would survive a power loss.</p>
<p><code>lseek(fd, offset, whence)</code> moves the offset without doing any I/O. <code>pread</code> and <code>pwrite</code> take an explicit offset and leave the shared one alone, so threads sharing a descriptor can do positioned I/O without racing on it.</p>

<h3 id="sec-sharing">Sharing Descriptors: fork, dup2, and pipe</h3>
<ul>
<li><strong><code>fork</code></strong> copies the descriptor table, so every child descriptor points at the same open-file entry as the parent's, and the two share offsets.</li>
<li><strong><code>dup2(oldfd, newfd)</code></strong> makes <code>newfd</code> point at <code>oldfd</code>'s entry, closing whatever <code>newfd</code> referred to first. This is how a shell redirects output.</li>
<li><strong><code>pipe(fds)</code></strong> creates a kernel buffer with a read end, <code>fds[0]</code>, and a write end, <code>fds[1]</code>. On Linux, the buffer holds 64 KiB by default. A writer blocks while it is full, and a reader blocks while it is empty. Writes of up to <code>PIPE_BUF</code> bytes (4096 on Linux) are atomic, so writes from several processes never interleave within one such write.</li>
</ul>
<p>A shell running <code>ls | wc -l</code> uses all three:</p>
<ol>
<li>The shell calls <code>pipe</code> and gets descriptor 3 (the read end) and 4 (the write end).</li>
<li>It forks twice. The first child calls <code>dup2(4, 1)</code>, pointing its standard output at the pipe. The second calls <code>dup2(3, 0)</code>, pointing its standard input at it.</li>
<li>Each child closes 3 and 4 and calls <code>execve</code>. The descriptor table survives <code>exec</code>, so <code>ls</code> writes into the pipe without knowing it.</li>
<li>The shell closes its own copies of 3 and 4 and waits for both children. If it kept 4 open, <code>wc</code> would never see end of file, since a write end would still exist.</li>
</ol>

<h3 id="sec-durability">Metadata and Durability</h3>
<ul>
<li><strong><code>stat(path, &amp;st)</code></strong> and <strong><code>fstat(fd, &amp;st)</code></strong> read the inode: size, mode, owner, timestamps, and the preferred I/O size, <code>st_blksize</code>.</li>
<li><strong><code>unlink(path)</code></strong> removes a name. The inode and its data are freed only once no name and no open-file entry refers to them, so a program can keep using a file it has already deleted.</li>
<li><strong><code>rename(oldpath, newpath)</code></strong> replaces <code>newpath</code> atomically. A process opening that name sees either the old file or the new one, never a mix.</li>
<li><strong><code>fsync(fd)</code></strong> writes the file's dirty pages and metadata to storage, tells the device to flush its own volatile cache, and waits. <code>fdatasync</code> skips metadata that isn't needed to read the data back, such as the modification time.</li>
</ul>
<p>Together these give the standard crash-safe way to replace a file's contents:</p>
<ol>
<li>Write the new contents to a temporary file in the same directory.</li>
<li><code>fsync</code> the temporary file, so its data is on storage.</li>
<li><code>rename</code> it over the old name.</li>
<li><code>fsync</code> the directory, so the rename itself is on storage.</li>
</ol>
<p>After a crash at any point, the name refers to either the complete old file or the complete new one.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Small calls are expensive.</strong> Each call pays a kernel crossing, so reading one byte per <code>read</code> is around a thousand times slower than reading 64 KiB at a time. The C library's <code>FILE</code> streams (<code>fread</code>, <code>fgets</code>, <code>printf</code>) exist to batch calls, with a buffer of <code>st_blksize</code> bytes, usually 4 KiB.</li>
<li><strong>The copy is the other cost.</strong> Reading cached data runs at memory-copy bandwidth, around 10 GB/s on one core, and leaves two copies of every byte in the caches. <code>sendfile</code> and <code>splice</code> move data between a file and a socket or pipe inside the kernel with no user-space copy, and <a href="#/mmap">mmap</a> maps the page-cache frames directly.</li>
<li><strong><code>fsync</code> sets commit latency.</strong> A flush takes from tens of microseconds to milliseconds depending on the device, so databases group many transactions into one <code>fsync</code> (group commit).</li>
<li><strong>Batch the calls themselves.</strong> <code>io_uring</code> lets a program queue hundreds of reads and writes in rings shared with the kernel and submit them all with one call.</li>
<li><strong>For a simulator:</strong> I/O-heavy workloads spend much of their time in these paths: the kernel's copy loops, page-cache lookups, and the crossings themselves. A user-only trace sees only the gaps between calls.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A log parser reads a 512 MiB file that is already in the page cache. Compare three versions:</p><ul><li><code>read(fd, &amp;c, 1)</code> for every byte.</li><li><code>fgets</code> on a <code>FILE</code> stream, which calls <code>read</code> with a 4 KiB buffer.</li><li><code>read</code> into a 1 MiB buffer, splitting lines by hand.</li></ul><p>Each <code>read</code> call costs 180 ns of fixed overhead, and the kernel copies at 8 GB/s. Ignore line splitting and any copying in user space, which cost the same in all three. How long does the I/O take in each version?</p>`,
        a: `<ol><li>File size = 512 MiB = 536,870,912 B. The kernel copies every byte once in all three versions: 536,870,912 B / (8 × 10<sup>9</sup> B/s) = 67.1 ms.</li><li>1-byte reads: 536,870,912 calls × 180 ns = 96.6 s. Total ≈ <strong>96.7 s</strong>.</li><li><code>fgets</code>: 536,870,912 / 4096 = 131,072 calls × 180 ns = 23.6 ms. Total ≈ <strong>90.7 ms</strong>.</li><li>1 MiB buffer: 512 calls × 180 ns = 0.09 ms. Total ≈ <strong>67.2 ms</strong>.</li><li>Buffering gives about a 1,000× speedup. Past 4 KiB, the copy dominates, so the next step is to remove the copy (for example with <code>mmap</code>), not to grow the buffer.</li></ol>`
      },
      {
        q: `<p>A program runs the code below and creates a new, empty <code>out.txt</code>. What does the file contain at the end? What would it contain if the child, instead of using the inherited <code>fd</code>, opened <code>out.txt</code> itself with <code>O_WRONLY</code> and wrote through that?</p><pre><code>int fd = open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
write(fd, "ab", 2);
if (fork() == 0) {
    write(fd, "cd", 2);
    _exit(0);
}
wait(NULL);
write(fd, "ef", 2);</code></pre>`,
        a: `<ol><li><code>open</code> creates one open-file entry with offset 0. The parent writes "ab" at offset 0, and the offset becomes 2.</li><li><code>fork</code> copies the descriptor table, so the child's <code>fd</code> points at the same entry.</li><li>The child writes "cd" at offset 2, and the shared offset becomes 4.</li><li>The parent waits for the child, then writes "ef" at offset 4. The file is <strong>abcdef</strong>.</li><li>With its own <code>open</code>, the child gets a second entry with offset 0 (no <code>O_APPEND</code>, no <code>O_TRUNC</code>). It writes "cd" over "ab", so the file is "cd".</li><li>The parent's entry still has offset 2, so it writes "ef" at offset 2. The file is <strong>cdef</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Two processes each open the same log file with <code>O_WRONLY</code> (no <code>O_APPEND</code>), call <code>lseek(fd, 0, SEEK_END)</code> once at startup, and then each write 120-byte records with one <code>write</code> call per record. What goes wrong, and how does <code>O_APPEND</code> fix it? Assume a local file system, not NFS.</p>`,
        a: `<p>Each process has its own open-file entry and its own offset, set once to the end of the file at startup. When process A writes a record at offset X, process B's offset is still X too, so B's next record lands on top of A's and overwrites it. Seeking to the end before every write doesn't fix it: the <code>lseek</code> and the <code>write</code> are two calls, and the other process can write in between. With <code>O_APPEND</code>, the kernel moves the offset to the current end of the file and writes the data as one step under the inode's lock, so every record lands after the previous one and none overlap. Records from the two processes still interleave, but each 120-byte record stays whole. On NFS, <code>O_APPEND</code> is not atomic, because the client computes the end of the file from cached state.</p>`
      },
      {
        q: `<p>Bash runs <code>cmd &gt; out.txt 2&gt;&amp;1</code>. List the system calls the shell and the child make, in order. Then explain why <code>cmd 2&gt;&amp;1 &gt; out.txt</code> leaves error messages on the terminal.</p>`,
        a: `<ol><li>The shell calls <code>fork</code>, then <code>wait4</code> (behind <code>waitpid</code>) to wait for the child.</li><li>The child calls <code>open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0666)</code>, which returns the lowest free descriptor, say 3.</li><li><code>dup2(3, 1)</code> points standard output at the file's entry, then <code>close(3)</code>.</li><li><code>dup2(1, 2)</code> points standard error at the entry descriptor 1 now uses, the file.</li><li><code>execve("cmd", ...)</code> runs the program with descriptors 1 and 2 sharing one entry, and so one offset, so output and errors interleave in the file without overwriting each other.</li></ol><p>Redirections apply left to right. In <code>2&gt;&amp;1 &gt; out.txt</code>, <code>dup2(1, 2)</code> runs first, while descriptor 1 still refers to the terminal, so standard error is pointed at the terminal. Redirecting descriptor 1 to the file afterward doesn't change descriptor 2.</p>`
      },
      {
        q: `<p>A program creates a new file, and <code>write</code> returns 4096. The machine loses power a moment later. List everything that could keep those bytes from being readable under that name after reboot, and the call that removes each risk.</p>`,
        a: `<ul><li><strong>The data is only in the page cache.</strong> <code>write</code> copied it into a dirty page and returned. Writeback might not have run. <code>fsync(fd)</code> (or <code>fdatasync</code>) writes it out.</li><li><strong>The device's volatile write cache.</strong> An SSD may acknowledge a write once the data is in its DRAM cache. <code>fsync</code> also issues a cache flush to the device, unless the device reports a power-loss-protected cache.</li><li><strong>The file's metadata.</strong> The new size and block pointers must be on storage too, or the data is unreachable. <code>fsync</code> covers the file's own metadata, and <code>fdatasync</code> covers the size.</li><li><strong>The directory entry.</strong> The file is new, so its name lives in the directory, which is a separate inode. Without <code>fsync</code> on the directory, the file can vanish after reboot even though its data was written.</li></ul><p>A successful <code>write</code> guarantees only visibility to other processes, not durability.</p>`
      }
    ]
  }
},

{
  id: "process-syscalls",
  region: "os",
  title: "Process System Calls",
  sections: [
    { id: "lifecycle", label: "The Life of a Process" },
    { id: "fork", label: "Creating a Process with fork" },
    { id: "spawn", label: "Starting a New Program: Exec and Spawn" },
    { id: "exit-wait", label: "Exiting and Waiting" },
    { id: "signals", label: "Signals" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>A process is an address space, a descriptor table, and one or more threads, with an ID. A handful of calls create, change, and end processes. <code>fork</code> copies the calling process, <code>exec</code> replaces its program, <code>exit</code> ends it, and <code>wait</code> collects its result. Signals let the kernel and other processes interrupt it. Builds on <a href="#/demand-paging">Demand Paging and Copy-on-Write</a> and <a href="#/file-syscalls">File System Calls</a>. Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (chapter 8), Arpaci-Dusseau’s <em>Operating Systems: Three Easy Pieces</em> (chapter 5, on the process API), and the Linux man pages.</p>

<h3 id="sec-lifecycle">The Life of a Process</h3>
<p>Every process except the first (<code>init</code>, PID 1) is created by another process, its parent. A shell running a command goes through the whole cycle:</p>
<ol>
<li><strong><code>fork</code>:</strong> the shell makes a copy of itself.</li>
<li><strong><code>exec</code>:</strong> the copy replaces its program with the command, keeping its PID and its open descriptors.</li>
<li><strong><code>exit</code>:</strong> the command finishes, and the kernel frees its memory and descriptors. The process becomes a <strong>zombie</strong> that keeps only its PID, exit status, and resource usage.</li>
<li><strong><code>wait</code>:</strong> the shell collects the exit status, and the kernel frees what was left of the zombie. This is called reaping.</li>
</ol>
<p>Other process calls worth knowing:</p>
<div class="tbl"><table>
<tr><th>Call</th><th>What it does</th></tr>
<tr><td><code>getpid</code>, <code>getppid</code></td><td>Return the caller's PID and its parent's PID</td></tr>
<tr><td><code>clone</code></td><td>Linux's general creation call. Its flags choose what the new task shares with its creator (address space, descriptor table, signal handlers), so it creates both processes and threads.</td></tr>
<tr><td><code>kill</code></td><td>Sends a signal to a process or a process group</td></tr>
<tr><td><code>sigaction</code></td><td>Installs a handler for a signal, or sets it to be ignored</td></tr>
<tr><td><code>nanosleep</code></td><td>Blocks the caller for a given time</td></tr>
<tr><td><code>sched_yield</code></td><td>Gives up the core to another runnable thread</td></tr>
</table></div>

<h3 id="sec-fork">Creating a Process with fork</h3>
<p><code>pid_t pid = fork()</code> is called once and returns twice: 0 in the child, and the child's PID in the parent (or −1 in the parent if it failed). The child starts as a copy of the parent at the moment of the call:</p>
<ul>
<li><strong>Copied:</strong> the address space (lazily, by <a href="#/demand-paging/cow">copy-on-write</a>), the registers, the descriptor table (pointing at the same open-file entries, see <a href="#/file-syscalls/sharing">Sharing Descriptors</a>), signal handlers, and the current directory.</li>
<li><strong>Not copied:</strong> the PID, pending signals, timers, record locks taken with <code>fcntl</code>, and every thread except the one that called <code>fork</code>.</li>
</ul>
<p>Which of the two runs first is up to the scheduler, so their output can interleave in any order. The missing threads are a trap for multithreaded programs. If another thread held a lock at the moment of the fork, the child's copy of that lock stays held forever by a thread that doesn't exist in the child. POSIX therefore allows only async-signal-safe functions in the child of a multithreaded program until it calls <code>exec</code>.</p>
<p>On Linux, <code>fork</code> is <code>clone</code> with no sharing flags. <code>pthread_create</code> is <code>clone</code> with flags such as <code>CLONE_VM</code>, <code>CLONE_FILES</code>, <code>CLONE_SIGHAND</code>, and <code>CLONE_THREAD</code>, so the new thread shares the address space and page table, and there is nothing to copy or write-protect.</p>

<h3 id="sec-spawn">Starting a New Program: Exec and Spawn</h3>
<p><code>execve(path, argv, envp)</code> replaces the calling process's program and doesn't return if it succeeds:</p>
<ul>
<li><strong>Replaced:</strong> the whole address space. The kernel discards every region and builds new ones for the executable's segments and its dynamic loader (see <a href="#/comp-load">Loading and Running</a>), plus a new stack holding <code>argv</code>, <code>envp</code>, and the auxiliary vector.</li>
<li><strong>Reset:</strong> caught signals go back to their default action, since the handler code no longer exists. Ignored signals stay ignored.</li>
<li><strong>Kept:</strong> the PID, the parent, descriptors not marked close-on-exec, the current directory, and resource limits.</li>
</ul>
<p>What starting a program costs, and how to avoid paying for a fork first:</p>
<ul>
<li><strong>Memory use</strong> starts near zero: the new regions point at the executable's file offsets, all not present. No memory is used until the program starts touching its pages, and the page cache and readahead usually have the hot pages ready before they are needed.</li>
<li><strong><code>fork</code> then <code>exec</code></strong> still pays for the fork: copying the page table and write-protecting every writable page of the parent, even though the child is about to discard all of it. For a parent with tens of gigabytes mapped, that is tens of megabytes of page-table entries to copy, then a write fault on the first store to each page.</li>
<li><strong><code>posix_spawn</code></strong> avoids the copy. glibc implements it with <code>clone(CLONE_VM | CLONE_VFORK)</code>: the child runs on the parent's own page table, with no copy and no write-protection, while the parent waits. The child does only a fixed list of safe steps (the file actions, such as redirecting descriptors), then calls <code>exec</code>, at which point the parent resumes. Because those steps are known not to disturb the parent's memory, sharing the address space for that short window is safe.</li>
</ul>

<h3 id="sec-exit-wait">Exiting and Waiting</h3>
<ul>
<li><strong><code>exit(status)</code></strong> is a library function. It runs <code>atexit</code> handlers and flushes <code>FILE</code> buffers, then calls <code>_exit</code>. Returning from <code>main</code> does the same.</li>
<li><strong><code>_exit(status)</code></strong> is the system call (<code>exit_group</code> on Linux, which ends every thread of the process). The kernel closes all descriptors, releases the address space, hands any children to <code>init</code> (or to a designated subreaper), keeps the low 8 bits of the status, and sends <code>SIGCHLD</code> to the parent.</li>
<li><strong><code>waitpid(pid, &amp;status, options)</code></strong> blocks until a child changes state, returns its PID, and reaps it. <code>WIFEXITED</code> and <code>WEXITSTATUS</code> decode a normal exit, and <code>WIFSIGNALED</code> and <code>WTERMSIG</code> decode a death by signal. With <code>WNOHANG</code>, it returns 0 at once instead of blocking if no child has finished.</li>
</ul>
<p>Until it is reaped, a finished child stays a zombie. It holds a PID and its kernel task structure, a few KiB, but no memory or files. A parent that never waits leaks PIDs. If the parent dies first, <code>init</code> adopts the orphan and reaps it.</p>

<h3 id="sec-signals">Signals</h3>
<p>A signal is a small message, just a number, that the kernel delivers to a process. Some start as a hardware exception, and the rest come from other processes or the kernel:</p>
<div class="tbl"><table>
<tr><th>Signal</th><th>Default action</th><th>Typical cause</th></tr>
<tr><td><code>SIGSEGV</code></td><td>Terminate and dump core</td><td>A page fault the kernel can't fix: the address is in no region, or the access breaks the region's permissions</td></tr>
<tr><td><code>SIGFPE</code></td><td>Terminate and dump core</td><td>An integer divide by zero</td></tr>
<tr><td><code>SIGILL</code></td><td>Terminate and dump core</td><td>An illegal instruction</td></tr>
<tr><td><code>SIGBUS</code></td><td>Terminate and dump core</td><td>A touch of a mapped file page past the end of the file</td></tr>
<tr><td><code>SIGINT</code></td><td>Terminate</td><td>Ctrl-C in the terminal</td></tr>
<tr><td><code>SIGTERM</code></td><td>Terminate</td><td>A polite request to exit, and the default for the <code>kill</code> command</td></tr>
<tr><td><code>SIGKILL</code></td><td>Terminate, and can't be caught or ignored</td><td><code>kill -9</code>, or the kernel's out-of-memory killer</td></tr>
<tr><td><code>SIGCHLD</code></td><td>Ignore</td><td>A child exited or stopped</td></tr>
</table></div>
<p>Delivery reuses the kernel-entry machinery from <a href="#/exceptions/trap-frame">The Handler and the Trap Frame</a>:</p>
<ol>
<li><code>kill(pid, sig)</code>, or the kernel itself, sets the signal's bit in the target's pending set. If the target is asleep in a system call that can be interrupted, the kernel wakes it.</li>
<li>Signals are acted on only on the way back to user mode. On every return from a system call, interrupt, or exception, the kernel checks for signals that are pending and not blocked.</li>
<li>For a caught signal, the kernel pushes a <strong>signal frame</strong> holding the saved user registers onto the user stack. Then it edits the trap frame so that the return lands at the start of the handler, with the signal number as its argument and a return address pointing at a short trampoline (provided by libc on x86-64 Linux).</li>
<li>The handler runs in user mode. When it returns, the trampoline calls <code>rt_sigreturn</code>, which restores the registers from the signal frame, and the program continues where it was interrupted.</li>
</ol>
<p>A signal that arrives while the process is blocked in a slow call, such as <code>read</code> on a pipe or terminal, makes the call fail with <code>EINTR</code> if no data has been transferred yet. If the handler was installed with <code>SA_RESTART</code>, the kernel restarts the call instead. Pending signals form a set, not a queue: two <code>SIGCHLD</code>s that arrive before the handler runs look like one.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong><code>fork</code> scales with the parent's page table, not its work.</strong> Copying and write-protecting entries costs time per mapped page, and copy-on-write faults follow (see <a href="#/demand-paging/perf">Demand Paging and Copy-on-Write</a>). A threaded parent also pays TLB shootdowns.</li>
<li><strong>Threads are cheaper than processes</strong> to create and to switch between. A switch between threads of one process keeps the page table and the TLB's contents. A switch between processes loads a new page-table base, and ASID or PCID tags only avoid a full TLB flush, not the misses on the new process's pages.</li>
<li><strong><code>exec</code> costs mostly faults.</strong> The call itself is short, but the new program then faults in every page it touches, and dynamic linking loads and relocates shared libraries before <code>main</code> runs.</li>
<li><strong>Signals are slow</strong> compared with function calls: each delivery is a kernel entry, a frame built on the user stack, and a second system call to return, on the order of microseconds. Programs that handle frequent events (timers, I/O readiness) read them from a descriptor with <code>signalfd</code>, <code>timerfd</code>, or <code>epoll</code> instead.</li>
<li><strong>For a simulator:</strong> syscall-emulation modes such as gem5 SE carry out <code>fork</code>, <code>exec</code>, and signals inside the simulator, often only in part, so their kernel cost doesn't appear. Process-heavy workloads such as shells, build systems, and pre-fork servers need full-system simulation.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>What does this program print when standard output is a terminal, and when it is redirected to a file?</p><pre><code>int main(void) {
    printf("A\\n");
    for (int i = 0; i &lt; 2; i++)
        fork();
    printf("B\\n");
    return 0;
}</code></pre>`,
        a: `<ol><li>Count processes: the first iteration's <code>fork</code> makes 2 processes, and both run the second iteration, making 4.</li><li>Each of the 4 processes prints "B", so there are 4 B lines in both cases.</li><li>Terminal: <code>stdout</code> is line-buffered, so "A\\n" is written to the terminal before the first fork, and no copy of it is left in any buffer. Output: one A, then four Bs, <strong>5 lines</strong>.</li><li>File: <code>stdout</code> is fully buffered (4 KiB), so "A\\n" is still in the buffer at the first fork, and each fork copies the buffer along with the rest of the address space. All 4 processes hold "A\\n", add "B\\n", and flush at exit. Output: A, B repeated four times, <strong>8 lines</strong>.</li><li>Fix: call <code>fflush(stdout)</code> before <code>fork</code>.</li></ol>`
      },
      {
        q: `<p>On x86-64 Linux, a program installs a <code>SIGINT</code> handler with <code>sigaction</code> (without <code>SA_RESTART</code>) that only sets a flag, then calls <code>read</code> on the terminal, and no input has been typed yet. The user presses Ctrl-C. Trace the events until the code after <code>read</code> runs, and say what <code>read</code> returns.</p>`,
        a: `<ol><li>The keyboard input arrives through an interrupt. The terminal driver sees the Ctrl-C character and sends <code>SIGINT</code> to the terminal's foreground process group, which sets the pending bit in the program and wakes it from its sleep inside <code>read</code>.</li><li>The <code>read</code> code in the kernel finds a signal pending and no data transferred, so it stops and prepares to return an interrupted-call error.</li><li>On the way back to user mode, the kernel finds <code>SIGINT</code> pending and caught. Because there is no <code>SA_RESTART</code>, it sets the saved rax to −EINTR. It pushes a signal frame with the saved registers onto the user stack and edits the trap frame so the return goes to the handler, with rdi = 2 (<code>SIGINT</code>).</li><li>The handler sets the flag and returns into the trampoline, which calls <code>rt_sigreturn</code>. The kernel restores the registers from the signal frame, including rax = −EINTR, and returns to the instruction after <code>syscall</code> in libc's <code>read</code> wrapper.</li><li>The wrapper sees −EINTR, sets <code>errno = EINTR</code>, and returns <strong>−1</strong>. The program can then check the flag. With <code>SA_RESTART</code>, the kernel would instead rewind the saved PC to the <code>syscall</code> instruction, and <code>read</code> would block again.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 16-thread server calls <code>fork</code>, and before <code>execve</code> the child calls a logging library that takes the library's mutex. Occasionally the child hangs forever. Why, and what are two fixes?</p>`,
        a: `<p>Only the thread that called <code>fork</code> exists in the child. If one of the other 15 threads held the logging mutex at that moment, the child inherits a copy of the mutex in its locked state, and no thread in the child will ever unlock it, so the child's first lock attempt waits forever. It is intermittent because it needs the fork to land while the lock is held. glibc protects its own <code>malloc</code> and <code>stdio</code> locks with internal fork handlers, but other libraries' locks get no such care, which is why POSIX allows only async-signal-safe calls in the child of a multithreaded program until <code>exec</code>. Fixes:</p><ul><li>Do nothing in the child but async-signal-safe setup (<code>dup2</code>, <code>close</code>) and <code>execve</code>, or use <code>posix_spawn</code>, which does exactly that.</li><li>Register <code>pthread_atfork</code> handlers that take the mutex before the fork and release it in both processes after.</li><li>Fork all helpers from a small single-threaded process started before any threads exist.</li></ul>`
      },
      {
        q: `<p>A server forks a child per connection, and each child handles one request and exits. The server never calls <code>wait</code>. After a few days, <code>fork</code> starts failing with <code>EAGAIN</code>. What accumulated, what was freed, and how do you fix it without blocking the accept loop?</p>`,
        a: `<p>Every child became a zombie. Its memory, descriptors, and address space were freed at exit, but its PID and task structure stay until the parent reaps it. Eventually the zombies use up the PID space (<code>pid_max</code>) or the user's process limit, and <code>fork</code> fails. Fixes:</p><ul><li>Install a <code>SIGCHLD</code> handler that calls <code>waitpid(-1, &amp;status, WNOHANG)</code> in a loop until it returns 0 or −1. The loop is required because pending signals don't queue: if several children exit before the handler runs, the handler is called once.</li><li>Set <code>SIGCHLD</code> to <code>SIG_IGN</code>, which tells the kernel to reap children automatically (the server then can't read their exit status).</li><li>Reap from the event loop with a <code>WNOHANG</code> loop, or with <code>signalfd</code> or a pidfd, if the server already uses <code>epoll</code>.</li></ul>`
      },
      {
        q: `<p>A pre-fork web server's master process has 6 GiB of resident anonymous memory in 4 KiB pages, with 8-byte page-table entries. It forks 64 workers. Each fork copies and write-protects the leaf entries at 1.5 ns per entry. Over its life, each worker writes to 12.5% of the inherited pages, and each copy-on-write fault costs 1.2 µs including the copy. Assume no two workers' copies are shared and no huge pages. How long do the forks take, how much memory and fault time do the workers add, and how does total memory compare with 64 independent processes that each load the same 6 GiB?</p>`,
        a: `<ol><li>Pages = 6 GiB / 4 KiB = 1,572,864. Leaf entries copied per fork = 1,572,864 × 8 B = 12 MiB.</li><li>Fork time = 1,572,864 × 1.5 ns = 2.36 ms per fork, and 64 × 2.36 ms = <strong>151 ms</strong> for all workers.</li><li>Pages written per worker = 0.125 × 1,572,864 = 196,608, so each worker adds 196,608 × 4 KiB = 768 MiB. All 64 add 64 × 768 MiB = <strong>48 GiB</strong>.</li><li>Fault time per worker = 196,608 × 1.2 µs = 0.236 s, and 64 × 0.236 s = <strong>15.1 s</strong> of CPU time.</li><li>Total with copy-on-write = 6 GiB + 48 GiB = <strong>54 GiB</strong>. Independent processes need 64 × 6 GiB = <strong>384 GiB</strong>, about 7× more.</li><li>The write fraction drives everything. In CPython, reference counting and the garbage collector write to objects that are only read, which pushes the fraction up. That is why Instagram froze the collector's heap before forking, which led to <code>gc.freeze()</code> in Python 3.7.</li></ol>`
      },
      {
        q: `<p>On Linux, both <code>fork</code> and <code>pthread_create</code> are built on <code>clone</code>. Why is creating a thread so much cheaper than creating a process, and why is switching between two threads of one process cheaper than switching between two processes?</p>`,
        a: `<ul><li><strong>Creation:</strong> <code>pthread_create</code> passes <code>CLONE_VM</code> and related flags, so the new thread shares the creator's memory descriptor and page table. There are no page-table entries to copy, nothing to write-protect, no TLB shootdown, and no copy-on-write faults afterward. <code>fork</code> does all of these, with cost proportional to the parent's mapped memory. A thread still needs a kernel task structure, a kernel stack, and a user stack, which <code>mmap</code> reserves.</li><li><strong>Switching:</strong> both kinds of switch save and restore registers and run the scheduler. Between threads of one process, the page-table base stays the same, so every TLB entry stays valid, and the caches stay warm with shared data. Between processes, the kernel loads a new page-table base. PCID or ASID tags keep the old entries from being flushed, but the new process still misses on its own pages, and its working set must displace the old one in the caches.</li></ul>`
      }
    ]
  }
}
]);
