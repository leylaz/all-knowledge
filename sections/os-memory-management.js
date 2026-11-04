/* Section: OS memory management
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "osmem"). */

section({
  id: "osmem",
  name: "OS Memory Management",
  cap: "Page tables as indirection, CR3, demand paging, page faults, copy-on-write, swap, page replacement, reclaim, mmap, shared and private mappings, where malloc gets memory",
  sections: [
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>The hardware translates every address through the page tables (see <a href="#/r/vm">Virtual Memory</a>), but the kernel decides what goes in them. It fills them only when a page is first touched, shares frames between processes until one of them writes, evicts pages when memory runs short, and maps files straight into an address space.</p>
<p>Each of these decisions starts with a page fault, so they all run through the fault path in <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/demand-paging">Demand Paging and Copy-on-Write</a>: how the kernel builds the page tables lazily and shares frames after <code>fork</code>.</li>
<li><a href="#/page-replacement">Page Replacement</a>: which pages the kernel evicts under memory pressure, and how it finds them.</li>
<li><a href="#/mmap">Memory Mapping</a>: mapping files and anonymous memory with <code>mmap</code>, and where <code>malloc</code> gets its memory.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A DRAM access takes 80 ns, and a major page fault served from an NVMe SSD takes 100 µs from the fault to the retried access. What fraction of accesses can take a major fault before the average access is 10% slower than DRAM? What would it be with a hard disk at 8 ms per fault?</p>`,
        a: `<ol><li><strong>Target:</strong> 10% slower than 80 ns is 88 ns.</li><li><strong>Average access time:</strong> (1 − p) × 80 + p × 100,000 ≤ 88 ns, so p × 99,920 ≤ 8.</li><li><strong>SSD:</strong> p ≤ 8 / 99,920 ≈ 8.0 × 10<sup>−5</sup>, or <strong>1 fault in about 12,500 accesses</strong>.</li><li><strong>Hard disk:</strong> p × (8,000,000 − 80) ≤ 8, so p ≤ 1.0 × 10<sup>−6</sup>, or <strong>1 fault in about 1,000,000 accesses</strong>.</li><li><strong>Takeaway:</strong> even with a fast SSD, a working set that doesn't fit in memory is ruinous. Replacement has to keep the major-fault rate far below one in ten thousand.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A log-analysis job maps a 64 GiB file with <code>mmap</code> on a 32 GiB machine and reads it once from start to end. Other services on the machine slow down while it runs. Explain why, and what you'd change. Assume 4 KiB pages and Linux defaults.</p>`,
        a: `<ul><li><strong>Faults:</strong> 64 GiB / 4 KiB is about 16.8 million pages. Readahead and fault-around (64 KiB by default) cut the number of faults by mapping 16 pages per fault, but every page still goes through the page cache.</li><li><strong>Cache pressure:</strong> each page is read once and never used again, but it enters the page cache like any other. Until reclaim learns that, it competes with the other services' file pages and anonymous memory, so they lose pages they will need again and take major faults to get them back.</li><li><strong>Reclaim cost:</strong> kswapd and direct reclaim use CPU time, and every unmapped page needs a TLB shootdown on the cores running the job.</li><li><strong>Fixes:</strong><ul><li><code>madvise(MADV_SEQUENTIAL)</code> for more aggressive readahead and earlier eviction behind the reader.</li><li><code>madvise(MADV_DONTNEED)</code> or <code>posix_fadvise(POSIX_FADV_DONTNEED)</code> on ranges already processed.</li><li><code>read</code> into a reused buffer, or <code>O_DIRECT</code>, to bypass the page cache.</li><li>A cgroup memory limit on the job, so its page cache can't grow past its share.</li></ul></li></ul>`
      }
    ]
  }
}, [
{
  id: "demand-paging",
  region: "osmem",
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
<li><strong>Context switch.</strong> When the scheduler switches to a thread of another process, it writes the new process's root frame number into CR3. The low 12 bits carry the process's PCID, and setting bit 63 tells the core to keep that PCID's TLB entries instead of flushing them. Without PCIDs, a CR3 write flushes every TLB entry that isn't marked global. Kernel mappings are global, so they survive either way (see <a href="#/tlb/coherence">Keeping TLBs Coherent</a>). Threads of one process share its root table, so switching between them leaves CR3 alone.</li>
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
  region: "osmem",
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
<li><strong>Shoot down the TLBs.</strong> Any core may still cache the old translation, and a core holding a stale entry could keep reading or writing the frame after it has been reused. The kernel invalidates the entry on every core that may hold it and waits for all of them to confirm (the protocol is in <a href="#/tlb/coherence">Keeping TLBs Coherent</a>). Reclaim batches many pages per shootdown to spread its cost.</li>
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
<li><strong>Flush the paging-structure caches.</strong> No TLB holds a translation through the table, since all its entries were already not present. But a page-walk cache may still hold the old page-directory entry and send a walk straight to the old frame. On x86, <code>invlpg</code> for any address also flushes the paging-structure caches for the current PCID, and a shootdown does the same on the other cores (see <a href="#/tlb/coherence">Keeping TLBs Coherent</a>).</li>
<li><strong>Free the frame.</strong></li>
</ol>
<p>A later access to that 2 MB range plays out in this order:</p>
<ol>
<li><strong>The walk stops one level early.</strong> The walker reads the PML4 and PDPT entries, which are present, and then the page-directory entry, whose P bit is clear. It stops there and marks the access as faulting, so it never fetches a line from the missing table. That is why the walk itself never needs anything that isn't in DRAM (see <a href="#/page-walk/walk">What a Page Walk Does</a>).</li>
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
  region: "osmem",
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
}
]);
